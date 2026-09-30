"""Panel propio: todas las pantallas para ver y administrar el dinero.

Cada página es una URL. Los formularios envían un campo `action`; la vista
ejecuta la acción, deja un aviso y vuelve a la misma página.
"""
import re
from datetime import date
from decimal import Decimal

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q, Sum
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from bot.handlers.helpers import ensure_default_categories
from finance import services as fin
from finance.models import Account, Budget, Category, Debt, ReservedFund, SavingsGoal, Transaction


# ── utilidades ───────────────────────────────────────────────

def _money(value, required=True):
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        if required:
            raise ValueError("Escribe un monto.")
        return Decimal(0)
    return Decimal(digits)


def _date(value):
    if not value:
        return timezone.localdate()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ValueError("La fecha no es válida.")


def _optional_date(value):
    return _date(value) if value else None


def _text(p, key, label, max_len=100, required=True):
    value = (p.get(key) or "").strip()[:max_len]
    if required and not value:
        raise ValueError(f"Escribe {label}.")
    return value


def _get(model, user, p, key, label, **extra):
    pk = str(p.get(key, ""))
    obj = model.objects.filter(pk=pk, user=user, **extra).first() if pk.isdigit() else None
    if obj is None:
        raise ValueError(f"Elige {label}.")
    return obj


def _run(request, actions):
    """Ejecuta la acción enviada por el formulario y vuelve a la página."""
    fn = actions.get(request.POST.get("action", ""))
    if fn is None:
        messages.error(request, "No entendí esa acción.")
    else:
        try:
            messages.success(request, fn(request.user, request.POST))
        except ValueError as e:
            messages.error(request, str(e))
        except ObjectDoesNotExist:
            messages.error(request, "No encontré ese elemento.")
    return redirect(request.get_full_path())


def _month(value):
    try:
        y, m = (int(x) for x in value.split("-"))
        date(y, m, 1)
        return y, m
    except (ValueError, AttributeError):
        today = timezone.localdate()
        return today.year, today.month


# ── movimientos ──────────────────────────────────────────────

def _tx_create(user, p):
    kind = p.get("type")
    if kind not in ("EXPENSE", "INCOME", "TRANSFER"):
        raise ValueError("Elige si es gasto, ingreso o transferencia.")
    amount = _money(p.get("amount"))
    account = _get(Account, user, p, "account", "una cuenta", is_active=True)
    day = _date(p.get("date"))
    note = (p.get("description") or "").strip()[:255]
    if kind == "TRANSFER":
        dest = _get(Account, user, p, "transfer_account", "la cuenta destino", is_active=True)
        fin.transfer_money(user, account, dest, amount, note, day)
        return "Transferencia guardada."
    category = _get(Category, user, p, "category", "una categoría", is_active=True)
    (fin.register_expense if kind == "EXPENSE" else fin.register_income)(
        user, account, category, amount, note, day)
    return "Gasto guardado." if kind == "EXPENSE" else "Ingreso guardado."


def _tx_delete(user, p):
    pk = str(p.get("id", ""))
    if not pk.isdigit():
        raise ValueError("Movimiento no válido.")
    fin.delete_transaction(user, int(pk))
    return "Movimiento eliminado y saldo devuelto a la cuenta."


@login_required
@require_http_methods(["GET", "POST"])
def transactions(request):
    if request.method == "POST":
        return _run(request, {"create": _tx_create, "delete": _tx_delete})

    user = request.user
    ensure_default_categories(user)
    y, m = _month(request.GET.get("mes"))
    kind = request.GET.get("tipo", "")
    acc = request.GET.get("cuenta", "")

    qs = Transaction.objects.filter(user=user, date__year=y, date__month=m)
    if kind in ("EXPENSE", "INCOME", "TRANSFER"):
        qs = qs.filter(type=kind)
    if acc.isdigit():
        qs = qs.filter(Q(account_id=acc) | Q(transfer_account_id=acc))
    total = lambda t: qs.filter(type=t).aggregate(s=Sum("amount"))["s"] or 0
    income, expenses = total("INCOME"), total("EXPENSE")

    prev_y, prev_m = (y - 1, 12) if m == 1 else (y, m - 1)
    next_y, next_m = (y + 1, 1) if m == 12 else (y, m + 1)
    return render(request, "dashboard/transactions.html", {
        "rows": qs.select_related("account", "category", "transfer_account").order_by("-date", "-created_at")[:300],
        "income": income, "expenses": expenses, "net": income - expenses,
        "month_date": date(y, m, 1),
        "mes": f"{y}-{m:02d}", "prev": f"{prev_y}-{prev_m:02d}", "next": f"{next_y}-{next_m:02d}",
        "kind": kind, "acc": acc,
        "accounts": Account.objects.filter(user=user, is_active=True).order_by("name"),
        "categories": Category.objects.filter(user=user, is_active=True).order_by("type", "name"),
        "today": timezone.localdate(),
        "open_new": bool(request.GET.get("nuevo")),
    })


