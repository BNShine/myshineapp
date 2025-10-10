// public/routes/technician-editor.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores ---
    const techTableBody = document.getElementById('tech-table-body');
    const addTechRowBtn = document.getElementById('add-tech-row-btn');
    const saveTechDataBtn = document.getElementById('save-tech-data-btn');
    const citiesModal = document.getElementById('cities-modal');
    const modalContentArea = document.getElementById('modal-content-area');
    const modalSaveBtn = document.getElementById('modal-save-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    let techData = []; // Armazenamento local dos dados
    const CATEGORIA_OPTIONS = ["Central", "Franchise"];
    const showToast = (message, type) => alert(type.toUpperCase() + ": " + message);

    // --- Funções de Renderização e UI ---
    function renderTechTable() {
        techTableBody.innerHTML = '';
        if (!techData || techData.length === 0) {
            techTableBody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-muted-foreground">No technician data found.</td></tr>';
            return;
        }

        techData.forEach((tech, i) => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border hover:bg-muted/50 transition-colors';
            
            const categoryOptionsHtml = CATEGORIA_OPTIONS.map(cat => `<option value="${cat}" ${tech.categoria === cat ? 'selected' : ''}>${cat}</option>`).join('');
            const visibleCities = (tech.cidades || []).slice(0, 3);
            const hiddenCount = (tech.cidades || []).length - visibleCities.length;
            
            row.innerHTML = `
                <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${tech.nome || ''}" data-key="nome" data-index="${i}"></td>
                <td class="p-4"><select class="w-full bg-transparent border-none focus:outline-none" data-key="categoria" data-index="${i}"><option value="">Select</option>${categoryOptionsHtml}</select></td>
                <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${tech.tipo_atendimento || ''}" data-key="tipo_atendimento" data-index="${i}"></td>
                <td class="p-4"><input type="text" class="w-full bg-transparent border-none focus:outline-none" value="${tech.zip_code || ''}" data-key="zip_code" data-index="${i}" maxlength="5"></td>
                <td class="p-4">
                    <div class="flex flex-wrap gap-1 mb-2 max-h-16 overflow-y-auto">${visibleCities.map(city => `<span class="city-tag bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-full text-xs">${city}</span>`).join('')} ${hiddenCount > 0 ? `<span class="city-tag bg-muted text-muted-foreground px-2 py-1 rounded-full text-xs">+ ${hiddenCount} more</span>` : ''}</div>
                    <button class="text-sm font-semibold text-brand-primary hover:text-brand-primary/80 view-edit-cities-btn" data-index="${i}">View/Edit (${(tech.cidades || []).length} cities)</button>
                </td>
                <td class="p-4"><button data-index="${i}" class="text-red-600 hover:text-red-800 delete-tech-btn">🗑️</button></td>`;
            techTableBody.appendChild(row);
        });

        // Adiciona listeners para os eventos da tabela
        techTableBody.querySelectorAll('input, select').forEach(element => {
            element.addEventListener('change', (e) => {
                techData[e.target.dataset.index][e.target.dataset.key] = e.target.value;
            });
        });
        
        techTableBody.querySelectorAll('.view-edit-cities-btn').forEach(btn => btn.addEventListener('click', (e) => showCitiesModal(e.target.dataset.index)));
        techTableBody.querySelectorAll('.delete-tech-btn').forEach(btn => btn.addEventListener('click', (e) => {
            techData.splice(e.target.dataset.index, 1);
            renderTechTable();
            // Dispara um evento para notificar outros módulos da alteração
            document.dispatchEvent(new CustomEvent('techDataUpdated', { detail: { techData } }));
        }));
    }
    
    function showCitiesModal(index) {
        const tech = techData[index];
        modalContentArea.innerHTML = `
            <div class="mb-4"><p class="text-sm font-semibold">Technician:</p><p class="text-lg font-bold text-brand-primary">${tech.nome || 'New Technician'}</p></div>
            <p class="text-sm text-muted-foreground mb-2">Edit the list of cities, separated by commas (,).</p>
            <textarea id="modal-cities-textarea" class="w-full p-3 border border-border rounded-md focus:ring-2 focus:ring-brand-primary" rows="10">${(tech.cidades || []).join(', ')}</textarea>`;
        
        modalSaveBtn.onclick = () => {
            const newCitiesArray = document.getElementById('modal-cities-textarea').value.split(',').map(s => s.trim()).filter(Boolean);
            techData[index].cidades = newCitiesArray;
            citiesModal.classList.add('hidden');
            renderTechTable();
        };
        modalCancelBtn.onclick = () => citiesModal.classList.add('hidden');
        citiesModal.classList.remove('hidden');
    }

    // --- Lógica de Salvamento ---
    async function handleSaveTechData() {
        try {
            const response = await fetch('/api/save-tech-coverage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(techData)
            });
            const result = await response.json();
            if (result.success) {
                showToast('Data saved to Google Sheets successfully!', 'success');
                localStorage.setItem('tech_data_cache', JSON.stringify(techData));
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            showToast(`Error saving data: ${error.message}`, 'error');
            console.error('Save error:', error);
        }
    }

    // --- Inicialização do Módulo ---
    function init(data) {
        techData = data;
        renderTechTable();
    }

    // --- Listeners de Eventos ---
    document.addEventListener('techDataLoaded', (event) => {
        init(event.detail.techData);
    });

    addTechRowBtn.addEventListener('click', () => {
        techData.push({ nome: "", categoria: "", tipo_atendimento: "", zip_code: "", cidades: [] });
        renderTechTable();
        document.dispatchEvent(new CustomEvent('techDataUpdated', { detail: { techData } }));
    });
    
    saveTechDataBtn.addEventListener('click', handleSaveTechData);
});
