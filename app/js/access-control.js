/**
 * Access Control Middleware
 * DataCerta 2.0 - Sistema de Assinaturas
 * 
 * Este módulo verifica o status da assinatura e limites do plano
 * antes de permitir acesso às funcionalidades do sistema.
 */

// =====================================================
// CONFIGURAÇÕES
// =====================================================

const ACCESS_CONFIG = {
    // Dias de carência após pagamento falhar
    GRACE_PERIOD_DAYS: 3,

    // Mensagens de erro
    MESSAGES: {
        TRIAL_EXPIRED: 'Seu período de teste expirou. Escolha um plano para continuar.',
        SUBSCRIPTION_EXPIRED: 'Sua assinatura expirou. Renove para continuar usando.',
        SUBSCRIPTION_INACTIVE: 'Sua assinatura está inativa. Entre em contato com o suporte.',
        PAYMENT_FAILED: 'Detectamos um problema com seu pagamento. Por favor, atualize seus dados de pagamento.',
        LIMIT_PRODUCTS: 'Você atingiu o limite de produtos do seu plano.',
        LIMIT_USERS: 'Você atingiu o limite de usuários do seu plano.',
        LIMIT_STORES: 'Você atingiu o limite de lojas do seu plano.',
        UPGRADE_REQUIRED: 'Esta funcionalidade requer um plano superior.',
        NO_SUBSCRIPTION: 'Você ainda não possui uma assinatura ativa.'
    }
};

// =====================================================
// VERIFICAÇÃO DE STATUS DA EMPRESA
// =====================================================

/**
 * Verifica o status atual da empresa e retorna informações de acesso
 * @returns {Promise<{hasAccess: boolean, status: string, message: string, empresa: object}>}
 */
async function verificarStatusEmpresa() {
    if (!window.supabaseClient) {
        throw new Error('Supabase não inicializado');
    }

    const userData = await auth.getCurrentUserData();
    if (!userData || !userData.empresa_id) {
        return {
            hasAccess: false,
            status: 'no_company',
            message: 'Empresa não encontrada',
            empresa: null
        };
    }

    // Buscar empresa com assinatura
    const { data: empresa, error } = await window.supabaseClient
        .from('empresas')
        .select(`
            *,
            plano:planos(*),
            assinatura:assinaturas(*)
        `)
        .eq('id', userData.empresa_id)
        .single();

    if (error || !empresa) {
        return {
            hasAccess: false,
            status: 'error',
            message: 'Erro ao carregar dados da empresa',
            empresa: null
        };
    }

    // Verificar status da empresa
    const now = new Date();

    // Status: trial
    if (empresa.status === 'trial') {
        const trialEnd = new Date(empresa.trial_ends_at);

        if (now > trialEnd) {
            return {
                hasAccess: false,
                status: 'trial_expired',
                message: ACCESS_CONFIG.MESSAGES.TRIAL_EXPIRED,
                empresa: empresa,
                redirectTo: 'bloqueado.html?reason=trial_expired'
            };
        }

        const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

        return {
            hasAccess: true,
            status: 'trial',
            message: `Período de teste: ${daysRemaining} dia(s) restante(s)`,
            empresa: empresa,
            daysRemaining: daysRemaining
        };
    }

    // Status: ativo
    if (empresa.status === 'ativo') {
        const subscriptionEnd = new Date(empresa.subscription_ends_at);

        if (now > subscriptionEnd) {
            return {
                hasAccess: false,
                status: 'subscription_expired',
                message: ACCESS_CONFIG.MESSAGES.SUBSCRIPTION_EXPIRED,
                empresa: empresa,
                redirectTo: 'bloqueado.html?reason=subscription_expired'
            };
        }

        return {
            hasAccess: true,
            status: 'active',
            message: 'Assinatura ativa',
            empresa: empresa
        };
    }

    // Status: inadimplente
    if (empresa.status === 'inadimplente') {
        // Verificar período de carência
        const assinatura = empresa.assinatura?.[0];

        if (assinatura && assinatura.data_inadimplencia) {
            const inadimplenciaDate = new Date(assinatura.data_inadimplencia);
            const graceEndDate = new Date(inadimplenciaDate);
            graceEndDate.setDate(graceEndDate.getDate() + ACCESS_CONFIG.GRACE_PERIOD_DAYS);

            if (now <= graceEndDate) {
                const daysRemaining = Math.ceil((graceEndDate - now) / (1000 * 60 * 60 * 24));

                return {
                    hasAccess: true,
                    status: 'grace_period',
                    message: ACCESS_CONFIG.MESSAGES.PAYMENT_FAILED,
                    empresa: empresa,
                    daysRemaining: daysRemaining,
                    showWarning: true
                };
            }
        }

        return {
            hasAccess: false,
            status: 'payment_failed',
            message: ACCESS_CONFIG.MESSAGES.PAYMENT_FAILED,
            empresa: empresa,
            redirectTo: 'bloqueado.html?reason=payment_failed'
        };
    }

    // Status: cancelado ou inativo
    if (empresa.status === 'cancelado' || empresa.status === 'inativo') {
        return {
            hasAccess: false,
            status: 'inactive',
            message: ACCESS_CONFIG.MESSAGES.SUBSCRIPTION_INACTIVE,
            empresa: empresa,
            redirectTo: 'bloqueado.html?reason=inactive'
        };
    }

    // Status desconhecido
    return {
        hasAccess: false,
        status: 'unknown',
        message: ACCESS_CONFIG.MESSAGES.NO_SUBSCRIPTION,
        empresa: empresa,
        redirectTo: 'planos.html'
    };
}

