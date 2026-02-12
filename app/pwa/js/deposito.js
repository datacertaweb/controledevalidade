/**
 * Depósito JS - Coleta de Depósito/Recebimento
 * DataCerta 2.0
 */

let userData = null;
let html5QrCode = null;
let selectedProdutoId = null;
let selectedProdutoDescricao = null;
let selectedProdutoCategoria = null;
let lojasEmpresa = [];
let selectedLojaId = null;
let coletasSessao = []; // Lista de coletas da sessão atual

function montarCodigosBusca(codigo) {
    const original = codigo.trim();
    const numerico = original.replace(/\D/g, '');
    const semZeros = numerico.replace(/^0+/, '');
    return Array.from(new Set([original, numerico, semZeros].filter(Boolean)));
}

// Aguardar Supabase
window.addEventListener('supabaseReady', initDeposito);
setTimeout(() => { if (window.supabaseClient && !userData) initDeposito(); }, 500);

async function initDeposito() {
    if (userData) return;

    try {
        const user = await auth.getUser();
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        userData = await auth.getCurrentUserData();
        if (!userData) {
            window.globalUI?.showToast('error', 'Erro ao carregar dados do usuário');
            return;
        }

        // Verificar permissão de coleta
        if (!auth.isAdmin(userData) && !auth.hasPermission(userData, 'coletado.create')) {
            window.globalUI?.showToast('error', 'Você não tem permissão para coletar no depósito.');
            setTimeout(() => {
                window.location.href = '../dashboard.html';
            }, 2000);
            return;
        }

        // Exibir empresa e usuário
        await carregarInfoHeader();

        // Carregar lojas da empresa
        await carregarLojas();

        // Event Listeners
        document.getElementById('startScanBtn').addEventListener('click', startScanner);
        document.getElementById('stopScanBtn').addEventListener('click', stopScanner);

        const inputCodigo = document.getElementById('codigo');
        inputCodigo.addEventListener('change', buscarProduto);
        inputCodigo.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscarProduto();
            }
        });

    } catch (error) {
        console.error('Erro initDeposito:', error);
    }
}

// ------ HEADER INFO ------

async function carregarInfoHeader() {
    try {
        // Nome do usuário
        document.getElementById('usuarioNome').textContent = userData.nome || 'Usuário';

        // Nome da empresa
        if (userData.empresas?.nome) {
            document.getElementById('empresaNome').textContent = userData.empresas.nome;
        } else {
            // Buscar nome da empresa
            const { data: empresa } = await supabaseClient
                .from('empresas')
                .select('nome')
                .eq('id', userData.empresa_id)
                .single();
            document.getElementById('empresaNome').textContent = empresa?.nome || 'Empresa';
        }
    } catch (err) {
        console.error('Erro carregarInfoHeader:', err);
        document.getElementById('empresaNome').textContent = 'Empresa';
        document.getElementById('usuarioNome').textContent = 'Usuário';
    }
}

// ------ CARREGAR LOJAS ------

async function carregarLojas() {
    try {
        // Buscar lojas ativas da empresa
        let query = supabaseClient
            .from('lojas')
            .select('id, nome')
            .eq('empresa_id', userData.empresa_id)
            .eq('ativo', true)
            .order('nome');

        // Se não é admin, filtrar pelas lojas do usuário
        if (!auth.isAdmin(userData)) {
            const userLojaIds = await auth.getUserLojas(userData.id);
            if (userLojaIds && userLojaIds.length > 0) {
                query = query.in('id', userLojaIds);
            }
        }

        const { data: lojas, error } = await query;

        if (error) {
            console.error('Erro ao carregar lojas:', error);
            return;
        }

        lojasEmpresa = lojas || [];

        // Se tem mais de 1 loja, mostrar o seletor
        if (lojasEmpresa.length > 1) {
            const selectCard = document.getElementById('lojaSelectCard');
            const select = document.getElementById('lojaSelect');

            selectCard.style.display = 'block';

            // Popular o select
            select.innerHTML = '<option value="">Selecione a loja...</option>';
            lojasEmpresa.forEach(loja => {
                const option = document.createElement('option');
                option.value = loja.id;
                option.textContent = loja.nome;
                select.appendChild(option);
            });

            select.addEventListener('change', (e) => {
                selectedLojaId = e.target.value || null;
            });
        } else if (lojasEmpresa.length === 1) {
            // Se tem exatamente 1 loja, seleciona automaticamente
            selectedLojaId = lojasEmpresa[0].id;
        }
    } catch (err) {
        console.error('Erro ao carregar lojas:', err);
    }
}

