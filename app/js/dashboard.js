/**
 * DataCerta Dashboard - Script complementar ao app.js
 * Popula os novos KPIs e gráficos do dashboard redesenhado
 */

// Paleta de cores do projeto (cores atualizadas)
const dashboardColors = {
    yellow: '#FBBF24',
    dark: '#1F2937',
    indigo: '#6366F1',
    red: '#EF4444',
    pink: '#EC4899',
    cyan: '#0EA5E9',
    // cores secundárias usando a paleta principal
    teal: '#0EA5E9',
    green: '#10B981',
    slate: '#64748B'
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

    // Buscar vendidos da empresa
    const { data: vendidos } = await supabaseClient
        .from('vendidos')
        .select('quantidade, valor_total')
        .eq('empresa_id', userData.empresa_id);

    const qtdVendidos = vendidos?.reduce((sum, v) => sum + (v.quantidade || 0), 0) || 0;
    const valorVendidos = vendidos?.reduce((sum, v) => sum + parseFloat(v.valor_total || 0), 0) || 0;

    // Calcular valores
    const valorTotal = estoqueEmpresa.reduce((sum, e) => sum + (e.quantidade * (e.base?.valor_unitario || 0)), 0);
    const valorVence7d = vence7d.reduce((sum, e) => sum + (e.quantidade * (e.base?.valor_unitario || 0)), 0);
    const valorColetados = estoqueEmpresa.reduce((sum, e) => sum + (e.quantidade * (e.base?.valor_unitario || 0)), 0);
    const valorEstoque = ok.reduce((sum, e) => sum + (e.quantidade * (e.base?.valor_unitario || 0)), 0);

    // Atualizar KPIs - Quantidades
    updateElement('kpiVence7d', formatNumber(vence7d.length));
    updateElement('kpiColetados', formatNumber(estoqueEmpresa.length));
    updateElement('kpiColetadosPct', `${Math.round((estoqueEmpresa.length / (estoqueEmpresa.length + qtdPerdas)) * 100) || 0}% da base`);
    updateElement('kpiPerdidos', formatNumber(qtdPerdas));
    updateElement('kpiVencidos', formatNumber(vencidos.length));
    updateElement('kpiVendidosQtd', formatNumber(qtdVendidos));

    // Atualizar KPIs - Valores
    updateElement('kpiValorVence7d', formatCurrency(valorVence7d));
    updateElement('kpiValorColetados', formatCurrency(valorColetados));
    updateElement('kpiValorPerdidos', formatCurrency(totalPerdas));
    updateElement('kpiPrejuizo', formatCurrency(totalPerdas));
    updateElement('kpiVendidosValor', formatCurrency(valorVendidos));

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
                    font: { weight: '600', size: 9 },
                    clamp: true,
                    clip: false
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { size: 9 },
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: { display: false }
            },
            layout: { padding: { top: 25, left: 5, right: 5 } }
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

    // Variação - só calcula se houver dados no mês anterior
    if (mesesData.length >= 2) {
        const atual = mesesData[mesesData.length - 1];
        const anterior = mesesData[mesesData.length - 2];

        // Só mostrar variação se o mês anterior tiver dados
        if (anterior > 0) {
            const variacao = Math.round(((atual - anterior) / anterior) * 100);
            updateElement('statVariacao', (variacao >= 0 ? '+' : '') + variacao + '%');
        } else {
            updateElement('statVariacao', '--');
        }
    } else {
        updateElement('statVariacao', '--');
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

// Toggle menu de exportação
window.toggleExportMenu = function () {
    const menu = document.getElementById('exportMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
};

// Fechar menu ao clicar fora
document.addEventListener('click', (e) => {
    const menu = document.getElementById('exportMenu');
    const dropdown = document.querySelector('.export-dropdown');
    if (menu && dropdown && !dropdown.contains(e.target)) {
        menu.style.display = 'none';
    }
});

// Buscar dados para exportação
async function getDadosExportacao() {
    const userData = window.appData?.userData;
    if (!userData) return null;

    // Buscar estoque
    const { data: estoque } = await supabaseClient
        .from('coletados')
        .select('*, base(id, descricao, categoria, valor_unitario, codigo, empresa_id), lojas(id, nome)')
        .order('validade', { ascending: true });

    const estoqueEmpresa = (estoque || []).filter(e => e.base?.empresa_id === userData.empresa_id);

    // Buscar perdas
    const { data: perdas } = await supabaseClient
        .from('perdas')
        .select('*, base!inner(descricao, categoria, valor_unitario, empresa_id)')
        .eq('base.empresa_id', userData.empresa_id)
        .order('created_at', { ascending: false });

    // Buscar vendidos
    const { data: vendidos } = await supabaseClient
        .from('vendidos')
        .select('*')
        .eq('empresa_id', userData.empresa_id);

    return { estoque: estoqueEmpresa, perdas: perdas || [], vendidos: vendidos || [] };
}

// Calcular status de validade
function calcularStatus(validade) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const val = new Date(validade);
    const diff = Math.ceil((val - hoje) / (1000 * 60 * 60 * 24));

    if (diff < 0) return 'Vencido';
    if (diff <= 3) return 'Crítico';
    if (diff <= 7) return 'Alerta';
    return 'OK';
}

// Exportar PDF
window.exportarPDF = async function () {
    try {
        document.getElementById('exportMenu').style.display = 'none';
        window.globalUI?.showToast('info', 'Gerando PDF... Aguarde.');

        const mainContent = document.querySelector('.main-content');
        if (!mainContent) {
            window.globalUI?.showToast('error', 'Conteúdo não encontrado.');
            return;
        }

        // Capturar com html2canvas
        const canvas = await html2canvas(mainContent, {
            scale: 1.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#F1F5F9',
            logging: false,
            windowWidth: mainContent.scrollWidth,
            windowHeight: mainContent.scrollHeight
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);

        // Criar PDF em landscape A4
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Calcular dimensões para caber em uma página
        const imgRatio = canvas.width / canvas.height;
        const pageRatio = pageWidth / pageHeight;

        let imgWidth, imgHeight;

        if (imgRatio > pageRatio) {
            // Imagem mais larga - ajustar pela largura
            imgWidth = pageWidth - 10;
            imgHeight = imgWidth / imgRatio;
        } else {
            // Imagem mais alta - ajustar pela altura
            imgHeight = pageHeight - 15;
            imgWidth = imgHeight * imgRatio;
        }

        // Centralizar na página
        const xOffset = (pageWidth - imgWidth) / 2;
        const yOffset = 5;

        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, imgWidth, imgHeight);

        // Rodapé
        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(`DataCerta - Gerado em ${new Date().toLocaleString('pt-BR')}`, 10, pageHeight - 3);

        pdf.save(`dashboard-datacerta-${new Date().toISOString().split('T')[0]}.pdf`);
        window.globalUI?.showToast('success', 'PDF exportado com sucesso!');
    } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        window.globalUI?.showToast('error', 'Erro ao gerar PDF: ' + error.message);
    }
};

