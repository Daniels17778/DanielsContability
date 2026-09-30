from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from finance.models import Account


class DashboardTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="test1234",
        )

    def test_requires_login(self):
        response = self.client.get(reverse("dashboard:home"))
        self.assertEqual(response.status_code, 302)

    def test_returns_200_when_logged_in(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("dashboard:home"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("total_balance", response.context)

    def test_context_contains_accounts(self):
        self.client.force_login(self.user)
        response = self.client.get(reverse("dashboard:home"))
        self.assertIn("accounts", response.context)
        self.assertIn("monthly_income", response.context)
        self.assertIn("monthly_expenses", response.context)
        self.assertIn("monthly_balance", response.context)
        self.assertIn("recent_transactions", response.context)
        self.assertIn("savings_goals", response.context)
        self.assertIn("debts", response.context)
        self.assertIn("reserved_funds", response.context)

    def test_denied_accounts_are_excluded(self):
        from finance.models import Account
        other_user = User.objects.create_user(
            username="otro",
            password="test1234",
        )
        Account.objects.create(
            user=other_user,
            name="Cuenta ajena",
            account_type="CASH",
            balance=Decimal("50000"),
        )
        self.client.force_login(self.user)
        response = self.client.get(reverse("dashboard:home"))
        for acc in response.context["accounts"]:
            self.assertEqual(acc.user, self.user)