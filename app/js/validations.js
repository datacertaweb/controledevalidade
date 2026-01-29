/**
 * Validações de dados brasileiros: CPF, CNPJ e CEP
 * DataCerta 2.0 - Sistema de Assinaturas
 */

// =====================================================
// VALIDAÇÃO DE CPF
// =====================================================

/**
 * Valida um número de CPF brasileiro
 * @param {string} cpf - CPF com ou sem formatação
 * @returns {boolean} - true se válido
 */
function validarCPF(cpf) {
    // Remove caracteres não numéricos
    cpf = cpf.replace(/[^\d]/g, '');

    // CPF deve ter 11 dígitos
    if (cpf.length !== 11) return false;

    // Verifica se todos os dígitos são iguais (inválido)
    if (/^(\d)\1{10}$/.test(cpf)) return false;

    // Validação do primeiro dígito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;

    // Validação do segundo dígito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;

    return true;
}

/**
 * Formata CPF para exibição (XXX.XXX.XXX-XX)
 * @param {string} cpf - CPF sem formatação
 * @returns {string} - CPF formatado
 */
function formatarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// =====================================================
// VALIDAÇÃO DE CNPJ
// =====================================================

/**
 * Valida um número de CNPJ brasileiro
 * @param {string} cnpj - CNPJ com ou sem formatação
 * @returns {boolean} - true se válido
 */
function validarCNPJ(cnpj) {
    // Remove caracteres não numéricos
    cnpj = cnpj.replace(/[^\d]/g, '');

    // CNPJ deve ter 14 dígitos
    if (cnpj.length !== 14) return false;

    // Verifica se todos os dígitos são iguais (inválido)
    if (/^(\d)\1{13}$/.test(cnpj)) return false;

    // Validação do primeiro dígito verificador
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(0))) return false;

    // Validação do segundo dígito verificador
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(1))) return false;

    return true;
}

/**
 * Formata CNPJ para exibição (XX.XXX.XXX/XXXX-XX)
 * @param {string} cnpj - CNPJ sem formatação
 * @returns {string} - CNPJ formatado
 */
function formatarCNPJ(cnpj) {
    cnpj = cnpj.replace(/[^\d]/g, '');
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// =====================================================
// VALIDAÇÃO CPF OU CNPJ (AUTOMÁTICA)
// =====================================================

/**
 * Detecta e valida CPF ou CNPJ automaticamente
 * @param {string} documento - CPF ou CNPJ
 * @returns {{valido: boolean, tipo: string, formatado: string}}
 */
function validarDocumento(documento) {
    const numeros = documento.replace(/[^\d]/g, '');

    if (numeros.length === 11) {
        return {
            valido: validarCPF(numeros),
            tipo: 'CPF',
            formatado: formatarCPF(numeros)
        };
    } else if (numeros.length === 14) {
        return {
            valido: validarCNPJ(numeros),
            tipo: 'CNPJ',
            formatado: formatarCNPJ(numeros)
        };
    }

    return {
        valido: false,
        tipo: 'DESCONHECIDO',
        formatado: documento
    };
}

// =====================================================
// BUSCA DE CEP (ViaCEP)
// =====================================================

/**
 * Busca endereço completo pelo CEP usando ViaCEP
 * @param {string} cep - CEP com ou sem formatação
 * @returns {Promise<{sucesso: boolean, dados?: object, erro?: string}>}
 */
async function buscarCEP(cep) {
    // Remove caracteres não numéricos
    cep = cep.replace(/[^\d]/g, '');

    // CEP deve ter 8 dígitos
    if (cep.length !== 8) {
        return { sucesso: false, erro: 'CEP deve ter 8 dígitos' };
    }

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);

        if (!response.ok) {
            return { sucesso: false, erro: 'Erro ao consultar CEP' };
        }

        const data = await response.json();

        if (data.erro) {
            return { sucesso: false, erro: 'CEP não encontrado' };
        }

        return {
            sucesso: true,
            dados: {
                cep: data.cep,
                rua: data.logradouro,
                complemento: data.complemento,
                bairro: data.bairro,
                cidade: data.localidade,
                uf: data.uf,
                ibge: data.ibge
            }
        };
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        return { sucesso: false, erro: 'Erro de conexão ao buscar CEP' };
    }
}

