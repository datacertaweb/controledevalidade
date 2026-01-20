/**
 * DataCerta App - Dashboard Principal
 * Painel da Empresa (Cliente)
 */

// Chart.js defaults
Chart.defaults.color = '#475569';
Chart.defaults.borderColor = '#E2E8F0';
Chart.defaults.font.family = "'Inter', sans-serif";

let userData = null;
let empresaData = null;
let lojas = [];
let selectedLoja = null;
let selectedStatus = null;
let dataInicio = null;
let dataFim = null;
let chartInstances = {};

// Aguardar Supabase
window.addEventListener('supabaseReady', initApp);
setTimeout(() => { if (window.supabaseClient) initApp(); }, 500);

let initialized = false;

async function initApp() {
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
            if (userData?.tipo === 'master') {
                window.location.href = '../admin/index.html';
                return;
            }
            window.globalUI.showAlert('Acesso Negado', 'Usuário não autorizado.', 'error', async () => {
                await auth.signOut();
            });
            return;
        }

        // Carregar dados da empresa
        const { data: empresa } = await supabaseClient
            .from('empresas')
            .select('*')
            .eq('id', userData.empresa_id)
            .single();

        empresaData = empresa;

        // Atualizar UI
        updateUserUI();

        // Carregar lojas
        await loadLojas();

        // Carregar dashboard (Legacy - logic moved to dashboard.js)
        // await loadDashboard();

        // Init eventos
        initEvents();

    } catch (error) {
        console.error('Erro na inicialização:', error);
    }
}

function updateUserUI() {
    const initials = userData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = userData.nome;
    document.getElementById('userRole').textContent = userData.roles?.nome || 'Usuário';
    document.getElementById('empresaNome').textContent = empresaData?.nome || 'Empresa';
}

async function loadLojas() {
    // Buscar lojas do usuário (se tiver restrição)
    let userLojaIds = null;
    if (!auth.isAdmin(userData)) {
        userLojaIds = await auth.getUserLojas(userData.id);
    }

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

    const { data, error } = await query;

    if (error) {
        console.error('Erro ao carregar lojas:', error);
        return;
    }

    lojas = data || [];

    const select = document.getElementById('lojaFilter');
    if (select) {
        select.innerHTML = '<option value="">Todas as lojas</option>' +
            lojas.map(l => `<option value="${l.id}">${l.nome}</option>`).join('');
    }
}


// Código legado do dashboard removido em favor do dashboard.js


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
        loadDashboard();
    });

    // Filtros adicionais
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        selectedStatus = e.target.value || null;
        loadDashboard();
    });

    document.getElementById('dataInicioFilter')?.addEventListener('change', (e) => {
        dataInicio = e.target.value || null;
        loadDashboard();
    });

    document.getElementById('dataFimFilter')?.addEventListener('change', (e) => {
        dataFim = e.target.value || null;
        loadDashboard();
    });
}

// Helpers
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR');
}

// Exportar para outras páginas
window.appData = {
    get userData() { return userData; },
    get empresaData() { return empresaData; },
    get lojas() { return lojas; }
};
