from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from finance.models import Account, Category, ReservedFund, SavingsGoal, Debt, Budget, Transaction
from finance.services import (
    get_category_period_total,
    get_expenses_by_category,
    register_expense,
    register_income,
    transfer_money,
    get_transaction_total,
    get_top_expense_category,
    get_period_dates,
    get_income_by_category,
    create_reserved_fund,
    complete_reserved_fund,
    create_savings_goal,
    add_to_savings_goal,
    create_debt,
    pay_debt,
    create_budget,
)

from bot.parser import parse_message, parse_amount, detect_category
from bot.constants import (
    STATE_IDLE,
    STATE_WAITING_FOR_AMOUNT,
    STATE_WAITING_FOR_CATEGORY,
    STATE_WAITING_FOR_ACCOUNT,
    STATE_WAITING_FOR_TRANSFER_DESTINATION,
    STATE_CONFIRMING,
    TRANSACTION_TYPE_EXPENSE,
    TRANSACTION_TYPE_INCOME,
    TRANSACTION_TYPE_TRANSFER,
    QUERY_TYPE_BALANCE,
    QUERY_TYPE_MONTH_SUMMARY,
    QUERY_TYPE_EXPENSE_TOTAL,
    QUERY_TYPE_INCOME_TOTAL,
    QUERY_TYPE_TOP_EXPENSE,
    QUERY_TYPE_EXPENSES_BREAKDOWN,
    QUERY_TYPE_INCOME_BREAKDOWN,
    QUERY_TYPE_CATEGORY_TOTAL,
    QUERY_TYPE_RESERVED_FUNDS,
    QUERY_TYPE_SAVINGS_GOALS,
    QUERY_TYPE_DEBTS,
    QUERY_TYPE_BUDGETS,
    QUERY_TYPE_DELETE_TRANSACTION,
    STATE_WAITING_RESERVED_FUND_NAME,
    STATE_WAITING_RESERVED_FUND_AMOUNT,
    STATE_WAITING_RESERVED_FUND_ACCOUNT,
    STATE_WAITING_SAVINGS_GOAL_TARGET,
    STATE_WAITING_DEBT_AMOUNT,
    STATE_WAITING_BUDGET_LIMIT,
    STATE_WAITING_BUDGET_CATEGORY,
    STATE_WAITING_BUDGET_MONTH,
    STATE_WAITING_BUDGET_YEAR,
    CONFIRMATION_YES,
    CONFIRMATION_NO,
    CONFIRMATION_DELETE_YES,
    CONFIRMATION_DELETE_NO,
    PERIOD_MONTH,
    STATE_WAITING_DELETE_CONFIRMATION,
    STATE_WAITING_DELETE_SELECTION,
)
from bot.models import Conversation, ConversationMessage
from bot.utils import get_period_text
from bot.queries.financial import (
    get_financial_summary,
    get_financial_summary_response,
    get_income_response,
    get_expense_response,
    get_top_expense_response,
    get_expenses_breakdown_response,
    get_income_breakdown_response,
    get_category_response,
    get_reserved_funds_response,
    get_savings_goals_response,
    get_debts_response,
    get_budgets_response,
    get_account_balance,
    find_account,
)
from bot.queries.transactions import get_account_balance as get_account_balance_query

HANDLERS = {}


def handler(state):
    def decorator(func):
        HANDLERS[state] = func
        return func
    return decorator