// ------ SCANNER ------

async function startScanner() {
    const videoContainer = document.getElementById('video-container');
    const startBtn = document.getElementById('startScanBtn');

    videoContainer.style.display = 'block';
    startBtn.style.display = 'none';

    html5QrCode = new Html5Qrcode("reader");

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.5
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            () => { }
        );
    } catch (err) {
        console.error("Erro scanner:", err);
        window.globalUI?.showToast('error', 'Erro ao iniciar câmera');
        stopScanner();
    }
}

function onScanSuccess(decodedText) {
    document.getElementById('codigo').value = decodedText;
    stopScanner();
    buscarProduto();
    window.globalUI?.showToast('success', 'Código lido: ' + decodedText);
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch(err => console.error(err));
    }
    document.getElementById('video-container').style.display = 'none';
    document.getElementById('startScanBtn').style.display = 'flex';
}

// ------ BUSCAR PRODUTO ------

async function buscarProduto() {
    const codigo = document.getElementById('codigo').value.trim();
    const descricaoEl = document.getElementById('descricao');
    const categoriaEl = document.getElementById('categoria');

    if (!codigo) {
        descricaoEl.value = '';
        descricaoEl.placeholder = 'Aguardando código...';
        categoriaEl.value = '';
        return;
    }

    selectedProdutoId = null;
    selectedProdutoDescricao = null;
    selectedProdutoCategoria = null;
    document.getElementById('produtoInfo').classList.remove('active');
    descricaoEl.value = '';
    descricaoEl.placeholder = 'Buscando...';
    categoriaEl.value = '';

    if (!userData || !userData.empresa_id) return;

    try {
        const codigosBusca = montarCodigosBusca(codigo);
        let data = null;
        let error = null;

        const { data: eanData, error: eanError } = await supabaseClient
            .from('base')
            .select('id, descricao, categoria')
            .eq('empresa_id', userData.empresa_id)
            .in('ean', codigosBusca)
            .limit(1);

        if (eanError) error = eanError;
        if (eanData && eanData.length > 0) data = eanData[0];

        if (!data) {
            const { data: codigoData, error: codigoError } = await supabaseClient
                .from('base')
                .select('id, descricao, categoria')
                .eq('empresa_id', userData.empresa_id)
                .in('codigo', codigosBusca)
                .limit(1);
            if (codigoError) error = codigoError;
            if (codigoData && codigoData.length > 0) data = codigoData[0];
        }

        if (error || !data) {
            descricaoEl.value = '';
            descricaoEl.placeholder = 'Produto não encontrado';
            categoriaEl.value = '';
            window.globalUI?.showToast('warning', 'Produto não encontrado na base');
            return;
        }

        selectedProdutoId = data.id;
        selectedProdutoDescricao = data.descricao;
        selectedProdutoCategoria = data.categoria || '';

        // Preencher campos
        descricaoEl.value = data.descricao;
        categoriaEl.value = data.categoria || 'Sem categoria';

        document.getElementById('produtoNome').textContent = data.descricao;
        document.getElementById('produtoCategoria').textContent = data.categoria || 'Sem categoria';
        document.getElementById('produtoInfo').classList.add('active');

        document.getElementById('validade').focus();

    } catch (err) {
        console.error(err);
        descricaoEl.value = '';
        descricaoEl.placeholder = 'Erro ao buscar';
        window.globalUI?.showToast('error', 'Erro ao buscar produto');
    }
}

// ------ LIMPAR FORMULÁRIO ------

function limparFormulario() {
    document.getElementById('codigo').value = '';
    document.getElementById('descricao').value = '';
    document.getElementById('descricao').placeholder = 'Aguardando código...';
    document.getElementById('categoria').value = '';
    document.getElementById('validade').value = '';

    selectedProdutoId = null;
    selectedProdutoDescricao = null;
    selectedProdutoCategoria = null;
    document.getElementById('produtoInfo').classList.remove('active');
    document.getElementById('mensagem').textContent = '';
    document.getElementById('mensagem').className = 'status-msg';
    document.getElementById('codigo').focus();
}

