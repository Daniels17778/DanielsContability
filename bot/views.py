import json

from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django_ratelimit.decorators import ratelimit

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