@transaction.atomic
def process_message(user, text, account=None):
    parsed = parse_message(text)
    transaction_type = parsed["type"]
    amount = parsed["amount"]
    category_name = parsed["category"]

    if transaction_type is None:
        raise ValueError("No pude determinar si se trata de un ingreso o un gasto.")
    if amount is None:
        raise ValueError("No pude encontrar el monto del movimiento.")
    if category_name is None:
        raise ValueError("No pude determinar la categoría.")
    if account is None:
        raise ValueError("Necesito saber en qué cuenta realizar el movimiento.")

    category = Category.objects.filter(
        user=user,
        name__iexact=category_name,
        is_active=True,
    ).first()
    if category is None:
        raise ValueError(f"No existe una categoría llamada '{category_name}'.")

    if transaction_type == TRANSACTION_TYPE_EXPENSE:
        transaction_obj = register_expense(
            user=user, account=account, category=category,
            amount=amount, description=text, date=date.today(),
        )
    elif transaction_type == TRANSACTION_TYPE_INCOME:
        transaction_obj = register_income(
            user=user, account=account, category=category,
            amount=amount, description=text, date=date.today(),
        )
    else:
        raise ValueError("Tipo de movimiento no compatible.")

    account.refresh_from_db()
    return {
        "success": True,
        "type": transaction_type,
        "amount": amount,
        "category": category.name,
        "account": account.name,
        "balance": account.balance,
        "transaction": transaction_obj,
    }


def get_conversation(user, for_update=False):
    if for_update:
        try:
            return Conversation.objects.select_for_update().get(user=user)
        except Conversation.DoesNotExist:
            return Conversation.objects.create(user=user, state=STATE_IDLE)
    conversation, _ = Conversation.objects.get_or_create(
        user=user, defaults={"state": STATE_IDLE},
    )
    return conversation


def save_message(conversation, role, content):
    return ConversationMessage.objects.create(
        conversation=conversation, role=role, content=content,
    )


@transaction.atomic
def chat(user, text, account=None):
    conversation = get_conversation(user, for_update=True)
    save_message(conversation, "USER", text)

    if account is not None and conversation.state == STATE_IDLE:
        conversation.pending_account = account

    handler_func = HANDLERS.get(conversation.state, _handle_uncontrolled)
    return handler_func(user, conversation, text)