// ------ LISTA DE COLETA ------

function adicionarNaLista(descricao, categoria, validade, lojaNome) {
    coletasSessao.push({
        descricao,
        categoria,
        validade,
        lojaNome,
        hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
    renderizarListaColeta();
}

function renderizarListaColeta() {
    const container = document.getElementById('coletaListItems');
    const countEl = document.getElementById('coletaCount');

    countEl.textContent = `${coletasSessao.length} ${coletasSessao.length === 1 ? 'item' : 'itens'}`;

    if (coletasSessao.length === 0) {
        container.innerHTML = '<div class="coleta-list-empty">Nenhum item coletado nesta sessão</div>';
        return;
    }

    container.innerHTML = coletasSessao.map((item, index) => `
        <div class="coleta-list-item">
            <div class="coleta-item-info">
                <div class="coleta-item-name">${item.descricao}</div>
                <div class="coleta-item-detail">
                    ${item.categoria ? item.categoria + ' • ' : ''}Val: ${new Date(item.validade + 'T00:00:00').toLocaleDateString('pt-BR')}${item.lojaNome ? ' • ' + item.lojaNome : ''}
                </div>
            </div>
            <div class="coleta-item-status">✓ ${item.hora}</div>
        </div>
    `).reverse().join('');
}

// ------ ENVIAR COLETA ------

async function enviarColeta() {
    const codigo = document.getElementById('codigo').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    const categoria = document.getElementById('categoria').value.trim();
    const validade = document.getElementById('validade').value;

    const mensagemEl = document.getElementById('mensagem');
    const btn = document.getElementById('btn-enviar');

    // Validação
    if (!codigo || !validade) {
        mensagemEl.textContent = 'Preencha o código e a data de validade!';
        mensagemEl.className = 'status-msg error';
        return;
    }

    // Verificar seleção de loja se necessário
    if (lojasEmpresa.length > 1 && !selectedLojaId) {
        mensagemEl.textContent = 'Selecione uma loja antes de enviar!';
        mensagemEl.className = 'status-msg error';
        window.globalUI?.showToast('warning', 'Selecione uma loja');
        return;
    }

    // Se produto não foi buscado, buscar agora
    if (!selectedProdutoDescricao && !descricao) {
        await buscarProduto();
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Enviando...';
    mensagemEl.textContent = '';

    try {
        // Preparar registro
        const registro = {
            empresa_id: userData.empresa_id,
            codigo_produto: codigo,
            descricao_produto: selectedProdutoDescricao || descricao || 'Produto não cadastrado',
            categoria: selectedProdutoCategoria || categoria || null,
            data_vencimento: validade,
            usuario_id: userData.id,
            usuario_nome: userData.nome || 'Usuário',
            data_coleta: new Date().toISOString()
        };

        // Adicionar loja_id se selecionada
        if (selectedLojaId) {
            registro.loja_id = selectedLojaId;
        }

        // Inserir na tabela coletas_deposito
        const { error } = await supabaseClient
            .from('coletas_deposito')
            .insert(registro);

        if (error) throw error;

        // Sucesso
        mensagemEl.textContent = '✓ Coleta registrada com sucesso!';
        mensagemEl.className = 'status-msg success';

        window.globalUI?.showToast('success', 'Coleta enviada com sucesso!');

        // Adicionar à lista da sessão
        const lojaNome = selectedLojaId
            ? lojasEmpresa.find(l => l.id === selectedLojaId)?.nome || ''
            : '';
        adicionarNaLista(
            selectedProdutoDescricao || descricao || 'Produto não cadastrado',
            selectedProdutoCategoria || categoria || '',
            validade,
            lojaNome
        );

        // Limpar formulário para próxima coleta (mantém loja selecionada)
        setTimeout(() => {
            const lojaAtual = selectedLojaId;
            limparFormulario();
            selectedLojaId = lojaAtual;
        }, 1500);

    } catch (err) {
        console.error(err);
        mensagemEl.textContent = 'Erro ao enviar: ' + err.message;
        mensagemEl.className = 'status-msg error';
        window.globalUI?.showToast('error', 'Erro ao enviar coleta');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Enviar`;
    }
}
