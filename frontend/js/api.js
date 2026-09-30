/**
 * API Client for ContabilidadPerson
 * Handles all communication with the Django backend
 */

class APIClient {
    constructor() {
        this.baseURL = '/api';
        this.token = null;
        this.csrfToken = this.getCSRFToken();
    }

    getCSRFToken() {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') return value;
        }
        return '';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.csrfToken,
                ...options.headers
            },
            credentials: 'same-origin',
            ...options
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            
            if (response.status === 403) {
                // Refresh CSRF token
                this.csrfToken = this.getCSRFToken();
                config.headers['X-CSRFToken'] = this.csrfToken;
                return this.request(endpoint, options);
            }

            if (response.status === 401) {
                // Redirect to login
                window.location.href = '/frontend/';
                return;
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            if (response.status === 204) {
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // Auth
    async login(username, password) {
        const response = await this.request('/auth/login/', {
            method: 'POST',
            body: { username, password }
        });
        return response;
    }

    async register(username, email, password, passwordConfirm) {
        const response = await this.request('/auth/register/', {
            method: 'POST',
            body: { username, email, password, password_confirm: passwordConfirm }
        });
        return response;
    }

    async logout() {
        return this.request('/auth/logout/', { method: 'POST' });
    }

    async getProfile() {
        return this.request('/auth/profile/');
    }

    // Dashboard
    async getSummary() {
        return this.request('/summary/');
    }

    async getExpensesByCategory() {
        return this.request('/expenses/');
    }

    async getIncomeByCategory() {
        return this.request('/income/');
    }

    // Accounts
    async getAccounts() {
        return this.request('/accounts/');
    }

    async createAccount(data) {
        return this.request('/accounts/', {
            method: 'POST',
            body: data
        });
    }

    async updateAccount(id, data) {
        return this.request(`/accounts/${id}/`, {
            method: 'PUT',
            body: data
        });
    }

    async deleteAccount(id) {
        return this.request(`/accounts/${id}/`, {
            method: 'DELETE'
        });
    }

    // Transactions
    async getTransactions(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/transactions/?${query}`);
    }

    async createTransaction(data) {
        return this.request('/transactions/', {
            method: 'POST',
            body: data
        });
    }

    async updateTransaction(id, data) {
        return this.request(`/transactions/${id}/`, {
            method: 'PUT',
            body: data
        });
    }

    async deleteTransaction(id) {
        return this.request(`/transactions/${id}/`, {
            method: 'DELETE'
        });
    }

    // Categories
    async getCategories() {
        return this.request('/categories/');
    }

    async createCategory(data) {
        return this.request('/categories/', {
            method: 'POST',
            body: data
        });
    }

    async updateCategory(id, data) {
        return this.request(`/categories/${id}/`, {
            method: 'PUT',
            body: data
        });
    }

    async deleteCategory(id) {
        return this.request(`/categories/${id}/`, {
            method: 'DELETE'
        });
    }

    // Budgets
    async getBudgets() {
        return this.request('/budgets/');
    }

    async createBudget(data) {
        return this.request('/budgets/', {
            method: 'POST',
            body: data
        });
    }

    async updateBudget(id, data) {
        return this.request(`/budgets/${id}/`, {
            method: 'PUT',
            body: data
        });
    }

    async deleteBudget(id) {
        return this.request(`/budgets/${id}/`, {
            method: 'DELETE'
        });
    }

    // Savings Goals
    async getGoals() {
        return this.request('/goals/');
    }

    async createGoal(data) {
        return this.request('/goals/', {
            method: 'POST',
            body: data
        });
    }

    async updateGoal(id, data) {
        return this.request(`/goals/${id}/`, {
            method: 'PUT',
            body: data
        });
    }

    async deleteGoal(id) {
        return this.request(`/goals/${id}/`, {
            method: 'DELETE'
        });
    }

    // Debts
    async getDebts() {
        return this.request('/debts/');
    }

    async createDebt(data) {
        return this.request('/debts/', {
            method: 'POST',
            body: data
        });
    }

    async updateDebt(id, data) {
        return this.request(`/debts/${id}/`, {
            method: 'PUT',
            body: data
        });
    }

    async deleteDebt(id) {
        return this.request(`/debts/${id}/`, {
            method: 'DELETE'
        });
    }

    // Reserved Funds
    async getReservedFunds() {
        return this.request('/reserved-funds/');
    }

    async createReservedFund(data) {
        return this.request('/reserved-funds/', {
            method: 'POST',
            body: data
        });
    }

    async updateReservedFund(id, data) {
        return this.request(`/reserved-funds/${id}/`, {
            method: 'PUT',
            body: data
        });
    }

    async deleteReservedFund(id) {
        return this.request(`/reserved-funds/${id}/`, {
            method: 'DELETE'
        });
    }
}

// Export singleton instance
export const api = new APIClient();