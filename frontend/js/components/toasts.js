/**
 * Toast Notification System
 */

import { store } from '../store.js';

let toastId = 0;

export function initToasts() {
    // Listen for toast changes
    store.on('toasts:change', renderToasts);
}

function renderToasts() {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toasts = store.get('toasts');
    
    container.innerHTML = toasts.map(toast => `
        <div class="toast toast-${toast.type}" data-toast-id="${toast.id}" role="alert" aria-live="polite">
            <span class="toast-icon">${getToastIcon(toast.type)}</span>
            <div class="toast-message">${toast.message}</div>
            <button class="toast-close" onclick="removeToast('${toast.id}')" aria-label="Cerrar">&times;</button>
        </div>
    `).join('');
}

function getToastIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || icons.info;
}

window.removeToast = function(id) {
    store.removeToast(id);
};

// Auto-cleanup old toasts
setInterval(() => {
    const toasts = store.get('toasts');
    const now = Date.now();
    toasts.forEach(toast => {
        if (toast.timestamp && now - toast.timestamp > 10000) {
            store.removeToast(toast.id);
        }
    });
}, 5000);