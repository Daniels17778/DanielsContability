from decimal import Decimal

from django.contrib.auth.decorators import login_required
from django.db.models import Sum
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from finance.models import (
    Account,
    Transaction,
    ReservedFund,
    SavingsGoal,
    Debt,
    Category,
)


@login_required
@require_http_methods(["GET"])
def api_accounts(request):
    """API: Listar cuentas del usuario"""
    accounts = Account.objects.filter(
        user=request.user,
        is_active=True,
    ).order_by("-balance")

    data = [
        {
            "id": acc.id,
            "name": acc.name,
            "type": acc.account_type,
            "type_display": acc.get_account_type_display(),
            "balance": float(acc.balance),
            "is_active": acc.is_active,
        }
        for acc in accounts
    ]

    total = sum(acc.balance for acc in accounts)
    return JsonResponse({
        "accounts": data,
        "total_balance": float(total),
    })


@login_required
@require_http_methods(["GET"])
def api_summary(request):
    """API: Resumen financiero del mes actual"""
    today = timezone.localdate()
    current_month = today.month
    current_year = today.year

    month_transactions = Transaction.objects.filter(
        user=request.user,
        date__year=current_year,
        date__month=current_month,
    )

    monthly_income = month_transactions.filter(
        type="INCOME"
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")

    monthly_expenses = month_transactions.filter(
        type="EXPENSE"
    ).aggregate(total=Sum("amount"))["total"] or Decimal("0")

    accounts = Account.objects.filter(user=request.user, is_active=True)
    total_balance = accounts.aggregate(total=Sum("balance"))["total"] or Decimal("0")

    return JsonResponse({
        "month": current_month,
        "year": current_year,
        "income": float(monthly_income),
        "expenses": float(monthly_expenses),
        "balance": float(monthly_income - monthly_expenses),
        "total_balance": float(total_balance),
    })


@login_required
@require_http_methods(["GET"])
def api_expenses_by_category(request):
    """API: Gastos por categoría"""
    today = timezone.localdate()
    current_month = today.month
    current_year = today.year

    month_transactions = Transaction.objects.filter(
        user=request.user,
        date__year=current_year,
        date__month=current_month,
    )

    expenses = list(
        month_transactions.filter(
            type="EXPENSE",
            category__isnull=False,
        ).values("category__name").annotate(
            total=Sum("amount")
        ).order_by("-total")
    )

    total = sum(e["total"] for e in expenses)
    return JsonResponse({
        "period": {"month": current_month, "year": current_year},
        "categories": [
            {
                "category": e["category__name"],
                "total": float(e["total"]),
                "percentage": float(e["total"] / total * 100) if total > 0 else 0,
            }
            for e in expenses
        ],
        "total": float(total),
    })


@login_required
@require_http_methods(["GET"])
def api_income_by_category(request):
    """API: Ingresos por categoría"""
    today = timezone.localdate()
    current_month = today.month
    current_year = today.year

    month_transactions = Transaction.objects.filter(
        user=request.user,
        date__year=current_year,
        date__month=current_month,
    )

    income = list(
        month_transactions.filter(
            type="INCOME",
            category__isnull=False,
        ).values("category__name").annotate(
            total=Sum("amount")
        ).order_by("-total")
    )

    total = sum(i["total"] for i in income)
    return JsonResponse({
        "period": {"month": current_month, "year": current_year},
        "categories": [
            {
                "category": i["category__name"],
                "total": float(i["total"]),
                "percentage": float(i["total"] / total * 100) if total > 0 else 0,
            }
            for i in income
        ],
        "total": float(total),
    })


@login_required
@require_http_methods(["GET"])
def api_reserved_funds(request):
    """API: Fondos reservados"""
    funds = ReservedFund.objects.filter(
        user=request.user,
        is_completed=False,
    ).select_related("account")

    data = [
        {
            "id": f.id,
            "name": f.name,
            "amount": float(f.amount),
            "account": f.account.name,
            "deadline": f.deadline.isoformat() if f.deadline else None,
            "is_completed": f.is_completed,
        }
        for f in funds
    ]

    total = sum(f.amount for f in funds)
    return JsonResponse({
        "funds": data,
        "total_reserved": float(total),
    })


@login_required
@require_http_methods(["GET"])
def api_savings_goals(request):
    """API: Metas de ahorro"""
    goals = SavingsGoal.objects.filter(
        user=request.user,
        is_completed=False,
    ).order_by("deadline")

    data = []
    for goal in goals:
        progress = (goal.current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0
        data.append({
            "id": goal.id,
            "name": goal.name,
            "target_amount": float(goal.target_amount),
            "current_amount": float(goal.current_amount),
            "progress": float(progress),
            "deadline": goal.deadline.isoformat() if goal.deadline else None,
            "is_completed": goal.is_completed,
        })

    return JsonResponse({"goals": data})


@login_required
@require_http_methods(["GET"])
def api_debts(request):
    """API: Deudas"""
    debts = Debt.objects.filter(user=request.user).exclude(status="PAID")

    data = []
    total_remaining = Decimal("0")
    for debt in debts:
        remaining = debt.total_amount - debt.paid_amount
        total_remaining += remaining
        data.append({
            "id": debt.id,
            "name": debt.name,
            "creditor": debt.creditor,
            "total_amount": float(debt.total_amount),
            "paid_amount": float(debt.paid_amount),
            "remaining": float(remaining),
            "status": debt.status,
            "status_display": debt.get_status_display(),
            "due_date": debt.due_date.isoformat() if debt.due_date else None,
        })

    return JsonResponse({
        "debts": data,
        "total_remaining": float(total_remaining),
    })


@login_required
@require_http_methods(["GET"])
def api_recent_transactions(request):
    """API: Últimas transacciones"""
    limit = int(request.GET.get("limit", 20))
    transactions = Transaction.objects.filter(
        user=request.user,
    ).select_related("account", "category").order_by("-date", "-created_at")[:limit]

    data = [
        {
            "id": tx.id,
            "date": tx.date.isoformat(),
            "type": tx.type,
            "type_display": tx.get_type_display(),
            "amount": float(tx.amount),
            "account": tx.account.name,
            "category": tx.category.name if tx.category else None,
            "description": tx.description,
        }
        for tx in transactions
    ]

    return JsonResponse({"transactions": data})