/**
 * DataCerta App - Gerenciamento de Locais
 */

let userData = null;
let lojas = [];
let locais = [];
let selectedLoja = null;
let isEmpresaSemLoja = false; // Flag para empresas de unidade única

// Categorias
let allCategorias = []; // Todas as categorias únicas da base
let selectedCategorias = []; // Categorias selecionadas no modal

window.addEventListener('supabaseReady', initLocais);
setTimeout(() => { if (window.supabaseClient) initLocais(); }, 500);

let initialized = false;

async function initLocais() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        userData = await auth.getCurrentUserData();
        if (!userData || userData.tipo !== 'empresa') { window.location.href = 'login.html'; return; }

        // Verificar permissão
        if (!auth.hasPermission(userData, 'local.view')) {
            window.globalUI.showAlert('Acesso Negado', 'Você não tem permissão para acessar esta página.', 'error', () => {
                window.location.href = 'dashboard.html';
            });
            return;
        }

        updateUserUI();
        await loadLojas();
        initLocaisEvents();
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

    const select = document.getElementById('lojaFilter');
    const btnNovo = document.getElementById('btnNovoLocal');

    // Se empresa não tem lojas, exibe como unidade única
    if (lojas.length === 0) {
        isEmpresaSemLoja = true;
        selectedLoja = null;
        // Ocultar dropdown e permitir criar locais
        select.closest('.filters')?.classList.add('hidden');
        btnNovo.disabled = false;
        loadLocais();
    } else {
        isEmpresaSemLoja = false;
        select.closest('.filters')?.classList.remove('hidden');
        select.innerHTML = '<option value="">Selecione a loja</option>' +
            lojas.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');
    }
}

async function loadLocais() {
    // Carregar categorias únicas da base de produtos
    await loadAllCategorias();

    // Para empresas sem loja, busca locais diretamente pela empresa
    if (isEmpresaSemLoja) {
        const { data } = await supabaseClient
            .from('locais')
            .select('*, local_categorias(categoria)')
            .eq('empresa_id', userData.empresa_id)
            .is('loja_id', null)
            .order('ordem');

        locais = (data || []).map(l => ({
            ...l,
            categorias: (l.local_categorias || []).map(lc => lc.categoria)
        }));
        renderLocais();
        return;
    }

    // Comportamento normal para empresas com lojas
    if (!selectedLoja) {
        locais = [];
        renderLocais();
        return;
    }

    const { data } = await supabaseClient
        .from('locais')
        .select('*, local_categorias(categoria)')
        .eq('loja_id', selectedLoja)
        .order('ordem');

    locais = (data || []).map(l => ({
        ...l,
        categorias: (l.local_categorias || []).map(lc => lc.categoria)
    }));
    renderLocais();
}

// Carregar todas as categorias únicas da base de produtos
async function loadAllCategorias() {
    const { data, error } = await supabaseClient
        .from('base')
        .select('categoria')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .not('categoria', 'is', null);

    if (error) {
        console.error('Erro ao carregar categorias:', error);
        allCategorias = [];
        return;
    }

    // Extrair categorias únicas e ordenar
    const uniqueCategorias = [...new Set(data.map(p => p.categoria).filter(Boolean))];
    allCategorias = uniqueCategorias.sort();
}