@handler(STATE_IDLE)
def _handle_idle(user, conversation, text):
    parsed = parse_message(text)
    transaction_type = parsed["type"]
    period = parsed.get("period")
    category_name = parsed.get("category")
    amount = parsed.get("amount")
    source_account_name = parsed.get("source_account")
    destination_account_name = parsed.get("destination_account")

    query_responses = {
        QUERY_TYPE_TOP_EXPENSE: lambda: get_top_expense_response(user, period),
        QUERY_TYPE_EXPENSES_BREAKDOWN: lambda: get_expenses_breakdown_response(user, period),
        QUERY_TYPE_INCOME_BREAKDOWN: lambda: get_income_breakdown_response(user, period),
        QUERY_TYPE_MONTH_SUMMARY: lambda: get_financial_summary_response(user, period),
        QUERY_TYPE_CATEGORY_TOTAL: lambda: get_category_response(user, category_name, period),
        QUERY_TYPE_EXPENSE_TOTAL: lambda: get_expense_response(user, period),
        QUERY_TYPE_INCOME_TOTAL: lambda: get_income_response(user, period),
        QUERY_TYPE_RESERVED_FUNDS: lambda: get_reserved_funds_response(user),
        QUERY_TYPE_SAVINGS_GOALS: lambda: get_savings_goals_response(user),
        QUERY_TYPE_DEBTS: lambda: get_debts_response(user),
        QUERY_TYPE_BUDGETS: lambda: get_budgets_response(user),
        QUERY_TYPE_DELETE_TRANSACTION: lambda: _handle_delete_transaction_start(user, conversation),
    }

    if transaction_type in query_responses:
        response = query_responses[transaction_type]()
        save_message(conversation, "BOT", response)
        return response

    text_lower = text.lower().strip()
    if "crear fondo" in text_lower or "fondo reservado" in text_lower or "reservar" in text_lower:
        return _request_reserved_fund_name(user, conversation)
    if "meta" in text_lower and "ahorro" in text_lower or "crear meta" in text_lower:
        conversation.pending_description = text.split("meta")[0].strip() or "Meta de ahorro"
        return _request_savings_goal_target(user, conversation)
    if ("deuda" in text_lower or "debo" in text_lower) and "crear" in text_lower:
        conversation.pending_description = ""
        return _request_debt_amount(user, conversation)
    if "presupuesto" in text_lower or "crear presupuesto" in text_lower:
        return _request_budget_category(user, conversation)

    account_obj = conversation.pending_account or find_account(user, text)

    if transaction_type == QUERY_TYPE_BALANCE:
        account_name = parsed.get("account")
        if account_name:
            result = get_account_balance(user, account_name)
            if result is None:
                response = f"No encontré una cuenta llamada '{account_name}'."
            else:
                response = f"💰 Tienes ${result['balance']:,.0f} en {result['account']}."
        else:
            result = get_financial_summary(user)
            lines = ["💰 Resumen de tus cuentas:"]
            for acc in result["accounts"]:
                lines.append(f"🏦 {acc.name}: ${acc.balance:,.0f}")
            lines.append("")
            lines.append(f"💵 Total: ${result['total_balance']:,.0f}")
            response = "\n".join(lines)
        save_message(conversation, "BOT", response)
        return response

    if transaction_type is None:
        response = "No pude identificar si es un ingreso o un gasto."
        save_message(conversation, "BOT", response)
        return response

    if amount is None:
        conversation.state = STATE_WAITING_FOR_AMOUNT
        conversation.pending_type = transaction_type
        conversation.save()
        response = "¿Cuál es el monto?"
        save_message(conversation, "BOT", response)
        return response

    if transaction_type == TRANSACTION_TYPE_TRANSFER:
        if source_account_name is None or destination_account_name is None:
            response = (
                "Para una transferencia necesito saber "
                "la cuenta de origen y la cuenta de destino.\n"
                "Ejemplo: pasé 100 mil de Bancolombia a Nequi."
            )
            save_message(conversation, "BOT", response)
            return response
        source_account = find_account(user, source_account_name)
        destination_account = find_account(user, destination_account_name)
        if source_account is None:
            response = f"No encontré la cuenta de origen '{source_account_name}'."
            save_message(conversation, "BOT", response)
            return response
        if destination_account is None:
            response = f"No encontré la cuenta de destino '{destination_account_name}'."
            save_message(conversation, "BOT", response)
            return response
        if source_account == destination_account:
            response = "La cuenta de origen y destino deben ser diferentes."
            save_message(conversation, "BOT", response)
            return response
        conversation.pending_type = TRANSACTION_TYPE_TRANSFER
        conversation.pending_amount = amount
        conversation.pending_account = source_account
        conversation.pending_transfer_account = destination_account
        conversation.pending_description = text
        conversation.state = STATE_CONFIRMING
        conversation.save()
        response = (
            f"¿Confirmas transferir ${amount:,.0f} "
            f"de {source_account.name} a {destination_account.name}?"
        )
        save_message(conversation, "BOT", response)
        return response

    if category_name is None:
        conversation.pending_type = transaction_type
        conversation.pending_amount = amount
        conversation.state = STATE_WAITING_FOR_CATEGORY
        conversation.save()
        response = "¿En qué categoría?"
        save_message(conversation, "BOT", response)
        return response

    category = Category.objects.filter(
        user=user, name__iexact=category_name, is_active=True,
    ).first()
    if category is None:
        response = f"No tienes creada la categoría '{category_name}'."
        save_message(conversation, "BOT", response)
        return response

    conversation.pending_type = transaction_type
    conversation.pending_amount = amount
    conversation.pending_category = category

    if account_obj is not None:
        conversation.pending_account = account_obj
        conversation.state = STATE_CONFIRMING
        conversation.save()
        action = "el gasto" if transaction_type == TRANSACTION_TYPE_EXPENSE else "el ingreso"
        response = (
            f"¿Confirmas {action} de ${amount:,.0f} "
            f"en {category.name} desde {account_obj.name}?"
        )
        save_message(conversation, "BOT", response)
        return response

    conversation.state = STATE_WAITING_FOR_ACCOUNT
    conversation.save()
    response = "¿De qué cuenta hiciste el movimiento?"
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_FOR_AMOUNT)
def _handle_waiting_for_amount(user, conversation, text):
    amount = parse_amount(text)
    if amount is None:
        response = "No pude identificar el monto. Ejemplo: 20 mil, 15000 o $15.000."
        save_message(conversation, "BOT", response)
        return response

    conversation.pending_amount = amount
    if conversation.pending_type == TRANSACTION_TYPE_TRANSFER:
        response = f"💰 Monto recibido: ${amount:,.0f}.\nAhora necesito saber de qué cuenta sale el dinero."
        conversation.state = STATE_WAITING_FOR_ACCOUNT
        conversation.save()
        save_message(conversation, "BOT", response)
        return response

    conversation.state = STATE_WAITING_FOR_CATEGORY
    conversation.save()
    response = "¿En qué categoría?"
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_FOR_CATEGORY)
def _handle_waiting_for_category(user, conversation, text):
    category_name = detect_category(text)
    if category_name is None:
        category = Category.objects.filter(
            user=user, name__icontains=text.strip(), is_active=True,
        ).first()
        if category:
            category_name = category.name

    if category_name is None:
        response = "No pude identificar la categoría. Ejemplo: transporte, comida, salud o ropa."
        save_message(conversation, "BOT", response)
        return response

    category = Category.objects.filter(
        user=user, name__iexact=category_name, is_active=True,
    ).first()
    if category is None:
        response = f"No tienes creada la categoría '{category_name}'."
        save_message(conversation, "BOT", response)
        return response

    conversation.pending_category = category
    conversation.state = STATE_WAITING_FOR_ACCOUNT
    conversation.save()
    response = "¿De qué cuenta hiciste el movimiento?"
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_FOR_ACCOUNT)
def _handle_waiting_for_account(user, conversation, text):
    account = find_account(user, text)
    if account is None:
        response = "No encontré esa cuenta. Escribe el nombre de la cuenta, por ejemplo: Nequi."
        save_message(conversation, "BOT", response)
        return response

    if conversation.pending_type == TRANSACTION_TYPE_TRANSFER:
        conversation.pending_account = account
        conversation.state = STATE_WAITING_FOR_TRANSFER_DESTINATION
        conversation.save()
        response = f"¿A qué cuenta quieres transferir ${conversation.pending_amount:,.0f}?"
        save_message(conversation, "BOT", response)
        return response

    conversation.pending_account = account
    conversation.state = STATE_CONFIRMING
    conversation.save()
    amount = conversation.pending_amount
    category = conversation.pending_category
    action = "el gasto" if conversation.pending_type == TRANSACTION_TYPE_EXPENSE else "el ingreso"
    response = (
        f"¿Confirmas {action} de ${amount:,.0f} "
        f"en {category.name} desde {account.name}?"
    )
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_FOR_TRANSFER_DESTINATION)
def _handle_waiting_for_transfer_destination(user, conversation, text):
    destination_account = find_account(user, text)
    if destination_account is None:
        response = "No encontré esa cuenta. Escribe el nombre de la cuenta destino, por ejemplo: Nequi."
        save_message(conversation, "BOT", response)
        return response
    if destination_account == conversation.pending_account:
        response = "La cuenta de origen y destino deben ser diferentes. ¿A qué otra cuenta quieres transferir?"
        save_message(conversation, "BOT", response)
        return response

    conversation.pending_transfer_account = destination_account
    conversation.state = STATE_CONFIRMING
    conversation.save()
    response = (
        f"¿Confirmas transferir ${conversation.pending_amount:,.0f} "
        f"de {conversation.pending_account.name} a {destination_account.name}?"
    )
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_CONFIRMING)
def _handle_confirming(user, conversation, text):
    normalized = text.lower().strip()

    if normalized in CONFIRMATION_YES:
        pending_type = conversation.pending_type
        if pending_type == TRANSACTION_TYPE_EXPENSE:
            transaction_obj = register_expense(
                user=user,
                account=conversation.pending_account,
                category=conversation.pending_category,
                amount=conversation.pending_amount,
                description=conversation.pending_description,
                date=date.today(),
            )
        elif pending_type == TRANSACTION_TYPE_INCOME:
            transaction_obj = register_income(
                user=user,
                account=conversation.pending_account,
                category=conversation.pending_category,
                amount=conversation.pending_amount,
                description=conversation.pending_description,
                date=date.today(),
            )
        elif pending_type == TRANSACTION_TYPE_TRANSFER:
            transaction_obj = transfer_money(
                user=user,
                source_account=conversation.pending_account,
                destination_account=conversation.pending_transfer_account,
                amount=conversation.pending_amount,
                description=conversation.pending_description,
                date=date.today(),
            )
        else:
            raise ValueError("Tipo de movimiento no compatible.")

        account = conversation.pending_account
        account.refresh_from_db()

        if pending_type == TRANSACTION_TYPE_EXPENSE:
            response = (
                f"✅ Gasto registrado.\n💸 ${conversation.pending_amount:,.0f}\n"
                f"🏷️ {conversation.pending_category.name}\n"
                f"🏦 {account.name}\n💰 Saldo: ${account.balance:,.0f}"
            )
        elif pending_type == TRANSACTION_TYPE_INCOME:
            response = (
                f"✅ Ingreso registrado.\n💰 ${conversation.pending_amount:,.0f}\n"
                f"🏷️ {conversation.pending_category.name}\n"
                f"🏦 {account.name}\n💰 Saldo: ${account.balance:,.0f}"
            )
        else:
            src = conversation.pending_account
            dst = conversation.pending_transfer_account
            src.refresh_from_db()
            dst.refresh_from_db()
            response = (
                f"✅ Transferencia realizada.\n💸 ${conversation.pending_amount:,.0f}\n"
                f"🏦 {src.name} → {dst.name}\n"
                f"💰 {src.name}: ${src.balance:,.0f}\n"
                f"💰 {dst.name}: ${dst.balance:,.0f}"
            )

        conversation.state = STATE_IDLE
        conversation.pending_type = ""
        conversation.pending_amount = None
        conversation.pending_category = None
        conversation.pending_account = None
        conversation.pending_transfer_account = None
        conversation.pending_description = ""
        conversation.save()
        save_message(conversation, "BOT", response)
        return response

    if normalized in CONFIRMATION_NO:
        conversation.state = STATE_IDLE
        conversation.pending_type = ""
        conversation.pending_amount = None
        conversation.pending_category = None
        conversation.pending_account = None
        conversation.pending_description = ""
        conversation.save()
        response = "❌ Operación cancelada."
        save_message(conversation, "BOT", response)
        return response

    response = "Responde 'sí' para confirmar o 'no' para cancelar."
    save_message(conversation, "BOT", response)
    return response


