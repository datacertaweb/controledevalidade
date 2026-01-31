/**
 * Stripe Checkout Integration
 * DataCerta 2.0 - Sistema de Assinaturas
 */

// =====================================================
// CONFIGURAÇÃO
// =====================================================

// IMPORTANTE: Em produção, estas chaves devem vir de variáveis de ambiente
// A chave pública pode ser exposta no frontend
const STRIPE_PUBLIC_KEY = 'pk_test_51SujKiH9OuKzVgCKPbJqd6M7QdvZpRrqNiEU2APsVuc4dQpjXtv9ltmF9jJGlniAoCcLKx9xUipuAzH51tVJuJ7300PYTeIVpo'; // Substituir pela chave real

// URL base para retorno do Stripe
const BASE_URL = window.location.origin;

// =====================================================
// INICIALIZAÇÃO DO STRIPE
// =====================================================

let stripe = null;

async function initStripe() {
    if (!stripe && typeof Stripe !== 'undefined') {
        stripe = Stripe(STRIPE_PUBLIC_KEY);
    }
    return stripe;
}

// =====================================================
// SUPABASE READY / AUTH
// =====================================================
async function ensureSupabaseAuth() {
    if (!window.supabaseClient) {
        await new Promise(resolve => {
            window.addEventListener('supabaseReady', resolve, { once: true });
        });
    }
    const { data } = await window.supabaseClient.auth.getSession();
    const token = data?.session?.access_token || null;
    return token;
}

// =====================================================
// CRIAR SESSÃO DE CHECKOUT
// =====================================================

/**
 * Cria uma sessão de checkout no Stripe via Edge Function
 * @param {Object} params - Parâmetros do checkout
 * @param {string} params.planoId - ID do plano no Supabase
 * @param {string} params.periodo - 'mensal' ou 'anual'
 * @param {string} params.empresaId - ID da empresa
 * @param {string} params.email - Email do cliente
 * @returns {Promise<{sessionId: string, url: string}>}
 */
