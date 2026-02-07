/**
 * DataCerta App - Gerenciamento de Usuários
 */

let userData = null;
let usuarios = [];
let roles = [];
let lojas = [];
let permissions = [];

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
            window.globalUI.showAlert('Acesso Negado', 'Você não tem permissão para acessar esta página.', 'error', () => {
                window.location.href = 'dashboard.html';
            });
            return;
        }

        updateUserUI();
        updateUserUI();
        await loadRoles();
        await loadLojas();
        await loadAllPermissions();
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

    const roleSelect = document.getElementById('usuarioRole');
    if (roles.length === 0) {
        roleSelect.innerHTML = '<option value="">Nenhuma função cadastrada</option>';
    } else {
        roleSelect.innerHTML = roles.map(r => `<option value="${r.id}">${r.nome}</option>`).join('');
    }
}

async function loadLojas() {
    const { data } = await supabaseClient
        .from('lojas')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .order('nome');

    lojas = data || [];
    renderLojasCheckboxes();
}

function renderLojasCheckboxes(selectedLojaIds = []) {
    const container = document.getElementById('lojasContainer');

    if (lojas.length === 0) {
        container.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Nenhuma loja cadastrada</span>';
        return;
    }

    container.innerHTML = lojas.map(loja => `
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
            <input type="checkbox" name="usuarioLojas" value="${loja.id}" ${selectedLojaIds.includes(loja.id) ? 'checked' : ''}>
            <span>${loja.nome}</span>
        </label>
    `).join('');
}

async function loadUsuarios() {
    const { data, error } = await supabaseClient
        .from('usuarios')
        .select('*, roles(nome), empresas(nome), usuarios_lojas(lojas(nome))')
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
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 60px; color: var(--text-muted);">Nenhum usuário cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = usuarios.map(u => {
        // Empresa: sempre mostrar nome da empresa
        const empresaNome = u.empresas?.nome || '-';

        // Loja: mostrar lojas vinculadas ou nome da empresa se não tiver loja
        let lojaNome = '-';
        if (u.usuarios_lojas && u.usuarios_lojas.length > 0) {
            // Pegar nomes das lojas vinculadas
            const lojas = u.usuarios_lojas
                .map(ul => ul.lojas?.nome)
                .filter(Boolean);
            lojaNome = lojas.length > 0 ? lojas.join(', ') : empresaNome;
        } else {
            // Sem loja vinculada - mostrar nome da empresa
            lojaNome = empresaNome;
        }

        return `
        <tr>
            <td><strong>${u.nome}</strong></td>
            <td>${u.username || '-'}</td>
            <td>${u.email}</td>
            <td>${empresaNome}</td>
            <td>${lojaNome}</td>
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
    `}).join('');
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
    const modal = document.getElementById('modalUsuario');
    document.getElementById('btnNovoUsuario')?.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Novo Usuário';
        document.getElementById('formUsuario').reset();
        document.getElementById('usuarioId').value = '';
        document.getElementById('usuarioUsername').value = '';
        document.getElementById('usuarioEmail').disabled = false;
        document.getElementById('senhaGroup').style.display = 'block';
        document.getElementById('usuarioSenha').required = true;
        document.getElementById('senhaGroup').style.display = 'block';
        document.getElementById('usuarioSenha').required = true;
        renderLojasCheckboxes(); // Reset lojas checkboxes
        renderPermissionsCheckboxes(); // Reset permissions
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
        window.globalUI.showToast('warning', 'Email ou Usuário é obrigatório.');
        return;
    }

    let usuarioId = id;

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

            console.log('Enviando token (primeiros 10 chars):', session.session.access_token.substring(0, 10) + '...');

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

            // Obter ID do usuário criado (precisa buscar pelo email)
            const { data: newUser } = await supabaseClient
                .from('usuarios')
                .select('id')
                .eq('email', email)
                .single();

            if (newUser) {
                usuarioId = newUser.id;
            }
        }

        // Salvar vínculos de lojas e permissões
        if (usuarioId) {
            await Promise.all([
                saveUsuarioLojas(usuarioId),
                saveUsuarioPermissions(usuarioId)
            ]);
        }

        document.getElementById('modalUsuario').classList.remove('active');
        await loadUsuarios();
        window.globalUI.showToast('success', 'Usuário salvo com sucesso!');
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro ao salvar: ' + error.message);
    }
}