# ── cuentas ──────────────────────────────────────────────────

def _acc_fields(p):
    kind = p.get("account_type")
    if kind not in dict(Account.ACCOUNT_TYPES):
        raise ValueError("Elige el tipo de cuenta.")
    return _text(p, "name", "un nombre"), kind, _money(p.get("balance"), required=False)


def _acc_create(user, p):
    name, kind, balance = _acc_fields(p)
    if Account.objects.filter(user=user, name__iexact=name, is_active=True).exists():
        raise ValueError("Ya tienes una cuenta con ese nombre.")
    Account.objects.create(user=user, name=name, account_type=kind, balance=balance)
    return f"Cuenta «{name}» creada."


def _acc_edit(user, p):
    acc = _get(Account, user, p, "id", "una cuenta")
    acc.name, acc.account_type, acc.balance = _acc_fields(p)
    acc.save()
    return "Cuenta actualizada."


def _acc_toggle(user, p):
    acc = _get(Account, user, p, "id", "una cuenta")
    acc.is_active = not acc.is_active
    acc.save(update_fields=["is_active", "updated_at"])
    return "Cuenta archivada." if not acc.is_active else "Cuenta activada de nuevo."


@login_required
@require_http_methods(["GET", "POST"])
def accounts(request):
    if request.method == "POST":
        return _run(request, {"create": _acc_create, "edit": _acc_edit, "toggle": _acc_toggle})
    everything = Account.objects.filter(user=request.user).order_by("-balance")
    active = [a for a in everything if a.is_active]
    return render(request, "dashboard/accounts.html", {
        "accounts": active,
        "archived": [a for a in everything if not a.is_active],
        "total": sum(a.balance for a in active),
        "types": Account.ACCOUNT_TYPES,
    })


# ── categorías ───────────────────────────────────────────────

def _cat_create(user, p):
    name = _text(p, "name", "un nombre", 100).lower()
    kind = p.get("type")
    if kind not in ("EXPENSE", "INCOME"):
        raise ValueError("Elige si es de gastos o de ingresos.")
    if Category.objects.filter(user=user, name__iexact=name).exists():
        raise ValueError("Ya existe una categoría con ese nombre.")
    Category.objects.create(user=user, name=name, type=kind, icon=(p.get("icon") or "").strip()[:10])
    return f"Categoría «{name}» creada."


def _cat_edit(user, p):
    cat = _get(Category, user, p, "id", "una categoría")
    name = _text(p, "name", "un nombre", 100).lower()
    if Category.objects.filter(user=user, name__iexact=name).exclude(pk=cat.pk).exists():
        raise ValueError("Ya existe una categoría con ese nombre.")
    cat.name, cat.icon = name, (p.get("icon") or "").strip()[:10]
    cat.save()
    return "Categoría actualizada."


def _cat_toggle(user, p):
    cat = _get(Category, user, p, "id", "una categoría")
    cat.is_active = not cat.is_active
    cat.save(update_fields=["is_active"])
    return "Categoría archivada." if not cat.is_active else "Categoría activada de nuevo."


@login_required
@require_http_methods(["GET", "POST"])
def categories(request):
    if request.method == "POST":
        return _run(request, {"create": _cat_create, "edit": _cat_edit, "toggle": _cat_toggle})
    ensure_default_categories(request.user)
    today = timezone.localdate()
    used = dict(
        Transaction.objects.filter(user=request.user, date__year=today.year, date__month=today.month, category__isnull=False)
        .values_list("category_id").annotate(s=Sum("amount"))
    )
    cats = list(Category.objects.filter(user=request.user).order_by("name"))
    for c in cats:
        c.month_total = used.get(c.id, 0)
    return render(request, "dashboard/categories.html", {
        "expense": [c for c in cats if c.type == "EXPENSE" and c.is_active],
        "income": [c for c in cats if c.type == "INCOME" and c.is_active],
        "archived": [c for c in cats if not c.is_active],
    })


# ── planes: metas, deudas, presupuestos, reservado ───────────

def _goal_create(user, p):
    fin.create_savings_goal(user, _text(p, "name", "un nombre"), _money(p.get("target")), _optional_date(p.get("deadline")))
    return "Meta creada."


