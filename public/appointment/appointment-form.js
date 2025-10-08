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
    const suggestedTechSelect = document.getElementById('suggestedTechSelect'); // Supondo que exista um select para o técnico
    const travelTimeInput = document.getElementById('travelTime'); // Supondo que exista um input para o tempo de viagem
    const marginInput = document.getElementById('margin'); // Supondo que exista um input para a margem

    // Campos de Exibição (Displays)
    const codePassDisplay = document.getElementById('codePassDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');
    const suggestedTechDisplay = document.getElementById('suggestedTechDisplay');

    let allTechniciansData = [];

    // --- Funções Auxiliares ---

    /**
     * Calcula a semana do mês para uma data específica.
     * @param {Date} date - O objeto de data.
     * @returns {number} - O número da semana do mês (1 a 5).
     */
    function getWeekOfMonth(date) {
        // O primeiro dia do mês da data fornecida.
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        // Obtém o dia da semana do primeiro dia do mês (0 para Domingo, 1 para Segunda, etc.).
        const firstDayOfWeek = firstDayOfMonth.getDay();
        // O dia do mês da data fornecida (1 a 31).
        const dayOfMonth = date.getDate();
        // Calcula a semana. A fórmula soma o dia do mês com o deslocamento do primeiro dia da semana e divide por 7.
        // Math.ceil arredonda para cima para garantir que os dias na primeira semana parcial sejam contados como semana 1.
        return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
    }

    /**
     * Preenche um elemento <select> com opções.
     * @param {HTMLSelectElement} selectElement - O elemento select a ser preenchido.
     * @param {string[]} items - Um array de strings para as opções.
     * @param {string} defaultText - O texto para a primeira opção desabilitada.
     */
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

    /**
     * Busca os dados iniciais para preencher os dropdowns do formulário.
     */
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

        } catch (error) {
            console.error("Erro ao carregar dados para o formulário:", error);
            alert("Não foi possível carregar os dados necessários para o formulário. Verifique o console para mais detalhes.");
        }
    }

    /**
     * Atualiza os campos de exibição (Código, Data de Lembrete, etc.) com base na data do agendamento.
     */
    function updateDisplayFields() {
        const appointmentDateValue = appointmentDateInput.value;
        if (appointmentDateValue) {
            const date = new Date(appointmentDateValue);
            
            // Formata a data para MM/DD/YYYY
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            const formattedDate = `${month}/${day}/${year}`;

            // Gera o código de confirmação
            codePassDisplay.textContent = `${customersInput.value.substring(0, 3).toUpperCase()}${month}${day}`;

            // Calcula e exibe a data do lembrete (2 dias antes)
            const reminderDate = new Date(date);
            reminderDate.setDate(date.getDate() - 2);
            const reminderMonth = String(reminderDate.getMonth() + 1).padStart(2, '0');
            const reminderDay = String(reminderDate.getDate()).padStart(2, '0');
            const reminderYear = reminderDate.getFullYear();
            reminderDateDisplay.textContent = `${reminderMonth}/${reminderDay}/${reminderYear}`;
            
            // Preenche o campo de data oculto
            dataInput.value = formattedDate;
        } else {
            codePassDisplay.textContent = '--/--/----';
            reminderDateDisplay.textContent = '--/--/----';
        }
    }
    
    // --- Lógica de Eventos ---

    // Atualiza campos derivados quando a data ou nome do cliente muda
    appointmentDateInput.addEventListener('input', updateDisplayFields);
    customersInput.addEventListener('input', updateDisplayFields);

    // Lida com o envio do formulário
    scheduleForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const appointmentDateValue = appointmentDateInput.value;
        const appointmentDate = new Date(appointmentDateValue);

        // Calcula semana, mês e ano para enviar à API
        const week = getWeekOfMonth(appointmentDate);
        const month = appointmentDate.getMonth() + 1;
        const year = appointmentDate.getFullYear();

        const formData = {
            type: typeInput.value,
            data: dataInput.value,
            pets: petsSelect.value,
            closer1: closer1Select.value,
            closer2: closer2Select.value,
            customers: customersInput.value,
            phone: phoneInput.value,
            oldNew: oldNewSelect.value,
            appointmentDate: appointmentDateValue.replace('T', ' '),
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
            technician: suggestedTechSelect ? suggestedTechSelect.value : '', // Garante que não quebre se o elemento não existir
            travelTime: travelTimeInput ? travelTimeInput.value : '0',
            margin: marginInput ? marginInput.value : '30'
        };
        
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
                // Limpa os campos de exibição após o sucesso
                codePassDisplay.textContent = '--/--/----';
                reminderDateDisplay.textContent = '--/--/----';
                suggestedTechDisplay.textContent = '--/--/----';
            } else {
                alert(`Erro: ${result.message}`);
            }
        } catch (error) {
            console.error('Erro ao enviar o formulário:', error);
            alert('Ocorreu um erro de rede ao tentar registrar o agendamento.');
        }
    });

    // Inicializa o formulário
    fetchInitialData();
});
