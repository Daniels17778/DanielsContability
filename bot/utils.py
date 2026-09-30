PERIOD_TEXT_MAP = {
    None: "",
    "TODAY": " de hoy",
    "YESTERDAY": " de ayer",
    "WEEK": " de esta semana",
    "MONTH": " de este mes",
    "LAST_MONTH": " del mes pasado",
}

SHORT_PERIOD_TEXT = {
    None: "",
    "TODAY": " hoy",
    "YESTERDAY": " ayer",
    "WEEK": " esta semana",
    "MONTH": " este mes",
    "LAST_MONTH": " el mes pasado",
}


def get_period_text(period, mapping=None):
    if mapping == "short":
        return SHORT_PERIOD_TEXT.get(period, "")
    if mapping is None:
        mapping = PERIOD_TEXT_MAP
    return mapping.get(period, "")


def format_balance(balance):
    return f"${balance:,.0f}"


def format_amount(amount):
    return f"${amount:,.0f}"
