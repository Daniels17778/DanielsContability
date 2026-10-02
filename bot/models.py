from django.contrib.auth.models import User
from django.db import models


class Conversation(models.Model):
    STATES = [
        ("IDLE", "Inactiva"),
        ("WAITING_FOR_ACCOUNT", "Esperando cuenta"),
        ("WAITING_FOR_TRANSFER_DESTINATION", "Esperando cuenta destino"),
        ("WAITING_FOR_CATEGORY", "Esperando categoría"),
        ("WAITING_FOR_AMOUNT", "Esperando monto"),
        ("CONFIRMING", "Esperando confirmación"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="conversations",
        db_index=True,
    )

    state = models.CharField(
        max_length=40,
        choices=STATES,
        default="IDLE",
        db_index=True,
    )

    pending_type = models.CharField(
        max_length=10,
        blank=True,
        db_index=True,
    )

    pending_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )

    pending_category = models.ForeignKey(
        "finance.Category",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pending_conversations",
    )

    pending_account = models.ForeignKey(
        "finance.Account",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pending_conversations",
    )

    pending_transfer_account = models.ForeignKey(
        "finance.Account",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pending_transfer_conversations",
    )

    pending_description = models.CharField(
        max_length=255,
        blank=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return f"{self.user.username} - {self.state}"


class ConversationMessage(models.Model):
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name="messages",
    )

    role = models.CharField(
        max_length=20,
        choices=[
            ("USER", "Usuario"),
            ("BOT", "Bot"),
        ],
    )

    content = models.TextField()

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    def __str__(self):
        return f"{self.role}: {self.content[:50]}"


class PushSubscription(models.Model):
    """Una suscripción a notificaciones push del navegador.

    `endpoint` identifica de forma única la suscripción de un navegador
    concreto (el navegador la genera al llamar pushManager.subscribe()).
    Un mismo usuario puede tener varias si instaló la app en más de un
    celular/navegador.
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="push_subscriptions",
        db_index=True,
    )

    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)

    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.endpoint[:40]}..."