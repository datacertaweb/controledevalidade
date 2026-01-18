/**
 * DataCerta - Validade Page JavaScript
 * Funcionalidades da página de Controle de Validade
 */

// State
let currentProducts = [...window.mockData.products];
let currentPage = 1;
let pageSize = 25;
let sortColumn = 'validade';
let sortDirection = 'asc';
let activeTab = 'produtos';

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const menuToggle = document.getElementById('menuToggle');
const tableBody = document.getElementById('tableBody');
const lossesTableBody = document.getElementById('lossesTableBody');
const productsTab = document.getElementById('productsTab');
const perdasTab = document.getElementById('perdasTab');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initTabs();
    initFilters();
    initTable();
    initModals();
    renderProducts();
    renderLosses();
    updateSummaryCards();
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

// Tabs
function initTabs() {
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show/hide content
            if (tabName === 'produtos') {
                productsTab.classList.remove('hidden');
                perdasTab.classList.add('hidden');
            } else {
                productsTab.classList.add('hidden');
                perdasTab.classList.remove('hidden');
            }

            activeTab = tabName;
        });
    });
}

// Filters
function initFilters() {
    const filterInputs = document.querySelectorAll('.filter-input');
    const clearFiltersBtn = document.getElementById('clearFilters');
    const descriptionInput = document.getElementById('filterDescription');
    const suggestionsContainer = document.getElementById('autocompleteSuggestions');

    // Apply filters on change
    filterInputs.forEach(input => {
        input.addEventListener('change', applyFilters);
        input.addEventListener('input', debounce(applyFilters, 300));
    });

    // Clear filters
    clearFiltersBtn?.addEventListener('click', () => {
        filterInputs.forEach(input => {
            if (input.type === 'date') {
                input.value = '';
            } else if (input.tagName === 'SELECT') {
                input.selectedIndex = 0;
            } else {
                input.value = '';
            }
        });
        applyFilters();
    });

    // Autocomplete for description
    descriptionInput?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        if (query.length < 2) {
            suggestionsContainer.classList.remove('show');
            return;
        }

        const matches = window.mockData.products
            .filter(p => p.descricao.toLowerCase().includes(query))
            .slice(0, 5);

        if (matches.length === 0) {
            suggestionsContainer.classList.remove('show');
            return;
        }

        suggestionsContainer.innerHTML = matches.map(p => {
            const highlighted = p.descricao.replace(
                new RegExp(`(${query})`, 'gi'),
                '<mark>$1</mark>'
            );
            return `<div class="autocomplete-item" data-value="${p.descricao}">${highlighted}</div>`;
        }).join('');

        suggestionsContainer.classList.add('show');
    });

    // Handle autocomplete selection
    suggestionsContainer?.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-item')) {
            descriptionInput.value = e.target.dataset.value;
            suggestionsContainer.classList.remove('show');
            applyFilters();
        }
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!descriptionInput?.contains(e.target) && !suggestionsContainer?.contains(e.target)) {
            suggestionsContainer?.classList.remove('show');
        }
    });
}

function applyFilters() {
    const dateStart = document.getElementById('filterDateStart')?.value;
    const dateEnd = document.getElementById('filterDateEnd')?.value;
    const local = document.getElementById('filterLocal')?.value;
    const code = document.getElementById('filterCode')?.value.toLowerCase();
    const description = document.getElementById('filterDescription')?.value.toLowerCase();

    currentProducts = window.mockData.products.filter(product => {
        // Date filter
        if (dateStart && product.validade < dateStart) return false;
        if (dateEnd && product.validade > dateEnd) return false;

        // Local filter
        if (local && product.local !== local) return false;

        // Code filter
        if (code && !product.codigo.toLowerCase().includes(code)) return false;

        // Description filter
        if (description && !product.descricao.toLowerCase().includes(description)) return false;

        return true;
    });

    // Sort by current column
    sortProducts();

    // Reset to first page
    currentPage = 1;

    // Re-render
    renderProducts();
    updateSummaryCards();
}

