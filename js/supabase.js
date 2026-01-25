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
        const { data: userDataRaw } = await window.supabaseClient
            .from('usuarios')
            .select(`
                *, 
                empresas(nome), 
                roles(
                    nome, 
                    is_admin,
                    role_permissions(
                        permissions(codigo)
                    )
                ),
                usuario_permissions(
                    permissions(codigo)
                )
            `)
            .eq('id', user.id)
            .single();

        if (userDataRaw) {
            // Processar permissões
            const perms = new Set();

            // Permissões da Role
            if (userDataRaw.roles?.role_permissions) {
                userDataRaw.roles.role_permissions.forEach(rp => {
                    if (rp.permissions?.codigo) perms.add(rp.permissions.codigo);
                });
            }

            // Permissões Diretas
            if (userDataRaw.usuario_permissions) {
                userDataRaw.usuario_permissions.forEach(up => {
                    if (up.permissions?.codigo) perms.add(up.permissions.codigo);
                });
            }

            // Admin (permissão curinga)
            if (userDataRaw.roles?.is_admin) perms.add('*');

            return { ...userDataRaw, tipo: 'empresa', permissions: Array.from(perms) };
        }

        return null;
    },

    /**
     * Verifica permissão
     */
    hasPermission(userData, code) {
        if (!userData || !userData.permissions) return false;
        if (userData.permissions.includes('*')) return true;
        return userData.permissions.includes(code);
    },

    /**
     * Verifica se usuário é admin
     */
    isAdmin(userData) {
        if (!userData) return false;
        return userData.tipo === 'master' || userData.roles?.is_admin || userData.permissions?.includes('*');
    },

    /**
     * Obtém IDs das lojas do usuário
     * Retorna null se não tiver restrição (admin ou master)
     * Retorna array vazio se tiver restrição mas nenhuma loja vinculada
     * Retorna array com IDs se tiver lojas vinculadas
     */
    async getUserLojas(userId) {
        const { data } = await window.supabaseClient
            .from('usuarios_lojas')
            .select('loja_id')
            .eq('usuario_id', userId);

        if (!data || data.length === 0) return null; // Sem restrição
        return data.map(ul => ul.loja_id);
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
    },

    async resetPassword(email) {
        const { data, error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/app/reset-senha.html`
        });
        if (error) throw error;
        return data;
    },

    async updatePassword(newPassword) {
        const { data, error } = await window.supabaseClient.auth.updateUser({
            password: newPassword
        });
        if (error) throw error;
        return data;
    }
};

/**
 * Interface Gráfica Global (Toasts e Modais)
 */
window.globalUI = {
    // Inicializar elementos globais se não existirem
    init() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        if (!document.getElementById('global-alert-modal')) {
            const modal = document.createElement('div');
            modal.id = 'global-alert-modal';
            modal.innerHTML = `
                <div class="alert-modal-content">
                    <div class="alert-modal-icon" id="alertIcon"></div>
                    <div class="alert-modal-title" id="alertTitle"></div>
                    <div class="alert-modal-message" id="alertMessage"></div>
                    <button class="alert-modal-btn" id="alertBtn">OK</button>
                </div>
            `;
            document.body.appendChild(modal);

            // Fechar no clique fora (opcional, mas alertas devem ser bloqueantes)
            // modal.addEventListener('click', (e) => {
            //     if (e.target === modal) window.globalUI.closeAlert();
            // });

            document.getElementById('alertBtn').addEventListener('click', () => {
                window.globalUI.closeAlert();
            });
        }
    },

    /**
     * Exibir Toast Notification
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {string} message
     */
    showToast(type, message) {
        this.init(); // Garantir que container existe

        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Ícones SVG
        const icons = {
            success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
            error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
        };

        const titles = {
            success: 'Sucesso',
            error: 'Erro',
            warning: 'Atenção',
            info: 'Informação'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                <div class="toast-title">${titles[type] || 'Notificação'}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="btn-ghost btn-sm" onclick="this.parentElement.remove()" style="padding: 4px;">&times;</button>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('removing');
                setTimeout(() => { if (toast.parentElement) toast.remove(); }, 300);
            }
        }, 5000);
    },

    /**
     * Exibir Modal de Alerta
     * @param {string} title
     * @param {string} message
     * @param {string} type - 'error', 'warning', 'success'
     * @param {function} onOk - Callback após fechar
     */
    showAlert(title, message, type = 'info', onOk = null) {
        this.init();

        const modal = document.getElementById('global-alert-modal');
        const icon = document.getElementById('alertIcon');
        const btn = document.getElementById('alertBtn');

        // Ícones
        const icons = {
            success: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
            error: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            warning: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
        };

        icon.innerHTML = icons[type] || icons.success;
        icon.className = `alert-modal-icon ${type}`;

        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;

        // Callback no botão
        this._currentOkCallback = onOk;

        modal.classList.add('active');
        btn.focus();
    },

    closeAlert() {
        const modal = document.getElementById('global-alert-modal');
        modal.classList.remove('active');
        if (this._currentOkCallback) {
            this._currentOkCallback();
            this._currentOkCallback = null;
        }
    },

    /**
     * Exibir Modal de Confirmação (substitui confirm())
     * @param {string} title
     * @param {string} message
     * @param {string} type - 'warning', 'error', 'info'
     * @returns {Promise<boolean>} - Resolve true se confirmado, false se cancelado
     */
    showConfirm(title, message, type = 'warning') {
        return new Promise((resolve) => {
            this.init();

            // Criar modal de confirmação se não existir
            if (!document.getElementById('global-confirm-modal')) {
                const modal = document.createElement('div');
                modal.id = 'global-confirm-modal';
                modal.className = 'global-alert-modal';
                modal.innerHTML = `
                    <div class="alert-modal-content">
                        <div class="alert-modal-icon" id="confirmIcon"></div>
                        <div class="alert-modal-title" id="confirmTitle"></div>
                        <div class="alert-modal-message" id="confirmMessage"></div>
                        <div class="confirm-modal-actions">
                            <button class="btn btn-outline" id="confirmBtnCancel">Cancelar</button>
                            <button class="btn btn-danger" id="confirmBtnOk">Confirmar</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                // Fechar ao clicar fora
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this._resolveConfirm(false);
                    }
                });
            }

            const modal = document.getElementById('global-confirm-modal');
            const icon = document.getElementById('confirmIcon');

            // Ícones
            const icons = {
                warning: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
                error: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
                info: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
            };

            icon.innerHTML = icons[type] || icons.warning;
            icon.className = `alert-modal-icon ${type}`;

            document.getElementById('confirmTitle').textContent = title;
            document.getElementById('confirmMessage').textContent = message;

            // Resolver na escolha
            this._resolveConfirm = (result) => {
                modal.classList.remove('active');
                resolve(result);
            };

            // Event listeners (remover antigos para evitar duplicação)
            const btnCancel = document.getElementById('confirmBtnCancel');
            const btnOk = document.getElementById('confirmBtnOk');

            btnCancel.onclick = () => this._resolveConfirm(false);
            btnOk.onclick = () => this._resolveConfirm(true);

            modal.classList.add('active');
            btnOk.focus();
        });
    }
};

// Aliases globais para facilitar o refatoramento
window.showToast = (message, type = 'info') => window.globalUI.showToast(type, message);
window.showConfirm = (title, message, type = 'warning') => window.globalUI.showConfirm(title, message, type);
