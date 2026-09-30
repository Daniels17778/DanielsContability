/**
 * Savings Goals Page - Full CRUD
 */

import { store, selectors } from '../store.js';
import { api } from '../api.js';
import { 
    formatCurrency, formatDate, formatPercent, calculatePercent
} from '../utils.js';

export function renderGoals(container) {
    const activeGoals = selectors.activeGoals();
    const completedGoals = selectors.completedGoals();
    
    container.innerHTML = `
        <!-- Header -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-1);">Metas de Ahorro</h2>
                <p style="color: var(--color-text-secondary);">${activeGoals.length} activas • ${completedGoals.length} completadas</p>
            </div>
            <button class="btn btn-primary" onclick="store.openModal('goal-modal')">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Nueva Meta
            </button>
        </div>

        <!-- Active Goals -->
        <section style="margin-bottom: var(--space-6);">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-3);">🎯 Metas en Progreso (${activeGoals.length})</h3>
            ${activeGoals.length === 0 ? `
                <div class="card" style="text-align: center; padding: var(--space-12);">
                    <div class="empty-state-icon">🎯</div>
                    <h3>No tienes metas de ahorro</h3>
                    <p>Crea una meta para motivarte a ahorrar</p>
                    <button class="btn btn-primary" onclick="store.openModal('goal-modal')" style="margin-top: var(--space-3);">Crear Meta</button>
                </div>
            ` : `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4);">
                    ${activeGoals.map(goal => {
                        const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
                        const remaining = goal.target_amount - goal.current_amount;
                        const isCompleted = progress >= 100;
                        
                        return `
                            <article class="card ${isCompleted ? 'completed' : ''}" style="${isCompleted ? 'border-left: 4px solid var(--color-success);' : ''}">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
                                    <div style="display: flex; align-items: center; gap: var(--space-3);">
                                        <div style="width: 48px; height: 48px; border-radius: var(--radius-md); background: ${isCompleted ? 'var(--color-success-light)' : 'var(--color-primary-light)'}; display: flex; align-items: center; justify-content: center; color: ${isCompleted ? 'var(--color-success)' : 'var(--color-primary)'};">
                                            ${isCompleted ? '✅' : '🎯'}
                                        </div>
                                        <div>
                                            <div style="font-weight: 600;">${goal.name}</div>
                                            ${goal.deadline ? `<div style="font-size: 0.75rem; color: var(--color-text-muted);">Vence: ${formatDate(goal.deadline)}</div>` : ''}
                                        </div>
                                    </div>
                                    <div class="dropdown">
                                        <button class="btn btn-ghost btn-icon" onclick="toggleDropdown(this)">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                                        </button>
                                        <div class="dropdown-menu">
                                            <button class="dropdown-item" onclick="editGoal('${goal.id}')">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                Editar
                                            </button>
                                            ${!isCompleted ? `
                                                <button class="dropdown-item" onclick="addToGoal('${goal.id}')">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                                    Aportar
                                                </button>
                                            ` : ''}
                                            <button class="dropdown-item" onclick="toggleGoalComplete('${goal.id}')">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${isCompleted ? '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M9 16l3 3 7-7"></path>' : '<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9.01"></line><line x1="15" y1="9" x2="15.01" y2="9.01"></line>'}</svg>
                                                ${isCompleted ? 'Marcar pendiente' : 'Marcar completa'}
                                            </button>
                                            <div class="dropdown-divider"></div>
                                            <button class="dropdown-item danger" onclick="confirmDeleteGoal('${goal.id}')">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div style="margin-bottom: var(--space-3);">
                                <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                                    <span style="font-size: 0.875rem; color: var(--color-text-secondary);">Progreso</span>
                                    <span style="font-weight: 600;">${formatPercent(progress, 1)}</span>
                                </div>
                                <div class="progress ${isCompleted ? 'progress-success' : progress > 75 ? 'progress-warning' : ''}">
                                    <div class="progress-bar" style="width: ${Math.min(progress, 100)}%"></div>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                <div>
                                    <div style="font-weight: 600;">${formatCurrency(goal.current_amount)}</div>
                                    <div style="font-size: 0.75rem; color: var(--color-text-secondary);">de ${formatCurrency(goal.target_amount)}</div>
                                </div>
                                <div style="text-align: right;">
                                    <div style="color: ${remaining <= 0 ? 'var(--color-success)' : 'var(--color-text-secondary)'};">
                                        ${remaining > 0 ? `Faltan ${formatCurrency(remaining)}` : '¡Completada!'}
                                    </div>
                                    <div style="font-size: 0.75rem; color: var(--color-text-muted);">${formatPercent(progress, 0)} completado</div>
                                </div>
                            </div>
                            
                            ${!isCompleted ? `
                                <button class="btn btn-primary btn-block" style="margin-top: var(--space-3);" onclick="addToGoal('${goal.id}')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    Aportar a esta meta
                                </button>
                            ` : ''}
                        </article>
                    `;
                    }).join('')}
                </div>
            `}
        </section>

        <!-- Completed Goals -->
        ${completedGoals.length > 0 ? `
            <section>
                <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-3);">✅ Metas Completadas (${completedGoals.length})</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-4);">
                    ${completedGoals.map(goal => `
                        <article class="card completed" style="border-left: 4px solid var(--color-success); opacity: 0.8;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                                <div>
                                    <div style="font-weight: 600;">${goal.name}</div>
                                    <div style="font-size: 0.75rem; color: var(--color-text-muted);">${goal.deadline ? `Vencía: ${formatDate(goal.deadline)}` : 'Sin fecha límite'}</div>
                                </div>
                                <span class="badge badge-success">Completada</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 0.875rem;">
                                <span>${formatCurrency(goal.current_amount)}</span>
                                <span style="color: var(--color-success); font-weight: 600;">¡Meta lograda!</span>
                            </div>
                        </article>
                    `).join('')}
                </div>
            </section>
        ` : ''}
    `;
}

