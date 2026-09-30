/**
 * Categories Page - Full CRUD
 */

import { store } from '../store.js';
import { api } from '../api.js';
import { 
    getCategoryTypeDisplay, truncate
} from '../utils.js';

export function renderCategories(container) {
    const categories = store.get('categories');
    const expenseCategories = categories.filter(c => c.type === 'EXPENSE');
    const incomeCategories = categories.filter(c => c.type === 'INCOME');
    
    container.innerHTML = `
        <!-- Header -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-1);">Categorías</h2>
                <p style="color: var(--color-text-secondary);">${expenseCategories.length} gastos • ${incomeCategories.length} ingresos</p>
            </div>
            <div style="display: flex; gap: var(--space-2);">
                <button class="btn btn-primary" onclick="store.openModal('category-modal', { type: 'EXPENSE' })">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Nuevo Gasto
                </button>
                <button class="btn btn-primary" onclick="store.openModal('category-modal', { type: 'INCOME' })" style="background: var(--color-success); border-color: var(--color-success);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    Nuevo Ingreso
                </button>
            </div>
        </div>

        <!-- Expense Categories -->
        <section style="margin-bottom: var(--space-6);">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-3); color: var(--color-danger);">💸 Categorías de Gasto (${expenseCategories.length})</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-3);">
                ${expenseCategories.length === 0 ? `
                    <div class="card" style="grid-column: 1 / -1; text-align: center; padding: var(--space-8);">
                        <p style="color: var(--color-text-muted);">No hay categorías de gasto</p>
                        <button class="btn btn-primary" onclick="store.openModal('category-modal', { type: 'EXPENSE' })" style="margin-top: var(--space-3);">Crear primera</button>
                    </div>
                ` : expenseCategories.map(category => `
                    <article class="card" style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-4);">
                        <div style="display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0;">
                            <span style="font-size: 1.5rem;">${category.icon || '💸'}</span>
                            <div style="min-width: 0;">
                                <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${category.name}</div>
                                <div style="font-size: 0.75rem; color: var(--color-text-muted);">${category.is_active ? 'Activa' : 'Inactiva'}</div>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-ghost btn-icon" onclick="toggleDropdown(this)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                            </button>
                            <div class="dropdown-menu">
                                <button class="dropdown-item" onclick="editCategory('${category.id}')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    Editar
                                </button>
                                <button class="dropdown-item" onclick="toggleCategoryStatus('${category.id}', ${!category.is_active})">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${category.is_active ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-2.98 0-5.74-.99-7.94-2.66l-1.38-1.38a17.62 17.62 0 0 1 5.66-1.66"></path><path d="M1 1l22 22"></path>' : '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.12 10.12a3 3 0 0 1 4.24-4.24"></path><path d="M2 12l20 20"></path>'}</svg>
                                    ${category.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item danger" onclick="confirmDeleteCategory('${category.id}')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>

        <!-- Income Categories -->
        <section>
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: var(--space-3); color: var(--color-success);">💰 Categorías de Ingreso (${incomeCategories.length})</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-3);">
                ${incomeCategories.length === 0 ? `
                    <div class="card" style="grid-column: 1 / -1; text-align: center; padding: var(--space-8);">
                        <p style="color: var(--color-text-muted);">No hay categorías de ingreso</p>
                        <button class="btn btn-primary" onclick="store.openModal('category-modal', { type: 'INCOME' })" style="margin-top: var(--space-3); background: var(--color-success); border-color: var(--color-success);">Crear primera</button>
                    </div>
                ` : incomeCategories.map(category => `
                    <article class="card" style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-4);">
                        <div style="display: flex; align-items: center; gap: var(--space-3); flex: 1; min-width: 0;">
                            <span style="font-size: 1.5rem;">${category.icon || '💰'}</span>
                            <div style="min-width: 0;">
                                <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${category.name}</div>
                                <div style="font-size: 0.75rem; color: var(--color-text-muted);">${category.is_active ? 'Activa' : 'Inactiva'}</div>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-ghost btn-icon" onclick="toggleDropdown(this)">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                            </button>
                            <div class="dropdown-menu">
                                <button class="dropdown-item" onclick="editCategory('${category.id}')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    Editar
                                </button>
                                <button class="dropdown-item" onclick="toggleCategoryStatus('${category.id}', ${!category.is_active})">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${category.is_active ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-2.98 0-5.74-.99-7.94-2.66l-1.38-1.38a17.62 17.62 0 0 1 5.66-1.66"></path><path d="M1 1l22 22"></path>' : '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M10.12 10.12a3 3 0 0 1 4.24-4.24"></path><path d="M2 12l20 20"></path>'}</svg>
                                    ${category.is_active ? 'Desactivar' : 'Activar'}
                                </button>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item danger" onclick="confirmDeleteCategory('${category.id}')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

// Category CRUD
export async function createCategory(data) {
    try {
        const category = await api.createCategory(data);
        store.push('categories', category);
        store.showSuccess('Categoría creada');
        return category;
    } catch (error) {
        store.showError(error.message || 'Error al crear categoría');
        throw error;
    }
}

export async function updateCategory(id, data) {
    try {
        const category = await api.updateCategory(id, data);
        const index = store.get('categories').findIndex(c => c.id === id);
        if (index !== -1) {
            const categories = [...store.get('categories')];
            categories[index] = category;
            store.set('categories', categories);
        }
        store.showSuccess('Categoría actualizada');
        return category;
    } catch (error) {
        store.showError(error.message || 'Error al actualizar categoría');
        throw error;
    }
}

export async function deleteCategory(id) {
    try {
        await api.deleteCategory(id);
        store.remove('categories', c => c.id === id);
        store.showSuccess('Categoría eliminada');
    } catch (error) {
        store.showError(error.message || 'Error al eliminar categoría');
        throw error;
    }
}

export function editCategory(id) {
    const category = store.get('categories').find(c => c.id === id);
    if (!category) return;
    
    document.getElementById('category-id').value = category.id;
    document.getElementById('category-name').value = category.name;
    document.getElementById('category-type').value = category.type;
    document.getElementById('category-icon').value = category.icon || '';
    document.getElementById('category-active').checked = category.is_active;
    
    document.getElementById('category-modal-title').textContent = 'Editar Categoría';
    store.openModal('category-modal');
}

export async function toggleCategoryStatus(id, isActive) {
    try {
        await updateCategory(id, { is_active: isActive });
    } catch (error) {
        // Error handled in updateCategory
    }
}

export function confirmDeleteCategory(id) {
    store.openModal('confirm-modal', {
        title: 'Eliminar Categoría',
        message: '¿Estás seguro de que quieres eliminar esta categoría? No se podrá deshacer.',
        onConfirm: () => deleteCategory(id)
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

window.toggleCategoryStatus = toggleCategoryStatus;
window.confirmDeleteCategory = confirmDeleteCategory;
window.editCategory = editCategory;