def _goal_add(user, p):
    goal = _get(SavingsGoal, user, p, "id", "una meta")
    goal = fin.add_to_savings_goal(user, goal.pk, _money(p.get("amount")))
    return "¡Meta cumplida! 🎉" if goal.is_completed else "Aporte guardado."


def _goal_delete(user, p):
    _get(SavingsGoal, user, p, "id", "una meta").delete()
    return "Meta eliminada."


def _debt_create(user, p):
    fin.create_debt(user, _text(p, "name", "un nombre"), (p.get("creditor") or "").strip()[:100],
                    _money(p.get("total")), _optional_date(p.get("due_date")))
    return "Deuda registrada."


def _debt_pay(user, p):
    debt = _get(Debt, user, p, "id", "una deuda")
    debt = fin.pay_debt(user, debt.pk, _money(p.get("amount")))
    return "¡Deuda pagada por completo! 🎉" if debt.status == "PAID" else "Pago registrado."


def _debt_delete(user, p):
    _get(Debt, user, p, "id", "una deuda").delete()
    return "Deuda eliminada."


def _budget_set(user, p):
    cat = _get(Category, user, p, "category", "una categoría", type="EXPENSE", is_active=True)
    limit = _money(p.get("limit"))
    today = timezone.localdate()
    obj, created = Budget.objects.get_or_create(
        user=user, category=cat, month=today.month, year=today.year, defaults={"limit_amount": limit})
    if not created:
        obj.limit_amount = limit
        obj.save(update_fields=["limit_amount"])
    return f"Presupuesto de «{cat.name}» guardado."


def _budget_delete(user, p):
    _get(Budget, user, p, "id", "un presupuesto").delete()
    return "Presupuesto eliminado."


def _fund_create(user, p):
    fin.create_reserved_fund(user, _get(Account, user, p, "account", "una cuenta", is_active=True),
                             _text(p, "name", "un nombre"), _money(p.get("amount")),
                             (p.get("purpose") or "").strip()[:255], _optional_date(p.get("deadline")))
    return "Dinero reservado. Sale del saldo de la cuenta hasta que lo liberes."


def _fund_release(user, p):
    fund = _get(ReservedFund, user, p, "id", "un fondo", is_completed=False)
    fin.complete_reserved_fund(user, fund.pk)
    return "Dinero liberado: volvió al saldo de su cuenta."


PLAN_ACTIONS = {
    "goal_create": _goal_create, "goal_add": _goal_add, "goal_delete": _goal_delete,
    "debt_create": _debt_create, "debt_pay": _debt_pay, "debt_delete": _debt_delete,
    "budget_set": _budget_set, "budget_delete": _budget_delete,
    "fund_create": _fund_create, "fund_release": _fund_release,
}


@login_required
@require_http_methods(["GET", "POST"])
def plans(request):
    if request.method == "POST":
        return _run(request, PLAN_ACTIONS)
    user, today = request.user, timezone.localdate()
    ensure_default_categories(user)

    spent = dict(
        Transaction.objects.filter(user=user, type="EXPENSE", date__year=today.year, date__month=today.month)
        .values_list("category_id").annotate(s=Sum("amount"))
    )
    budgets = list(Budget.objects.filter(user=user, month=today.month, year=today.year).select_related("category"))
    for b in budgets:
        b.spent = spent.get(b.category_id, 0)
        b.pct = min(100, round(b.spent / b.limit_amount * 100)) if b.limit_amount else 0
        b.over = b.spent > b.limit_amount
        b.left = abs(b.limit_amount - b.spent)

    goals = list(SavingsGoal.objects.filter(user=user, is_completed=False).order_by("deadline", "name"))
    for g in goals:
        g.pct = min(100, round(g.current_amount / g.target_amount * 100)) if g.target_amount else 0
        g.left = g.target_amount - g.current_amount

    debts = list(Debt.objects.filter(user=user).exclude(status="PAID").order_by("due_date", "name"))
    for d in debts:
        d.remaining = d.total_amount - d.paid_amount
        d.pct = round(d.paid_amount / d.total_amount * 100) if d.total_amount else 0

    funds = list(ReservedFund.objects.filter(user=user, is_completed=False).select_related("account"))
    return render(request, "dashboard/plans.html", {
        "goals": goals, "debts": debts, "budgets": budgets, "funds": funds,
        "total_debt": sum(d.remaining for d in debts),
        "total_reserved": sum(f.amount for f in funds),
        "accounts": Account.objects.filter(user=user, is_active=True).order_by("name"),
        "expense_categories": Category.objects.filter(user=user, type="EXPENSE", is_active=True).order_by("name"),
        "month_date": today,
    })