def _handle_uncontrolled(user, conversation, text):
    conversation.state = STATE_IDLE
    conversation.save()
    response = "Empecemos de nuevo. ¿Qué movimiento quieres registrar?"
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_RESERVED_FUND_NAME)
def _handle_reserved_fund_name(user, conversation, text):
    name = text.strip()
    if not name:
        response = "¿Cómo se llama el fondo?"
        save_message(conversation, "BOT", response)
        return response
    conversation.pending_description = name
    conversation.state = STATE_WAITING_RESERVED_FUND_AMOUNT
    conversation.save()
    response = "¿Cuánto quieres reservar?"
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_RESERVED_FUND_AMOUNT)
def _handle_reserved_fund_amount(user, conversation, text):
    amount = parse_amount(text)
    if amount is None:
        response = "No pude identificar el monto."
        save_message(conversation, "BOT", response)
        return response
    conversation.pending_amount = amount
    account = conversation.pending_account
    if account is None:
        response = "¿De qué cuenta quieres reservar?"
        conversation.state = STATE_WAITING_RESERVED_FUND_ACCOUNT
        conversation.save()
        save_message(conversation, "BOT", response)
        return response
    return _finalize_reserved_fund(user, conversation)


@handler(STATE_WAITING_RESERVED_FUND_ACCOUNT)
def _handle_reserved_fund_account(user, conversation, text):
    account = find_account(user, text)
    if account is None:
        response = "No encontré esa cuenta."
        save_message(conversation, "BOT", response)
        return response
    conversation.pending_account = account
    return _finalize_reserved_fund(user, conversation)


