
/**
 * DataCerta App - Gestão de Funções e Permissões
 */

let userData = null;
let rolesList = [];
let permissionsList = [];

window.addEventListener('supabaseReady', initRoles);
setTimeout(() => { if (window.supabaseClient) initRoles(); }, 500);

let initialized = false;

async function initRoles() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        userData = await auth.getCurrentUserData();
        if (!userData || userData.tipo !== 'empresa') { window.location.href = 'login.html'; return; }

        // Verificar permissão
        if (!auth.isAdmin(userData) && !auth.hasPermission(userData, 'role.view')) {
            window.globalUI.showAlert('Acesso Negado', 'Você não tem permissão para acessar esta página.', 'error', () => {
                window.location.href = 'dashboard.html';
            });
            return;
        }

        updateUserUI();
        await loadPermissions();
        await loadRoles();
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

async function loadPermissions() {
    const { data, error } = await supabaseClient
        .from('permissions')
        .select('*')
        .order('modulo');

    if (error) console.error('Erro ao carregar permissões:', error);
    permissionsList = data || [];
}

async function loadRoles() {
    // Carregar roles da empresa ou roles padrão (globais)
    // Usando .or para buscar ambos
    const { data, error } = await supabaseClient
        .from('roles')
        .select('*, role_permissions(permission_id)')
        .or(`empresa_id.eq.${userData.empresa_id},is_default.eq.true`)
        .order('nome');

    if (error) {
        console.error('Erro ao carregar roles:', error);
        document.getElementById('rolesTable').innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Erro ao carregar dados.</td></tr>`;
        return;
    }

    rolesList = data || [];
    renderRoles();
}

function renderRoles() {
    const tbody = document.getElementById('rolesTable');
    if (rolesList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhuma função encontrada.</td></tr>`;
        return;
    }

    tbody.innerHTML = rolesList.map(role => {
        const permCount = role.role_permissions ? role.role_permissions.length : 0;
        const isSystem = role.is_default && !role.empresa_id;

        return `
            <tr>
                <td>
                    <strong>${role.nome}</strong>
                    ${isSystem ? '<span style="font-size: 10px; background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; margin-left: 6px;">Sistema</span>' : ''}
                </td>
                <td><span style="color: var(--text-muted); font-size: 13px;">${role.descricao || '-'}</span></td>
                <td><span class="status-badge status-ok">${permCount} permissões</span></td>
                <td>${role.is_default ? 'Sim' : 'Não'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn" title="Editar" onclick="editRole('${role.id}')" ${isSystem ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="action-btn delete" title="Excluir" onclick="deleteRole('${role.id}')" ${isSystem ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
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

    // Modal
    const modal = document.getElementById('modalRole');

    document.getElementById('btnNovaRole')?.addEventListener('click', () => {
        openModal();
    });

    document.getElementById('modalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modal.classList.remove('active'));

    document.getElementById('formRole')?.addEventListener('submit', handleSaveRole);
}

function openModal(role = null) {
    const modal = document.getElementById('modalRole');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('formRole');
    const permissionsContainer = document.getElementById('permissionsContainer');

    title.textContent = role ? 'Editar Função' : 'Nova Função';
    form.reset();
    document.getElementById('roleId').value = role ? role.id : '';

    if (role) {
        document.getElementById('roleNome').value = role.nome;
        document.getElementById('roleDescricao').value = role.descricao || '';
    }

    // Render Permissions
    const currentPermissions = role ? role.role_permissions.map(rp => rp.permission_id) : [];

    // Group permissions by modulo
    const grouped = {};
    permissionsList.forEach(p => {
        if (!grouped[p.modulo]) grouped[p.modulo] = [];
        grouped[p.modulo].push(p);
    });

    let html = '';
    for (const [modulo, perms] of Object.entries(grouped)) {
        html += `
            <div class="permission-group">
                <h4>${modulo}</h4>
                ${perms.map(p => `
                    <label class="permission-item">
                        <input type="checkbox" name="permissions" value="${p.id}" ${currentPermissions.includes(p.id) ? 'checked' : ''}>
                        <span title="${p.descricao || ''}">${p.nome}</span>
                    </label>
                `).join('')}
            </div>
        `;
    }
    permissionsContainer.innerHTML = html;

    modal.classList.add('active');
}

window.editRole = function (id) {
    const role = rolesList.find(r => r.id === id);
    if (role) openModal(role);
};

window.deleteRole = async function (id) {
    const confirmed = await window.globalUI.showConfirm('Excluir Função', 'Tem certeza que deseja excluir esta função? Usuários associados perderão suas permissões.', 'warning');
    if (!confirmed) return;

    try {
        // Primeiro remover permissões associadas (embora cascade possa resolver, é bom garantir)
        await supabaseClient.from('role_permissions').delete().eq('role_id', id);

        const { error } = await supabaseClient
            .from('roles')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadRoles();
    } catch (error) {
        console.error('Erro ao excluir:', error);
        window.globalUI.showToast('error', 'Erro ao excluir: ' + error.message);
    }
};

async function handleSaveRole(e) {
    e.preventDefault();

    const id = document.getElementById('roleId').value;
    const nome = document.getElementById('roleNome').value;
    const descricao = document.getElementById('roleDescricao').value;

    // Get selected permissions
    const selectedPerms = Array.from(document.querySelectorAll('input[name="permissions"]:checked')).map(cb => cb.value);

    try {
        let roleId = id;

        if (id) {
            // Update
            const { error } = await supabaseClient
                .from('roles')
                .update({ nome, descricao })
                .eq('id', id);
            if (error) throw error;
        } else {
            // Create
            const { data, error } = await supabaseClient
                .from('roles')
                .insert({
                    nome,
                    descricao,
                    empresa_id: userData.empresa_id,
                    is_default: false
                })
                .select()
                .single();
            if (error) throw error;
            roleId = data.id;
        }

        // Update Permissions
        // Delete old ones first
        if (id) {
            await supabaseClient.from('role_permissions').delete().eq('role_id', roleId);
        }

        // Insert new ones
        if (selectedPerms.length > 0) {
            const permissionRows = selectedPerms.map(pid => ({
                role_id: roleId,
                permission_id: pid
            }));
            const { error: permError } = await supabaseClient.from('role_permissions').insert(permissionRows);
            if (permError) throw permError;
        }

        document.getElementById('modalRole').classList.remove('active');
        await loadRoles();

    } catch (error) {
        console.error('Erro ao salvar:', error);
        window.globalUI.showToast('error', 'Erro ao salvar: ' + error.message);
    }
}