// Exportar Excel
window.exportarExcel = async function () {
    try {
        document.getElementById('exportMenu').style.display = 'none';
        window.globalUI?.showToast('info', 'Gerando Excel... Aguarde.');

        const dados = await getDadosExportacao();
        if (!dados) {
            window.globalUI?.showToast('error', 'Erro ao buscar dados.');
            return;
        }

        const wb = XLSX.utils.book_new();

        // Aba Estoque
        const estoqueRows = dados.estoque.map(e => ({
            'Código': e.base?.codigo || '-',
            'Produto': e.base?.descricao || '-',
            'Loja': e.lojas?.nome || '-',
            'Categoria': e.base?.categoria || '-',
            'Quantidade': e.quantidade || 0,
            'Valor Unitário': e.base?.valor_unitario || 0,
            'Valor Total': (e.quantidade || 0) * (e.base?.valor_unitario || 0),
            'Validade': new Date(e.validade).toLocaleDateString('pt-BR'),
            'Status': calcularStatus(e.validade),
            'Lote': e.lote || '-'
        }));
        const wsEstoque = XLSX.utils.json_to_sheet(estoqueRows);
        XLSX.utils.book_append_sheet(wb, wsEstoque, 'Estoque');

        // Aba Perdas
        const perdasRows = dados.perdas.map(p => ({
            'Produto': p.base?.descricao || '-',
            'Categoria': p.base?.categoria || '-',
            'Quantidade': p.quantidade || 0,
            'Valor Perda': parseFloat(p.valor_perda || 0),
            'Motivo': p.motivo || '-',
            'Observação': p.observacao || '-',
            'Data': new Date(p.created_at).toLocaleDateString('pt-BR')
        }));
        const wsPerdas = XLSX.utils.json_to_sheet(perdasRows);
        XLSX.utils.book_append_sheet(wb, wsPerdas, 'Perdas');

        // Aba Vendidos
        if (dados.vendidos.length > 0) {
            const vendidosRows = dados.vendidos.map(v => ({
                'Produto': v.produto_nome || '-',
                'Quantidade': v.quantidade || 0,
                'Valor Total': parseFloat(v.valor_total || 0),
                'Data': new Date(v.created_at).toLocaleDateString('pt-BR')
            }));
            const wsVendidos = XLSX.utils.json_to_sheet(vendidosRows);
            XLSX.utils.book_append_sheet(wb, wsVendidos, 'Vendidos');
        }

        XLSX.writeFile(wb, `relatorio-datacerta-${new Date().toISOString().split('T')[0]}.xlsx`);
        window.globalUI?.showToast('success', 'Excel exportado com sucesso!');
    } catch (error) {
        console.error('Erro ao exportar Excel:', error);
        window.globalUI?.showToast('error', 'Erro ao gerar Excel: ' + error.message);
    }
};

