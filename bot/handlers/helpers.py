"""Ayudas para que el chat no se atasque: categorías por defecto,
salida de estados de espera, listar/crear categorías."""
import re

from finance.models import Category
from bot.parser import CATEGORY_KEYWORDS, normalize, parse_message
from bot.constants import (
    STATE_IDLE,
    QUERY_TYPE_BALANCE, QUERY_TYPE_MONTH_SUMMARY, QUERY_TYPE_EXPENSE_TOTAL,
    QUERY_TYPE_INCOME_TOTAL, QUERY_TYPE_TOP_EXPENSE, QUERY_TYPE_EXPENSES_BREAKDOWN,
    QUERY_TYPE_INCOME_BREAKDOWN, QUERY_TYPE_CATEGORY_TOTAL, QUERY_TYPE_RESERVED_FUNDS,
    QUERY_TYPE_SAVINGS_GOALS, QUERY_TYPE_DEBTS, QUERY_TYPE_BUDGETS,
)

ICONS = {
    "alimentación": "🍽", "transporte": "🚌", "arriendo": "🏠", "entretenimiento": "🎬",
    "salud": "💊", "ropa": "👕", "tecnología": "💻", "salario": "💼",
    "otros": "•", "otros ingresos": "＋",
}
INCOME_DEFAULTS = {"salario", "otros ingresos"}
CANCEL_WORDS = {"cancelar", "cancela", "salir", "olvidalo", "olvida", "reiniciar", "empezar de nuevo"}
_CORE_STATES = {
    "WAITING_FOR_ACCOUNT", "WAITING_FOR_TRANSFER_DESTINATION",
    "WAITING_FOR_CATEGORY", "WAITING_FOR_AMOUNT", "CONFIRMING",
}
QUERY_TYPES = {
    QUERY_TYPE_BALANCE, QUERY_TYPE_MONTH_SUMMARY, QUERY_TYPE_EXPENSE_TOTAL,
    QUERY_TYPE_INCOME_TOTAL, QUERY_TYPE_TOP_EXPENSE, QUERY_TYPE_EXPENSES_BREAKDOWN,
    QUERY_TYPE_INCOME_BREAKDOWN, QUERY_TYPE_CATEGORY_TOTAL, QUERY_TYPE_RESERVED_FUNDS,
    QUERY_TYPE_SAVINGS_GOALS, QUERY_TYPE_DEBTS, QUERY_TYPE_BUDGETS,
}


def _type_of(name):
    return "INCOME" if name in INCOME_DEFAULTS else "EXPENSE"


def ensure_default_categories(user):
    """Si el usuario no tiene ninguna categoría, crea las básicas."""
    if Category.objects.filter(user=user).exists():
        return
    names = list(CATEGORY_KEYWORDS.keys()) + ["otros", "otros ingresos"]
    Category.objects.bulk_create([
        Category(user=user, name=n, type=_type_of(n), icon=ICONS.get(n, ""))
        for n in dict.fromkeys(names)
    ])


def ensure_category(user, name, kind=""):
    """Devuelve la categoría activa con ese nombre; si no existe (o está
    archivada) la crea/reactiva en vez de bloquear al usuario."""
    kind = kind if kind in ("INCOME", "EXPENSE") else _type_of(name)
    cat = Category.objects.filter(user=user, name__iexact=name).first()
    if cat is None:
        return Category.objects.create(user=user, name=name, type=kind, icon=ICONS.get(name, ""))
    if not cat.is_active:
        cat.is_active = True
        cat.save(update_fields=["is_active"])
    return cat


def match_user_category(user, text):
    """Reconoce categorías propias del usuario (p. ej. 'mascotas') dentro de la frase."""
    t = " " + normalize(text) + " "
    best = None
    for c in Category.objects.filter(user=user, is_active=True):
        n = normalize(c.name)
        if n and f" {n} " in t and (best is None or len(n) > len(normalize(best))):
            best = c.name
    return best


def categories_text(user, kind=""):
    qs = Category.objects.filter(user=user, is_active=True).order_by("type", "name")
    if kind in ("INCOME", "EXPENSE"):
        qs = qs.filter(type=kind)
    gastos = [c.name for c in qs if c.type == "EXPENSE"]
    ingresos = [c.name for c in qs if c.type == "INCOME"]
    lines = []
    if gastos:
        lines.append("Gastos: " + ", ".join(gastos))
    if ingresos:
        lines.append("Ingresos: " + ", ".join(ingresos))
    return "\n".join(lines) or "Aún no tienes categorías."


def reset(conversation):
    conversation.state = STATE_IDLE
    conversation.pending_type = ""
    conversation.pending_amount = None
    conversation.pending_category = None
    conversation.pending_account = None
    conversation.pending_transfer_account = None
    conversation.pending_description = ""
    conversation.save()


_CREATE = re.compile(
    r"^\s*crea(?:r|me)?\s+(?:una\s+|la\s+)?categor[ií]a\s+(?:de\s+)?(ingreso|gasto)?\s*(.+?)\s*$", re.I)


def try_escape(user, conversation, text):
    """Atiende cosas que deben funcionar en cualquier momento.
    Devuelve la respuesta, o None para seguir con el flujo normal."""
    t = normalize(text)
    waiting = conversation.state != STATE_IDLE

    if t in CANCEL_WORDS:
        if not waiting:
            return "No hay nada pendiente. Cuéntame un movimiento o pregúntame algo."
        reset(conversation)
        return "Listo, lo dejé así. ¿Qué anotamos?"

    m = _CREATE.match(text)
    if m:
        kind = "INCOME" if (m.group(1) or "").lower() == "ingreso" else "EXPENSE"
        name = m.group(2).strip().lower()[:100]
        ensure_category(user, name, kind)
        tail = "\n\nAhora dime la categoría del movimiento." if conversation.state == "WAITING_FOR_CATEGORY" else ""
        return f"✅ Categoría '{name}' lista ({'ingreso' if kind == 'INCOME' else 'gasto'}).{tail}"

    if t in ("creala", "crearla", "crea la", "crea una"):
        return "Dime el nombre así: crear categoría Mascotas (o: crear categoría de ingreso Freelance)."

    if re.search(r"\bcategorias?\b", t) and re.search(r"\b(que|cuales|cual|lista|ver|mis|hay|tengo)\b", t):
        hint = "\n\nEscribe una de esas para continuar." if conversation.state == "WAITING_FOR_CATEGORY" else ""
        return "Tus categorías:\n" + categories_text(user) + hint

    if waiting:
        parsed = parse_message(text)
        if parsed.get("type") in QUERY_TYPES:
            reset(conversation)  # es una consulta: sal de la espera y respóndela normal
        elif (conversation.state in _CORE_STATES
              and parsed.get("type") in ("EXPENSE", "INCOME")
              and parsed.get("amount") is not None):
            reset(conversation)  # es un movimiento nuevo completo: descarta el pendiente
    return None
