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

    // Formata a data YYYY-MM-DD para MM/DD/YYYY
    function formatDateForDisplay(dateStr) {
        if (!dateStr) return '';
        // Tenta detectar se já está em MM/DD/YYYY
        if (dateStr.includes('/') && !dateStr.includes('-')) {
             const parts = dateStr.split('/');
             if (parts.length === 3 && parts[2].length === 4) return dateStr;
        }
        // Assume YYYY-MM-DD
        const [year, month, day] = dateStr.split('-');
        if (year && month && day) {
            return `${month}/${day}/${year}`;
        }
        return dateStr; // Retorna original se não conseguir formatar
    }

     // Formata a data MM/DD/YYYY para YYYY-MM-DD (para input date)
     function formatDateForInput(dateStr) {
        if (!dateStr) return '';
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const [month, day, year] = parts;
             // Ensure month and day have leading zeros if needed
            const formattedMonth = month.padStart(2, '0');
            const formattedDay = day.padStart(2, '0');
            // Check if year is valid (e.g., 4 digits)
            if (year && year.length === 4) {
                 return `${year}-${formattedMonth}-${formattedDay}`;
            }
        }
        // If it's already in YYYY-MM-DD, return as is
        if (dateStr.includes('-')) {
             const dateParts = dateStr.split('-');
             if (dateParts.length === 3 && dateParts[0].length === 4) {
                 return dateStr;
             }
        }
        console.warn("Could not format date for input:", dateStr);
        return ''; // Return empty for invalid formats
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
            dateInput.value = formatDateForInput(today.toLocaleDateString('en-US')); // Formata MM/DD/YYYY para YYYY-MM-DD
        }
     }


    // --- Busca de Dados Iniciais ---

    async function fetchInitialData() {
        costControlTableBody.innerHTML = '<tr><td colspan="13" class="p-4 text-center">Loading initial data...</td></tr>';
        try {
            const [techResponse, costResponse] = await Promise.all([
                fetch('/api/get-dashboard-data'), // Endpoint existente para buscar técnicos
                fetch('/api/get-cost-control-data')
            ]);

            if (!techResponse.ok) console.warn('Failed to load technician list.');
            if (!costResponse.ok) throw new Error('Failed to load cost control data.');

            const techData = techResponse.ok ? await techResponse.json() : { technicians: [] };
            const costDataResult = await costResponse.json();

            allTechnicians = techData.technicians || [];
            allCostData = costDataResult.costs || [];

            populateDropdown(technicianSelect, allTechnicians, 'Select Technician...');
            renderTable(allCostData);
            renderAlerts(allCostData); // Renderiza alertas com os dados carregados

        } catch (error) {
            console.error('Error fetching initial data:', error);
            showToast(`Error loading data: ${error.message}`, 'error');
            costControlTableBody.innerHTML = `<tr><td colspan="13" class="p-4 text-center text-red-600">Failed to load data. ${error.message}</td></tr>`;
        }
    }

    // --- Lógica de Renderização ---

    function renderTable(data) {
        costControlTableBody.innerHTML = '';
        if (data.length === 0) {
            costControlTableBody.innerHTML = '<tr><td colspan="13" class="p-4 text-center text-muted-foreground">No maintenance records found.</td></tr>';
            return;
        }

        // Ordenar por data (mais recente primeiro) usando o formato correto
        const sortedData = data.sort((a, b) => {
             const dateA = a.date ? new Date(formatDateForInput(a.date)) : 0;
             const dateB = b.date ? new Date(formatDateForInput(b.date)) : 0;
             // Handle invalid dates if necessary
             if (isNaN(dateA) && isNaN(dateB)) return 0;
             if (isNaN(dateA)) return 1;
             if (isNaN(dateB)) return -1;
             return dateB - dateA; // Mais recente primeiro
        });


        sortedData.forEach(record => {
            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');

            const isChecked = (value) => value && String(value).toUpperCase() === 'TRUE' ? '✔️' : '❌';

            row.innerHTML = `
                <td class="p-4 whitespace-nowrap">${formatDateForDisplay(record.date)}</td>
                <td class="p-4">${record.license_plate || ''}</td>
                <td class="p-4">${record.odometer || ''}</td>
                <td class="p-4">${record.cost_type || ''}</td>
                <td class="p-4">${record.subtype || ''}</td>
                <td class="p-4">${record.technician || ''}</td>
                <td class="p-4 text-right">${record.price ? `$${parseFloat(record.price).toFixed(2)}` : ''}</td>
                <td class="p-4 max-w-xs truncate" title="${record.description || ''}">${record.description || ''}</td>
                <td class="p-4">${record.business_name || ''}</td>
                <td class="p-4">${record.invoice_number || ''}</td>
                <td class="p-4 text-center">${isChecked(record.tire_change)}</td>
                <td class="p-4 text-center">${isChecked(record.oil_and_filter_change)}</td>
                <td class="p-4 text-center">${isChecked(record.brake_change)}</td>
                `;
            costControlTableBody.appendChild(row);
        });
    }

    // --- Lógica de Alertas (Exemplo Básico) ---
    function renderAlerts(data) {
        alertsContent.innerHTML = ''; // Limpa alertas existentes
        let hasAlerts = false;

        // Regras de Exemplo (Ajustar conforme necessário)
        const OIL_CHANGE_INTERVAL = 5000; // Milhas
        const TIRE_CHANGE_INTERVAL = 50000; // Milhas
        const BRAKE_CHANGE_INTERVAL = 30000; // Milhas
        const ALERT_THRESHOLD = 500; // Milhas antes do intervalo

        const vehicleData = {}; // Agrupa dados por placa

        // Agrupa os registros por placa e ordena por odômetro (decrescente)
        data.forEach(record => {
            if (record.license_plate && record.odometer) {
                const plate = record.license_plate.toUpperCase().trim(); // Normaliza a placa
                 const odometerValue = parseInt(record.odometer, 10);
                 if (isNaN(odometerValue)) return; // Ignora registros sem odômetro válido

                if (!vehicleData[plate]) {
                    vehicleData[plate] = [];
                }
                vehicleData[plate].push({
                    odometer: odometerValue,
                    date: record.date ? new Date(formatDateForInput(record.date)) : null,
                    tire_change: String(record.tire_change).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record.oil_and_filter_change).toUpperCase() === 'TRUE',
                    brake_change: String(record.brake_change).toUpperCase() === 'TRUE'
                });
            }
        });

        // Ordena os registros de cada veículo por odômetro
        for (const plate in vehicleData) {
            vehicleData[plate].sort((a, b) => b.odometer - a.odometer); // Mais recente primeiro
        }

        // Verifica alertas para cada veículo
        for (const plate in vehicleData) {
            const records = vehicleData[plate];
            if (records.length === 0) continue;

            const currentOdometer = records[0].odometer; // O mais recente

            // Encontra a última troca de cada item
            const lastOilChange = records.find(r => r.oil_and_filter_change);
            const lastTireChange = records.find(r => r.tire_change);
            const lastBrakeChange = records.find(r => r.brake_change);

            // Verifica Óleo
            if (lastOilChange) {
                const milesSinceOilChange = currentOdometer - lastOilChange.odometer;
                 // Verifica se a leitura atual é maior que a da última troca
                if (milesSinceOilChange >= 0 && milesSinceOilChange >= OIL_CHANGE_INTERVAL - ALERT_THRESHOLD) {
                    const milesRemaining = OIL_CHANGE_INTERVAL - milesSinceOilChange;
                    const message = milesRemaining <= 0
                        ? `Oil change is due (overdue by ${Math.abs(milesRemaining)} miles). Last change at ${lastOilChange.odometer} miles.`
                        : `Oil change recommended soon (approx. ${milesRemaining} miles remaining). Last change at ${lastOilChange.odometer} miles.`;
                    createAlert(plate, message, milesRemaining <= 0 ? 'error' : 'warning'); // Usa 'error' para overdue
                    hasAlerts = true;
                }
            } else {
                 createAlert(plate, `No oil change record found. Recommend check/change.`, 'info');
                 hasAlerts = true;
            }

            // Verifica Pneus
            if (lastTireChange) {
                const milesSinceTireChange = currentOdometer - lastTireChange.odometer;
                 if (milesSinceTireChange >= 0 && milesSinceTireChange >= TIRE_CHANGE_INTERVAL - ALERT_THRESHOLD) {
                     const milesRemaining = TIRE_CHANGE_INTERVAL - milesSinceTireChange;
                     const message = milesRemaining <= 0
                        ? `Tire change/inspection is due (overdue by ${Math.abs(milesRemaining)} miles). Last change at ${lastTireChange.odometer} miles.`
                        : `Tire change/inspection recommended soon (approx. ${milesRemaining} miles remaining). Last change at ${lastTireChange.odometer} miles.`;
                     createAlert(plate, message, milesRemaining <= 0 ? 'error' : 'warning');
                     hasAlerts = true;
                 }
            } else {
                 createAlert(plate, `No tire change record found. Recommend inspection.`, 'info');
                 hasAlerts = true;
            }

            // Verifica Freios
             if (lastBrakeChange) {
                const milesSinceBrakeChange = currentOdometer - lastBrakeChange.odometer;
                 if (milesSinceBrakeChange >= 0 && milesSinceBrakeChange >= BRAKE_CHANGE_INTERVAL - ALERT_THRESHOLD) {
                     const milesRemaining = BRAKE_CHANGE_INTERVAL - milesSinceBrakeChange;
                     const message = milesRemaining <= 0
                        ? `Brake inspection/change is due (overdue by ${Math.abs(milesRemaining)} miles). Last change at ${lastBrakeChange.odometer} miles.`
                        : `Brake inspection/change recommended soon (approx. ${milesRemaining} miles remaining). Last change at ${lastBrakeChange.odometer} miles.`;
                     createAlert(plate, message, milesRemaining <= 0 ? 'error' : 'warning');
                     hasAlerts = true;
                 }
             } else {
                 createAlert(plate, `No brake change record found. Recommend inspection.`, 'info');
                 hasAlerts = true;
             }
        }


        if (!hasAlerts) {
            alertsContent.innerHTML = '<p class="text-muted-foreground">No immediate maintenance alerts based on available data and predefined intervals.</p>';
        }
    }

    function createAlert(plate, message, type) {
         const alertDiv = document.createElement('div');
         let borderColor = 'border-muted';
         let bgColor = 'bg-muted/10';
         let textColor = 'text-foreground'; // Cor padrão para 'info'
         let title = 'Info';

         if (type === 'warning') {
             borderColor = 'border-warning';
             bgColor = 'bg-warning/10';
             textColor = 'text-yellow-700 dark:text-yellow-300'; // Cor específica para warning
             title = 'Warning';
         } else if (type === 'error') {
             borderColor = 'border-destructive';
             bgColor = 'bg-destructive/10';
             textColor = 'text-destructive'; // Cor específica para error
             title = 'Alert'; // Ou 'Error'
         }


        alertDiv.className = `p-4 border ${borderColor} rounded-lg ${bgColor}`;
        alertDiv.innerHTML = `
            <p class="font-semibold ${textColor}">${title}: Vehicle ${plate}</p>
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
            data[key] = value;
        });

         // Garante que todos os checkboxes tenham um valor (FALSE se não marcados)
         ['tire_change', 'oil_and_filter_change', 'brake_change'].forEach(key => {
             if (!formData.has(key)) { // Verifica se o checkbox NÃO FOI MARCADO
                 data[key] = 'FALSE';
             } else {
                 data[key] = 'TRUE'; // Garante que o valor enviado seja TRUE se marcado
             }
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

            const result = await response.json();

            if (result.success) {
                showToast('Record saved successfully!', 'success');
                costControlForm.reset(); // Limpa o formulário
                setTodaysDate(); // Define a data de hoje novamente após reset
                // Recarrega os dados para atualizar a tabela e alertas
                await fetchInitialData();
            } else {
                throw new Error(result.message || 'Failed to save record.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Record';
        }
    });

    // --- Inicialização ---
    setTodaysDate(); // Define a data de hoje no carregamento da página
    fetchInitialData();
});
