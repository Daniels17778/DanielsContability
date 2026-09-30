/**
 * Reserved Funds Page - Full CRUD
 */

import { store, selectors } from '../store.js';
import { api } from '../api.js';
import { 
    formatCurrency, formatDate, formatPercent, calculatePercent
} from '../utils.js';

export function renderReserved(container) {
    const activeReserved = selectors.activeReservedFunds();
    const completedReserved = store.get('reservedFunds').filter(f => f.is_completed);
    const totalReserved = selectors.totalReserved();
    
    container.innerHTML = `
        <!-- Header -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-1);">Fondos Reservados</h2>
                <p style="color: var(--color-text-secondary);">Total reservado: <strong>${formatCurrency(totalReserved)}</strong></p>
            </div>
            <button class="btn btn-primary" onclick="store.openModal('reserved-modal')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Nuevo Fondo
            </button>
        </div>

        <!-- Summary -->
        <div class="stats-grid" style="margin-bottom: var(--space-6);">
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true">🏦</div>
                <div class="stat-content">
                    <div class="stat-label">Total Reservado</div>
                    <div class="stat-value">${formatCurrency(totalReserved)}</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true">⏳</div>
                <div class="stat-content">
                    <div class="stat-label">Activos</div>
                    <div class="stat-value">${activeReserved.length}</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true">✅</div>
                <div class="stat-content">
                    <div class="stat-label">Completados</div>
                    <div class="stat-value positive">${completedReserved.length}</div>
                </div>
            </article>
        </div>

        <!-- Active Reserved Funds -->
        <section style="margin-bottom: var(--space-6);">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-3);">🏦 Fondos Activos (${activeReserved.length})</h3>
            ${activeReserved.length === 0 ? `
                <div class="card" style="text-align: center; padding: var(--space-12);">
                    <div class="empty-state-icon">🏦</div>
                    <h3>No tienes fondos reservados</h3>
                    <p>Reserva dinero para gastos futuros planificados</p>
                    <button class="btn btn-primary" onclick="store.openModal('reserved-modal')" style="margin-top: var(--space-3);">Crear Fondo</button>
                </div>
            ` : `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4);">
                    ${activeReserved.map(fund => {
                        const isOverdue = fund.deadline && new Date(fund.deadline) < new Date() && !fund.is_completed;
                        
                        return `
                            <article class="card" style="border-left: 4px solid ${isOverdue ? 'var(--color-danger)' : 'var(--color-info)'};">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
                                    <div>
                                        <div style="font-weight: 600;">${fund.name}</div>
                                        ${fund.purpose ? `<div style="font-size: 0.875rem; color: var(--color-text-secondary);">${truncate(fund.purpose, 50)}</div>` : ''}
                                    </div>
                                    <span class="badge badge-info">Activo</span>
                                </div>
                                
                                <div style="margin-bottom: var(--space-3);">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                                        <span style="font-size: 0.875rem; color: var(--color-text-secondary);">Monto</span>
                                        <span style="font-weight: 600; font-size: 1.125rem;">${formatCurrency(fund.amount)}</span>
                                    </div>
                                </div>
                                
                                <div style="font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: var(--space-3);">
                                    <span>Cuenta: ${fund.account?.name || fund.account_name || '-'}</span>
                                </div>
                                
                                ${fund.deadline ? `
                                    <div style="padding-top: var(--space-3); border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: ${isOverdue ? 'var(--color-danger)' : 'var(--color-text-secondary)'}; font-size: 0.875rem;">
                                            ${isOverdue ? '⚠️ Vencido' : '📅 Vence'} ${formatDate(fund.deadline)}
                                        </span>
                                    </div>
                                ` : ''}
                                
                                <div style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
                                    <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="completeReserved('${fund.id}')">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        Completar
                                    </button>
                                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="editReserved('${fund.id}')">
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

        <!-- Completed Reserved Funds -->
        ${completedReserved.length > 0 ? `
            <section>
                <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-3);">✅ Fondos Completados (${completedReserved.length})</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4);">
                    ${completedReserved.map(fund => `
                        <article class="card" style="border-left: 4px solid var(--color-success); opacity: 0.8;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                                <div>
                                    <div style="font-weight: 600;">${fund.name}</div>
                                    ${fund.purpose ? `<div style="font-size: 0.75rem; color: var(--color-text-muted);">${truncate(fund.purpose, 50)}</div>` : ''}
                                </div>
                                <span class="badge badge-success">Completado</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                <span>${formatCurrency(fund.amount)}</span>
                                <span style="color: var(--color-success); font-weight: 600;">Liberado</span>
                            </div>
                        </article>
                    `).join('')}
                </div>
            </section>
        ` : ''}
    `;
}

// Reserved Funds CRUD
export async function createReservedFund(data) {
    try {
        const fund = await api.createReservedFund(data);
        store.push('reservedFunds', fund);
        store.showSuccess('Fondo reservado creado');
        return fund;
    } catch (error) {
        store.showError(error.message || 'Error al crear fondo');
        throw error;
    }
}

export async function updateReservedFund(id, data) {
    try {
        const fund = await api.updateReservedFund(id, data);
        const index = store.get('reservedFunds').findIndex(f => f.id === id);
        if (index !== -1) {
            const funds = [...store.get('reservedFunds')];
            funds[index] = fund;
            store.set('reservedFunds', funds);
        }
        store.showSuccess('Fondo actualizado');
        return fund;
    } catch (error) {
        store.showError(error.message || 'Error al actualizar fondo');
        throw error;
    }
}

export async function deleteReservedFund(id) {
    try {
        await api.deleteReservedFund(id);
        store.remove('reservedFunds', f => f.id === id);
        store.showSuccess('Fondo eliminado');
    } catch (error) {
        store.showError(error.message || 'Error al eliminar fondo');
        throw error;
    }
}

export function editReserved(id) {
    const fund = store.get('reservedFunds').find(f => f.id === id);
    if (!fund) return;
    
    document.getElementById('reserved-id').value = fund.id;
    document.getElementById('reserved-name').value = fund.name;
    document.getElementById('reserved-account').value = fund.account_id || fund.account?.id || '';
    document.getElementById('reserved-amount').value = fund.amount;
    document.getElementById('reserved-purpose').value = fund.purpose || '';
    document.getElementById('reserved-deadline').value = fund.deadline || '';
    document.getElementById('reserved-completed').checked = fund.is_completed;
    
    document.getElementById('reserved-modal-title').textContent = 'Editar Fondo';
    store.openModal('reserved-modal');
}

export async function completeReserved(id) {
    const fund = store.get('reservedFunds').find(f => f.id === id);
    if (!fund) return;
    
    try {
        await updateReservedFund(id, { is_completed: true });
        store.showSuccess('Fondo completado y dinero liberado');
    } catch (error) {
        store.showError(error.message || 'Error al completar fondo');
    }
}

export function confirmDeleteReserved(id) {
    store.openModal('confirm-modal', {
        title: 'Eliminar Fondo Reservado',
        message: '¿Estás seguro de que quieres eliminar este fondo? El dinero volverá a la cuenta.',
        onConfirm: () => deleteReservedFund(id)
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

window.editReserved = editReserved;
window.completeReserved = completeReserved;
window.confirmDeleteReserved = confirmDeleteReserved;