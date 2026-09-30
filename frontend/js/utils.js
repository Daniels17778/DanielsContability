/**
 * Utility Functions for ContabilidadPerson Frontend
 */

// Format currency
export function formatCurrency(amount, currency = 'COP', locale = 'es-CO') {
    if (amount === null || amount === undefined) return '$0';
    
    const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
    
    return formatter.format(amount);
}

// Format number with thousand separators
export function formatNumber(num, locale = 'es-CO') {
    return new Intl.NumberFormat(locale).format(num);
}

// Format date
export function formatDate(dateStr, locale = 'es-CO', options = {}) {
    if (!dateStr) return '-';
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
    };
    return new Date(dateStr).toLocaleDateString(locale, defaultOptions);
}

// Format relative time
export function formatRelativeTime(dateStr, locale = 'es-CO') {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return 'Ahora mismo';
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} d`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} sem`;
    return formatDate(dateStr, locale);
}

// Debounce function
export function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

// Throttle function
export function throttle(fn, limit) {
    let inThrottle;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Generate unique ID
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Deep clone object
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Get initials from name
export function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

// Truncate text
export function truncate(text, length = 50) {
    if (!text) return '';
    if (text.length <= length) return text;
    return text.slice(0, length) + '...';
}

// Capitalize first letter
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Parse query string
export function parseQueryString(queryString) {
    const params = new URLSearchParams(queryString);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

// Build query string
export function buildQueryString(params) {
    return new URLSearchParams(params).toString();
}

// Format percentage
export function formatPercent(value, decimals = 1) {
    return `${value.toFixed(decimals)}%`;
}

// Calculate percentage
export function calculatePercent(part, total) {
    if (total === 0) return 0;
    return (part / total) * 100;
}

// Get color for transaction type
export function getTransactionTypeColor(type) {
    const colors = {
        INCOME: 'var(--color-success)',
        EXPENSE: 'var(--color-danger)',
        TRANSFER: 'var(--color-info)'
    };
    return colors[type] || 'var(--color-text-secondary)';
}

// Get icon for transaction type
export function getTransactionTypeIcon(type) {
    const icons = {
        INCOME: '💰',
        EXPENSE: '💸',
        TRANSFER: '🔄'
    };
    return icons[type] || '💳';
}

// Get icon for account type
export function getAccountTypeIcon(type) {
    const icons = {
        CASH: '💵',
        BANK: '🏦',
        NEQUI: '📱',
        DIGITAL: '💳',
        OTHER: '📦'
    };
    return icons[type] || '🏦';
}

// Get display name for account type
export function getAccountTypeDisplay(type) {
    const names = {
        CASH: 'Efectivo',
        BANK: 'Cuenta Bancaria',
        NEQUI: 'Nequi',
        DIGITAL: 'Billetera Digital',
        OTHER: 'Otro'
    };
    return names[type] || type;
}

// Get display name for category type
export function getCategoryTypeDisplay(type) {
    return type === 'INCOME' ? 'Ingreso' : 'Gasto';
}

// Get status display
export function getStatusDisplay(status) {
    const statuses = {
        PENDING: 'Pendiente',
        PARTIAL: 'Pago Parcial',
        PAID: 'Pagada'
    };
    return statuses[status] || status;
}

// Get status color
export function getStatusColor(status) {
    const colors = {
        PENDING: 'var(--color-warning)',
        PARTIAL: 'var(--color-info)',
        PAID: 'var(--color-success)'
    };
    return colors[status] || 'var(--color-text-secondary)';
}

// Validate email
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate required fields
export function validateRequired(data, fields) {
    const errors = {};
    for (const field of fields) {
        if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
            errors[field] = 'Este campo es obligatorio';
        }
    }
    return errors;
}

// Format file size
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Sleep utility
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Retry function
export async function retry(fn, retries = 3, delay = 1000) {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        await sleep(delay);
        return retry(fn, retries - 1, delay * 2);
    }
}

// Check if element is in viewport
export function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

// Copy to clipboard
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            return true;
        } catch (err) {
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

// Download JSON
export function downloadJSON(data, filename = 'data.json') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Get month name
export function getMonthName(month, locale = 'es-CO') {
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleDateString(locale, { month: 'long' });
}

// Get current month/year for inputs
export function getCurrentMonthYear() {
    const now = new Date();
    return {
        month: String(now.getMonth() + 1).padStart(2, '0'),
        year: now.getFullYear()
    };
}

// Format month input value (YYYY-MM)
export function formatMonthInput(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Parse month input value
export function parseMonthInput(value) {
    if (!value) return null;
    const [year, month] = value.split('-').map(Number);
    return { year, month };
}