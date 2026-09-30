/**
 * Dashboard Page - Main financial overview
 */

import { store, selectors } from '../store.js';
import { api } from '../api.js';
import { 
    formatCurrency, formatDate, formatNumber,
    getTransactionTypeIcon, getTransactionTypeColor,
    getAccountTypeIcon, truncate
} from '../utils.js';

let charts = { expenses: null, income: null };

export function renderDashboard(container) {
    const summary = store.get('summary');
    const accounts = selectors.activeAccounts();
    const recentTransactions = selectors.filteredTransactions().slice(0, 5);
    const activeGoals = selectors.activeGoals();
    const activeDebts = selectors.activeDebts();
    const activeReserved = selectors.activeReservedFunds();
    const activeBudgets = selectors.activeBudgets();
    
    const monthlyIncome = selectors.monthlyIncome();
    const monthlyExpenses = selectors.monthlyExpenses();
    const monthlyBalance = selectors.monthlyBalance();
    const totalBalance = selectors.totalBalance();
    const totalDebt = selectors.totalDebt();
    const totalReserved = selectors.totalReserved();
    
    container.innerHTML = `
        <!-- Stats Cards -->
        <div class="stats-grid" role="region" aria-label="Resumen financiero">
            <article class="stat-card income">
                <div class="stat-icon" aria-hidden="true">💰</div>
                <div class="stat-content">
                    <div class="stat-label">Ingresos del mes</div>
                    <div class="stat-value positive">${formatCurrency(monthlyIncome)}</div>
                </div>
            </article>
            <article class="stat-card expense">
                <div class="stat-icon" aria-hidden="true">💸</div>
                <div class="stat-content">
                    <div class="stat-label">Gastos del mes</div>
                    <div class="stat-value negative">${formatCurrency(monthlyExpenses)}</div>
                </div>
            </article>
            <article class="stat-card balance ${monthlyBalance < 0 ? 'negative' : ''}">
                <div class="stat-icon" aria-hidden="true">📈</div>
                <div class="stat-content">
                    <div class="stat-label">Balance del mes</div>
                    <div class="stat-value ${monthlyBalance < 0 ? 'negative' : 'positive'}">${formatCurrency(monthlyBalance)}</div>
                </div>
            </article>
            <article class="stat-card total">
                <div class="stat-icon" aria-hidden="true">🏦</div>
                <div class="stat-content">
                    <div class="stat-label">Saldo total</div>
                    <div class="stat-value">${formatCurrency(totalBalance)}</div>
                </div>
            </article>
        </div>

        <!-- Charts Section -->
        <section class="charts-section" aria-label="Gráficos financieros">
            <div class="charts-grid">
                <article class="chart-card">
                    <header class="chart-header">
                        <h3>📊 Gastos por categoría</h3>
                    </header>
                    <div class="chart-container">
                        <canvas id="expenses-chart" aria-label="Gráfico de gastos por categoría"></canvas>
                    </div>
                    ${selectors.expenseChartData().length === 0 ? `
                        <div class="empty-state" style="padding: var(--space-8);">
                            <div class="empty-state-icon">📊</div>
                            <h3>No hay gastos este mes</h3>
                            <p>Registra tu primer gasto para ver el gráfico</p>
                        </div>
                    ` : ''}
                </article>
                <article class="chart-card">
                    <header class="chart-header">
                        <h3>📈 Ingresos por categoría</h3>
                    </header>
                    <div class="chart-container">
                        <canvas id="income-chart" aria-label="Gráfico de ingresos por categoría"></canvas>
                    </div>
                    ${selectors.incomeChartData().length === 0 ? `
                        <div class="empty-state" style="padding: var(--space-8);">
                            <div class="empty-state-icon">📈</div>
                            <h3>No hay ingresos este mes</h3>
                            <p>Registra tu primer ingreso para ver el gráfico</p>
                        </div>
                    ` : ''}
                </article>
            </div>
        </section>

        <!-- Quick Actions -->
        <section class="quick-actions" style="margin-bottom: var(--space-6);">
            <div class="card" style="padding: var(--space-4);">
                <div style="display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between;">
                    <div style="display: flex; flex-wrap: wrap; gap: var(--space-2);">
                        <button class="btn btn-primary" onclick="store.openModal('transaction-modal')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Nueva Transacción
                        </button>
                        <button class="btn btn-secondary" onclick="navigateTo('accounts')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>
                            Gestionar Cuentas
                        </button>
                        <button class="btn btn-secondary" onclick="navigateTo('goals')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                            Metas de Ahorro
                        </button>
                        <button class="btn btn-secondary" onclick="navigateTo('budgets')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                            Presupuestos
                        </button>
                    </div>
                    <div style="display: flex; gap: var(--space-2);">
                        <button class="btn btn-secondary" onclick="refreshData()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            Actualizar
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Main Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--space-4);">
            <!-- Accounts -->
            <section class="card">
                <header class="card-header">
                    <h3>🏦 Cuentas</h3>
                    <button class="btn btn-secondary btn-sm" onclick="navigateTo('accounts')">Ver todas</button>
                </header>
                <div class="card-body" style="padding: 0;">
                    ${accounts.length === 0 ? `
                        <div class="empty-state" style="padding: var(--space-8);">
                            <div class="empty-state-icon">🏦</div>
                            <h3>No tienes cuentas</h3>
                            <p>Crea tu primera cuenta para empezar</p>
                            <button class="btn btn-primary" onclick="store.openModal('account-modal')" style="margin-top: var(--space-3);">Crear Cuenta</button>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column;">
                            ${accounts.map(account => `
                                <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); border-bottom: 1px solid var(--color-border);">
                                    <div style="display: flex; align-items: center; gap: var(--space-3);">
                                        <span style="font-size: 1.5rem;">${getAccountTypeIcon(account.account_type)}</span>
                                        <div>
                                            <div style="font-weight: 500;">${account.name}</div>
                                            <div style="font-size: 0.75rem; color: var(--color-text-muted);">${getAccountTypeDisplay(account.account_type)}</div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-weight: 600; font-size: 1.125rem;">${formatCurrency(account.balance)}</div>
                                        <div style="font-size: 0.75rem; color: var(--color-text-muted);">${account.is_active ? 'Activa' : 'Inactiva'}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </section>

            <!-- Goals & Debts -->
            <section class="card">
                <header class="card-header">
                    <h3>🎯 Metas de Ahorro</h3>
                    <button class="btn btn-secondary btn-sm" onclick="navigateTo('goals')">Ver todas</button>
                </header>
                <div class="card-body" style="padding: 0;">
                    ${activeGoals.length === 0 ? `
                        <div class="empty-state" style="padding: var(--space-8);">
                            <div class="empty-state-icon">🎯</div>
                            <h3>Sin metas de ahorro</h3>
                            <p>Crea una meta para motivarte a ahorrar</p>
                            <button class="btn btn-primary" onclick="store.openModal('goal-modal')" style="margin-top: var(--space-3);">Crear Meta</button>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column;">
                            ${activeGoals.slice(0, 3).map(goal => {
                                const progress = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
                                return `
                                    <div style="padding: var(--space-4); border-bottom: 1px solid var(--color-border);">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">
                                            <div style="font-weight: 500;">${goal.name}</div>
                                            <div style="font-size: 0.875rem; color: var(--color-text-secondary);">${formatCurrency(goal.current_amount)} / ${formatCurrency(goal.target_amount)}</div>
                                        </div>
                                        <div class="progress" style="height: 6px;">
                                            <div class="progress-bar progress-success" style="width: ${Math.min(progress, 100)}%"></div>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; margin-top: var(--space-2); font-size: 0.75rem; color: var(--color-text-muted);">
                                            <span>${formatPercent(progress, 0)} completado</span>
                                            ${goal.deadline ? `<span>Vence: ${formatDate(goal.deadline)}</span>` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </section>
        </div>

        <!-- Second Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);">
            <!-- Debts -->
            <section class="card">
                <header class="card-header">
                    <h3>💳 Deudas (${formatCurrency(totalDebt)})</h3>
                    <button class="btn btn-secondary btn-sm" onclick="navigateTo('debts')">Ver todas</button>
                </header>
                <div class="card-body" style="padding: 0;">
                    ${activeDebts.length === 0 ? `
                        <div class="empty-state" style="padding: var(--space-8);">
                            <div class="empty-state-icon">💳</div>
                            <h3>Sin deudas pendientes</h3>
                            <p>¡Excelente! No tienes deudas registradas</p>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column;">
                            ${activeDebts.slice(0, 3).map(debt => {
                                const remaining = debt.total_amount - debt.paid_amount;
                                const progress = debt.total_amount > 0 ? (debt.paid_amount / debt.total_amount) * 100 : 0;
                                return `
                                    <div style="padding: var(--space-4); border-bottom: 1px solid var(--color-border);">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">
                                            <div style="font-weight: 500;">${debt.name}</div>
                                            <span class="badge" style="background: ${getStatusColor(debt.status)}20; color: ${getStatusColor(debt.status)};">${getStatusDisplay(debt.status)}</span>
                                        </div>
                                        <div style="font-size: 0.875rem; color: var(--color-text-secondary); margin-bottom: var(--space-2);">
                                            ${formatCurrency(remaining)} restantes de ${formatCurrency(debt.total_amount)}
                                        </div>
                                        <div class="progress ${progress > 50 ? 'progress-success' : progress > 25 ? 'progress-warning' : 'progress-danger'}">
                                            <div class="progress-bar" style="width: ${progress}%"></div>
                                        </div>
                                        ${debt.due_date ? `<div style="margin-top: var(--space-2); font-size: 0.75rem; color: var(--color-text-muted);">Vence: ${formatDate(debt.due_date)}</div>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </section>

            <!-- Reserved Funds -->
            <section class="card">
                <header class="card-header">
                    <h3>🏦 Fondos Reservados (${formatCurrency(totalReserved)})</h3>
                    <button class="btn btn-secondary btn-sm" onclick="navigateTo('reserved')">Ver todos</button>
                </header>
                <div class="card-body" style="padding: 0;">
                    ${activeReserved.length === 0 ? `
                        <div class="empty-state" style="padding: var(--space-8);">
                            <div class="empty-state-icon">🏦</div>
                            <h3>Sin fondos reservados</h3>
                            <p>Reserva dinero para gastos futuros</p>
                            <button class="btn btn-primary" onclick="store.openModal('reserved-modal')" style="margin-top: var(--space-3);">Crear Fondo</button>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column;">
                            ${activeReserved.slice(0, 3).map(fund => `
                                <div style="padding: var(--space-4); border-bottom: 1px solid var(--color-border);">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-1);">
                                        <div style="font-weight: 500;">${fund.name}</div>
                                        <div style="font-weight: 600;">${formatCurrency(fund.amount)}</div>
                                    </div>
                                    <div style="font-size: 0.875rem; color: var(--color-text-secondary);">
                                        ${fund.account_name || fund.account?.name || 'Cuenta'}
                                        ${fund.deadline ? ` • Vence: ${formatDate(fund.deadline)}` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </section>
        </div>

        <!-- Recent Transactions -->
        <section class="card" style="margin-top: var(--space-4);">
            <header class="card-header">
                <h3>📋 Últimos Movimientos</h3>
                <button class="btn btn-secondary btn-sm" onclick="navigateTo('transactions')">Ver todas</button>
            </header>
            <div class="card-body" style="padding: 0;">
                ${recentTransactions.length === 0 ? `
                    <div class="empty-state" style="padding: var(--space-8);">
                        <div class="empty-state-icon">📋</div>
                        <h3>No hay transacciones</h3>
                        <p>Registra tu primer movimiento</p>
                        <button class="btn btn-primary" onclick="store.openModal('transaction-modal')" style="margin-top: var(--space-3);">Nueva Transacción</button>
                    </div>
                ` : `
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Tipo</th>
                                    <th>Categoría</th>
                                    <th>Cuenta</th>
                                    <th>Monto</th>
                                    <th>Descripción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${recentTransactions.map(tx => `
                                    <tr>
                                        <td>${formatDate(tx.date)}</td>
                                        <td>
                                            <span class="badge" style="background: ${getTransactionTypeColor(tx.type)}20; color: ${getTransactionTypeColor(tx.type)};">
                                                ${getTransactionTypeIcon(tx.type)} ${getCategoryTypeDisplay(tx.type)}
                                            </span>
                                        </td>
                                        <td>${tx.category?.name || '-'}</td>
                                        <td>${tx.account?.name || '-'}</td>
                                        <td style="font-weight: 600; color: ${getTransactionTypeColor(tx.type)};">
                                            ${tx.type === 'EXPENSE' ? '-' : '+'}${formatCurrency(tx.amount)}
                                        </td>
                                        <td>${truncate(tx.description, 40)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        </section>
    `;

    // Initialize charts after DOM is ready
    setTimeout(() => initCharts(), 0);
}

function initCharts() {
    // Expenses Chart
    const expensesCtx = document.getElementById('expenses-chart');
    if (expensesCtx && selectors.expenseChartData().length > 0) {
        if (charts.expenses) charts.expenses.destroy();
        
        const data = selectors.expenseChartData();
        charts.expenses = new Chart(expensesCtx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.category),
                datasets: [{
                    data: data.map(d => d.total),
                    backgroundColor: [
                        '#ef4444', '#f97316', '#f59e0b', '#eab308',
                        '#84cc16', '#22c55e', '#10b981', '#14b8a6',
                        '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
                        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
                    ],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'right', 
                        labels: { 
                            boxWidth: 12, 
                            padding: 12,
                            font: { size: 11 }
                        } 
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // Income Chart
    const incomeCtx = document.getElementById('income-chart');
    if (incomeCtx && selectors.incomeChartData().length > 0) {
        if (charts.income) charts.income.destroy();
        
        const data = selectors.incomeChartData();
        charts.income = new Chart(incomeCtx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.category),
                datasets: [{
                    data: data.map(d => d.total),
                    backgroundColor: [
                        '#22c55e', '#16a34a', '#15803d', '#166534',
                        '#10b981', '#059669', '#047857', '#065f46'
                    ],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        position: 'right', 
                        labels: { 
                            boxWidth: 12, 
                            padding: 12,
                            font: { size: 11 }
                        } 
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }
}

// Listen for data changes to update charts
store.on('expensesByCategory:change', initCharts);
store.on('incomeByCategory:change', initCharts);
store.on('summary:change', initCharts);

export function refreshData() {
    loadAllData().then(() => {
        store.showSuccess('Datos actualizados');
    });
}