import hmac
import json

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.http import HttpResponse, HttpResponseForbidden, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django_ratelimit.decorators import ratelimit

from bot.models import PushSubscription
from bot.push import send_reminders
from finance.models import Account
from bot.services import chat, process_message


@csrf_exempt
@require_http_methods(["POST"])
@ratelimit(key="user_or_ip", rate="30/m", method="POST", block=True)
def bot_message(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse(
            {"error": "Cuerpo inválido. Se esperaba JSON."},
            status=400,
        )

    user_id = body.get("user_id")
    text = body.get("text", "").strip()
    account_id = body.get("account_id")

    if not user_id or not text:
        return JsonResponse(
            {"error": "Se requieren 'user_id' y 'text'."},
            status=400,
        )

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse(
            {"error": "Usuario no encontrado."},
            status=404,
        )

    account = None
    if account_id:
        try:
            account = Account.objects.get(
                pk=account_id, user=user, is_active=True
            )
        except Account.DoesNotExist:
            pass

    response = chat(user, text, account=account)

    return JsonResponse({"response": response})


@csrf_exempt
@require_http_methods(["POST"])
@ratelimit(key="user_or_ip", rate="30/m", method="POST", block=True)
def bot_process(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse(
            {"error": "Cuerpo inválido. Se esperaba JSON."},
            status=400,
        )

    user_id = body.get("user_id")
    text = body.get("text", "").strip()
    account_id = body.get("account_id")

    if not user_id or not text:
        return JsonResponse(
            {"error": "Se requieren 'user_id' y 'text'."},
            status=400,
        )

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse(
            {"error": "Usuario no encontrado."},
            status=404,
        )

    account = None
    if account_id:
        try:
            account = Account.objects.get(
                pk=account_id, user=user, is_active=True
            )
        except Account.DoesNotExist:
            pass

    try:
        result = process_message(user, text, account=account)
        result.pop("transaction", None)
        return JsonResponse({"result": result})
    except ValueError as e:
        return JsonResponse({"error": str(e)}, status=400)

# ─────────────────────────────────────────────────────────────
# Notificaciones push del navegador
# ─────────────────────────────────────────────────────────────

@login_required
@require_http_methods(["GET"])
def push_public_key(request):
    """La llave pública VAPID, para que el navegador se suscriba.

    Esta llave no es secreta (es la mitad pública del par), por eso
    no pasa nada si viaja por una petición GET normal.
    """
    return JsonResponse({"public_key": settings.VAPID_PUBLIC_KEY})


@login_required
@require_http_methods(["POST"])
def push_subscribe(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Cuerpo inválido."}, status=400)

    endpoint = body.get("endpoint")
    keys = body.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")

    if not (endpoint and p256dh and auth):
        return JsonResponse({"error": "Faltan datos de la suscripción."}, status=400)

    PushSubscription.objects.update_or_create(
        endpoint=endpoint,
        defaults={"user": request.user, "p256dh": p256dh, "auth": auth},
    )
    return JsonResponse({"ok": True})


@login_required
@require_http_methods(["POST"])
def push_unsubscribe(request):
    try:
        body = json.loads(request.body)
    except (json.JSONDecodeError, TypeError):
        return JsonResponse({"error": "Cuerpo inválido."}, status=400)

    endpoint = body.get("endpoint")
    if endpoint:
        PushSubscription.objects.filter(
            endpoint=endpoint, user=request.user
        ).delete()
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["GET", "POST"])
def push_send_reminders(request):
    """Disparado por un cron externo (cron-job.org), no por un usuario
    logueado. Por eso no usa sesión ni CSRF: se protege con un token
    compartido que solo tú y el cron conocen.
    """
    token = request.GET.get("token") or request.headers.get("X-Reminder-Token", "")
    expected = settings.REMINDER_TOKEN

    if not expected or not hmac.compare_digest(token, expected):
        return HttpResponseForbidden("Token inválido.")

    period = request.GET.get("period", "afternoon")
    if period not in ("morning", "afternoon", "evening"):
        return JsonResponse({"error": "period debe ser morning, afternoon o evening."}, status=400)

    result = send_reminders(period)
    return JsonResponse(result)


SERVICE_WORKER_JS = """
// Service worker para notificaciones push. Vive en /sw.js (no en
// /static/) a propósito: el "alcance" de un service worker es la
// carpeta donde vive, y necesitamos que cubra todo el sitio.

self.addEventListener('push', (event) => {
  let payload = { title: 'ContabilidadPerson', body: 'Tienes un aviso.' };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    payload.body = event.data ? event.data.text() : payload.body;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: 'contabilidadperson-recordatorio',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/libreta/');
    })
  );
});
"""


@require_http_methods(["GET"])
def service_worker(request):
    return HttpResponse(SERVICE_WORKER_JS, content_type="application/javascript")
