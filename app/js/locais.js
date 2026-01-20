/**
 * DataCerta App - Gerenciamento de Locais
 */

let userData = null;
let lojas = [];
let locais = [];
let selectedLoja = null;

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
    select.innerHTML = '<option value="">Selecione a loja</option>' +
        lojas.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');
}

async function loadLocais() {
    if (!selectedLoja) {
        locais = [];
        renderLocais();
        return;
    }

    const { data } = await supabaseClient
        .from('locais')
        .select('*')
        .eq('loja_id', selectedLoja)
        .order('ordem');

    locais = data || [];
    renderLocais();
}

function renderLocais() {
    const tbody = document.getElementById('locaisTable');

    if (!selectedLoja) {
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
            <td>${local.descricao || '-'}</td>
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
        if (!selectedLoja) return;
        document.getElementById('modalTitle').textContent = 'Novo Local';
        document.getElementById('formLocal').reset();
        document.getElementById('localId').value = '';
        document.getElementById('localOrdem').value = locais.length;
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
        loja_id: selectedLoja,
        nome: document.getElementById('localNome').value,
        descricao: document.getElementById('localDescricao').value || null,
        ordem: parseInt(document.getElementById('localOrdem').value) || 0
    };

    try {
        if (id) {
            const { error } = await supabaseClient.from('locais').update(data).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('locais').insert(data);
            if (error) throw error;
        }

        document.getElementById('modalLocal').classList.remove('active');
        await loadLocais();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao salvar: ' + error.message);
    }
}

window.editLocal = async function (id) {
    const local = locais.find(l => l.id === id);
    if (!local) return;

    document.getElementById('modalTitle').textContent = 'Editar Local';
    document.getElementById('localId').value = local.id;
    document.getElementById('localNome').value = local.nome;
    document.getElementById('localDescricao').value = local.descricao || '';
    document.getElementById('localOrdem').value = local.ordem || 0;

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