async function saveUsuarioLojas(usuarioId) {
    // Get selected lojas
    const selectedLojas = Array.from(document.querySelectorAll('input[name="usuarioLojas"]:checked'))
        .map(cb => cb.value);

    // Delete existing associations
    await supabaseClient.from('usuarios_lojas').delete().eq('usuario_id', usuarioId);

    // Insert new associations
    if (selectedLojas.length > 0) {
        const rows = selectedLojas.map(loja_id => ({
            usuario_id: usuarioId,
            loja_id
        }));
        await supabaseClient.from('usuarios_lojas').insert(rows);
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

    // Load user's lojas
    const { data: userLojas } = await supabaseClient
        .from('usuarios_lojas')
        .select('loja_id')
        .eq('usuario_id', id);

    const selectedLojaIds = (userLojas || []).map(ul => ul.loja_id);
    renderLojasCheckboxes(selectedLojaIds);

    // Load user's direct permissions
    const { data: userPerms } = await supabaseClient
        .from('usuario_permissions')
        .select('permission_id')
        .eq('usuario_id', id);

    const selectedPermIds = (userPerms || []).map(up => up.permission_id);
    renderPermissionsCheckboxes(selectedPermIds);

    document.getElementById('modalUsuario').classList.add('active');
};

async function loadAllPermissions() {
    const { data } = await supabaseClient
        .from('permissions')
        .select('*')
        .order('modulo')
        .order('nome');

    permissions = data || [];
}

function renderPermissionsCheckboxes(selectedIds = []) {
    const container = document.getElementById('permissoesContainer');

    if (permissions.length === 0) {
        container.innerHTML = '<span style="color: var(--text-muted);">Nenhuma permissão encontrada</span>';
        return;
    }

    // Agrupar por categoria (modulo)
    const grouped = {};
    permissions.forEach(p => {
        const cat = p.modulo || 'Geral';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(p);
    });

    let html = '';
    for (const [cat, perms] of Object.entries(grouped)) {
        html += `<div style="margin-bottom: 10px;">
            <strong style="display: block; font-size: 0.85rem; color: var(--text); margin-bottom: 4px;">${cat.toUpperCase()}</strong>
            ${perms.map(p => `
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer; font-size: 0.9rem;">
                    <input type="checkbox" name="usuarioPermissoes" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}>
                    <span>${p.nome} <small style="color: var(--text-muted);">(${p.codigo})</small></span>
                </label>
            `).join('')}
        </div>`;
    }

    container.innerHTML = html;
}

async function saveUsuarioPermissions(usuarioId) {
    // Get selected permissions
    const selectedPerms = Array.from(document.querySelectorAll('input[name="usuarioPermissoes"]:checked'))
        .map(cb => cb.value);

    // Delete existing direct permissions
    await supabaseClient.from('usuario_permissions').delete().eq('usuario_id', usuarioId);

    // Insert new permissions
    if (selectedPerms.length > 0) {
        const rows = selectedPerms.map(permission_id => ({
            usuario_id: usuarioId,
            permission_id
        }));
        await supabaseClient.from('usuario_permissions').insert(rows);
    }
}

window.toggleUsuario = async function (id, ativo) {
    const action = ativo ? 'desativar' : 'ativar';
    const confirmed = await window.globalUI.showConfirm(`${action.charAt(0).toUpperCase() + action.slice(1)} Usuário`, `Tem certeza que deseja ${action} este usuário?`, 'warning');
    if (!confirmed) return;

    try {
        const { error } = await supabaseClient.from('usuarios').update({
            ativo: !ativo
        }).eq('id', id);
        if (error) throw error;
        await loadUsuarios();
    } catch (error) {
        console.error('Erro:', error);
        window.globalUI.showToast('error', 'Erro: ' + error.message);
    }
};
