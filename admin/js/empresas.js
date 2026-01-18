/**
 * DataCerta Admin - Gerenciamento de Empresas
 */

let empresas = [];
let planos = [];

// Aguardar Supabase estar pronto
window.addEventListener('supabaseReady', initEmpresas);

// Fallback
setTimeout(() => {
    if (window.supabaseClient) initEmpresas();
}, 500);

let initialized = false;

async function initEmpresas() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const isMaster = await auth.isMasterUser();
        if (!isMaster) {
            alert('Acesso negado.');
            await auth.signOut();
            return;
        }

        // Carregar dados do usuário
        const userData = await auth.getCurrentUserData();
        if (userData) {
            const initials = userData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('userAvatar').textContent = initials;
            document.getElementById('userName').textContent = userData.nome;
        }

        // Carregar dados
        await loadPlanos();
        await loadEmpresas();
    } catch (error) {
        console.error('Erro no init:', error);
    }
}

// Sidebar toggle
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// Modal handlers
const modal = document.getElementById('modalEmpresa');
const btnNova = document.getElementById('btnNovaEmpresa');
const btnClose = document.getElementById('modalClose');
const btnCancel = document.getElementById('btnCancelModal');

btnNova?.addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Nova Empresa';
    document.getElementById('formEmpresa').reset();
    modal.classList.add('active');
});

btnClose?.addEventListener('click', () => modal.classList.remove('active'));
btnCancel?.addEventListener('click', () => modal.classList.remove('active'));
modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
});

// Carregar planos
async function loadPlanos() {
    const { data, error } = await supabaseClient
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('preco_mensal');

    if (error) {
        console.error('Erro ao carregar planos:', error);
        return;
    }

    planos = data || [];

    const select = document.getElementById('empPlano');
    select.innerHTML = '<option value="">Selecione...</option>' +
        planos.map(p => `<option value="${p.id}">${p.nome} - ${formatCurrency(p.preco_mensal)}/mês</option>`).join('');
}

// Carregar empresas
async function loadEmpresas() {
    const { data, error } = await supabaseClient
        .from('empresas')
        .select('*, planos(nome, preco_mensal)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar empresas:', error);
        return;
    }

    empresas = data || [];
    renderEmpresas(empresas);
}

// Renderizar tabela
function renderEmpresas(lista) {
    const tbody = document.getElementById('empresasTable');

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 21h18"/>
                        <path d="M5 21V7l8-4v18"/>
                        <path d="M19 21V11l-6-4"/>
                    </svg>
                    <h3>Nenhuma empresa encontrada</h3>
                    <p>Clique em "Nova Empresa" para cadastrar</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lista.map(emp => `
        <tr>
            <td>
                <strong>${emp.nome}</strong>
                <br><small style="color: var(--text-muted);">${emp.email}</small>
            </td>
            <td>${emp.cnpj || '-'}</td>
            <td>${emp.planos?.nome || 'Sem plano'}</td>
            <td><span class="status-badge ${emp.status}">${formatStatus(emp.status)}</span></td>
            <td>${formatExpiration(emp)}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" title="Editar" onclick="editEmpresa('${emp.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filtros
document.getElementById('searchInput')?.addEventListener('input', applyFilters);
document.getElementById('filterStatus')?.addEventListener('change', applyFilters);

function applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

    let filtered = empresas;

    if (search) {
        filtered = filtered.filter(e =>
            e.nome.toLowerCase().includes(search) ||
            e.email.toLowerCase().includes(search) ||
            (e.cnpj && e.cnpj.includes(search))
        );
    }

    if (status) {
        filtered = filtered.filter(e => e.status === status);
    }

    renderEmpresas(filtered);
}

// Salvar empresa
document.getElementById('formEmpresa')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nome = document.getElementById('empNome').value;
    const cnpj = document.getElementById('empCnpj').value;
    const email = document.getElementById('empEmail').value;
    const telefone = document.getElementById('empTelefone').value;
    const plano_id = document.getElementById('empPlano').value;
    const status = document.getElementById('empStatus').value;

    const adminNome = document.getElementById('adminNome').value;
    const adminEmail = document.getElementById('adminEmail').value;
    const adminSenha = document.getElementById('adminSenha').value;

    try {
        // 1. Criar empresa primeiro
        const { data: empresaData, error: empError } = await supabaseClient
            .from('empresas')
            .insert({
                nome,
                cnpj: cnpj || null,
                email,
                telefone: telefone || null,
                plano_id: plano_id || null,
                status
            })
            .select()
            .single();

        if (empError) throw empError;

        // 2. Criar usuário no auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: adminEmail,
            password: adminSenha,
            options: {
                data: { nome: adminNome }
            }
        });

        if (authError) throw authError;

        // 3. Buscar role admin da empresa (criado pelo trigger)
        const { data: roleAdmin } = await supabaseClient
            .from('roles')
            .select('id')
            .eq('empresa_id', empresaData.id)
            .eq('is_admin', true)
            .single();

        // 4. Criar usuário da empresa
        const { error: userError } = await supabaseClient
            .from('usuarios')
            .insert({
                id: authData.user.id,
                empresa_id: empresaData.id,
                role_id: roleAdmin?.id,
                email: adminEmail,
                nome: adminNome
            });

        if (userError) {
            console.error('Erro ao criar usuario:', userError);
            // Continuar mesmo com erro
        }

        alert('Empresa criada com sucesso!');
        modal.classList.remove('active');
        await loadEmpresas();

    } catch (error) {
        console.error('Erro ao criar empresa:', error);
        alert('Erro ao criar empresa: ' + error.message);
    }
});

// Editar empresa
function editEmpresa(id) {
    alert('Funcionalidade de edição será implementada em breve.');
}

// Helpers
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatStatus(status) {
    const labels = {
        trial: 'Trial',
        ativo: 'Ativo',
        suspenso: 'Suspenso',
        cancelado: 'Cancelado'
    };
    return labels[status] || status;
}

function formatExpiration(emp) {
    if (emp.status === 'trial' && emp.trial_ends_at) {
        const date = new Date(emp.trial_ends_at);
        const daysLeft = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
        if (daysLeft < 0) return '<span style="color: var(--color-danger);">Expirado</span>';
        if (daysLeft <= 3) return `<span style="color: var(--color-warning);">${daysLeft}d restantes</span>`;
        return `${daysLeft}d restantes`;
    }
    if (emp.subscription_ends_at) {
        return new Date(emp.subscription_ends_at).toLocaleDateString('pt-BR');
    }
    return '-';
}
