from django.urls import path
from . import panel, views


app_name = "dashboard"

urlpatterns = [
    path("", views.home, name="home"),
    path("movimientos/", panel.transactions, name="transactions"),
    path("cuentas/", panel.accounts, name="accounts"),
    path("categorias/", panel.categories, name="categories"),
    path("planes/", panel.plans, name="plans"),
    path("libreta/", views.chat_page, name="chat"),
    path("libreta/enviar/", views.chat_send, name="chat_send"),
]