/**
 * Accounts Page - Full CRUD
 */

import { store, selectors } from '../store.js';
import { api } from '../api.js';
import { 
    formatCurrency, formatDate, getAccountTypeIcon, 
    getAccountTypeDisplay, truncate
} from '../utils.js';

export function renderAccounts(container) {
    const accounts = selectors.activeAccounts();
    
    container.innerHTML = `
        <!-- Header -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-1);">Cuentas</h2>
                <p style="color: var(--color-text-secondary);">${accounts.length} cuentas • Saldo total: ${formatCurrency(selectors.totalBalance())}</p>
            </div>
            <button class="btn btn-primary" onclick="store.openModal('account-modal')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Nueva Cuenta
            </button>
        </div>

        <!-- Accounts Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4);">
            ${accounts.map(account => `
                <article class="card" style="transition: transform var(--transition-fast), box-shadow var(--transition-fast);">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-4);">
                        <div style="display: flex; align-items: center; gap: var(--space-3);">
                            <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--color-primary-light); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--color-primary);">
                                ${getAccountTypeIcon(account.account_type)}
                            </div>
                            <div>
                                <h3 style="font-weight: 600;">${account.name}</h3>
                                <span class="badge badge-neutral">${getAccountTypeDisplay(account.account_type)}</span>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-ghost btn-icon" onclick="toggleDropdown(this)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                            </button>
                            <div class="dropdown-menu">
                                <button class="dropdown-item" onclick="editAccount('${account.id}')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    Editar
                                </button>
                                <button class="dropdown-item" onclick="toggleAccountStatus('${account.id}', ${!account.is_active})">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${account.is_active ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-2.98 0-5.74-.99-7.94-2.66l-1.38-1.38a17.62 17.62 0 0 1 5.66-1.66"></path><path d="M1 1l22 22"></path>' : '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.12 10.12a3 3 0 0 1 4.24-4.24"></path><path d="M2 12l20 20"></path>'}</svg>
                                    ${account.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item danger" onclick="confirmDeleteAccount('${account.id}')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-4);">
                        <div style="font-size: 2rem; font-weight: 700; color: ${account.balance < 0 ? 'var(--color-danger)' : 'var(--color-text)'};">
                            ${formatCurrency(account.balance)}
                        </div>
                        <span class="badge ${account.is_active ? 'badge-success' : 'badge-neutral'}">
                            ${account.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                    </div>
                    <div style="padding-top: var(--space-4); border-top: 1px solid var(--color-border); display: flex; gap: var(--space-2);">
                        <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="viewAccountTransactions('${account.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            Ver movimientos
                        </button>
                        <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="quickTransaction('${account.id}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Nuevo movimiento
                        </button>
                    </div>
                </article>
            `).join('')}
            
            ${accounts.length === 0 ? `
                <div class="card" style="grid-column: 1 / -1; text-align: center; padding: var(--space-12);">
                    <div class="empty-state-icon">🏦</div>
                    <h3>No tienes cuentas configuradas</h3>
                    <p>Crea tu primera cuenta para empezar a registrar tus finanzas</p>
                    <button class="btn btn-primary" onclick="store.openModal('account-modal')" style="margin-top: var(--space-3);">Crear Cuenta</button>
                </div>
            ` : ''}
        </div>
    `;
}

// Account CRUD
export async function createAccount(data) {
    try {
        const account = await api.createAccount(data);
        store.push('accounts', account);
        store.showSuccess('Cuenta creada');
        return account;
    } catch (error) {
        store.showError(error.message || 'Error al crear cuenta');
        throw error;
    }
}

export async function updateAccount(id, data) {
    try {
        const account = await api.updateAccount(id, data);
        const index = store.get('accounts').findIndex(a => a.id === id);
        if (index !== -1) {
            const accounts = [...store.get('accounts')];
            accounts[index] = account;
            store.set('accounts', accounts);
        }
        store.showSuccess('Cuenta actualizada');
        return account;
    } catch (error) {
        store.showError(error.message || 'Error al actualizar cuenta');
        throw error;
    }
}

export async function deleteAccount(id) {
    try {
        await api.deleteAccount(id);
        store.remove('accounts', a => a.id === id);
        store.showSuccess('Cuenta eliminada');
    } catch (error) {
        store.showError(error.message || 'Error al eliminar cuenta');
        throw error;
    }
}

export function editAccount(id) {
    const account = store.get('accounts').find(a => a.id === id);
    if (!account) return;
    
    document.getElementById('account-id').value = account.id;
    document.getElementById('account-name').value = account.name;
    document.getElementById('account-type').value = account.account_type;
    document.getElementById('account-balance').value = account.balance;
    document.getElementById('account-active').checked = account.is_active;
    
    document.getElementById('account-modal-title').textContent = 'Editar Cuenta';
    store.openModal('account-modal');
}

export async function toggleAccountStatus(id, isActive) {
    try {
        await updateAccount(id, { is_active: isActive });
    } catch (error) {
        // Error handled in updateAccount
    }
}

export function confirmDeleteAccount(id) {
    store.openModal('confirm-modal', {
        title: 'Eliminar Cuenta',
        message: '¿Estás seguro de que quieres eliminar esta cuenta? Se eliminarán también todas sus transacciones.',
        onConfirm: () => deleteAccount(id)
    });
}

export function viewAccountTransactions(id) {
    navigateTo('transactions');
    setTimeout(() => {
        const filter = document.getElementById('filter-account');
        if (filter) {
            filter.value = id;
            applyFilters();
        }
    }, 100);
}

export function quickTransaction(id) {
    store.openModal('transaction-modal', { accountId: id });
}

window.toggleDropdown = function(btn) {
    const dropdown = btn.closest('.dropdown');
    dropdown.classList.toggle('open');
    document.querySelectorAll('.dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
    });
    const closeOnClick = (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
            document.removeEventListener('click', closeOnClick);
        }
    };
    setTimeout(() => document.addEventListener('click', closeOnClick), 0);
};

window.toggleAccountStatus = toggleAccountStatus;
window.confirmDeleteAccount = confirmDeleteAccount;
window.editAccount = editAccount;
window.viewAccountTransactions = viewAccountTransactions;
window.quickTransaction = quickTransaction;