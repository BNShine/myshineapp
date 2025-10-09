// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    // Seletores de Elementos do DOM
    const scheduleForm = document.getElementById('scheduleForm');
    const manualModeToggle = document.getElementById('manual-mode-toggle');
    const manualModeLabel = document.getElementById('manual-mode-label');

    // Campos do Formulário
    const typeInput = document.getElementById('type');
    const dataInput = document.getElementById('data');
    const petsSelect = document.getElementById('pets');
    const closer1Select = document.getElementById('closer1');
    const closer2Select = document.getElementById('closer2');
    const customersInput = document.getElementById('customers');
    const phoneInput = document.getElementById('phone');
    const oldNewSelect = document.getElementById('oldNew');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const serviceValueInput = document.getElementById('serviceValue');
    const franchiseSelect = document.getElementById('franchise');
    const cityInput = document.getElementById('city');
    const sourceSelect = document.getElementById('source');
    const zipCodeInput = document.getElementById('zipCode');
    const travelTimeInput = document.getElementById('travelTime');
    const marginInput = document.getElementById('margin');
    
    // Campos de Exibição (Displays) e Campos do Técnico
    const codePassDisplay = document.getElementById('codePassDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');
    const suggestedTechDisplay = document.getElementById('suggestedTechDisplay'); // O DIV de exibição
    const suggestedTechSelect = document.getElementById('suggestedTechSelect');   // O SELECT dropdown

    let allTechniciansData = []; // Armazena dados de cobertura dos técnicos

    // --- Funções Auxiliares ---

    function getWeekOfMonth(date) {
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const firstDayOfWeek = firstDayOfMonth.getDay();
        const dayOfMonth = date.getDate();
        return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
    }

    /**
     * NOVA FUNÇÃO: Gera um código alfanumérico aleatório.
     * @param {number} length - O comprimento do código a ser gerado.
     * @returns {string} - O código aleatório.
     */
    function generateRandomCode(length = 6) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function populateDropdown(selectElement, items, defaultText) {
        if (!selectElement) return;
        selectElement.innerHTML = `<option value="">${defaultText}</option>`;
        if (items && Array.isArray(items)) {
            items.forEach(item => {
                if (item) {
                    const option = document.createElement('option');
                    option.value = item;
                    option.textContent = item;
                    selectElement.appendChild(option);
                }
            });
        }
    }

    async function fetchInitialData() {
        try {
            const [dashboardResponse, listsResponse, techCoverageResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists'),
                fetch('/api/get-tech-coverage')
            ]);

            if (!dashboardResponse.ok || !listsResponse.ok || !techCoverageResponse.ok) {
                throw new Error('Falha ao carregar dados iniciais do servidor.');
            }

            const dashboardData = await dashboardResponse.json();
            const listsData = await listsResponse.json();
            allTechniciansData = await techCoverageResponse.json();

            populateDropdown(petsSelect, listsData.pets, 'Selecione a Quantidade');
            populateDropdown(closer1Select, dashboardData.employees, 'Selecione o Closer');
            populateDropdown(closer2Select, dashboardData.employees, 'Selecione o SDR');
            populateDropdown(franchiseSelect, dashboardData.franchises, 'Selecione a Franquia');
            populateDropdown(sourceSelect, listsData.sources, 'Selecione a Origem');
            
            populateDropdown(suggestedTechSelect, allTechniciansData.map(tech => tech.nome), 'Selecione um técnico');

        } catch (error) {
            console.error("Erro ao carregar dados para o formulário:", error);
            alert("Não foi possível carregar os dados necessários. Verifique o console.");
        }
    }
    
    async function getCityAndStateFromZip(zipCode) {
        if (zipCode.length !== 5) return { city: null, state: null };
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
            if (!response.ok) return { city: null, state: null };
            const data = await response.json();
            const place = data.places[0];
            return { city: place['place name'], state: place['state abbreviation'] };
        } catch (error) {
            console.error('Erro ao buscar dados do CEP:', error);
            return { city: null, state: null };
        }
    }
    
    async function updateTechniciansByZip() {
        const zip = zipCodeInput.value;
        if (zip.length === 5) {
            const { city, state } = await getCityAndStateFromZip(zip);
            cityInput.value = city || '';
            
            if (state && allTechniciansData.length > 0) {
                const techniciansInState = [];
                for(const tech of allTechniciansData) {
                    if(tech.zip_code) {
                        const techStateResponse = await getCityAndStateFromZip(tech.zip_code);
                        if(techStateResponse.state === state) {
                            techniciansInState.push(tech.nome);
                        }
                    }
                }
                populateDropdown(suggestedTechSelect, techniciansInState, 'Selecione um técnico na região');
            }
        }
    }

    function updateDisplayFields() {
        const appointmentDateValue = appointmentDateInput.value;
        if (appointmentDateValue) {
            const date = new Date(appointmentDateValue);
            
            codePassDisplay.textContent = generateRandomCode();

            const reminderDate = new Date(date);
            reminderDate.setDate(date.getDate() - 2);
            reminderDateDisplay.textContent = `${String(reminderDate.getMonth() + 1).padStart(2, '0')}/${String(reminderDate.getDate()).padStart(2, '0')}/${reminderDate.getFullYear()}`;
        } else {
            codePassDisplay.textContent = '--/--/----';
            reminderDateDisplay.textContent = '--/--/----';
        }
    }
    
    function setInitialDate() {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const year = today.getFullYear();
        dataInput.value = `${month}/${day}/${year}`;
    }

    // --- Lógica de Eventos ---

    appointmentDateInput.addEventListener('input', updateDisplayFields);
    customersInput.addEventListener('input', updateDisplayFields);
    zipCodeInput.addEventListener('input', updateTechniciansByZip);

    manualModeToggle.addEventListener('change', () => {
        if (manualModeToggle.checked) { // MODO MANUAL
            manualModeLabel.textContent = 'Manual Mode';
            appointmentDateInput.readOnly = false;
            zipCodeInput.readOnly = false;
            petsSelect.disabled = false;
            suggestedTechDisplay.classList.add('hidden');
            suggestedTechSelect.classList.remove('hidden');
        } else { // MODO SMART
            manualModeLabel.textContent = 'Smart Mode';
            appointmentDateInput.readOnly = true;
            zipCodeInput.readOnly = true;
            petsSelect.disabled = true;
            suggestedTechDisplay.classList.remove('hidden');
            suggestedTechSelect.classList.add('hidden');
        }
    });

    scheduleForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const appointmentDateValue = appointmentDateInput.value;
        const appointmentDate = new Date(appointmentDateValue);

        const week = getWeekOfMonth(appointmentDate);
        const month = appointmentDate.getMonth() + 1;
        const year = appointmentDate.getFullYear();

        const [datePart, timePart] = appointmentDateValue.split('T');
        const [yearPart, monthPart, dayPart] = datePart.split('-');
        const formattedApiDate = `${monthPart}/${dayPart}/${yearPart} ${timePart}`;

        // **CORREÇÃO APLICADA AQUI**
        // Verifica qual modo está ativo para pegar o técnico do lugar certo.
        let technicianValue;
        if (manualModeToggle.checked) {
            // Modo Manual: Pega do select dropdown
            technicianValue = suggestedTechSelect.value;
        } else {
            // Modo Smart: Pega do valor que foi setado no select (mesmo que oculto)
            // O `availability-check.js` já atualiza o `value` de `suggestedTechSelect`
            technicianValue = suggestedTechSelect.value;
        }

        const formData = {
            type: typeInput.value,
            data: dataInput.value,
            pets: petsSelect.value,
            closer1: closer1Select.value,
            closer2: closer2Select.value,
            customers: customersInput.value,
            phone: phoneInput.value,
            oldNew: oldNewSelect.value,
            appointmentDate: formattedApiDate,
            serviceValue: serviceValueInput.value,
            franchise: franchiseSelect.value,
            city: cityInput.value,
            source: sourceSelect.value,
            week: week,
            month: month,
            year: year,
            code: codePassDisplay.textContent,
            reminderDate: reminderDateDisplay.textContent,
            verification: 'Scheduled',
            zipCode: zipCodeInput.value,
            technician: technicianValue, // Usa a variável corrigida
            travelTime: travelTimeInput.value || '0',
            margin: marginInput.value || '30'
        };
        
        if (!formData.technician) {
            alert('Erro: O técnico não foi selecionado. Por favor, selecione um técnico na lista ou através do Smart Mode.');
            return;
        }

        try {
            const response = await fetch('/api/register-appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const result = await response.json();
            if (result.success) {
                alert('Agendamento registrado com sucesso!');
                scheduleForm.reset();
                codePassDisplay.textContent = '--/--/----';
                reminderDateDisplay.textContent = '--/--/----';
                suggestedTechDisplay.textContent = '--/--/----';
                setInitialDate();
                manualModeToggle.checked = true;
                manualModeToggle.dispatchEvent(new Event('change'));
            } else {
                alert(`Erro: ${result.message}`);
            }
        } catch (error) {
            console.error('Erro ao enviar o formulário:', error);
            alert('Ocorreu um erro de rede ao tentar registrar o agendamento.');
        }
    });

    // Inicializa o formulário e o estado do switch
    fetchInitialData();
    setInitialDate();
    manualModeToggle.dispatchEvent(new Event('change'));
});
