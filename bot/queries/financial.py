from datetime import date
from decimal import Decimal

from django.db.models import Sum

from finance.models import Account, Transaction, ReservedFund, SavingsGoal, Debt, Budget
from finance.services import (
    get_category_period_total,
    get_expenses_by_category,
    get_transaction_total,
    get_top_expense_category,
    get_period_dates,
    get_income_by_category,
)
from bot.constants import (
    TRANSACTION_TYPE_EXPENSE,
    TRANSACTION_TYPE_INCOME,
    PERIOD_MONTH,
)
from bot.utils import get_period_text


def get_financial_summary(user):
    accounts = Account.objects.filter(user=user, is_active=True)
    total_balance = accounts.aggregate(total=Sum("balance"))["total"] or Decimal("0")
    return {"accounts": accounts, "total_balance": total_balance}


def get_financial_summary_response(user, period=None):
    start_date, end_date = get_period_dates(period)
    income = get_transaction_total(user, TRANSACTION_TYPE_INCOME, start_date=start_date, end_date=end_date)
    expenses = get_transaction_total(user, TRANSACTION_TYPE_EXPENSE, start_date=start_date, end_date=end_date)
    balance = income - expenses
    period_text = get_period_text(period)
    return (
        f"📊 Resumen financiero{period_text}:\n"
        f"💰 Ingresos: ${income:,.0f}\n"
        f"💸 Gastos: ${expenses:,.0f}\n"
        f"📈 Balance: ${balance:,.0f}"
    )


def get_income_response(user, period=None):
    start_date, end_date = get_period_dates(period)
    income = get_transaction_total(user, TRANSACTION_TYPE_INCOME, start_date=start_date, end_date=end_date)
    return f"💰 Has recibido ${income:,.0f}{get_period_text(period, 'short')}."


def get_expense_response(user, period=None):
    start_date, end_date = get_period_dates(period)
    expenses = get_transaction_total(user, TRANSACTION_TYPE_EXPENSE, start_date=start_date, end_date=end_date)
    return f"💸 Has gastado ${expenses:,.0f}{get_period_text(period, 'short')}."


def get_top_expense_response(user, period=None):
    start_date, end_date = get_period_dates(period)
    result = get_top_expense_category(user, start_date=start_date, end_date=end_date)
    if result is None:
        return f"📊 No tienes gastos registrados{get_period_text(period, 'short')}."
    category = result["category"]
    total = result["total"]
    return f"📊 Tu mayor gasto{get_period_text(period, 'short')} es {category}, con ${total:,.0f}."


def get_expenses_breakdown_response(user, period=None):
    start_date, end_date = get_period_dates(period)
    results = get_expenses_by_category(user, start_date=start_date, end_date=end_date)
    if not results:
        return f"📊 No tienes gastos registrados{get_period_text(period, 'short')}."
    title = f"📊 Gastos de{get_period_text(period, 'short')[1:] if get_period_text(period) else ''}:"
    if not get_period_text(period):
        title = "📊 Tus gastos:"
    lines = [title]
    for item in results:
        lines.append(f"🏷️ {item['category']}: ${item['total']:,.0f}")
    total = sum((item["total"] for item in results), Decimal("0"))
    lines.append("")
    lines.append(f"💸 Total: ${total:,.0f}")
    return "\n".join(lines)


def get_income_breakdown_response(user, period=None):
    start_date, end_date = get_period_dates(period)
    results = get_income_by_category(user, start_date=start_date, end_date=end_date)
    if not results:
        return f"📊 No tienes ingresos registrados{get_period_text(period, 'short')}."
    if get_period_text(period):
        title = f"📊 Ingresos de{get_period_text(period, 'short')[1:]}:"
    else:
        title = "📊 Tus ingresos:"
    lines = [title]
    for item in results:
        lines.append(f"🏷️ {item['category']}: ${item['total']:,.0f}")
    total = sum((item["total"] for item in results), Decimal("0"))
    lines.append("")
    lines.append(f"💰 Total: ${total:,.0f}")
    return "\n".join(lines)


