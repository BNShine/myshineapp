// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    // Garante que o código só execute na página de agendamentos
    if (!document.getElementById('scheduleForm')) {
        return;
    }

    // --- Seletores dos Elementos ---
    const scheduleForm = document.getElementById('scheduleForm');
    const customersInput = document.getElementById('customers');
    const codePassDisplay = document.getElementById('codePassDisplay');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');
    const zipCodeInputForm = document.getElementById('zipCode');
    const cityInput = document.getElementById('city');
    const suggestedTechDisplay = document.getElementById('suggestedTechDisplay');

    // --- Funções Auxiliares ---
    function populateDropdowns(selectElement, items) {
        if (!selectElement) { console.warn("Elemento select não encontrado para popular:", selectElement); return; }
        while (selectElement.options.length > 1) selectElement.remove(1);
        if (items && Array.isArray(items)) {
            items.forEach(item => { if (item) selectElement.add(new Option(item, item)); });
        }
    }

    function generateAlphanumericCode(length = 5) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * characters.length));
        return result;
    }

    async function getCityFromZip(zipCode) {
        console.log(`[FORM LOG] Buscando cidade para o CEP: ${zipCode}`);
        if (!zipCode || zipCode.length !== 5) {
            console.warn("[FORM WARN] CEP inválido ou incompleto.");
            return null;
        }
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) {
                console.error(`[FORM ERROR] API Zippopotam falhou com status: ${response.status}`);
                return null;
            }
            const data = await response.json();
            console.log("[FORM LOG] Resposta da API de CEP:", data);
            return data.places?.[0] ? { city: data.places[0]['place name'], state: data.places[0]['state abbreviation'] } : null;
        } catch (error) {
            console.error('[FORM ERROR] Erro ao buscar cidade do CEP:', error);
            return null;
        }
    }

    async function updateSuggestedTechnician(customerState) {
        console.log(`[FORM LOG] Buscando técnicos para o estado: ${customerState}`);
        if (!suggestedTechDisplay) return;

        const inputStyle = 'block w-full h-full rounded-xl border-2 border-foreground/80 hover:border-brand-primary bg-muted/50 px-3 py-2 text-sm';
        suggestedTechDisplay.className = 'h-12 w-full flex items-center bg-muted/50 px-3 py-2 text-muted-foreground font-medium rounded-xl border-2 border-foreground/80';
        suggestedTechDisplay.innerHTML = 'Buscando técnicos...';

        if (!customerState) {
            suggestedTechDisplay.textContent = 'Estado do cliente não encontrado.';
            return;
        }
        try {
            const response = await fetch('/api/get-tech-coverage');
            if (!response.ok) throw new Error('Falha ao buscar cobertura de técnicos.');
            const techCoverageData = await response.json();
            console.log("[FORM LOG] Dados de cobertura de técnicos recebidos:", techCoverageData);

            const centralTechs = techCoverageData.filter(t => t.categoria && t.categoria.toLowerCase() === 'central');
            const techsInState = [];
            
            await Promise.all(centralTechs.map(async (tech) => {
                 if (tech.zip_code && tech.zip_code.length === 5) {
                    const loc = await getCityFromZip(tech.zip_code);
                    if (loc && loc.state === customerState) {
                        techsInState.push(tech.nome);
                    }
                }
            }));
            
            console.log(`[FORM LOG] Técnicos "Central" encontrados no estado ${customerState}:`, techsInState);

            if (techsInState.length > 0) {
                suggestedTechDisplay.className = 'h-12 w-full';
                let dropdownHTML = `<select id="suggestedTechSelect" name="technician" required class="${inputStyle}"><option value="">Selecione um técnico</option>`;
                techsInState.sort().forEach(name => { dropdownHTML += `<option value="${name}">${name}</option>`; });
                dropdownHTML += `</select>`;
                suggestedTechDisplay.innerHTML = dropdownHTML;
            } else {
                suggestedTechDisplay.className += ' text-red-600';
                suggestedTechDisplay.textContent = 'Nenhum técnico "Central" para este estado.';
            }
        } catch (error) {
            console.error("[FORM ERROR] Erro ao sugerir técnico:", error);
            suggestedTechDisplay.className += ' text-red-600';
            suggestedTechDisplay.textContent = 'Erro ao buscar técnicos.';
        }
    }
    
    // --- Lógica de Submissão ---
    async function handleFormSubmission(event) {
        // ... (código existente sem alterações)
    }
    
    // --- Adiciona Event Listeners ---
    scheduleForm.addEventListener('submit', handleFormSubmission);

    zipCodeInputForm.addEventListener('input', async (event) => {
        const zipCode = event.target.value.trim();
        cityInput.value = '';
        suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-muted-foreground font-medium">--/--/----</div>';

        if (zipCode.length === 5) {
            cityInput.placeholder = 'Buscando...';
            cityInput.disabled = true;
            
            const locationData = await getCityFromZip(zipCode);
            
            cityInput.disabled = false;
            cityInput.placeholder = 'Ex: Beverly Hills';

            if (locationData && locationData.city) {
                console.log(`[FORM LOG] Cidade encontrada: ${locationData.city}. Preenchendo campo.`);
                cityInput.value = locationData.city;
                await updateSuggestedTechnician(locationData.state);
            } else {
                 console.warn("[FORM LOG] Nenhuma cidade encontrada para este CEP.");
                 suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-red-600 font-medium">CEP inválido</div>';
            }
        }
    });
    
    customersInput.addEventListener('input', () => { /* ...código sem alterações... */ });
    appointmentDateInput.addEventListener('input', (event) => { /* ...código sem alterações... */ });

    // --- Popula os dropdowns na carga inicial ---
    (async function populateFormDropdowns() {
        console.log("[FORM LOG] Populando todos os dropdowns...");
        try {
            const [dataResponse, listsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists') 
            ]);
            
            if (!dataResponse.ok) throw new Error('Falha ao carregar dados do dashboard (employees, franchises, sources).');
            if (!listsResponse.ok) throw new Error('Falha ao carregar listas (pets).');
            
            const data = await dataResponse.json();
            const lists = await listsResponse.json();
            console.log("[FORM LOG] Dados recebidos para os dropdowns:", { data, lists });
            
            populateDropdowns(document.getElementById('closer1'), data.employees);
            populateDropdowns(document.getElementById('closer2'), data.employees);
            populateDropdowns(document.getElementById('franchise'), data.franchises);
            populateDropdowns(document.getElementById('pets'), lists.pets);
            populateDropdowns(document.getElementById('source'), data.sources); // <-- ALTERAÇÃO AQUI

            console.log("[FORM LOG] Dropdowns populados com sucesso.");
        } catch(error) {
            console.error("[FORM ERROR] Erro ao popular dropdowns:", error);
        }
    })();
});