async function criarSessaoCheckout({ planoId, periodo, empresaId, email }) {
    const token = await ensureSupabaseAuth();
    if (!window.supabaseClient) throw new Error('Supabase não inicializado');

    // Chamar Edge Function para criar sessão
    const { data, error } = await window.supabaseClient.functions.invoke('stripe-checkout', {
        body: {
            plano_id: planoId,
            periodo: periodo,
            empresa_id: empresaId,
            email: email,
            success_url: `${BASE_URL}/app/checkout-sucesso.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${BASE_URL}/app/planos.html?cancelado=1`
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    if (error) {
        console.error('Erro ao criar sessão:', error);
        console.error('Detalhes do erro:', error.message, error.context || '', 'status:', error.status || '');
        throw new Error(error.message || 'Erro ao iniciar checkout. Tente novamente.');
    }

    if (!data) {
        console.error('Nenhum dado retornado da função');
        throw new Error('Erro ao iniciar checkout. Tente novamente.');
    }

    console.log('Sessão criada com sucesso:', data);
    return data;
}

// =====================================================
// REDIRECIONAR PARA CHECKOUT
// =====================================================

/**
 * Redireciona o usuário para o checkout do Stripe
 * @param {string} planoId - ID do plano
 * @param {string} periodo - 'mensal' ou 'anual'
 */
async function redirecionarParaCheckout(planoId, periodo) {
    try {
        // Obter dados do usuário logado
        const user = await auth.getUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }

        const userData = await auth.getCurrentUserData();
        if (!userData || !userData.empresa_id) {
            throw new Error('Dados da empresa não encontrados');
        }

        console.log('Criando sessão com:', {
            planoId,
            periodo,
            empresaId: userData.empresa_id,
            email: user.email
        });

        // Criar sessão de checkout
        const session = await criarSessaoCheckout({
            planoId: planoId,
            periodo: periodo,
            empresaId: userData.empresa_id,
            email: user.email
        });

        // Redirecionar para URL do Stripe
        if (session.url) {
            window.location.href = session.url;
        } else if (session.sessionId) {
            // Usar Stripe.js para redirecionar
            await initStripe();
            const { error } = await stripe.redirectToCheckout({
                sessionId: session.sessionId
            });

            if (error) {
                throw error;
            }
        }

    } catch (error) {
        console.error('Erro no checkout:', error);
        throw error;
    }
}

// =====================================================
// VERIFICAR STATUS DA SESSÃO
// =====================================================

/**
 * Verifica o status de uma sessão de checkout
 * @param {string} sessionId - ID da sessão do Stripe
 * @returns {Promise<Object>}
 */
async function verificarSessaoCheckout(sessionId) {
    const token = await ensureSupabaseAuth();
    if (!window.supabaseClient) throw new Error('Supabase não inicializado');

    const { data, error } = await window.supabaseClient.functions.invoke('stripe-checkout-status', {
        body: { session_id: sessionId },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });

    if (error) {
        console.error('Erro ao verificar sessão:', error);
        throw new Error('Erro ao verificar pagamento.');
    }

    return data;
}

// =====================================================
// GERENCIAR ASSINATURA (PORTAL DO CLIENTE)
// =====================================================

/**
 * Redireciona para o portal de gerenciamento do Stripe
 */
async function abrirPortalCliente() {
    try {
        const user = await auth.getUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }

        const userData = await auth.getCurrentUserData();
        if (!userData || !userData.empresa_id) {
            throw new Error('Dados da empresa não encontrados');
        }

        // Chamar Edge Function para criar sessão do portal
        const token = await ensureSupabaseAuth();
        const { data, error } = await window.supabaseClient.functions.invoke('stripe-portal', {
            body: {
                empresa_id: userData.empresa_id,
                return_url: `${BASE_URL}/app/dashboard.html`
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (error) {
            throw error;
        }

        if (data.url) {
            window.location.href = data.url;
        }

    } catch (error) {
        console.error('Erro ao abrir portal:', error);
        throw error;
    }
}

// =====================================================
// CANCELAR ASSINATURA
// =====================================================

/**
 * Cancela a assinatura da empresa
 * @param {string} motivo - Motivo do cancelamento
 */
async function cancelarAssinatura(motivo = '') {
    try {
        const user = await auth.getUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }

        const userData = await auth.getCurrentUserData();
        if (!userData || !userData.empresa_id) {
            throw new Error('Dados da empresa não encontrados');
        }

        const token = await ensureSupabaseAuth();
        const { data, error } = await window.supabaseClient.functions.invoke('stripe-cancel', {
            body: {
                empresa_id: userData.empresa_id,
                motivo: motivo
            },
            headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });

        if (error) {
            throw error;
        }

        return data;

    } catch (error) {
        console.error('Erro ao cancelar:', error);
        throw error;
    }
}

// =====================================================
// OBTER INFORMAÇÕES DA ASSINATURA
// =====================================================

/**
 * Obtém informações da assinatura atual
 * @returns {Promise<Object>}
 */
async function obterAssinaturaAtual() {
    if (!window.supabaseClient) {
        throw new Error('Supabase não inicializado');
    }

    const userData = await auth.getCurrentUserData();
    if (!userData || !userData.empresa_id) {
        return null;
    }

    const { data, error } = await window.supabaseClient
        .from('assinaturas')
        .select(`
            *,
            plano:planos(*)
        `)
        .eq('empresa_id', userData.empresa_id)
        .in('status', ['ativa', 'trial', 'inadimplente'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') { // Ignorar "no rows"
        console.error('Erro ao obter assinatura:', error);
        return null;
    }

    return data;
}

// =====================================================
// VERIFICAR LIMITES DO PLANO
// =====================================================

/**
 * Verifica se a empresa atingiu os limites do plano
 * @param {string} tipo - 'produtos', 'usuarios', 'lojas'
 * @returns {Promise<{atingido: boolean, atual: number, limite: number}>}
 */
async function verificarLimitePlano(tipo) {
    const assinatura = await obterAssinaturaAtual();

    if (!assinatura || !assinatura.plano) {
        return { atingido: true, atual: 0, limite: 0 };
    }

    const userData = await auth.getCurrentUserData();
    let atual = 0;

    switch (tipo) {
        case 'produtos':
            const { count: countProdutos } = await window.supabaseClient
                .from('base')
                .select('*', { count: 'exact', head: true })
                .eq('empresa_id', userData.empresa_id);
            atual = countProdutos || 0;
            return {
                atingido: atual >= assinatura.plano.max_produtos,
                atual: atual,
                limite: assinatura.plano.max_produtos
            };

        case 'usuarios':
            const { count: countUsuarios } = await window.supabaseClient
                .from('usuarios')
                .select('*', { count: 'exact', head: true })
                .eq('empresa_id', userData.empresa_id)
                .eq('ativo', true);
            atual = countUsuarios || 0;
            return {
                atingido: atual >= assinatura.plano.max_usuarios,
                atual: atual,
                limite: assinatura.plano.max_usuarios
            };

        case 'lojas':
            const { count: countLojas } = await window.supabaseClient
                .from('lojas')
                .select('*', { count: 'exact', head: true })
                .eq('empresa_id', userData.empresa_id)
                .eq('ativo', true);
            atual = countLojas || 0;
            return {
                atingido: atual >= assinatura.plano.max_lojas,
                atual: atual,
                limite: assinatura.plano.max_lojas
            };

        default:
            return { atingido: false, atual: 0, limite: 999999 };
    }
}

// Exportar funções
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initStripe,
        criarSessaoCheckout,
        redirecionarParaCheckout,
        verificarSessaoCheckout,
        abrirPortalCliente,
        cancelarAssinatura,
        obterAssinaturaAtual,
        verificarLimitePlano
    };
}
