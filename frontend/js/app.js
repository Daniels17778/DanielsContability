/**
 * ContabilidadPerson Frontend - Main Application
 * SPA with History API navigation, fully responsive
 */

import { store, selectors } from './store.js';
import { api } from './api.js';
import { 
    formatCurrency, formatDate, formatRelativeTime, 
    debounce, generateId, truncate,
    getTransactionTypeColor, getTransactionTypeIcon,
    getAccountTypeIcon, getAccountTypeDisplay,
    getCategoryTypeDisplay, getStatusDisplay, getStatusColor,
    validateEmail, validateRequired, formatNumber
} from './utils.js';

// Import page components
import { renderDashboard, refreshData } from './pages/dashboard.js';
import { renderTransactions, applyFilters, clearFilters, changePage } from './pages/transactions.js';
import { renderAccounts } from './pages/accounts.js';
import { renderCategories } from './pages/categories.js';
import { renderBudgets } from './pages/budgets.js';
import { renderGoals } from './pages/goals.js';
import { renderDebts } from './pages/debts.js';
import { renderReserved } from './pages/reserved.js';
import { renderReports } from './pages/reports.js';

// Import modal handlers
import { initModals } from './components/modals.js';

// Import toast system
import { initToasts } from './components/toasts.js';

// Global state for charts
let charts = {};

// Page renderers map
const pageRenderers = {
    dashboard: renderDashboard,
    transactions: renderTransactions,
    accounts: renderAccounts,
    categories: renderCategories,
    budgets: renderBudgets,
    goals: renderGoals,
    debts: renderDebts,
    reserved: renderReserved,
    reports: renderReports
};

// DOM Elements
let elements = {};

// Initialize app
export async function initApp() {
    cacheElements();
    initToasts();
    initModals();
    bindEvents();
    setupHistoryAPI();
    
    // Check auth state
    await checkAuth();
    
    // Handle initial route
    const initialPage = getPageFromHash() || 'dashboard';
    if (store.get('isAuthenticated')) {
        await loadAllData();
        renderPage(initialPage);
    } else {
        showPage('auth-page');
    }
}

// Cache DOM elements
function cacheElements() {
    elements = {
        // Pages
        authPage: document.getElementById('auth-page'),
        mainLayout: document.getElementById('main-layout'),
        
        // Auth forms
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        showRegister: document.getElementById('show-register'),
        showLogin: document.getElementById('show-login'),
        
        // Layout
        sidebar: document.getElementById('sidebar'),
        sidebarOverlay: document.getElementById('sidebar-overlay'),
        mainContent: document.getElementById('main-content'),
        pageContent: document.getElementById('page-content'),
        pageTitle: document.getElementById('page-title'),
        sidebarUsername: document.getElementById('sidebar-username'),
        logoutBtn: document.getElementById('logout-btn'),
        menuToggle: document.getElementById('menu-toggle'),
        quickAddBtn: document.getElementById('quick-add-btn'),
        navItems: document.querySelectorAll('.nav-item'),
        
        // Modals container
        modalContainer: document.getElementById('modal-container')
    };
}

// Bind events
function bindEvents() {
    // Auth form switching
    elements.showRegister?.addEventListener('click', () => switchAuthForm('register'));
    elements.showLogin?.addEventListener('click', () => switchAuthForm('login'));
    
    // Auth form submission
    elements.loginForm?.addEventListener('submit', handleLogin);
    elements.registerForm?.addEventListener('submit', handleRegister);
    
    // Logout
    elements.logoutBtn?.addEventListener('click', handleLogout);
    
    // Navigation - SPA
    elements.navItems?.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Mobile menu
    elements.menuToggle?.addEventListener('click', toggleSidebar);
    elements.sidebarOverlay?.addEventListener('click', closeSidebar);
    
    // Quick add button
    elements.quickAddBtn?.addEventListener('click', () => {
        store.openModal('transaction-modal');
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Close sidebar on resize to desktop
    window.addEventListener('resize', handleResize);
    
    // Store subscriptions
    store.on('isAuthenticated:change', ({ value }) => {
        if (value) {
            showPage('main-layout');
            loadAllData();
            const page = getPageFromHash() || 'dashboard';
            renderPage(page);
        } else {
            showPage('auth-page');
        }
    });
    
    store.on('currentPage:change', ({ value }) => {
        renderPage(value);
        updateActiveNav(value);
        updatePageTitle(value);
    });
    
    store.on('user:change', ({ value }) => {
        if (elements.sidebarUsername) {
            elements.sidebarUsername.textContent = value?.username || '';
        }
    });
    
    // Toast click to dismiss
    document.getElementById('toast-container')?.addEventListener('click', (e) => {
        const toast = e.target.closest('.toast');
        if (toast) {
            store.removeToast(toast.dataset.toastId);
        }
    });
}

// Setup History API for SPA navigation
function setupHistoryAPI() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.page) {
            store.set('currentPage', e.state.page);
        } else {
            const page = getPageFromHash() || 'dashboard';
            store.set('currentPage', page);
        }
    });
    
    // Handle hash changes for direct links
    window.addEventListener('hashchange', () => {
        if (store.get('isAuthenticated')) {
            const page = getPageFromHash() || 'dashboard';
            store.set('currentPage', page);
        }
    });
}

