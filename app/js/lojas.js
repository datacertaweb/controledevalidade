/**
 * DataCerta App - Gerenciamento de Lojas
 */

let userData = null;
let lojas = [];

// Aguardar Supabase
window.addEventListener('supabaseReady', initLojas);
setTimeout(() => { if (window.supabaseClient) initLojas(); }, 500);

let initialized = false;

async function initLojas() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        userData = await auth.getCurrentUserData();
        if (!userData || userData.tipo !== 'empresa') {
            window.location.href = 'login.html';
            return;
        }

        // Verificar permissão
        if (!auth.hasPermission(userData, 'loja.view')) {
            window.globalUI.showAlert('Acesso Negado', 'Você não tem permissão para acessar esta página.', 'error', () => {
                window.location.href = 'dashboard.html';
            });
            return;
        }

        updateUserUI();
        await loadLojas();
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
    const { data, error } = await supabaseClient
        .from('lojas')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .order('nome');

    if (error) {
        console.error('Erro:', error);
        return;
    }

    lojas = data || [];
    renderLojas();
}

function renderLojas() {
    const tbody = document.getElementById('lojasTable');

    if (lojas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 60px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 10px;">
                        <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
                    </svg>
                    <p style="color: var(--text-muted);">Nenhuma loja cadastrada</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lojas.map(loja => `
        <tr>
            <td><strong>${loja.codigo || '-'}</strong></td>
            <td>${loja.nome}</td>
            <td>${loja.cidade || '-'}${loja.uf ? '/' + loja.uf : ''}</td>
            <td>${loja.telefone || '-'}</td>
            <td>
                <span class="validity-badge ${loja.ativo ? 'ok' : 'expired'}">
                    ${loja.ativo ? 'Ativa' : 'Inativa'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" title="Editar" onclick="editLoja('${loja.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn delete" title="Excluir" onclick="deleteLoja('${loja.id}')">
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

    // Modal
    const modal = document.getElementById('modalLoja');
    document.getElementById('btnNovaLoja')?.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Nova Loja';
        document.getElementById('formLoja').reset();
        document.getElementById('lojaId').value = '';
        modal.classList.add('active');
    });

    document.getElementById('modalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    // Form submit
    document.getElementById('formLoja')?.addEventListener('submit', saveLoja);
}

async function saveLoja(e) {
    e.preventDefault();

    const id = document.getElementById('lojaId').value;

    // Verificar permissão
    const permission = id ? 'loja.edit' : 'loja.create';
    if (!auth.hasPermission(userData, permission)) {
        window.globalUI.showToast('error', 'Você não tem permissão para realizar esta operação.');
        return;
    }

    const data = {
        empresa_id: userData.empresa_id,
        codigo: document.getElementById('lojaCodigo').value || null,
        nome: document.getElementById('lojaNome').value,
        endereco: document.getElementById('lojaEndereco').value || null,
        cidade: document.getElementById('lojaCidade').value || null,
        uf: document.getElementById('lojaUF').value?.toUpperCase() || null,
        cep: document.getElementById('lojaCEP').value || null,
        telefone: document.getElementById('lojaTelefone').value || null
    };

    try {
        if (id) {
            const { error } = await supabaseClient.from('lojas').update(data).eq('id', id);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('lojas').insert(data);
            if (error) throw error;
        }

        document.getElementById('modalLoja').classList.remove('active');
        await loadLojas();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao salvar: ' + error.message);
    }
}

window.editLoja = async function (id) {
    const loja = lojas.find(l => l.id === id);
    if (!loja) return;

    document.getElementById('modalTitle').textContent = 'Editar Loja';
    document.getElementById('lojaId').value = loja.id;
    document.getElementById('lojaCodigo').value = loja.codigo || '';
    document.getElementById('lojaNome').value = loja.nome;
    document.getElementById('lojaEndereco').value = loja.endereco || '';
    document.getElementById('lojaCidade').value = loja.cidade || '';
    document.getElementById('lojaUF').value = loja.uf || '';
    document.getElementById('lojaCEP').value = loja.cep || '';
    document.getElementById('lojaTelefone').value = loja.telefone || '';

    document.getElementById('modalLoja').classList.add('active');
};

window.deleteLoja = async function (id) {
    // Verificar permissão
    if (!auth.hasPermission(userData, 'loja.delete')) {
        window.globalUI.showToast('error', 'Você não tem permissão para excluir lojas.');
        return;
    }

    const confirmed = await window.globalUI.showConfirm('Excluir Loja', 'Tem certeza que deseja excluir esta loja?', 'warning');
    if (!confirmed) return;

    try {
        const { error } = await supabaseClient.from('lojas').delete().eq('id', id);
        if (error) throw error;
        await loadLojas();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao excluir: ' + error.message);
    }
};
