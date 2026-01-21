/**
 * DataCerta App - Controle de Validade
 */

let userData = null;
let lojas = [];
let locais = [];
let produtos = [];
let estoque = [];

// Filtros - agora suportam multi-seleção
let selectedLojas = [];
let selectedLocais = [];
let selectedStatus = [];
let dataInicio = null;
let dataFim = null;
let userLojaIds = null; // Lojas do usuário (null = todas)
// Paginação
let currentPage = 1;
let itemsPerPage = 25;

window.addEventListener('supabaseReady', initValidade);
setTimeout(() => { if (window.supabaseClient) initValidade(); }, 500);

let initialized = false;

async function initValidade() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        userData = await auth.getCurrentUserData();
        if (!userData || userData.tipo !== 'empresa') { window.location.href = 'login.html'; return; }

        // Verificar permissão de acesso à página
        if (!auth.hasPermission(userData, 'coletado.view')) {
            window.globalUI.showAlert('Acesso Negado', 'Você não tem permissão para acessar esta página.', 'error', () => {
                window.location.href = 'dashboard.html';
            });
            return;
        }

        updateUserUI();

        // Carregar lojas do usuário (se tiver restrição)
        if (!auth.isAdmin(userData)) {
            userLojaIds = await auth.getUserLojas(userData.id);
        }

        await Promise.all([loadLojas(), loadProdutos()]);
        await loadEstoque();
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

async function loadLojas() {
    let query = supabaseClient
        .from('lojas')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .order('nome');

    // Filtrar por lojas do usuário se houver restrição
    if (userLojaIds && userLojaIds.length > 0) {
        query = query.in('id', userLojaIds);
    }

    const { data } = await query;
    lojas = data || [];

    // Renderizar Dropdown Customizado de Lojas
    const lojaOptions = lojas.map(l => ({ value: l.id, label: l.nome }));
    renderMultiSelect('dropdownLoja', lojaOptions, selectedLojas, (selected) => {
        selectedLojas = selected;
        currentPage = 1;
        filterAndRender();
    });

    // Modal
    const estoqueLoja = document.getElementById('estoqueLoja');
    estoqueLoja.innerHTML = '<option value="">Selecione...</option>' +
        lojas.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');

    // Carregar todos os locais de todas as lojas
    await loadAllLocais();

    // Inicializar Dropdown de Status
    const statusOptions = [
        { value: 'expired', label: 'Vencidos' },
        { value: 'critical', label: 'Críticos' },
        { value: 'warning', label: 'Alerta' },
        { value: 'ok', label: 'OK' }
    ];
    renderMultiSelect('dropdownStatus', statusOptions, selectedStatus, (selected) => {
        selectedStatus = selected;
        currentPage = 1;
        filterAndRender();
    });
}

let allLocais = []; // Todos os locais da empresa

async function loadAllLocais() {
    // Buscar locais de todas as lojas da empresa
    const lojasIds = lojas.map(l => l.id);

    if (lojasIds.length === 0) {
        allLocais = [];
        return;
    }

    const { data } = await supabaseClient
        .from('locais')
        .select('*')
        .in('loja_id', lojasIds)
        .eq('ativo', true)
        .order('nome');

    allLocais = data || [];

    // Popular filtro de local - agrupar por nome único (sem duplicatas)
    const uniqueLocais = [...new Set(allLocais.map(l => l.nome))].sort();
    const localOptions = uniqueLocais.map(nome => ({ value: nome, label: nome }));

    renderMultiSelect('dropdownLocal', localOptions, selectedLocais, (selected) => {
        selectedLocais = selected;
        currentPage = 1;
        filterAndRender();
    });

    locais = allLocais;
}

