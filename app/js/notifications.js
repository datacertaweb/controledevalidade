// DataCerta - Módulo de Notificações
// Funciona tanto no Web quanto no Mobile

const notifications = {
    unreadCount: 0,
    items: [],
    pollInterval: null,

    // Inicializar módulo de notificações
    async init() {
        console.log('Inicializando módulo de notificações...');

        // Atualizar contagem inicial
        await this.updateBadge();

        // Polling a cada 2 minutos para verificar novas notificações
        this.pollInterval = setInterval(() => {
            this.updateBadge();
        }, 120000);

        // Setup click handler para o botão
        this.setupClickHandler();
    },

    // Setup do handler de clique no botão de notificações
    setupClickHandler() {
        const btn = document.getElementById('btnNotifications');
        if (btn) {
            btn.onclick = () => this.showNotificationsModal();
        }
    },

    // Buscar contagem de não lidas
    async getUnreadCount() {
        try {
            const { data, error } = await window.supabaseClient
                .rpc('count_notificacoes_nao_lidas');

            if (error) throw error;
            return data || 0;
        } catch (err) {
            console.error('Erro ao contar notificações:', err);
            return 0;
        }
    },

    // Buscar notificações não lidas
    async getUnreadNotifications(limit = 50) {
        try {
            const { data, error } = await window.supabaseClient
                .rpc('get_notificacoes_nao_lidas', { p_limit: limit });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Erro ao buscar notificações:', err);
            return [];
        }
    },

    // Atualizar badge de notificações
    async updateBadge() {
        try {
            this.unreadCount = await this.getUnreadCount();

            const badge = document.querySelector('.notification-badge');
            if (badge) {
                if (this.unreadCount > 0) {
                    badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                    badge.style.display = 'flex';
                } else {
                    badge.style.display = 'none';
                }
            }
        } catch (err) {
            console.error('Erro ao atualizar badge:', err);
        }
    },

    // Marcar notificação como lida
    async markAsRead(notificationId) {
        try {
            const { error } = await window.supabaseClient
                .rpc('marcar_notificacao_lida', { p_notificacao_id: notificationId });

            if (error) throw error;

            // Atualizar badge
            await this.updateBadge();
            return true;
        } catch (err) {
            console.error('Erro ao marcar como lida:', err);
            return false;
        }
    },

    // Marcar todas como lidas
    async markAllAsRead() {
        try {
            const { data, error } = await window.supabaseClient
                .rpc('marcar_todas_notificacoes_lidas');

            if (error) throw error;

            // Atualizar badge
            await this.updateBadge();

            if (window.ui) {
                ui.toast(`${data || 0} notificações marcadas como lidas`, 'success');
            }

            return data;
        } catch (err) {
            console.error('Erro ao marcar todas como lidas:', err);
            return 0;
        }
    },

    // Mostrar modal de notificações
    async showNotificationsModal() {
        // Buscar notificações
        this.items = await this.getUnreadNotifications();

        const content = this.items.length === 0
            ? `
                <div class="empty-state" style="padding: 40px 20px; text-align: center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="opacity: 0.4; margin-bottom: 16px;">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    <p style="color: var(--text-muted);">Nenhuma notificação pendente</p>
                </div>
            `
            : `
                <div style="max-height: 400px; overflow-y: auto;">
                    ${this.items.map(n => this.renderNotificationItem(n)).join('')}
                </div>
            `;

        // Apenas mostrar botão de marcar todas se houver notificações
        const actions = this.items.length > 0
            ? [{ text: 'Marcar todas como lidas', class: 'btn-primary', onClick: () => this.handleMarkAllRead() }]
            : [];

        if (window.ui && window.ui.showModal) {
            ui.showModal('Notificações', content, actions);
        } else {
            // Fallback para web - criar modal simples
            this.showWebModal('Notificações', content, actions);
        }
    },

    // Modal fallback para Web
    showWebModal(title, content, actions) {
        // Remove modal existente
        const existing = document.getElementById('notificationsModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'notificationsModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 9999;
            display: flex; align-items: center; justify-content: center;
        `;

        const actionsHtml = actions.map((a, i) =>
            `<button class="btn ${a.class || ''}" id="modalBtn${i}" style="margin-left: 8px;">${a.text}</button>`
        ).join('');

        modal.innerHTML = `
            <div style="background: white; border-radius: 12px; width: 90%; max-width: 500px; max-height: 80vh; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                <div style="padding: 16px 20px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${title}</h3>
                    <button id="closeModalBtn" style="background: none; border: none; cursor: pointer; padding: 4px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div style="padding: 0; overflow-y: auto; max-height: 50vh;">${content}</div>
                <div style="padding: 16px 20px; border-top: 1px solid #E2E8F0; display: flex; justify-content: flex-end;">
                    ${actionsHtml}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event handlers
        document.getElementById('closeModalBtn').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        actions.forEach((a, i) => {
            const btn = document.getElementById(`modalBtn${i}`);
            if (btn) {
                btn.onclick = () => {
                    if (a.onClick) a.onClick();
                    else modal.remove();
                };
            }
        });

        this.currentModal = modal;
    },

    hideWebModal() {
        const modal = document.getElementById('notificationsModal');
        if (modal) modal.remove();
    },

    // Renderizar item de notificação
    renderNotificationItem(notification) {
        const prioridadeClass = {
            'urgente': 'expired',
            'alta': 'critical',
            'normal': 'warning',
            'baixa': 'ok'
        };

        const badgeClass = prioridadeClass[notification.prioridade] || 'warning';
        const diasLabel = notification.dados?.dias ? `${notification.dados.dias}d` : '';
        const lojaLabel = notification.loja_nome || '';

        return `
            <div class="notification-item" onclick="notifications.handleItemClick('${notification.id}')" style="
                padding: 14px 16px;
                border-bottom: 1px solid var(--border-primary);
                cursor: pointer;
                transition: background 0.2s;
            ">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <h4 style="font-size: 14px; font-weight: 600; flex: 1;">${notification.titulo}</h4>
                    <span class="badge ${badgeClass}" style="margin-left: 8px;">${diasLabel}</span>
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 4px;">
                    ${notification.mensagem}
                </p>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
                    <span>${lojaLabel}</span>
                    <span>${this.formatDate(notification.created_at)}</span>
                </div>
            </div>
        `;
    },

    // Formatar data
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins}min atrás`;
        if (diffHours < 24) return `${diffHours}h atrás`;
        if (diffDays < 7) return `${diffDays}d atrás`;

        return date.toLocaleDateString('pt-BR');
    },

    // Handler de clique em item
    async handleItemClick(notificationId) {
        await this.markAsRead(notificationId);

        // Remover item da lista visualmente
        this.items = this.items.filter(n => n.id !== notificationId);

        // Re-renderizar modal
        if (this.items.length === 0) {
            if (window.ui && window.ui.hideModal) ui.hideModal();
            else this.hideWebModal();
        } else {
            this.showNotificationsModal();
        }
    },

    // Handler marcar todas como lidas
    async handleMarkAllRead() {
        await this.markAllAsRead();
        if (window.ui && window.ui.hideModal) ui.hideModal();
        else this.hideWebModal();
    },

    // Parar polling
    destroy() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }
};

// Expor globalmente
window.notifications = notifications;
