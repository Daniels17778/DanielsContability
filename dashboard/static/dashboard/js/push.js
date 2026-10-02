(function () {
  "use strict";

  var boton = document.getElementById("push-toggle");
  if (!boton) return;

  // No todos los navegadores soportan esto (Safari de escritorio viejo,
  // por ejemplo). Si no hay soporte, el botón se queda oculto y ya.
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return;
  }

  var csrf = document.querySelector("[name=csrfmiddlewaretoken]");
  var csrfToken = csrf ? csrf.value : "";

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var raw = atob(base64);
    var output = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
    return output;
  }

  function post(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
      credentials: "same-origin",
      body: JSON.stringify(body || {}),
    });
  }

  function actualizarBoton(activo) {
    boton.textContent = activo ? "Desactivar avisos" : "Activar avisos";
    boton.hidden = false;
  }

  function registrarSW() {
    return navigator.serviceWorker.register("/sw.js");
  }

  function suscribirse() {
    return fetch(boton.dataset.publicKeyUrl, { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        return registrarSW().then(function (registro) {
          return registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.public_key),
          });
        });
      })
      .then(function (suscripcion) {
        var json = suscripcion.toJSON();
        return post(boton.dataset.subscribeUrl, json).then(function () {
          actualizarBoton(true);
        });
      });
  }

  function desuscribirse(suscripcion) {
    var endpoint = suscripcion.endpoint;
    return suscripcion.unsubscribe().then(function () {
      return post(boton.dataset.unsubscribeUrl, { endpoint: endpoint });
    }).then(function () {
      actualizarBoton(false);
    });
  }

  function estadoActual() {
    return registrarSW().then(function (registro) {
      return registro.pushManager.getSubscription();
    });
  }

  // Deja el botón listo apenas carga la página, mostrando si ya
  // está activo o no.
  estadoActual()
    .then(function (suscripcion) { actualizarBoton(!!suscripcion); })
    .catch(function () { /* sin service worker activo todavía, no pasa nada */ });

  boton.addEventListener("click", function () {
    boton.disabled = true;

    estadoActual()
      .then(function (suscripcion) {
        if (suscripcion) return desuscribirse(suscripcion);

        if (Notification.permission === "denied") {
          alert(
            "Bloqueaste las notificaciones para este sitio. " +
            "Actívalas desde los ajustes del navegador para este sitio."
          );
          return;
        }
        return suscribirse();
      })
      .catch(function (error) {
        console.error("Error con las notificaciones:", error);
        alert("No se pudo activar el aviso. Intenta de nuevo.");
      })
      .then(function () {
        boton.disabled = false;
      });
  });
})();
