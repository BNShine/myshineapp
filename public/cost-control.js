// public/cost-control.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores do DOM ---
    const costControlForm = document.getElementById('cost-control-form');
    const costControlTableBody = document.getElementById('cost-control-table-body');
    const technicianSelect = document.getElementById('technician');
    const alertsContent = document.getElementById('alerts-content');
    const toastContainer = document.getElementById('toast-container');

    let allCostData = [];
    let allTechnicians = [];

    // --- Funções Auxiliares ---

    // Função para exibir notificações (toast)
    function showToast(message, type = 'info') {
        if (!toastContainer) return;

        const toast = document.createElement('div');
        let bgColor = 'bg-card text-foreground'; // Default info style
        if (type === 'success') bgColor = 'bg-success text-success-foreground';
        if (type === 'error') bgColor = 'bg-destructive text-destructive-foreground';

        toast.className = `w-80 p-4 rounded-lg shadow-large ${bgColor} mb-2 animate-toast-in`; // Added mb-2
        toast.innerHTML = `<p class="font-semibold">${message}</p>`;

        toastContainer.appendChild(toast);

        // Auto-remove toast after 3 seconds with fade-out animation
        setTimeout(() => {
            toast.classList.remove('animate-toast-in');
            toast.classList.add('animate-toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }

    // Formata a data YYYY-MM-DD para MM/DD/YYYY (para exibição na tabela)
    function formatDateForDisplay(dateStr) {
        if (!dateStr) return '';
        // Tenta detectar se já está em MM/DD/YYYY
        if (dateStr.includes('/') && !dateStr.includes('-')) {
             const parts = dateStr.split('/');
             if (parts.length === 3 && parts[2] && parts[2].length === 4) return dateStr;
        }
        // Assume YYYY-MM-DD
        const [year, month, day] = dateStr.split('-');
        if (year && month && day && year.length === 4) {
            return `${month}/${day}/${year}`;
        }
        return dateStr; // Retorna original se não conseguir formatar
    }

     // Formata a data MM/DD/YYYY ou Date object para YYYY-MM-DD (para input date)
     function formatDateForInput(dateInput) {
        if (!dateInput) return '';
        let dateObj;
        if (dateInput instanceof Date) {
            dateObj = dateInput;
        } else if (typeof dateInput === 'string') {
            if (dateInput.includes('/')) { // Formato MM/DD/YYYY
                 const parts = dateInput.split('/');
                 if (parts.length === 3 && parts[2] && parts[2].length === 4) {
                     // Month is 0-indexed for Date constructor
                     dateObj = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
                 }
            } else if (dateInput.includes('-')) { // Já está em YYYY-MM-DD
                 const parts = dateInput.split('-');
                 if (parts.length === 3 && parts[0].length === 4) {
                     return dateInput; // Retorna como está
                 }
            }
        }

        if (dateObj instanceof Date && !isNaN(dateObj)) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        console.warn("Could not format date for input:", dateInput);
        return ''; // Retorna vazio para formatos inválidos
    }


    // Popula dropdowns
    function populateDropdown(selectElement, items, defaultText = 'Select...') {
        selectElement.innerHTML = `<option value="">${defaultText}</option>`;
        if (items && Array.isArray(items)) {
            items.sort().forEach(item => {
                if (item) {
                    const option = document.createElement('option');
                    option.value = item;
                    option.textContent = item;
                    selectElement.appendChild(option);
                }
            });
        }
    }

    // Define a data atual no campo de data do formulário
    function setTodaysDate() {
        const today = new Date();
        const dateInput = document.getElementById('date');
        if (dateInput) {
            // Formata o objeto Date para YYYY-MM-DD
            dateInput.value = formatDateForInput(today);
        }
     }


    // --- Busca de Dados Iniciais ---

    async function fetchInitialData() {
        costControlTableBody.innerHTML = '<tr><td colspan="13" class="p-4 text-center">Loading initial data...</td></tr>';
        alertsContent.innerHTML = '<p class="text-muted-foreground">Loading alerts...</p>'; // Estado de carregamento para alertas
        try {
            const [techResponse, costResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'), // Endpoint existente para buscar técnicos
                fetch('/api/get-cost-control-data')
            ]);

            // Trata resposta dos técnicos (não crítico se falhar)
            if (techResponse.ok) {
                const techData = await techResponse.json();
                allTechnicians = techData.technicians || [];
                populateDropdown(technicianSelect, allTechnicians, 'Select Technician...');
            } else {
                 console.warn(`Failed to load technician list. Status: ${techResponse.status}`);
                 allTechnicians = [];
                 populateDropdown(technicianSelect, [], 'Technicians unavailable');
            }

            // Trata resposta dos custos (crítico se falhar)
            if (!costResponse.ok) {
                 let errorMsg = 'Failed to load cost control data.';
                 try {
                     const errorJson = await costResponse.json();
                     errorMsg = errorJson.error || errorJson.message || errorMsg;
                 } catch(e){
                     errorMsg = `Failed to load cost control data. Status: ${costResponse.status}`;
                 }
                throw new Error(errorMsg);
            }

            const costDataResult = await costResponse.json();
            allCostData = costDataResult.costs || [];

            renderTable(allCostData);
            renderAlerts(allCostData); // Renderiza alertas com os dados carregados

        } catch (error) {
            console.error('Error fetching initial data:', error);
            showToast(`Error loading data: ${error.message}`, 'error');
            costControlTableBody.innerHTML = `<tr><td colspan="13" class="p-4 text-center text-red-600">Failed to load data. ${error.message}</td></tr>`;
            alertsContent.innerHTML = `<p class="text-destructive">Failed to load alert data: ${error.message}</p>`; // Mensagem de erro nos alertas
        }
    }

    // --- Lógica de Renderização ---

    function renderTable(data) {
        costControlTableBody.innerHTML = '';
        if (!Array.isArray(data) || data.length === 0) {
            costControlTableBody.innerHTML = '<tr><td colspan="13" class="p-4 text-center text-muted-foreground">No maintenance records found.</td></tr>';
            return;
        }

        // Ordenar por data (mais recente primeiro) usando o formato correto
        const sortedData = data.sort((a, b) => {
             const dateA = a.date ? new Date(formatDateForInput(a.date)) : 0;
             const dateB = b.date ? new Date(formatDateForInput(b.date)) : 0;
             // Handle invalid dates if necessary
             if (isNaN(dateA) && isNaN(dateB)) return 0;
             if (isNaN(dateA)) return 1; // Coloca inválidos no final
             if (isNaN(dateB)) return -1; // Coloca inválidos no final
             return dateB - dateA; // Mais recente primeiro
        });


        sortedData.forEach(record => {
            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');

            const isChecked = (value) => value && String(value).toUpperCase() === 'TRUE' ? '✔️' : '❌';
            const priceValue = parseFloat(record.price);

            row.innerHTML = `
                <td class="p-4 whitespace-nowrap">${formatDateForDisplay(record.date)}</td>
                <td class="p-4">${record.license_plate || ''}</td>
                <td class="p-4">${record.odometer || ''}</td>
                <td class="p-4">${record.cost_type || ''}</td>
                <td class="p-4">${record.subtype || ''}</td>
                <td class="p-4">${record.technician || ''}</td>
                <td class="p-4 text-right">${!isNaN(priceValue) ? `$${priceValue.toFixed(2)}` : ''}</td>
                <td class="p-4 max-w-[200px] truncate" title="${record.description || ''}">${record.description || ''}</td>
                <td class="p-4 max-w-[150px] truncate" title="${record.business_name || ''}">${record.business_name || ''}</td>
                <td class="p-4">${record.invoice_number || ''}</td>
                <td class="p-4 text-center">${isChecked(record.tire_change)}</td>
                <td class="p-4 text-center">${isChecked(record.oil_and_filter_change)}</td>
                <td class="p-4 text-center">${isChecked(record.brake_change)}</td>
            `;
            costControlTableBody.appendChild(row);
        });
    }

    // --- Lógica de Alertas ---
    function renderAlerts(data) {
        alertsContent.innerHTML = ''; // Limpa alertas existentes
        let hasAlerts = false;

        const OIL_CHANGE_INTERVAL = 5000;
        const TIRE_CHANGE_INTERVAL = 50000;
        const BRAKE_CHANGE_INTERVAL = 30000;
        const ALERT_THRESHOLD = 500; // Milhas antes do intervalo

        const vehicleData = {};

        // Agrupa registros por placa
        data.forEach(record => {
            if (record.license_plate && record.odometer) {
                const plate = record.license_plate.toUpperCase().trim();
                const odometerValue = parseInt(record.odometer, 10);
                if (isNaN(odometerValue)) return;

                if (!vehicleData[plate]) {
                    vehicleData[plate] = [];
                }
                vehicleData[plate].push({
                    odometer: odometerValue,
                    date: record.date ? new Date(formatDateForInput(record.date)) : null, // Usa data formatada
                    tire_change: String(record.tire_change).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record.oil_and_filter_change).toUpperCase() === 'TRUE',
                    brake_change: String(record.brake_change).toUpperCase() === 'TRUE'
                });
            }
        });

        // Ordena registros e verifica alertas
        for (const plate in vehicleData) {
            const records = vehicleData[plate].sort((a, b) => b.odometer - a.odometer); // Mais recente primeiro
            if (records.length === 0) continue;

            const currentOdometer = records[0].odometer;

            const lastOilChange = records.find(r => r.oil_and_filter_change);
            const lastTireChange = records.find(r => r.tire_change);
            const lastBrakeChange = records.find(r => r.brake_change);

            // Verifica Óleo
            if (lastOilChange) {
                const milesSince = currentOdometer - lastOilChange.odometer;
                if (milesSince >= 0 && milesSince >= OIL_CHANGE_INTERVAL - ALERT_THRESHOLD) {
                    const milesRemaining = OIL_CHANGE_INTERVAL - milesSince;
                    const message = milesRemaining <= 0
                        ? `Oil change is due (overdue by ${Math.abs(milesRemaining)} miles). Last at ${lastOilChange.odometer} mi.`
                        : `Oil change soon (approx. ${milesRemaining} miles left). Last at ${lastOilChange.odometer} mi.`;
                    createAlert(plate, message, milesRemaining <= 0 ? 'error' : 'warning');
                    hasAlerts = true;
                }
            } else {
                createAlert(plate, `No oil change record. Recommend check/change.`, 'info');
                hasAlerts = true;
            }

            // Verifica Pneus
            if (lastTireChange) {
                const milesSince = currentOdometer - lastTireChange.odometer;
                if (milesSince >= 0 && milesSince >= TIRE_CHANGE_INTERVAL - ALERT_THRESHOLD) {
                    const milesRemaining = TIRE_CHANGE_INTERVAL - milesSince;
                    const message = milesRemaining <= 0
                       ? `Tire change/inspection due (overdue by ${Math.abs(milesRemaining)} miles). Last at ${lastTireChange.odometer} mi.`
                       : `Tire change/inspection soon (approx. ${milesRemaining} miles left). Last at ${lastTireChange.odometer} mi.`;
                    createAlert(plate, message, milesRemaining <= 0 ? 'error' : 'warning');
                    hasAlerts = true;
                }
            } else {
                createAlert(plate, `No tire change record. Recommend inspection.`, 'info');
                hasAlerts = true;
            }

            // Verifica Freios
            if (lastBrakeChange) {
                const milesSince = currentOdometer - lastBrakeChange.odometer;
                if (milesSince >= 0 && milesSince >= BRAKE_CHANGE_INTERVAL - ALERT_THRESHOLD) {
                    const milesRemaining = BRAKE_CHANGE_INTERVAL - milesSince;
                    const message = milesRemaining <= 0
                        ? `Brake inspection/change due (overdue by ${Math.abs(milesRemaining)} miles). Last at ${lastBrakeChange.odometer} mi.`
                        : `Brake inspection/change soon (approx. ${milesRemaining} miles left). Last at ${lastBrakeChange.odometer} mi.`;
                    createAlert(plate, message, milesRemaining <= 0 ? 'error' : 'warning');
                    hasAlerts = true;
                }
            } else {
                createAlert(plate, `No brake change record. Recommend inspection.`, 'info');
                hasAlerts = true;
            }
        }

        if (!hasAlerts) {
            alertsContent.innerHTML = '<p class="text-muted-foreground">No immediate maintenance alerts based on available data and predefined intervals.</p>';
        }
    }

    // Função auxiliar para criar o HTML do alerta
    function createAlert(plate, message, type) {
         const alertDiv = document.createElement('div');
         let borderColor = 'border-muted';
         let bgColor = 'bg-muted/10';
         let textColor = 'text-foreground'; // Cor padrão para 'info'
         let title = 'Info';
         let titleColor = 'text-blue-700 dark:text-blue-300'; // Cor para info

         if (type === 'warning') {
             borderColor = 'border-yellow-500'; // Ajustado para Tailwind padrão
             bgColor = 'bg-yellow-500/10';
             textColor = 'text-yellow-700 dark:text-yellow-300';
             title = 'Warning';
             titleColor = textColor;
         } else if (type === 'error') {
             borderColor = 'border-destructive'; // Usa a cor do tema
             bgColor = 'bg-destructive/10';
             textColor = 'text-destructive';
             title = 'Alert';
             titleColor = textColor;
         }

        alertDiv.className = `p-4 border ${borderColor} rounded-lg ${bgColor}`;
        alertDiv.innerHTML = `
            <p class="font-semibold ${titleColor}">${title}: Vehicle ${plate}</p>
            <p class="text-sm text-muted-foreground">${message}</p>
        `;
        alertsContent.appendChild(alertDiv);
    }


    // --- Lógica de Submissão do Formulário ---

    costControlForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(costControlForm);
        const data = {};

        // Coleta dados do formulário
        formData.forEach((value, key) => {
            // *** CORREÇÃO PARA CAMPO PRICE ***
            if (key === 'price' && typeof value === 'string') {
                // Substitui vírgula por ponto para formato numérico padrão
                data[key] = value.replace(',', '.');
            } else {
                data[key] = value;
            }
        });

         // Garante que todos os checkboxes tenham um valor ('TRUE' ou 'FALSE')
         ['tire_change', 'oil_and_filter_change', 'brake_change'].forEach(key => {
             // Se o formData tem a chave, significa que foi marcado (value="TRUE")
             // Se não tem, significa que não foi marcado, então definimos como 'FALSE'
             data[key] = formData.has(key) ? 'TRUE' : 'FALSE';
         });

        const submitButton = costControlForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        try {
            const response = await fetch('/api/register-cost-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            // Verifica se a resposta da API foi OK (status 2xx)
            if (!response.ok) {
                let errorText = `Server responded with status: ${response.status}`;
                try {
                    // Tenta obter mensagem de erro específica se o servidor enviou JSON
                    const errorResult = await response.json();
                    errorText = errorResult.message || errorText;
                } catch(e) {
                    // Se a resposta não for JSON (página de erro HTML), tenta obter o texto
                    try {
                         errorText = await response.text();
                         // Limita o tamanho do texto do erro HTML para evitar sobrecarregar o alerta
                         if (errorText.length > 150) errorText = errorText.substring(0, 150) + "...";
                    } catch (e2) { /* Ignora erros adicionais ao ler o texto */ }
                }
                 console.error("API Error Response:", errorText); // Log do erro bruto
                 // Mensagem mais útil para o usuário
                 throw new Error(`Failed to save record. ${response.status === 500 ? 'Internal server error. Check server logs.' : errorText}`);
            }

            // Se a resposta foi OK, processa o JSON esperado
            const result = await response.json();

            // Verifica o campo 'success' dentro do JSON (embora response.ok já verifique o status)
            if (result.success) {
                showToast('Record saved successfully!', 'success');
                costControlForm.reset();
                setTodaysDate(); // Define a data de hoje novamente após reset
                await fetchInitialData(); // Recarrega dados para atualizar tabela e alertas
            } else {
                // Caso a API retorne status 2xx mas success: false (menos comum)
                throw new Error(result.message || 'Failed to save record.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            // Exibe o erro específico capturado
            showToast(`Error: ${error.message || 'Could not save record.'}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Record';
        }
    });

    // --- Inicialização ---
    setTodaysDate(); // Define a data de hoje no carregamento da página
    fetchInitialData(); // Busca os dados iniciais
});
