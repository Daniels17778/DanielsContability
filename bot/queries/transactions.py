from decimal import Decimal
from django.db.models import Sum
from finance.models import Account


def get_account_balance(user, account_name=None):
    if account_name:
        account = Account.objects.filter(user=user, name__iexact=account_name, is_active=True).first()
        if account is None:
            return None
        return {"account": account.name, "balance": account.balance}

    accounts = Account.objects.filter(user=user, is_active=True)
    total = accounts.aggregate(total=Sum("balance"))["total"] or Decimal("0")
    return {"accounts": list(accounts), "total": total}