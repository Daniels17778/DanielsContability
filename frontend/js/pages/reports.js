/**
 * Reports Page - Analytics and visualizations
 */

import { store, selectors } from '../store.js';
import { api } from '../api.js';
import { 
    formatCurrency, formatDate, formatNumber, formatPercent,
    getTransactionTypeColor, getTransactionTypeIcon
} from '../utils.js';

let charts = { 
    monthlyTrend: null,
    categoryBreakdown: null,
    incomeVsExpense: null,
    accountDistribution: null
};

export function renderReports(container) {
    const summary = store.get('summary');
    const transactions = selectors.filteredTransactions();
    const accounts = selectors.activeAccounts();
    const categories = store.get('categories');
    const expensesByCategory = selectors.expenseChartData();
    const incomeByCategory = selectors.incomeChartData();
    
    // Calculate additional metrics
    const totalIncome = selectors.monthlyIncome();
    const totalExpenses = selectors.monthlyExpenses();
    const totalBalance = selectors.monthlyBalance();
    const avgTransaction = transactions.length > 0 ? 
        transactions.reduce((sum, t) => sum + (t.type === 'INCOME' ? t.amount : -t.amount), 0) / transactions.length : 0;
    const savingsRate = totalIncome > 0 ? (totalBalance / totalIncome) * 100 : 0;
    
    container.innerHTML = `
        <!-- Header -->
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
            <div>
                <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: var(--space-1);">Reportes y Análisis</h2>
                <p style="color: var(--color-text-secondary);">Visualiza tu salud financiera</p>
            </div>
            <div style="display: flex; gap: var(--space-2);">
                <select id="report-period" class="btn btn-secondary" style="padding: var(--space-2) var(--space-3);">
                    <option value="current">Mes actual</option>
                    <option value="last">Mes pasado</option>
                    <option value="quarter">Último trimestre</option>
                    <option value="year">Año actual</option>
                    <option value="all">Todo el historial</option>
                </select>
                <button class="btn btn-primary" onclick="downloadReport()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar
                </button>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="stats-grid" style="margin-bottom: var(--space-6);">
            <article class="stat-card income">
                <div class="stat-icon" aria-hidden="true">💰</div>
                <div class="stat-content">
                    <div class="stat-label">Ingresos Totales</div>
                    <div class="stat-value positive">${formatCurrency(totalIncome)}</div>
                </div>
            </article>
            <article class="stat-card expense">
                <div class="stat-icon" aria-hidden="true">💸</div>
                <div class="stat-content">
                    <div class="stat-label">Gastos Totales</div>
                    <div class="stat-value negative">${formatCurrency(totalExpenses)}</div>
                </div>
            </article>
            <article class="stat-card balance ${totalBalance < 0 ? 'negative' : ''}">
                <div class="stat-icon" aria-hidden="true">📈</div>
                <div class="stat-content">
                    <div class="stat-label">Balance Neto</div>
                    <div class="stat-value ${totalBalance < 0 ? 'negative' : 'positive'}">${formatCurrency(totalBalance)}</div>
                </div>
            </article>
            <article class="stat-card ${savingsRate >= 20 ? 'positive' : savingsRate >= 10 ? 'warning' : ''}">
                <div class="stat-icon" aria-hidden="true">💎</div>
                <div class="stat-content">
                    <div class="stat-label">Tasa de Ahorro</div>
                    <div class="stat-value">${formatPercent(savingsRate, 1)}</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true">📊</div>
                <div class="stat-content">
                    <div class="stat-label">Promedio/Transacción</div>
                    <div class="stat-value">${formatCurrency(avgTransaction)}</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true">📝</div>
                <div class="stat-content">
                    <div class="stat-label">Total Movimientos</div>
                    <div class="stat-value">${formatNumber(transactions.length)}</div>
                </div>
            </article>
        </div>

        <!-- Charts Row 1 -->
        <section class="charts-section" style="margin-bottom: var(--space-6);">
            <div class="charts-grid">
                <article class="chart-card">
                    <header class="chart-header">
                        <h3>📈 Tendencia Mensual</h3>
                    </header>
                    <div class="chart-container">
                        <canvas id="monthly-trend-chart" aria-label="Tendencia de ingresos y gastos por mes"></canvas>
                    </div>
                </article>
                <article class="chart-card">
                    <header class="chart-header">
                        <h3>⚖️ Ingresos vs Gastos</h3>
                    </header>
                    <div class="chart-container">
                        <canvas id="income-expense-chart" aria-label="Comparativa ingresos vs gastos"></canvas>
                    </div>
                </article>
            </div>
        </section>

        <!-- Charts Row 2 -->
        <section class="charts-section" style="margin-bottom: var(--space-6);">
            <div class="charts-grid">
                <article class="chart-card">
                    <header class="chart-header">
                        <h3>🏷️ Gastos por Categoría</h3>
                    </header>
                    <div class="chart-container">
                        <canvas id="category-breakdown-chart" aria-label="Desglose de gastos por categoría"></canvas>
                    </div>
                </article>
                <article class="chart-card">
                    <header class="chart-header">
                        <h3>🏦 Distribución por Cuenta</h3>
                    </header>
                    <div class="chart-container">
                        <canvas id="account-distribution-chart" aria-label="Distribución de saldo por cuenta"></canvas>
                    </div>
                </article>
            </div>
        </section>

        <!-- Detailed Tables -->
        <section style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: var(--space-4);">
            <!-- Top Expenses -->
            <article class="card">
                <header class="card-header">
                    <h3>🔝 Top 10 Gastos</h3>
                </header>
                <div class="card-body" style="padding: 0;">
                    ${transactions.length === 0 ? `
                        <div class="empty-state" style="padding: var(--space-8);">
                            <p>No hay transacciones para analizar</p>
                        </div>
                    ` : `
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Fecha</th>
                                        <th>Descripción</th>
                                        <th>Categoría</th>
                                        <th>Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${transactions
                                        .filter(t => t.type === 'EXPENSE')
                                        .sort((a, b) => b.amount - a.amount)
                                        .slice(0, 10)
                                        .map((tx, i) => `
                                            <tr>
                                                <td style="font-weight: 600; color: var(--color-primary);">${i + 1}</td>
                                                <td>${formatDate(tx.date)}</td>
                                                <td>${truncate(tx.description, 30) || '-'}</td>
                                                <td>${tx.category?.name || '-'}</td>
                                                <td style="color: var(--color-danger); font-weight: 600;">${formatCurrency(tx.amount)}</td>
                                            </tr>
                                        `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </article>

            <!-- Category Summary -->
            <article class="card">
                <header class="card-header">
                    <h3>📋 Resumen por Categoría</h3>
                </header>
                <div class="card-body" style="padding: 0;">
                    ${expensesByCategory.length === 0 ? `
                        <div class="empty-state" style="padding: var(--space-8);">
                            <p>No hay datos de categorías</p>
                        </div>
                    ` : `
                        <div style="max-height: 400px; overflow-y: auto;">
                            ${expensesByCategory.map((cat, i) => {
                                const percentage = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                                return `
                                    <div style="display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border);">
                                        <span style="font-weight: 600; color: var(--color-primary); min-width: 30px;">${i + 1}</span>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.category}</div>
                                            <div class="progress" style="height: 4px; margin-top: 2px;">
                                                <div class="progress-bar progress-danger" style="width: ${percentage}%"></div>
                                            </div>
                                        </div>
                                        <div style="text-align: right; min-width: 120px;">
                                            <div style="font-weight: 600; color: var(--color-danger);">${formatCurrency(cat.total)}</div>
                                            <div style="font-size: 0.75rem; color: var(--color-text-muted);">${formatPercent(percentage, 1)}</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </article>
        </section>
    `;

    // Initialize charts
    setTimeout(() => initCharts(), 0);
    
    // Period change listener
    document.getElementById('report-period')?.addEventListener('change', (e) => {
        loadReportData(e.target.value);
    });
}

async function loadReportData(period) {
    // In a real app, this would fetch data for the selected period
    // For now, we'll just refresh the current data
    store.showInfo(`Cargando datos para: ${period}`);
}

function initCharts() {
    const monthlyTrendCtx = document.getElementById('monthly-trend-chart');
    const incomeExpenseCtx = document.getElementById('income-expense-chart');
    const categoryBreakdownCtx = document.getElementById('category-breakdown-chart');
    const accountDistributionCtx = document.getElementById('account-distribution-chart');
    
    const expensesByCategory = selectors.expenseChartData();
    const incomeByCategory = selectors.incomeChartData();
    const accounts = selectors.activeAccounts();
    const transactions = selectors.filteredTransactions();
    
    // Monthly Trend Chart (mock data for demo)
    if (monthlyTrendCtx) {
        if (charts.monthlyTrend) charts.monthlyTrend.destroy();
        
        // Generate last 6 months data
        const months = [];
        const incomeData = [];
        const expenseData = [];
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(date.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }));
            
            // Filter transactions for this month
            const monthTx = transactions.filter(t => {
                const txDate = new Date(t.date);
                return txDate.getMonth() === date.getMonth() && txDate.getFullYear() === date.getFullYear();
            });
            
            const income = monthTx.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
            const expense = monthTx.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
            
            incomeData.push(income);
            expenseData.push(expense);
        }
        
        charts.monthlyTrend = new Chart(monthlyTrendCtx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Ingresos',
                        data: incomeData,
                        borderColor: 'var(--color-success)',
                        backgroundColor: 'var(--color-success-light)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Gastos',
                        data: expenseData,
                        borderColor: 'var(--color-danger)',
                        backgroundColor: 'var(--color-danger-light)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: value => formatCurrency(value)
                        }
                    }
                },
                interaction: { intersect: false, mode: 'index' }
            }
        });
    }
    
    // Income vs Expense Chart
    if (incomeExpenseCtx) {
        if (charts.incomeVsExpense) charts.incomeVsExpense.destroy();
        
        const totalIncome = selectors.monthlyIncome();
        const totalExpenses = selectors.monthlyExpenses();
        
        charts.incomeVsExpense = new Chart(incomeExpenseCtx, {
            type: 'doughnut',
            data: {
                labels: ['Ingresos', 'Gastos', 'Balance'],
                datasets: [{
                    data: [totalIncome, totalExpenses, Math.max(0, totalIncome - totalExpenses)],
                    backgroundColor: [
                        'var(--color-success)',
                        'var(--color-danger)',
                        'var(--color-primary)'
                    ],
                    borderWidth: 0,
                    hoverOffset: 12
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, padding: 12 } },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
    
    // Category Breakdown Chart
    if (categoryBreakdownCtx && expensesByCategory.length > 0) {
        if (charts.categoryBreakdown) charts.categoryBreakdown.destroy();
        
        charts.categoryBreakdown = new Chart(categoryBreakdownCtx, {
            type: 'bar',
            data: {
                labels: expensesByCategory.map(d => d.category),
                datasets: [{
                    label: 'Gastos',
                    data: expensesByCategory.map(d => d.total),
                    backgroundColor: 'var(--color-danger)',
                    borderRadius: 6,
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { callback: value => formatCurrency(value) }
                    }
                }
            }
        });
    }
    
    // Account Distribution Chart
    if (accountDistributionCtx && accounts.length > 0) {
        if (charts.accountDistribution) charts.accountDistribution.destroy();
        
        charts.accountDistribution = new Chart(accountDistributionCtx, {
            type: 'pie',
            data: {
                labels: accounts.map(a => a.name),
                datasets: [{
                    data: accounts.map(a => Math.abs(a.balance)),
                    backgroundColor: [
                        '#2563eb', '#22c55e', '#f59e0b', '#ef4444',
                        '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'
                    ],
                    borderWidth: 0,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, padding: 10 } },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                        }
                    }
                }
            }
        });
    }
}

function downloadReport() {
    const reportData = {
        generatedAt: new Date().toISOString(),
        summary: store.get('summary'),
        transactions: selectors.filteredTransactions(),
        accounts: selectors.activeAccounts(),
        categories: store.get('categories'),
        budgets: store.get('budgets'),
        goals: store.get('goals'),
        debts: store.get('debts'),
        reservedFunds: store.get('reservedFunds')
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contabilidad-report-${formatDate(new Date(), 'es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    store.showSuccess('Reporte descargado');
}

window.downloadReport = downloadReport;