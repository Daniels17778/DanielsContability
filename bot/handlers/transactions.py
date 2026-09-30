from datetime import date
from decimal import Decimal

from django.db import transaction

from finance.models import Account, Category
from finance.services import (
    register_expense,
    register_income,
)

from bot.parser import parse_message


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

    if transaction_type == "EXPENSE":
        transaction_obj = register_expense(
            user=user, account=account, category=category,
            amount=amount, description=text, date=date.today(),
        )
    elif transaction_type == "INCOME":
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