// Reload quando filtros mudam
document.getElementById('lojaFilter')?.addEventListener('change', () => loadDashboardData());
document.getElementById('dataInicioFilter')?.addEventListener('change', () => loadDashboardData());
document.getElementById('dataFimFilter')?.addEventListener('change', () => loadDashboardData());

// Carregar desempenho de usuários
async function loadUserPerformance() {
    const userData = window.appData?.userData;
    if (!userData) return;

    try {
        // Buscar todos os usuários da empresa
        const { data: usuarios } = await supabaseClient
            .from('usuarios')
            .select('id, nome')
            .eq('empresa_id', userData.empresa_id)
            .eq('ativo', true);

        if (!usuarios || usuarios.length === 0) {
            renderEmptyState();
            return;
        }

        // Buscar coletas por usuário
        const { data: coletados } = await supabaseClient
            .from('coletados')
            .select('usuario_id, quantidade, base!inner(empresa_id)')
            .eq('base.empresa_id', userData.empresa_id);

        // Buscar perdas por usuário (registrado_por)
        const { data: perdas } = await supabaseClient
            .from('perdas')
            .select('registrado_por, quantidade, base!inner(empresa_id)')
            .eq('base.empresa_id', userData.empresa_id);

        // Contagem de coletas por usuário
        const coletasPorUsuario = {};
        (coletados || []).forEach(c => {
            if (c.usuario_id) {
                coletasPorUsuario[c.usuario_id] = (coletasPorUsuario[c.usuario_id] || 0) + (c.quantidade || 1);
            }
        });

        // Contagem de perdas por usuário
        const perdasPorUsuario = {};
        (perdas || []).forEach(p => {
            if (p.registrado_por) {
                perdasPorUsuario[p.registrado_por] = (perdasPorUsuario[p.registrado_por] || 0) + (p.quantidade || 1);
            }
        });

        // Mapear usuários com suas estatísticas
        const usuariosStats = usuarios.map(u => ({
            id: u.id,
            nome: u.nome,
            coletas: coletasPorUsuario[u.id] || 0,
            perdas: perdasPorUsuario[u.id] || 0,
            total: (coletasPorUsuario[u.id] || 0) + (perdasPorUsuario[u.id] || 0)
        }));

        // Top 3 Coletas
        const topColetas = [...usuariosStats]
            .sort((a, b) => b.coletas - a.coletas)
            .slice(0, 3);

        // Top 3 Perdas
        const topPerdas = [...usuariosStats]
            .sort((a, b) => b.perdas - a.perdas)
            .slice(0, 3);

        // Menos Ativos (usuários com menor total de ações)
        const menosAtivos = [...usuariosStats]
            .sort((a, b) => a.total - b.total)
            .slice(0, 3);

        // Renderizar cards
        renderUserList('usuariosColetas', topColetas, 'coletas', '#10B981');
        renderUserList('usuariosPerdas', topPerdas, 'perdas', '#EF4444');
        renderUserList('usuariosMenosAtivos', menosAtivos, 'total', '#F59E0B');

    } catch (error) {
        console.error('Erro ao carregar desempenho de usuários:', error);
        renderEmptyState();
    }
}

function renderUserList(containerId, users, field, color) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (users.length === 0 || users.every(u => u[field] === 0)) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;">
                Sem dados disponíveis
            </div>
        `;
        return;
    }

    const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

    container.innerHTML = users.map((user, index) => `
        <div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; ${index < users.length - 1 ? 'border-bottom: 1px solid var(--border-secondary);' : ''}">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: ${medalColors[index] || '#E5E7EB'}; 
                 display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: ${index === 0 ? '#1F2937' : '#FFF'};">
                ${index + 1}
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${user.nome}
                </div>
            </div>
            <div style="font-weight: 700; font-size: 14px; color: ${color};">
                ${user[field]}
            </div>
        </div>
    `).join('');
}

function renderEmptyState() {
    ['usuariosColetas', 'usuariosPerdas', 'usuariosMenosAtivos'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;">Sem dados disponíveis</div>`;
        }
    });
}

// Chamar após carregar dados do dashboard
const originalLoadDashboardData = loadDashboardData;
window.loadDashboardDataWithUsers = async function () {
    await originalLoadDashboardData();
    await loadUserPerformance();
};

// Substituir chamada inicial
setTimeout(() => {
    if (window.appData?.userData) {
        loadUserPerformance();
    }
}, 2500);
