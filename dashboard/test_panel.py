from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from finance.models import Account, Budget, Category, Debt, ReservedFund, SavingsGoal, Transaction


class PanelTests(TestCase):
    def setUp(self):
        self.u = User.objects.create_user("ana", password="x")
        self.other = User.objects.create_user("otro", password="x")
        self.client.login(username="ana", password="x")
        self.a = Account.objects.create(user=self.u, name="Nequi", account_type="NEQUI", balance=100000)
        self.b = Account.objects.create(user=self.u, name="Efectivo", account_type="CASH", balance=0)
        self.food = Category.objects.create(user=self.u, name="comida", type="EXPENSE")
        self.sal = Category.objects.create(user=self.u, name="salario", type="INCOME")

    def post(self, page, **data):
        return self.client.post(reverse(f"dashboard:{page}"), data, follow=True)

    def bal(self, acc):
        acc.refresh_from_db()
        return acc.balance

    def test_all_pages_load(self):
        for n in ("home", "transactions", "accounts", "categories", "plans", "chat"):
            self.assertEqual(self.client.get(reverse(f"dashboard:{n}")).status_code, 200, n)

    def test_requires_login(self):
        self.client.logout()
        for n in ("transactions", "accounts", "categories", "plans"):
            self.assertEqual(self.client.get(reverse(f"dashboard:{n}")).status_code, 302)

    def test_expense_income_and_delete_restore_balance(self):
        self.post("transactions", action="create", type="EXPENSE", amount="15.000", account=self.a.id, category=self.food.id, date="2026-09-01")
        self.assertEqual(self.bal(self.a), 85000)
        self.post("transactions", action="create", type="INCOME", amount="2.000.000", account=self.a.id, category=self.sal.id)
        self.assertEqual(self.bal(self.a), 2085000)
        tx = Transaction.objects.get(type="EXPENSE")
        self.post("transactions", action="delete", id=tx.id)
        self.assertEqual(self.bal(self.a), 2100000)
        self.assertFalse(Transaction.objects.filter(pk=tx.pk).exists())

    def test_transfer_and_delete(self):
        self.post("transactions", action="create", type="TRANSFER", amount="40000", account=self.a.id, transfer_account=self.b.id)
        self.assertEqual((self.bal(self.a), self.bal(self.b)), (60000, 40000))
        self.post("transactions", action="delete", id=Transaction.objects.get().id)
        self.assertEqual((self.bal(self.a), self.bal(self.b)), (100000, 0))

    def test_errors_show_message_and_change_nothing(self):
        r = self.post("transactions", action="create", type="EXPENSE", amount="999.999", account=self.a.id, category=self.food.id)
        self.assertContains(r, "Saldo insuficiente")
        r = self.post("transactions", action="create", type="EXPENSE", amount="", account=self.a.id, category=self.food.id)
        self.assertContains(r, "Escribe un monto")
        r = self.post("transactions", action="create", type="EXPENSE", amount="5000", account=self.a.id, category=self.sal.id)
        self.assertContains(r, "no es de gastos")
        self.assertEqual(self.bal(self.a), 100000)

    def test_cannot_touch_other_users_data(self):
        theirs = Account.objects.create(user=self.other, name="Ajena", account_type="CASH", balance=500)
        r = self.post("transactions", action="create", type="EXPENSE", amount="100", account=theirs.id, category=self.food.id)
        self.assertContains(r, "Elige una cuenta")
        self.post("accounts", action="toggle", id=theirs.id)
        theirs.refresh_from_db()
        self.assertTrue(theirs.is_active)

    def test_accounts_crud(self):
        self.post("accounts", action="create", name="Banco", account_type="BANK", balance="1.500.000")
        acc = Account.objects.get(name="Banco")
        self.assertEqual(acc.balance, 1500000)
        self.post("accounts", action="edit", id=acc.id, name="Bancolombia", account_type="BANK", balance="2.000")
        acc.refresh_from_db()
        self.assertEqual((acc.name, acc.balance), ("Bancolombia", 2000))
        self.post("accounts", action="toggle", id=acc.id)
        acc.refresh_from_db()
        self.assertFalse(acc.is_active)
        self.assertContains(self.post("accounts", action="create", name="nequi", account_type="NEQUI"), "Ya tienes una cuenta")

    def test_categories_crud(self):
        self.post("categories", action="create", name="Mascotas", type="EXPENSE", icon="🐶")
        c = Category.objects.get(name="mascotas")
        self.post("categories", action="edit", id=c.id, name="perros", icon="🐕")
        c.refresh_from_db()
        self.assertEqual(c.name, "perros")
        self.post("categories", action="toggle", id=c.id)
        c.refresh_from_db()
        self.assertFalse(c.is_active)
        self.assertContains(self.post("categories", action="create", name="Comida", type="EXPENSE"), "Ya existe")

    def test_new_user_gets_default_categories(self):
        self.client.login(username="otro", password="x")
        self.client.get(reverse("dashboard:categories"))
        self.assertTrue(Category.objects.filter(user=self.other, name="transporte").exists())

    def test_plans(self):
        self.post("plans", action="goal_create", name="Viaje", target="1.000.000")
        g = SavingsGoal.objects.get()
        self.post("plans", action="goal_add", id=g.id, amount="250.000")
        g.refresh_from_db()
        self.assertEqual(g.current_amount, 250000)
        self.post("plans", action="debt_create", name="Moto", creditor="Banco", total="600.000")
        d = Debt.objects.get()
        self.post("plans", action="debt_pay", id=d.id, amount="600.000")
        d.refresh_from_db()
        self.assertEqual(d.status, "PAID")
        self.post("plans", action="budget_set", category=self.food.id, limit="200.000")
        self.post("plans", action="budget_set", category=self.food.id, limit="300.000")
        self.assertEqual(Budget.objects.get().limit_amount, 300000)
        self.post("plans", action="fund_create", name="Arriendo", amount="30.000", account=self.a.id)
        self.assertEqual(self.bal(self.a), 70000)
        self.post("plans", action="fund_release", id=ReservedFund.objects.get().id)
        self.assertEqual(self.bal(self.a), 100000)
        self.assertEqual(self.client.get(reverse("dashboard:plans")).status_code, 200)

    def test_transactions_filters(self):
        self.post("transactions", action="create", type="EXPENSE", amount="1000", account=self.a.id, category=self.food.id, date="2026-08-10")
        r = self.client.get(reverse("dashboard:transactions") + "?mes=2026-08&tipo=EXPENSE")
        self.assertContains(r, "$1.000")
        r = self.client.get(reverse("dashboard:transactions") + "?mes=basura")
        self.assertEqual(r.status_code, 200)
