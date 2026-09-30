from django.urls import path

from .views import bot_message, bot_process

app_name = "bot"

urlpatterns = [
    path("message/", bot_message, name="bot_message"),
    path("process/", bot_process, name="bot_process"),
]