// Handle window resize
function handleResize() {
    if (window.innerWidth >= 768) {
        closeSidebar();
    }
}

// Get current page from URL hash
function getPageFromHash() {
    const hash = window.location.hash.slice(1);
    const validPages = Object.keys(pageRenderers);
    return validPages.includes(hash) ? hash : null;
}

// Update URL without reload
function updateURL(page) {
    const url = `#${page}`;
    if (window.location.hash !== url) {
        history.pushState({ page }, '', url);
    }
}

// Navigation
export function navigateTo(page) {
    if (!pageRenderers[page]) {
        console.warn(`Unknown page: ${page}`);
        return;
    }
    
    // Update store (triggers renderPage via subscription)
    store.set('currentPage', page);
    
    // Update URL without reload
    updateURL(page);
    
    // Close mobile sidebar
    closeSidebar();
}

// Render page content
function renderPage(page) {
    const renderer = pageRenderers[page];
    if (!renderer) return;
    
    // Show loading state
    elements.pageContent.innerHTML = `
        <div class="loading" aria-live="polite">
            <div class="spinner"></div>
            <span class="sr-only">Cargando ${page}...</span>
        </div>
    `;
    
    // Update page title in header
    updatePageTitle(page);
    
    // Render page content
    try {
        renderer(elements.pageContent);
        
        // Announce page change for accessibility
        announcePageChange(page);
    } catch (error) {
        console.error(`Error rendering ${page}:`, error);
        elements.pageContent.innerHTML = `
            <div class="empty-state" role="alert">
                <div class="empty-state-icon">⚠️</div>
                <h3>Error al cargar la página</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="window.navigateTo('${page}')">Reintentar</button>
            </div>
        `;
    }
}

// Update page title in header
function updatePageTitle(page) {
    const titles = {
        dashboard: 'Dashboard',
        transactions: 'Transacciones',
        accounts: 'Cuentas',
        categories: 'Categorías',
        budgets: 'Presupuestos',
        goals: 'Metas de Ahorro',
        debts: 'Deudas',
        reserved: 'Fondos Reservados',
        reports: 'Reportes'
    };
    if (elements.pageTitle) {
        elements.pageTitle.textContent = titles[page] || 'Dashboard';
    }
    document.title = `${titles[page] || 'Dashboard'} | ContabilidadPerson`;
}

