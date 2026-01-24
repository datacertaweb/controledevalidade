/**
 * Depósito JS - Coleta de Depósito/Recebimento
 * DataCerta 2.0
 */

let userData = null;
let html5QrCode = null;
let selectedProdutoId = null;
let selectedProdutoDescricao = null;
let selectedProdutoCategoria = null;

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

        // Exibir empresa e usuário
        await carregarInfoHeader();

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

        // Inserir na tabela coletas_deposito
        const { error } = await supabaseClient
            .from('coletas_deposito')
            .insert(registro);

        if (error) throw error;

        // Sucesso
        mensagemEl.textContent = '✓ Coleta registrada com sucesso!';
        mensagemEl.className = 'status-msg success';

        window.globalUI?.showToast('success', 'Coleta enviada com sucesso!');

        // Limpar formulário para próxima coleta
        setTimeout(() => {
            limparFormulario();
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
