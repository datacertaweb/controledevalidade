// Coleta JS - Batch Mode
let userData = null;
let html5QrCode = null;
let html5QrCodePerda = null;
let selectedProdutoId = null;
let selectedProdutoDescricao = null;
let currentLojaId = null;
let currentLojaName = null;

// Lista de itens coletados (em memória)
let listaItens = [];

// Modo atual: 'entrada' ou 'perda'
let currentMode = 'entrada';

// Variáveis para modo perda
let selectedProdutoIdPerda = null;
let selectedProdutoDescricaoPerda = null;
let listaPerdas = [];
let validadesDisponiveis = [];

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

        // Event Listeners Perda
        document.getElementById('startScanBtnPerda')?.addEventListener('click', startScannerPerda);
        document.getElementById('stopScanBtnPerda')?.addEventListener('click', stopScannerPerda);

        const inputCodigoPerda = document.getElementById('codigoPerda');
        inputCodigoPerda?.addEventListener('change', buscarProdutoPerda);
        inputCodigoPerda?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscarProdutoPerda();
            }
        });

    } catch (error) {
        console.error('Erro initColeta:', error);
    }
}

// ------ LOJA ------

async function carregarLoja() {
    try {
        const isAdmin = auth.isAdmin(userData);
        const lojaSelect = document.getElementById('lojaSelect');
        const lojaNomeEl = document.getElementById('lojaNome');

        if (isAdmin) {
            // Admin: mostrar dropdown com todas as lojas da empresa
            const { data: lojas } = await supabaseClient
                .from('lojas')
                .select('id, nome')
                .eq('empresa_id', userData.empresa_id)
                .eq('ativo', true)
                .order('nome');

            if (lojas && lojas.length > 0) {
                // Popular dropdown
                lojaSelect.innerHTML = '<option value="">Selecione uma loja...</option>';
                lojas.forEach(loja => {
                    lojaSelect.innerHTML += `<option value="${loja.id}">${loja.nome}</option>`;
                });

                // Mostrar dropdown, esconder texto
                lojaSelect.style.display = 'block';
                lojaNomeEl.style.display = 'none';

                // Selecionar primeira loja por padrão
                lojaSelect.value = lojas[0].id;
                currentLojaId = lojas[0].id;
                currentLojaName = lojas[0].nome;

                // Event listener para mudança de loja
                lojaSelect.addEventListener('change', function () {
                    const selectedOption = this.options[this.selectedIndex];
                    currentLojaId = this.value;
                    currentLojaName = selectedOption.text;
                });
            }
        } else {
            // Usuário comum: mostrar apenas sua loja
            const userLojas = await auth.getUserLojas(userData.id);
            let lojaId = null;

            if (userLojas && userLojas.length > 0) {
                lojaId = userLojas[0];
            }

            if (lojaId) {
                currentLojaId = lojaId;
                const { data: loja } = await supabaseClient
                    .from('lojas')
                    .select('nome')
                    .eq('id', lojaId)
                    .single();
                if (loja) currentLojaName = loja.nome;
            }

            lojaNomeEl.textContent = currentLojaName || 'Loja não definida';
            lojaSelect.style.display = 'none';
            lojaNomeEl.style.display = 'block';
        }

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
            () => { }
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
    const descricaoEl = document.getElementById('descricao');

    if (!codigo) {
        descricaoEl.value = '';
        descricaoEl.placeholder = 'Aguardando código...';
        return;
    }

    selectedProdutoId = null;
    selectedProdutoDescricao = null;
    document.getElementById('produtoInfo').classList.remove('active');
    descricaoEl.value = '';
    descricaoEl.placeholder = 'Buscando...';

    if (!userData || !userData.empresa_id) return;

    try {
        // Buscar primeiro por código exato
        let { data, error } = await supabaseClient
            .from('produtos')
            .select('id, descricao, categoria, valor_unitario')
            .eq('empresa_id', userData.empresa_id)
            .eq('codigo', codigo)
            .maybeSingle();

        // Se não encontrou por código, buscar por EAN
        if (!data) {
            const result = await supabaseClient
                .from('produtos')
                .select('id, descricao, categoria, valor_unitario')
                .eq('empresa_id', userData.empresa_id)
                .eq('ean', codigo)
                .maybeSingle();
            data = result.data;
            error = result.error;
        }

        if (error || !data) {
            descricaoEl.value = '';
            descricaoEl.placeholder = 'Produto não encontrado';
            window.globalUI.showToast('warning', 'Produto não encontrado');
            return;
        }

        selectedProdutoId = data.id;
        selectedProdutoDescricao = data.descricao;

        // Preencher campo descrição
        descricaoEl.value = data.descricao;

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
        descricaoEl.value = '';
        descricaoEl.placeholder = 'Erro ao buscar';
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
    document.getElementById('descricao').value = '';
    document.getElementById('descricao').placeholder = 'Aguardando código...';
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

// ====== SISTEMA DE ABAS ======

function switchTab(mode) {
    currentMode = mode;

    // Atualizar botões de aba
    document.getElementById('tabEntrada').classList.toggle('active', mode === 'entrada');
    document.getElementById('tabPerda').classList.toggle('active', mode === 'perda');

    // Mostrar/ocultar conteúdos
    document.getElementById('contentEntrada').classList.toggle('active', mode === 'entrada');
    document.getElementById('contentPerda').classList.toggle('active', mode === 'perda');
}

// ====== SCANNER PERDA ======

async function startScannerPerda() {
    const videoContainer = document.getElementById('video-container-perda');
    const startBtn = document.getElementById('startScanBtnPerda');

    videoContainer.style.display = 'block';
    startBtn.style.display = 'none';

    html5QrCodePerda = new Html5Qrcode("reader-perda");

    const config = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.5
    };

    try {
        await html5QrCodePerda.start(
            { facingMode: "environment" },
            config,
            onScanSuccessPerda,
            () => { }
        );
    } catch (err) {
        console.error("Erro scanner perda:", err);
        window.globalUI.showToast('error', 'Erro ao iniciar câmera');
        stopScannerPerda();
    }
}

function onScanSuccessPerda(decodedText) {
    document.getElementById('codigoPerda').value = decodedText;
    stopScannerPerda();
    buscarProdutoPerda();
    window.globalUI.showToast('success', 'Código lido: ' + decodedText);
}

function stopScannerPerda() {
    if (html5QrCodePerda) {
        html5QrCodePerda.stop().then(() => {
            html5QrCodePerda.clear();
            html5QrCodePerda = null;
        }).catch(err => console.error(err));
    }
    document.getElementById('video-container-perda').style.display = 'none';
    document.getElementById('startScanBtnPerda').style.display = 'flex';
}

// ====== BUSCAR PRODUTO PERDA ======

async function buscarProdutoPerda() {
    const codigo = document.getElementById('codigoPerda').value.trim();
    const descricaoEl = document.getElementById('descricaoPerda');
    const validadeSelect = document.getElementById('validadePerda');

    if (!codigo) {
        descricaoEl.value = '';
        descricaoEl.placeholder = 'Aguardando código...';
        validadeSelect.innerHTML = '<option value="">Busque o produto primeiro...</option>';
        return;
    }

    selectedProdutoIdPerda = null;
    selectedProdutoDescricaoPerda = null;
    descricaoEl.value = '';
    descricaoEl.placeholder = 'Buscando...';
    validadeSelect.innerHTML = '<option value="">Carregando validades...</option>';

    if (!userData || !userData.empresa_id) return;

    try {
        // Buscar produto por código
        let { data, error } = await supabaseClient
            .from('produtos')
            .select('id, descricao, categoria, valor_unitario')
            .eq('empresa_id', userData.empresa_id)
            .eq('codigo', codigo)
            .maybeSingle();

        // Se não encontrou por código, buscar por EAN
        if (!data) {
            const result = await supabaseClient
                .from('produtos')
                .select('id, descricao, categoria, valor_unitario')
                .eq('empresa_id', userData.empresa_id)
                .eq('ean', codigo)
                .maybeSingle();
            data = result.data;
            error = result.error;
        }

        if (error || !data) {
            descricaoEl.value = '';
            descricaoEl.placeholder = 'Produto não encontrado';
            validadeSelect.innerHTML = '<option value="">Produto não encontrado</option>';
            window.globalUI.showToast('warning', 'Produto não encontrado');
            return;
        }

        selectedProdutoIdPerda = data.id;
        selectedProdutoDescricaoPerda = data.descricao;
        descricaoEl.value = data.descricao;

        // Buscar validades disponíveis na tabela coletados
        await buscarValidades(data.id);

        document.getElementById('quantidadePerda').focus();

    } catch (err) {
        console.error(err);
        descricaoEl.value = '';
        descricaoEl.placeholder = 'Erro ao buscar';
        window.globalUI.showToast('error', 'Erro ao buscar produto');
    }
}

async function buscarValidades(produtoId) {
    const validadeSelect = document.getElementById('validadePerda');

    if (!currentLojaId) {
        validadeSelect.innerHTML = '<option value="">Selecione a loja primeiro</option>';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('coletados')
            .select('id, validade, quantidade')
            .eq('produto_id', produtoId)
            .eq('loja_id', currentLojaId)
            .gt('quantidade', 0)
            .order('validade');

        if (error) throw error;

        validadesDisponiveis = data || [];

        if (validadesDisponiveis.length === 0) {
            validadeSelect.innerHTML = '<option value="">Nenhuma validade encontrada</option>';
            return;
        }

        validadeSelect.innerHTML = '<option value="">Selecione a validade...</option>' +
            validadesDisponiveis.map(v => {
                const dataFormatada = new Date(v.validade).toLocaleDateString('pt-BR');
                return `<option value="${v.id}" data-qtd="${v.quantidade}">${dataFormatada} (Qtd: ${v.quantidade})</option>`;
            }).join('');

    } catch (err) {
        console.error(err);
        validadeSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

// ====== ADICIONAR ITEM PERDA ======

async function adicionarItemPerda() {
    const codigo = document.getElementById('codigoPerda').value.trim();
    const validadeId = document.getElementById('validadePerda').value;
    const qtd = document.getElementById('quantidadePerda').value;

    if (!codigo || !validadeId || !qtd) {
        window.globalUI.showAlert('Campos Obrigatórios', 'Preencha Código, Validade e Quantidade.', 'warning');
        return;
    }

    if (!selectedProdutoIdPerda) {
        await buscarProdutoPerda();
        if (!selectedProdutoIdPerda) return;
    }

    // Verificar quantidade disponível
    const itemColetado = validadesDisponiveis.find(v => v.id === validadeId);
    if (!itemColetado) {
        window.globalUI.showAlert('Erro', 'Validade não encontrada.', 'error');
        return;
    }

    const qtdNum = parseInt(qtd);
    if (qtdNum > itemColetado.quantidade) {
        window.globalUI.showAlert('Quantidade Inválida', `Quantidade máxima disponível: ${itemColetado.quantidade}`, 'warning');
        return;
    }

    // Criar item de perda
    const item = {
        id: Date.now(),
        codigo: codigo,
        coletado_id: validadeId,
        produto_id: selectedProdutoIdPerda,
        descricao: selectedProdutoDescricaoPerda || 'Produto',
        quantidade: qtdNum,
        validade: itemColetado.validade,
        qtdDisponivel: itemColetado.quantidade,
        checked: false
    };

    listaPerdas.push(item);
    renderizarListaPerda();
    limparFormularioPerda();

    window.globalUI.showToast('success', 'Item adicionado à lista de perdas');
}

function limparFormularioPerda() {
    document.getElementById('codigoPerda').value = '';
    document.getElementById('quantidadePerda').value = '';
    document.getElementById('validadePerda').innerHTML = '<option value="">Busque o produto primeiro...</option>';
    document.getElementById('descricaoPerda').value = '';
    document.getElementById('descricaoPerda').placeholder = 'Aguardando código...';

    selectedProdutoIdPerda = null;
    selectedProdutoDescricaoPerda = null;
    validadesDisponiveis = [];
    document.getElementById('codigoPerda').focus();
}

// ====== RENDERIZAR LISTA PERDA ======

function renderizarListaPerda() {
    const listCard = document.getElementById('listCardPerda');
    const itemListEl = document.getElementById('itemListPerda');
    const countEl = document.getElementById('listCountPerda');
    const btnExcluir = document.getElementById('btn-excluir');
    const btnEnviar = document.getElementById('btn-enviar');

    if (listaPerdas.length === 0) {
        listCard.style.display = 'none';
        btnExcluir.style.display = 'none';
        btnEnviar.style.display = 'none';
        return;
    }

    listCard.style.display = 'block';
    btnEnviar.style.display = 'flex';
    countEl.textContent = listaPerdas.length;

    const temSelecionados = listaPerdas.some(i => i.checked);
    btnExcluir.style.display = temSelecionados ? 'flex' : 'none';

    itemListEl.innerHTML = listaPerdas.map(item => `
        <div class="item-row">
            <input type="checkbox" class="item-checkbox" 
                   ${item.checked ? 'checked' : ''} 
                   onchange="toggleItemCheckPerda(${item.id})">
            <div class="item-info">
                <div class="item-desc">${item.descricao}</div>
                <div class="item-meta">
                    <span>${item.codigo}</span>
                    <span>Val: ${formatarData(item.validade)}</span>
                </div>
            </div>
            <div class="item-qty" style="color: #DC2626;">${item.quantidade} un</div>
        </div>
    `).join('');
}

function toggleItemCheckPerda(itemId) {
    const item = listaPerdas.find(i => i.id === itemId);
    if (item) {
        item.checked = !item.checked;
        renderizarListaPerda();
    }
}

function excluirSelecionadosPerda() {
    const qtdAntes = listaPerdas.length;
    listaPerdas = listaPerdas.filter(i => !i.checked);
    const excluidos = qtdAntes - listaPerdas.length;
    renderizarListaPerda();
    window.globalUI.showToast('info', `${excluidos} item(s) removido(s)`);
}

// ====== ENVIAR TODOS PERDA ======

async function enviarTodosPerda() {
    if (listaPerdas.length === 0) {
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
        for (const item of listaPerdas) {
            // Buscar dados do coletado
            const { data: coletado } = await supabaseClient
                .from('coletados')
                .select('*, base(valor_unitario)')
                .eq('id', item.coletado_id)
                .single();

            if (!coletado) continue;

            const valorPerda = (coletado.base?.valor_unitario || 0) * item.quantidade;

            // Inserir na tabela perdas
            const { error: perdaError } = await supabaseClient.from('perdas').insert({
                estoque_id: item.coletado_id,
                produto_id: item.produto_id,
                loja_id: currentLojaId,
                local_id: coletado.local_id,
                quantidade: item.quantidade,
                valor_perda: valorPerda,
                motivo: 'Coletado via App',
                registrado_por: userData.id
            });

            if (perdaError) throw perdaError;

            // Atualizar ou remover do coletados
            if (item.quantidade >= coletado.quantidade) {
                await supabaseClient.from('coletados').delete().eq('id', item.coletado_id);
            } else {
                await supabaseClient.from('coletados').update({
                    quantidade: coletado.quantidade - item.quantidade
                }).eq('id', item.coletado_id);
            }
        }

        const qtd = listaPerdas.length;
        listaPerdas = [];
        renderizarListaPerda();

        window.globalUI.showAlert('Sucesso!', `${qtd} perda(s) registrada(s) com sucesso!`, 'success');

    } catch (err) {
        console.error(err);
        window.globalUI.showAlert('Erro', 'Falha ao enviar dados: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>Enviar Tudo`;
    }
}
