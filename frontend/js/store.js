/**
 * State Management for ContabilidadPerson Frontend
 * Centralized state with reactive updates
 */

import { EventEmitter } from './events.js';

class Store extends EventEmitter {
    constructor() {
        super();
        this.state = {
            // Auth
            user: null,
            isAuthenticated: false,
            authLoading: false,
            
            // Data
            accounts: [],
            transactions: [],
            categories: [],
            budgets: [],
            goals: [],
            debts: [],
            reservedFunds: [],
            
            // Dashboard
            summary: null,
            expensesByCategory: [],
            incomeByCategory: [],
            
            // UI State
            currentPage: 'dashboard',
            sidebarOpen: false,
            modals: {},
            toasts: [],
            
            // Filters
            transactionFilters: {
                type: '',
                category: '',
                account: '',
                startDate: '',
                endDate: '',
                search: '',
                page: 1,
                limit: 20
            },
            
            // Loading states
            loading: {
                accounts: false,
                transactions: false,
                categories: false,
                budgets: false,
                goals: false,
                debts: false,
                reservedFunds: false,
                summary: false
            },
            
            // Errors
            errors: {}
        };
    }

    // Getters
    get(key) {
        return this.getNested(key);
    }

    getNested(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    // Setters
    set(key, value) {
        const oldValue = this.getNested(key);
        this.setNested(key, value);
        this.emit('change', { key, value, oldValue });
        this.emit(`${key}:change`, { value, oldValue });
    }

    setNested(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, this.state);
        target[lastKey] = value;
    }

    // Update nested object
    update(key, partial) {
        const current = this.getNested(key) || {};
        this.set(key, { ...current, ...partial });
    }

    // Array mutations
    push(key, item) {
        const arr = this.getNested(key) || [];
        this.set(key, [...arr, item]);
    }

    remove(key, predicate) {
        const arr = this.getNested(key) || [];
        this.set(key, arr.filter(item => !predicate(item)));
    }

    find(key, predicate) {
        const arr = this.getNested(key) || [];
        return arr.find(predicate);
    }

    findIndex(key, predicate) {
        const arr = this.getNested(key) || [];
        return arr.findIndex(predicate);
    }

    // Auth methods
    setUser(user) {
        this.set('user', user);
        this.set('isAuthenticated', !!user);
    }

    clearAuth() {
        this.set('user', null);
        this.set('isAuthenticated', false);
    }

    // Toast management
    addToast(toast) {
        const id = Date.now().toString(36) + Math.random().toString(36).substr(2);
        const newToast = { id, ...toast };
        this.set('toasts', [...this.get('toasts'), newToast]);
        
        // Auto-remove after duration
        const duration = toast.duration || 5000;
        setTimeout(() => this.removeToast(id), duration);
        
        return id;
    }

    removeToast(id) {
        this.set('toasts', this.get('toasts').filter(t => t.id !== id));
    }

    showSuccess(message, duration) {
        return this.addToast({ type: 'success', message, duration });
    }

    showError(message, duration) {
        return this.addToast({ type: 'error', message, duration });
    }

    showWarning(message, duration) {
        return this.addToast({ type: 'warning', message, duration });
    }

    showInfo(message, duration) {
        return this.addToast({ type: 'info', message, duration });
    }

    // Modal management
    openModal(name, data = {}) {
        this.update('modals', { [name]: { open: true, data } });
        document.body.style.overflow = 'hidden';
    }

    closeModal(name) {
        this.update('modals', { [name]: { open: false, data: {} } });
        if (Object.values(this.get('modals')).every(m => !m.open)) {
            document.body.style.overflow = '';
        }
    }

    // Loading states
    setLoading(key, loading) {
        this.update('loading', { [key]: loading });
    }

    // Error handling
    setError(key, error) {
        this.update('errors', { [key]: error });
    }

    clearError(key) {
        const errors = { ...this.get('errors') };
        delete errors[key];
        this.set('errors', errors);
    }

