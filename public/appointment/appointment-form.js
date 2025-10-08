// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores dos Elementos do Formulário ---
    const scheduleForm = document.getElementById('scheduleForm');
    const customersInput = document.getElementById('customers');
    const phoneInput = document.getElementById('phone');
    const zipCodeInput = document.getElementById('zipCode');
    const cityInput = document.getElementById('city');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const serviceValueInput = document.getElementById('serviceValue');
    const petsSelect = document.getElementById('pets');
    const franchiseSelect = document.getElementById('franchise');
    const closer1Select = document.getElementById('closer1');
    const closer2Select = document.getElementById('closer2');
    const sourceSelect = document.getElementById('source');
    const oldNewSelect = document.getElementById('oldNew');
    const manualModeToggle = document.getElementById('manual-mode-toggle');
    const manualModeLabel = document.getElementById('manual-mode-label');

    // Seletores para campos ocultos e de exibição
    const dataInput = document.getElementById('data');
    const typeSelect = document.getElementById('type');
    const monthSelect = document.getElementById('month');
    const yearSelect = document.getElementById('year');
    const codePassDisplay = document.getElementById('codePassDisplay');
    const statusDisplay = document.getElementById('statusDisplay');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');
    const suggestedTechContainer = document.getElementById('suggestedTechDisplay');

    // --- Estado do Formulário ---
    let allEmployees = [];
    let allFranchises = [];
    let allLists = {};

    // --- Funções Auxiliares ---
    function populateDropdown(selectElement, items, defaultOptionText) {
        selectElement.innerHTML = `<option value="">${defaultOptionText}</option>`;
        items.forEach(item => {
            if (item) {
                const option = new Option(item, item);
                selectElement.add(option);
            }
        });
    }

    // --- Lógica do Formulário ---

    // Função para buscar técnicos com base no CEP
    async function handleZipCodeInput() {
        const zipCode = zipCodeInput.value.trim();
        
        if (zipCode.length < 5) {
            suggestedTechContainer.innerHTML = `<div class="h-12 w-full flex items-center input-display-style text-muted-foreground font-medium">--/--/----</div>`;
            return;
        }

        try {
            const response = await fetch('/api/get-tech-data');
            if (!response.ok) throw new Error('Failed to fetch technician data.');
            
            const techData = await response.json();
            const cityInfo = techData[zipCode];
            
            if (cityInfo && cityInfo.tecnicos && cityInfo.tecnicos.length > 0) {
                const options = cityInfo.tecnicos.map(tech => `<option value="${tech}">${tech}</option>`).join('');
                suggestedTechContainer.innerHTML = `
                    <select id="suggestedTechSelect" name="technician" class="input-style">
                        <option value="">Select Technician...</option>
                        ${options}
                    </select>
                `;

                // Verifica se há um técnico pré-selecionado pelo "Smart Mode"
                const techSelect = document.getElementById('suggestedTechSelect');
                if (window.preselectedTechnician && techSelect) {
                    techSelect.value = window.preselectedTechnician;
                    window.preselectedTechnician = null; // Limpa a variável após o uso
                }

            } else {
                suggestedTechContainer.innerHTML = `<div class="h-12 w-full flex items-center input-display-style text-red-600 font-bold">No coverage</div>`;
            }
        } catch (error) {
            console.error('Error fetching tech data:', error);
            suggestedTechContainer.innerHTML = `<div class="h-12 w-full flex items-center input-display-style text-red-600 font-bold">API Error</div>`;
        }
    }

    // Atualiza os campos de exibição e os campos ocultos
    function updateDynamicFields() {
        const appointmentDate = new Date(appointmentDateInput.value);
        if (isNaN(appointmentDate.getTime())) {
            dataInput.value = '';
            monthSelect.value = '';
            yearSelect.value = '';
            reminderDateDisplay.textContent = '--/--/----';
            codePassDisplay.textContent = '--/--/----';
            return;
        }

        const month = appointmentDate.getMonth() + 1;
        const day = appointmentDate.getDate();
        const year = appointmentDate.getFullYear();

        dataInput.value = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
        monthSelect.value = month;
        yearSelect.value = year;

        // Calcula a data do lembrete (2 dias antes)
        const reminderDate = new Date(appointmentDate);
        reminderDate.setDate(reminderDate.getDate() - 2);
        reminderDateDisplay.textContent = `${String(reminderDate.getMonth() + 1).padStart(2, '0')}/${String(reminderDate.getDate()).padStart(2, '0')}/${reminderDate.getFullYear()}`;
        
        // Gera o código de confirmação
        const customerName = customersInput.value.trim();
        const customerInitials = customerName.split(' ').map(n => n[0]).join('').toUpperCase();
        codePassDisplay.textContent = `${customerInitials}${month}${day}${year}`;
    }

    // Lida com o envio do formulário
    async function handleFormSubmit(event) {
        event.preventDefault();
        const submitButton = scheduleForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.innerHTML = 'Registering...';

        // Pega o valor do select de técnico, que é criado dinamicamente
        const suggestedTechSelect = document.getElementById('suggestedTechSelect');
        const technician = suggestedTechSelect ? suggestedTechSelect.value : '';

        const formData = {
            type: typeSelect.value,
            data: dataInput.value,
            pets: petsSelect.value,
            closer1: closer1Select.value,
            closer2: closer2Select.value,
            customers: customersInput.value,
            phone: phoneInput.value,
            oldNew: oldNewSelect.value,
            appointmentDate: appointmentDateInput.value,
            serviceValue: serviceValueInput.value,
            franchise: franchiseSelect.value,
            city: cityInput.value,
            source: sourceSelect.value,
            week: new Date(appointmentDateInput.value).getDay() + 1, // Simples cálculo de semana
            month: monthSelect.value,
            year: yearSelect.value,
            code: codePassDisplay.textContent,
            reminderDate: reminderDateDisplay.textContent,
            verification: 'Scheduled',
            zipCode: zipCodeInput.value,
            technician: technician,
            travelTime: document.getElementById('travelTime') ? document.getElementById('travelTime').value : '0',
            margin: document.getElementById('margin') ? document.getElementById('margin').value : '30',
        };

        try {
            const response = await fetch('/api/register-appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const result = await response.json();
            alert(result.message);
            if (result.success) {
                scheduleForm.reset();
                updateDynamicFields(); // Reseta os campos dinâmicos
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            alert('An error occurred. Please try again.');
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Register Appointment';
        }
    }

    // Lida com a troca de modo (Smart/Manual)
    function toggleManualMode() {
        const isManual = manualModeToggle.checked;
        manualModeLabel.textContent = isManual ? 'Manual Mode' : 'Smart Mode';
        
        if (isManual) {
            // No modo manual, o usuário pode digitar qualquer coisa
            suggestedTechContainer.innerHTML = `<input type="text" id="manualTechInput" name="technician" class="input-style" placeholder="Enter technician name manually">`;
        } else {
            // No modo smart, volta a depender do CEP
            handleZipCodeInput();
        }
    }

    // --- Inicialização ---
    async function initForm() {
        try {
            const [dashboardResponse, listsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists')
            ]);

            if (!dashboardResponse.ok || !listsResponse.ok) {
                throw new Error('Failed to load initial form data.');
            }

            const dashboardData = await dashboardResponse.json();
            allLists = await listsResponse.json();
            
            allEmployees = dashboardData.employees || [];
            allFranchises = dashboardData.franchises || [];

            populateDropdown(petsSelect, allLists.pets, 'Select Qty');
            populateDropdown(franchiseSelect, allFranchises, 'Select Franchise');
            populateDropdown(closer1Select, allEmployees, 'Select Closer');
            populateDropdown(closer2Select, allEmployees, 'Select SDR');
            populateDropdown(sourceSelect, allLists.sources, 'Select Source');
            populateDropdown(monthSelect, allLists.months, '');
            populateDropdown(yearSelect, allLists.years, '');
            
            // Adiciona os listeners de eventos
            appointmentDateInput.addEventListener('input', updateDynamicFields);
            customersInput.addEventListener('input', updateDynamicFields);
            zipCodeInput.addEventListener('input', handleZipCodeInput);
            scheduleForm.addEventListener('submit', handleFormSubmit);
            manualModeToggle.addEventListener('change', toggleManualMode);

            // Inicializa os campos
            updateDynamicFields();
            toggleManualMode();

        } catch (error) {
            console.error("Error initializing form:", error);
            alert("Could not load necessary data for the form. Please refresh the page.");
        }
    }

    initForm();
});