// Goals CRUD
export async function createGoal(data) {
    try {
        const goal = await api.createGoal(data);
        store.push('goals', goal);
        store.showSuccess('Meta creada');
        return goal;
    } catch (error) {
        store.showError(error.message || 'Error al crear meta');
        throw error;
    }
}

export async function updateGoal(id, data) {
    try {
        const goal = await api.updateGoal(id, data);
        const index = store.get('goals').findIndex(g => g.id === id);
        if (index !== -1) {
            const goals = [...store.get('goals')];
            goals[index] = goal;
            store.set('goals', goals);
        }
        store.showSuccess('Meta actualizada');
        return goal;
    } catch (error) {
        store.showError(error.message || 'Error al actualizar meta');
        throw error;
    }
}

export async function deleteGoal(id) {
    try {
        await api.deleteGoal(id);
        store.remove('goals', g => g.id === id);
        store.showSuccess('Meta eliminada');
    } catch (error) {
        store.showError(error.message || 'Error al eliminar meta');
        throw error;
    }
}

export function editGoal(id) {
    const goal = store.get('goals').find(g => g.id === id);
    if (!goal) return;
    
    document.getElementById('goal-id').value = goal.id;
    document.getElementById('goal-name').value = goal.name;
    document.getElementById('goal-target').value = goal.target_amount;
    document.getElementById('goal-current').value = goal.current_amount;
    document.getElementById('goal-deadline').value = goal.deadline || '';
    
    document.getElementById('goal-modal-title').textContent = 'Editar Meta';
    store.openModal('goal-modal');
}

export function addToGoal(id) {
    const goal = store.get('goals').find(g => g.id === id);
    if (!goal) return;
    
    const amount = prompt(`¿Cuánto quieres aportar a "${goal.name}"?\nFaltan: ${formatCurrency(goal.target_amount - goal.current_amount)}`, '');
    if (!amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        store.showError('Monto inválido');
        return;
    }
    
    updateGoal(id, { current_amount: goal.current_amount + numAmount });
}

export async function toggleGoalComplete(id) {
    const goal = store.get('goals').find(g => g.id === id);
    if (!goal) return;
    
    const isCompleted = goal.current_amount >= goal.target_amount;
    await updateGoal(id, { 
        is_completed: !isCompleted,
        current_amount: !isCompleted ? goal.target_amount : goal.current_amount
    });
}

export function confirmDeleteGoal(id) {
    store.openModal('confirm-modal', {
        title: 'Eliminar Meta',
        message: '¿Estás seguro de que quieres eliminar esta meta de ahorro?',
        onConfirm: () => deleteGoal(id)
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

window.editGoal = editGoal;
window.addToGoal = addToGoal;
window.toggleGoalComplete = toggleGoalComplete;
window.confirmDeleteGoal = confirmDeleteGoal;