// =====================================================
// VERIFICAÇÃO DE LIMITES DO PLANO
// =====================================================

/**
 * Verifica se pode adicionar mais itens de um tipo específico
 * @param {string} tipo - 'produtos', 'usuarios', 'lojas'
 * @returns {Promise<{allowed: boolean, current: number, limit: number, message: string}>}
 */
async function verificarLimite(tipo) {
    const status = await verificarStatusEmpresa();

    if (!status.hasAccess) {
        return {
            allowed: false,
            current: 0,
            limit: 0,
            message: status.message
        };
    }

    const plano = status.empresa?.plano;
    if (!plano) {
        return {
            allowed: true,
            current: 0,
            limit: 999999,
            message: 'Sem limite definido'
        };
    }

    const userData = await auth.getCurrentUserData();
    let current = 0;
    let limit = 0;

    switch (tipo) {
        case 'produtos':
            limit = plano.max_produtos;
            const { count: countProdutos } = await window.supabaseClient
                .from('base')
                .select('*', { count: 'exact', head: true })
                .eq('empresa_id', userData.empresa_id);
            current = countProdutos || 0;
            break;

        case 'usuarios':
            limit = plano.max_usuarios;
            const { count: countUsuarios } = await window.supabaseClient
                .from('usuarios')
                .select('*', { count: 'exact', head: true })
                .eq('empresa_id', userData.empresa_id)
                .eq('ativo', true);
            current = countUsuarios || 0;
            break;

        case 'lojas':
            limit = plano.max_lojas;
            const { count: countLojas } = await window.supabaseClient
                .from('lojas')
                .select('*', { count: 'exact', head: true })
                .eq('empresa_id', userData.empresa_id)
                .eq('ativo', true);
            current = countLojas || 0;
            break;

        default:
            return {
                allowed: true,
                current: 0,
                limit: 999999,
                message: 'Tipo não reconhecido'
            };
    }

    const allowed = current < limit;
    const messageKey = `LIMIT_${tipo.toUpperCase()}`;

    return {
        allowed: allowed,
        current: current,
        limit: limit,
        percentUsed: Math.round((current / limit) * 100),
        message: allowed ? `${current}/${limit} ${tipo}` : ACCESS_CONFIG.MESSAGES[messageKey]
    };
}

// =====================================================
// MIDDLEWARE DE PROTEÇÃO DE PÁGINAS
// =====================================================

/**
 * Protege uma página, redirecionando se não tiver acesso
 * @param {Object} options - Opções de proteção
 * @param {boolean} options.requireSubscription - Se requer assinatura ativa (não trial)
 * @param {string[]} options.allowedStatus - Status permitidos (ex: ['active', 'trial'])
 */
