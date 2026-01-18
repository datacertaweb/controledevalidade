/**
 * DataCerta - Mock Data
 * Dados fictícios para demonstração do sistema
 */

// Produtos mockados
const mockProducts = [
    { id: 1, codigo: 'PRD001', descricao: 'Leite Integral 1L', quantidade: 150, valorUnit: 5.99, validade: '2026-01-15', local: 'Câmara Fria', perdas: 0, usuario: 'João Silva' },
    { id: 2, codigo: 'PRD002', descricao: 'Iogurte Natural 500g', quantidade: 80, valorUnit: 8.50, validade: '2026-01-18', local: 'Câmara Fria', perdas: 5, usuario: 'Maria Santos' },
    { id: 3, codigo: 'PRD003', descricao: 'Queijo Mussarela 400g', quantidade: 45, valorUnit: 24.90, validade: '2026-01-20', local: 'Câmara Fria', perdas: 2, usuario: 'João Silva' },
    { id: 4, codigo: 'PRD004', descricao: 'Presunto Fatiado 200g', quantidade: 60, valorUnit: 15.90, validade: '2026-01-22', local: 'Câmara Fria', perdas: 0, usuario: 'Ana Costa' },
    { id: 5, codigo: 'PRD005', descricao: 'Pão de Forma Integral', quantidade: 35, valorUnit: 9.99, validade: '2026-01-14', local: 'Armazém A', perdas: 8, usuario: 'Pedro Lima' },
    { id: 6, codigo: 'PRD006', descricao: 'Manteiga com Sal 200g', quantidade: 90, valorUnit: 12.50, validade: '2026-02-10', local: 'Câmara Fria', perdas: 0, usuario: 'Maria Santos' },
    { id: 7, codigo: 'PRD007', descricao: 'Cream Cheese 150g', quantidade: 40, valorUnit: 11.90, validade: '2026-01-25', local: 'Câmara Fria', perdas: 3, usuario: 'João Silva' },
    { id: 8, codigo: 'PRD008', descricao: 'Suco de Laranja 1L', quantidade: 120, valorUnit: 7.99, validade: '2026-02-28', local: 'Armazém B', perdas: 0, usuario: 'Ana Costa' },
    { id: 9, codigo: 'PRD009', descricao: 'Requeijão Cremoso 200g', quantidade: 55, valorUnit: 9.90, validade: '2026-01-19', local: 'Câmara Fria', perdas: 1, usuario: 'Pedro Lima' },
    { id: 10, codigo: 'PRD010', descricao: 'Margarina 500g', quantidade: 70, valorUnit: 6.50, validade: '2026-03-15', local: 'Armazém A', perdas: 0, usuario: 'Maria Santos' },
    { id: 11, codigo: 'PRD011', descricao: 'Chocolate ao Leite 100g', quantidade: 200, valorUnit: 4.99, validade: '2026-06-20', local: 'Armazém B', perdas: 0, usuario: 'João Silva' },
    { id: 12, codigo: 'PRD012', descricao: 'Biscoito Cream Cracker', quantidade: 180, valorUnit: 5.50, validade: '2026-08-10', local: 'Armazém A', perdas: 0, usuario: 'Ana Costa' },
    { id: 13, codigo: 'PRD013', descricao: 'Café Torrado 500g', quantidade: 95, valorUnit: 18.90, validade: '2026-12-01', local: 'Depósito Central', perdas: 0, usuario: 'Pedro Lima' },
    { id: 14, codigo: 'PRD014', descricao: 'Açúcar Refinado 1kg', quantidade: 150, valorUnit: 4.99, validade: '2027-01-15', local: 'Depósito Central', perdas: 0, usuario: 'Maria Santos' },
    { id: 15, codigo: 'PRD015', descricao: 'Arroz Integral 1kg', quantidade: 85, valorUnit: 8.90, validade: '2026-11-20', local: 'Depósito Central', perdas: 0, usuario: 'João Silva' },
    { id: 16, codigo: 'PRD016', descricao: 'Feijão Carioca 1kg', quantidade: 100, valorUnit: 9.50, validade: '2026-10-15', local: 'Depósito Central', perdas: 0, usuario: 'Ana Costa' },
    { id: 17, codigo: 'PRD017', descricao: 'Macarrão Espaguete 500g', quantidade: 130, valorUnit: 4.50, validade: '2027-03-10', local: 'Armazém A', perdas: 0, usuario: 'Pedro Lima' },
    { id: 18, codigo: 'PRD018', descricao: 'Molho de Tomate 340g', quantidade: 75, valorUnit: 3.99, validade: '2026-09-25', local: 'Armazém A', perdas: 0, usuario: 'Maria Santos' },
    { id: 19, codigo: 'PRD019', descricao: 'Azeite Extra Virgem 500ml', quantidade: 40, valorUnit: 32.90, validade: '2027-02-28', local: 'Armazém B', perdas: 0, usuario: 'João Silva' },
    { id: 20, codigo: 'PRD020', descricao: 'Vinagre de Maçã 500ml', quantidade: 50, valorUnit: 8.90, validade: '2027-06-15', local: 'Armazém B', perdas: 0, usuario: 'Ana Costa' },
    { id: 21, codigo: 'PRD021', descricao: 'Sal Refinado 1kg', quantidade: 200, valorUnit: 2.50, validade: '2028-01-01', local: 'Depósito Central', perdas: 0, usuario: 'Pedro Lima' },
    { id: 22, codigo: 'PRD022', descricao: 'Farinha de Trigo 1kg', quantidade: 110, valorUnit: 5.90, validade: '2026-08-30', local: 'Depósito Central', perdas: 2, usuario: 'Maria Santos' },
    { id: 23, codigo: 'PRD023', descricao: 'Óleo de Soja 900ml', quantidade: 65, valorUnit: 9.90, validade: '2026-07-20', local: 'Armazém A', perdas: 0, usuario: 'João Silva' },
    { id: 24, codigo: 'PRD024', descricao: 'Leite Condensado 395g', quantidade: 80, valorUnit: 7.50, validade: '2026-12-10', local: 'Armazém B', perdas: 0, usuario: 'Ana Costa' },
    { id: 25, codigo: 'PRD025', descricao: 'Creme de Leite 200g', quantidade: 90, valorUnit: 4.99, validade: '2026-04-15', local: 'Armazém B', perdas: 1, usuario: 'Pedro Lima' },
    { id: 26, codigo: 'PRD026', descricao: 'Achocolatado em Pó 400g', quantidade: 70, valorUnit: 8.90, validade: '2026-10-01', local: 'Armazém A', perdas: 0, usuario: 'Maria Santos' },
    { id: 27, codigo: 'PRD027', descricao: 'Cereal Matinal 300g', quantidade: 55, valorUnit: 14.90, validade: '2026-05-20', local: 'Armazém A', perdas: 0, usuario: 'João Silva' },
    { id: 28, codigo: 'PRD028', descricao: 'Geleia de Morango 300g', quantidade: 45, valorUnit: 11.50, validade: '2026-07-15', local: 'Armazém B', perdas: 0, usuario: 'Ana Costa' },
    { id: 29, codigo: 'PRD029', descricao: 'Mel Puro 500g', quantidade: 30, valorUnit: 25.90, validade: '2027-04-30', local: 'Armazém B', perdas: 0, usuario: 'Pedro Lima' },
    { id: 30, codigo: 'PRD030', descricao: 'Granola Premium 500g', quantidade: 40, valorUnit: 19.90, validade: '2026-06-10', local: 'Armazém A', perdas: 0, usuario: 'Maria Santos' },
    { id: 31, codigo: 'PRD031', descricao: 'Mortadela Fatiada 200g', quantidade: 50, valorUnit: 8.90, validade: '2026-01-16', local: 'Câmara Fria', perdas: 4, usuario: 'João Silva' },
    { id: 32, codigo: 'PRD032', descricao: 'Salame Italiano 100g', quantidade: 25, valorUnit: 18.90, validade: '2026-01-28', local: 'Câmara Fria', perdas: 0, usuario: 'Ana Costa' },
    { id: 33, codigo: 'PRD033', descricao: 'Peito de Peru 200g', quantidade: 35, valorUnit: 22.90, validade: '2026-01-21', local: 'Câmara Fria', perdas: 2, usuario: 'Pedro Lima' },
    { id: 34, codigo: 'PRD034', descricao: 'Bacon Fatiado 200g', quantidade: 40, valorUnit: 16.90, validade: '2026-02-05', local: 'Câmara Fria', perdas: 0, usuario: 'Maria Santos' },
    { id: 35, codigo: 'PRD035', descricao: 'Linguiça Calabresa 500g', quantidade: 30, valorUnit: 19.90, validade: '2026-02-15', local: 'Câmara Fria', perdas: 0, usuario: 'João Silva' }
];

