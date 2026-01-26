let userData = null;
let perdas = [];
let lojas = [];
let locais = [];

let selectedLojas = [];
let selectedLocais = [];
let selectedMotivos = [];
let dataInicio = null;
let dataFim = null;
let userLojaIds = null;

let currentPage = 1;
let itemsPerPage = 25;

window.addEventListener('supabaseReady', initPerdas);
setTimeout(() => { if (window.supabaseClient) initPerdas(); }, 500);

let initialized = false;

async function initPerdas() {
    if (initialized) return;
    initialized = true;

    try {
        const user = await auth.getUser();
        if (!user) { window.location.href = 'login.html'; return; }

        userData = await auth.getCurrentUserData();
        if (!userData || userData.tipo !== 'empresa') { window.location.href = 'login.html'; return; }

        updateUserUI();

        if (!auth.isAdmin(userData)) {
            userLojaIds = await auth.getUserLojas(userData.id);
        }

        await loadLojas();
        await loadPerdas();
        initEvents();
    } catch (error) {
        console.error('Erro:', error);
    }
}

function updateUserUI() {
    const initials = userData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = userData.nome;
    document.getElementById('userRole').textContent = userData.roles?.nome || 'Usuário';
}

async function loadLojas() {
    let query = supabaseClient
        .from('lojas')
        .select('*')
        .eq('empresa_id', userData.empresa_id)
        .eq('ativo', true)
        .order('nome');

    if (userLojaIds && userLojaIds.length > 0) {
        query = query.in('id', userLojaIds);
    }

    const { data } = await query;
    lojas = data || [];

    const lojaOptions = lojas.map(l => ({ value: l.id, label: l.nome }));
    renderMultiSelect('dropdownLoja', lojaOptions, selectedLojas, (selected) => {
        selectedLojas = selected;
        currentPage = 1;
        filterAndRender();
    });

    await loadAllLocais();

    const motivoOptions = [
        { value: 'vencido', label: 'Vencido' },
        { value: 'avaria', label: 'Avaria' },
        { value: 'roubo', label: 'Roubo/Furto' },
        { value: 'outro', label: 'Outro' }
    ];
    renderMultiSelect('dropdownMotivo', motivoOptions, selectedMotivos, (selected) => {
        selectedMotivos = selected;
        currentPage = 1;
        filterAndRender();
    });
}

let allLocais = [];

async function loadAllLocais() {
    const lojasIds = lojas.map(l => l.id);
    if (lojasIds.length === 0) {
        allLocais = [];
        return;
    }

    const { data } = await supabaseClient
        .from('locais')
        .select('*')
        .in('loja_id', lojasIds)
        .eq('ativo', true)
        .order('nome');

    allLocais = data || [];

    const uniqueLocais = [...new Set(allLocais.map(l => l.nome))].sort();
    const localOptions = uniqueLocais.map(nome => ({ value: nome, label: nome }));

    renderMultiSelect('dropdownLocal', localOptions, selectedLocais, (selected) => {
        selectedLocais = selected;
        currentPage = 1;
        filterAndRender();
    });
}

async function loadPerdas() {
    let query = supabaseClient
        .from('perdas')
        .select('*, base!inner(descricao, codigo, ean, categoria, empresa_id), lojas(nome), locais(nome)')
        .eq('base.empresa_id', userData.empresa_id)
        .order('created_at', { ascending: false });

    if (userLojaIds && userLojaIds.length > 0) {
        query = query.in('loja_id', userLojaIds);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Erro ao carregar perdas:', error);
        return;
    }

    perdas = data || [];
    filterAndRender();
}

function filterAndRender() {
    const search = document.getElementById('filterSearch')?.value.toLowerCase() || '';
    let filtered = perdas;

    if (search) {
        filtered = filtered.filter(p =>
            p.base?.descricao?.toLowerCase().includes(search) ||
            p.base?.codigo?.toLowerCase().includes(search) ||
            p.base?.ean?.toLowerCase().includes(search) ||
            p.motivo?.toLowerCase().includes(search) ||
            p.observacao?.toLowerCase().includes(search)
        );
    }

    if (selectedLojas.length > 0) {
        filtered = filtered.filter(p => selectedLojas.includes(p.loja_id));
    }

    if (selectedLocais.length > 0) {
        filtered = filtered.filter(p => {
            const localNome = p.locais?.nome || '';
            return selectedLocais.includes(localNome);
        });
    }

    if (selectedMotivos.length > 0) {
        filtered = filtered.filter(p => selectedMotivos.includes(p.motivo));
    }

    if (dataInicio) {
        const inicio = new Date(dataInicio);
        filtered = filtered.filter(p => new Date(p.created_at) >= inicio);
    }
    if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59);
        filtered = filtered.filter(p => new Date(p.created_at) <= fim);
    }

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);

    updatePaginationUI(totalItems, startIndex, endIndex, totalPages);
    renderPerdas(paginatedItems);
}

