/**
 * DataCerta Dashboard - Script complementar ao app.js
 * Popula os novos KPIs e gráficos do dashboard redesenhado
 */

// Paleta de cores do projeto
const dashboardColors = {
    teal: '#14B8A6',
    blue: '#3B82F6',
    yellow: '#F59E0B',
    red: '#EF4444',
    purple: '#8B5CF6',
    orange: '#F97316',
    green: '#10B981',
    slate: '#64748B',
    cyan: '#06B6D4',
    indigo: '#6366F1'
};

// Instâncias de gráficos
let dashboardCharts = {};

// Aguardar app.js carregar os dados
window.addEventListener('supabaseReady', () => {
    setTimeout(initDashboardCharts, 1000);
});

// Fallback
setTimeout(() => {
    if (window.appData?.userData) {
        initDashboardCharts();
    }
}, 2000);

async function initDashboardCharts() {
    try {
        await loadDashboardData();
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

async function loadDashboardData() {
    const userData = window.appData?.userData;
    if (!userData) return;

    // Buscar todos os coletados com relações
    const { data: estoque, error } = await supabaseClient
        .from('coletados')
        .select('*, base(id, descricao, categoria, valor_unitario, empresa_id), lojas(id, nome)');

    if (error) {
        console.error('Erro ao carregar estoque:', error);
        return;
    }

    // Filtrar pela empresa do usuário
    const estoqueEmpresa = (estoque || []).filter(e => e.base?.empresa_id === userData.empresa_id);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // Calcular métricas
    const em7dias = new Date(hoje);
    em7dias.setDate(em7dias.getDate() + 7);

    const vencidos = estoqueEmpresa.filter(e => new Date(e.validade) < hoje);
    const vence7d = estoqueEmpresa.filter(e => {
        const val = new Date(e.validade);
        return val >= hoje && val <= em7dias;
    });
    const ok = estoqueEmpresa.filter(e => new Date(e.validade) > em7dias);

    // Buscar perdas filtrando pela empresa via produto
    const { data: perdas } = await supabaseClient
        .from('perdas')
        .select('*, base!inner(valor_unitario, categoria, empresa_id)')
        .eq('base.empresa_id', userData.empresa_id);

    const totalPerdas = perdas?.reduce((sum, p) => sum + parseFloat(p.valor_perda || 0), 0) || 0;
    const qtdPerdas = perdas?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0;

    // Calcular valores
    const valorTotal = estoqueEmpresa.reduce((sum, e) => sum + (e.quantidade * (e.base?.valor_unitario || 0)), 0);
    const valorVence7d = vence7d.reduce((sum, e) => sum + (e.quantidade * (e.base?.valor_unitario || 0)), 0);
    const valorColetados = estoqueEmpresa.reduce((sum, e) => sum + (e.quantidade * (e.base?.valor_unitario || 0)), 0);
    const valorEstoque = ok.reduce((sum, e) => sum + (e.quantidade * (e.base?.valor_unitario || 0)), 0);

    // Atualizar KPIs - Quantidades
    updateElement('kpiTotalProdutos', formatNumber(estoqueEmpresa.length));
    updateElement('kpiVence7d', formatNumber(vence7d.length));
    updateElement('kpiColetados', formatNumber(estoqueEmpresa.length));
    updateElement('kpiColetadosPct', `${Math.round((estoqueEmpresa.length / (estoqueEmpresa.length + qtdPerdas)) * 100) || 0}% da base`);
    updateElement('kpiPerdidos', formatNumber(qtdPerdas));
    updateElement('kpiVencidos', formatNumber(vencidos.length));
    updateElement('kpiEmEstoque', formatNumber(ok.length));

    // Atualizar KPIs - Valores
    updateElement('kpiValorTotal', formatCurrency(valorTotal));
    updateElement('kpiValorVence7d', formatCurrency(valorVence7d));
    updateElement('kpiValorColetados', formatCurrency(valorColetados));
    updateElement('kpiValorPerdidos', formatCurrency(totalPerdas));
    updateElement('kpiPrejuizo', formatCurrency(totalPerdas));
    updateElement('kpiValorEstoque', formatCurrency(valorEstoque));

    // Atualizar Stats
    updateElement('statPrejuizoTotal', formatCurrency(totalPerdas));

    // Eficiência
    const totalGeral = estoqueEmpresa.length + qtdPerdas;
    const pctColetados = totalGeral > 0 ? Math.round((estoqueEmpresa.length / totalGeral) * 100) : 0;
    const pctPerdidos = 100 - pctColetados;

    updateElement('effColetadosPct', pctColetados + '%');
    updateElement('effPerdidosPct', pctPerdidos + '%');
    updateElement('effColetadosNum', formatNumber(estoqueEmpresa.length));
    updateElement('effPerdidosNum', formatNumber(qtdPerdas));
    updateElement('effTotalNum', formatNumber(totalGeral));

    const effColetadosBar = document.getElementById('effColetadosBar');
    const effPerdidosBar = document.getElementById('effPerdidosBar');
    if (effColetadosBar) effColetadosBar.style.width = pctColetados + '%';
    if (effPerdidosBar) effPerdidosBar.style.width = pctPerdidos + '%';

    // Renderizar gráficos
    await renderAllCharts(estoqueEmpresa, perdas || [], hoje);
}

async function renderAllCharts(estoque, perdas, hoje) {
    // Agrupar por categoria/setor
    const setores = {};
    estoque.forEach(e => {
        const setor = e.base?.categoria || 'Outros';
        if (!setores[setor]) {
            setores[setor] = { aVencer: 0, noPrazo: 0, perdas: 0, valorPerdas: 0 };
        }
        const val = new Date(e.validade);
        const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));
        if (diff <= 7) setores[setor].aVencer++;
        else setores[setor].noPrazo++;
    });

    // Adicionar perdas por setor
    perdas.forEach(p => {
        const setor = p.base?.categoria || 'Outros';
        if (!setores[setor]) {
            setores[setor] = { aVencer: 0, noPrazo: 0, perdas: 0, valorPerdas: 0 };
        }
        setores[setor].perdas += p.quantidade || 0;
        setores[setor].valorPerdas += parseFloat(p.valor_perda || 0);
    });

    const setorLabels = Object.keys(setores).slice(0, 6);
    const setorData = setorLabels.map(s => setores[s]);

    // 1. Validade por Setor
    renderChart('chartValidadeSetor', {
        type: 'bar',
        data: {
            labels: setorLabels,
            datasets: [
                { label: 'A Vencer', data: setorData.map(d => d.aVencer), backgroundColor: dashboardColors.yellow, borderRadius: 0, barThickness: 18 },
                { label: 'No Prazo', data: setorData.map(d => d.noPrazo), backgroundColor: dashboardColors.green, borderRadius: 0, barThickness: 18 }
            ]
        },
        options: getBarOptions()
    });

    // 2. Perdas por Setor
    renderChart('chartPerdasSetor', {
        type: 'bar',
        data: {
            labels: setorLabels,
            datasets: [{
                data: setorData.map(d => d.perdas),
                backgroundColor: [dashboardColors.teal, dashboardColors.indigo, dashboardColors.yellow, dashboardColors.orange, dashboardColors.cyan, dashboardColors.red],
                borderRadius: 0,
                barThickness: 18
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, datalabels: { display: false } },
            scales: {
                x: { grid: { color: '#F1F5F9' }, beginAtZero: true },
                y: { grid: { display: false } }
            }
        }
    });

    // 3. Valor Perdido por Setor
    renderChart('chartValorPerdasSetor', {
        type: 'bar',
        data: {
            labels: setorLabels,
            datasets: [{
                data: setorData.map(d => d.valorPerdas),
                backgroundColor: dashboardColors.yellow,
                borderRadius: 0,
                barThickness: 24
            }]
        },
        options: {
            ...getBarOptions(),
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    color: dashboardColors.slate,
                    formatter: v => 'R$' + Math.round(v),
                    font: { weight: '600', size: 9 }
                }
            },
            scales: {
                x: { grid: { display: false } },
                y: { display: false }
            },
            layout: { padding: { top: 16 } }
        }
    });

    // 4. Evolução Mensal - buscar perdas por mês
    const mesesLabels = [];
    const mesesData = [];
    for (let i = 4; i >= 0; i--) {
        const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        mesesLabels.push(mes.toLocaleDateString('pt-BR', { month: 'short' }));

        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0);
        const perdasMes = perdas.filter(p => {
            const dt = new Date(p.created_at);
            return dt >= mes && dt <= fimMes;
        });
        mesesData.push(perdasMes.reduce((sum, p) => sum + parseFloat(p.valor_perda || 0), 0));
    }

    renderChart('chartPerdaMensal', {
        type: 'bar',
        data: {
            labels: mesesLabels,
            datasets: [{
                data: mesesData,
                backgroundColor: dashboardColors.red,
                borderRadius: 0,
                barThickness: 28
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, datalabels: { display: false } },
            scales: { x: { grid: { display: false } }, y: { display: false } }
        }
    });

    // Variação
    if (mesesData.length >= 2) {
        const atual = mesesData[mesesData.length - 1];
        const anterior = mesesData[mesesData.length - 2] || 1;
        const variacao = Math.round(((atual - anterior) / anterior) * 100);
        updateElement('statVariacao', (variacao >= 0 ? '+' : '') + variacao + '%');
    }

    // 6. Ranking de Perdas
    const rankingData = Object.entries(setores)
        .map(([nome, data]) => ({ nome, valor: data.valorPerdas }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 6);

    const totalPerdas = rankingData.reduce((sum, r) => sum + r.valor, 0) || 1;

    renderChart('chartRankingPerdas', {
        type: 'bar',
        data: {
            labels: rankingData.map(r => r.nome),
            datasets: [{
                data: rankingData.map(r => Math.round((r.valor / totalPerdas) * 100)),
                backgroundColor: rankingData.map((_, i) => {
                    const opacity = 1 - (i * 0.15);
                    return `rgba(239, 68, 68, ${opacity})`;
                }),
                borderRadius: 0,
                barThickness: 18
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'end',
                    color: dashboardColors.slate,
                    formatter: v => v + '%',
                    font: { weight: '600', size: 10 }
                }
            },
            scales: {
                x: { display: false, max: 50 },
                y: { grid: { display: false } }
            }
        }
    });
}

function renderChart(canvasId, config) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    if (dashboardCharts[canvasId]) {
        dashboardCharts[canvasId].destroy();
    }

    // Registrar plugin se necessário
    if (config.options?.plugins?.datalabels?.display) {
        config.plugins = [ChartDataLabels];
    }

    dashboardCharts[canvasId] = new Chart(ctx, config);
}

function getBarOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', align: 'end', labels: { boxWidth: 8, usePointStyle: true, pointStyle: 'rect', padding: 10, font: { size: 10 } } },
            datalabels: { display: false }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { grid: { color: '#F1F5F9' }, beginAtZero: true, ticks: { font: { size: 10 } } }
        }
    };
}

// Helpers
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num || 0);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value || 0);
}

// Funções globais
window.limparFiltros = function () {
    document.getElementById('lojaFilter').value = '';
    document.getElementById('dataInicioFilter').value = '';
    document.getElementById('dataFimFilter').value = '';
    location.reload();
};

window.exportarRelatorio = function () {
    window.globalUI?.showAlert('Exportar', 'Funcionalidade de exportação em desenvolvimento.', 'info');
};

// Reload quando filtros mudam
document.getElementById('lojaFilter')?.addEventListener('change', () => loadDashboardData());
document.getElementById('dataInicioFilter')?.addEventListener('change', () => loadDashboardData());
document.getElementById('dataFimFilter')?.addEventListener('change', () => loadDashboardData());