def _finalize_reserved_fund(user, conversation):
    account = conversation.pending_account
    amount = conversation.pending_amount
    name = conversation.pending_description or "Fondo reservado"
    try:
        create_reserved_fund(user=user, account=account, name=name, amount=amount)
        account.refresh_from_db()
        response = (
            f"✅ Fondo reservado: ${amount:,.0f}\n"
            f"🏦 {account.name}\n"
            f"💰 Saldo restante: ${account.balance:,.0f}"
        )
        conversation.state = STATE_IDLE
        conversation.pending_type = ""
        conversation.pending_amount = None
        conversation.pending_account = None
        conversation.pending_description = ""
        conversation.save()
        save_message(conversation, "BOT", response)
        return response
    except ValueError as e:
        response = f"❌ {e}"
        save_message(conversation, "BOT", response)
        conversation.state = STATE_IDLE
        conversation.save()
        return response


@handler(STATE_WAITING_SAVINGS_GOAL_TARGET)
def _handle_savings_goal_target(user, conversation, text):
    amount = parse_amount(text)
    if amount is None:
        response = "No pude identificar el monto objetivo."
        save_message(conversation, "BOT", response)
        return response
    name = conversation.pending_description or "Meta de ahorro"
    try:
        goal = create_savings_goal(user=user, name=name, target_amount=amount)
        response = (
            f"✅ Meta creada: {goal.name}\n"
            f"🎯 Objetivo: ${goal.target_amount:,.0f}\n"
            f"📊 Actual: ${goal.current_amount:,.0f}"
        )
        conversation.state = STATE_IDLE
        conversation.pending_description = ""
        conversation.save()
        save_message(conversation, "BOT", response)
        return response
    except ValueError as e:
        response = f"❌ {e}"
        save_message(conversation, "BOT", response)
        conversation.state = STATE_IDLE
        conversation.save()
        return response


