/**
 * Admin Notifications System
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inject Notification Interface if essential elements exist
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.getElementById('adminNotifications')) {
        injectNotificationUI(headerActions);
    }

    // Initialize logic
    setupNotifications();
});

function injectNotificationUI(container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'notification-wrapper';
    wrapper.id = 'adminNotifications';
    wrapper.innerHTML = `
        <button class="btn-icon-only btn-ghost" id="btnNotificacoes" style="position: relative;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span class="notification-badge" id="notificacaoBadge" style="display: none;">0</span>
        </button>
        <div class="notification-dropdown" id="notificationDropdown">
            <div class="notification-header">
                <h3>Notificações</h3>
                <button class="btn btn-ghost btn-sm" onclick="marcarTodasLidas()" style="font-size: 12px;">Marcar todas como lidas</button>
            </div>
            <div class="notification-list" id="notificationList">
                <div class="notification-empty">Carregando...</div>
            </div>
        </div>
    `;

    // Insert as first item or prepend
    if (container.firstChild) {
        container.insertBefore(wrapper, container.firstChild);
    } else {
        container.appendChild(wrapper);
    }
}

async function setupNotifications() {
    const btn = document.getElementById('btnNotificacoes');
    const dropdown = document.getElementById('notificationDropdown');

    if (!btn || !dropdown) return;

    // Toggle Dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            loadNotifications(); // Reload on open
        }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!document.getElementById('adminNotifications')?.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });

    // Initial Load
    await checkUnreadCount();

    // Poll every 30 seconds
    setInterval(checkUnreadCount, 30000);
}

async function checkUnreadCount() {
    if (!window.supabaseClient) return;

    try {
        const { count, error } = await window.supabaseClient
            .from('admin_notificacoes')
            .select('*', { count: 'exact', head: true })
            .eq('lida', false);

        if (error) throw error;

        updateBadge(count);

    } catch (error) {
        console.error('Erro ao verificar notificações:', error);
    }
}

function updateBadge(count) {
    const badge = document.getElementById('notificacaoBadge');
    if (!badge) return;

    if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

async function loadNotifications() {
    const list = document.getElementById('notificationList');
    list.innerHTML = '<div class="notification-empty">Carregando...</div>';

    try {
        const { data, error } = await window.supabaseClient
            .from('admin_notificacoes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        renderNotifications(data);

        // Se abrir, marca as visíveis como lidas? Não, melhor deixar explícito ou marcar ao clicar.
        // O usuário pediu "Sino/Contador". Vamos manter a funcionalidade de clicar para ir.

    } catch (error) {
        console.error('Erro ao carregar notificações:', error);
        list.innerHTML = '<div class="notification-empty" style="color: var(--color-danger)">Erro ao carregar.</div>';
    }
}

function renderNotifications(notificacoes) {
    const list = document.getElementById('notificationList');

    if (!notificacoes || notificacoes.length === 0) {
        list.innerHTML = '<div class="notification-empty">Nenhuma notificação.</div>';
        return;
    }

    list.innerHTML = notificacoes.map(n => `
        <a href="${n.link || '#'}" class="notification-item ${!n.lida ? 'unread' : ''}" onclick="onNotificationClick('${n.id}', '${n.link}')">
            <h4>${n.titulo}</h4>
            <p>${n.mensagem}</p>
            <span class="notification-time">${timeAgo(n.created_at)}</span>
        </a>
    `).join('');
}

async function onNotificationClick(id, link) {
    // Marcar como lida
    try {
        await window.supabaseClient
            .from('admin_notificacoes')
            .update({ lida: true })
            .eq('id', id);

        checkUnreadCount(); // update badge
    } catch (e) {
        console.error(e);
    }

    // Se tiver link, o href da âncora já cuida.
    // Se for hash ou vazio, não faz nada além de marcar lida
}

window.marcarTodasLidas = async () => {
    try {
        const { error } = await window.supabaseClient
            .from('admin_notificacoes')
            .update({ lida: true })
            .eq('lida', false);

        if (error) throw error;

        loadNotifications();
        checkUnreadCount();

    } catch (error) {
        console.error('Erro ao marcar todas como lidas:', error);
    }
};

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'agora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d atrás`;

    return date.toLocaleDateString('pt-BR');
}
