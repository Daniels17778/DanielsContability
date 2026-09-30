/**
 * Debts Page - Full CRUD
 */

import { store, selectors } from '../store.js';
import { api } from '../api.js';
import { 
    formatCurrency, formatDate, formatPercent, calculatePercent
} from '../utils.js';

export function renderDebts(container) {
    const activeDebts = selectors.activeDebts();
    const paidDebts = selectors.paidDebts();
    const totalDebt = selectors.totalDebt();
    
    container.innerHTML = `
        <!-- Header -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-1);">Deudas</h2>
                <p style="color: var(--color-text-secondary);">Total pendiente: <strong style="color: var(--color-danger);">${formatCurrency(totalDebt)}</strong></p>
            </div>
            <button class="btn btn-primary" onclick="store.openModal('debt-modal')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Nueva Deuda
            </button>
        </div>

        <!-- Summary Cards -->
        <div class="stats-grid" style="margin-bottom: var(--space-6);">
            <article class="stat-card expense">
                <div class="stat-icon" aria-hidden="true">💳</div>
                <div class="stat-content">
                    <div class="stat-label">Total Deudas</div>
                    <div class="stat-value negative">${formatCurrency(totalDebt)}</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true">⏳</div>
                <div class="stat-content">
                    <div class="stat-label">Pendientes</div>
                    <div class="stat-value">${activeDebts.length}</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true">✅</div>
                <div class="stat-content">
                    <div class="stat-label">Pagadas</div>
                    <div class="stat-value positive">${paidDebts.length}</div>
                </div>
            </article>
        </div>

        <!-- Active Debts -->
        <section style="margin-bottom: var(--space-6);">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-3);">⏳ Deudas Pendientes (${activeDebts.length})</h3>
            ${activeDebts.length === 0 ? `
                <div class="card" style="text-align: center; padding: var(--space-12);">
                    <div class="empty-state-icon">💳</div>
                    <h3>¡Felicidades! Sin deudas pendientes</h3>
                    <p>No tienes deudas registradas o todas están pagadas</p>
                </div>
            ` : `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: var(--space-4);">
                    ${activeDebts.map(debt => {
                        const remaining = debt.total_amount - debt.paid_amount;
                        const progress = debt.total_amount > 0 ? (debt.paid_amount / debt.total_amount) * 100 : 0;
                        const isOverdue = debt.due_date && new Date(debt.due_date) < new Date() && debt.status !== 'PAID';
                        
                        return `
                            <article class="card" style="border-left: 4px solid ${debt.status === 'PARTIAL' ? 'var(--color-warning)' : isOverdue ? 'var(--color-danger)' : 'var(--color-info)'};">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
                                    <div>
                                        <div style="font-weight: 600;">${debt.name}</div>
                                        ${debt.creditor ? `<div style="font-size: 0.75rem; color: var(--color-text-muted);">Acreedor: ${debt.creditor}</div>` : ''}
                                    </div>
                                    <span class="badge" style="background: ${getStatusColor(debt.status)}20; color: ${getStatusColor(debt.status)};">
                                        ${getStatusDisplay(debt.status)}
                                    </span>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">
                                    <span style="font-size: 0.875rem; color: var(--color-text-secondary);">Pendiente</span>
                                    <span style="font-weight: 600; font-size: 1.125rem; color: var(--color-danger);">${formatCurrency(remaining)}</span>
                                </div>
                                
                                <div style="margin-bottom: var(--space-3);">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                                        <span style="font-size: 0.875rem; color: var(--color-text-secondary);">Progreso de pago</span>
                                        <span style="font-weight: 600;">${formatPercent(progress, 1)}</span>
                                    </div>
                                    <div class="progress ${debt.status === 'PARTIAL' ? 'progress-warning' : 'progress-info'}">
                                        <div class="progress-bar" style="width: ${progress}%"></div>
                                    </div>
                                </div>
                                
                                <div style="display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--color-text-secondary);">
                                    <span>Total: ${formatCurrency(debt.total_amount)}</span>
                                    <span>Pagado: ${formatCurrency(debt.paid_amount)}</span>
                                </div>
                                
                                ${debt.due_date ? `
                                    <div style="margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: ${isOverdue ? 'var(--color-danger)' : 'var(--color-text-secondary)'}; font-size: 0.875rem;">
                                            ${isOverdue ? '⚠️ Vencida' : '📅 Vence'} ${formatDate(debt.due_date)}
                                        </span>
                                    </div>
                                ` : ''}
                                
                                <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
                                    <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="makePayment('${debt.id}')">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        Pagar
                                    </button>
                                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="editDebt('${debt.id}')">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                        Editar
                                    </button>
                                </div>
                            </article>
                        `;
                    }).join('')}
                </div>
            `}
        </section>

        <!-- Paid Debts -->
        ${paidDebts.length > 0 ? `
            <section style="margin-top: var(--space-6);">
                <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-3);">✅ Deudas Pagadas (${paidDebts.length})</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: var(--space-4);">
                    ${paidDebts.map(debt => `
                        <article class="card" style="border-left: 4px solid var(--color-success); opacity: 0.8;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                                <div>
                                    <div style="font-weight: 600;">${debt.name}</div>
                                    ${debt.creditor ? `<div style="font-size: 0.75rem; color: var(--color-text-muted);">${debt.creditor}</div>` : ''}
                                </div>
                                <span class="badge badge-success">${getStatusDisplay(debt.status)}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Monto total</span>
                                <span style="font-weight: 600; color: var(--color-success);">${formatCurrency(debt.total_amount)}</span>
                            </div>
                        </article>
                    `).join('')}
                </div>
            </section>
        ` : ''}
    `;
}

