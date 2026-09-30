from django.urls import path
from . import api_views

app_name = "dashboard_api"

urlpatterns = [
    path("accounts/", api_views.api_accounts, name="accounts"),
    path("summary/", api_views.api_summary, name="summary"),
    path("expenses/", api_views.api_expenses_by_category, name="expenses"),
    path("income/", api_views.api_income_by_category, name="income"),
    path("reserved-funds/", api_views.api_reserved_funds, name="reserved_funds"),
    path("savings-goals/", api_views.api_savings_goals, name="savings_goals"),
    path("debts/", api_views.api_debts, name="debts"),
    path("transactions/", api_views.api_recent_transactions, name="transactions"),
]