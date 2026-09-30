from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, Client
from django.urls import reverse

from finance.models import Account, Category
from bot.services import chat, process_message
from bot.models import Conversation


class TestBotIntegration(TestCase):
    """Tests de integración para el flujo completo del bot"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="test1234",
        )
        self.account = Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("100000"),
        )
        self.category = Category.objects.create(
            user=self.user,
            name="alimentación",
            type="EXPENSE",
        )
        self.income_category = Category.objects.create(
            user=self.user,
            name="salario",
            type="INCOME",
        )

    def tearDown(self):
        Conversation.objects.filter(user=self.user).delete()

    def test_complete_expense_flow(self):
        """Test flujo completo: registrar gasto via chat"""
        # Paso 1: Usuario envía mensaje completo
        response = chat(self.user, "gasté 5000 en comida en Nequi", account=self.account)
        # El bot pide confirmación
        self.assertIn("¿Confirmas el gasto", response)

        # Paso 2: Usuario confirma
        response = chat(self.user, "sí")
        self.assertIn("✅ Gasto registrado", response)
        self.assertIn("$5,000", response)
        self.assertIn("alimentación", response)

        # Verificar que el saldo se actualizó
        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("95000"))

    def test_complete_income_flow(self):
        """Test flujo completo: registrar ingreso via chat"""
        response = chat(self.user, "recibí 500000 de salario en Nequi", account=self.account)
        self.assertIn("¿Confirmas el ingreso", response)

        response = chat(self.user, "sí")
        self.assertIn("✅ Ingreso registrado", response)

        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("600000"))

    def test_complete_transfer_flow(self):
        """Test flujo completo: transferencia entre cuentas"""
        dest_account = Account.objects.create(
            user=self.user,
            name="Bancolombia",
            account_type="BANK",
            balance=Decimal("0"),
        )
        response = chat(self.user, "pasé 20000 de Nequi a Bancolombia")
        self.assertIn("¿Confirmas transferir", response)

        response = chat(self.user, "sí")
        self.assertIn("✅ Transferencia realizada", response)

        self.account.refresh_from_db()
        dest_account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("80000"))
        self.assertEqual(dest_account.balance, Decimal("20000"))

    def test_conversation_state_machine(self):
        """Test máquina de estados: conversación multi-paso"""
        # Paso 1: Usuario dice "gasté 10000" (sin categoría ni cuenta)
        response = chat(self.user, "gasté 10000")
        self.assertEqual(response, "¿En qué categoría?")

        # Paso 2: Usuario dice "comida"
        response = chat(self.user, "comida")
        self.assertEqual(response, "¿De qué cuenta hiciste el movimiento?")

        # Paso 3: Usuario dice "Nequi"
        response = chat(self.user, "Nequi")
        self.assertIn("¿Confirmas el gasto", response)

        # Paso 4: Usuario confirma
        response = chat(self.user, "sí")
        self.assertIn("✅ Gasto registrado", response)

    def test_conversation_cancel(self):
        """Test cancelar conversación"""
        chat(self.user, "gasté 10000")
        chat(self.user, "comida")
        chat(self.user, "Nequi")
        response = chat(self.user, "no")
        self.assertEqual(response, "❌ Operación cancelada.")

    def test_query_balance(self):
        """Test consulta de saldo"""
        response = chat(self.user, "cuánto tengo")
        self.assertIn("Nequi", response)
        self.assertIn("$100,000", response)

    def test_query_expenses_breakdown(self):
        """Test desglose de gastos"""
        # Crear categoría transporte
        Category.objects.create(
            user=self.user,
            name="transporte",
            type="EXPENSE",
        )
        # Registrar algunos gastos primero usando process_message (sin conversación)
        process_message(self.user, "gasté 5000 en comida en Nequi", account=self.account)
        process_message(self.user, "gasté 3000 en transporte en Nequi", account=self.account)

        # Consultar desglose
        response = chat(self.user, "en qué gasté")
        self.assertIn("alimentación", response)
        self.assertIn("transporte", response)
        self.assertIn("Total:", response)

    def test_query_financial_summary(self):
        """Test resumen financiero"""
        process_message(self.user, "recibí 100000 de salario en Nequi", account=self.account)
        process_message(self.user, "gasté 20000 en comida en Nequi", account=self.account)

        response = chat(self.user, "cómo están mis finanzas")
        self.assertIn("Resumen financiero", response)
        self.assertIn("Ingresos:", response)
        self.assertIn("Gastos:", response)
        self.assertIn("Balance:", response)

    def test_create_reserved_fund_flow(self):
        """Test crear fondo reservado"""
        response = chat(self.user, "crear fondo reservado emergencia 10000 en Nequi")
        # El bot pregunta el nombre si no lo detecta
        self.assertIn("fondo", response.lower()) or self.assertIn("reservado", response.lower())

    def test_create_savings_goal_flow(self):
        """Test crear meta de ahorro"""
        response = chat(self.user, "crear meta ahorro viaje 50000")
        self.assertIn("meta", response.lower()) or self.assertIn("ahorro", response.lower())


class TestBotAPIIntegration(TestCase):
    """Tests de integración para la API del bot"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="apiuser",
            password="test1234",
        )
        self.account = Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("50000"),
        )
        self.category = Category.objects.create(
            user=self.user,
            name="alimentación",
            type="EXPENSE",
        )
        self.client = Client()

    def tearDown(self):
        Conversation.objects.filter(user=self.user).delete()

    def test_bot_message_endpoint(self):
        """Test endpoint /bot/message/"""
        response = self.client.post(
            reverse("bot:bot_message"),
            {"user_id": self.user.pk, "text": "cuánto tengo"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("response", data)
        self.assertIn("Nequi", data["response"])

    def test_bot_process_endpoint(self):
        """Test endpoint /bot/process/ - registro directo sin conversación"""
        response = self.client.post(
            reverse("bot:bot_process"),
            {"user_id": self.user.pk, "text": "gasté 1000 en comida en Nequi", "account_id": self.account.pk},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("result", data)
        self.assertTrue(data["result"]["success"])
        self.assertEqual(data["result"]["type"], "EXPENSE")

    def test_bot_message_missing_fields(self):
        """Test endpoint con campos faltantes"""
        response = self.client.post(
            reverse("bot:bot_message"),
            {},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.json())

    def test_bot_message_unknown_user(self):
        """Test endpoint con usuario inexistente"""
        response = self.client.post(
            reverse("bot:bot_message"),
            {"user_id": 99999, "text": "hola"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)


class TestDashboardIntegration(TestCase):
    """Tests de integración para el dashboard"""

    def setUp(self):
        self.user = User.objects.create_user(
            username="dashuser",
            password="test1234",
        )
        self.client = Client()
        self.client.force_login(self.user)

    def test_dashboard_home_requires_login(self):
        """Test que el dashboard requiere login"""
        self.client.logout()
        response = self.client.get(reverse("dashboard:home"))
        self.assertEqual(response.status_code, 302)  # Redirect to login

    def test_dashboard_home_with_data(self):
        """Test dashboard con datos"""
        Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("100000"),
        )
        Account.objects.create(
            user=self.user,
            name="Bancolombia",
            account_type="BANK",
            balance=Decimal("500000"),
        )
        Category.objects.create(
            user=self.user,
            name="comida",
            type="EXPENSE",
        )
        Category.objects.create(
            user=self.user,
            name="salario",
            type="INCOME",
        )
        from finance.models import Transaction
        Transaction.objects.create(
            user=self.user,
            account=Account.objects.get(user=self.user, name="Nequi"),
            category=Category.objects.get(user=self.user, name="salario"),
            type="INCOME",
            amount=Decimal("1000000"),
            date="2026-09-01",
        )
        Transaction.objects.create(
            user=self.user,
            account=Account.objects.get(user=self.user, name="Nequi"),
            category=Category.objects.get(user=self.user, name="comida"),
            type="EXPENSE",
            amount=Decimal("50000"),
            date="2026-09-15",
        )

        response = self.client.get(reverse("dashboard:home"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Nequi")
        self.assertContains(response, "Bancolombia")
        self.assertContains(response, "$600.000")  # Total balance con separador de miles
        self.assertContains(response, "comida")
        self.assertContains(response, "salario")

    def test_dashboard_context_has_all_data(self):
        """Test que el contexto tiene todos los datos esperados"""
        Account.objects.create(
            user=self.user,
            name="Efectivo",
            account_type="CASH",
            balance=Decimal("50000"),
        )
        response = self.client.get(reverse("dashboard:home"))
        self.assertEqual(response.status_code, 200)
        context = response.context
        self.assertIn("accounts", context)
        self.assertIn("total_balance", context)
        self.assertIn("monthly_income", context)
        self.assertIn("monthly_expenses", context)
        self.assertIn("monthly_balance", context)
        self.assertIn("reserved_funds", context)
        self.assertIn("total_reserved", context)
        self.assertIn("savings_goals", context)
        self.assertIn("debts", context)
        self.assertIn("total_debt", context)
        self.assertIn("recent_transactions", context)
        self.assertIn("expenses_by_category", context)
        self.assertIn("income_by_category", context)