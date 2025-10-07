// public/appointment/appointment-form.js

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('scheduleForm')) return;

    // --- Seletores e Funções Auxiliares (sem alterações) ---
    const scheduleForm = document.getElementById('scheduleForm');
    // ... (resto dos seletores e funções auxiliares)

    // --- Popula os dropdowns na carga inicial ---
    (async function populateFormDropdowns() {
        console.log("[FORM LOG] Populando todos os dropdowns...");
        try {
            // As duas chamadas de API são necessárias novamente
            const [dataResponse, listsResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'),
                fetch('/api/get-lists') 
            ]);
            
            if (!dataResponse.ok) throw new Error('Falha ao carregar dados do dashboard (employees, franchises).');
            if (!listsResponse.ok) throw new Error('Falha ao carregar listas (pets, sources).');
            
            const data = await dataResponse.json(); // Contém employees e franchises
            const lists = await listsResponse.json(); // Contém pets e sources
            console.log("[FORM LOG] Dados recebidos:", { data, lists });
            
            // Popula os dropdowns com os dados das fontes corretas
            populateDropdowns(document.getElementById('closer1'), data.employees);
            populateDropdowns(document.getElementById('closer2'), data.employees);
            populateDropdowns(document.getElementById('franchise'), data.franchises);
            populateDropdowns(document.getElementById('pets'), lists.pets);
            populateDropdowns(document.getElementById('source'), lists.sources); // <-- CORRIGIDO: Usa 'lists.sources'

            console.log("[FORM LOG] Dropdowns populados com sucesso.");
        } catch(error) {
            console.error("[FORM ERROR] Erro ao popular dropdowns:", error);
            // Adiciona uma mensagem de erro visual para o usuário
            const formContainer = document.getElementById('main-appointment-form');
            if(formContainer && scheduleForm) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg';
                errorDiv.textContent = 'Falha ao carregar dados para os menus. Verifique a conexão e a configuração da API.';
                formContainer.insertBefore(errorDiv, scheduleForm);
            }
        }
    })();

    // O restante do arquivo (funções de submit, listeners, etc.) permanece o mesmo
    // ...
});
