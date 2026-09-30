from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase, Client
from django.urls import reverse

from bot.services import find_account, get_account_balance, chat
from bot.models import Conversation
from finance.models import Account, Category
from bot.parser import parse_message
from bot.utils import get_period_text
from bot.constants import (
    STATE_IDLE, STATE_CONFIRMING, STATE_WAITING_FOR_AMOUNT,
    STATE_WAITING_FOR_CATEGORY, STATE_WAITING_FOR_ACCOUNT,
    TRANSACTION_TYPE_EXPENSE, TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_TRANSFER,
)


class TestChatAPI(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="test1234",
        )
        self.client = Client()
        self.client.force_login(self.user)

    def test_bot_message_requires_user_id_and_text(self):
        response = self.client.post(
            reverse("bot:bot_message"),
            {},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("user_id", response.json()["error"])

    def test_bot_message_unknown_user(self):
        response = self.client.post(
            reverse("bot:bot_message"),
            {"user_id": 999, "text": "hola"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_bot_message_returns_response(self):
        Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("10000"),
        )
        response = self.client.post(
            reverse("bot:bot_message"),
            {"user_id": self.user.pk, "text": "cuánto tengo"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("response", response.json())

    def test_bot_message_with_account(self):
        account = Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("10000"),
        )
        Category.objects.create(
            user=self.user,
            name="alimentación",
            type="EXPENSE",
        )
        response = self.client.post(
            reverse("bot:bot_message"),
            {"user_id": self.user.pk, "text": "gasté 5000 en comida en Nequi", "account_id": account.pk},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("response", response.json())

    def test_bot_process_requires_user_id_and_text(self):
        response = self.client.post(
            reverse("bot:bot_process"),
            {},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_bot_process_returns_result(self):
        account = Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("10000"),
        )
        category = Category.objects.create(
            user=self.user,
            name="alimentación",
            type="EXPENSE",
        )
        response = self.client.post(
            reverse("bot:bot_process"),
            {"user_id": self.user.pk, "text": "gasté 1000 en comida en Nequi", "account_id": account.pk},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("result", response.json())


class TestFindAccount(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="test1234",
        )
        Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("10000"),
        )
        Account.objects.create(
            user=self.user,
            name="Bancolombia",
            account_type="BANK",
            balance=Decimal("50000"),
        )

    def test_exact_match(self):
        result = find_account(self.user, "nequi")
        self.assertIsNotNone
        self.assertEqual(result.name, "Nequi")

    def test_case_insensitive(self):
        result = find_account(self.user, "Nequi")
        self.assertIsNotNone
        self.assertEqual(result.name, "Nequi")

    def test_startswith_match(self):
        result = find_account(self.user, "nequi cuenta")
        self.assertIsNotNone

    def test_partial_inside_word_does_not_match(self):
        # "necuiqui" should not match "Nequi"
        result = find_account(self.user, "necuiqui")
        self.assertIsNone

    def test_alias_match(self):
        result = find_account(self.user, "banco")
        self.assertIsNotNone
        self.assertEqual(result.name, "Bancolombia")

    def test_no_account_found(self):
        result = find_account(self.user, "nada")
        self.assertIsNone

    def test_returns_only_active_accounts(self):
        Account.objects.filter(user=self.user, name="Nequi").update(is_active=False)
        result = find_account(self.user, "nequi")
        self.assertIsNone


class TestGetAccountBalance(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="test1234",
        )
        Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("5000"),
        )
        Account.objects.create(
            user=self.user,
            name="Bancolombia",
            account_type="BANK",
            balance=Decimal("15000"),
        )

    def test_balance_by_account_name(self):
        result = get_account_balance(self.user, "nequi")
        self.assertEqual(result["balance"], Decimal("5000"))
        self.assertEqual(result["account"], "Nequi")

    def test_balance_returns_none_for_unknown(self):
        result = get_account_balance(self.user, "desconocida")
        self.assertIsNone

    def test_total_balance(self):
        result = get_account_balance(self.user)
        self.assertEqual(result["total"], Decimal("20000"))
        self.assertEqual(len(result["accounts"]), 2)


class TestGetPeriodText(TestCase):

    def test_none_returns_empty(self):
        self.assertEqual(get_period_text(None), "")

    def test_month_returns_text(self):
        self.assertIn("este mes", get_period_text("MONTH"))

    def test_short_period_returns_text(self):
        self.assertIn("hoy", get_period_text("TODAY", "short"))

    def test_unknown_period_returns_empty(self):
        self.assertEqual(get_period_text("UNKNOWN"), "")


class TestParserConstants(TestCase):

    def test_parse_message_uses_constants(self):
        result = parse_message("gasté 5000 en comida")
        self.assertEqual(result["type"], "EXPENSE")
        self.assertEqual(result["category"], "alimentación")
        self.assertEqual(result["amount"], Decimal("5000"))

    def test_parse_message_transfer_uses_constants(self):
        result = parse_message("pasé 1000 de Bancolombia a Nequi")
        self.assertEqual(result["type"], "TRANSFER")


class TestConversationStateMachine(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="test1234",
        )

    def test_conversation_get_or_create(self):
        from bot.services import get_conversation
        conv = get_conversation(self.user)
        self.assertEqual(conv.state, STATE_IDLE)

    def test_conversation_with_for_update(self):
        from bot.services import get_conversation
        conv = get_conversation(self.user, for_update=True)
        self.assertEqual(conv.state, STATE_IDLE)

    def test_chat_creates_message(self):
        from bot.services import chat
        Category.objects.create(
            user=self.user,
            name="comida",
            type="EXPENSE",
        )
        account = Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("10000"),
        )
        response = chat(self.user, "cuánto tengo")
        self.assertIn("Nequi", response)

        conv = Conversation.objects.get(user=self.user)
        self.assertEqual(conv.state, STATE_IDLE)
        self.assertTrue(conv.messages.exists())


class TestParserEdgeCases(TestCase):

    def test_parse_amount_millions(self):
        from bot.parser import parse_amount
        self.assertEqual(parse_amount("1.5 millones"), Decimal("1500000"))

    def test_parse_amount_mil(self):
        from bot.parser import parse_amount
        self.assertEqual(parse_amount("50 mil"), Decimal("50000"))

    def test_parse_amount_with_dollar(self):
        from bot.parser import parse_amount
        self.assertEqual(parse_amount("$15.000"), Decimal("15000"))

    def test_parse_amount_simple(self):
        from bot.parser import parse_amount
        self.assertEqual(parse_amount("15000"), Decimal("15000"))


class TestBotConstants(TestCase):

    def test_all_constants_defined(self):
        from bot import constants
        self.assertIsNotNone(constants.TRANSACTION_TYPE_EXPENSE)
        self.assertIsNotNone(constants.TRANSACTION_TYPE_INCOME)
        self.assertIsNotNone(constants.TRANSACTION_TYPE_TRANSFER)
        self.assertIsNotNone(constants.STATE_IDLE)
        self.assertIsNotNone(constants.STATE_CONFIRMING)
        self.assertIsNotNone(constants.QUERY_TYPE_BALANCE)
        self.assertIsNotNone(constants.QUERY_TYPE_MONTH_SUMMARY)
        self.assertIsNotNone(constants.QUERY_TYPE_RESERVED_FUNDS)
        self.assertIsNotNone(constants.QUERY_TYPE_SAVINGS_GOALS)
        self.assertIsNotNone(constants.QUERY_TYPE_DEBTS)
        self.assertIsNotNone(constants.QUERY_TYPE_BUDGETS)


class TestFinancialManagementParser(TestCase):

    def test_detects_reserved_funds(self):
        from bot.parser import parse_message, detect_reserved_funds_query
        self.assertTrue(detect_reserved_funds_query("tengo fondos reservados"))
        result = parse_message("cuánto tengo reservado")
        self.assertEqual(result["type"], "RESERVED_FUNDS")

    def test_detects_savings_goals(self):
        from bot.parser import parse_message, detect_savings_goals_query
        self.assertTrue(detect_savings_goals_query("mi meta de ahorro"))
        result = parse_message("ahorro")
        self.assertEqual(result["type"], "SAVINGS_GOALS")

    def test_detects_debts(self):
        from bot.parser import parse_message, detect_debt_query
        self.assertTrue(detect_debt_query("cuánto debo"))
        result = parse_message("mis deudas")
        self.assertEqual(result["type"], "DEBTS")

    def test_detects_budgets(self):
        from bot.parser import parse_message, detect_budget_query
        self.assertTrue(detect_budget_query("presupuesto"))
        result = parse_message("cuánto voy a gastar")
        self.assertEqual(result["type"], "BUDGETS")


class TestFinanceServiceFunctions(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="test1234",
        )
        self.account = Account.objects.create(
            user=self.user,
            name="Nequi",
            account_type="NEQUI",
            balance=Decimal("10000"),
        )
        self.category = Category.objects.create(
            user=self.user,
            name="comida",
            type="EXPENSE",
        )

    def test_create_reserved_fund(self):
        from finance.services import create_reserved_fund
        fund = create_reserved_fund(
            user=self.user, account=self.account,
            name="Fondo emergencia", amount=Decimal("2000"),
        )
        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("8000"))
        self.assertEqual(fund.name, "Fondo emergencia")
        self.assertEqual(fund.amount, Decimal("2000"))

    def test_complete_reserved_fund(self):
        from finance.services import create_reserved_fund, complete_reserved_fund
        fund = create_reserved_fund(
            user=self.user, account=self.account,
            name="Fondo emergencia", amount=Decimal("2000"),
        )
        fund = complete_reserved_fund(user=self.user, fund_id=fund.pk)
        self.account.refresh_from_db()
        self.assertEqual(self.account.balance, Decimal("10000"))
        self.assertTrue(fund.is_completed)

    def test_create_savings_goal(self):
        from finance.services import create_savings_goal
        goal = create_savings_goal(
            user=self.user, name="Viaje", target_amount=Decimal("5000"),
        )
        self.assertEqual(goal.target_amount, Decimal("5000"))
        self.assertEqual(goal.current_amount, Decimal("0"))
        self.assertFalse(goal.is_completed)

    def test_add_to_savings_goal(self):
        from finance.services import create_savings_goal, add_to_savings_goal
        goal = create_savings_goal(
            user=self.user, name="Viaje", target_amount=Decimal("5000"),
        )
        goal = add_to_savings_goal(user=self.user, goal_id=goal.pk, amount=Decimal("2000"))
        self.assertEqual(goal.current_amount, Decimal("2000"))
        self.assertFalse(goal.is_completed)
        goal = add_to_savings_goal(user=self.user, goal_id=goal.pk, amount=Decimal("5000"))
        self.assertEqual(goal.current_amount, Decimal("5000"))
        self.assertTrue(goal.is_completed)

    def test_create_debt(self):
        from finance.services import create_debt
        debt = create_debt(
            user=self.user, name="Prestamo", creditor="Banco",
            total_amount=Decimal("10000"),
        )
        self.assertEqual(debt.total_amount, Decimal("10000"))
        self.assertEqual(debt.paid_amount, Decimal("0"))
        self.assertEqual(debt.status, "PENDING")

    def test_pay_debt(self):
        from finance.services import create_debt, pay_debt
        debt = create_debt(
            user=self.user, name="Prestamo", creditor="Banco",
            total_amount=Decimal("10000"),
        )
        debt = pay_debt(user=self.user, debt_id=debt.pk, amount=Decimal("3000"))
        self.assertEqual(debt.paid_amount, Decimal("3000"))
        self.assertEqual(debt.status, "PARTIAL")
        debt = pay_debt(user=self.user, debt_id=debt.pk, amount=Decimal("7000"))
        self.assertEqual(debt.paid_amount, Decimal("10000"))
        self.assertEqual(debt.status, "PAID")

    def test_create_budget(self):
        from finance.services import create_budget
        budget = create_budget(
            user=self.user, category=self.category,
            month=12, year=2026, limit_amount=Decimal("2000"),
        )
        self.assertEqual(budget.limit_amount, Decimal("2000"))
        self.assertEqual(budget.month, 12)
        self.assertEqual(budget.year, 2026)

    def test_create_budget_rejects_negative_limit(self):
        from finance.services import create_budget
        with self.assertRaises(ValueError):
            create_budget(
                user=self.user, category=self.category,
                month=12, year=2026, limit_amount=Decimal("-100"),
            )