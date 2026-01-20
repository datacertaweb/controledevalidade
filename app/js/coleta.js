// Coleta JS - Batch Mode
let userData = null;
let html5QrCode = null;
let selectedProdutoId = null;
let selectedProdutoDescricao = null;
let currentLojaId = null;
let currentLojaName = null;

// Lista de itens coletados (em memória)
let listaItens = [];

// Aguardar Supabase
window.addEventListener('supabaseReady', initColeta);
setTimeout(() => { if (window.supabaseClient && !userData) initColeta(); }, 500);

async function initColeta() {
    if (userData) return;

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

        // Carregar loja do usuário
        await carregarLoja();

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
        console.error('Erro initColeta:', error);
    }
}

// ------ LOJA ------

async function carregarLoja() {
    try {
        // Buscar lojas do usuário
        const userLojas = await auth.getUserLojas(userData.id);
        let lojaId = null;

        if (userLojas && userLojas.length > 0) {
            lojaId = userLojas[0];
        } else {
            // Admin sem loja específica - pegar primeira da empresa
            const { data: lojas } = await supabaseClient
                .from('lojas')
                .select('id, nome')
                .eq('empresa_id', userData.empresa_id)
                .eq('ativo', true)
                .limit(1);
            if (lojas && lojas.length > 0) {
                lojaId = lojas[0].id;
                currentLojaName = lojas[0].nome;
            }
        }

        if (lojaId) {
            currentLojaId = lojaId;
            // Buscar nome se ainda não temos
            if (!currentLojaName) {
                const { data: loja } = await supabaseClient
                    .from('lojas')
                    .select('nome')
                    .eq('id', lojaId)
                    .single();
                if (loja) currentLojaName = loja.nome;
            }
        }

        document.getElementById('lojaNome').textContent = currentLojaName || 'Loja não definida';

    } catch (err) {
        console.error('Erro carregarLoja:', err);
        document.getElementById('lojaNome').textContent = 'Erro ao carregar';
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
            () => {}
        );
    } catch (err) {
        console.error("Erro scanner:", err);
        window.globalUI.showToast('error', 'Erro ao iniciar câmera');
        stopScanner();
    }
}

function onScanSuccess(decodedText) {
    document.getElementById('codigo').value = decodedText;
    stopScanner();
    buscarProduto();
    window.globalUI.showToast('success', 'Código lido: ' + decodedText);
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
    if (!codigo) return;

    selectedProdutoId = null;
    selectedProdutoDescricao = null;
    document.getElementById('produtoInfo').classList.remove('active');

    if (!userData || !userData.empresa_id) return;

    try {
        const { data, error } = await supabaseClient
            .from('produtos')
            .select('id, descricao, categoria, valor_unitario')
            .eq('empresa_id', userData.empresa_id)
            .or(`codigo.eq.${codigo},ean.eq.${codigo}`)
            .single();

        if (error || !data) {
            window.globalUI.showToast('warning', 'Produto não encontrado');
            return;
        }

        selectedProdutoId = data.id;
        selectedProdutoDescricao = data.descricao;
        document.getElementById('produtoNome').textContent = data.descricao;
        document.getElementById('produtoCategoria').textContent = data.categoria || 'Sem categoria';
        document.getElementById('produtoInfo').classList.add('active');

        // Preencher valor se existir
        if (data.valor_unitario) {
            document.getElementById('valor').value = parseFloat(data.valor_unitario).toFixed(2);
        }

        document.getElementById('quantidade').focus();

    } catch (err) {
        console.error(err);
        window.globalUI.showToast('error', 'Erro ao buscar produto');
    }
}

// ------ ADICIONAR ITEM À LISTA ------

async function adicionarItem() {
    const codigo = document.getElementById('codigo').value.trim();
    const qtd = document.getElementById('quantidade').value;
    const validade = document.getElementById('validade').value;
    const setorNome = document.getElementById('setor').value;
    const valor = document.getElementById('valor').value;

    // Validação
    if (!codigo || !qtd || !validade) {
        window.globalUI.showAlert('Campos Obrigatórios', 'Preencha Código, Quantidade e Validade.', 'warning');
        return;
    }

    // Se produto não foi buscado, buscar agora
    if (!selectedProdutoId) {
        await buscarProduto();
        if (!selectedProdutoId) return;
    }

    // Criar item
    const item = {
        id: Date.now(), // ID temporário único
        codigo: codigo,
        produto_id: selectedProdutoId,
        descricao: selectedProdutoDescricao || 'Produto',
        quantidade: parseInt(qtd),
        validade: validade,
        setor: setorNome,
        valor: valor ? parseFloat(valor) : null,
        checked: false
    };

    listaItens.push(item);
    renderizarLista();
    limparFormularioParaProximo();

    window.globalUI.showToast('success', 'Item adicionado à lista');
}

