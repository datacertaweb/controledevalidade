/**
 * DataCerta - Configuração do Supabase
 */

const SUPABASE_URL = 'https://akmlnywrafsasxfzanyx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrbWxueXdyYWZzYXN4Znphbnl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2NzA4ODQsImV4cCI6MjA4NDI0Njg4NH0.DFYjfdYJGWED32DbVeB6RoTeJ_kj-YxFDwby0BLo6To';

// Aguardar a biblioteca carregar e inicializar
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
});

function initSupabase() {
    // Verificar se a biblioteca foi carregada
    if (typeof window.supabase === 'undefined') {
        console.error('Supabase library not loaded');
        return;
    }

    // Inicializar cliente Supabase
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Exportar para uso global
    window.supabaseClient = supabaseClient;

    // Disparar evento para indicar que está pronto
    window.dispatchEvent(new Event('supabaseReady'));
}

/**
 * Funções de autenticação
 */
window.auth = {
    /**
     * Verifica se o usuário está autenticado
     */
    async getUser() {
        if (!window.supabaseClient) return null;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        return user;
    },

    /**
     * Verifica se é um Master User (admin do SaaS)
     */
    async isMasterUser() {
        const user = await this.getUser();
        if (!user) return false;

        const { data, error } = await window.supabaseClient
            .from('master_users')
            .select('id, role, ativo')
            .eq('id', user.id)
            .eq('ativo', true)
            .single();

        return !!data;
    },

    /**
     * Obtém dados do usuário logado
     */
    async getCurrentUserData() {
        const user = await this.getUser();
        if (!user) return null;

        // Tentar buscar em master_users primeiro
        const { data: masterData } = await window.supabaseClient
            .from('master_users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (masterData) {
            return { ...masterData, tipo: 'master' };
        }

        // Se não for master, buscar em usuarios
        const { data: userData } = await window.supabaseClient
            .from('usuarios')
            .select('*, empresas(nome), roles(nome, is_admin)')
            .eq('id', user.id)
            .single();

        if (userData) {
            return { ...userData, tipo: 'empresa' };
        }

        return null;
    },

    /**
     * Login com email e senha
     */
    async signIn(email, password) {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;
        return data;
    },

    /**
     * Logout
     */
    async signOut() {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error) throw error;
        window.location.href = 'login.html';
    },

    /**
     * Registrar novo usuário
     */
    async signUp(email, password, userData) {
        const { data, error } = await window.supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: userData
            }
        });

        if (error) throw error;
        return data;
    }
};