/**
 * Formata CEP para exibição (XXXXX-XXX)
 * @param {string} cep - CEP sem formatação
 * @returns {string} - CEP formatado
 */
function formatarCEP(cep) {
    cep = cep.replace(/[^\d]/g, '');
    return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
}

// =====================================================
// VALIDAÇÃO DE EMAIL
// =====================================================

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean}
 */
function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Verifica se email é de domínio temporário/descartável
 * @param {string} email - Email a verificar
 * @returns {boolean} - true se for descartável
 */
function isEmailDescartavel(email) {
    const dominiosDescartaveis = [
        'tempmail.com', 'guerrillamail.com', 'mailinator.com',
        'throwaway.email', 'temp-mail.org', 'fakeinbox.com',
        'yopmail.com', 'maildrop.cc', '10minutemail.com',
        'trashmail.com', 'discard.email', 'mailnesia.com'
    ];

    const dominio = email.split('@')[1]?.toLowerCase();
    return dominiosDescartaveis.includes(dominio);
}

// =====================================================
// VALIDAÇÃO DE TELEFONE
// =====================================================

/**
 * Valida telefone brasileiro (celular ou fixo)
 * @param {string} telefone - Telefone com ou sem formatação
 * @returns {boolean}
 */
function validarTelefone(telefone) {
    const numeros = telefone.replace(/[^\d]/g, '');

    // Celular: 11 dígitos (com DDD)
    // Fixo: 10 dígitos (com DDD)
    if (numeros.length < 10 || numeros.length > 11) return false;

    // DDD válido (11-99)
    const ddd = parseInt(numeros.substring(0, 2));
    if (ddd < 11 || ddd > 99) return false;

    // Celular deve começar com 9
    if (numeros.length === 11 && numeros.charAt(2) !== '9') return false;

    return true;
}

/**
 * Formata telefone para exibição
 * @param {string} telefone - Telefone sem formatação
 * @returns {string} - Telefone formatado
 */
function formatarTelefone(telefone) {
    const numeros = telefone.replace(/[^\d]/g, '');

    if (numeros.length === 11) {
        return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (numeros.length === 10) {
        return numeros.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }

    return telefone;
}

// =====================================================
// MÁSCARAS DE INPUT
// =====================================================

/**
 * Aplica máscara de CPF/CNPJ em tempo real
 * @param {HTMLInputElement} input - Campo de input
 */
function aplicarMascaraDocumento(input) {
    input.addEventListener('input', function (e) {
        let valor = e.target.value.replace(/[^\d]/g, '');

        if (valor.length <= 11) {
            // Máscara CPF
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        } else {
            // Máscara CNPJ
            valor = valor.replace(/^(\d{2})(\d)/, '$1.$2');
            valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            valor = valor.replace(/\.(\d{3})(\d)/, '.$1/$2');
            valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
        }

        e.target.value = valor;
    });
}

/**
 * Aplica máscara de CEP em tempo real
 * @param {HTMLInputElement} input - Campo de input
 */
function aplicarMascaraCEP(input) {
    input.addEventListener('input', function (e) {
        let valor = e.target.value.replace(/[^\d]/g, '');
        valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
        e.target.value = valor.substring(0, 9);
    });
}

/**
 * Aplica máscara de telefone em tempo real
 * @param {HTMLInputElement} input - Campo de input
 */
function aplicarMascaraTelefone(input) {
    input.addEventListener('input', function (e) {
        let valor = e.target.value.replace(/[^\d]/g, '');

        if (valor.length <= 10) {
            valor = valor.replace(/(\d{2})(\d)/, '($1) $2');
            valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
        } else {
            valor = valor.replace(/(\d{2})(\d)/, '($1) $2');
            valor = valor.replace(/(\d{5})(\d)/, '$1-$2');
        }

        e.target.value = valor.substring(0, 15);
    });
}

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validarCPF,
        validarCNPJ,
        validarDocumento,
        validarEmail,
        validarTelefone,
        isEmailDescartavel,
        buscarCEP,
        formatarCPF,
        formatarCNPJ,
        formatarCEP,
        formatarTelefone,
        aplicarMascaraDocumento,
        aplicarMascaraCEP,
        aplicarMascaraTelefone
    };
}
