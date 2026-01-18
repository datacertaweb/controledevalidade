/**
 * DataCerta - Dashboard Page JavaScript
 * Funcionalidades da página de Dashboard
 */

// Chart.js default configuration for light theme
Chart.defaults.color = '#475569';
Chart.defaults.borderColor = '#E2E8F0';
Chart.defaults.font.family = "'Inter', sans-serif";

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const menuToggle = document.getElementById('menuToggle');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initPeriodFilter();
    initAlerts();
    initActivities();
    initCharts();
    initExportModal();
});

// Sidebar Toggle
function initSidebar() {
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });

    menuToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024 &&
            !sidebar.contains(e.target) &&
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// Period Filter
function initPeriodFilter() {
    const periodFilter = document.getElementById('periodFilter');

    periodFilter?.addEventListener('change', (e) => {
        // In a real app, this would reload data for the selected period
        console.log('Period changed:', e.target.value);
        showToast('Dados atualizados para o período selecionado', 'info');
    });
}

// Alerts
function initAlerts() {
    const alertsContainer = document.getElementById('alertsContainer');
    const dismissAllBtn = document.getElementById('dismissAlerts');

    // SVG icons for alerts
    const alertIcons = {
        critical: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>`,
        warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`,
        info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>`
    };

    // Render alerts
    alertsContainer.innerHTML = window.mockData.alerts.map(alert => `
        <div class="alert-item ${alert.type}" data-id="${alert.id}">
            <span class="alert-icon">${alertIcons[alert.type]}</span>
            <div class="alert-content">
                <div class="alert-title">${alert.title}</div>
                <div class="alert-description">${alert.description}</div>
            </div>
            <button class="alert-action">${alert.action}</button>
            <button class="alert-dismiss" onclick="dismissAlert(${alert.id})">&times;</button>
        </div>
    `).join('');

    // Dismiss all
    dismissAllBtn?.addEventListener('click', () => {
        alertsContainer.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum alerta pendente</p>';
    });
}

function dismissAlert(id) {
    const alertItem = document.querySelector(`.alert-item[data-id="${id}"]`);
    if (alertItem) {
        alertItem.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => alertItem.remove(), 300);
    }
}

// Activities
function initActivities() {
    const activityList = document.getElementById('activityList');

    // SVG icons for activities
    const activityIcons = {
        add: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>`,
        loss: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`,
        edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>`,
        alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
        </svg>`
    };

    activityList.innerHTML = window.mockData.activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon ${activity.type}">${activityIcons[activity.type]}</div>
            <div class="activity-content">
                <div class="activity-title">${activity.title}: <strong>${activity.product}</strong></div>
                <div class="activity-description">${activity.description}</div>
            </div>
            <span class="activity-time">${activity.time}</span>
        </div>
    `).join('');
}

// Charts
function initCharts() {
    const data = window.mockData.chartData;

    // Column Chart - Products in Stock vs Expired
    const columnCtx = document.getElementById('columnChart')?.getContext('2d');
    if (columnCtx) {
        new Chart(columnCtx, {
            type: 'bar',
            data: {
                labels: data.columnChart.labels,
                datasets: [
                    {
                        label: 'Em Estoque',
                        data: data.columnChart.estoque,
                        backgroundColor: '#14B8A6',
                        borderColor: '#0D9488',
                        borderWidth: 1,
                        borderRadius: 6
                    },
                    {
                        label: 'Vencidos',
                        data: data.columnChart.vencidos,
                        backgroundColor: '#EF4444',
                        borderColor: '#DC2626',
                        borderWidth: 1,
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#E2E8F0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Pie Chart - Distribution by Location
    const pieCtx = document.getElementById('pieChart')?.getContext('2d');
    if (pieCtx) {
        new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: data.pieChart.labels,
                datasets: [{
                    data: data.pieChart.data,
                    backgroundColor: ['#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4'],
                    borderWidth: 2,
                    borderColor: '#FFFFFF'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    // Line Chart - Expiry Trend
    const lineCtx = document.getElementById('lineChart')?.getContext('2d');
    if (lineCtx) {
        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: data.lineChart.labels,
                datasets: [{
                    label: 'Vencimentos Previstos',
                    data: data.lineChart.vencimentos,
                    borderColor: '#14B8A6',
                    backgroundColor: 'rgba(20, 184, 166, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#14B8A6',
                    pointBorderColor: '#FFFFFF',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#E2E8F0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Bar Chart - Top 10 Losses
    const barCtx = document.getElementById('barChart')?.getContext('2d');
    if (barCtx) {
        new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: data.barChart.labels,
                datasets: [{
                    label: 'Valor da Perda (R$)',
                    data: data.barChart.data,
                    backgroundColor: createGradient(barCtx, '#EF4444', '#F97316'),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: '#E2E8F0'
                        },
                        ticks: {
                            callback: (value) => `R$ ${value}`
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // Donut Chart - Losses by Sector
    const donutCtx = document.getElementById('donutChart')?.getContext('2d');
    if (donutCtx) {
        new Chart(donutCtx, {
            type: 'doughnut',
            data: {
                labels: data.donutChart.labels,
                datasets: [{
                    data: data.donutChart.data,
                    backgroundColor: ['#EF4444', '#F97316', '#EAB308', '#84CC16'],
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    cutout: '70%'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    // Stock Value Chart
    const stockValueCtx = document.getElementById('stockValueChart')?.getContext('2d');
    if (stockValueCtx) {
        new Chart(stockValueCtx, {
            type: 'bar',
            data: {
                labels: data.stockValueChart.labels,
                datasets: [{
                    label: 'Valor em Estoque (R$)',
                    data: data.stockValueChart.data,
                    backgroundColor: ['#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#E2E8F0'
                        },
                        ticks: {
                            callback: (value) => `R$ ${(value / 1000).toFixed(0)}k`
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
}

// Create gradient for charts
function createGradient(ctx, color1, color2) {
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    return gradient;
}

// Export Modal
function initExportModal() {
    const modal = document.getElementById('exportModalOverlay');
    const btnExport = document.getElementById('btnExportReport');
    const btnClose = document.getElementById('exportModalClose');
    const btnCancel = document.getElementById('btnCancelExport');
    const btnConfirm = document.getElementById('btnConfirmExport');

    btnExport?.addEventListener('click', () => {
        modal.classList.add('active');
    });

    btnClose?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    btnCancel?.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    btnConfirm?.addEventListener('click', () => {
        const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'pdf';
        showToast(`Relatório ${format.toUpperCase()} será gerado quando integrado ao backend`, 'info');
        modal.classList.remove('active');
    });

    // Close on overlay click
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10B981' :
            type === 'warning' ? '#F59E0B' :
                type === 'error' ? '#EF4444' : '#14B8A6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 2000;
        animation: slideUp 0.3s ease;
        font-size: 14px;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Add keyframe animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideDown {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(100px); opacity: 0; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Make functions available globally
window.dismissAlert = dismissAlert;