def get_category_response(user, category_name, period=None):
    total = get_category_period_total(user=user, category_name=category_name, period=period)
    period_text = get_period_text(period)
    return f"💸 Has gastado ${total:,.0f} en {category_name}{period_text}."


def get_reserved_funds_response(user):
    funds = ReservedFund.objects.filter(user=user, is_completed=False).select_related("account")
    if not funds:
        return "🏦 No tienes fondos reservados."
    lines = ["🏦 Tus fondos reservados:"]
    total_reserved = Decimal("0")
    for fund in funds:
        lines.append(f"💰 {fund.name}: ${fund.amount:,.0f} ({fund.account.name})")
        total_reserved += fund.amount
    lines.append(f"\n💵 Total reservado: ${total_reserved:,.0f}")
    return "\n".join(lines)


def get_savings_goals_response(user):
    goals = SavingsGoal.objects.filter(user=user, is_completed=False).order_by("-created_at")
    if not goals:
        return "🎯 No tienes metas de ahorro."
    lines = ["🎯 Tus metas de ahorro:"]
    for goal in goals:
        progress = (goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0
        lines.append(
            f"🎯 {goal.name}: ${goal.current_amount:,.0f}/${goal.target_amount:,.0f} ({progress:.0f}%)"
        )
    return "\n".join(lines)


def get_debts_response(user):
    debts = Debt.objects.filter(user=user).exclude(status="PAID").order_by("-created_at")
    if not debts:
        return "💳 No tienes deudas registradas."
    lines = ["💳 Tus deudas:"]
    total_debt = Decimal("0")
    for debt in debts:
        remaining = debt.total_amount - debt.paid_amount
        lines.append(f"💳 {debt.name}: ${remaining:,.0f} restantes de ${debt.total_amount:,.0f}")
        total_debt += remaining
    lines.append(f"\n💵 Total pendiente: ${total_debt:,.0f}")
    return "\n".join(lines)


def get_budgets_response(user):
    budgets = Budget.objects.filter(user=user).select_related("category").order_by("-created_at")
    if not budgets:
        return "📋 No tienes presupuestos definidos."
    lines = ["📋 Tus presupuestos:"]
    for budget in budgets:
        spent = get_transaction_total(
            user=user, transaction_type="EXPENSE",
            category=budget.category,
            start_date=date.today().replace(day=1),
            end_date=date.today(),
        )
        remaining = budget.limit_amount - spent
        lines.append(
            f"📋 {budget.category.name} ({budget.month}/{budget.year}): "
            f"${spent:,.0f}/${budget.limit_amount:,.0f} "
            f"(${remaining:,.0f} restantes)"
        )
    return "\n".join(lines)


def get_account_balance(user, account_name=None):
    if account_name:
        account = find_account(user, account_name)
        if account is None:
            return None
        return {"account": account.name, "balance": account.balance}

    accounts = Account.objects.filter(user=user, is_active=True)
    total = accounts.aggregate(total=Sum("balance"))["total"] or Decimal("0")
    return {"accounts": list(accounts), "total": total}


def find_account(user, text):
    text = text.lower().strip()
    accounts = Account.objects.filter(user=user, is_active=True)

    for account in accounts:
        name = account.name.lower()
        if text == name or text.startswith(name):
            return account

    for account in accounts:
        name = account.name.lower()
        words = text.split()
        if name in words:
            return account

    aliases = {
        "nequi": ["nequi"],
        "bancolombia": ["bancolombia", "banco"],
        "efectivo": ["efectivo", "cash", "plata en efectivo"],
    }
    for account in accounts:
        name = account.name.lower()
        if name in aliases:
            for alias in aliases[name]:
                if alias in text:
                    return account
    return None