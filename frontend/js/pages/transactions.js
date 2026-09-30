/**
 * Transactions Page - Full CRUD with filters
 */

import { store, selectors } from '../store.js';
import { api } from '../api.js';
import { 
    formatCurrency, formatDate, formatRelativeTime,
    getTransactionTypeIcon, getTransactionTypeColor,
    getAccountTypeIcon, truncate, debounce, generateId
} from '../utils.js';

let currentPage = 1;
const pageSize = 20;

export function renderTransactions(container) {
    const transactions = selectors.filteredTransactions();
    const categories = store.get('categories');
    const accounts = selectors.activeAccounts();
    const filters = store.get('transactionFilters');
    
    // Pagination
    const totalPages = Math.ceil(transactions.length / pageSize);
    const paginatedTransactions = transactions.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );
    
    container.innerHTML = `
        <!-- Header with Filters -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-1);">Transacciones</h2>
                <p style="color: var(--color-text-secondary);">${transactions.length} transacciones</p>
            </div>
            <button class="btn btn-primary" onclick="store.openModal('transaction-modal')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Nueva Transacción
            </button>
        </div>

        <!-- Filters Bar -->
        <div class="filters-bar" id="filters-bar">
            <div class="filter-group" style="flex: 1; min-width: 200px;">
                <label for="filter-search">Buscar</label>
                <input type="text" id="filter-search" placeholder="Descripción, categoría, cuenta..." 
                    value="${filters.search}" style="flex: 1;">
            </div>
            <div class="filter-group">
                <label for="filter-type">Tipo</label>
                <select id="filter-type" value="${filters.type}">
                    <option value="">Todos</option>
                    <option value="INCOME">💰 Ingreso</option>
                    <option value="EXPENSE">💸 Gasto</option>
                    <option value="TRANSFER">🔄 Transferencia</option>
                </select>
            </div>
            <div class="filter-group">
                <label for="filter-category">Categoría</label>
                <select id="filter-category" value="${filters.category}">
                    <option value="">Todas</option>
                    ${categories.map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('')}
                </select>
            </div>
            <div class="filter-group">
                <label for="filter-account">Cuenta</label>
                <select id="filter-account" value="${filters.account}">
                    <option value="">Todas</option>
                    ${accounts.map(a => `<option value="${a.id}">${getAccountTypeIcon(a.account_type)} ${a.name}</option>`).join('')}
                </select>
            </div>
            <div class="filter-group">
                <label for="filter-start">Desde</label>
                <input type="date" id="filter-start" value="${filters.startDate}">
            </div>
            <div class="filter-group">
                <label for="filter-end">Hasta</label>
                <input type="date" id="filter-end" value="${filters.endDate}">
            </div>
            <button class="btn btn-secondary" onclick="clearFilters()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Limpiar
            </button>
        </div>

        <!-- Transactions Table -->
        <div class="card" style="overflow: hidden;">
            ${paginatedTransactions.length === 0 ? `
                <div class="empty-state" style="padding: var(--space-12);">
                    <div class="empty-state-icon">📋</div>
                    <h3>${transactions.length === 0 ? 'No hay transacciones' : 'No coinciden con los filtros'}</h3>
                    <p>${transactions.length === 0 ? 'Registra tu primer movimiento' : 'Intenta ajustar los filtros'}</p>
                    <button class="btn btn-primary" onclick="store.openModal('transaction-modal')" style="margin-top: var(--space-3);">
                        ${transactions.length === 0 ? 'Nueva Transacción' : 'Limpiar filtros'}
                    </button>
                </div>
            ` : `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="width: 100px;">Fecha</th>
                                <th style="width: 120px;">Tipo</th>
                                <th>Categoría</th>
                                <th>Cuenta</th>
                                <th style="width: 140px;">Monto</th>
                                <th>Descripción</th>
                                <th style="width: 80px;">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paginatedTransactions.map(tx => `
                                <tr data-id="${tx.id}">
                                    <td>${formatDate(tx.date)}</td>
                                    <td>
                                        <span class="badge" style="background: ${getTransactionTypeColor(tx.type)}20; color: ${getTransactionTypeColor(tx.type)};">
                                            ${getTransactionTypeIcon(tx.type)} ${getCategoryTypeDisplay(tx.type)}
                                        </span>
                                    </td>
                                    <td>${tx.category?.name || '<span style="color: var(--color-text-muted);">-</span>'}</td>
                                    <td>${tx.account?.name || '<span style="color: var(--color-text-muted);">-</span>'}</td>
                                    <td style="font-weight: 600; color: ${getTransactionTypeColor(tx.type)}; font-family: monospace;">
                                        ${tx.type === 'EXPENSE' ? '-' : '+'}${formatCurrency(tx.amount)}
                                    </td>
                                    <td>${truncate(tx.description, 50) || '<span style="color: var(--color-text-muted);">-</span>'}</td>
                                    <td>
                                        <div class="dropdown">
                                            <button class="btn btn-ghost btn-icon" onclick="toggleDropdown(this)">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                                            </button>
                                            <div class="dropdown-menu">
                                                <button class="dropdown-item" onclick="editTransaction('${tx.id}')">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    Editar
                                                </button>
                                                <button class="dropdown-item danger" onclick="confirmDeleteTransaction('${tx.id}')">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                <!-- Pagination -->
                ${totalPages > 1 ? `
                    <div class="card-footer" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
                        <div style="color: var(--color-text-secondary); font-size: 0.875rem;">
                            Página ${currentPage} de ${totalPages} · ${transactions.length} transacciones
                        </div>
                        <div style="display: flex; gap: var(--space-2);">
                            <button class="btn btn-secondary btn-sm" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
                            </button>
                            <button class="btn btn-secondary btn-sm" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>
                ` : ''}
            `}
        </div>
    `;

    // Bind filter events
    bindFilterEvents();
}

function bindFilterEvents() {
    const debouncedFilter = debounce(applyFilters, 300);
    
    document.getElementById('filter-search')?.addEventListener('input', debouncedFilter);
    document.getElementById('filter-type')?.addEventListener('change', applyFilters);
    document.getElementById('filter-category')?.addEventListener('change', applyFilters);
    document.getElementById('filter-account')?.addEventListener('change', applyFilters);
    document.getElementById('filter-start')?.addEventListener('change', applyFilters);
    document.getElementById('filter-end')?.addEventListener('change', applyFilters);
}

function applyFilters() {
    const filters = {
        search: document.getElementById('filter-search')?.value || '',
        type: document.getElementById('filter-type')?.value || '',
        category: document.getElementById('filter-category')?.value || '',
        account: document.getElementById('filter-account')?.value || '',
        startDate: document.getElementById('filter-start')?.value || '',
        endDate: document.getElementById('filter-end')?.value || ''
    };
    
    store.update('transactionFilters', filters);
    currentPage = 1;
    renderTransactions(document.getElementById('page-content'));
}

function clearFilters() {
    store.set('transactionFilters', {
        type: '',
        category: '',
        account: '',
        startDate: '',
        endDate: '',
        search: '',
        page: 1,
        limit: 20
    });
    currentPage = 1;
    renderTransactions(document.getElementById('page-content'));
}

function changePage(page) {
    currentPage = page;
    renderTransactions(document.getElementById('page-content'));
}

// Transaction CRUD
export async function createTransaction(data) {
    try {
        const transaction = await api.createTransaction(data);
        store.push('transactions', transaction);
        store.showSuccess('Transacción creada');
        return transaction;
    } catch (error) {
        store.showError(error.message || 'Error al crear transacción');
        throw error;
    }
}

export async function updateTransaction(id, data) {
    try {
        const transaction = await api.updateTransaction(id, data);
        const index = store.get('transactions').findIndex(t => t.id === id);
        if (index !== -1) {
            const transactions = [...store.get('transactions')];
            transactions[index] = transaction;
            store.set('transactions', transactions);
        }
        store.showSuccess('Transacción actualizada');
        return transaction;
    } catch (error) {
        store.showError(error.message || 'Error al actualizar transacción');
        throw error;
    }
}

export async function deleteTransaction(id) {
    try {
        await api.deleteTransaction(id);
        store.remove('transactions', t => t.id === id);
        store.showSuccess('Transacción eliminada');
    } catch (error) {
        store.showError(error.message || 'Error al eliminar transacción');
        throw error;
    }
}

export function editTransaction(id) {
    const transaction = store.get('transactions').find(t => t.id === id);
    if (!transaction) return;
    
    // Populate modal
    document.getElementById('transaction-id').value = transaction.id;
    document.getElementById('transaction-type').value = transaction.type;
    document.getElementById('transaction-amount').value = transaction.amount;
    document.getElementById('transaction-category').value = transaction.category_id || '';
    document.getElementById('transaction-account').value = transaction.account_id || '';
    document.getElementById('transaction-date').value = transaction.date;
    document.getElementById('transaction-description').value = transaction.description || '';
    
    // Handle transfer
    const transferGroup = document.getElementById('transaction-transfer-group');
    if (transaction.type === 'TRANSFER') {
        transferGroup.classList.remove('hidden');
        document.getElementById('transaction-transfer-account').value = transaction.transfer_account_id || '';
    } else {
        transferGroup.classList.add('hidden');
    }
    
    // Update modal title
    document.getElementById('transaction-modal-title').textContent = 'Editar Transacción';
    
    // Update category options based on type
    updateCategoryOptions(transaction.type);
    
    store.openModal('transaction-modal');
}

function updateCategoryOptions(type) {
    const categorySelect = document.getElementById('transaction-category');
    const categories = store.get('categories').filter(c => c.type === type && c.is_active);
    
    categorySelect.innerHTML = '<option value="">Seleccionar...</option>' +
        categories.map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('');
}

export function confirmDeleteTransaction(id) {
    store.openModal('confirm-modal', {
        title: 'Eliminar Transacción',
        message: '¿Estás seguro de que quieres eliminar esta transacción? Esta acción no se puede deshacer.',
        onConfirm: () => deleteTransaction(id)
    });
}

window.toggleDropdown = function(btn) {
    const dropdown = btn.closest('.dropdown');
    dropdown.classList.toggle('open');
    
    // Close other dropdowns
    document.querySelectorAll('.dropdown').forEach(d => {
        if (d !== dropdown) d.classList.remove('open');
    });
    
    // Close on outside click
    const closeOnClick = (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('open');
            document.removeEventListener('click', closeOnClick);
        }
    };
    setTimeout(() => document.addEventListener('click', closeOnClick), 0);
};

window.editTransaction = editTransaction;
window.confirmDeleteTransaction = confirmDeleteTransaction;
window.clearFilters = clearFilters;
window.changePage = changePage;
window.applyFilters = applyFilters;
window.createTransaction = createTransaction;
window.updateTransaction = updateTransaction;
window.deleteTransaction = deleteTransaction;