    // Reset store
    reset() {
        this.state = {
            user: null,
            isAuthenticated: false,
            authLoading: false,
            accounts: [],
            transactions: [],
            categories: [],
            budgets: [],
            goals: [],
            debts: [],
            reservedFunds: [],
            summary: null,
            expensesByCategory: [],
            incomeByCategory: [],
            currentPage: 'dashboard',
            sidebarOpen: false,
            modals: {},
            toasts: [],
            transactionFilters: {
                type: '',
                category: '',
                account: '',
                startDate: '',
                endDate: '',
                search: '',
                page: 1,
                limit: 20
            },
            loading: {},
            errors: {}
        };
        this.emit('reset');
    }
}

// Event Emitter
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, callback) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    }

    emit(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event ${event}:`, error);
            }
        });
    }
}

// Create singleton store
export const store = new Store();

// Helper to subscribe to store changes in components
export function useStore(keys, callback) {
    const unsubscribers = keys.map(key => store.on(`${key}:change`, callback));
    return () => unsubscribers.forEach(unsub => unsub());
}

// Computed values
export const selectors = {
    // Accounts
    activeAccounts: () => store.get('accounts').filter(a => a.is_active),
    totalBalance: () => store.get('accounts')
        .filter(a => a.is_active)
        .reduce((sum, a) => sum + (a.balance || 0), 0),
    
    // Transactions
    filteredTransactions: () => {
        const transactions = store.get('transactions');
        const filters = store.get('transactionFilters');
        
        return transactions.filter(t => {
            if (filters.type && t.type !== filters.type) return false;
            if (filters.category && t.category_id !== filters.category) return false;
            if (filters.account && t.account_id !== filters.account) return false;
            if (filters.startDate && t.date < filters.startDate) return false;
            if (filters.endDate && t.date > filters.endDate) return false;
            if (filters.search) {
                const search = filters.search.toLowerCase();
                const desc = (t.description || '').toLowerCase();
                const cat = (t.category?.name || '').toLowerCase();
                const acc = (t.account?.name || '').toLowerCase();
                if (!desc.includes(search) && !cat.includes(search) && !acc.includes(search)) return false;
            }
            return true;
        });
    },
    
    // Categories
    expenseCategories: () => store.get('categories').filter(c => c.type === 'EXPENSE' && c.is_active),
    incomeCategories: () => store.get('categories').filter(c => c.type === 'INCOME' && c.is_active),
    
    // Budgets
    activeBudgets: () => store.get('budgets').filter(b => {
        const now = new Date();
        const budgetDate = new Date(b.year, b.month - 1);
        return budgetDate >= new Date(now.getFullYear(), now.getMonth(), 1);
    }),
    
    // Goals
    activeGoals: () => store.get('goals').filter(g => !g.is_completed),
    completedGoals: () => store.get('goals').filter(g => g.is_completed),
    
    // Debts
    activeDebts: () => store.get('debts').filter(d => d.status !== 'PAID'),
    paidDebts: () => store.get('debts').filter(d => d.status === 'PAID'),
    
    // Reserved Funds
    activeReservedFunds: () => store.get('reservedFunds').filter(f => !f.is_completed),
    
    // Dashboard
    monthlyIncome: () => store.get('summary')?.income || 0,
    monthlyExpenses: () => store.get('summary')?.expenses || 0,
    monthlyBalance: () => (store.get('summary')?.income || 0) - (store.get('summary')?.expenses || 0),
    totalDebt: () => store.get('debts')
        .filter(d => d.status !== 'PAID')
        .reduce((sum, d) => sum + (d.total_amount - d.paid_amount), 0),
    totalReserved: () => store.get('reservedFunds')
        .filter(f => !f.is_completed)
        .reduce((sum, f) => sum + (f.amount || 0), 0),
    
    // Chart data
    expenseChartData: () => store.get('expensesByCategory'),
    incomeChartData: () => store.get('incomeByCategory')
};