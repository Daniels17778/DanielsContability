from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_POST

from bot.services import chat, get_conversation
from django.utils import timezone

from finance.models import (
    Account,
    Transaction,
    ReservedFund,
    SavingsGoal,
    Debt,
    Category,
)

import json


def _decimal_to_float(obj):
    if isinstance(obj, list):
        return [_decimal_to_float(item) for item in obj]
    if isinstance(obj, dict):
        return {k: _decimal_to_float(v) for k, v in obj.items()}
    if hasattr(obj, '__float__'):
        return float(obj)
    return obj


def _bars(rows):
    total = sum(r["total"] for r in rows) or 1
    return [
        {"name": r["category__name"], "total": r["total"], "pct": round(r["total"] / total * 100)}
        for r in rows[:8]
    ]


@login_required
def home(request):
    user = request.user

    today = timezone.localdate()

    current_month = today.month
    current_year = today.year

    month_transactions = Transaction.objects.filter(
        user=user,
        date__year=current_year,
        date__month=current_month,
    )

    accounts = Account.objects.filter(
        user=user,
        is_active=True,
    ).order_by("-balance")

    total_balance = accounts.aggregate(
        total=Sum("balance")
    )["total"] or 0

    monthly_income = month_transactions.filter(
        type="INCOME"
    ).aggregate(
        total=Sum("amount")
    )["total"] or 0

    monthly_expenses = month_transactions.filter(
        type="EXPENSE"
    ).aggregate(
        total=Sum("amount")
    )["total"] or 0

    monthly_balance = monthly_income - monthly_expenses

    reserved_funds = ReservedFund.objects.filter(
        user=user,
        is_completed=False,
    )

    total_reserved = reserved_funds.aggregate(
        total=Sum("amount")
    )["total"] or 0

    savings_goals = SavingsGoal.objects.filter(
        user=user,
        is_completed=False,
    ).order_by("deadline")

    debts = Debt.objects.filter(
        user=user,
    ).exclude(
        status="PAID"
    )

    debts_with_remaining = []
    for debt in debts:
        remaining = debt.total_amount - debt.paid_amount
        debts_with_remaining.append({
            "id": debt.id,
            "name": debt.name,
            "creditor": debt.creditor,
            "total_amount": debt.total_amount,
            "paid_amount": debt.paid_amount,
            "remaining": remaining,
            "status": debt.status,
            "due_date": debt.due_date,
            "get_status_display": debt.get_status_display(),
        })

    total_debt = sum(d["remaining"] for d in debts_with_remaining)

    recent_transactions = Transaction.objects.filter(
        user=user,
    ).select_related(
        "account",
        "category",
    ).order_by(
        "-date",
        "-created_at",
    )[:8]

    expenses_by_category = list(
        month_transactions.filter(
            type="EXPENSE",
            category__isnull=False,
        ).values("category__name").annotate(
            total=Sum("amount")
        ).order_by("-total")
    )

    income_by_category = list(
        month_transactions.filter(
            type="INCOME",
            category__isnull=False,
        ).values("category__name").annotate(
            total=Sum("amount")
        ).order_by("-total")
    )

    savings_goals_with_progress = []
    for goal in savings_goals:
        progress = (goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0
        savings_goals_with_progress.append({
            "id": goal.id,
            "name": goal.name,
            "target_amount": goal.target_amount,
            "current_amount": goal.current_amount,
            "deadline": goal.deadline,
            "progress": progress,
        })

    context = {
        "today": today,

        "accounts": accounts,
        "total_balance": total_balance,

        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "monthly_balance": monthly_balance,

        "reserved_funds": reserved_funds,
        "total_reserved": total_reserved,

        "savings_goals": savings_goals_with_progress,

        "debts": debts_with_remaining,
        "total_debt": total_debt,

        "recent_transactions": recent_transactions,

        "expenses_by_category": json.dumps(_decimal_to_float(expenses_by_category)),
        "income_by_category": json.dumps(_decimal_to_float(income_by_category)),

        "monthly_balance_abs": abs(monthly_balance),
        "expense_bars": _bars(expenses_by_category),
        "income_bars": _bars(income_by_category),
    }

    return render(
        request,
        "dashboard/home.html",
        context,
    )


SUGGESTIONS = ["gasté 15mil en el taxi", "me pagaron 2 millones", "cuánto he gastado este mes", "cuál es mi saldo"]


@login_required
def chat_page(request):
    conversation = get_conversation(request.user)
    history = list(conversation.messages.order_by("-created_at")[:60])[::-1]
    accounts = Account.objects.filter(user=request.user, is_active=True).order_by("-balance")
    return render(request, "dashboard/chat.html", {
        "history": history, "accounts": accounts, "suggestions": SUGGESTIONS,
    })


@login_required
@require_POST
def chat_send(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Solicitud inválida."}, status=400)
    text = str(body.get("text") or "").strip()[:500]
    if not text:
        return JsonResponse({"error": "Escribe algo primero."}, status=400)
    account = None
    if str(body.get("account_id") or "").isdigit():
        account = Account.objects.filter(pk=body["account_id"], user=request.user, is_active=True).first()
    return JsonResponse({"reply": chat(request.user, text, account=account)})
