/**
 * DataCerta Admin - JavaScript Principal
 */

// Aguardar Supabase estar pronto
window.addEventListener('supabaseReady', initAdmin);

// Fallback se o evento já foi disparado
setTimeout(() => {
    if (window.supabaseClient) initAdmin();
}, 500);

let initialized = false;

async function initAdmin() {
    if (initialized) return;
    initialized = true;

    console.log('Iniciando admin...');

    try {
        const user = await auth.getUser();
        console.log('User:', user);

        if (!user) {
            console.log('Usuário não logado, redirecionando...');
            window.location.href = 'login.html';
            return;
        }

        const isMaster = await auth.isMasterUser();
        console.log('Is Master:', isMaster);

        if (!isMaster) {
            alert('Acesso negado. Você não é um administrador.');
            await auth.signOut();
            return;
        }

        // Carregar dados do usuário
        const userData = await auth.getCurrentUserData();
        console.log('User Data:', userData);

        if (userData) {
            const initials = userData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('userAvatar').textContent = initials;
            document.getElementById('userName').textContent = userData.nome;
        }

        // Carregar dashboard (apenas se estiver na página de dashboard)
        if (document.getElementById('totalEmpresas')) {
            loadDashboard();
        }
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

// Carregar dados do dashboard
async function loadDashboard() {
    try {
        console.log('Carregando dashboard...');

        // Buscar empresas ativas
        const { data: empresas, error: empError } = await supabaseClient
            .from('empresas')
            .select('*, planos(nome)')
            .order('created_at', { ascending: false });

        if (empError) {
            console.error('Erro ao buscar empresas:', empError);
        }

        console.log('Empresas:', empresas);

        const ativas = empresas?.filter(e => e.status === 'ativo' || e.status === 'trial') || [];
        const trials = empresas?.filter(e => e.status === 'trial') || [];
        const trialsExpirando = trials.filter(e => {
            const trialEnd = new Date(e.trial_ends_at);
            const daysLeft = Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24));
            return daysLeft <= 3 && daysLeft >= 0;
        });

        // Atualizar stats
        document.getElementById('totalEmpresas').textContent = ativas.length;
        document.getElementById('trialsExpirando').textContent = trialsExpirando.length;

        // Buscar usuários
        const { count: usuariosCount } = await supabaseClient
            .from('usuarios')
            .select('*', { count: 'exact', head: true });

        document.getElementById('totalUsuarios').textContent = usuariosCount || 0;

        // Calcular receita (empresas ativas * preço do plano)
        let receita = 0;
        for (const emp of empresas?.filter(e => e.status === 'ativo') || []) {
            if (emp.planos?.preco_mensal) {
                receita += parseFloat(emp.planos.preco_mensal);
            }
        }
        document.getElementById('receitaMensal').textContent = formatCurrency(receita);

        // Renderizar tabela de empresas recentes
        renderRecentEmpresas(empresas?.slice(0, 5) || []);

    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// Renderizar empresas recentes
function renderRecentEmpresas(empresas) {
    const tbody = document.getElementById('recentEmpresas');

    if (empresas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 21h18"/>
                        <path d="M5 21V7l8-4v18"/>
                        <path d="M19 21V11l-6-4"/>
                    </svg>
                    <h3>Nenhuma empresa cadastrada</h3>
                    <p>Clique em "Nova Empresa" para começar</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = empresas.map(emp => `
        <tr>
            <td>
                <strong>${emp.nome}</strong>
                <br><small style="color: var(--text-muted);">${emp.email}</small>
            </td>
            <td>${emp.planos?.nome || 'Sem plano'}</td>
            <td><span class="status-badge ${emp.status}">${formatStatus(emp.status)}</span></td>
            <td>${formatDate(emp.created_at)}</td>
        </tr>
    `).join('');
}

// Helpers
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
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
