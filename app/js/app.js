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

async function loadDashboard() {
    // Buscar estoque com produtos e lojas
    let query = supabaseClient
        .from('coletados')
        .select(`
            *,
            base(id, descricao, categoria, valor_unitario),
            lojas(id, nome, empresa_id)
        `);

    const { data: estoque, error } = await query;

    if (error) {
        console.error('Erro ao carregar estoque:', error);
        return;
    }

    // Filtrar por empresa (através das lojas)
    let estoqueEmpresa = estoque?.filter(e =>
        e.lojas && e.lojas.empresa_id === userData.empresa_id
    ) || [];

    // Filtrar por loja selecionada
    if (selectedLoja) {
        estoqueEmpresa = estoqueEmpresa.filter(e => e.loja_id === selectedLoja);
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Calcular KPIs
    const vencidos = estoqueEmpresa.filter(e => new Date(e.validade) < hoje);
    const criticos = estoqueEmpresa.filter(e => {
        const val = new Date(e.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 3;
    });
    const alertas = estoqueEmpresa.filter(e => {
        const val = new Date(e.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));
        return diff > 3 && diff <= 7;
    });
    const ok = estoqueEmpresa.filter(e => {
        const val = new Date(e.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));
        return diff > 7;
    });

    // Atualizar KPIs
    document.getElementById('kpiVencidos').textContent = vencidos.length;
    document.getElementById('kpiCriticos').textContent = criticos.length;
    document.getElementById('kpiAlertas').textContent = alertas.length;
    document.getElementById('kpiOk').textContent = ok.length;
    document.getElementById('kpiTotal').textContent = estoqueEmpresa.length;

    // Perdas do mês
    await loadPerdas();

    // Renderizar alertas
    renderAlertas(vencidos, criticos, alertas);

    // Renderizar gráficos
    renderMonthChart(estoqueEmpresa);
    renderCategoriaChart(estoqueEmpresa, hoje);
    await renderPerdasChart();

    // Renderizar resumos
    renderCategoriasSummary(estoqueEmpresa, hoje);
    renderLojasSummary(estoqueEmpresa, hoje);
    renderResumoMes(estoqueEmpresa, vencidos, ok);
}

async function loadPerdas() {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    let perdasQuery = supabaseClient
        .from('perdas')
        .select('valor_perda, loja_id')
        .gte('created_at', inicioMes.toISOString());

    if (selectedLoja) {
        perdasQuery = perdasQuery.eq('loja_id', selectedLoja);
    }

    const { data: perdas } = await perdasQuery;
    const totalPerdas = perdas?.reduce((sum, p) => sum + parseFloat(p.valor_perda || 0), 0) || 0;
    document.getElementById('kpiPerdas').textContent = formatCurrency(totalPerdas);
}

function renderAlertas(vencidos, criticos, alertas) {
    const container = document.getElementById('alertsList');

    // Combinar e ordernar por urgência
    const todos = [
        ...vencidos.map(e => ({ ...e, status: 'vencido' })),
        ...criticos.map(e => ({ ...e, status: 'critico' })),
        ...alertas.map(e => ({ ...e, status: 'alerta' }))
    ].slice(0, 10); // Máximo 10 itens

    if (todos.length === 0) {
        container.innerHTML = `
            <div class="alert-item" style="justify-content: center; background: #D1FAE5;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" width="20" height="20">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span style="color: #065F46; margin-left: 8px;">Nenhum produto precisando de atenção urgente!</span>
            </div>
        `;
        return;
    }

    const hoje = new Date();
    container.innerHTML = todos.map(item => {
        const diasParaVencer = Math.ceil((new Date(item.validade) - hoje) / (1000 * 60 * 60 * 24));
        const statusText = {
            vencido: 'VENCIDO',
            critico: `${diasParaVencer}d`,
            alerta: `${diasParaVencer}d`
        };

        return `
            <div class="alert-item ${item.status}">
                <span class="alert-badge ${item.status}">${statusText[item.status]}</span>
                <div class="alert-content">
                    <div class="alert-product">${item.base?.descricao || 'Produto'}</div>
                    <div class="alert-meta">
                        ${item.lojas?.nome || ''} • Lote: ${item.lote || '-'} • 
                        Val: ${formatDate(item.validade)}
                    </div>
                </div>
                <div class="alert-qty">
                    <div class="alert-qty-value">${item.quantidade}</div>
                    <div class="alert-qty-label">unid.</div>
                </div>
            </div>
        `;
    }).join('');
}