// Função Genérica para Multi-Select Dropdown
function renderMultiSelect(containerId, options, selectedValues, onChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Criar estrutura se não existir ou limpar atual
    container.innerHTML = '';

    const count = selectedValues.length;
    const labelText = count === 0 ? 'Todos' : (count === options.length ? 'Todos' : `${count} selecionado(s)`);

    // Botão Principal
    const btn = document.createElement('div');
    btn.className = 'dropdown-btn';
    btn.innerHTML = `<span>${labelText}</span>`;

    // Conteúdo Dropdown
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

        // Evento de clique no item (toggle checkbox)
        item.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }

            // Atualizar seleção
            const checkbox = item.querySelector('input');
            const value = checkbox.value;

            if (checkbox.checked) {
                if (!selectedValues.includes(value)) selectedValues.push(value);
            } else {
                const index = selectedValues.indexOf(value);
                if (index > -1) selectedValues.splice(index, 1);
            }

            // Atualizar label do botão
            const newCount = selectedValues.length;
            const newLabel = newCount === 0 ? 'Todos' : (newCount === options.length ? 'Todos' : `${newCount} selecionado(s)`);
            btn.querySelector('span').textContent = newLabel;

            // Callback
            if (onChangeCallback) onChangeCallback(selectedValues);
        });

        content.appendChild(item);
    });

    container.appendChild(btn);
    container.appendChild(content);

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Fechar outros dropdowns
        document.querySelectorAll('.dropdown-content.show').forEach(el => {
            if (el !== content) el.classList.remove('show');
        });
        content.classList.toggle('show');
    });
}

// Fechar dropdowns ao clicar fora - Adicionar isso ao initEvents ou globalmente
document.addEventListener('click', (e) => {
    if (!e.target.closest('.multiselect-dropdown')) {
        document.querySelectorAll('.dropdown-content.show').forEach(el => el.classList.remove('show'));
    }
});

async function loadLocaisModal(lojaId) {
    // Esta função é só para o modal de adicionar estoque
    if (!lojaId) {
        document.getElementById('estoqueLocal').innerHTML = '<option value="">Selecione a loja primeiro</option>';
        return;
    }

    const locaisLoja = allLocais.filter(l => l.loja_id === lojaId);
    document.getElementById('estoqueLocal').innerHTML = '<option value="">Nenhum</option>' +
        locaisLoja.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');
}

async function loadProdutos() {
    const { data } = await supabaseClient
        .from('base')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .order('descricao');

    produtos = data || [];

    document.getElementById('estoqueProduto').innerHTML = '<option value="">Selecione...</option>' +
        produtos.map(p => `<option value="${p.id}">${p.descricao} ${p.codigo ? '(' + p.codigo + ')' : ''}</option>`).join('');
}

async function loadEstoque() {
    // Buscar coletados através da relação com base (produto)
    // que pertence à empresa do usuário
    let query = supabaseClient
        .from('coletados')
        .select('*, base!inner(descricao, valor_unitario, codigo, empresa_id), lojas(nome), locais(nome)')
        .eq('base.empresa_id', userData.empresa_id)
        .order('validade');

    // Se usuário tem lojas específicas, filtrar apenas elas
    if (userLojaIds && userLojaIds.length > 0) {
        query = query.in('loja_id', userLojaIds);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Erro:', error);
        return;
    }

    estoque = data || [];
    filterAndRender();
}

function filterAndRender() {
    const search = document.getElementById('filterSearch')?.value.toLowerCase() || '';

    let filtered = estoque;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Filtro de busca por texto
    if (search) {
        filtered = filtered.filter(e =>
            e.base?.descricao?.toLowerCase().includes(search) ||
            e.base?.codigo?.toLowerCase().includes(search) ||
            e.lote?.toLowerCase().includes(search)
        );
    }

    // Ocultar vencidos há mais de 30 dias (a menos que filtro de período seja aplicado)
    if (!dataInicio && !dataFim) {
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        filtered = filtered.filter(e => {
            const validade = new Date(e.validade);
            return validade >= trintaDiasAtras;
        });
    }

    // Filtro de Lojas (multi-seleção)
    if (selectedLojas.length > 0) {
        filtered = filtered.filter(e => selectedLojas.includes(e.loja_id));
    }

    // Filtro de Locais/Setores (multi-seleção por NOME)
    if (selectedLocais.length > 0) {
        filtered = filtered.filter(e => {
            const localNome = e.locais?.nome || '';
            return selectedLocais.includes(localNome);
        });
    }

    // Filtro de Status (multi-seleção)
    if (selectedStatus.length > 0) {
        filtered = filtered.filter(e => {
            const status = getStatus(e.validade, hoje);
            return selectedStatus.includes(status);
        });
    }

    // Filtro de Período (data inicial e final)
    if (dataInicio) {
        const inicio = new Date(dataInicio);
        filtered = filtered.filter(e => new Date(e.validade) >= inicio);
    }
    if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59);
        filtered = filtered.filter(e => new Date(e.validade) <= fim);
    }

    // Calcular resumo baseado no filtrado
    const counts = { expired: 0, critical: 0, warning: 0, ok: 0 };
    filtered.forEach(e => {
        const status = getStatus(e.validade, hoje);
        counts[status]++;
    });

    document.getElementById('countVencidos').textContent = counts.expired;
    document.getElementById('countCriticos').textContent = counts.critical;
    document.getElementById('countAlertas').textContent = counts.warning;
    document.getElementById('countOk').textContent = counts.ok;

    // Paginação
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    // Ajustar página atual se exceder o total
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    const paginatedItems = filtered.slice(startIndex, endIndex);

    updatePaginationUI(totalItems, startIndex, endIndex, totalPages);
    renderEstoque(paginatedItems, hoje);
}

