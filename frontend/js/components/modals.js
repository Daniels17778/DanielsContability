/**
 * Modal System - Handles all modal interactions
 */

import { store } from '../store.js';
import { api } from '../api.js';
import { formatCurrency } from '../utils.js';

let currentConfirmCallback = null;

export function initModals() {
    // Clone templates into modal container
    const modalContainer = document.getElementById('modal-container');
    const templates = [
        'transaction-modal-template',
        'account-modal-template',
        'category-modal-template',
        'budget-modal-template',
        'goal-modal-template',
        'debt-modal-template',
        'reserved-modal-template',
        'confirm-modal-template'
    ];
    
    templates.forEach(id => {
        const template = document.getElementById(id);
        if (template) {
            const clone = template.content.cloneNode(true);
            modalContainer.appendChild(clone);
        }
    });
    
    // Bind modal events
    bindModalEvents();
    
    // Listen for modal open/close
    store.on('modals:change', ({ key, value }) => {
        const modalName = Object.keys(value).find(k => value[k].open);
        if (modalName) {
            openModalElement(modalName, value[modalName].data);
        } else {
            closeAllModals();
        }
    });
}

function bindModalEvents() {
    // Close buttons
    document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target === el || el.classList.contains('modal-close')) {
                const modal = el.closest('.modal-overlay');
                if (modal) {
                    const name = modal.dataset.modal;
                    store.closeModal(name);
                }
            }
        });
    });
    
    // Form submissions
    bindFormSubmissions();
    
    // Transaction type change
    const typeSelect = document.getElementById('transaction-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            const transferGroup = document.getElementById('transaction-transfer-group');
            const categorySelect = document.getElementById('transaction-category');
            
            if (e.target.value === 'TRANSFER') {
                transferGroup.classList.remove('hidden');
                // For transfers, category is not required
                categorySelect.required = false;
            } else {
                transferGroup.classList.add('hidden');
                categorySelect.required = true;
            }
            
            // Update category options
            updateCategoryOptions(e.target.value);
        });
    }
    
    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal-overlay.visible');
            if (openModals.length > 0) {
                const modal = openModals[openModals.length - 1];
                store.closeModal(modal.dataset.modal);
            }
        }
    });
}

function bindFormSubmissions() {
    // Transaction Form
    const transactionForm = document.getElementById('transaction-form');
    if (transactionForm) {
        transactionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleTransactionSubmit(transactionForm);
        });
    }
    
    // Account Form
    const accountForm = document.getElementById('account-form');
    if (accountForm) {
        accountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleAccountSubmit(accountForm);
        });
    }
    
    // Category Form
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleCategorySubmit(categoryForm);
        });
    }
    
    // Budget Form
    const budgetForm = document.getElementById('budget-form');
    if (budgetForm) {
        budgetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleBudgetSubmit(budgetForm);
        });
    }
    
    // Goal Form
    const goalForm = document.getElementById('goal-form');
    if (goalForm) {
        goalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleGoalSubmit(goalForm);
        });
    }
    
    // Debt Form
    const debtForm = document.getElementById('debt-form');
    if (debtForm) {
        debtForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleDebtSubmit(debtForm);
        });
    }
    
    // Reserved Fund Form
    const reservedForm = document.getElementById('reserved-form');
    if (reservedForm) {
        reservedForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleReservedSubmit(reservedForm);
        });
    }
    
    // Confirm Modal
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');
    
    if (confirmOk) {
        confirmOk.addEventListener('click', () => {
            if (currentConfirmCallback) {
                currentConfirmCallback();
                currentConfirmCallback = null;
            }
            store.closeModal('confirm-modal');
        });
    }
    
    if (confirmCancel) {
        confirmCancel.addEventListener('click', () => {
            currentConfirmCallback = null;
            store.closeModal('confirm-modal');
        });
    }
}

function openModalElement(name, data = {}) {
    const modal = document.querySelector(`.modal-overlay[data-modal="${name}"]`);
    if (!modal) return;
    
    // Populate form with data if provided
    populateForm(name, data);
    
    // Set default date for transaction modal
    if (name === 'transaction-modal') {
        const dateInput = document.getElementById('transaction-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        // Set default month for budget modal
    } else if (name === 'budget-modal') {
        const monthInput = document.getElementById('budget-month');
        if (monthInput && !monthInput.value) {
            monthInput.value = new Date().toISOString().slice(0, 7);
        }
    }
    
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
    
    // Focus first input
    const firstInput = modal.querySelector('input, select, textarea');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay.visible').forEach(modal => {
        modal.classList.remove('visible');
    });
    document.body.style.overflow = '';
}

function populateForm(name, data) {
    // Reset form
    const modal = document.querySelector(`.modal-overlay[data-modal="${name}"]`);
    if (!modal) return;
    
    const form = modal.querySelector('form');
    if (form) form.reset();
    
    // Populate fields
    Object.entries(data).forEach(([key, value]) => {
        const input = modal.querySelector(`[name="${key}"]`) || modal.querySelector(`#${name.replace('-modal', '')}-${key}`);
        if (input) {
            input.value = value;
        }
    });
    
    // Special handling for transaction type
    if (name === 'transaction-modal' && data.type) {
        const typeSelect = modal.querySelector('#transaction-type');
        if (typeSelect) {
            typeSelect.value = data.type;
            typeSelect.dispatchEvent(new Event('change'));
        }
    }
    
    // Special handling for category type
    if (name === 'category-modal' && data.type) {
        const typeSelect = modal.querySelector('#category-type');
        if (typeSelect) {
            typeSelect.value = data.type;
        }
    }
}