function renderPerdas(lista) {
    const tbody = document.getElementById('perdasTable');

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 60px; color: var(--text-muted);">
                    Nenhuma perda encontrada
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lista.map(item => {
        const dataRegistro = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-';
        return `
            <tr>
                <td><strong>${item.base?.descricao || '-'}</strong></td>
                <td>${item.lojas?.nome || '-'}</td>
                <td>${item.base?.categoria || '-'}</td>
                <td>${item.quantidade || 0}</td>
                <td>R$ ${parseFloat(item.valor_perda || 0).toFixed(2)}</td>
                <td>${item.motivo || '-'}</td>
                <td>${dataRegistro}</td>
                <td>${item.observacao || '-'}</td>
            </tr>
        `;
    }).join('');
}

function updatePaginationUI(totalItems, startIndex, endIndex, totalPages) {
    const info = document.getElementById('paginationInfo');
    const btnPrev = document.getElementById('btnPrevPage');
    const btnNext = document.getElementById('btnNextPage');
    const pageDisplay = document.getElementById('pageNumberDisplay');

    if (totalItems === 0) {
        info.innerHTML = 'Mostrando <strong>0 de 0</strong> itens';
        btnPrev.disabled = true;
        btnNext.disabled = true;
        pageDisplay.textContent = 'Página 1';
        return;
    }

    info.innerHTML = `Mostrando <strong>${startIndex + 1}-${endIndex} de ${totalItems}</strong> itens`;

    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = currentPage === totalPages;
    pageDisplay.textContent = `Página ${currentPage}`;
}

function renderMultiSelect(containerId, options, selectedValues, onChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const count = selectedValues.length;
    const labelText = count === 0 ? 'Todos' : (count === options.length ? 'Todos' : `${count} selecionado(s)`);

    const btn = document.createElement('div');
    btn.className = 'dropdown-btn';
    btn.innerHTML = `<span>${labelText}</span>`;

    const content = document.createElement('div');
    content.className = 'dropdown-content';

    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        const isSelected = selectedValues.includes(opt.value);

        item.innerHTML = `
            <input type="checkbox" value="${opt.value}" ${isSelected ? 'checked' : ''}>
            <span>${opt.label}</span>
        `;

        item.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = item.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }

            const checkbox = item.querySelector('input');
            const value = checkbox.value;

            if (checkbox.checked) {
                if (!selectedValues.includes(value)) selectedValues.push(value);
            } else {
                const index = selectedValues.indexOf(value);
                if (index > -1) selectedValues.splice(index, 1);
            }

            const newCount = selectedValues.length;
            const newLabel = newCount === 0 ? 'Todos' : (newCount === options.length ? 'Todos' : `${newCount} selecionado(s)`);
            btn.querySelector('span').textContent = newLabel;

            if (onChangeCallback) onChangeCallback(selectedValues);
        });

        content.appendChild(item);
    });

    container.appendChild(btn);
    container.appendChild(content);

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.dropdown-content.show').forEach(el => {
            if (el !== content) el.classList.remove('show');
        });
        content.classList.toggle('show');
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.multiselect-dropdown')) {
        document.querySelectorAll('.dropdown-content.show').forEach(el => el.classList.remove('show'));
    }
});

function initEvents() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    function closeMobileMenu() {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
    }

    function openMobileMenu() {
        sidebar?.classList.add('open');
        overlay?.classList.add('active');
    }

    document.getElementById('sidebarToggle')?.addEventListener('click', () => {
        sidebar?.classList.toggle('collapsed');
    });

    document.getElementById('menuToggle')?.addEventListener('click', () => {
        if (sidebar?.classList.contains('open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    overlay?.addEventListener('click', closeMobileMenu);

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeMobileMenu();
            }
        });
    });

    document.getElementById('filterDataInicio')?.addEventListener('change', (e) => {
        dataInicio = e.target.value || null;
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('filterDataFim')?.addEventListener('change', (e) => {
        dataFim = e.target.value || null;
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('filterSearch')?.addEventListener('input', () => {
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('itemsPerPage')?.addEventListener('change', (e) => {
        itemsPerPage = parseInt(e.target.value);
        currentPage = 1;
        filterAndRender();
    });

    document.getElementById('btnPrevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            filterAndRender();
        }
    });

    document.getElementById('btnNextPage')?.addEventListener('click', () => {
        currentPage++;
        filterAndRender();
    });

    document.getElementById('btnLimparFiltros')?.addEventListener('click', () => {
        selectedLojas = [];
        selectedLocais = [];
        selectedMotivos = [];
        dataInicio = null;
        dataFim = null;
        currentPage = 1;

        document.getElementById('filterDataInicio').value = '';
        document.getElementById('filterDataFim').value = '';
        document.getElementById('filterSearch').value = '';

        loadLojas();
        filterAndRender();
    });
}
