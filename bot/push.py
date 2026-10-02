"""Envío de notificaciones push del navegador.

Separado de `services.py` (que es la lógica de la conversación del bot)
porque esto es un mecanismo distinto: no responde a un mensaje del
usuario, lo dispara un cron externo a horas fijas del día.
"""

import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone
from pywebpush import WebPushException, webpush

from bot.models import PushSubscription
from finance.models import Transaction

logger = logging.getLogger("bot")


# Mensajes por franja horaria. Se ajusta el tono: en la mañana es un
# recordatorio neutral, en la noche es más directo porque ya se acaba
# el día para anotar algo.
MESSAGES_NO_LOGGED_TODAY = {
    "morning": "¿Vas a anotar algo hoy? Toca aquí para registrarlo.",
    "afternoon": "¿Gastaste algo hoy que no me hayas contado?",
    "evening": "Se acaba el día. ¿Algo que se te haya quedado por fuera?",
}

# Si ya registró algo hace poco, no lo molestamos otra vez en esta
# franja — está activo y no hace falta empujarlo.
RECENT_ACTIVITY_WINDOW_HOURS = 3


def _has_logged_recently(user):
    """True si el usuario ya registró algo hoy, hace poco rato."""
    today = timezone.localdate()
    cutoff = timezone.now() - timezone.timedelta(hours=RECENT_ACTIVITY_WINDOW_HOURS)
    return Transaction.objects.filter(
        user=user,
        date=today,
        created_at__gte=cutoff,
    ).exists()


def _has_logged_today_at_all(user):
    today = timezone.localdate()
    return Transaction.objects.filter(user=user, date=today).exists()


def message_for(user, period):
    """Decide si corresponde avisarle a este usuario, y con qué texto.

    Devuelve None si no hay que enviarle nada en esta franja.
    """
    if _has_logged_recently(user):
        return None

    if _has_logged_today_at_all(user):
        # Ya anotó algo hoy, pero no en las últimas horas. Un
        # recordatorio más suave que el de "no has anotado nada".
        return "¿Algo más que se te haya quedado por fuera hoy?"

    return MESSAGES_NO_LOGGED_TODAY.get(period, MESSAGES_NO_LOGGED_TODAY["afternoon"])


class SendResult:
    SENT = "sent"
    EXPIRED = "expired"       # la suscripción ya no sirve, hay que borrarla
    FAILED = "failed"         # fallo puntual (red, servicio caído, etc.);
                               # NO se borra, se reintenta la próxima vez


def send_to_subscription(subscription, title, body):
    """Envía un push a una suscripción puntual.

    Importante: solo se considera "vencida" (y se borra) una
    suscripción cuando el propio navegador la revocó (404/410). Un
    error de red, un 429, o el servicio caído momentáneamente son
    fallos pasajeros: la suscripción sigue siendo válida y debe
    seguir intentándose en el próximo recordatorio.
    """
    try:
        webpush(
            subscription_info={
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth,
                },
            },
            data=f'{{"title": {title!r}, "body": {body!r}}}'.replace("'", '"'),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_CLAIMS_EMAIL},
            ttl=3600,
        )
        return SendResult.SENT
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):
            # El navegador mató la suscripción (desinstaló la app,
            # borró datos del sitio, etc). Ya no sirve, se borra.
            logger.info("Suscripción vencida, borrando: %s", subscription.endpoint)
            return SendResult.EXPIRED
        logger.warning("Fallo pasajero enviando push: %s", exc)
        return SendResult.FAILED
    except Exception as exc:  # red caída, DNS, timeout, etc.
        logger.warning("Fallo de red enviando push: %s", exc)
        return SendResult.FAILED


def send_reminders(period):
    """Recorre todas las suscripciones y envía el recordatorio que
    corresponda. Pensado para ser llamado por un cron externo.

    Devuelve un resumen simple para dejar rastro en los logs.
    """
    sent = 0
    skipped = 0
    expired = 0
    failed = 0

    subscriptions = PushSubscription.objects.select_related("user")

    # Agrupamos por usuario para no mandarle dos veces el mismo
    # mensaje si tiene la app en dos dispositivos, salvo que sí
    # queramos avisarle en ambos — aquí sí queremos, cada dispositivo
    # es un push independiente, pero la decisión de "le toca o no"
    # solo se calcula una vez por usuario.
    message_cache = {}

    for subscription in subscriptions:
        user = subscription.user
        if user.id not in message_cache:
            message_cache[user.id] = message_for(user, period)

        body = message_cache[user.id]
        if body is None:
            skipped += 1
            continue

        result = send_to_subscription(subscription, "ContabilidadPerson", body)
        if result == SendResult.SENT:
            sent += 1
        elif result == SendResult.EXPIRED:
            expired += 1
            subscription.delete()
        else:
            failed += 1

    logger.info(
        "Recordatorios (%s): enviados=%s omitidos=%s vencidos=%s fallidos=%s",
        period,
        sent,
        skipped,
        expired,
        failed,
    )
    return {"sent": sent, "skipped": skipped, "expired": expired, "failed": failed}
