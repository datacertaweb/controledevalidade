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
let selectedCategorias = [];
let dataInicio = null;
let dataFim = null;
let userLojaIds = null; // Lojas do usuário (null = todas)
let empresaNome = null; // Nome da empresa (para unidade única)
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

        await Promise.all([loadLojas(), loadProdutos(), loadEmpresaNome()]);
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

    // Inicializar Dropdown de Categorias (após carregar produtos)
    await loadCategorias();
}

let allLocais = []; // Todos os locais da empresa
let localCategoriasMap = {}; // Mapeamento: nome do local -> array de categorias

async function loadAllLocais() {
    // Buscar locais vinculados às categorias da empresa
    const { data } = await supabaseClient
        .from('local_categorias')
        .select('local_id, categoria, locais(id, nome, loja_id)')
        .eq('empresa_id', userData.empresa_id);

    if (!data || data.length === 0) {
        allLocais = [];
        localCategoriasMap = {};
        // Renderizar dropdown vazio mas funcional
        renderMultiSelect('dropdownLocal', [], selectedLocais, (selected) => {
            selectedLocais = selected;
            currentPage = 1;
            filterAndRender();
        });
        return;
    }

    // Extrair locais únicos e criar mapeamento local -> categorias
    const locaisMap = new Map();
    localCategoriasMap = {};

    data.forEach(item => {
        if (item.locais && item.locais.id) {
            locaisMap.set(item.locais.id, item.locais);

            // Adicionar categoria ao mapeamento
            const localNome = item.locais.nome;
            if (!localCategoriasMap[localNome]) {
                localCategoriasMap[localNome] = [];
            }
            if (item.categoria && !localCategoriasMap[localNome].includes(item.categoria)) {
                localCategoriasMap[localNome].push(item.categoria);
            }
        }
    });
    allLocais = Array.from(locaisMap.values());

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

// Carregar categorias únicas dos produtos para o filtro
async function loadCategorias() {
    const { data } = await supabaseClient
        .from('base')
        .select('categoria')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .not('categoria', 'is', null);

    const uniqueCategorias = [...new Set((data || []).map(p => p.categoria).filter(Boolean))].sort();
    const categoriaOptions = uniqueCategorias.map(cat => ({ value: cat, label: cat }));

    renderMultiSelect('dropdownCategoria', categoriaOptions, selectedCategorias, (selected) => {
        selectedCategorias = selected;
        currentPage = 1;
        filterAndRender();
    });
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

// Buscar nome da empresa para exibir quando não há loja (unidade única)
async function loadEmpresaNome() {
    const { data } = await supabaseClient
        .from('empresas')
        .select('nome')
        .eq('id', userData.empresa_id)
        .single();

    empresaNome = data?.nome || null;
}

async function loadEstoque() {
    try {
        // Buscar coletados filtrando pela empresa (base!inner força o join e permite filtrar)
        let query = supabaseClient
            .from('coletados')
            .select('*, base!inner(descricao, valor_unitario, codigo, ean, empresa_id, categoria), lojas(nome), locais(nome), usuarios(id, nome)')
            .eq('base.empresa_id', userData.empresa_id)
            .order('validade');

        const { data, error } = await query;

        if (error) throw error;

        // Filtrar localmente por lojas se o usuário tiver restrição
        if (userLojaIds && userLojaIds.length > 0) {
            estoque = (data || []).filter(e => userLojaIds.includes(e.loja_id));
        } else {
            estoque = data || [];
        }

        console.log('Coletados carregados:', estoque.length);
        filterAndRender();

    } catch (error) {
        console.error('Erro ao carregar coletados:', error);
        window.globalUI?.showToast('error', 'Erro ao carregar estoque: ' + error.message);
    }
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

    // Filtro de Locais - filtra produtos pelas CATEGORIAS vinculadas aos locais selecionados
    if (selectedLocais.length > 0) {
        // Coletar todas as categorias dos locais selecionados
        const categoriasDoLocal = [];
        selectedLocais.forEach(localNome => {
            const categorias = localCategoriasMap[localNome] || [];
            categorias.forEach(cat => {
                if (!categoriasDoLocal.includes(cat)) {
                    categoriasDoLocal.push(cat);
                }
            });
        });

        // Filtrar produtos que possuem a categoria vinculada aos locais selecionados
        filtered = filtered.filter(e => {
            const produtoCategoria = e.base?.categoria || '';
            return categoriasDoLocal.includes(produtoCategoria);
        });
    }

    // Filtro de Categorias (multi-seleção)
    if (selectedCategorias.length > 0) {
        filtered = filtered.filter(e => {
            const categoria = e.base?.categoria || '';
            return selectedCategorias.includes(categoria);
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
                <td colspan="9" style="text-align: center; padding: 60px; color: var(--text-muted);">
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
                    <strong>${item.base?.codigo || item.base?.ean || '-'}</strong>
                </td>
                <td>
                    <strong>${item.base?.descricao || '-'}</strong>
                    ${item.lote ? `<br><small style="color: var(--text-muted);">Lote: ${item.lote}</small>` : ''}
                </td>
                <td>${item.lojas?.nome || empresaNome || '-'}</td>
                <td>${item.base?.categoria || '-'}</td>
                <td>${item.quantidade}</td>
                <td>${val.toLocaleDateString('pt-BR')}</td>
                <td>
                    <span class="validity-badge ${status}">
                        ${diff < 0 ? 'VENCIDO' : diff === 0 ? 'VENCE HOJE' : diff === 1 ? 'VENCE EM 1 DIA' : `VENCE EM ${diff} DIAS`}
                    </span>
                </td>
                <td>${item.usuarios?.nome || '-'}</td>
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
                        <button class="action-btn delete" title="Excluir" onclick="excluirEstoque('${item.id}')">
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
        selectedCategorias = [];
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
        await loadAllLocais();

        // Categorias
        await loadCategorias();

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

    // Helper: Gerenciar exibição do campo Loja
    function gerenciarCampoLoja() {
        const temLojas = lojas && lojas.length > 0;
        const lojaGroup = document.getElementById('formGroupLoja');
        const lojaSelect = document.getElementById('estoqueLoja');
        const lojaLabel = document.getElementById('labelEstoqueLoja');
        const localSelect = document.getElementById('estoqueLocal');

        if (temLojas) {
            // Empresa com lojas: mostrar campo normalmente
            lojaGroup.style.display = '';
            lojaSelect.required = true;
            lojaLabel.textContent = 'Loja *';
        } else {
            // Empresa única: ocultar campo loja
            lojaGroup.style.display = 'none';
            lojaSelect.required = false;
            lojaSelect.value = ''; // Vai salvar como NULL
            // Atualizar locais para não depender de loja
            localSelect.innerHTML = '<option value="">Nenhum</option>';
            if (locais && locais.length > 0) {
                locais.forEach(local => {
                    localSelect.innerHTML += `<option value="${local.id}">${local.nome}</option>`;
                });
            }
        }
    }

    document.getElementById('btnNovoEstoque')?.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Adicionar Estoque';
        document.getElementById('formEstoque').reset();
        document.getElementById('estoqueId').value = '';
        gerenciarCampoLoja();
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

    // Exportar (apenas admin vê o botão)
    const btnExportar = document.getElementById('btnExportar');
    if (btnExportar) {
        if (!auth.isAdmin(userData)) {
            btnExportar.style.display = 'none';
        } else {
            btnExportar.addEventListener('click', exportarEstoque);
        }
    }

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

// Função auxiliar para buscar todos os registros em lotes (contorna limite de 1000 do Supabase)
async function fetchAllInBatches(tableName, filters = {}, select = '*', batchSize = 1000) {
    let allData = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        let query = supabaseClient.from(tableName).select(select).range(offset, offset + batchSize - 1);

        // Aplicar filtros
        if (filters.empresa_id) query = query.eq('empresa_id', filters.empresa_id);
        if (filters.loja_ids && filters.loja_ids.length > 0) query = query.in('loja_id', filters.loja_ids);
        if (filters.excluido !== undefined) query = query.eq('excluido', filters.excluido);

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
            allData = allData.concat(data);
            offset += batchSize;
            hasMore = data.length === batchSize; // Se retornou menos que o batch, acabou
        } else {
            hasMore = false;
        }
    }

    return allData;
}

async function exportarEstoque() {
    // Verificação frontend (backup - segurança real está no backend)
    if (!auth.isAdmin(userData)) {
        window.globalUI.showToast('error', 'Apenas administradores podem exportar dados.');
        return;
    }

    // Mostrar loading
    window.globalUI.showToast('info', 'Preparando exportação... Aguarde.');

    try {
        // Usar função RPC segura (verificação de admin no servidor)
        const { data, error } = await supabaseClient.rpc('export_coletados');

        if (error) {
            // Se erro de permissão, mostra mensagem específica
            if (error.message.includes('Acesso negado')) {
                window.globalUI.showToast('error', 'Acesso negado: você não tem permissão para exportar.');
                return;
            }
            throw error;
        }

        if (!data || data.length === 0) {
            window.globalUI.showToast('warning', 'Nenhum item para exportar.');
            return;
        }

        window.globalUI.showToast('info', `Exportando ${data.length} itens...`);

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        // Header
        let csv = 'PRODUTO;CODIGO;LOJA;LOCAL;QUANTIDADE;VALIDADE;LOTE;VALOR;STATUS;DIAS_RESTANTES\n';

        // Dados
        data.forEach(item => {
            const val = new Date(item.validade);
            const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));

            // Formato: VENCIDO ou VENCE EM X DIAS
            let statusText;
            if (diff < 0) statusText = 'VENCIDO';
            else if (diff === 0) statusText = 'VENCE HOJE';
            else if (diff === 1) statusText = 'VENCE EM 1 DIA';
            else statusText = `VENCE EM ${diff} DIAS`;

            csv += `${item.produto_descricao || ''};`;
            csv += `${item.produto_codigo || ''};`;
            csv += `${item.loja_nome || ''};`;
            csv += `${item.local_nome || ''};`;
            csv += `${item.quantidade || ''};`;
            csv += `${val.toLocaleDateString('pt-BR')};`;
            csv += `${item.lote || ''};`;
            csv += `${item.valor_unitario || ''};`;
            csv += `${statusText};`;
            csv += `${diff}\n`;
        });

        // Download
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `estoque_validade_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        window.globalUI.showToast('success', `${data.length} itens exportados com sucesso!`);
    } catch (error) {
        console.error('Erro ao exportar:', error);
        window.globalUI.showToast('error', 'Erro ao exportar: ' + error.message);
    }
}

async function saveEstoque(e) {
    e.preventDefault();

    const id = document.getElementById('estoqueId').value;
    const data = {
        produto_id: document.getElementById('estoqueProduto').value,
        loja_id: document.getElementById('estoqueLoja').value || null,  // NULL para empresas únicas
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

    const temLojas = lojas && lojas.length > 0;
    const lojaGroup = document.getElementById('formGroupLoja');
    const lojaSelect = document.getElementById('estoqueLoja');
    const lojaLabel = document.getElementById('labelEstoqueLoja');
    const localSelect = document.getElementById('estoqueLocal');

    if (temLojas) {
        // Empresa com lojas: mostrar e preencher normalmente
        lojaGroup.style.display = '';
        lojaSelect.required = true;
        lojaLabel.textContent = 'Loja *';
        lojaSelect.value = item.loja_id || '';
        await loadLocaisModal(item.loja_id);
        localSelect.value = item.local_id || '';
    } else {
        // Empresa única: ocultar campo loja
        lojaGroup.style.display = 'none';
        lojaSelect.required = false;
        lojaSelect.value = '';
        // Carregar todos os locais da empresa (não filtrado por loja)
        localSelect.innerHTML = '<option value="">Nenhum</option>';
        if (locais && locais.length > 0) {
            locais.forEach(local => {
                localSelect.innerHTML += `<option value="${local.id}">${local.nome}</option>`;
            });
        }
        localSelect.value = item.local_id || '';
    }

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

// Excluir produto definitivamente (sem registrar perda)
window.excluirEstoque = async function (id) {
    const confirmed = await window.globalUI.showConfirm(
        'Excluir Produto',
        'Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.',
        'warning'
    );
    if (!confirmed) return;

    try {
        // Verificar permissão explicitamente
        if (!auth.hasPermission(userData, 'coletado.delete') && !auth.hasPermission(userData, 'coletado.edit')) {
            throw new Error('Você não tem permissão para excluir produtos.');
        }

        const { data, error } = await window.supabaseClient
            .from('coletados')
            .delete()
            .eq('id', id)
            .select();

        if (error) {
            console.error('Erro do Supabase:', error);
            // Erro comum de RLS
            if (error.code === 'PGRST301' || error.message.includes('violates row-level security')) {
                throw new Error('Sem permissão para excluir este item. Verifique as políticas RLS no Supabase.');
            }
            throw error;
        }

        // Se não retornou dados, pode ser que o item não existe ou RLS bloqueou silenciosamente
        if (!data || data.length === 0) {
            console.warn('Delete não retornou dados. Verificando se item ainda existe...');

            // Tentar buscar o item para ver se ainda existe
            const { data: checkData } = await window.supabaseClient
                .from('coletados')
                .select('id')
                .eq('id', id)
                .single();

            if (checkData) {
                throw new Error('Sem permissão para excluir este item (RLS bloqueou a operação).');
            }
            // Se não achou o item, pode ter sido excluído por outro processo ou não existia
            console.log('Item não encontrado, pode já ter sido excluído.');
        }

        window.globalUI?.showToast('success', 'Produto excluído com sucesso!');
        await loadEstoque();
    } catch (error) {
        console.error('Erro ao excluir:', error);
        window.globalUI?.showToast('error', 'Erro ao excluir: ' + error.message);
    }
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

// ====================================================================
// SISTEMA DE ABAS - DEPÓSITO
// ====================================================================

let currentTabValidade = 'lojas';
let depositoData = [];
let selectedDepositos = [];
let depositoPage = 1;
const depositoItemsPerPage = 25;

// Função para trocar abas
window.switchTabValidade = function (tab) {
    currentTabValidade = tab;

    // Atualizar estilos dos botões
    const tabLojas = document.getElementById('tabLojas');
    const tabDeposito = document.getElementById('tabDeposito');

    if (tab === 'lojas') {
        tabLojas.style.background = 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)';
        tabLojas.style.color = 'white';
        tabDeposito.style.background = 'transparent';
        tabDeposito.style.color = '#6B7280';
    } else {
        tabDeposito.style.background = 'linear-gradient(135deg, #0F766E 0%, #14B8A6 100%)';
        tabDeposito.style.color = 'white';
        tabLojas.style.background = 'transparent';
        tabLojas.style.color = '#6B7280';
    }

    // Mostrar/ocultar conteúdos
    document.getElementById('contentLojas').style.display = tab === 'lojas' ? 'block' : 'none';
    document.getElementById('contentDeposito').style.display = tab === 'deposito' ? 'block' : 'none';

    // Carregar dados do depósito sempre que a aba for selecionada
    if (tab === 'deposito') {
        console.log('Carregando dados do depósito...');
        loadDeposito();
    }
};

// Variáveis para paginação de depósito no servidor
let depositoTotalItems = 0;

// Carregar dados do depósito com paginação no servidor
async function loadDeposito() {
    try {
        console.log('loadDeposito: Iniciando busca... página:', depositoPage);

        const startIndex = (depositoPage - 1) * depositoItemsPerPage;
        const endIndex = startIndex + depositoItemsPerPage - 1;

        // Buscar dados com paginação usando range()
        const { data, error, count } = await supabaseClient
            .from('coletas_deposito')
            .select('*', { count: 'exact' })
            .eq('empresa_id', userData.empresa_id)
            .eq('excluido', false)
            .order('data_coleta', { ascending: false })
            .range(startIndex, endIndex);

        if (error) throw error;

        console.log('loadDeposito: Dados recebidos:', data?.length, 'de', count, 'total');
        depositoData = data || [];
        depositoTotalItems = count || 0;
        selectedDepositos = [];
        renderDeposito();
    } catch (err) {
        console.error('Erro ao carregar depósito:', err);
        document.getElementById('depositoTable').innerHTML = `
            <tr><td colspan="8" style="text-align: center; padding: 40px; color: #DC2626;">
                Erro ao carregar dados: ${err.message}
            </td></tr>
        `;
    }
}

// Renderizar tabela do depósito
function renderDeposito() {
    console.log('renderDeposito: Iniciando...');
    const tbody = document.getElementById('depositoTable');
    console.log('renderDeposito: tbody encontrado?', !!tbody);
    console.log('renderDeposito: depositoData.length =', depositoData.length);

    if (!tbody) {
        console.error('renderDeposito: Elemento depositoTable não encontrado!');
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Usar total do servidor para paginação
    const totalItems = depositoTotalItems;
    const totalPages = Math.ceil(totalItems / depositoItemsPerPage) || 1;
    if (depositoPage > totalPages) depositoPage = totalPages;
    if (depositoPage < 1) depositoPage = 1;

    const startIndex = (depositoPage - 1) * depositoItemsPerPage;
    const endIndex = Math.min(startIndex + depositoData.length, totalItems);

    // Atualizar UI de paginação
    document.getElementById('paginationInfoDeposito').innerHTML =
        totalItems === 0 ? '0 de 0' : `${startIndex + 1}-${endIndex} de ${totalItems}`;
    document.getElementById('pageNumberDisplayDeposito').textContent = `Página ${depositoPage}`;
    document.getElementById('btnPrevPageDeposito').disabled = depositoPage === 1;
    document.getElementById('btnNextPageDeposito').disabled = depositoPage === totalPages;

    if (depositoData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 60px; color: var(--text-muted);">
                    Nenhuma coleta de depósito encontrada.<br>
                    <a href="pwa/deposito.html" style="color: #0F766E; text-decoration: underline;">Iniciar nova coleta</a>
                </td>
            </tr>
        `;
        return;
    }

    // Usar depositoData diretamente (já vem paginado do servidor)
    tbody.innerHTML = depositoData.map(item => {
        const validade = new Date(item.data_vencimento);
        const diasVencer = Math.ceil((validade - hoje) / (1000 * 60 * 60 * 24));
        const dataColeta = new Date(item.data_coleta);

        // Status com cores
        let statusClass = 'ok';
        if (diasVencer < 0) statusClass = 'expired';
        else if (diasVencer <= 5) statusClass = 'critical';
        else if (diasVencer <= 14) statusClass = 'warning';

        const isChecked = selectedDepositos.includes(item.id);

        return `
            <tr>
                <td><input type="checkbox" class="deposito-checkbox" value="${item.id}" 
                    ${isChecked ? 'checked' : ''} onchange="toggleDepositoCheck('${item.id}')"></td>
                <td><strong>${item.codigo_produto}</strong></td>
                <td>${item.descricao_produto || '-'}</td>
                <td>${validade.toLocaleDateString('pt-BR')}</td>
                <td>
                    <span class="validity-badge ${statusClass}">
                        ${diasVencer < 0 ? 'VENCIDO' : diasVencer === 0 ? 'HOJE' : diasVencer + ' dias'}
                    </span>
                </td>
                <td>${item.usuario_nome || '-'}</td>
                <td>${dataColeta.toLocaleDateString('pt-BR')} ${dataColeta.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" title="Editar" onclick="abrirModalEditarDeposito('${item.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" title="Excluir" onclick="excluirDeposito('${item.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    console.log('renderDeposito: Renderizado', depositoData.length, 'itens');
    updateDepositoActionButtons();
}

// Toggle checkbox individual
window.toggleDepositoCheck = function (id) {
    const index = selectedDepositos.indexOf(id);
    if (index > -1) {
        selectedDepositos.splice(index, 1);
    } else {
        selectedDepositos.push(id);
    }

    // Atualizar checkbox "Selecionar Todos"
    const allCheckboxes = document.querySelectorAll('.deposito-checkbox');
    const selectAllCheckbox = document.getElementById('selectAllDeposito');
    selectAllCheckbox.checked = selectedDepositos.length === allCheckboxes.length && allCheckboxes.length > 0;

    updateDepositoActionButtons();
};

// Toggle selecionar todos
window.toggleSelectAllDeposito = function (checked) {
    const checkboxes = document.querySelectorAll('.deposito-checkbox');
    selectedDepositos = [];

    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
            selectedDepositos.push(cb.value);
        }
    });

    updateDepositoActionButtons();
};

// Atualizar visibilidade dos botões de ação
function updateDepositoActionButtons() {
    const hasSelection = selectedDepositos.length > 0;
    document.getElementById('btnExcluirSelecionadosDeposito').style.display = hasSelection ? 'flex' : 'none';
    document.getElementById('btnImprimirSelecionadosDeposito').style.display = hasSelection ? 'flex' : 'none';
}

// Paginação do depósito - recarrega do servidor
window.mudarPaginaDeposito = function (delta) {
    depositoPage += delta;
    loadDeposito(); // Recarrega do servidor com a nova página
};

// Excluir item do depósito (soft delete)
window.excluirDeposito = async function (id) {
    const confirmed = await window.globalUI.showConfirm(
        'Confirmar Exclusão',
        'Deseja realmente excluir esta coleta?',
        'warning'
    );

    if (!confirmed) return;

    try {
        const { error } = await supabaseClient
            .from('coletas_deposito')
            .update({ excluido: true })
            .eq('id', id)
            .eq('empresa_id', userData.empresa_id);

        if (error) throw error;

        window.globalUI.showToast('success', 'Coleta excluída com sucesso!');
        await loadDeposito();
    } catch (err) {
        console.error('Erro ao excluir:', err);
        window.globalUI.showToast('error', 'Erro ao excluir: ' + err.message);
    }
};

// Excluir selecionados
window.excluirSelecionadosDeposito = async function () {
    if (selectedDepositos.length === 0) return;

    const confirmed = await window.globalUI.showConfirm(
        'Confirmar Exclusão',
        `Deseja realmente excluir ${selectedDepositos.length} coleta(s)?`,
        'warning'
    );

    if (!confirmed) return;

    try {
        const { error } = await supabaseClient
            .from('coletas_deposito')
            .update({ excluido: true })
            .in('id', selectedDepositos)
            .eq('empresa_id', userData.empresa_id);

        if (error) throw error;

        window.globalUI.showToast('success', `${selectedDepositos.length} coleta(s) excluída(s)!`);
        selectedDepositos = [];
        await loadDeposito();
    } catch (err) {
        console.error('Erro ao excluir:', err);
        window.globalUI.showToast('error', 'Erro ao excluir: ' + err.message);
    }
};

// Modal de edição
window.abrirModalEditarDeposito = function (id) {
    const item = depositoData.find(d => d.id === id);
    if (!item) return;

    document.getElementById('editDepositoId').value = item.id;
    document.getElementById('editDepositoCodigo').value = item.codigo_produto;
    document.getElementById('editDepositoDescricao').value = item.descricao_produto || '';
    document.getElementById('editDepositoCategoria').value = item.categoria || '';
    document.getElementById('editDepositoValidade').value = item.data_vencimento;

    document.getElementById('modalEditarDeposito').classList.add('active');
};

window.fecharModalEditarDeposito = function () {
    document.getElementById('modalEditarDeposito').classList.remove('active');
};

window.salvarEdicaoDeposito = async function (e) {
    e.preventDefault();

    const id = document.getElementById('editDepositoId').value;
    const data = {
        descricao_produto: document.getElementById('editDepositoDescricao').value,
        categoria: document.getElementById('editDepositoCategoria').value || null,
        data_vencimento: document.getElementById('editDepositoValidade').value
    };

    try {
        const { error } = await supabaseClient
            .from('coletas_deposito')
            .update(data)
            .eq('id', id)
            .eq('empresa_id', userData.empresa_id);

        if (error) throw error;

        window.globalUI.showToast('success', 'Coleta atualizada com sucesso!');
        fecharModalEditarDeposito();
        await loadDeposito();
    } catch (err) {
        console.error('Erro ao atualizar:', err);
        window.globalUI.showToast('error', 'Erro ao atualizar: ' + err.message);
    }
};

// Imprimir etiquetas selecionadas
window.imprimirSelecionadosDeposito = async function () {
    if (selectedDepositos.length === 0) return;

    const itensSelecionados = depositoData.filter(d => selectedDepositos.includes(d.id));

    const itensComCodigos = await Promise.all(itensSelecionados.map(async (item) => {
        const codigoInformado = item.codigo_produto ? String(item.codigo_produto) : '';
        let codigoBase = '';
        let eanBase = '';
        if (codigoInformado) {
            const { data: eanMatch } = await supabaseClient
                .from('base')
                .select('codigo, ean')
                .eq('empresa_id', userData.empresa_id)
                .eq('ean', codigoInformado)
                .maybeSingle();
            if (eanMatch) {
                codigoBase = eanMatch.codigo || '';
                eanBase = eanMatch.ean || '';
            } else {
                const { data: codeMatch } = await supabaseClient
                    .from('base')
                    .select('codigo, ean')
                    .eq('empresa_id', userData.empresa_id)
                    .eq('codigo', codigoInformado)
                    .maybeSingle();
                if (codeMatch) {
                    codigoBase = codeMatch.codigo || '';
                    eanBase = codeMatch.ean || '';
                } else {
                    codigoBase = codigoInformado;
                }
            }
        }
        return { ...item, codigo_base: codigoBase, ean_base: eanBase };
    }));

    let etiquetasHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Etiquetas de Depósito</title>
            <link href="https://fonts.googleapis.com/css2?family=Comfortaa&display=swap" rel="stylesheet">
            <style>
                @page { size: A4; margin: 0; }
                body {
                    background-color: white;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    width: 19cm;
                    height: 26cm;
                    border: 1px solid #000;
                    margin: 6mm auto 0;
                    border-radius: 5px;
                    user-select: none;
                    display: flex;
                    flex-direction: column;
                }
                .container:not(:last-of-type) { page-break-after: always; }
                .label {
                    font-size: 15px;
                    color: black;
                    padding: 5px;
                    font-family: 'Comfortaa', sans-serif;
                    font-weight: bold;
                }
                .operator {
                    border-bottom: 1px solid;
                    text-align: center;
                    font-weight: 800;
                    font-size: 25px;
                    padding: 0.25rem 0.5rem;
                    user-select: text;
                    font-family: Verdana, Geneva, Tahoma, sans-serif;
                    align-items: center;
                }
                .description {
                    font-weight: 800;
                    font-size: 40px;
                    padding: 10px;
                    border-bottom: 1px solid black;
                    line-height: 1.25;
                    text-align: center;
                    font-family: Verdana, Geneva, Tahoma, sans-serif;
                }
                .product-code {
                    font-weight: 800;
                    font-size: 40px;
                    text-align: center;
                    border-bottom: 1px solid black;
                    padding: 0.25rem 0.5rem;
                    user-select: text;
                    font-family: Verdana, Geneva, Tahoma, sans-serif;
                }
                .grid-labels {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    font-size: 13px;
                    color: #000000;
                    font-family: 'Comfortaa', sans-serif;
                    font-weight: bold;
                }
                .grid-labels div { padding: 15px; }
                .grid-labels div:first-child { border-right: 1px solid black; }
                .grid-values {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    text-align: center;
                    font-family: monospace;
                    font-weight: 800;
                    font-size: 1.5rem;
                    border-right: none;
                    border-top: none;
                    border-bottom: 1px solid black;
                }
                .grid-values div {
                    padding: 10px;
                    user-select: text;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 32px;
                }
                .grid-values div:first-child { border-right: 1px solid black; }
                .big-date {
                    text-align: center;
                    font-family: Arial;
                    font-weight: 600;
                    line-height: 1;
                    user-select: text;
                    margin-bottom: 0;
                }
                .mes, .ano { font-family: Arial, Helvetica, sans-serif; }
                .mes { font-size: 250px; }
                .ano { font-size: 250px; }
            </style>
        </head>
        <body>
    `;

    itensComCodigos.forEach(item => {
        const validadeDate = new Date(item.data_vencimento);
        let mes = '--';
        let ano = '----';
        let dataValidade = '-';
        if (!isNaN(validadeDate)) {
            mes = String(validadeDate.getMonth() + 1).padStart(2, '0');
            ano = validadeDate.getFullYear();
            dataValidade = validadeDate.toLocaleDateString('pt-BR');
        }
        const dataColeta = item.data_coleta ? new Date(item.data_coleta).toLocaleDateString('pt-BR') : '-';
        const codigosProduto = [item.codigo_base, item.ean_base].filter(Boolean).join(' | ');

        etiquetasHtml += `
            <div class="container">
                <div class="label">OPERADOR:</div>
                <div class="operator">${item.usuario_nome || '-'}</div>

                <div class="label">DESCRIÇÃO DO PRODUTO:</div>
                <div class="description">${item.descricao_produto || '-'}</div>

                <div class="label">CÓDIGOS DO PRODUTO:</div>
                <div class="product-code">${codigosProduto || '-'}</div>

                <div class="grid-labels">
                    <div>DATA DE VENCIMENTO:</div>
                    <div>DATA DA COLETA:</div>
                </div>

                <div class="grid-values">
                    <div>${dataValidade}</div>
                    <div>${dataColeta}</div>
                </div>

                <div class="big-date">
                    <div class="mes">${mes}</div>
                    <div class="ano">${ano}</div>
                </div>
            </div>
        `;
    });

    etiquetasHtml += '</body></html>';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(etiquetasHtml);
    printWindow.document.close();

    setTimeout(() => {
        printWindow.print();
    }, 500);
};

