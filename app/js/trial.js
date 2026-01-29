/**
 * Trial Registration Logic
 * DataCerta 2.0 - Sistema de Assinaturas
 */

// =====================================================
// ELEMENTOS DO DOM
// =====================================================

const form = document.getElementById('trialForm');
const btnSubmit = document.getElementById('btnSubmit');
const alertError = document.getElementById('alertError');
const formLoading = document.getElementById('formLoading');
const successScreen = document.getElementById('successScreen');
const emailConfirmacao = document.getElementById('emailConfirmacao');

// Inputs
const inputs = {
    nomeEmpresa: document.getElementById('nomeEmpresa'),
    cpfCnpj: document.getElementById('cpfCnpj'),
    telefone: document.getElementById('telefone'),
    nomeCliente: document.getElementById('nomeCliente'),
    email: document.getElementById('email'),
    cep: document.getElementById('cep'),
    cidade: document.getElementById('cidade'),
    rua: document.getElementById('rua'),
    bairro: document.getElementById('bairro'),
    numero: document.getElementById('numero'),
    complemento: document.getElementById('complemento'),
    uf: document.getElementById('uf'),
    deviceFingerprint: document.getElementById('deviceFingerprint')
};

// Wrappers para validação visual
const wrappers = {
    cpfCnpj: document.getElementById('cpfCnpjWrapper'),
    telefone: document.getElementById('telefoneWrapper'),
    email: document.getElementById('emailWrapper'),
    cep: document.getElementById('cepWrapper')
};

const cepLoading = document.getElementById('cepLoading');

// =====================================================
// INICIALIZAÇÃO
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    // Aplicar máscaras
    aplicarMascaraDocumento(inputs.cpfCnpj);
    aplicarMascaraTelefone(inputs.telefone);
    aplicarMascaraCEP(inputs.cep);

    // Gerar fingerprint do dispositivo
    gerarFingerprint();

    // Event listeners para validação em tempo real
    inputs.cpfCnpj.addEventListener('blur', validarCampoCpfCnpj);
    inputs.telefone.addEventListener('blur', validarCampoTelefone);
    inputs.email.addEventListener('blur', validarCampoEmail);
    inputs.cep.addEventListener('blur', buscarEnderecoPorCEP);

    // Também validar enquanto digita (após sair do campo)
    inputs.cpfCnpj.addEventListener('input', () => {
        wrappers.cpfCnpj.classList.remove('valid', 'invalid');
    });
    inputs.telefone.addEventListener('input', () => {
        wrappers.telefone.classList.remove('valid', 'invalid');
    });
    inputs.email.addEventListener('input', () => {
        wrappers.email.classList.remove('valid', 'invalid');
    });
    inputs.cep.addEventListener('input', () => {
        wrappers.cep.classList.remove('valid', 'invalid');
    });
});

// =====================================================
// FINGERPRINTING DO DISPOSITIVO
// =====================================================

function gerarFingerprint() {
    try {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || '',
            navigator.platform
        ];

        // Hash simples
        const fingerprint = components.join('|');
        const hash = btoa(fingerprint).substring(0, 100);
        inputs.deviceFingerprint.value = hash;
    } catch (e) {
        inputs.deviceFingerprint.value = 'unknown';
    }
}

// =====================================================
// VALIDAÇÕES EM TEMPO REAL
// =====================================================

function validarCampoCpfCnpj() {
    const valor = inputs.cpfCnpj.value;
    if (!valor) return;

    const resultado = validarDocumento(valor);

    if (resultado.valido) {
        wrappers.cpfCnpj.classList.remove('invalid');
        wrappers.cpfCnpj.classList.add('valid');
    } else {
        wrappers.cpfCnpj.classList.remove('valid');
        wrappers.cpfCnpj.classList.add('invalid');
    }
}

function validarCampoTelefone() {
    const valor = inputs.telefone.value;
    if (!valor) return;

    if (validarTelefone(valor)) {
        wrappers.telefone.classList.remove('invalid');
        wrappers.telefone.classList.add('valid');
    } else {
        wrappers.telefone.classList.remove('valid');
        wrappers.telefone.classList.add('invalid');
    }
}

function validarCampoEmail() {
    const valor = inputs.email.value;
    if (!valor) return;

    if (validarEmail(valor) && !isEmailDescartavel(valor)) {
        wrappers.email.classList.remove('invalid');
        wrappers.email.classList.add('valid');
    } else {
        wrappers.email.classList.remove('valid');
        wrappers.email.classList.add('invalid');
    }
}

