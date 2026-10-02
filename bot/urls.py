from django.urls import path

from .views import (
    bot_message,
    bot_process,
    push_public_key,
    push_send_reminders,
    push_subscribe,
    push_unsubscribe,
)

app_name = "bot"

urlpatterns = [
    path("message/", bot_message, name="bot_message"),
    path("process/", bot_process, name="bot_process"),
    path("push/public-key/", push_public_key, name="push_public_key"),
    path("push/subscribe/", push_subscribe, name="push_subscribe"),
    path("push/unsubscribe/", push_unsubscribe, name="push_unsubscribe"),
    path("push/send-reminders/", push_send_reminders, name="push_send_reminders"),
]