@handler(STATE_WAITING_DEBT_AMOUNT)
def _handle_debt_amount(user, conversation, text):
    amount = parse_amount(text)
    if amount is None:
        response = "No pude identificar el monto."
        save_message(conversation, "BOT", response)
        return response
    name = conversation.pending_description or "Deuda"
    try:
        debt = create_debt(user=user, name=name, creditor="", total_amount=amount)
        response = f"✅ Deuda creada: {debt.name} - ${debt.total_amount:,.0f}"
        conversation.state = STATE_IDLE
        conversation.pending_description = ""
        conversation.save()
        save_message(conversation, "BOT", response)
        return response
    except ValueError as e:
        response = f"❌ {e}"
        save_message(conversation, "BOT", response)
        conversation.state = STATE_IDLE
        conversation.save()
        return response


@handler(STATE_WAITING_BUDGET_LIMIT)
def _handle_budget_limit(user, conversation, text):
    amount = parse_amount(text)
    if amount is None:
        response = "No pude identificar el límite."
        save_message(conversation, "BOT", response)
        return response
    category = conversation.pending_category
    month = conversation.pending_month
    year = conversation.pending_year
    try:
        create_budget(user=user, category=category, month=month, year=year, limit_amount=amount)
        response = f"✅ Presupuesto creado: {category.name} - ${amount:,.0f} para {month}/{year}"
        conversation.state = STATE_IDLE
        conversation.pending_description = ""
        conversation.pending_category = None
        conversation.save()
        save_message(conversation, "BOT", response)
        return response
    except ValueError as e:
        response = f"❌ {e}"
        save_message(conversation, "BOT", response)
        conversation.state = STATE_IDLE
        conversation.save()
        return response