// Perdas mockadas (produtos que já venceram)
const mockLosses = [
    { id: 1, codigo: 'PRD036', descricao: 'Iogurte Grego 400g', quantidadePerdida: 15, valorPerda: 179.85, dataVencimento: '2026-01-05', dataRegistro: '2026-01-06', local: 'Câmara Fria', responsavel: 'João Silva' },
    { id: 2, codigo: 'PRD037', descricao: 'Queijo Brie 150g', quantidadePerdida: 8, valorPerda: 319.20, dataVencimento: '2026-01-03', dataRegistro: '2026-01-04', local: 'Câmara Fria', responsavel: 'Maria Santos' },
    { id: 3, codigo: 'PRD038', descricao: 'Leite Fresco 1L', quantidadePerdida: 25, valorPerda: 199.75, dataVencimento: '2026-01-08', dataRegistro: '2026-01-09', local: 'Câmara Fria', responsavel: 'Ana Costa' },
    { id: 4, codigo: 'PRD039', descricao: 'Pão Francês (pacote)', quantidadePerdida: 30, valorPerda: 149.70, dataVencimento: '2026-01-10', dataRegistro: '2026-01-11', local: 'Armazém A', responsavel: 'Pedro Lima' },
    { id: 5, codigo: 'PRD040', descricao: 'Salgadinho de Festa', quantidadePerdida: 12, valorPerda: 359.88, dataVencimento: '2026-01-02', dataRegistro: '2026-01-03', local: 'Câmara Fria', responsavel: 'João Silva' },
    { id: 6, codigo: 'PRD041', descricao: 'Torta de Limão', quantidadePerdida: 5, valorPerda: 174.50, dataVencimento: '2026-01-07', dataRegistro: '2026-01-08', local: 'Câmara Fria', responsavel: 'Maria Santos' },
    { id: 7, codigo: 'PRD002', descricao: 'Iogurte Natural 500g', quantidadePerdida: 5, valorPerda: 42.50, dataVencimento: '2026-01-01', dataRegistro: '2026-01-02', local: 'Câmara Fria', responsavel: 'Ana Costa' }
];

