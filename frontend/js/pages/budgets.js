/**
 * Budgets Page - Full CRUD
 */

import { store, selectors } from '../store.js';
import { api } from '../api.js';
import { 
    formatCurrency, formatDate, formatPercent, calculatePercent
} from '../utils.js';

export function renderBudgets(container) {
    const budgets = selectors.activeBudgets();
    const categories = store.get('categories').filter(c => c.type === 'EXPENSE' && c.is_active);
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    container.innerHTML = `
        <!-- Header -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-1);">Presupuestos</h2>
                <p style="color: var(--color-text-secondary);">${budgets.length} presupuestos activos</p>
            </div>
            <button class="btn btn-primary" onclick="store.openModal('budget-modal')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Nuevo Presupuesto
            </button>
        </div>

        <!-- Current Month Indicator -->
        <div class="card" style="margin-bottom: var(--space-4); background: var(--color-primary-light); border-color: var(--color-primary);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3);">
                <div style="display: flex; align-items: center; gap: var(--space-3);">
                    <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: var(--color-primary); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.25rem;">📋</div>
                    <div>
                        <div style="font-weight: 600;">Mes actual: ${formatDate(currentMonth + '-01', 'es-CO', { month: 'long', year: 'numeric' })}</div>
                        <div style="font-size: 0.875rem; color: var(--color-text-secondary);">${budgets.length} presupuestos configurados</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Budgets List -->
        ${budgets.length === 0 ? `
            <div class="card" style="text-align: center; padding: var(--space-12);">
                <div class="empty-state-icon">📋</div>
                <h3>No tienes presupuestos</h3>
                <p>Crea un presupuesto para controlar tus gastos por categoría</p>
                <button class="btn btn-primary" onclick="store.openModal('budget-modal')" style="margin-top: var(--space-3);">Crear Presupuesto</button>
            </div>
        ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4);">
                ${budgets.map(budget => {
                    const spent = budget.spent || 0;
                    const progress = budget.limit_amount > 0 ? (spent / budget.limit_amount) * 100 : 0;
                    const remaining = budget.limit_amount - spent;
                    const isOver = spent > budget.limit_amount;
                    
                    return `
                        <article class="card" style="border-left: 4px solid ${isOver ? 'var(--color-danger)' : progress > 80 ? 'var(--color-warning)' : 'var(--color-primary)'};">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
                                <div style="display: flex; align-items: center; gap: var(--space-3);">
                                    <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: ${isOver ? 'var(--color-danger-light)' : progress > 80 ? 'var(--color-warning-light)' : 'var(--color-primary-light)'}; display: flex; align-items: center; justify-content: center; color: ${isOver ? 'var(--color-danger)' : progress > 80 ? 'var(--color-warning)' : 'var(--color-primary)'};">
                                        📋
                                    </div>
                                    <div>
                                        <div style="font-weight: 600;">${budget.category?.name || 'Sin categoría'}</div>
                                        <div style="font-size: 0.75rem; color: var(--color-text-muted);">Mes ${budget.month}/${budget.year}</div>
                                    </div>
                                </div>
                                <div class="dropdown">
                                    <button class="btn btn-ghost btn-icon" onclick="toggleDropdown(this)">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                                    </button>
                                    <div class="dropdown-menu">
                                        <button class="dropdown-item" onclick="editBudget('${budget.id}')">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            Editar
                                        </button>
                                        <div class="dropdown-divider"></div>
                                        <button class="dropdown-item danger" onclick="confirmDeleteBudget('${budget.id}')">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="margin-bottom: var(--space-3);">
                                <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                                    <span style="font-size: 0.875rem; color: var(--color-text-secondary);">Gastado</span>
                                    <span style="font-weight: 600; color: ${isOver ? 'var(--color-danger)' : 'var(--color-text)'};">
                                        ${formatCurrency(spent)} / ${formatCurrency(budget.limit_amount)}
                                    </span>
                                </div>
                                <div class="progress ${isOver ? 'progress-danger' : progress > 80 ? 'progress-warning' : 'progress-success'}">
                                    <div class="progress-bar" style="width: ${Math.min(progress, 100)}%"></div>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                <span style="color: ${remaining < 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
                                    ${remaining >= 0 ? 'Quedan' : 'Excedido'}: ${formatCurrency(Math.abs(remaining))}
                                </span>
                                <span style="color: var(--color-text-secondary);">${formatPercent(progress, 0)} usado</span>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `}
    `;
}

// Budget CRUD
export async function createBudget(data) {
    try {
        const budget = await api.createBudget(data);
        store.push('budgets', budget);
        store.showSuccess('Presupuesto creado');
        return budget;
    } catch (error) {
        store.showError(error.message || 'Error al crear presupuesto');
        throw error;
    }
}

export async function updateBudget(id, data) {
    try {
        const budget = await api.updateBudget(id, data);
        const index = store.get('budgets').findIndex(b => b.id === id);
        if (index !== -1) {
            const budgets = [...store.get('budgets')];
            budgets[index] = budget;
            store.set('budgets', budgets);
        }
        store.showSuccess('Presupuesto actualizado');
        return budget;
    } catch (error) {
        store.showError(error.message || 'Error al actualizar presupuesto');
        throw error;
    }
}

export async function deleteBudget(id) {
    try {
        await api.deleteBudget(id);
        store.remove('budgets', b => b.id === id);
        store.showSuccess('Presupuesto eliminado');
    } catch (error) {
        store.showError(error.message || 'Error al eliminar presupuesto');
        throw error;
    }
}

export function editBudget(id) {
    const budget = store.get('budgets').find(b => b.id === id);
    if (!budget) return;
    
    document.getElementById('budget-id').value = budget.id;
    document.getElementById('budget-category').value = budget.category_id || '';
    document.getElementById('budget-limit').value = budget.limit_amount;
    document.getElementById('budget-month').value = `${budget.year}-${String(budget.month).padStart(2, '0')}`;
    
    document.getElementById('budget-modal-title').textContent = 'Editar Presupuesto';
    store.openModal('budget-modal');
}

export function confirmDeleteBudget(id) {
    store.openModal('confirm-modal', {
        title: 'Eliminar Presupuesto',
        message: '¿Estás seguro de que quieres eliminar este presupuesto?',
        onConfirm: () => deleteBudget(id)
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

window.editBudget = editBudget;
window.confirmDeleteBudget = confirmDeleteBudget;