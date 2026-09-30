from django.contrib.auth.models import User
from django.test import TestCase

from bot.services import chat
from finance.models import Account, Transaction


class StuckStateTests(TestCase):
    def setUp(self):
        self.u = User.objects.create_user("bea", password="x")
        self.acc = Account.objects.create(user=self.u, name="Nequi", account_type="NEQUI", balance=100000)

    def test_new_complete_movement_replaces_pending_one(self):
        chat(self.u, "me pagaron 2 millones")            # queda esperando categoría (ingreso)
        chat(self.u, "gaste 5000 en comida")             # movimiento nuevo: un GASTO
        self.assertIn("gasto de $5,000", chat(self.u, "nequi"))
        chat(self.u, "si")
        tx = Transaction.objects.get()
        self.assertEqual((tx.type, tx.amount), ("EXPENSE", 5000))

    def test_category_answer_still_works(self):
        chat(self.u, "me pagaron 2 millones")
        chat(self.u, "salario")
        self.assertIn("ingreso de $2,000,000", chat(self.u, "nequi"))

    def test_question_and_cancel_free_the_bot(self):
        chat(self.u, "me pagaron 2 millones")
        self.assertIn("categorías", chat(self.u, "que categorias hay"))
        self.assertIn("Resumen de tus cuentas", chat(self.u, "cuál es mi saldo"))
        chat(self.u, "gasté 3000 en bus")
        self.assertIn("Listo", chat(self.u, "cancelar"))
