// DataCerta Admin - Envio de Alertas
// Gerencia envio de notificações push manuais para empresas

const alertasPage = {
    empresas: [],

    async init() {
        console.log('Inicializando página de alertas...');

        await this.loadEmpresas();
        this.setupForm();
        this.loadRecentAlerts();
    },

    // Carregar lista de empresas
    async loadEmpresas() {
        try {
            const select = document.getElementById('empresaSelect');
            if (!select) return;

            const { data, error } = await window.supabaseClient
                .from('empresas')
                .select('id, nome, status')
                .order('nome');

            if (error) throw error;

            this.empresas = data || [];

            // Popular select
            select.innerHTML = '<option value="">Selecione uma empresa...</option>';
            select.innerHTML += '<option value="__ALL__">📢 TODAS AS EMPRESAS</option>';

            this.empresas.forEach(emp => {
                const status = emp.status === 'ativo' ? '' : ` (${emp.status})`;
                select.innerHTML += `<option value="${emp.id}">${emp.nome}${status}</option>`;
            });

        } catch (error) {
            console.error('Erro ao carregar empresas:', error);
            this.showToast('Erro ao carregar empresas', 'error');
        }
    },

    // Setup do formulário
    setupForm() {
        const form = document.getElementById('alertForm');
        const tituloInput = document.getElementById('tituloInput');
        const mensagemInput = document.getElementById('mensagemInput');

        // Contadores de caracteres
        if (tituloInput) {
            tituloInput.addEventListener('input', () => {
                document.getElementById('tituloCount').textContent = tituloInput.value.length;
            });
        }

        if (mensagemInput) {
            mensagemInput.addEventListener('input', () => {
                document.getElementById('mensagemCount').textContent = mensagemInput.value.length;
            });
        }

        // Submit do formulário
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.enviarAlerta();
            });
        }
    },

    // Enviar alerta
    async enviarAlerta() {
        const empresaId = document.getElementById('empresaSelect').value;
        const prioridade = document.getElementById('prioridadeSelect').value;
        const titulo = document.getElementById('tituloInput').value.trim();
        const mensagem = document.getElementById('mensagemInput').value.trim();
        const enviarPush = document.getElementById('enviarPush').checked;
        const btn = document.getElementById('btnEnviar');

        if (!empresaId || !titulo || !mensagem) {
            this.showToast('Preencha todos os campos', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<div class="spinner"></div> Enviando...';

        try {
            // Se for todas as empresas, iterar
            const empresasEnviar = empresaId === '__ALL__'
                ? this.empresas.filter(e => e.status === 'ativo')
                : [{ id: empresaId }];

            let enviados = 0;

            for (const emp of empresasEnviar) {
                // Inserir notificação no banco
                const { error: insertError } = await window.supabaseClient
                    .from('notificacoes')
                    .insert({
                        empresa_id: emp.id,
                        tipo: 'alerta',
                        titulo: titulo,
                        mensagem: mensagem,
                        prioridade: prioridade,
                        dados: { origem: 'admin', push: enviarPush }
                    });

                if (insertError) {
                    console.error('Erro ao inserir notificação:', insertError);
                    continue;
                }

                // Se tiver push habilitado, o webhook do banco vai disparar automaticamente
                // Mas se quiser forçar, podemos chamar a edge function diretamente
                if (enviarPush) {
                    try {
                        const SUPABASE_URL = 'https://ffpqkdzpcfrgngldsfdz.supabase.co';
                        const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmcHFrZHpwY2ZyZ25nbGRzZmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNTc0ODIsImV4cCI6MjA4NTczMzQ4Mn0.88PcjnHeqQk1TyINHHphikyqi6H-bIXexHJ9-G2Nmag';

                        await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${ANON_KEY}`,
                                'apikey': ANON_KEY
                            },
                            body: JSON.stringify({
                                empresa_id: emp.id,
                                titulo: titulo,
                                mensagem: mensagem,
                                tipo: 'alerta'
                            })
                        });
                    } catch (pushError) {
                        console.warn('Erro ao enviar push:', pushError);
                    }
                }

                enviados++;
            }

            this.showToast(`Alerta enviado para ${enviados} empresa(s)!`, 'success');

            // Limpar formulário
            document.getElementById('tituloInput').value = '';
            document.getElementById('mensagemInput').value = '';
            document.getElementById('tituloCount').textContent = '0';
            document.getElementById('mensagemCount').textContent = '0';

            // Recarregar tabela
            await this.loadRecentAlerts();

        } catch (error) {
            console.error('Erro ao enviar alerta:', error);
            this.showToast('Erro ao enviar alerta', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Enviar Alerta
            `;
        }
    },

    // Carregar alertas recentes
    async loadRecentAlerts() {
        try {
            const tbody = document.getElementById('recentAlerts');
            if (!tbody) return;

            const { data, error } = await window.supabaseClient
                .from('notificacoes')
                .select('id, titulo, prioridade, created_at, empresa_id, empresas(nome)')
                .eq('tipo', 'alerta')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            if (!data || data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="empty-state">
                            <p>Nenhum alerta enviado ainda</p>
                        </td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = data.map(alert => {
                const prioridadeBadge = {
                    'urgente': '<span class="badge expired">Urgente</span>',
                    'alta': '<span class="badge critical">Alta</span>',
                    'normal': '<span class="badge ok">Normal</span>'
                };

                const date = new Date(alert.created_at).toLocaleString('pt-BR');

                return `
                    <tr>
                        <td>${alert.empresas?.nome || 'N/A'}</td>
                        <td>${alert.titulo}</td>
                        <td>${prioridadeBadge[alert.prioridade] || alert.prioridade}</td>
                        <td>${date}</td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error('Erro ao carregar alertas:', error);
        }
    },

    // Toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar auth estar pronto
    setTimeout(() => {
        if (window.auth && window.supabaseClient) {
            alertasPage.init();
        }
    }, 500);
});
