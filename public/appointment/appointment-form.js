// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', () => {
    // Garante que o código só execute na página de agendamentos
    const scheduleForm = document.getElementById('scheduleForm');
    if (!scheduleForm) {
        return;
    }

    // --- Seletores dos Elementos ---
    const customersInput = document.getElementById('customers');
    const codePassDisplay = document.getElementById('codePassDisplay');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');
    const zipCodeInputForm = document.getElementById('zipCode');
    const cityInput = document.getElementById('city');
    const suggestedTechDisplay = document.getElementById('suggestedTechDisplay');

    // --- Funções Auxiliares ---

    // Popula um dropdown de forma segura
    function populateDropdown(selectElement, items, placeholder) {
        if (!selectElement) {
            console.warn(`Dropdown element com placeholder "${placeholder}" não foi encontrado.`);
            return;
        }
        selectElement.innerHTML = `<option value="">${placeholder}</option>`; // Limpa e adiciona o placeholder
        if (items && Array.isArray(items)) {
            items.forEach(item => {
                if (item) {
                    selectElement.add(new Option(item, item));
                }
            });
        }
    }

    // Gera um código alfanumérico
    function generateAlphanumericCode(length = 5) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    // Busca cidade e estado a partir do CEP
    async function getCityFromZip(zipCode) {
        if (!zipCode || zipCode.length !== 5) return null;
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) return null;
            const data = await response.json();
            return data.places?.[0] ? { city: data.places[0]['place name'], state: data.places[0]['state abbreviation'] } : null;
        } catch (error) {
            console.error('[FORM ERROR] Erro ao buscar cidade do CEP:', error);
            return null;
        }
    }

    // Busca e sugere técnicos com base no estado
    async function updateSuggestedTechnician(customerState) {
        console.log(`[FORM LOG] Buscando técnicos para o estado: ${customerState}`);
        if (!suggestedTechDisplay) return;

        const inputStyle = 'block w-full h-full rounded-xl border-2 border-foreground/80 hover:border-brand-primary bg-muted/50 px-3 py-2 text-sm';
        suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-muted-foreground font-medium">Buscando técnicos...</div>';

        if (!customerState) {
            suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-muted-foreground font-medium">CEP inválido</div>';
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
                let dropdownHTML = `<select id="suggestedTechSelect" name="technician" required class="${inputStyle}"><option value="">Selecione um técnico</option>`;
                techsInState.sort().forEach(name => { dropdownHTML += `<option value="${name}">${name}</option>`; });
                dropdownHTML += `</select>`;
                suggestedTechDisplay.innerHTML = dropdownHTML;
            } else {
                suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-red-600 font-medium">Nenhum técnico para este estado.</div>';
            }
        } catch (error) {
            console.error("[FORM ERROR] Erro ao sugerir técnico:", error);
            suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-red-600 font-medium">Erro ao buscar técnicos.</div>';
        }
    }

    // --- Lógica Principal de Carregamento e Eventos ---

    // Função principal para carregar todos os dados dos dropdowns
    async function initializeForm() {
        console.log("[FORM LOG] Inicializando o formulário e buscando dados...");
        try {
            const [dataResponse, listsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists')
            ]);

            if (!dataResponse.ok) {
                throw new Error(`Falha ao carregar dados do dashboard. Status: ${dataResponse.status}`);
            }
            if (!listsResponse.ok) {
                throw new Error(`Falha ao carregar listas. Status: ${listsResponse.status}`);
            }

            const data = await dataResponse.json();
            const lists = await listsResponse.json();
            console.log("[FORM LOG] Dados recebidos para os dropdowns:", { data, lists });

            populateDropdown(document.getElementById('closer1'), data.employees, 'Select Closer');
            populateDropdown(document.getElementById('closer2'), data.employees, 'Select SDR');
            populateDropdown(document.getElementById('franchise'), data.franchises, 'Select Franchise');
            populateDropdown(document.getElementById('pets'), lists.pets, 'Select Qty');
            populateDropdown(document.getElementById('source'), lists.sources, 'Select Source');

            console.log("[FORM LOG] Dropdowns populados com sucesso.");

        } catch (error) {
            console.error("[FORM FATAL ERROR] Erro ao inicializar o formulário:", error);
            const formContainer = document.getElementById('main-appointment-form');
            if (formContainer) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 m-6 text-sm text-red-700 bg-red-100 rounded-lg';
                errorDiv.textContent = 'Erro fatal ao carregar dados para o formulário. Verifique os logs da API e a conexão.';
                formContainer.insertBefore(errorDiv, scheduleForm);
            }
        }
    }

    // --- Event Listeners ---

    // Evento para o campo de CEP
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
                cityInput.value = locationData.city;
                await updateSuggestedTechnician(locationData.state);
            } else {
                suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-red-600 font-medium">CEP inválido</div>';
            }
        }
    });

    // Outros event listeners
    customersInput.addEventListener('input', () => {
        if (customersInput.value.trim()) {
            const generatedCode = generateAlphanumericCode(5);
            codePassDisplay.textContent = generatedCode;
            document.getElementById('codePass').value = generatedCode;
        } else {
            codePassDisplay.textContent = '--/--/----';
            document.getElementById('codePass').value = '';
        }
    });

    appointmentDateInput.addEventListener('input', (event) => {
        const reminderDateInput = document.getElementById('reminderDate');
        if (event.target.value) {
            const appointmentDate = new Date(event.target.value);
            appointmentDate.setMonth(appointmentDate.getMonth() + 5);
            const displayDate = `${(appointmentDate.getMonth() + 1).toString().padStart(2, '0')}/${appointmentDate.getDate().toString().padStart(2, '0')}/${appointmentDate.getFullYear()}`;
            reminderDateDisplay.textContent = displayDate;
            reminderDateInput.value = appointmentDate.toISOString().split('T')[0];
        } else {
            reminderDateDisplay.textContent = '--/--/----';
            reminderDateInput.value = '';
        }
    });

    // Lógica de submissão do formulário
    scheduleForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const submitButton = scheduleForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Registering...';

        try {
            const formData = new FormData(scheduleForm);
            const formDataObject = Object.fromEntries(formData.entries());

            // Calcula a semana do ano
            const apptDate = new Date(formDataObject.appointmentDate);
            const startOfYear = new Date(apptDate.getFullYear(), 0, 1);
            const pastDaysOfYear = (apptDate - startOfYear) / 86400000;
            formDataObject.week = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

            // Adiciona o status padrão
            formDataObject.verification = 'Scheduled';
            
            // Pega o técnico selecionado, se houver
            const techSelect = document.getElementById('suggestedTechSelect');
            if(techSelect) {
                formDataObject.technician = techSelect.value;
            }

            const response = await fetch('/api/register-appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formDataObject),
            });

            const result = await response.json();

            if (result.success) {
                alert('Appointment registered successfully!');
                scheduleForm.reset();
                // Reseta os displays customizados
                codePassDisplay.textContent = '--/--/----';
                reminderDateDisplay.textContent = '--/--/----';
                suggestedTechDisplay.innerHTML = '<div class="h-12 w-full flex items-center input-display-style text-muted-foreground font-medium">--/--/----</div>';

            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('A critical error occurred. Please check the console and try again.');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-send w-4 h-4"><path d="m22 2-11 11m0 0-3 9 9-3L22 2zM12 12 3 21"/></svg>
                Register Appointment`;
        }
    });
    
    // --- Criação de Campos Hidden (se não existirem) ---
    ['codePass', 'reminderDate', 'travelTime', 'margin', 'data', 'month', 'year', 'type'].forEach(id => {
        if (!document.getElementById(id)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.id = id;
            input.name = id;
            scheduleForm.appendChild(input);
        }
    });

    // --- Valores Iniciais ---
    document.getElementById('data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('month').value = new Date().getMonth() + 1;
    document.getElementById('year').value = new Date().getFullYear();
    document.getElementById('type').value = 'Central';
    document.getElementById('travelTime').value = '0'; // Valor inicial
    document.getElementById('margin').value = '30'; // Valor padrão

    // Inicia o carregamento de todos os dados
    initializeForm();
});