// Update active nav item
function updateActiveNav(page) {
    elements.navItems?.forEach(item => {
        const isActive = item.dataset.page === page;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
}

// Announce page change for screen readers
function announcePageChange(page) {
    const titles = {
        dashboard: 'Dashboard',
        transactions: 'Transacciones',
        accounts: 'Cuentas',
        categories: 'Categorías',
        budgets: 'Presupuestos',
        goals: 'Metas de Ahorro',
        debts: 'Deudas',
        reserved: 'Fondos Reservados',
        reports: 'Reportes'
    };
    const announcement = document.createElement('div');
    announcement.className = 'sr-only';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = `Página cargada: ${titles[page] || page}`;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
}

// Show page (auth vs main layout)
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    const page = document.getElementById(pageId);
    if (page) page.classList.remove('hidden');
}

function switchAuthForm(form) {
    const isRegister = form === 'register';
    elements.loginForm.classList.toggle('hidden', isRegister);
    elements.registerForm.classList.toggle('hidden', !isRegister);
}

// Authentication
async function checkAuth() {
    store.set('authLoading', true);
    try {
        const user = await api.getProfile();
        store.setUser(user);
    } catch (error) {
        store.clearAuth();
    } finally {
        store.set('authLoading', false);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Entrando...';
    
    try {
        await api.login(username, password);
        const user = await api.getProfile();
        store.setUser(user);
        store.showSuccess('Bienvenido de nuevo');
        e.target.reset();
    } catch (error) {
        store.showError(error.message || 'Error al iniciar sesión');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Entrar';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        passwordConfirm: formData.get('password_confirm')
    };
    
    // Validate
    const errors = validateRequired(data, ['username', 'email', 'password', 'passwordConfirm']);
    if (data.password !== data.passwordConfirm) {
        errors.passwordConfirm = 'Las contraseñas no coinciden';
    }
    if (!validateEmail(data.email)) {
        errors.email = 'Email inválido';
    }
    
    if (Object.keys(errors).length > 0) {
        const firstError = Object.values(errors)[0];
        store.showError(firstError);
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';
    
    try {
        await api.register(data.username, data.email, data.password, data.passwordConfirm);
        await api.login(data.username, data.password);
        const user = await api.getProfile();
        store.setUser(user);
        store.showSuccess('Cuenta creada exitosamente');
        e.target.reset();
    } catch (error) {
        store.showError(error.message || 'Error al crear cuenta');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear Cuenta';
    }
}

async function handleLogout() {
    try {
        await api.logout();
    } catch (error) {
        console.error('Logout error:', error);
    }
    store.clearAuth();
    store.reset();
    // Navigate to login via hash
    window.location.hash = '';
    showPage('auth-page');
}

// Data loading
async function loadAllData() {
    store.set('loading.accounts', true);
    store.set('loading.transactions', true);
    store.set('loading.categories', true);
    store.set('loading.budgets', true);
    store.set('loading.goals', true);
    store.set('loading.debts', true);
    store.set('loading.reservedFunds', true);
    store.set('loading.summary', true);
    
    try {
        const [
            accounts,
            transactions,
            categories,
            budgets,
            goals,
            debts,
            reservedFunds,
            summary,
            expensesByCategory,
            incomeByCategory
        ] = await Promise.allSettled([
            api.getAccounts(),
            api.getTransactions({ limit: 50 }),
            api.getCategories(),
            api.getBudgets(),
            api.getGoals(),
            api.getDebts(),
            api.getReservedFunds(),
            api.getSummary(),
            api.getExpensesByCategory(),
            api.getIncomeByCategory()
        ]);
        
        if (accounts.status === 'fulfilled') store.set('accounts', accounts.value.accounts || []);
        if (transactions.status === 'fulfilled') store.set('transactions', transactions.value.transactions || []);
        if (categories.status === 'fulfilled') store.set('categories', categories.value.categories || []);
        if (budgets.status === 'fulfilled') store.set('budgets', budgets.value.budgets || []);
        if (goals.status === 'fulfilled') store.set('goals', goals.value.goals || []);
        if (debts.status === 'fulfilled') store.set('debts', debts.value.debts || []);
        if (reservedFunds.status === 'fulfilled') store.set('reservedFunds', reservedFunds.value.funds || []);
        if (summary.status === 'fulfilled') store.set('summary', summary.value);
        if (expensesByCategory.status === 'fulfilled') store.set('expensesByCategory', expensesByCategory.value.categories || []);
        if (incomeByCategory.status === 'fulfilled') store.set('incomeByCategory', incomeByCategory.value.categories || []);
        
    } catch (error) {
        console.error('Error loading data:', error);
        store.showError('Error al cargar datos');
    } finally {
        store.set('loading.accounts', false);
        store.set('loading.transactions', false);
        store.set('loading.categories', false);
        store.set('loading.budgets', false);
        store.set('loading.goals', false);
        store.set('loading.debts', false);
        store.set('loading.reservedFunds', false);
        store.set('loading.summary', false);
    }
}

// Sidebar
function toggleSidebar() {
    const isOpen = store.get('sidebarOpen');
    const newState = !isOpen;
    store.set('sidebarOpen', newState);
    elements.sidebar.classList.toggle('open', newState);
    elements.sidebarOverlay.classList.toggle('visible', newState);
    
    // Trap focus when open
    if (newState) {
        elements.sidebar.querySelector('a, button')?.focus();
    }
}

function closeSidebar() {
    store.set('sidebarOpen', false);
    elements.sidebar.classList.remove('open');
    elements.sidebarOverlay.classList.remove('visible');
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    // ESC to close modals/sidebar
    if (e.key === 'Escape') {
        const openModals = Object.entries(store.get('modals'))
            .filter(([_, m]) => m.open);
        if (openModals.length > 0) {
            store.closeModal(openModals[0][0]);
        } else if (store.get('sidebarOpen')) {
            closeSidebar();
        }
    }
    
    // Ctrl/Cmd + K for quick add
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        store.openModal('transaction-modal');
    }
    
    // Alt + number for navigation
    if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const pages = Object.keys(pageRenderers);
        const index = parseInt(e.key) - 1;
        if (pages[index]) {
            navigateTo(pages[index]);
        }
    }
}

// Global functions for inline handlers
window.navigateTo = navigateTo;
window.store = store;
window.api = api;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatRelativeTime = formatRelativeTime;
window.formatNumber = formatNumber;
window.getTransactionTypeColor = getTransactionTypeColor;
window.getTransactionTypeIcon = getTransactionTypeIcon;
window.getAccountTypeIcon = getAccountTypeIcon;
window.getAccountTypeDisplay = getAccountTypeDisplay;
window.getCategoryTypeDisplay = getCategoryTypeDisplay;
window.getStatusDisplay = getStatusDisplay;
window.getStatusColor = getStatusColor;
window.truncate = truncate;
window.generateId = generateId;
window.selectors = selectors;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.changePage = changePage;
window.refreshData = refreshData;
window.downloadJSON = downloadJSON;

// Auto-init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export { navigateTo, renderPage, loadAllData, store, api };