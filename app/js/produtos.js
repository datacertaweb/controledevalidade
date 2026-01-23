/**
 * DataCerta App - Gerenciamento de Produtos (Catálogo)
 * Com suporte a importação CSV/TXT/XLSX
 */

let userData = null;
let produtos = [];
let importData = []; // Dados parseados para importação

// Filtros
let filterCodigo = '';
let filterEAN = '';
let selectedCategorias = [];
let filterDescricao = '';

// Paginação
let currentPage = 1;
let itemsPerPage = 50;

// Seleção em lote
let selectedProducts = [];

window.addEventListener('supabaseReady', initProdutos);
setTimeout(() => { if (window.supabaseClient) initProdutos(); }, 500);

let initialized = false;

async function initProdutos() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        userData = await auth.getCurrentUserData();
        if (!userData || userData.tipo !== 'empresa') { window.location.href = 'login.html'; return; }

        // Verificar permissão de acesso à página
        if (!auth.hasPermission(userData, 'base.view')) {
            window.globalUI.showAlert('Acesso Negado', 'Você não tem permissão para acessar esta página.', 'error', () => {
                window.location.href = 'dashboard.html';
            });
            return;
        }

        updateUserUI();
        await loadProdutos();
        initEvents();
    } catch (error) {
        console.error('Erro:', error);
    }
}

function updateUserUI() {
    const initials = userData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = userData.nome;
    document.getElementById('userRole').textContent = userData.roles?.nome || 'Usuário';
}

async function loadProdutos() {
    const { data, error } = await supabaseClient
        .from('base')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .order('descricao');

    if (error) {
        console.error('Erro:', error);
        return;
    }

    produtos = data || [];
    document.getElementById('totalProdutos').textContent = produtos.length;

    // Carregar categorias para o dropdown
    loadCategorias();

    // Resetar seleção
    selectedProducts = [];
    updateBatchUI();

    filterAndRender();
}

function loadCategorias() {
    // Extrair categorias únicas
    const categorias = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort();
    const options = categorias.map(c => ({ value: c, label: c }));

    renderMultiSelect('dropdownCategoria', options, selectedCategorias, (selected) => {
        selectedCategorias = selected;
        currentPage = 1;
        filterAndRender();
    });
}