// Debt CRUD
export async function createDebt(data) {
    try {
        const debt = await api.createDebt(data);
        store.push('debts', debt);
        store.showSuccess('Deuda creada');
        return debt;
    } catch (error) {
        store.showError(error.message || 'Error al crear deuda');
        throw error;
    }
}

export async function updateDebt(id, data) {
    try {
        const debt = await api.updateDebt(id, data);
        const index = store.get('debts').findIndex(d => d.id === id);
        if (index !== -1) {
            const debts = [...store.get('debts')];
            debts[index] = debt;
            store.set('debts', debts);
        }
        store.showSuccess('Deuda actualizada');
        return debt;
    } catch (error) {
        store.showError(error.message || 'Error al actualizar deuda');
        throw error;
    }
}

export async function deleteDebt(id) {
    try {
        await api.deleteDebt(id);
        store.remove('debts', d => d.id === id);
        store.showSuccess('Deuda eliminada');
    } catch (error) {
        store.showError(error.message || 'Error al eliminar deuda');
        throw error;
    }
}

export function editDebt(id) {
    const debt = store.get('debts').find(d => d.id === id);
    if (!debt) return;
    
    document.getElementById('debt-id').value = debt.id;
    document.getElementById('debt-name').value = debt.name;
    document.getElementById('debt-creditor').value = debt.creditor || '';
    document.getElementById('debt-total').value = debt.total_amount;
    document.getElementById('debt-paid').value = debt.paid_amount;
    document.getElementById('debt-due').value = debt.due_date || '';
    document.getElementById('debt-status').value = debt.status;
    
    document.getElementById('debt-modal-title').textContent = 'Editar Deuda';
    store.openModal('debt-modal');
}

export function makePayment(id) {
    const debt = store.get('debts').find(d => d.id === id);
    if (!debt) return;
    
    const remaining = debt.total_amount - debt.paid_amount;
    const amount = prompt(`Pago para "${debt.name}"\nPendiente: ${formatCurrency(remaining)}\n\n¿Cuánto quieres pagar?`, remaining.toString());
    if (!amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        store.showError('Monto inválido');
        return;
    }
    
    const newPaid = Math.min(debt.paid_amount + numAmount, debt.total_amount);
    const newStatus = newPaid >= debt.total_amount ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'PENDING');
    
    updateDebt(id, { 
        paid_amount: newPaid,
        status: newStatus
    });
}

export function confirmDeleteDebt(id) {
    store.openModal('confirm-modal', {
        title: 'Eliminar Deuda',
        message: '¿Estás seguro de que quieres eliminar esta deuda?',
        onConfirm: () => deleteDebt(id)
    });
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

window.editDebt = editDebt;
window.makePayment = makePayment;
window.confirmDeleteDebt = confirmDeleteDebt;