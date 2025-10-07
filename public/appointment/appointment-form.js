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
        // ... (código existente sem alterações)
    }

    function generateAlphanumericCode(length = 5) {
        // ... (código existente sem alterações)
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
            
            // Usamos Promise.all para otimizar as buscas de CEP dos técnicos
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

    // --- Lógica de Submissão e outros Event Listeners (sem alterações) ---
    // ...

    // --- Adiciona Event Listeners ---
    
    // ** LÓGICA CORRIGIDA E CENTRALIZADA PARA O CAMPO DE CEP **
    zipCodeInputForm.addEventListener('input', async (event) => {
        const zipCode = event.target.value.trim();
        // Limpa os campos dependentes
        cityInput.value = '';
        suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-muted-foreground font-medium">--/--/----</div>';

        // A ação só acontece quando o CEP tem 5 dígitos
        if (zipCode.length === 5) {
            cityInput.placeholder = 'Buscando...';
            cityInput.disabled = true;
            
            const locationData = await getCityFromZip(zipCode);
            
            cityInput.disabled = false;
            cityInput.placeholder = 'Ex: Beverly Hills';

            if (locationData && locationData.city) {
                console.log(`[FORM LOG] Cidade encontrada: ${locationData.city}. Preenchendo campo.`);
                cityInput.value = locationData.city;
                // Dispara a busca por técnicos APENAS APÓS encontrar a cidade
                await updateSuggestedTechnician(locationData.state);
            } else {
                 console.warn("[FORM LOG] Nenhuma cidade encontrada para este CEP.");
                 suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-red-600 font-medium">CEP inválido</div>';
            }
        }
    });
    
    // (O restante do arquivo, com a criação de campos hidden e a função populateFormDropdowns, continua o mesmo)
    // ...
});