// Função Genérica para Multi-Select Dropdown (copiada de validade.js)
function renderMultiSelect(containerId, options, selectedValues, onChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const count = selectedValues.length;
    const labelText = count === 0 ? 'Todas' : (count === options.length ? 'Todas' : `${count} selecionada(s)`);

    const btn = document.createElement('div');
    btn.className = 'dropdown-btn';
    btn.innerHTML = `<span>${labelText}</span>`;

    const content = document.createElement('div');
    content.className = 'dropdown-content';

    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        const isSelected = selectedValues.includes(opt.value);

        item.innerHTML = `
            <input type="checkbox" value="${opt.value}" ${isSelected ? 'checked' : ''}>
            <span>${opt.label}</span>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }
            const checkbox = item.querySelector('input');
            const value = checkbox.value;

            if (checkbox.checked) {
                if (!selectedValues.includes(value)) selectedValues.push(value);
            } else {
                const index = selectedValues.indexOf(value);
                if (index > -1) selectedValues.splice(index, 1);
            }

            const newCount = selectedValues.length;
            const newLabel = newCount === 0 ? 'Todas' : (newCount === options.length ? 'Todas' : `${newCount} selecionada(s)`);
            btn.querySelector('span').textContent = newLabel;

            if (onChangeCallback) onChangeCallback(selectedValues);
        });

        content.appendChild(item);
    });

    container.appendChild(btn);
    container.appendChild(content);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown-content.show').forEach(el => {
            if (el !== content) el.classList.remove('show');
        });
        content.classList.toggle('show');
    });
}

// Fechar dropdowns ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.multiselect-dropdown')) {
        document.querySelectorAll('.dropdown-content.show').forEach(el => el.classList.remove('show'));
    }
});

function filterAndRender() {
    let filtered = produtos;

    // Filtro por código
    if (filterCodigo) {
        filtered = filtered.filter(p =>
            p.codigo && p.codigo.toLowerCase().includes(filterCodigo.toLowerCase())
        );
    }

    // Filtro por EAN
    if (filterEAN) {
        filtered = filtered.filter(p =>
            p.ean && p.ean.includes(filterEAN)
        );
    }

    // Filtro por categoria (multi-select)
    if (selectedCategorias.length > 0) {
        filtered = filtered.filter(p =>
            p.categoria && selectedCategorias.includes(p.categoria)
        );
    }

    // Filtro por descrição
    if (filterDescricao) {
        filtered = filtered.filter(p =>
            p.descricao.toLowerCase().includes(filterDescricao.toLowerCase())
        );
    }

    // Paginação
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    updatePaginationUI(totalItems, startIndex, endIndex, totalPages);
    renderProdutos(paginatedItems);
}

function updatePaginationUI(totalItems, startIndex, endIndex, totalPages) {
    const info = document.getElementById('paginationInfo');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    const pageDisplay = document.getElementById('pageNumberDisplay');

    if (totalItems === 0) {
        info.innerHTML = 'Mostrando <strong>0 de 0</strong> produtos';
        btnPrev.disabled = true;
        btnNext.disabled = true;
        pageDisplay.textContent = 'Página 1';
        return;
    }

    info.innerHTML = `Mostrando <strong>${startIndex + 1}-${endIndex} de ${totalItems}</strong> produtos`;
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
    pageDisplay.textContent = `Página ${currentPage}`;
}

function renderProdutos(lista) {
    const tbody = document.getElementById('produtosTable');
    const canDelete = auth.hasPermission(userData, 'base.delete');

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 60px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 10px;">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                    <p style="color: var(--text-muted);">Nenhum produto encontrado</p>
                    <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 5px;">Ajuste os filtros ou adicione novos produtos</p>
                </td>
            </tr>
        `;
        // Atualizar checkbox "selecionar todos"
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        return;
    }

    const canEdit = auth.hasPermission(userData, 'base.edit');

    tbody.innerHTML = lista.map(prod => {
        const isSelected = selectedProducts.includes(prod.id);
        return `
        <tr>
            <td>
                ${canDelete ? `<input type="checkbox" class="product-checkbox" data-id="${prod.id}" ${isSelected ? 'checked' : ''}>` : ''}
            </td>
            <td>${prod.codigo || '-'}</td>
            <td><code style="font-size: 12px;">${prod.ean || '-'}</code></td>
            <td><strong>${prod.descricao}</strong></td>
            <td>${prod.categoria || '-'}</td>
            <td>
                <div class="action-buttons">
                    ${canEdit ? `
                    <button class="action-btn" title="Editar" onclick="editProduto('${prod.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    ` : ''}
                    ${canDelete ? `
                    <button class="action-btn delete" title="Excluir" onclick="deleteProduto('${prod.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                    ` : ''}
                    ${!canEdit && !canDelete ? '<span style="color: var(--text-muted); font-size: 12px;">Sem ações</span>' : ''}
                </div>
            </td>
        </tr>
    `}).join('');

    // Atualizar estado do checkbox "selecionar todos"
    updateSelectAllState();

    // Adicionar eventos aos checkboxes
    document.querySelectorAll('.product-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (e.target.checked) {
                if (!selectedProducts.includes(id)) selectedProducts.push(id);
            } else {
                const index = selectedProducts.indexOf(id);
                if (index > -1) selectedProducts.splice(index, 1);
            }
            updateSelectAllState();
            updateBatchUI();
        });
    });
}

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.product-checkbox');
    if (!selectAllCheckbox || checkboxes.length === 0) return;

    const checkedCount = document.querySelectorAll('.product-checkbox:checked').length;
    selectAllCheckbox.checked = checkedCount === checkboxes.length;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function updateBatchUI() {
    const batchActions = document.getElementById('batchActions');
    const selectedCount = document.getElementById('selectedCount');

    if (selectedProducts.length > 0) {
        batchActions.style.display = 'flex';
        selectedCount.textContent = `${selectedProducts.length} selecionado${selectedProducts.length > 1 ? 's' : ''}`;
    } else {
        batchActions.style.display = 'none';
    }
}

function initEvents() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    // Função para fechar o menu mobile
    function closeMobileMenu() {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
    }

    // Função para abrir o menu mobile
    function openMobileMenu() {
        sidebar?.classList.add('open');
        overlay?.classList.add('active');
    }

    // Sidebar toggle (desktop - collapse)
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed');
    });

    // Menu toggle (mobile - open/close)
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        if (sidebar?.classList.contains('open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    // Fechar ao clicar no overlay
    overlay?.addEventListener('click', closeMobileMenu);

    // Fechar ao clicar em um link de navegação (mobile)
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeMobileMenu();
            }
        });
    });

    // Filtros
    document.getElementById('filterCodigo')?.addEventListener('input', (e) => {
        filterCodigo = e.target.value;
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('filterEAN')?.addEventListener('input', (e) => {
        filterEAN = e.target.value;
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        filterDescricao = e.target.value;
        currentPage = 1;
        filterAndRender();
    });

    // Limpar Filtros
    document.getElementById('btnLimparFiltros')?.addEventListener('click', () => {
        document.getElementById('filterCodigo').value = '';
        document.getElementById('filterEAN').value = '';
        document.getElementById('searchInput').value = '';
        filterCodigo = '';
        filterEAN = '';
        filterDescricao = '';
        selectedCategorias = [];
        currentPage = 1;
        loadCategorias(); // Re-renderiza o dropdown
        filterAndRender();
    });

    // Paginação
    document.getElementById('itemsPerPage')?.addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('btnPrevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            filterAndRender();
        }
    });

    document.getElementById('btnNextPage')?.addEventListener('click', () => {
        currentPage++;
        filterAndRender();
    });

    // Seleção em Lote
    document.getElementById('selectAll')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            const id = cb.dataset.id;
            if (e.target.checked) {
                if (!selectedProducts.includes(id)) selectedProducts.push(id);
            } else {
                const index = selectedProducts.indexOf(id);
                if (index > -1) selectedProducts.splice(index, 1);
            }
        });
        updateBatchUI();
    });

    document.getElementById('btnDeselectAll')?.addEventListener('click', () => {
        selectedProducts = [];
        document.querySelectorAll('.product-checkbox').forEach(cb => cb.checked = false);
        document.getElementById('selectAll').checked = false;
        updateBatchUI();
    });

    document.getElementById('btnDeleteSelected')?.addEventListener('click', deleteSelectedProducts);

    // Modal Produto
    const modal = document.getElementById('modalProduto');
    document.getElementById('btnNovoProduto')?.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Novo Produto';
        document.getElementById('formProduto').reset();
        document.getElementById('produtoId').value = '';
        modal.classList.add('active');
    });

    document.getElementById('modalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    document.getElementById('formProduto')?.addEventListener('submit', saveProduto);

    // Botão Exportar
    document.getElementById('btnExportar')?.addEventListener('click', exportarProdutos);

    // Modal Importar
    initImportEvents();
}

// Exclusão em Lote
async function deleteSelectedProducts() {
    if (!auth.hasPermission(userData, 'base.delete')) {
        window.globalUI.showToast('error', 'Você não tem permissão para excluir produtos.');
        return;
    }

    if (selectedProducts.length === 0) {
        window.globalUI.showToast('warning', 'Nenhum produto selecionado.');
        return;
    }

    const count = selectedProducts.length;
    const confirmed = await window.globalUI.showConfirm(
        'Excluir Produtos',
        `Tem certeza que deseja excluir ${count} produto${count > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`,
        'warning'
    );
    if (!confirmed) return;

    try {
        // Soft delete em lote
        const { error } = await supabaseClient
            .from('base')
            .update({ ativo: false })
            .in('id', selectedProducts);

        if (error) throw error;

        window.globalUI.showToast('success', `${count} produto${count > 1 ? 's' : ''} excluído${count > 1 ? 's' : ''} com sucesso!`);
        selectedProducts = [];
        await loadProdutos();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao excluir: ' + error.message);
    }
}

async function saveProduto(e) {
    e.preventDefault();

    const id = document.getElementById('produtoId').value;
    const data = {
        empresa_id: userData.empresa_id,
        codigo: normalizeText(document.getElementById('produtoCodigo').value) || null,
        ean: document.getElementById('produtoEAN').value.replace(/\D/g, '') || null,
        descricao: normalizeText(document.getElementById('produtoDescricao').value),
        categoria: normalizeText(document.getElementById('produtoCategoria').value) || null
    };

    try {
        if (id) {
            const { error } = await supabaseClient.from('base').update(data).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('base').insert(data);
            if (error) throw error;
        }

        document.getElementById('modalProduto').classList.remove('active');
        await loadProdutos();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao salvar: ' + error.message);
    }
}

window.editProduto = async function (id) {
    const prod = produtos.find(p => p.id === id);
    if (!prod) return;

    document.getElementById('modalTitle').textContent = 'Editar Produto';
    document.getElementById('produtoId').value = prod.id;
    document.getElementById('produtoCodigo').value = prod.codigo || '';
    document.getElementById('produtoEAN').value = prod.ean || '';
    document.getElementById('produtoDescricao').value = prod.descricao;
    document.getElementById('produtoCategoria').value = prod.categoria || '';

    document.getElementById('modalProduto').classList.add('active');
};

window.deleteProduto = async function (id) {
    // Verificar permissão
    if (!auth.hasPermission(userData, 'base.delete')) {
        window.globalUI.showToast('error', 'Você não tem permissão para excluir produtos.');
        return;
    }

    const confirmed = await window.globalUI.showConfirm('Excluir Produto', 'Tem certeza que deseja excluir este produto?', 'warning');
    if (!confirmed) return;

    try {
        const { error } = await supabaseClient.from('base').update({ ativo: false }).eq('id', id);
        if (error) throw error;
        await loadProdutos();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao excluir: ' + error.message);
    }
};

// =============================================
// IMPORTAÇÃO DE PRODUTOS
// =============================================

function initImportEvents() {
    const modal = document.getElementById('modalImportar');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Abrir modal
    document.getElementById('btnImportar')?.addEventListener('click', () => {
        resetImportModal();
        modal.classList.add('active');
    });

    // Fechar modal
    document.getElementById('modalImportarClose')?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    // Upload area
    uploadArea?.addEventListener('click', () => fileInput.click());
    uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#14B8A6';
        uploadArea.style.background = '#F0FDFA';
    });
    uploadArea?.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#CBD5E1';
        uploadArea.style.background = '';
    });
    uploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#CBD5E1';
        uploadArea.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    });

    fileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    });

    // Botões
    document.getElementById('btnVoltarImport')?.addEventListener('click', () => {
        showImportStep(1);
    });

    document.getElementById('btnConfirmarImport')?.addEventListener('click', startImport);
    document.getElementById('btnFecharImport')?.addEventListener('click', () => {
        modal.classList.remove('active');
        loadProdutos();
    });

    // Download template
    document.getElementById('downloadTemplate')?.addEventListener('click', (e) => {
        e.preventDefault();
        downloadTemplate();
    });
}

function resetImportModal() {
    showImportStep(1);
    document.getElementById('fileInput').value = '';
    importData = [];
}

function showImportStep(step) {
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`importStep${i}`).style.display = i === step ? 'block' : 'none';
    }
}

async function processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();

    try {
        let rows;

        if (ext === 'xlsx' || ext === 'xls') {
            rows = await parseExcel(file);
        } else if (ext === 'csv' || ext === 'txt') {
            rows = await parseCSV(file);
        } else {
            window.globalUI.showToast('warning', 'Formato não suportado. Use CSV, TXT ou XLSX.');
            return;
        }

        if (rows.length === 0) {
            window.globalUI.showToast('warning', 'Arquivo vazio ou formato inválido.');
            return;
        }

        // Processar e validar
        importData = processRows(rows);
        showPreview();

    } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        window.globalUI.showToast('error', 'Erro ao processar arquivo: ' + error.message);
    }
}

function parseExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const workbook = XLSX.read(e.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                // Remover header se existir
                if (data.length > 0 && isHeaderRow(data[0])) {
                    data.shift();
                }
                resolve(data);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
    });
}

function parseCSV(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim());

                // Detectar separador
                const separator = detectSeparator(lines[0]);

                let data = lines.map(line => {
                    // Parse respeitando aspas
                    return parseLine(line, separator);
                });

                // Remover header se existir
                if (data.length > 0 && isHeaderRow(data[0])) {
                    data.shift();
                }

                resolve(data);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsText(file, 'UTF-8');
    });
}

function detectSeparator(line) {
    const separators = [';', ',', '\t', '|'];
    let maxCount = 0;
    let best = ';';

    for (const sep of separators) {
        const count = (line.match(new RegExp(sep.replace(/[|]/g, '\\$&'), 'g')) || []).length;
        if (count > maxCount) {
            maxCount = count;
            best = sep;
        }
    }

    return best;
}

function parseLine(line, separator) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

function isHeaderRow(row) {
    const headerKeywords = ['codigo', 'código', 'sku', 'descricao', 'descrição', 'produto', 'ean', 'barcode', 'categoria', 'category'];
    const text = row.join(' ').toLowerCase();
    return headerKeywords.some(kw => text.includes(kw));
}

function processRows(rows) {
    return rows.map((row, index) => {
        const [codigo, descricao, ean, categoria] = row;

        const item = {
            lineNumber: index + 1,
            codigo: normalizeText(String(codigo || '')),
            descricao: normalizeText(String(descricao || '')),
            ean: String(ean || '').replace(/\D/g, ''),
            categoria: normalizeText(String(categoria || '')),
            status: 'ok',
            error: null
        };

        // Validação
        if (!item.descricao) {
            item.status = 'error';
            item.error = 'Descrição obrigatória';
        }

        return item;
    });
}

function normalizeText(text) {
    if (!text) return '';
    return text
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'");
}

function showPreview() {
    const valid = importData.filter(i => i.status === 'ok').length;
    const errors = importData.filter(i => i.status === 'error').length;

    document.getElementById('importStatusText').innerHTML = `
        <strong>${importData.length}</strong> linhas encontradas | 
        <span style="color: #10B981;">${valid} válidos</span>
        ${errors > 0 ? `| <span style="color: #EF4444;">${errors} com erro</span>` : ''}
    `;

    // Mostrar primeiras 50 linhas
    const preview = importData.slice(0, 50);
    document.getElementById('previewBody').innerHTML = preview.map(item => `
        <tr style="${item.status === 'error' ? 'background: #FEE2E2;' : ''}">
            <td>${item.lineNumber}</td>
            <td>${item.codigo || '-'}</td>
            <td>${item.descricao || '<em style="color: #EF4444;">vazio</em>'}</td>
            <td>${item.ean || '-'}</td>
            <td>${item.categoria || '-'}</td>
            <td>
                ${item.status === 'ok'
            ? '<span style="color: #10B981;">✓</span>'
            : `<span style="color: #EF4444;" title="${item.error}">✗</span>`
        }
            </td>
        </tr>
    `).join('');

    if (importData.length > 50) {
        document.getElementById('previewBody').innerHTML += `
            <tr><td colspan="6" style="text-align: center; color: var(--text-muted);">
                ... e mais ${importData.length - 50} linhas
            </td></tr>
        `;
    }

    document.getElementById('btnImportText').textContent = `Importar ${valid} Produtos`;
    document.getElementById('btnConfirmarImport').disabled = valid === 0;

    showImportStep(2);
}

async function startImport() {
    const validItems = importData.filter(i => i.status === 'ok');
    if (validItems.length === 0) return;

    showImportStep(3);

    const BATCH_SIZE = 500;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
        const batch = validItems.slice(i, i + BATCH_SIZE);

        const records = batch.map(item => ({
            empresa_id: userData.empresa_id,
            codigo: item.codigo || null,
            descricao: item.descricao,
            ean: item.ean || null,
            categoria: item.categoria || null
        }));

        try {
            const { error } = await supabaseClient
                .from('base')
                .insert(records);

            if (error) throw error;
            imported += batch.length;
        } catch (err) {
            console.error('Erro no batch:', err);
            errors += batch.length;
        }

        // Atualizar progresso
        const progress = Math.round(((i + batch.length) / validItems.length) * 100);
        document.getElementById('importProgress').style.width = progress + '%';
        document.getElementById('importProgressText').textContent =
            `Importando... ${i + batch.length} de ${validItems.length}`;
    }

    // Resultado
    showImportResult(imported, errors);
}

function showImportResult(imported, errors) {
    const resultHtml = `
        <div style="margin-bottom: 20px;">
            ${imported > 0 ? `
                <div style="color: #10B981; font-size: 3rem; margin-bottom: 10px;">✓</div>
                <p style="font-size: 1.2rem; margin: 0;"><strong>${imported}</strong> produtos importados com sucesso!</p>
            ` : ''}
            ${errors > 0 ? `
                <p style="color: #EF4444; margin-top: 10px;">${errors} registros com erro</p>
            ` : ''}
        </div>
    `;

    document.getElementById('importResult').innerHTML = resultHtml;
    showImportStep(4);
}

function downloadTemplate() {
    const content = `CODIGO;DESCRICAO;EAN;CATEGORIA
SKU001;LEITE INTEGRAL 1L;7891234567890;LATICINIOS
SKU002;PAO DE FORMA 500G;7891234567891;PADARIA
SKU003;ARROZ BRANCO 5KG;7891234567892;MERCEARIA
SKU004;REFRIGERANTE 2L;7891234567893;BEBIDAS`;

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_produtos_datacerta.csv';
    link.click();
}

// =============================================
// EXPORTAÇÃO DE PRODUTOS
// =============================================

// Função auxiliar para buscar todos os registros em lotes (contorna limite de 1000 do Supabase)
async function fetchAllProductsInBatches(batchSize = 1000) {
    let allData = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabaseClient
            .from('base')
            .select('*')
            .eq('empresa_id', userData.empresa_id)
            .eq('ativo', true)
            .range(offset, offset + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
            allData = allData.concat(data);
            offset += batchSize;
            hasMore = data.length === batchSize;
        } else {
            hasMore = false;
        }
    }

    return allData;
}

async function exportarProdutos() {
    window.globalUI.showToast('info', 'Preparando exportação... Aguarde.');

    try {
        // Buscar TODOS os produtos em lotes
        const allProdutos = await fetchAllProductsInBatches();

        if (allProdutos.length === 0) {
            window.globalUI.showToast('warning', 'Nenhum produto para exportar.');
            return;
        }

        window.globalUI.showToast('info', `Exportando ${allProdutos.length} produtos...`);

        // Header
        let csv = 'CODIGO;DESCRICAO;EAN;CATEGORIA\n';

        // Dados
        allProdutos.forEach(p => {
            csv += `${p.codigo || ''};${p.descricao || ''};${p.ean || ''};${p.categoria || ''}\n`;
        });

        // Download
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `produtos_datacerta_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        window.globalUI.showToast('success', `${allProdutos.length} produtos exportados com sucesso!`);
    } catch (error) {
        console.error('Erro ao exportar:', error);
        window.globalUI.showToast('error', 'Erro ao exportar: ' + error.message);
    }
}