function updateCategoryOptions(type) {
    // This will be called from the transaction form
    const categorySelect = document.getElementById('transaction-category');
    if (!categorySelect) return;
    
    // Get categories from store
    const { store } = require('../store.js');
    const categories = store.get('categories').filter(c => c.type === type && c.is_active);
    
    categorySelect.innerHTML = '<option value="">Seleccionar...</option>' +
        categories.map(c => `<option value="${c.id}">${c.icon || ''} ${c.name}</option>`).join('');
}

// Form Handlers
async function handleTransactionSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Convert types
    data.amount = parseFloat(data.amount);
    data.category_id = data.category_id || null;
    data.account_id = data.account_id || null;
    data.transfer_account_id = data.transfer_account_id || null;
    
    // Validate
    if (!data.amount || data.amount <= 0) {
        store.showError('Monto inválido');
        return;
    }
    
    if (!data.account_id) {
        store.showError('Selecciona una cuenta');
        return;
    }
    
    if (data.type !== 'TRANSFER' && !data.category_id) {
        store.showError('Selecciona una categoría');
        return;
    }
    
    if (data.type === 'TRANSFER' && !data.transfer_account_id) {
        store.showError('Selecciona cuenta destino');
        return;
    }
    
    if (data.type === 'TRANSFER' && data.account_id === data.transfer_account_id) {
        store.showError('Las cuentas deben ser diferentes');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        if (data.id) {
            await updateTransaction(data.id, data);
        } else {
            await createTransaction(data);
        }
        store.closeModal('transaction-modal');
    } catch (error) {
        // Error handled in create/update
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
    }
}

async function handleAccountSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    data.balance = parseFloat(data.balance) || 0;
    data.is_active = data.is_active === 'on';
    
    if (!data.name) {
        store.showError('El nombre es obligatorio');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        if (data.id) {
            await updateAccount(data.id, data);
        } else {
            await createAccount(data);
        }
        store.closeModal('account-modal');
    } catch (error) {
        // Error handled
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
    }
}

async function handleCategorySubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    data.is_active = data.is_active === 'on';
    
    if (!data.name) {
        store.showError('El nombre es obligatorio');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        if (data.id) {
            await updateCategory(data.id, data);
        } else {
            await createCategory(data);
        }
        store.closeModal('category-modal');
    } catch (error) {
        // Error handled
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
    }
}

async function handleBudgetSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    data.limit_amount = parseFloat(data.limit_amount);
    data.category_id = data.category_id || null;
    
    if (!data.category_id) {
        store.showError('Selecciona una categoría');
        return;
    }
    
    if (!data.limit_amount || data.limit_amount <= 0) {
        store.showError('Límite inválido');
        return;
    }
    
    if (!data.month) {
        store.showError('Selecciona un mes');
        return;
    }
    
    const [year, month] = data.month.split('-').map(Number);
    data.month = month;
    data.year = year;
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        if (data.id) {
            await updateBudget(data.id, data);
        } else {
            await createBudget(data);
        }
        store.closeModal('budget-modal');
    } catch (error) {
        // Error handled
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
    }
}

async function handleGoalSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    data.target_amount = parseFloat(data.target_amount);
    data.current_amount = parseFloat(data.current_amount) || 0;
    data.is_completed = data.is_completed === 'on';
    
    if (!data.name) {
        store.showError('El nombre es obligatorio');
        return;
    }
    
    if (!data.target_amount || data.target_amount <= 0) {
        store.showError('Monto objetivo inválido');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        if (data.id) {
            await updateGoal(data.id, data);
        } else {
            await createGoal(data);
        }
        store.closeModal('goal-modal');
    } catch (error) {
        // Error handled
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
    }
}

async function handleDebtSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    data.total_amount = parseFloat(data.total_amount);
    data.paid_amount = parseFloat(data.paid_amount) || 0;
    
    if (!data.name) {
        store.showError('El nombre es obligatorio');
        return;
    }
    
    if (!data.total_amount || data.total_amount <= 0) {
        store.showError('Monto total inválido');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        if (data.id) {
            await updateDebt(data.id, data);
        } else {
            await createDebt(data);
        }
        store.closeModal('debt-modal');
    } catch (error) {
        // Error handled
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
    }
}

async function handleReservedSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    data.amount = parseFloat(data.amount);
    data.account_id = data.account_id || null;
    data.is_completed = data.is_completed === 'on';
    
    if (!data.name) {
        store.showError('El nombre es obligatorio');
        return;
    }
    
    if (!data.account_id) {
        store.showError('Selecciona una cuenta');
        return;
    }
    
    if (!data.amount || data.amount <= 0) {
        store.showError('Monto inválido');
        return;
    }
    
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        if (data.id) {
            await updateReservedFund(data.id, data);
        } else {
            await createReservedFund(data);
        }
        store.closeModal('reserved-modal');
    } catch (error) {
        // Error handled
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar';
    }
}

// Confirm modal
export function openConfirmModal({ title, message, onConfirm }) {
    currentConfirmCallback = onConfirm;
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    store.openModal('confirm-modal');
}

// Import store functions
import { 
    createTransaction, updateTransaction,
    createAccount, updateAccount,
    createCategory, updateCategory,
    createBudget, updateBudget,
    createGoal, updateGoal,
    createDebt, updateDebt,
    createReservedFund, updateReservedFund
} from '../store.js';