// Alertas mockados
const mockAlerts = [
    { id: 1, type: 'critical', title: '5 produtos vencem amanhã!', description: 'Leite Integral, Pão de Forma e outros 3 produtos precisam de atenção imediata.', action: 'Ver produtos' },
    { id: 2, type: 'warning', title: '12 produtos vencem em 7 dias', description: 'Verifique os produtos da Câmara Fria que estão próximos ao vencimento.', action: 'Ver produtos' },
    { id: 3, type: 'info', title: 'Relatório semanal disponível', description: 'O relatório de perdas da semana passada está pronto para análise.', action: 'Ver relatório' }
];

// Atividades recentes mockadas
const mockActivities = [
    { id: 1, type: 'add', title: 'Novo produto cadastrado', description: 'Leite Integral 1L foi adicionado ao estoque', time: 'Há 2 minutos', product: 'Leite Integral 1L' },
    { id: 2, type: 'loss', title: 'Perda registrada', description: '15 unidades de Iogurte Grego foram registradas como perda', time: 'Há 1 hora', product: 'Iogurte Grego 400g' },
    { id: 3, type: 'edit', title: 'Produto atualizado', description: 'Quantidade de Queijo Mussarela foi atualizada', time: 'Há 3 horas', product: 'Queijo Mussarela 400g' },
    { id: 4, type: 'alert', title: 'Alerta de validade', description: 'Cream Cheese 150g vence em 7 dias', time: 'Há 5 horas', product: 'Cream Cheese 150g' },
    { id: 5, type: 'add', title: 'Novo produto cadastrado', description: 'Chocolate ao Leite 100g foi adicionado ao estoque', time: 'Há 1 dia', product: 'Chocolate ao Leite 100g' }
];

// Dados para gráficos
const chartData = {
    // Dados para gráfico de colunas (Vencidos vs Estoque por mês)
    columnChart: {
        labels: ['Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan'],
        estoque: [180, 165, 172, 155, 168, 156],
        vencidos: [12, 18, 8, 15, 22, 28]
    },

    // Dados para gráfico de pizza (Distribuição por local)
    pieChart: {
        labels: ['Câmara Fria', 'Armazém A', 'Armazém B', 'Depósito Central'],
        data: [45, 25, 15, 15],
        colors: ['#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4']
    },

    // Dados para gráfico de linha (Tendência de validades)
    lineChart: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        vencimentos: [28, 35, 22, 18, 15, 12]
    },

    // Dados para gráfico de barras (Top 10 perdas)
    barChart: {
        labels: ['Iogurte Grego', 'Queijo Brie', 'Salgadinhos', 'Leite Fresco', 'Torta de Limão', 'Pão Francês', 'Peito de Peru', 'Iogurte Natural', 'Cream Cheese', 'Pão de Forma'],
        data: [319.20, 299.90, 259.88, 199.75, 174.50, 149.70, 127.80, 102.50, 85.50, 79.92]
    },

    // Dados para gráfico de rosca (Perdas por setor)
    donutChart: {
        labels: ['Câmara Fria', 'Armazém A', 'Armazém B', 'Depósito Central'],
        data: [65, 20, 10, 5],
        colors: ['#EF4444', '#F97316', '#EAB308', '#A3E635']
    },

    // Dados para gráfico de valor em estoque
    stockValueChart: {
        labels: ['Câmara Fria', 'Armazém A', 'Armazém B', 'Depósito Central'],
        data: [85420, 45680, 38950, 75628]
    }
};

// Função helper para formatar moeda
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Função helper para formatar data
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

// Função para calcular dias até vencimento
function getDaysUntilExpiry(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(dateString + 'T00:00:00');
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Função para obter status de validade
function getValidityStatus(dateString) {
    const days = getDaysUntilExpiry(dateString);
    if (days < 0) return { class: 'expired', text: 'Vencido', days };
    if (days <= 7) return { class: 'critical', text: `${days}d`, days };
    if (days <= 30) return { class: 'warning', text: `${days}d`, days };
    return { class: 'safe', text: `${days}d`, days };
}

// Exportar dados e funções para uso global
window.mockData = {
    products: mockProducts,
    losses: mockLosses,
    alerts: mockAlerts,
    activities: mockActivities,
    chartData: chartData
};

window.helpers = {
    formatCurrency,
    formatDate,
    getDaysUntilExpiry,
    getValidityStatus
};