async function protegerPagina(options = {}) {
    const { requireSubscription = false, allowedStatus = ['active', 'trial', 'grace_period'] } = options;

    try {
        // Verificar se usuário está logado
        const user = await auth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return false;
        }

        // Verificar status da empresa
        const status = await verificarStatusEmpresa();

        if (!status.hasAccess) {
            // Redirecionar para página apropriada
            if (status.redirectTo) {
                window.location.href = status.redirectTo;
            } else {
                window.location.href = 'planos.html';
            }
            return false;
        }

        if (!allowedStatus.includes(status.status)) {
            window.location.href = status.redirectTo || 'planos.html';
            return false;
        }

        if (requireSubscription && status.status === 'trial') {
            mostrarMensagemUpgrade('Esta funcionalidade requer uma assinatura ativa.');
            return false;
        }

        // Mostrar avisos se necessário
        if (status.showWarning) {
            mostrarAvisoAssinatura(status);
        }

        // Mostrar indicador de trial
        if (status.status === 'trial') {
            mostrarIndicadorTrial(status.daysRemaining);
        }

        return true;

    } catch (error) {
        console.error('Erro ao verificar acesso:', error);
        return false;
    }
}

// =====================================================
// UI HELPERS
// =====================================================

/**
 * Mostra aviso de problema com assinatura
 */
function mostrarAvisoAssinatura(status) {
    const aviso = document.createElement('div');
    aviso.id = 'subscription-warning';
    aviso.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #F59E0B, #D97706);
            color: white;
            padding: 12px 20px;
            text-align: center;
            z-index: 10000;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
        ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>${status.message} Você tem <strong>${status.daysRemaining} dia(s)</strong> para regularizar.</span>
            <a href="planos.html" style="
                background: white;
                color: #D97706;
                padding: 6px 16px;
                border-radius: 20px;
                text-decoration: none;
                font-weight: 600;
                margin-left: 8px;
            ">Atualizar Pagamento</a>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 4px;
                margin-left: 8px;
            ">✕</button>
        </div>
    `;
    document.body.prepend(aviso);

    // Ajustar padding do body
    document.body.style.paddingTop = '50px';
}

/**
 * Mostra indicador de dias restantes do trial
 */
function mostrarIndicadorTrial(daysRemaining) {
    const indicator = document.createElement('div');
    indicator.id = 'trial-indicator';
    indicator.innerHTML = `
        <div style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1E293B, #334155);
            color: white;
            padding: 12px 20px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 10px;
        ">
            <span>🎯 Período de teste: <strong>${daysRemaining} dia(s)</strong> restante(s)</span>
            <a href="planos.html" style="
                background: linear-gradient(135deg, #14B8A6, #2DD4BF);
                color: white;
                padding: 6px 14px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 500;
                font-size: 12px;
            ">Escolher Plano</a>
        </div>
    `;
    document.body.appendChild(indicator);
}

/**
 * Mostra mensagem de upgrade necessário
 */
function mostrarMensagemUpgrade(message) {
    if (window.globalUI && window.globalUI.showAlert) {
        window.globalUI.showAlert('Upgrade Necessário', message, 'warning');
    } else {
        alert(message);
    }
}

/**
 * Verifica limite antes de adicionar item
 * @param {string} tipo - 'produtos', 'usuarios', 'lojas'
 * @returns {Promise<boolean>}
 */
async function verificarAntesDeAdicionar(tipo) {
    const limite = await verificarLimite(tipo);

    if (!limite.allowed) {
        if (window.globalUI && window.globalUI.showAlert) {
            window.globalUI.showAlert(
                'Limite Atingido',
                `${limite.message}\n\nVocê está usando ${limite.current} de ${limite.limit} ${tipo}. Para adicionar mais, faça upgrade do seu plano.`,
                'warning'
            );
        } else {
            alert(limite.message);
        }
        return false;
    }

    // Aviso se estiver próximo do limite (80%+)
    if (limite.percentUsed >= 80) {
        console.warn(`Atenção: ${limite.percentUsed}% do limite de ${tipo} utilizado (${limite.current}/${limite.limit})`);
    }

    return true;
}

// =====================================================
// EXPORTAR FUNÇÕES
// =====================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        verificarStatusEmpresa,
        verificarLimite,
        protegerPagina,
        verificarAntesDeAdicionar
    };
}

// Disponibilizar globalmente
window.accessControl = {
    verificarStatusEmpresa,
    verificarLimite,
    protegerPagina,
    verificarAntesDeAdicionar
};
