// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('scheduleForm')) return;

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
        // Limpa opções antigas, mantendo a primeira (placeholder)
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

    async function updateSuggestedTechnician(customerState) {
        // (código sem alterações)
    }
    
    // --- Lógica de Submissão (sem alterações) ---
    async function handleFormSubmission(event) { /* ...código existente... */ }
    
    // --- Adiciona Event Listeners ---
    scheduleForm.addEventListener('submit', handleFormSubmission);
    zipCodeInputForm.addEventListener('input', async (event) => { /* ...código existente... */ });
    customersInput.addEventListener('input', () => { /* ...código existente... */ });
    appointmentDateInput.addEventListener('input', (event) => { /* ...código existente... */ });

    // --- Popula os dropdowns na carga inicial ---
    (async function populateFormDropdowns() {
        console.log("[FORM LOG] Populando dropdowns de 'Service and Sales Details'...");
        try {
            const [dataResponse, listsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists')
            ]);
            
            if (!dataResponse.ok) {
                 const errorText = await dataResponse.text();
                 throw new Error(`Falha ao carregar dados do dashboard. Status: ${dataResponse.status}. Resposta: ${errorText}`);
            }
            if (!listsResponse.ok) {
                 throw new Error(`Falha ao carregar listas dinâmicas. Status: ${listsResponse.status}`);
            }
            
            const data = await dataResponse.json();
            const lists = await listsResponse.json();
            console.log("[FORM LOG] Dados recebidos para os dropdowns:", data);
            
            // Popula os dropdowns de Closer e SDR com a lista de 'employees'
            populateDropdowns(document.getElementById('closer1'), data.employees);
            populateDropdowns(document.getElementById('closer2'), data.employees);
            populateDropdowns(document.getElementById('franchise'), data.franchises);
            populateDropdowns(document.getElementById('pets'), lists.pets);
            populateDropdowns(document.getElementById('source'), lists.sources);

            console.log("[FORM LOG] Dropdowns populados com sucesso.");
        } catch(error) {
            console.error("[FORM ERROR] Erro ao popular dropdowns:", error.message);
        }
    })();
});