@handler(STATE_WAITING_BUDGET_CATEGORY)
def _handle_budget_category(user, conversation, text):
    category_name = detect_category(text)
    if category_name is None:
        category = Category.objects.filter(
            user=user, name__icontains=text.strip(), is_active=True,
        ).first()
        if category:
            category_name = category.name
    if category_name is None:
        response = "No pude identificar la categoría."
        save_message(conversation, "BOT", response)
        return response
    category = Category.objects.filter(
        user=user, name__iexact=category_name, is_active=True,
    ).first()
    if category is None:
        response = f"No tienes creada la categoría '{category_name}'."
        save_message(conversation, "BOT", response)
        return response
    conversation.pending_category = category
    conversation.state = STATE_WAITING_BUDGET_MONTH
    conversation.save()
    response = "¿Para qué mes? (ej: 9)"
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_BUDGET_MONTH)
def _handle_budget_month(user, conversation, text):
    try:
        month = int(text.strip())
        if not 1 <= month <= 12:
            raise ValueError
    except ValueError:
        response = "Escribe un mes válido (1-12)."
        save_message(conversation, "BOT", response)
        return response
    conversation.pending_month = month
    conversation.state = STATE_WAITING_BUDGET_YEAR
    conversation.save()
    response = "¿Para qué año? (ej: 2026)"
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_BUDGET_YEAR)
def _handle_budget_year(user, conversation, text):
    try:
        year = int(text.strip())
    except ValueError:
        response = "Escribe un año válido."
        save_message(conversation, "BOT", response)
        return response
    conversation.pending_year = year
    return _handle_budget_limit(user, conversation)


def _request_reserved_fund_name(user, conversation):
    conversation.state = STATE_WAITING_RESERVED_FUND_NAME
    conversation.save()
    response = "¿Cómo se llama el fondo reservado?"
    save_message(conversation, "BOT", response)
    return response


def _request_savings_goal_target(user, conversation):
    conversation.state = STATE_WAITING_SAVINGS_GOAL_TARGET
    conversation.save()
    response = "¿Cuál es el monto objetivo de tu meta de ahorro?"
    save_message(conversation, "BOT", response)
    return response


def _request_debt_amount(user, conversation):
    conversation.state = STATE_WAITING_DEBT_AMOUNT
    conversation.save()
    response = "¿Cuánto debes?"
    save_message(conversation, "BOT", response)
    return response


def _request_budget_category(user, conversation):
    conversation.state = STATE_WAITING_BUDGET_CATEGORY
    conversation.save()
    response = "¿De qué categoría es el presupuesto?"
    save_message(conversation, "BOT", response)
    return response


