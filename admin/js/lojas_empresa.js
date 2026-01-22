/**
 * DataCerta Admin - Gerenciamento de Lojas da Empresa
 * Página acessada via empresas.html -> Gerenciar Lojas
 */

let empresaId = null;
let empresaData = null;
let lojas = [];
let planoData = null;

// Pegar ID da empresa da URL
const urlParams = new URLSearchParams(window.location.search);
empresaId = urlParams.get('id');

if (!empresaId) {
    alert('Empresa não especificada.');
    window.location.href = 'empresas.html';
}

// Aguardar Supabase
window.addEventListener('supabaseReady', initLojasEmpresa);
setTimeout(() => { if (window.supabaseClient) initLojasEmpresa(); }, 500);

let initialized = false;

async function initLojasEmpresa() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        const isMaster = await auth.isMasterUser();
        if (!isMaster) {
            alert('Acesso negado.');
            await auth.signOut();
            return;
        }

        // Carregar dados do usuário master
        const userData = await auth.getCurrentUserData();
        if (userData) {
            const initials = userData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('userAvatar').textContent = initials;
            document.getElementById('userName').textContent = userData.nome;
        }

        // Carregar dados da empresa
        await loadEmpresaData();
        await loadLojas();
        initEvents();

    } catch (error) {
        console.error('Erro:', error);
    }
}

async function loadEmpresaData() {
    const { data, error } = await supabaseClient
        .from('empresas')
        .select('*, planos(id, nome, max_lojas, max_usuarios, max_produtos)')
        .eq('id', empresaId)
        .single();

    if (error || !data) {
        alert('Empresa não encontrada.');
        window.location.href = 'empresas.html';
        return;
    }

    empresaData = data;
    planoData = data.planos || { max_lojas: 0 };

    // Atualizar UI
    document.getElementById('empresaNome').textContent = `Lojas: ${empresaData.nome}`;
    document.getElementById('empresaInfo').textContent =
        `Plano: ${planoData.nome || 'Sem plano'} (até ${planoData.max_lojas || 0} loja${planoData.max_lojas !== 1 ? 's' : ''})`;
}

async function loadLojas() {
    const { data, error } = await supabaseClient
        .from('lojas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nome');

    if (error) {
        console.error('Erro:', error);
        return;
    }

    lojas = data || [];

    // Atualizar contador
    document.getElementById('lojasCount').textContent = `${lojas.length} / ${planoData.max_lojas || 0}`;

    // Renderizar tabela
    renderLojas();
}

function renderLojas() {
    const tbody = document.getElementById('lojasTable');

    if (lojas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; color: var(--text-muted); margin-bottom: 10px;">
                        <path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/>
                    </svg>
                    <h3>Nenhuma loja cadastrada</h3>
                    <p>Clique em "Nova Loja" para adicionar</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lojas.map(loja => `
        <tr>
            <td><strong>${loja.codigo || '-'}</strong></td>
            <td>${loja.nome}</td>
            <td>${loja.cidade || '-'}${loja.uf ? '/' + loja.uf : ''}</td>
            <td>${loja.telefone || '-'}</td>
            <td>
                <span class="status-badge ${loja.ativo ? 'ativo' : 'suspenso'}">
                    ${loja.ativo ? 'Ativa' : 'Inativa'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn" title="Editar" onclick="editLoja('${loja.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                    </button>
                    <button class="action-btn danger" title="Excluir" onclick="deleteLoja('${loja.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function initEvents() {
    // Sidebar toggle
    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });

    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Modal
    const modal = document.getElementById('modalLoja');

    document.getElementById('btnNovaLoja')?.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Nova Loja';
        document.getElementById('formLoja').reset();
        document.getElementById('lojaId').value = '';
        modal.classList.add('active');
    });

    document.getElementById('modalClose')?.addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnCancelModal')?.addEventListener('click', () => modal.classList.remove('active'));
    modal?.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

    // Form submit
    document.getElementById('formLoja')?.addEventListener('submit', saveLoja);
}

async function saveLoja(e) {
    e.preventDefault();

    const id = document.getElementById('lojaId').value;

    const data = {
        empresa_id: empresaId,
        codigo: document.getElementById('lojaCodigo').value || null,
        nome: document.getElementById('lojaNome').value,
        endereco: document.getElementById('lojaEndereco').value || null,
        cidade: document.getElementById('lojaCidade').value || null,
        uf: document.getElementById('lojaUF').value?.toUpperCase() || null,
        cep: document.getElementById('lojaCEP').value || null,
        telefone: document.getElementById('lojaTelefone').value || null
    };

    try {
        if (id) {
            // Update
            const { error } = await supabaseClient.from('lojas').update(data).eq('id', id);
            if (error) throw error;
        } else {
            // Insert - Master pode criar lojas ignorando o trigger se necessário
            // O trigger vai bloquear se a empresa estiver no limite
            // Para bypass, usaríamos uma função RPC
            const { error } = await supabaseClient.from('lojas').insert(data);
            if (error) {
                if (error.message.includes('Limite de lojas')) {
                    alert('⚠️ Esta empresa atingiu o limite de lojas do plano.\n\nPara adicionar mais lojas, você precisa alterar o plano da empresa.');
                    return;
                }
                throw error;
            }
        }

        document.getElementById('modalLoja').classList.remove('active');
        await loadLojas();

    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao salvar: ' + error.message);
    }
}

window.editLoja = function (id) {
    const loja = lojas.find(l => l.id === id);
    if (!loja) return;

    document.getElementById('modalTitle').textContent = 'Editar Loja';
    document.getElementById('lojaId').value = loja.id;
    document.getElementById('lojaCodigo').value = loja.codigo || '';
    document.getElementById('lojaNome').value = loja.nome;
    document.getElementById('lojaEndereco').value = loja.endereco || '';
    document.getElementById('lojaCidade').value = loja.cidade || '';
    document.getElementById('lojaUF').value = loja.uf || '';
    document.getElementById('lojaCEP').value = loja.cep || '';
    document.getElementById('lojaTelefone').value = loja.telefone || '';

    document.getElementById('modalLoja').classList.add('active');
};

window.deleteLoja = async function (id) {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return;

    try {
        const { error } = await supabaseClient.from('lojas').delete().eq('id', id);
        if (error) throw error;
        await loadLojas();
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao excluir: ' + error.message);
    }
};
