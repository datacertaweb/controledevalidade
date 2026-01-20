
// Coleta JS
let userData = null;
let html5QrCode = null;
let selectedProdutoId = null;

// Aguardar Supabase
window.addEventListener('supabaseReady', initColeta);
// Fallback caso script já tenha carregado
setTimeout(() => { if (window.supabaseClient && !userData) initColeta(); }, 500);

async function initColeta() {
    if (userData) return; // Já iniciou

    try {
        const user = await auth.getUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }

        userData = await auth.getCurrentUserData();
        if (!userData) {
            window.globalUI.showToast('error', 'Erro ao carregar dados do usuário');
            return;
        }

        // Event Listeners
        document.getElementById('startScanBtn').addEventListener('click', startScanner);
        document.getElementById('stopScanBtn').addEventListener('click', stopScanner);

        // Buscar produto ao sair do campo ou pressionar Enter
        const inputCodigo = document.getElementById('codigo');
        inputCodigo.addEventListener('change', buscarProduto);
        inputCodigo.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') buscarProduto();
        });

    } catch (error) {
        console.error('Erro initColeta:', error);
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
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        );
    } catch (err) {
        console.error("Erro scanner:", err);
        window.globalUI.showToast('error', 'Erro ao iniciar câmera: ' + err);
        stopScanner();
    }
}

function onScanSuccess(decodedText) {
    // Tocar som de beep (opcional)
    // const audio = new Audio('beep.mp3'); audio.play().catch(e=>{});

    document.getElementById('codigo').value = decodedText;
    stopScanner();
    buscarProduto(); // Buscar automaticamente

    window.globalUI.showToast('success', 'Código lido: ' + decodedText);
}

function onScanFailure(error) {
    // console.warn(error);
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

// ------ LÓGICA DE DADOS ------

async function buscarProduto() {
    const codigo = document.getElementById('codigo').value.trim();
    if (!codigo) return;

    // Limpar info anterior
    selectedProdutoId = null;
    document.getElementById('produtoInfo').classList.remove('active');

    if (!userData || !userData.empresa_id) return;

    window.globalUI.showToast('info', 'Buscando produto...');

    try {
        // Tentar buscar por codigo ou EAN
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('id, descricao, categoria')
            .eq('empresa_id', userData.empresa_id)
            .or(`codigo.eq.${codigo},ean.eq.${codigo}`)
            .single();

        if (error || !data) {
            window.globalUI.showToast('warning', 'Produto não encontrado. Verifique o código.');
            // Opcional: oferecer cadastro rápido?
            return;
        }

        // Produto encontrado
        selectedProdutoId = data.id;
        document.getElementById('produtoNome').textContent = data.descricao;
        document.getElementById('produtoCategoria').textContent = data.categoria || 'Sem categoria';
        document.getElementById('produtoInfo').classList.add('active');

        // Focar na quantidade
        document.getElementById('quantidade').focus();

    } catch (err) {
        console.error(err);
        window.globalUI.showToast('error', 'Erro ao buscar produto.');
    }
}

async function enviarDados() {
    const btn = document.getElementById('btn-enviar');

    // Validação Básica
    const codigo = document.getElementById('codigo').value;
    const qtd = document.getElementById('quantidade').value;
    const validade = document.getElementById('validade').value;
    const setorNome = document.getElementById('setor').value;

    if (!codigo || !qtd || !validade || !setorNome) {
        window.globalUI.showAlert('Campos Obrigatórios', 'Preencha todos os campos para salvar.', 'warning');
        return;
    }

    // Se produto não foi buscado (digitou e clicou enviar direto), buscar agora
    // Mas selectedProdutoId é ideal. Se não tiver, tentar buscar rapidinho?
    if (!selectedProdutoId) {
        await buscarProduto();
        if (!selectedProdutoId) return; // Erro já exibido no buscarProduto
    }

    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
        // 1. Obter Loja (Usar a primeira loja do usuário ou vinculada)
        const userLojas = await auth.getUserLojas(userData.id);
        let lojaId = null;

        if (userLojas && userLojas.length > 0) {
            lojaId = userLojas[0]; // Pega a primeira
        } else {
            // Se for admin/master e não tiver loja vinculada, precisa buscar uma loja da empresa?
            // Simplificação: buscar a primeira loja da empresa
            const { data: lojas } = await supabaseClient
                .from('lojas')
                .select('id')
                .eq('empresa_id', userData.empresa_id)
                .limit(1);
            if (lojas && lojas.length > 0) lojaId = lojas[0].id;
        }

        if (!lojaId) {
            throw new Error('Usuário não possui loja vinculada para registrar estoque.');
        }

        // 2. Obter Local ID (Setor)
        // Tentar encontrar local pelo nome
        let localId = null;
        let { data: localData } = await supabaseClient
            .from('locais')
            .select('id')
            .eq('loja_id', lojaId)
            .ilike('nome', setorNome) // Case insensitive
            .maybeSingle();

        if (localData) {
            localId = localData.id;
        } else {
            // Se não existe, criar? Ou selecionar um padrão?
            // Modelo plano: tentar encontrar. Se não achar, criar?
            // Vamos criar para garantir que funcione
            const { data: novoLocal, error: errLocal } = await supabaseClient
                .from('locais')
                .insert({
                    loja_id: lojaId,
                    nome: setorNome,
                    descricao: 'Criado via App Coleta'
                })
                .select()
                .single();

            if (novoLocal) localId = novoLocal.id;
        }

        // 3. Inserir no Estoque
        const { error } = await supabaseClient
            .from('estoque')
            .insert({
                produto_id: selectedProdutoId,
                loja_id: lojaId,
                local_id: localId,
                quantidade: parseInt(qtd),
                validade: validade,
                usuario_id: userData.id, // Opcional, se tabela aceitar
                created_at: new Date().toISOString()
            });

        if (error) throw error;

        // Sucesso
        window.globalUI.showToast('success', 'Coleta salva com sucesso!');
        limparFormulario();

    } catch (err) {
        console.error(err);
        window.globalUI.showAlert('Erro', 'Falha ao salvar dados: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar Coleta';
    }
}

function limparFormulario() {
    document.getElementById('codigo').value = '';
    document.getElementById('quantidade').value = '';
    document.getElementById('validade').value = '';
    document.getElementById('setor').value = ''; // Reset select

    selectedProdutoId = null;
    document.getElementById('produtoInfo').classList.remove('active');

    // Focar no codigo para proxima
    // document.getElementById('codigo').focus();
}
