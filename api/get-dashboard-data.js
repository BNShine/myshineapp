// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    const scheduleForm = document.getElementById('scheduleForm');
    if (!scheduleForm) return;

    // --- Seletores dos Elementos do Formulário ---
    const customersInput = document.getElementById('customers');
    const codePassDisplay = document.getElementById('codePassDisplay');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');
    const zipCodeInputForm = document.getElementById('zipCode');
    const cityInput = document.getElementById('city');
    const suggestedTechDisplay = document.getElementById('suggestedTechDisplay');

    // --- Funções Auxiliares ---
    function populateDropdowns(selectElement, items) {
        if (!selectElement) return;
        while (selectElement.options.length > 1) selectElement.remove(1);
        if (items && Array.isArray(items)) {
            items.forEach(item => { if (item) selectElement.add(new Option(item, item)) });
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
        if (!zipCode || zipCode.length !== 5) return null;
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
            suggestedTechDisplay.textContent = '--/--/----';
            return;
        }
        try {
            const response = await fetch('/api/get-tech-coverage');
            if (!response.ok) throw new Error('Falha ao buscar cobertura de técnicos.');
            const techCoverageData = await response.json();
            console.log("[FORM LOG] Dados de cobertura de técnicos recebidos:", techCoverageData);

            const centralTechs = techCoverageData.filter(t => t.categoria?.toLowerCase() === 'central');
            
            const techsInState = [];
            for (const tech of centralTechs) {
                 if (tech.zip_code?.length === 5) {
                    const loc = await getCityFromZip(tech.zip_code);
                    if (loc?.state && loc.state === customerState) {
                        techsInState.push(tech.nome);
                    }
                }
            }
            console.log(`[FORM LOG] Técnicos encontrados no estado ${customerState}:`, techsInState);

            if (techsInState.length > 0) {
                suggestedTechDisplay.className = 'h-12 w-full';
                let dropdownHTML = `<select id="suggestedTechSelect" name="technician" required class="${inputStyle}"><option value="">Selecione um técnico</option>`;
                techsInState.forEach(name => { dropdownHTML += `<option value="${name}">${name}</option>`; });
                dropdownHTML += `</select>`;
                suggestedTechDisplay.innerHTML = dropdownHTML;
            } else {
                suggestedTechDisplay.className += ' text-red-600';
                suggestedTechDisplay.textContent = 'Nenhum técnico "Central" encontrado para este estado.';
            }
        } catch (error) {
            console.error("[FORM ERROR] Erro ao sugerir técnico:", error);
            suggestedTechDisplay.className += ' text-red-600';
            suggestedTechDisplay.textContent = 'Erro ao buscar técnicos.';
        }
    }

    // --- Lógica de Submissão ---
    async function handleFormSubmission(event) {
        // (código de submissão existente, sem alterações)
    }

    // --- Adiciona Event Listeners ao Formulário ---
    scheduleForm.addEventListener('submit', handleFormSubmission);

    // *** LÓGICA CORRIGIDA PARA O CAMPO DE CEP ***
    zipCodeInputForm.addEventListener('input', async (event) => {
        const zipCode = event.target.value.trim();
        cityInput.value = ''; // Limpa a cidade enquanto digita

        if (zipCode.length === 5) {
            cityInput.disabled = true;
            cityInput.placeholder = 'Buscando...';
            const locationData = await getCityFromZip(zipCode);
            cityInput.disabled = false;
            cityInput.placeholder = 'Ex: Beverly Hills';
            if (locationData) {
                console.log(`[FORM LOG] Cidade encontrada: ${locationData.city}. Preenchendo campo.`);
                cityInput.value = locationData.city;
                // Chama a função para sugerir o técnico
                await updateSuggestedTechnician(locationData.state);
            } else {
                 console.warn("[FORM LOG] Nenhuma cidade encontrada para este CEP.");
            }
        }
    });
    
    // (Resto dos event listeners existentes, sem alterações)
    appointmentDateInput.addEventListener('input', (event) => { /* ... */ });
    customersInput.addEventListener('input', () => { /* ... */ });


    // Popula dropdowns do formulário
    (async function populateFormDropdowns() {
        console.log("[FORM LOG] Populando dropdowns de 'Service and Sales Details'...");
        try {
            const [dataResponse, listsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists')
            ]);
            if (!dataResponse.ok || !listsResponse.ok) throw new Error('Falha ao carregar dados dos dropdowns.');
            
            const data = await dataResponse.json();
            const lists = await listsResponse.json();
            console.log("[FORM LOG] Dados recebidos para os dropdowns:", { data, lists });
            
            populateDropdowns(document.getElementById('closer1'), data.employees);
            populateDropdowns(document.getElementById('closer2'), data.employees);
            populateDropdowns(document.getElementById('franchise'), data.franchises);
            populateDropdowns(document.getElementById('pets'), lists.pets);
            populateDropdowns(document.getElementById('source'), lists.sources);

            console.log("[FORM LOG] Dropdowns populados com sucesso.");
        } catch(error) {
            console.error("[FORM ERROR] Erro ao popular dropdowns:", error);
        }
    })();

    // (Resto do código para campos hidden, etc., sem alterações)
});