function updatePaginationUI(totalItems, startIndex, endIndex, totalPages) {
    const info = document.getElementById('paginationInfo');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    const pageDisplay = document.getElementById('pageNumberDisplay');

    if (totalItems === 0) {
        info.innerHTML = 'Mostrando <strong>0 de 0</strong> itens';
        btnPrev.disabled = true;
        btnNext.disabled = true;
        pageDisplay.textContent = 'Página 1';
        return;
    }

    info.innerHTML = `Mostrando <strong>${startIndex + 1}-${endIndex} de ${totalItems}</strong> itens`;

    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
    pageDisplay.textContent = `Página ${currentPage}`;
}

function getStatus(validade, hoje) {
    const val = new Date(validade);
    const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));

    if (diff < 0) return 'expired';
    if (diff <= 5) return 'critical';
    if (diff <= 14) return 'warning';
    return 'ok';
}

function renderEstoque(lista, hoje) {
    const tbody = document.getElementById('estoqueTable');

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 60px; color: var(--text-muted);">
                    Nenhum item encontrado
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const status = getStatus(item.validade, hoje);
        const statusLabels = { expired: 'Vencido', critical: 'Crítico', warning: 'Alerta', ok: 'OK' };
        const val = new Date(item.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));

        const canEditValidity = auth.hasPermission(userData, 'coletado.edit_validity');
        const canDelete = auth.hasPermission(userData, 'coletado.delete');

        return `
            <tr>
                <td>
                    <strong>${item.base?.descricao || '-'}</strong>
                    ${item.lote ? `<br><small style="color: var(--text-muted);">Lote: ${item.lote}</small>` : ''}
                </td>
                <td>${item.lojas?.nome || '-'}</td>
                <td>${item.locais?.nome || '-'}</td>
                <td>${item.quantidade}</td>
                <td>${val.toLocaleDateString('pt-BR')}</td>
                <td>
                    <span class="validity-badge ${status}">
                        ${diff < 0 ? 'VENCIDO' : diff === 0 ? 'VENCE HOJE' : diff === 1 ? 'VENCE EM 1 DIA' : `VENCE EM ${diff} DIAS`}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        ${canEditValidity ? `
                        <button class="action-btn" title="Editar" onclick="editEstoque('${item.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        ` : ''}
                        ${canDelete ? `
                        <button class="action-btn delete" title="Registrar Perda" onclick="openPerda('${item.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                        ` : ''}
                        ${!canEditValidity && !canDelete ? '<span style="color: var(--text-muted); font-size: 12px;">-</span>' : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
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

    // Filtros de Data e Busca
    document.getElementById('filterDataInicio')?.addEventListener('change', (e) => {
        dataInicio = e.target.value || null;
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('filterDataFim')?.addEventListener('change', (e) => {
        dataFim = e.target.value || null;
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('filterSearch')?.addEventListener('input', () => {
        currentPage = 1;
        filterAndRender();
    });

    // Eventos de Paginação
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
        // O limite superior será tratado dentro de filterAndRender
        currentPage++;
        filterAndRender();
    });

    // Botão Limpar Filtros
    document.getElementById('btnLimparFiltros')?.addEventListener('click', async () => {
        // Resetar inputs
        document.getElementById('filterDataInicio').value = '';
        document.getElementById('filterDataFim').value = '';
        document.getElementById('filterSearch').value = '';

        // Resetar Paginação
        currentPage = 1;

        // Resetar variáveis
        selectedLojas = [];
        selectedLocais = [];
        selectedStatus = [];
        dataInicio = null;
        dataFim = null;

        // Re-renderizar dropdowns com seleção vazia
        // Loja
        const lojaOptions = lojas.map(l => ({ value: l.id, label: l.nome }));
        renderMultiSelect('dropdownLoja', lojaOptions, selectedLojas, (selected) => {
            selectedLojas = selected;
            currentPage = 1;
            filterAndRender();
        });

        // Local (recarregar todos)
        await loadAllLocais(); // Agora loadAllLocais deve incluir o reset de página no callback se possível, ou garantir que filterAndRender seja chamado.
        // loadAllLocais chama renderMultiSelect que chama filterAndRender. Vamos atualizar loadAllLocais também.

        // Status
        const statusOptions = [
            { value: 'expired', label: 'Vencidos' },
            { value: 'critical', label: 'Críticos' },
            { value: 'warning', label: 'Alerta' },
            { value: 'ok', label: 'OK' }
        ];
        renderMultiSelect('dropdownStatus', statusOptions, selectedStatus, (selected) => {
            selectedStatus = selected;
            currentPage = 1;
            filterAndRender();
        });

        filterAndRender();
    });

    // Modal Estoque
    const modal = document.getElementById('modalEstoque');
    document.getElementById('btnNovoEstoque')?.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Adicionar Estoque';
        document.getElementById('formEstoque').reset();
        document.getElementById('estoqueId').value = '';
        document.getElementById('estoqueLocal').innerHTML = '<option value="">Selecione a loja primeiro</option>';
        modal.classList.add('active');
    });

    document.getElementById('modalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    document.getElementById('estoqueLoja')?.addEventListener('change', async (e) => {
        await loadLocaisModal(e.target.value);
    });

    document.getElementById('formEstoque')?.addEventListener('submit', saveEstoque);

    // Modal Perda
    const modalPerda = document.getElementById('modalPerda');
    document.getElementById('modalPerdaClose')?.addEventListener('click', () => modalPerda.classList.remove('active'));
    document.getElementById('btnCancelPerda')?.addEventListener('click', () => modalPerda.classList.remove('active'));
    modalPerda?.addEventListener('click', (e) => { if (e.target === modalPerda) modalPerda.classList.remove('active'); });
    document.getElementById('formPerda')?.addEventListener('submit', savePerda);

    // Exportar
    document.getElementById('btnExportar')?.addEventListener('click', exportarEstoque);

    // Auto-preencher valor unitário ao selecionar produto
    document.getElementById('estoqueProduto')?.addEventListener('change', (e) => {
        const produtoId = e.target.value;
        const produto = produtos.find(p => p.id === produtoId);
        if (produto) {
            document.getElementById('estoqueValor').value = produto.valor_unitario || 0;
        } else {
            document.getElementById('estoqueValor').value = '';
        }
    });
}