function limparFormularioParaProximo() {
    document.getElementById('codigo').value = '';
    document.getElementById('quantidade').value = '';
    document.getElementById('validade').value = '';
    document.getElementById('valor').value = '';
    // Manter setor selecionado para facilitar
    
    selectedProdutoId = null;
    selectedProdutoDescricao = null;
    document.getElementById('produtoInfo').classList.remove('active');
    document.getElementById('codigo').focus();
}

function limparFormulario() {
    limparFormularioParaProximo();
    document.getElementById('setor').value = '';
}

// ------ RENDERIZAR LISTA ------

function renderizarLista() {
    const listCard = document.getElementById('listCard');
    const itemListEl = document.getElementById('itemList');
    const countEl = document.getElementById('listCount');
    const btnExcluir = document.getElementById('btn-excluir');
    const btnEnviar = document.getElementById('btn-enviar');

    if (listaItens.length === 0) {
        listCard.style.display = 'none';
        btnExcluir.style.display = 'none';
        btnEnviar.style.display = 'none';
        return;
    }

    listCard.style.display = 'block';
    btnEnviar.style.display = 'flex';
    countEl.textContent = listaItens.length;

    // Verificar se há itens selecionados
    const temSelecionados = listaItens.some(i => i.checked);
    btnExcluir.style.display = temSelecionados ? 'flex' : 'none';

    // Renderizar itens
    itemListEl.innerHTML = listaItens.map(item => `
        <div class="item-row">
            <input type="checkbox" class="item-checkbox" 
                   ${item.checked ? 'checked' : ''} 
                   onchange="toggleItemCheck(${item.id})">
            <div class="item-info">
                <div class="item-desc">${item.descricao}</div>
                <div class="item-meta">
                    <span>${item.codigo}</span>
                    <span>Val: ${formatarData(item.validade)}</span>
                </div>
            </div>
            <div class="item-qty">${item.quantidade} un</div>
        </div>
    `).join('');
}

function formatarData(dataStr) {
    if (!dataStr) return '-';
    const [ano, mes, dia] = dataStr.split('-');
    return `${dia}/${mes}/${ano}`;
}

function toggleItemCheck(itemId) {
    const item = listaItens.find(i => i.id === itemId);
    if (item) {
        item.checked = !item.checked;
        renderizarLista();
    }
}

function excluirSelecionados() {
    const qtdAntes = listaItens.length;
    listaItens = listaItens.filter(i => !i.checked);
    const excluidos = qtdAntes - listaItens.length;
    renderizarLista();
    window.globalUI.showToast('info', `${excluidos} item(s) removido(s)`);
}

// ------ ENVIAR TODOS ------

async function enviarTodos() {
    if (listaItens.length === 0) {
        window.globalUI.showAlert('Lista Vazia', 'Adicione itens antes de enviar.', 'warning');
        return;
    }

    if (!currentLojaId) {
        window.globalUI.showAlert('Erro', 'Loja não identificada.', 'error');
        return;
    }

    const btn = document.getElementById('btn-enviar');
    btn.disabled = true;
    btn.innerHTML = '<span>Enviando...</span>';

    try {
        // Preparar registros para inserção
        const registros = [];

        for (const item of listaItens) {
            // Buscar ou criar local_id
            let localId = null;
            if (item.setor) {
                const { data: localData } = await supabaseClient
                    .from('locais')
                    .select('id')
                    .eq('loja_id', currentLojaId)
                    .ilike('nome', item.setor)
                    .maybeSingle();

                if (localData) {
                    localId = localData.id;
                } else {
                    // Criar local
                    const { data: novoLocal } = await supabaseClient
                        .from('locais')
                        .insert({
                            loja_id: currentLojaId,
                            nome: item.setor,
                            descricao: 'Criado via App Coleta'
                        })
                        .select()
                        .single();
                    if (novoLocal) localId = novoLocal.id;
                }
            }

            registros.push({
                produto_id: item.produto_id,
                loja_id: currentLojaId,
                local_id: localId,
                quantidade: item.quantidade,
                validade: item.validade,
                usuario_id: userData.id
            });

            // Atualizar preço do produto se informado
            if (item.valor && item.valor > 0) {
                await supabaseClient
                    .from('produtos')
                    .update({ valor_unitario: item.valor })
                    .eq('id', item.produto_id);
            }
        }

        // Inserir todos os registros de estoque
        const { error } = await supabaseClient
            .from('estoque')
            .insert(registros);

        if (error) throw error;

        // Sucesso
        const qtd = listaItens.length;
        listaItens = [];
        renderizarLista();

        window.globalUI.showAlert('Sucesso!', `${qtd} item(s) enviado(s) com sucesso!`, 'success');

    } catch (err) {
        console.error(err);
        window.globalUI.showAlert('Erro', 'Falha ao enviar dados: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>Enviar Tudo`;
    }
}

// Manter compatibilidade com botão antigo (caso exista)
async function enviarDados() {
    await adicionarItem();
}
