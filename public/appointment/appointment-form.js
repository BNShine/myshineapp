// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    const scheduleForm = document.getElementById('scheduleForm');
    if (!scheduleForm) return;

    // *** INÍCIO DA NOVA LÓGICA DO SWITCH MANUAL ***
    const manualModeToggle = document.getElementById('manual-mode-toggle');
    const manualModeLabel = document.getElementById('manual-mode-label');

    const handleManualToggle = () => {
        if (!manualModeToggle || !manualModeLabel) return;
        
        if (manualModeToggle.checked) {
            manualModeLabel.textContent = 'Manual Mode ON';
            manualModeLabel.classList.remove('text-gray-500');
            manualModeLabel.classList.add('text-red-600', 'font-bold');
        } else {
            manualModeLabel.textContent = 'Smart Mode';
            manualModeLabel.classList.remove('text-red-600', 'font-bold');
            manualModeLabel.classList.add('text-gray-500');
        }
    };

    if (manualModeToggle) {
        manualModeToggle.addEventListener('change', handleManualToggle);
        handleManualToggle(); // Seta o estado visual inicial
    }
    // *** FIM DA NOVA LÓGICA DO SWITCH MANUAL ***

    const customersInput = document.getElementById('customers');
    const codePassDisplay = document.getElementById('codePassDisplay');
    const appointmentDateInput = document.getElementById('appointmentDate');
    const reminderDateDisplay = document.getElementById('reminderDateDisplay');
    const zipCodeInputForm = document.getElementById('zipCode');
    const cityInput = document.getElementById('city');
    const suggestedTechDisplay = document.getElementById('suggestedTechDisplay');
    
    // --- Adiciona campos hidden ---
    if (!document.getElementById('codePass')) {
        const codePassInput = document.createElement('input');
        codePassInput.type = 'hidden'; codePassInput.id = 'codePass'; codePassInput.name = 'codePass';
        scheduleForm.appendChild(codePassInput);
    }
    if (!document.getElementById('reminderDate')) {
        const reminderDateInput = document.createElement('input');
        reminderDateInput.type = 'hidden'; reminderDateInput.id = 'reminderDate'; reminderDateInput.name = 'reminderDate';
        scheduleForm.appendChild(reminderDateInput);
    }
    if (!document.getElementById('travelTime')) {
        const travelTimeInput = document.createElement('input');
        travelTimeInput.type = 'hidden'; travelTimeInput.id = 'travelTime'; travelTimeInput.name = 'travelTime';
        travelTimeInput.value = '0'; // Começa com 0, será calculado se o modo Smart estiver ativo
        scheduleForm.appendChild(travelTimeInput);
    }
    if (!document.getElementById('margin')) {
        const marginInput = document.createElement('input');
        marginInput.type = 'hidden'; marginInput.id = 'margin'; marginInput.name = 'margin';
        marginInput.value = '30'; // Padrão de margem
        scheduleForm.appendChild(marginInput);
    }
    
    // --- Funções Auxiliares ---
    function populateDropdowns(selectElement, items) { /* ...código existente... */ }
    function generateAlphanumericCode(length = 5) { /* ...código existente... */ }
    async function getCityFromZip(zipCode) { /* ...código existente... */ }
    async function updateSuggestedTechnician(customerState, suggestedTechDisplay) { /* ...código existente... */ }

    const calculateManualTravelTime = async () => {
        // Só executa se o modo Smart estiver LIGADO
        if (manualModeToggle && manualModeToggle.checked) return;

        const techSelect = document.getElementById('suggestedTechSelect');
        const technician = techSelect ? techSelect.value : null;
        const destinationZip = zipCodeInputForm.value;
        const appointmentDateTime = appointmentDateInput.value;

        if (technician && destinationZip.length === 5 && appointmentDateTime) {
            try {
                const response = await fetch('/api/calculate-travel-time', { /* ...código existente... */ });
                const data = await response.json();
                if (data.travelTime >= 0) {
                    document.getElementById('travelTime').value = data.travelTime;
                    console.log(`Travel time calculated for Smart Mode: ${data.travelTime} minutes.`);
                } else {
                    document.getElementById('travelTime').value = '30'; // Fallback
                }
            } catch (error) {
                document.getElementById('travelTime').value = '30'; // Fallback
            }
        }
    };

    // --- Lógica de Submissão ---
    async function handleFormSubmission(event) {
        event.preventDefault();
        
        const isManualModeOn = manualModeToggle.checked;

        if (isManualModeOn) {
            console.log("Manual Mode is ON. Setting travelTime to 0 and margin to 60.");
            document.getElementById('travelTime').value = '0';
            document.getElementById('margin').value = '60';
        } else {
            console.log("Smart Mode is ON. Using calculated/default travel time and selected margin.");
            const marginSelect = document.getElementById('appointment-margin');
            if (marginSelect) {
                document.getElementById('margin').value = marginSelect.value;
            }
        }
        
        const formData = new FormData(scheduleForm);
        const data = Object.fromEntries(formData.entries());
        
        const appointmentDateLocal = data.appointmentDate;
        const hour = parseInt(appointmentDateLocal.substring(11, 13), 10);
        if (hour < 7 || hour >= 21) {
            alert(`Error: Appointments must be between 07:00 and 21:00.`);
            return;
        }
        const [datePart, timePart] = appointmentDateLocal.split('T');
        const [year, month, day] = datePart.split('-');
        const apiFormattedDate = `${month}/${day}/${year} ${timePart}`;
        const reminderDateValue = document.getElementById('reminderDate').value;
        const [rYear, rMonth, rDay] = reminderDateValue ? reminderDateValue.split('-') : [null, null, null];
        const apiFormattedReminderDate = rMonth ? `${rMonth}/${rDay}/${rYear}` : '';
        
        const formattedData = { ...data, appointmentDate: apiFormattedDate, reminderDate: apiFormattedReminderDate, verification: 'Scheduled', code: document.getElementById('codePass').value };
        
        try {
            const response = await fetch('/api/register-appointment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formattedData) });
            const result = await response.json();
            if (result.success) {
                alert('Agendamento registrado com sucesso!');
                window.location.reload();
            } else {
                alert('Erro ao registrar: ' + result.message);
            }
        } catch (error) {
            alert('Erro de rede ao registrar.');
        }
    }

    // --- Adiciona Event Listeners ---
    scheduleForm.addEventListener('submit', handleFormSubmission);
    zipCodeInputForm.addEventListener('input', async () => { /* ...código existente... */ });
    appointmentDateInput.addEventListener('input', (event) => { /* ...código existente... */ });
    customersInput.addEventListener('input', () => { /* ...código existente... */ });

    appointmentDateInput.addEventListener('focusout', calculateManualTravelTime);
    zipCodeInputForm.addEventListener('focusout', calculateManualTravelTime);
    suggestedTechDisplay.addEventListener('change', (e) => {
        if (e.target && e.target.id === 'suggestedTechSelect') {
            calculateManualTravelTime();
        }
    });

    // Popula dropdowns do formulário
    (async function populateFormDropdowns() { /* ...código existente... */ })();
});