function renderMonthChart(estoque) {
    const ctx = document.getElementById('monthChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.month) chartInstances.month.destroy();

    const hoje = new Date();
    const meses = [];
    const dados = [];
    const cores = [];

    for (let i = 0; i < 6; i++) {
        const mes = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + i + 1, 0);

        meses.push(mes.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase());

        const count = estoque.filter(e => {
            const val = new Date(e.validade);
            return val >= mes && val <= fimMes;
        }).length;

        dados.push(count);

        // Cor mais intensa para meses próximos
        if (i === 0) cores.push('#EF4444');
        else if (i === 1) cores.push('#F97316');
        else cores.push('#14B8A6');
    }

    chartInstances.month = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses,
            datasets: [{
                label: 'Vencimentos',
                data: dados,
                backgroundColor: cores,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#FFFFFF',
                    font: { weight: 'bold', size: 14 },
                    anchor: 'center',
                    align: 'center',
                    formatter: (value) => value > 0 ? value : ''
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#E2E8F0' },
                    ticks: { precision: 0 }
                },
                x: {
                    grid: { display: false }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

function renderCategoriaChart(estoque, hoje) {
    const ctx = document.getElementById('categoriaChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.categoria) chartInstances.categoria.destroy();

    // Filtrar próximos 7 dias
    const em7dias = new Date(hoje);
    em7dias.setDate(em7dias.getDate() + 7);

    const proximos = estoque.filter(e => {
        const val = new Date(e.validade);
        return val >= hoje && val <= em7dias;
    });

    // Agrupar por categoria
    const categorias = {};
    proximos.forEach(e => {
        const cat = e.base?.categoria || 'Outros';
        categorias[cat] = (categorias[cat] || 0) + 1;
    });

    const sorted = Object.entries(categorias)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    const coresBase = ['#EF4444', '#F97316', '#F59E0B', '#14B8A6', '#3B82F6', '#8B5CF6'];

    chartInstances.categoria = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(([cat]) => cat.substring(0, 12)),
            datasets: [{
                label: 'Produtos',
                data: sorted.map(([, count]) => count),
                backgroundColor: coresBase.slice(0, sorted.length),
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#FFFFFF',
                    font: { weight: 'bold', size: 12 },
                    anchor: 'center',
                    align: 'center',
                    formatter: (value) => value > 0 ? value : ''
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: '#E2E8F0' },
                    ticks: { precision: 0 }
                },
                y: {
                    grid: { display: false }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

async function renderPerdasChart() {
    const ctx = document.getElementById('perdasChart')?.getContext('2d');
    if (!ctx) return;

    if (chartInstances.perdas) chartInstances.perdas.destroy();

    // Buscar perdas dos últimos 6 meses
    const hoje = new Date();
    const meses = [];
    const dados = [];

    for (let i = 5; i >= 0; i--) {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0);

        meses.push(inicioMes.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase());

        let query = supabaseClient
            .from('perdas')
            .select('valor_perda')
            .gte('created_at', inicioMes.toISOString())
            .lt('created_at', fimMes.toISOString());

        if (selectedLoja) {
            query = query.eq('loja_id', selectedLoja);
        }

        const { data } = await query;
        const total = data?.reduce((sum, p) => sum + parseFloat(p.valor_perda || 0), 0) || 0;
        dados.push(total);
    }

    chartInstances.perdas = new Chart(ctx, {
        type: 'line',
        data: {
            labels: meses,
            datasets: [{
                label: 'Perdas (R$)',
                data: dados,
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#EF4444'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => formatCurrency(ctx.raw)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#E2E8F0' },
                    ticks: {
                        callback: (value) => 'R$ ' + value.toLocaleString('pt-BR')
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderCategoriasSummary(estoque, hoje) {
    const container = document.getElementById('categoriasList');

    // Próximos 7 dias
    const em7dias = new Date(hoje);
    em7dias.setDate(em7dias.getDate() + 7);

    const proximos = estoque.filter(e => {
        const val = new Date(e.validade);
        return val < em7dias;
    });

    // Agrupar por categoria
    const categorias = {};
    proximos.forEach(e => {
        const cat = e.base?.categoria || 'Outros';
        categorias[cat] = (categorias[cat] || 0) + 1;
    });

    const sorted = Object.entries(categorias)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const max = sorted[0]?.[1] || 1;
    const cores = ['#EF4444', '#F97316', '#F59E0B', '#14B8A6', '#3B82F6'];

    if (sorted.length === 0) {
        container.innerHTML = '<div class="summary-item"><span class="summary-item-label" style="color: #10B981;">Nenhum vencimento próximo!</span></div>';
        return;
    }

    container.innerHTML = sorted.map(([cat, count], i) => `
        <div class="summary-item">
            <span class="summary-item-label">${cat}</span>
            <div class="summary-item-bar">
                <div class="summary-item-bar-fill" style="width: ${(count / max) * 100}%; background: ${cores[i]}"></div>
            </div>
            <span class="summary-item-value">${count}</span>
        </div>
    `).join('');
}

function renderLojasSummary(estoque, hoje) {
    const container = document.getElementById('lojasList');

    // Calcular situação por loja
    const lojasData = {};

    estoque.forEach(e => {
        const lojaId = e.loja_id;
        const lojaNome = e.lojas?.nome || 'Desconhecida';

        if (!lojasData[lojaId]) {
            lojasData[lojaId] = { nome: lojaNome, vencidos: 0, total: 0 };
        }

        lojasData[lojaId].total++;

        if (new Date(e.validade) < hoje) {
            lojasData[lojaId].vencidos++;
        }
    });

    const sorted = Object.values(lojasData)
        .sort((a, b) => b.vencidos - a.vencidos);

    if (sorted.length === 0) {
        container.innerHTML = '<div class="summary-item"><span class="summary-item-label">Nenhuma loja com dados</span></div>';
        return;
    }

    container.innerHTML = sorted.map(loja => {
        const taxa = loja.total > 0 ? Math.round(((loja.total - loja.vencidos) / loja.total) * 100) : 100;
        const cor = taxa >= 90 ? '#10B981' : taxa >= 70 ? '#F59E0B' : '#EF4444';

        return `
            <div class="summary-item">
                <span class="summary-item-label">${loja.nome}</span>
                <div class="summary-item-bar">
                    <div class="summary-item-bar-fill" style="width: ${taxa}%; background: ${cor}"></div>
                </div>
                <span class="summary-item-value" style="color: ${cor}">${taxa}%</span>
            </div>
        `;
    }).join('');
}

function renderResumoMes(estoque, vencidos, ok) {
    const total = estoque.length;
    const taxaAproveitamento = total > 0 ? Math.round((ok.length / total) * 100) : 0;

    document.getElementById('taxaAproveitamento').textContent = taxaAproveitamento + '%';
    document.getElementById('taxaAproveitamento').style.color =
        taxaAproveitamento >= 90 ? '#10B981' : taxaAproveitamento >= 70 ? '#F59E0B' : '#EF4444';

    document.getElementById('produtosColetados').textContent = total;

    // Estimativa de perdas evitadas (produtos que passaram pelo sistema e foram vendidos a tempo)
    const valorEstimadoEvitado = ok.length * 15; // Média estimada por produto
    document.getElementById('perdasEvitadas').textContent = formatCurrency(valorEstimadoEvitado);
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

function formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR');
}

// Exportar para outras páginas
window.appData = {
    get userData() { return userData; },
    get empresaData() { return empresaData; },
    get lojas() { return lojas; }
};