// =====================================================
// BUSCA DE CEP
// =====================================================

async function buscarEnderecoPorCEP() {
    const cep = inputs.cep.value.replace(/[^\d]/g, '');

    if (cep.length !== 8) {
        return;
    }

    // Mostrar loading
    cepLoading.style.display = 'block';
    wrappers.cep.classList.remove('valid', 'invalid');

    try {
        const resultado = await buscarCEP(cep);

        if (resultado.sucesso) {
            inputs.cidade.value = resultado.dados.cidade;
            inputs.rua.value = resultado.dados.rua;
            inputs.bairro.value = resultado.dados.bairro;
            inputs.uf.value = resultado.dados.uf;

            wrappers.cep.classList.add('valid');
        } else {
            wrappers.cep.classList.add('invalid');
            document.getElementById('cepError').textContent = resultado.erro;
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        wrappers.cep.classList.add('invalid');
    } finally {
        cepLoading.style.display = 'none';
    }
}

// =====================================================
// FUNÇÕES DE UI
// =====================================================

function showError(message) {
    alertError.textContent = message;
    alertError.classList.add('active');
    alertError.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
    alertError.classList.remove('active');
}

function setLoading(loading) {
    if (loading) {
        formLoading.classList.add('active');
        btnSubmit.disabled = true;
    } else {
        formLoading.classList.remove('active');
        btnSubmit.disabled = false;
    }
}

function showSuccess(email) {
    form.style.display = 'none';
    document.querySelector('.trial-header').style.display = 'none';
    emailConfirmacao.textContent = email;
    successScreen.classList.add('active');
}

// =====================================================
// VERIFICAÇÃO DE DUPLICIDADE
// =====================================================

async function verificarDuplicidade(cpfCnpj, telefone, email) {
    if (!window.supabaseClient) {
        throw new Error('Sistema ainda carregando. Aguarde.');
    }

    // Limpar CPF/CNPJ para comparação
    const cpfCnpjNumeros = cpfCnpj.replace(/[^\d]/g, '');
    const telefoneNumeros = telefone.replace(/[^\d]/g, '');

    // Verificar CPF/CNPJ
    const { data: cpfData, error: cpfError } = await window.supabaseClient
        .from('trials_registro')
        .select('id, status')
        .eq('cpf_cnpj', cpfCnpjNumeros)
        .neq('status', 'bloqueado')
        .limit(1);

    if (cpfError) {
        console.error('Erro ao verificar CPF/CNPJ:', cpfError);
    }

    if (cpfData && cpfData.length > 0) {
        throw new Error('Este CPF/CNPJ já foi utilizado para um período de teste.');
    }

    // Verificar telefone
    const { data: telData, error: telError } = await window.supabaseClient
        .from('trials_registro')
        .select('id, status')
        .eq('telefone', telefoneNumeros)
        .neq('status', 'bloqueado')
        .limit(1);

    if (telError) {
        console.error('Erro ao verificar telefone:', telError);
    }

    if (telData && telData.length > 0) {
        throw new Error('Este telefone já foi utilizado para um período de teste.');
    }

    // Verificar email (pode ser usado em outras empresas, mas não em trial ativo)
    const { data: emailData, error: emailError } = await window.supabaseClient
        .from('trials_registro')
        .select('id, status')
        .eq('email', email.toLowerCase())
        .in('status', ['pendente', 'ativo'])
        .limit(1);

    if (emailError) {
        console.error('Erro ao verificar email:', emailError);
    }

    if (emailData && emailData.length > 0) {
        throw new Error('Este email já possui um período de teste ativo ou pendente.');
    }

    return true;
}

// =====================================================
// GERAR TOKEN DE CONFIRMAÇÃO
// =====================================================

function gerarTokenConfirmacao() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// =====================================================
// ENVIAR CADASTRO
// =====================================================

async function enviarCadastro(dados) {
    if (!window.supabaseClient) {
        throw new Error('Sistema ainda carregando. Aguarde.');
    }

    // Gerar token de confirmação
    const token = gerarTokenConfirmacao();
    const tokenExpiraEm = new Date();
    tokenExpiraEm.setHours(tokenExpiraEm.getHours() + 24); // Expira em 24h

    // Preparar dados para inserção
    const registro = {
        nome_empresa: dados.nomeEmpresa,
        cpf_cnpj: dados.cpfCnpj.replace(/[^\d]/g, ''),
        email: dados.email.toLowerCase(),
        telefone: dados.telefone.replace(/[^\d]/g, ''),
        nome_cliente: dados.nomeCliente,
        cep: dados.cep.replace(/[^\d]/g, ''),
        cidade: dados.cidade,
        rua: dados.rua,
        bairro: dados.bairro,
        numero: dados.numero,
        complemento: dados.complemento || null,
        uf: dados.uf,
        device_fingerprint: dados.deviceFingerprint,
        token_confirmacao: token,
        token_expira_em: tokenExpiraEm.toISOString(),
        status: 'pendente'
    };

    // Inserir no banco
    const { data, error } = await window.supabaseClient
        .from('trials_registro')
        .insert([registro])
        .select();

    if (error) {
        console.error('Erro ao inserir trial:', error);

        // Verificar se é erro de duplicidade
        if (error.code === '23505') {
            throw new Error('Este CPF/CNPJ ou telefone já foi utilizado.');
        }

        throw new Error('Erro ao processar cadastro. Tente novamente.');
    }

    // TODO: Enviar email de confirmação
    // Por enquanto, apenas logamos o token
    console.log('Token de confirmação gerado:', token);
    console.log('Link de confirmação:', `${window.location.origin}/app/confirmar-trial.html?token=${token}`);

    return data[0];
}

// =====================================================
// SUBMIT DO FORMULÁRIO
// =====================================================

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    // Validar todos os campos
    validarCampoCpfCnpj();
    validarCampoTelefone();
    validarCampoEmail();

    // Verificar se há campos inválidos
    if (wrappers.cpfCnpj.classList.contains('invalid')) {
        showError('CPF/CNPJ inválido. Verifique e tente novamente.');
        return;
    }

    if (wrappers.telefone.classList.contains('invalid')) {
        showError('Telefone inválido. Verifique e tente novamente.');
        return;
    }

    if (wrappers.email.classList.contains('invalid')) {
        showError('Email inválido ou de domínio descartável.');
        return;
    }

    // Verificar campos obrigatórios
    if (!inputs.nomeEmpresa.value.trim()) {
        showError('Informe o nome da empresa.');
        return;
    }

    if (!inputs.nomeCliente.value.trim()) {
        showError('Informe seu nome completo.');
        return;
    }

    if (!inputs.cep.value.trim() || inputs.cep.value.replace(/[^\d]/g, '').length !== 8) {
        showError('Informe um CEP válido.');
        return;
    }

    if (!inputs.numero.value.trim()) {
        showError('Informe o número do endereço.');
        return;
    }

    setLoading(true);

    try {
        // Aguardar Supabase estar pronto
        if (!window.supabaseClient) {
            await new Promise((resolve) => {
                window.addEventListener('supabaseReady', resolve, { once: true });
            });
        }

        // Verificar duplicidade
        await verificarDuplicidade(
            inputs.cpfCnpj.value,
            inputs.telefone.value,
            inputs.email.value
        );

        // Enviar cadastro
        const dados = {
            nomeEmpresa: inputs.nomeEmpresa.value.trim(),
            cpfCnpj: inputs.cpfCnpj.value,
            telefone: inputs.telefone.value,
            nomeCliente: inputs.nomeCliente.value.trim(),
            email: inputs.email.value.trim(),
            cep: inputs.cep.value,
            cidade: inputs.cidade.value,
            rua: inputs.rua.value,
            bairro: inputs.bairro.value,
            numero: inputs.numero.value.trim(),
            complemento: inputs.complemento.value.trim(),
            uf: inputs.uf.value,
            deviceFingerprint: inputs.deviceFingerprint.value
        };

        await enviarCadastro(dados);

        // Mostrar tela de sucesso
        showSuccess(dados.email);

    } catch (error) {
        console.error('Erro no cadastro:', error);
        showError(error.message || 'Erro ao processar cadastro. Tente novamente.');
    } finally {
        setLoading(false);
    }
});


// =====================================================
// ATUALIZAR INDICADOR DE PASSOS
// =====================================================

function atualizarSteps() {
    const steps = document.querySelectorAll('.step-dot');
    const sections = document.querySelectorAll('.form-section');

    // Verificar qual seção está mais visível
    let activeIndex = 0;
    sections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2) {
            activeIndex = index;
        }
    });

    steps.forEach((step, index) => {
        step.classList.toggle('active', index === activeIndex);
    });
}

// Atualizar steps ao rolar
document.querySelector('.trial-form')?.addEventListener('scroll', atualizarSteps);
