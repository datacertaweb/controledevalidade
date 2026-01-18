/**
 * DataCerta App - JavaScript Principal
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
            alert('Usuário não autorizado.');
            await auth.signOut();
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

        // Carregar dashboard
        await loadDashboard();

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
    const { data, error } = await supabaseClient
        .from('lojas')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .order('nome');

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

async function loadDashboard() {
    // Query base para estoque
    let query = supabaseClient
        .from('estoque')
        .select('*, produtos(descricao, valor_unitario), lojas(nome)')
        .eq('lojas.empresa_id', userData.empresa_id);

    if (selectedLoja) {
        query = query.eq('loja_id', selectedLoja);
    }

    const { data: estoque, error } = await query;

    if (error) {
        console.error('Erro ao carregar estoque:', error);
        return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const em7dias = new Date(hoje);
    em7dias.setDate(em7dias.getDate() + 7);

    // Calcular KPIs
    const vencidos = estoque?.filter(e => new Date(e.validade) < hoje) || [];
    const proximos = estoque?.filter(e => {
        const val = new Date(e.validade);
        return val >= hoje && val <= em7dias;
    }) || [];

    document.getElementById('kpiVencidos').textContent = vencidos.length;
    document.getElementById('kpiProximos').textContent = proximos.length;
    document.getElementById('kpiTotal').textContent = estoque?.length || 0;

    // Perdas do mês
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    let perdasQuery = supabaseClient
        .from('perdas')
        .select('valor_perda')
        .gte('created_at', inicioMes.toISOString());

    if (selectedLoja) {
        perdasQuery = perdasQuery.eq('loja_id', selectedLoja);
    }

    const { data: perdas } = await perdasQuery;
    const totalPerdas = perdas?.reduce((sum, p) => sum + parseFloat(p.valor_perda || 0), 0) || 0;
    document.getElementById('kpiPerdas').textContent = formatCurrency(totalPerdas);

    // Gráfico de status
    renderStatusChart(estoque || [], hoje, em7dias);

    // Gráfico de meses
    renderMonthChart(estoque || []);
}

function renderStatusChart(estoque, hoje, em7dias) {
    const ctx = document.getElementById('statusChart')?.getContext('2d');
    if (!ctx) return;

    const vencidos = estoque.filter(e => new Date(e.validade) < hoje).length;
    const criticos = estoque.filter(e => {
        const val = new Date(e.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 3;
    }).length;
    const alertas = estoque.filter(e => {
        const val = new Date(e.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));
        return diff > 3 && diff <= 7;
    }).length;
    const ok = estoque.filter(e => {
        const val = new Date(e.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));
        return diff > 7;
    }).length;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Vencidos', 'Críticos (1-3 dias)', 'Alerta (4-7 dias)', 'OK'],
            datasets: [{
                data: [vencidos, criticos, alertas, ok],
                backgroundColor: ['#EF4444', '#F97316', '#F59E0B', '#10B981'],
                borderWidth: 2,
                borderColor: '#FFFFFF'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            }
        }
    });
}

function renderMonthChart(estoque) {
    const ctx = document.getElementById('monthChart')?.getContext('2d');
    if (!ctx) return;

    const hoje = new Date();
    const meses = [];
    const dados = [];

    for (let i = 0; i < 6; i++) {
        const mes = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + i + 1, 0);

        meses.push(mes.toLocaleDateString('pt-BR', { month: 'short' }));

        const count = estoque.filter(e => {
            const val = new Date(e.validade);
            return val >= mes && val <= fimMes;
        }).length;

        dados.push(count);
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Vencimentos',
                data: dados,
                backgroundColor: '#14B8A6',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#E2E8F0'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function initEvents() {
    // Sidebar toggle
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Filtro de loja
    document.getElementById('lojaFilter')?.addEventListener('change', (e) => {
        selectedLoja = e.target.value || null;
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

// Exportar para outras páginas
window.appData = {
    get userData() { return userData; },
    get empresaData() { return empresaData; },
    get lojas() { return lojas; }
};