// Table
function initTable() {
    // Sorting
    const headers = document.querySelectorAll('.data-table th[data-sort]');
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;

            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }

            // Update UI
            headers.forEach(h => h.classList.remove('sorted'));
            th.classList.add('sorted');
            th.querySelector('.sort-icon').textContent = sortDirection === 'asc' ? '↑' : '↓';

            sortProducts();
            renderProducts();
        });
    });

    // Page size
    const pageSizeSelect = document.getElementById('pageSize');
    pageSizeSelect?.addEventListener('change', (e) => {
        pageSize = e.target.value === 'all' ? currentProducts.length : parseInt(e.target.value);
        currentPage = 1;
        renderProducts();
    });

    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderProducts();
        }
    });

    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(currentProducts.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderProducts();
        }
    });
}

function sortProducts() {
    currentProducts.sort((a, b) => {
        let valueA, valueB;

        switch (sortColumn) {
            case 'codigo':
                valueA = a.codigo;
                valueB = b.codigo;
                break;
            case 'descricao':
                valueA = a.descricao;
                valueB = b.descricao;
                break;
            case 'quantidade':
                valueA = a.quantidade;
                valueB = b.quantidade;
                break;
            case 'valorUnit':
                valueA = a.valorUnit;
                valueB = b.valorUnit;
                break;
            case 'valorTotal':
                valueA = a.quantidade * a.valorUnit;
                valueB = b.quantidade * b.valorUnit;
                break;
            case 'validade':
                valueA = new Date(a.validade);
                valueB = new Date(b.validade);
                break;
            case 'local':
                valueA = a.local;
                valueB = b.local;
                break;
            case 'perdas':
                valueA = a.perdas;
                valueB = b.perdas;
                break;
            case 'usuario':
                valueA = a.usuario;
                valueB = b.usuario;
                break;
            default:
                return 0;
        }

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderProducts() {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginatedProducts = currentProducts.slice(start, end);
    const totalPages = Math.ceil(currentProducts.length / pageSize);

    // Update table count
    document.getElementById('tableCount').innerHTML =
        `Exibindo <strong>${paginatedProducts.length}</strong> de <strong>${currentProducts.length}</strong> produtos`;

    // Update pagination
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages || 1;
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;

    // Render rows
    tableBody.innerHTML = paginatedProducts.map(product => {
        const valorTotal = product.quantidade * product.valorUnit;
        const status = window.helpers.getValidityStatus(product.validade);

        return `
            <tr>
                <td><strong>${product.codigo}</strong></td>
                <td>${product.descricao}</td>
                <td>${product.quantidade}</td>
                <td>${window.helpers.formatCurrency(product.valorUnit)}</td>
                <td>${window.helpers.formatCurrency(valorTotal)}</td>
                <td>
                    <span class="validity-badge ${status.class}">
                        ${window.helpers.formatDate(product.validade)}
                        <small>(${status.text})</small>
                    </span>
                </td>
                <td>${product.local}</td>
                <td>${product.perdas > 0 ? `<span style="color: var(--color-danger);">${product.perdas}</span>` : '-'}</td>
                <td>${product.usuario}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" title="Editar" onclick="editProduct(${product.id})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn danger" title="Registrar perda" onclick="openLossModal(${product.id})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                <line x1="12" y1="9" x2="12" y2="13"/>
                                <line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderLosses() {
    lossesTableBody.innerHTML = window.mockData.losses.map(loss => `
        <tr>
            <td><strong>${loss.codigo}</strong></td>
            <td>${loss.descricao}</td>
            <td>${loss.quantidadePerdida}</td>
            <td style="color: var(--color-danger);">${window.helpers.formatCurrency(loss.valorPerda)}</td>
            <td>${window.helpers.formatDate(loss.dataVencimento)}</td>
            <td>${window.helpers.formatDate(loss.dataRegistro)}</td>
            <td>${loss.local}</td>
            <td>${loss.responsavel}</td>
        </tr>
    `).join('');
}

function updateSummaryCards() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count products by urgency
    let urgent = 0; // 7 days
    let warning = 0; // 30 days
    let totalValue = 0;

    currentProducts.forEach(product => {
        const days = window.helpers.getDaysUntilExpiry(product.validade);
        if (days <= 7 && days >= 0) urgent++;
        if (days <= 30 && days >= 0) warning++;
        totalValue += product.quantidade * product.valorUnit;
    });

    document.getElementById('urgentCount').textContent = urgent;
    document.getElementById('warningCount').textContent = warning;
    document.getElementById('totalCount').textContent = currentProducts.length;
    document.getElementById('totalValue').textContent = window.helpers.formatCurrency(totalValue);
}

// Modals
function initModals() {
    const productModal = document.getElementById('modalOverlay');
    const lossModal = document.getElementById('lossModalOverlay');

    // Product Modal
    document.getElementById('btnAddProduct')?.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Novo Produto';
        document.getElementById('productForm').reset();
        productModal.classList.add('active');
    });

    document.getElementById('modalClose')?.addEventListener('click', () => {
        productModal.classList.remove('active');
    });

    document.getElementById('btnCancelModal')?.addEventListener('click', () => {
        productModal.classList.remove('active');
    });

    document.getElementById('productForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        // Add product logic would go here
        showToast('Produto salvo com sucesso!', 'success');
        productModal.classList.remove('active');
    });

    // Loss Modal
    document.getElementById('lossModalClose')?.addEventListener('click', () => {
        lossModal.classList.remove('active');
    });

    document.getElementById('btnCancelLoss')?.addEventListener('click', () => {
        lossModal.classList.remove('active');
    });

    document.getElementById('lossForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        // Register loss logic would go here
        showToast('Perda registrada com sucesso!', 'warning');
        lossModal.classList.remove('active');
    });

    // Close modals on overlay click
    [productModal, lossModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Export button
    document.getElementById('btnExport')?.addEventListener('click', () => {
        showToast('Funcionalidade de exportação será integrada com o backend', 'info');
    });
}

// Edit product
function editProduct(id) {
    const product = window.mockData.products.find(p => p.id === id);
    if (!product) return;

    const modal = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = 'Editar Produto';

    // Fill form
    document.getElementById('prodCodigo').value = product.codigo;
    document.getElementById('prodDescricao').value = product.descricao;
    document.getElementById('prodQuantidade').value = product.quantidade;
    document.getElementById('prodValor').value = product.valorUnit;
    document.getElementById('prodValidade').value = product.validade;
    document.getElementById('prodLocal').value = product.local;

    modal.classList.add('active');
}

// Open loss modal
function openLossModal(id) {
    const product = window.mockData.products.find(p => p.id === id);
    if (!product) return;

    const modal = document.getElementById('lossModalOverlay');
    const productInfo = document.getElementById('lossProductInfo');

    productInfo.innerHTML = `
        <p><strong>Código:</strong> ${product.codigo}</p>
        <p><strong>Produto:</strong> ${product.descricao}</p>
        <p><strong>Estoque atual:</strong> ${product.quantidade} unidades</p>
        <p><strong>Valor unitário:</strong> ${window.helpers.formatCurrency(product.valorUnit)}</p>
    `;

    document.getElementById('lossQuantity').max = product.quantidade;
    document.getElementById('lossQuantity').value = '';

    modal.classList.add('active');
}

// Toast notification (simple implementation)
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? 'var(--color-success)' :
            type === 'warning' ? 'var(--color-warning)' :
                type === 'error' ? 'var(--color-danger)' : 'var(--accent-primary)'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 2000;
        animation: slideUp 0.3s ease;
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
`;
document.head.appendChild(style);

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Make functions available globally
window.editProduct = editProduct;
window.openLossModal = openLossModal;
