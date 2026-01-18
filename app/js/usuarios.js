/**
 * DataCerta App - Gerenciamento de Usuários
 */

let userData = null;
let usuarios = [];
let roles = [];

window.addEventListener('supabaseReady', initUsuarios);
setTimeout(() => { if (window.supabaseClient) initUsuarios(); }, 500);

let initialized = false;

async function initUsuarios() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        userData = await auth.getCurrentUserData();
        if (!userData || userData.tipo !== 'empresa') { window.location.href = 'login.html'; return; }

        // Verificar permissão
        if (!auth.hasPermission(userData, 'usuario.view')) {
            alert('Você não tem permissão para acessar esta página.');
            window.location.href = 'index.html';
            return;
        }

        updateUserUI();
        await loadRoles();
        await loadUsuarios();
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

async function loadRoles() {
    const { data } = await supabaseClient
        .from('roles')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .order('nome');

    roles = data || [];

    document.getElementById('usuarioRole').innerHTML =
        roles.map(r => `<option value="${r.id}">${r.nome}</option>`).join('');
}

async function loadUsuarios() {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('*, roles(nome)')
        .eq('empresa_id', userData.empresa_id)
        .order('nome');

    if (error) {
        console.error('Erro:', error);
        return;
    }

    usuarios = data || [];
    renderUsuarios();
}

function renderUsuarios() {
    const tbody = document.getElementById('usuariosTable');

    if (usuarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 60px; color: var(--text-muted);">Nenhum usuário cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = usuarios.map(u => `
        <tr>
            <td><strong>${u.nome}</strong></td>
            <td>${u.username || '-'}</td>
            <td>${u.email}</td>
            <td>${u.roles?.nome || '-'}</td>
            <td>
                <span class="validity-badge ${u.ativo ? 'ok' : 'expired'}">
                    ${u.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    ${u.id !== userData.id ? `
                        <button class="action-btn" title="Editar" onclick="editUsuario('${u.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="action-btn delete" title="Desativar" onclick="toggleUsuario('${u.id}', ${u.ativo})">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                ${u.ativo ? '<path d="M18.36 6.64A9 9 0 1 1 5.64 18.36 9 9 0 0 1 18.36 6.64z"/><line x1="2" y1="2" x2="22" y2="22"/>' : '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'}
                            </svg>
                        </button>
                    ` : '<span style="color: var(--text-muted);">Você</span>'}
                </div>
            </td>
        </tr>
    `).join('');
}

function initEvents() {
    // Sidebar
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Modal
    const modal = document.getElementById('modalUsuario');
    document.getElementById('btnNovoUsuario')?.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Novo Usuário';
        document.getElementById('formUsuario').reset();
        document.getElementById('usuarioId').value = '';
        document.getElementById('usuarioUsername').value = '';
        document.getElementById('senhaGroup').style.display = 'block';
        document.getElementById('usuarioSenha').required = true;
        modal.classList.add('active');
    });

    document.getElementById('modalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    document.getElementById('formUsuario')?.addEventListener('submit', saveUsuario);
}

async function saveUsuario(e) {
    e.preventDefault();

    const id = document.getElementById('usuarioId').value;
    const nome = document.getElementById('usuarioNome').value;
    const username = document.getElementById('usuarioUsername').value || null;
    let email = document.getElementById('usuarioEmail').value;
    const senha = document.getElementById('usuarioSenha').value;
    const role_id = document.getElementById('usuarioRole').value || null;

    // Auto-gerar email fictício se não fornecido
    if (!email && username) {
        // Sanitizar username para formato de email válido
        const sanitizedUsername = username
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/\s+/g, '.') // Espaços viram pontos
            .replace(/[^a-z0-9._-]/g, ''); // Remove caracteres inválidos
        email = `${sanitizedUsername}@datacerta.app`;
    }

    if (!email) {
        alert('Email ou Usuário é obrigatório.');
        return;
    }

    try {
        if (id) {
            // Editar usuário existente
            const { error } = await supabaseClient.from('usuarios').update({
                nome,
                username,
                role_id
            }).eq('id', id);
            if (error) throw error;
        } else {
            // Criar novo usuário via Edge Function (Admin API)
            const { data: session } = await supabaseClient.auth.getSession();
            if (!session?.session?.access_token) {
                throw new Error('Sessão inválida. Faça login novamente.');
            }

            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.session.access_token}`
                },
                body: JSON.stringify({
                    email,
                    password: senha,
                    nome,
                    username,
                    empresa_id: userData.empresa_id,
                    role_id
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Erro ao criar usuário');
            }
        }

        document.getElementById('modalUsuario').classList.remove('active');
        await loadUsuarios();
        alert('Usuário salvo com sucesso!');
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao salvar: ' + error.message);
    }
}

window.editUsuario = async function (id) {
    const u = usuarios.find(u => u.id === id);
    if (!u) return;

    document.getElementById('modalTitle').textContent = 'Editar Usuário';
    document.getElementById('usuarioId').value = u.id;
    document.getElementById('usuarioNome').value = u.nome;
    document.getElementById('usuarioUsername').value = u.username || '';
    document.getElementById('usuarioEmail').value = u.email;
    document.getElementById('usuarioEmail').disabled = true;
    document.getElementById('senhaGroup').style.display = 'none';
    document.getElementById('usuarioSenha').required = false;
    document.getElementById('usuarioRole').value = u.role_id || '';

    document.getElementById('modalUsuario').classList.add('active');
};

window.toggleUsuario = async function (id, ativo) {
    const action = ativo ? 'desativar' : 'ativar';
    if (!confirm(`Tem certeza que deseja ${action} este usuário?`)) return;

    try {
        const { error } = await supabaseClient.from('usuarios').update({
            ativo: !ativo
        }).eq('id', id);
        if (error) throw error;
        await loadUsuarios();
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro: ' + error.message);
    }
};