function exportarEstoque() {
    if (estoque.length === 0) {
        window.globalUI.showToast('warning', 'Nenhum item para exportar.');
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Header
    let csv = 'PRODUTO;CODIGO;LOJA;LOCAL;QUANTIDADE;VALIDADE;LOTE;STATUS;DIAS_RESTANTES\n';

    // Dados
    estoque.forEach(item => {
        const val = new Date(item.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));

        // Formato: VENCIDO ou VENCE EM X DIAS
        let statusText;
        if (diff < 0) statusText = 'VENCIDO';
        else if (diff === 0) statusText = 'VENCE HOJE';
        else if (diff === 1) statusText = 'VENCE EM 1 DIA';
        else statusText = `VENCE EM ${diff} DIAS`;

        csv += `${item.base?.descricao || ''};`;
        csv += `${item.base?.codigo || ''};`;
        csv += `${item.lojas?.nome || ''};`;
        csv += `${item.locais?.nome || ''};`;
        csv += `${item.quantidade};`;
        csv += `${val.toLocaleDateString('pt-BR')};`;
        csv += `${item.lote || ''};`;
        csv += `${statusText};`;
        csv += `${diff}\n`;
    });

    // Download
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `estoque_validade_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

async function saveEstoque(e) {
    e.preventDefault();

    const id = document.getElementById('estoqueId').value;
    const data = {
        produto_id: document.getElementById('estoqueProduto').value,
        loja_id: document.getElementById('estoqueLoja').value,
        local_id: document.getElementById('estoqueLocal').value || null,
        quantidade: parseInt(document.getElementById('estoqueQtd').value),
        valor_unitario: parseFloat(document.getElementById('estoqueValor').value) || 0,
        validade: document.getElementById('estoqueValidade').value,
        lote: document.getElementById('estoqueLote').value || null,
        usuario_id: userData.id
    };

    try {
        if (id) {
            const { error } = await supabaseClient.from('coletados').update(data).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('coletados').insert(data);
            if (error) throw error;
        }

        document.getElementById('modalEstoque').classList.remove('active');
        await loadEstoque();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao salvar: ' + error.message);
    }
}

window.editEstoque = async function (id) {
    const item = estoque.find(e => e.id === id);
    if (!item) return;

    document.getElementById('modalTitle').textContent = 'Editar Estoque';
    document.getElementById('estoqueId').value = item.id;
    document.getElementById('estoqueLoja').value = item.loja_id;
    await loadLocais(item.loja_id);
    document.getElementById('estoqueLocal').value = item.local_id || '';
    document.getElementById('estoqueProduto').value = item.produto_id;
    document.getElementById('estoqueQtd').value = item.quantidade;
    document.getElementById('estoqueValor').value = item.valor_unitario !== undefined ? item.valor_unitario : (item.base?.valor_unitario || 0);
    document.getElementById('estoqueValidade').value = item.validade;
    document.getElementById('estoqueLote').value = item.lote || '';

    document.getElementById('modalEstoque').classList.add('active');
};

window.openPerda = function (id) {
    const item = estoque.find(e => e.id === id);
    if (!item) return;

    document.getElementById('perdaEstoqueId').value = item.id;
    document.getElementById('perdaProdutoInfo').textContent =
        `Produto: ${item.base?.descricao} | Qtd disponível: ${item.quantidade}`;
    document.getElementById('perdaQtd').value = item.quantidade;
    document.getElementById('perdaQtd').max = item.quantidade;

    document.getElementById('modalPerda').classList.add('active');
};

async function savePerda(e) {
    e.preventDefault();

    const estoqueId = document.getElementById('perdaEstoqueId').value;
    const item = estoque.find(e => e.id === estoqueId);
    if (!item) return;

    const qtd = parseInt(document.getElementById('perdaQtd').value);
    const valorPerda = (item.base?.valor_unitario || 0) * qtd;

    try {
        // Registrar perda
        const { error: perdaError } = await supabaseClient.from('perdas').insert({
            estoque_id: estoqueId,
            produto_id: item.produto_id,
            loja_id: item.loja_id,
            local_id: item.local_id,
            quantidade: qtd,
            valor_perda: valorPerda,
            motivo: document.getElementById('perdaMotivo').value,
            observacao: document.getElementById('perdaObs').value || null,
            registrado_por: userData.id
        });

        if (perdaError) throw perdaError;

        // Atualizar ou remover estoque
        if (qtd >= item.quantidade) {
            await supabaseClient.from('coletados').delete().eq('id', estoqueId);
        } else {
            await supabaseClient.from('coletados').update({
                quantidade: item.quantidade - qtd
            }).eq('id', estoqueId);
        }

        document.getElementById('modalPerda').classList.remove('active');
        await loadEstoque();
        window.globalUI.showToast('success', 'Perda registrada com sucesso!');
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao registrar perda: ' + error.message);
    }
}