function renderLocais() {
    const tbody = document.getElementById('locaisTable');

    // Só mostrar mensagem de seleção se tem lojas e nenhuma selecionada
    if (!isEmpresaSemLoja && !selectedLoja) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Selecione uma loja para ver os locais</td></tr>';
        return;
    }

    if (locais.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 60px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 10px;">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    <p style="color: var(--text-muted);">Nenhum local cadastrado para esta loja</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = locais.map(local => `
        <tr>
            <td style="width: 60px; text-align: center;">${local.ordem}</td>
            <td><strong>${local.nome}</strong></td>
            <td>${renderCategoriaBadges(local.categorias)}</td>
            <td>
                <span class="validity-badge ${local.ativo ? 'ok' : 'expired'}">
                    ${local.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" title="Editar" onclick="editLocal('${local.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn delete" title="Excluir" onclick="deleteLocal('${local.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
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

    // Filtro de loja
    document.getElementById('lojaFilter')?.addEventListener('change', (e) => {
        selectedLoja = e.target.value || null;
        document.getElementById('btnNovoLocal').disabled = !selectedLoja;
        loadLocais();
    });

    // Modal
    const modal = document.getElementById('modalLocal');
    document.getElementById('btnNovoLocal')?.addEventListener('click', () => {
        // Permitir criar local se tem loja selecionada OU se é empresa sem loja
        if (!selectedLoja && !isEmpresaSemLoja) return;
        document.getElementById('modalTitle').textContent = 'Novo Local';
        document.getElementById('formLocal').reset();
        document.getElementById('localId').value = '';
        document.getElementById('localOrdem').value = locais.length;
        // Renderizar multiselect de categorias (vazio)
        selectedCategorias = [];
        renderCategoriasMultiSelect();
        modal.classList.add('active');
    });

    document.getElementById('modalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    document.getElementById('formLocal')?.addEventListener('submit', saveLocal);
}

// Renomear para evitar conflito
function initLocaisEvents() {
    initEvents();
}

async function saveLocal(e) {
    e.preventDefault();

    const id = document.getElementById('localId').value;

    // Verificar permissão
    const permission = id ? 'local.edit' : 'local.create';
    if (!auth.hasPermission(userData, permission)) {
        window.globalUI.showToast('error', 'Você não tem permissão para realizar esta operação.');
        return;
    }

    const data = {
        loja_id: isEmpresaSemLoja ? null : selectedLoja,
        empresa_id: userData.empresa_id,
        nome: document.getElementById('localNome').value,
        ordem: parseInt(document.getElementById('localOrdem').value) || 0
    };

    try {
        let localId = id;

        if (id) {
            // Update existing local
            const { error } = await supabaseClient.from('locais').update(data).eq('id', id);
            if (error) throw error;
        } else {
            // Insert new local
            const { data: inserted, error } = await supabaseClient.from('locais').insert(data).select('id').single();
            if (error) throw error;
            localId = inserted.id;
        }

        // Salvar categorias vinculadas
        await saveLocalCategorias(localId);

        document.getElementById('modalLocal').classList.remove('active');
        await loadLocais();
        window.globalUI.showToast('success', 'Local salvo com sucesso!');
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao salvar: ' + error.message);
    }
}

// Salvar categorias vinculadas ao local
async function saveLocalCategorias(localId) {
    // Primeiro, remover categorias antigas
    await supabaseClient
        .from('local_categorias')
        .delete()
        .eq('local_id', localId);

    // Inserir novas categorias
    if (selectedCategorias.length > 0) {
        const records = selectedCategorias.map(cat => ({
            local_id: localId,
            categoria: cat,
            empresa_id: userData.empresa_id
        }));

        const { error } = await supabaseClient.from('local_categorias').insert(records);
        if (error) {
            console.error('Erro ao salvar categorias:', error);
        }
    }
}

window.editLocal = async function (id) {
    const local = locais.find(l => l.id === id);
    if (!local) return;

    document.getElementById('modalTitle').textContent = 'Editar Local';
    document.getElementById('localId').value = local.id;
    document.getElementById('localNome').value = local.nome;
    document.getElementById('localOrdem').value = local.ordem || 0;

    // Pré-selecionar categorias do local
    selectedCategorias = local.categorias || [];
    renderCategoriasMultiSelect();

    document.getElementById('modalLocal').classList.add('active');
};

window.deleteLocal = async function (id) {
    // Verificar permissão
    if (!auth.hasPermission(userData, 'local.delete')) {
        window.globalUI.showToast('error', 'Você não tem permissão para excluir locais.');
        return;
    }

    const confirmed = await window.globalUI.showConfirm('Excluir Local', 'Tem certeza que deseja excluir este local?', 'warning');
    if (!confirmed) return;

    try {
        const { error } = await supabaseClient.from('locais').delete().eq('id', id);
        if (error) throw error;
        await loadLocais();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao excluir: ' + error.message);
    }
};

// =============================================
// FUNÇÕES AUXILIARES PARA CATEGORIAS
// =============================================

// Renderizar badges de categorias na tabela
function renderCategoriaBadges(categorias) {
    if (!categorias || categorias.length === 0) {
        return '<span style="color: var(--text-muted); font-style: italic;">Nenhuma categoria</span>';
    }

    // Mostrar até 3 badges + contador se houver mais
    const maxShow = 3;
    const badges = categorias.slice(0, maxShow).map(cat =>
        `<span style="display: inline-block; background: var(--primary-light, #E0F2F1); color: var(--primary, #14B8A6); 
                padding: 2px 8px; border-radius: 12px; font-size: 11px; margin: 2px;">${cat}</span>`
    ).join('');

    const extra = categorias.length > maxShow
        ? `<span style="color: var(--text-muted); font-size: 11px;"> +${categorias.length - maxShow}</span>`
        : '';

    return badges + extra;
}

// Renderizar multi-select de categorias no modal
function renderCategoriasMultiSelect() {
    const container = document.getElementById('dropdownCategorias');
    if (!container) return;

    container.innerHTML = '';

    if (allCategorias.length === 0) {
        container.innerHTML = '<span style="color: var(--text-muted); padding: 10px;">Nenhuma categoria encontrada na base de produtos</span>';
        return;
    }

    const count = selectedCategorias.length;
    const labelText = count === 0 ? 'Selecione as categorias' : `${count} categoria(s) selecionada(s)`;

    const btn = document.createElement('div');
    btn.className = 'dropdown-btn';
    btn.innerHTML = `<span>${labelText}</span>`;
    btn.style.cssText = 'cursor: pointer; padding: 10px 12px; border: 1px solid var(--border-secondary); border-radius: 8px; background: var(--bg-primary);';

    const content = document.createElement('div');
    content.className = 'dropdown-content';
    content.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border-secondary); border-radius: 8px; max-height: 200px; overflow-y: auto; z-index: 100; display: none;';

    allCategorias.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.style.cssText = 'padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;';
        const isSelected = selectedCategorias.includes(cat);

        item.innerHTML = `
            <input type="checkbox" value="${cat}" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
            <span style="flex: 1;">${cat}</span>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }
            const checkbox = item.querySelector('input');
            const value = checkbox.value;

            if (checkbox.checked) {
                if (!selectedCategorias.includes(value)) selectedCategorias.push(value);
            } else {
                const index = selectedCategorias.indexOf(value);
                if (index > -1) selectedCategorias.splice(index, 1);
            }

            const newCount = selectedCategorias.length;
            btn.querySelector('span').textContent = newCount === 0 ? 'Selecione as categorias' : `${newCount} categoria(s) selecionada(s)`;
        });

        content.appendChild(item);
    });

    container.style.position = 'relative';
    container.appendChild(btn);
    container.appendChild(content);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
    });

    // Fechar ao clicar fora
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            content.style.display = 'none';
        }
    });
}
