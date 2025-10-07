// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores e Configurações (a maioria sem alterações) ---
    const scheduleForm = document.getElementById('scheduleForm');
    if (!scheduleForm) return;

    // --- Funções Auxiliares (sem alterações) ---
    function populateDropdowns(selectElement, items) { /* ...código existente... */ }
    function generateAlphanumericCode(length = 5) { /* ...código existente... */ }
    async function getCityFromZip(zipCode) { /* ...código existente... */ }
    async function updateSuggestedTechnician(customerState, suggestedTechDisplay) { /* ...código existente... */ }
    
    // --- Lógica de Submissão (COM A NOVA VERIFICAÇÃO) ---
    async function handleFormSubmission(event) {
        event.preventDefault();
        
        const smartCheckToggle = document.getElementById('smart-check-toggle');
        const isSmartCheckOff = !smartCheckToggle.checked;

        // Se o modo inteligente estiver DESLIGADO, ajusta os valores
        if (isSmartCheckOff) {
            console.log("Smart Check is OFF. Setting travelTime to 0 and margin to 60.");
            document.getElementById('travelTime').value = '0';
            document.getElementById('margin').value = '60';
        } else {
            // Garante que a margem do select seja usada se o modo inteligente estiver LIGADO
            const marginSelect = document.getElementById('appointment-margin');
            if(marginSelect) {
                 document.getElementById('margin').value = marginSelect.value;
            }
        }
        
        const formData = new FormData(scheduleForm);
        const data = Object.fromEntries(formData.entries());

        // O restante da lógica de submissão continua igual...
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

    // --- Adiciona Event Listeners e Popula Dropdowns (sem alterações) ---
    // ... (todo o restante do arquivo permanece o mesmo) ...
    // ... (incluindo a criação dos campos hidden e os event listeners) ...
    
    // Garante que o event listener principal seja o novo handleFormSubmission
    scheduleForm.addEventListener('submit', handleFormSubmission);
    
    // O resto do arquivo (criação de campos hidden, outros listeners, etc.) continua igual
    // ...
});
