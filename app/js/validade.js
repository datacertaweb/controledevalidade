/**
 * DataCerta App - Controle de Validade
 */

let userData = null;
let lojas = [];
let locais = [];
let produtos = [];
let estoque = [];
let selectedLoja = null;
let selectedLocal = null;
let selectedStatus = null;

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

        updateUserUI();
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
    const { data } = await supabaseClient
        .from('lojas')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .order('nome');

    lojas = data || [];

    // Filtro
    const filterLoja = document.getElementById('filterLoja');
    filterLoja.innerHTML = '<option value="">Todas as lojas</option>' +
        lojas.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');

    // Modal
    const estoqueLoja = document.getElementById('estoqueLoja');
    estoqueLoja.innerHTML = '<option value="">Selecione...</option>' +
        lojas.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');
}

async function loadLocais(lojaId) {
    if (!lojaId) {
        locais = [];
        document.getElementById('filterLocal').innerHTML = '<option value="">Todos os locais</option>';
        document.getElementById('filterLocal').disabled = true;
        document.getElementById('estoqueLocal').innerHTML = '<option value="">Selecione a loja primeiro</option>';
        return;
    }

    const { data } = await supabaseClient
        .from('locais')
        .select('*')
        .eq('loja_id', lojaId)
        .eq('ativo', true)
        .order('ordem');

    locais = data || [];

    document.getElementById('filterLocal').innerHTML = '<option value="">Todos os locais</option>' +
        locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');
    document.getElementById('filterLocal').disabled = false;

    document.getElementById('estoqueLocal').innerHTML = '<option value="">Nenhum</option>' +
        locais.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');
}

async function loadProdutos() {
    const { data } = await supabaseClient
        .from('produtos')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .order('descricao');

    produtos = data || [];

    document.getElementById('estoqueProduto').innerHTML = '<option value="">Selecione...</option>' +
        produtos.map(p => `<option value="${p.id}">${p.descricao} ${p.codigo ? '(' + p.codigo + ')' : ''}</option>`).join('');
}

async function loadEstoque() {
    let query = supabaseClient
        .from('estoque')
        .select('*, produtos(descricao, valor_unitario, codigo), lojas(nome), locais(nome)')
        .order('validade');

    // Filtrar por lojas da empresa - buscar primeiro as lojas
    const lojasIds = lojas.map(l => l.id);
    if (lojasIds.length > 0) {
        query = query.in('loja_id', lojasIds);
    }

    if (selectedLoja) {
        query = query.eq('loja_id', selectedLoja);
    }
    if (selectedLocal) {
        query = query.eq('local_id', selectedLocal);
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

    // Filtro de busca
    if (search) {
        filtered = filtered.filter(e =>
            e.produtos?.descricao?.toLowerCase().includes(search) ||
            e.produtos?.codigo?.toLowerCase().includes(search)
        );
    }

    // Filtro de status
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (selectedStatus) {
        filtered = filtered.filter(e => {
            const status = getStatus(e.validade, hoje);
            return status === selectedStatus;
        });
    }

    // Calcular resumo
    const counts = { expired: 0, critical: 0, warning: 0, ok: 0 };
    estoque.forEach(e => {
        const status = getStatus(e.validade, hoje);
        counts[status]++;
    });

    document.getElementById('countVencidos').textContent = counts.expired;
    document.getElementById('countCriticos').textContent = counts.critical;
    document.getElementById('countAlertas').textContent = counts.warning;
    document.getElementById('countOk').textContent = counts.ok;

    renderEstoque(filtered, hoje);
}

function getStatus(validade, hoje) {
    const val = new Date(validade);
    const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));

    if (diff < 0) return 'expired';
    if (diff <= 3) return 'critical';
    if (diff <= 7) return 'warning';
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

        return `
            <tr>
                <td>
                    <strong>${item.produtos?.descricao || '-'}</strong>
                    ${item.lote ? `<br><small style="color: var(--text-muted);">Lote: ${item.lote}</small>` : ''}
                </td>
                <td>${item.lojas?.nome || '-'}</td>
                <td>${item.locais?.nome || '-'}</td>
                <td>${item.quantidade}</td>
                <td>${val.toLocaleDateString('pt-BR')}</td>
                <td>
                    <span class="validity-badge ${status}">
                        ${statusLabels[status]}
                        ${diff >= 0 ? `(${diff}d)` : ''}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" title="Editar" onclick="editEstoque('${item.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" title="Registrar Perda" onclick="openPerda('${item.id}')">
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
}

function initEvents() {
    // Sidebar
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Filtros
    document.getElementById('filterLoja')?.addEventListener('change', async (e) => {
        selectedLoja = e.target.value || null;
        await loadLocais(selectedLoja);
        await loadEstoque();
    });

    document.getElementById('filterLocal')?.addEventListener('change', (e) => {
        selectedLocal = e.target.value || null;
        filterAndRender();
    });

    document.getElementById('filterStatus')?.addEventListener('change', (e) => {
        selectedStatus = e.target.value || null;
        filterAndRender();
    });

    document.getElementById('filterSearch')?.addEventListener('input', filterAndRender);

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
        await loadLocais(e.target.value);
    });

    document.getElementById('formEstoque')?.addEventListener('submit', saveEstoque);

    // Modal Perda
    const modalPerda = document.getElementById('modalPerda');
    document.getElementById('modalPerdaClose')?.addEventListener('click', () => modalPerda.classList.remove('active'));
    document.getElementById('btnCancelPerda')?.addEventListener('click', () => modalPerda.classList.remove('active'));
    modalPerda?.addEventListener('click', (e) => { if (e.target === modalPerda) modalPerda.classList.remove('active'); });
    document.getElementById('formPerda')?.addEventListener('submit', savePerda);
}

async function saveEstoque(e) {
    e.preventDefault();

    const id = document.getElementById('estoqueId').value;
    const data = {
        produto_id: document.getElementById('estoqueProduto').value,
        loja_id: document.getElementById('estoqueLoja').value,
        local_id: document.getElementById('estoqueLocal').value || null,
        quantidade: parseInt(document.getElementById('estoqueQtd').value),
        validade: document.getElementById('estoqueValidade').value,
        lote: document.getElementById('estoqueLote').value || null,
        usuario_id: userData.id
    };

    try {
        if (id) {
            const { error } = await supabaseClient.from('estoque').update(data).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('estoque').insert(data);
            if (error) throw error;
        }

        document.getElementById('modalEstoque').classList.remove('active');
        await loadEstoque();
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao salvar: ' + error.message);
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
    document.getElementById('estoqueValidade').value = item.validade;
    document.getElementById('estoqueLote').value = item.lote || '';

    document.getElementById('modalEstoque').classList.add('active');
};

window.openPerda = function (id) {
    const item = estoque.find(e => e.id === id);
    if (!item) return;

    document.getElementById('perdaEstoqueId').value = item.id;
    document.getElementById('perdaProdutoInfo').textContent =
        `Produto: ${item.produtos?.descricao} | Qtd disponível: ${item.quantidade}`;
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
    const valorPerda = (item.produtos?.valor_unitario || 0) * qtd;

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
            await supabaseClient.from('estoque').delete().eq('id', estoqueId);
        } else {
            await supabaseClient.from('estoque').update({
                quantidade: item.quantidade - qtd
            }).eq('id', estoqueId);
        }

        document.getElementById('modalPerda').classList.remove('active');
        await loadEstoque();
        alert('Perda registrada com sucesso!');
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao registrar perda: ' + error.message);
    }
}