def _handle_delete_transaction_start(user, conversation):
    """Inicia el proceso de eliminar una transacción mostrando las últimas"""
    recent_transactions = Transaction.objects.filter(
        user=user
    ).select_related("account", "category").order_by("-date", "-created_at")[:10]

    if not recent_transactions:
        response = "📋 No tienes transacciones registradas para eliminar."
        save_message(conversation, "BOT", response)
        return response

    lines = ["🗑️ **Eliminar transacción**\n", "Selecciona el número de la transacción a eliminar:\n"]
    for i, tx in enumerate(recent_transactions, 1):
        tipo_icon = "💸" if tx.type == "EXPENSE" else "💰" if tx.type == "INCOME" else "🔄"
        cat_name = tx.category.name if tx.category else "Sin categoría"
        lines.append(
            f"{i}. {tipo_icon} {tx.date.strftime('%d/%m')} "
            f"{cat_name} - ${tx.amount:,.0f} ({tx.account.name})"
        )

    lines.append("\n❌ Escribe 'cancelar' para salir")
    response = "\n".join(lines)

    conversation.state = STATE_WAITING_DELETE_SELECTION
    conversation.save()
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_DELETE_SELECTION)
def _handle_delete_selection(user, conversation, text):
    text_lower = text.lower().strip()

    if text_lower in ["cancelar", "no", "n", "salir"]:
        conversation.state = STATE_IDLE
        conversation.save()
        response = "❌ Operación cancelada."
        save_message(conversation, "BOT", response)
        return response

    # Try to parse as number
    try:
        selection = int(text.strip())
    except ValueError:
        response = "Por favor, escribe el número de la transacción o 'cancelar'."
        save_message(conversation, "BOT", response)
        return response

    recent_transactions = Transaction.objects.filter(
        user=user
    ).select_related("account", "category").order_by("-date", "-created_at")[:10]

    if selection < 1 or selection > len(recent_transactions):
        response = f"Número inválido. Elige entre 1 y {len(recent_transactions)}."
        save_message(conversation, "BOT", response)
        return response

    selected_tx = recent_transactions[selection - 1]
    tipo_icon = "💸" if selected_tx.type == "EXPENSE" else "💰" if selected_tx.type == "INCOME" else "🔄"
    cat_name = selected_tx.category.name if selected_tx.category else "Sin categoría"

    conversation.pending_description = str(selected_tx.id)
    conversation.state = STATE_WAITING_DELETE_CONFIRMATION
    conversation.save()

    response = (
        f"⚠️ **Confirmar eliminación**\n\n"
        f"{tipo_icon} {selected_tx.date.strftime('%d/%m/%Y')}\n"
        f"🏷️ {cat_name}\n"
        f"🏦 {selected_tx.account.name}\n"
        f"💰 ${selected_tx.amount:,.0f}\n"
        f"📝 {selected_tx.description or 'Sin descripción'}\n\n"
        f"¿Estás seguro de que quieres eliminar esta transacción?\n"
        f"Responde 'sí' para confirmar o 'no' para cancelar."
    )
    save_message(conversation, "BOT", response)
    return response


@handler(STATE_WAITING_DELETE_CONFIRMATION)
def _handle_delete_confirmation(user, conversation, text):
    text_lower = text.lower().strip()

    if text_lower in CONFIRMATION_DELETE_NO:
        conversation.state = STATE_IDLE
        conversation.pending_description = ""
        conversation.save()
        response = "❌ Eliminación cancelada."
        save_message(conversation, "BOT", response)
        return response

    if text_lower not in CONFIRMATION_DELETE_YES:
        response = "Responde 'sí' para confirmar la eliminación o 'no' para cancelar."
        save_message(conversation, "BOT", response)
        return response

    # Delete the transaction
    tx_id = conversation.pending_description
    try:
        tx = Transaction.objects.get(pk=tx_id, user=user)
        tx_type = tx.type
        tx_amount = tx.amount
        tx_account = tx.account

        # Restore account balance
        if tx_type == "EXPENSE":
            tx_account.balance += tx_amount
        elif tx_type == "INCOME":
            tx_account.balance -= tx_amount
        elif tx_type == "TRANSFER":
            # For transfers, we need to handle both accounts
            # This is more complex, for now just delete
            pass

        tx_account.save(update_fields=["balance", "updated_at"])
        tx.delete()

        response = "✅ Transacción eliminada correctamente."
        if tx_type != "TRANSFER":
            response += f"\n💰 Saldo actualizado en {tx_account.name}: ${tx_account.balance:,.0f}"
    except Transaction.DoesNotExist:
        response = "❌ No se encontró la transacción."
    except Exception as e:
        response = f"❌ Error al eliminar: {str(e)}"

    conversation.state = STATE_IDLE
    conversation.pending_description = ""
    conversation.save()
    save_message(conversation, "BOT", response)
    return response