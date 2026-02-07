/**
 * DataCerta Admin - Mensagens
 */

let todasMensagens = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Verificar autenticação (usando função global do supabase.js ou admin.js se houver)
    // Aqui vamos assumir que auth.isMasterUser() ou similar deve ser checado
    // Mas por simplicidade vamos carregar direto e tratar erro de permissão

    // Setup UI
    setupEventListeners();

    // Carregar dados
    await loadMensagens();
});

function setupEventListeners() {
    // Busca e Filtro
    document.getElementById('searchInput').addEventListener('input', filtrarMensagens);
    document.getElementById('filterStatus').addEventListener('change', filtrarMensagens);

    // Modal
    document.getElementById('modalClose').addEventListener('click', fecharModal);
    document.getElementById('btnFecharModal').addEventListener('click', fecharModal);
    document.getElementById('modalMensagem').addEventListener('click', (e) => {
        if (e.target.id === 'modalMensagem') fecharModal();
    });

    // Sidebar Toggle (Mobile)
    const sidebarToggle = document.getElementById('sidebarToggle');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }
}

async function loadMensagens() {
    const tbody = document.getElementById('mensagensTable');
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><p>Carregando...</p></td></tr>`;

    try {
        const { data, error } = await window.supabaseClient
            .from('contato_mensagens')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        todasMensagens = data || [];
        filtrarMensagens();

    } catch (error) {
        console.error('Erro ao carregar mensagens:', error);
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><p style="color:var(--color-danger)">Erro ao carregar mensagens.</p></td></tr>`;
        window.showToast('Erro ao carregar mensagens', 'error');
    }
}

function filtrarMensagens() {
    const termo = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('filterStatus').value; // '' | 'nao-lidas' | 'lidas'

    const filtradas = todasMensagens.filter(msg => {
        // Filtro de Texto
        const matchTexto =
            msg.nome.toLowerCase().includes(termo) ||
            msg.email.toLowerCase().includes(termo) ||
            (msg.mensagem && msg.mensagem.toLowerCase().includes(termo));

        // Filtro de Status
        let matchStatus = true;
        if (status === 'nao-lidas') matchStatus = !msg.lida;
        if (status === 'lidas') matchStatus = msg.lida;

        return matchTexto && matchStatus;
    });

    renderTabela(filtradas);
}

function renderTabela(mensagens) {
    const tbody = document.getElementById('mensagensTable');

    if (mensagens.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <div style="padding: 40px; text-align: center;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" width="48" height="48" style="color: var(--text-muted); margin-bottom: 16px;">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                        </svg>
                        <p>Nenhuma mensagem encontrada.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = mensagens.map(msg => `
        <tr class="mensagem-row ${!msg.lida ? 'nao-lida' : ''}">
            <td>${formatarData(msg.created_at)}</td>
            <td>${msg.nome}</td>
            <td>${msg.email}</td>
            <td>${msg.telefone || '-'}</td>
            <td>
                <span class="badge ${msg.lida ? 'badge-secondary' : 'badge-success'}">
                    ${msg.lida ? 'Lida' : 'Nova'}
                </span>
            </td>
            <td>
                <div class="actions-cell">
                    <button class="btn-icon-only btn-ghost" onclick="verMensagem('${msg.id}')" title="Ver Detalhes">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                    ${!msg.lida ? `
                        <button class="btn-icon-only btn-ghost" onclick="marcarComoLida('${msg.id}', event)" title="Marcar como Lida">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function formatarData(dataString) {
    if (!dataString) return '-';
    const data = new Date(dataString);
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(data);
}

window.verMensagem = async (id) => {
    const msg = todasMensagens.find(m => m.id === id);
    if (!msg) return;

    // Preencher modal
    document.getElementById('msgNome').textContent = msg.nome;
    document.getElementById('msgEmail').textContent = msg.email;
    document.getElementById('msgTelefone').textContent = msg.telefone || '-';
    document.getElementById('msgData').textContent = formatarData(msg.created_at);
    document.getElementById('msgConteudo').textContent = msg.mensagem;

    // Botão responder
    const btnResponder = document.getElementById('btnResponderEmail');
    btnResponder.href = `mailto:${msg.email}?subject=Resposta Contact DataCerta&body=Olá ${msg.nome},\n\nRecebemos sua mensagem:\n"${msg.mensagem}"\n\n`;

    // Abrir modal
    document.getElementById('modalMensagem').classList.add('active');

    // Se não lida, marcar como lida automaticamente ao abrir
    if (!msg.lida) {
        await marcarComoLida(id);
    }
};

window.marcarComoLida = async (id, event) => {
    if (event) event.stopPropagation();

    try {
        const { error } = await window.supabaseClient
            .from('contato_mensagens')
            .update({ lida: true })
            .eq('id', id);

        if (error) throw error;

        // Atualizar lista local
        const index = todasMensagens.findIndex(m => m.id === id);
        if (index !== -1) {
            todasMensagens[index].lida = true;
            // Re-renderizar mantendo filtro
            filtrarMensagens();

            // Se foi clicado diretamente (não via modal), mostrar toast
            if (event) {
                window.showToast('Mensagem marcada como lida', 'success');
            }
        }

    } catch (error) {
        console.error('Erro ao marcar como lida:', error);
        window.showToast('Erro ao atualizar status', 'error');
    }
};

function fecharModal() {
    document.getElementById('modalMensagem').classList.remove('active');
}
