// public/cost-control.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores do DOM ---
    const costControlForm = document.getElementById('cost-control-form');
    const costControlTableBody = document.getElementById('cost-control-table-body');
    const technicianSelect = document.getElementById('technician'); // Dropdown do formulário
    const licensePlateInput = document.getElementById('license_plate'); // Input Placa no formulário
    const vinInput = document.getElementById('vin'); // Input VIN no formulário
    const alertsContent = document.getElementById('alerts-content');
    const toastContainer = document.getElementById('toast-container');

    let allCostData = [];
    let techCarsData = [];

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
        console.warn("Could not format date for display:", dateStr)
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
                     // Check if it's a valid date string YYYY-MM-DD by creating a Date object
                     // Adding T00:00:00 avoids potential timezone shifts affecting the date part
                     const tempDate = new Date(dateInput + "T00:00:00");
                     if (!isNaN(tempDate)) {
                         return dateInput; // Return as is if valid YYYY-MM-DD
                     }
                 }
            }
        }

        // Se conseguimos um objeto Date válido, formata para YYYY-MM-DD
        if (dateObj instanceof Date && !isNaN(dateObj)) {
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        console.warn("Could not format date for input:", dateInput);
        return ''; // Retorna vazio para formatos inválidos
    }


     // Adiciona meses a uma data, tratando meses curtos
     function addMonths(date, months) {
        if (!date) return null;
        const d = new Date(date); // Cria cópia da data original
        const originalDay = d.getDate(); // Guarda o dia original
        d.setMonth(d.getMonth() + months); // Adiciona os meses
        // Se o dia mudou (ex: Jan 31 + 1 mês = Feb 28/29), ajusta para o último dia do mês alvo
        if (d.getDate() !== originalDay) {
          // Volta para o dia 0 do *próximo* mês, que é o último dia do mês alvo
          d.setDate(0);
        }
        return d;
    }

    // Popula dropdowns (agora aceita array de objetos)
    function populateDropdown(selectElement, items, defaultText = 'Select...', valueKey = null, textKey = null) {
        selectElement.innerHTML = `<option value="">${defaultText}</option>`; // Limpa e adiciona opção padrão
        if (items && Array.isArray(items)) {
            // Ordena pelo texto a ser exibido
            items.sort((a, b) => {
                const textA = textKey ? (a[textKey] || '') : (a || '');
                const textB = textKey ? (b[textKey] || '') : (b || '');
                return textA.localeCompare(textB); // Ordenação alfabética
            }).forEach(item => {
                const value = valueKey ? (item[valueKey] || '') : (item || '');
                const text = textKey ? (item[textKey] || '') : (item || '');
                if (value) { // Só adiciona se tiver um valor (evita techs sem nome)
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = text;
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
        alertsContent.innerHTML = '<p class="text-muted-foreground">Loading alerts...</p>';
        try {
            // Busca dados de TechCars E dados de Custo em paralelo
            const [techCarsResponse, costResponse] = await Promise.all([
                fetch('/api/get-tech-cars-data'), // Novo endpoint
                fetch('/api/get-cost-control-data')
            ]);

            // Trata resposta de TechCars (crítico para o dropdown)
            if (!techCarsResponse.ok) {
                 let errorMsg = 'Failed to load technician/car list.';
                 try { const errorJson = await techCarsResponse.json(); errorMsg = errorJson.error || errorJson.message || errorMsg; } catch(e){ errorMsg = `Status: ${techCarsResponse.status}`; }
                 throw new Error(errorMsg);
            }
            const techCarsResult = await techCarsResponse.json();
            techCarsData = techCarsResult.techCars || [];
            // Popula o dropdown usando tech_name como valor e texto
            populateDropdown(technicianSelect, techCarsData, 'Select Technician...', 'tech_name', 'tech_name');


            // Trata resposta dos custos
            if (!costResponse.ok) {
                 let errorMsg = 'Failed to load cost control data.';
                 try { const errorJson = await costResponse.json(); errorMsg = errorJson.error || errorJson.message || errorMsg; } catch(e){ errorMsg = `Status: ${costResponse.status}`; }
                throw new Error(errorMsg);
            }

            const costDataResult = await costResponse.json();
            // Filtra registros sem data válida ANTES de usar
            allCostData = (costDataResult.costs || []).filter(record => record.date && formatDateForInput(record.date));

            renderTable(allCostData);
            renderAlerts(allCostData);

        } catch (error) {
            console.error('Error fetching initial data:', error);
            showToast(`Error loading data: ${error.message}`, 'error');
            costControlTableBody.innerHTML = `<tr><td colspan="13" class="p-4 text-center text-red-600">Failed to load data. ${error.message}</td></tr>`;
            alertsContent.innerHTML = `<p class="text-destructive">Failed to load alert data: ${error.message}</p>`;
            // Desabilita dropdown se falhar ao carregar TechCars
            if (technicianSelect) {
                technicianSelect.disabled = true;
                populateDropdown(technicianSelect, [], 'Error loading technicians');
            }
        }
    }

    // --- Lógica de Renderização ---

    function renderTable(data) {
        costControlTableBody.innerHTML = ''; // Limpa tabela
        if (!Array.isArray(data) || data.length === 0) {
            costControlTableBody.innerHTML = '<tr><td colspan="13" class="p-4 text-center text-muted-foreground">No maintenance records found.</td></tr>';
            return;
        }

        // Ordenar por data (mais recente primeiro)
        const sortedData = data.sort((a, b) => {
             // Converte para Date object para comparação segura
             const dateA = a.date ? new Date(formatDateForInput(a.date)) : 0;
             const dateB = b.date ? new Date(formatDateForInput(b.date)) : 0;
             // Se alguma data for inválida, trata como 0 para ordenação
             const timeA = !isNaN(dateA) ? dateA.getTime() : 0;
             const timeB = !isNaN(dateB) ? dateB.getTime() : 0;
             return timeB - timeA; // Mais recente primeiro
        });


        sortedData.forEach(record => {
            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            const isChecked = (value) => value && String(value).toUpperCase() === 'TRUE' ? '✔️' : '❌';
            const priceValue = parseFloat(record.price); // Tenta converter preço para número

            // *** TRUNCATE DESCRIPTION to 30 chars ***
            const descriptionFull = record.description || '';
            const descriptionShort = descriptionFull.length > 30
                ? descriptionFull.substring(0, 30) + '...'
                : descriptionFull;

            row.innerHTML = `
                <td class="p-4 whitespace-nowrap">${formatDateForDisplay(record.date)}</td>
                <td class="p-4">${record.license_plate || ''}</td>
                <td class="p-4">${record.odometer || ''}</td>
                <td class="p-4">${record.cost_type || ''}</td>
                <td class="p-4">${record.subtype || ''}</td>
                <td class="p-4">${record.technician || ''}</td>
                {/* Exibe preço formatado se for número válido */}
                <td class="p-4 text-right">${!isNaN(priceValue) ? `$${priceValue.toFixed(2)}` : ''}</td>
                {/* Usando descriptionShort e title para tooltip */}
                <td class="p-4 max-w-[200px] truncate" title="${descriptionFull}">${descriptionShort}</td>
                <td class="p-4 max-w-[150px] truncate" title="${record.business_name || ''}">${record.business_name || ''}</td>
                <td class="p-4">${record.invoice_number || ''}</td>
                <td class="p-4 text-center">${isChecked(record.tire_change)}</td>
                <td class="p-4 text-center">${isChecked(record.oil_and_filter_change)}</td>
                <td class="p-4 text-center">${isChecked(record.brake_change)}</td>
            `;
            costControlTableBody.appendChild(row);
        });
    }

    // --- Lógica de Alertas (AGRUPADA POR VEÍCULO) ---
    function renderAlerts(data) {
        alertsContent.innerHTML = ''; // Limpa alertas existentes
        let hasAnyAlerts = false; // Flag para saber se algum alerta foi gerado
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas datas

        // Intervalos em meses
        const OIL_INTERVAL_MONTHS = 2;
        const TIRE_INTERVAL_MONTHS = 6;
        const BRAKE_INTERVAL_MONTHS = 4;
        const ALERT_THRESHOLD_DAYS = 15; // Avisar com X dias de antecedência

        const vehicleData = {}; // Agrupa dados por placa

        // 1. Agrupa registros válidos por placa
        data.forEach(record => {
            if (record.license_plate) {
                const plate = record.license_plate.toUpperCase().trim();
                const recordDate = record.date ? new Date(formatDateForInput(record.date)) : null; // Usa data formatada
                // Ignora registros sem data válida
                if (!recordDate || isNaN(recordDate)) {
                    // console.log("Skipping record due to invalid date:", record); // Debug (opcional)
                    return;
                }

                if (!vehicleData[plate]) {
                    vehicleData[plate] = [];
                }
                vehicleData[plate].push({
                    odometer: record.odometer ? parseInt(record.odometer, 10) : null,
                    date: recordDate,
                    tire_change: String(record.tire_change).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record.oil_and_filter_change).toUpperCase() === 'TRUE',
                    brake_change: String(record.brake_change).toUpperCase() === 'TRUE'
                });
            }
        });

        // 2. Processa cada veículo
        for (const plate in vehicleData) {
            const records = vehicleData[plate].sort((a, b) => b.date - a.date); // Mais recente primeiro
            if (records.length === 0) continue;

            let vehicleAlertMessages = []; // Armazena mensagens para este veículo
            let highestSeverity = 'info'; // Guarda a severidade mais alta (error > warning > info)

            // Encontra a última troca *válida* de cada item
            const lastOilChangeRecord = records.find(r => r.oil_and_filter_change);
            const lastTireChangeRecord = records.find(r => r.tire_change);
            const lastBrakeChangeRecord = records.find(r => r.brake_change);

            // Calcula datas de vencimento e alerta
            const oilDueDate = lastOilChangeRecord ? addMonths(lastOilChangeRecord.date, OIL_INTERVAL_MONTHS) : null;
            const tireDueDate = lastTireChangeRecord ? addMonths(lastTireChangeRecord.date, TIRE_INTERVAL_MONTHS) : null;
            const brakeDueDate = lastBrakeChangeRecord ? addMonths(lastBrakeChangeRecord.date, BRAKE_INTERVAL_MONTHS) : null;

            const alertThresholdDate = new Date(today);
            alertThresholdDate.setDate(today.getDate() + ALERT_THRESHOLD_DAYS);

            // Verifica Óleo
            if (oilDueDate && !isNaN(oilDueDate)) {
                if (oilDueDate <= today) { // Vencido
                    vehicleAlertMessages.push(`Oil change due (Last: ${formatDateForDisplay(formatDateForInput(lastOilChangeRecord.date))})`);
                    highestSeverity = 'error'; // Prioridade máxima
                } else if (oilDueDate <= alertThresholdDate) { // Próximo do vencimento
                    vehicleAlertMessages.push(`Oil change soon (Due: ${formatDateForDisplay(formatDateForInput(oilDueDate))})`);
                    if (highestSeverity !== 'error') highestSeverity = 'warning'; // Warning se não for error
                }
            } else if (!lastOilChangeRecord) { // Apenas informa se NUNCA houve registro
                 vehicleAlertMessages.push(`No oil change record found`);
                 // Mantém 'info' como severidade padrão se não houver outros alertas
            }

            // Verifica Pneus
            if (tireDueDate && !isNaN(tireDueDate)) {
                if (tireDueDate <= today) {
                    vehicleAlertMessages.push(`Tire check due (Last: ${formatDateForDisplay(formatDateForInput(lastTireChangeRecord.date))})`);
                    highestSeverity = 'error';
                } else if (tireDueDate <= alertThresholdDate) {
                    vehicleAlertMessages.push(`Tire check soon (Due: ${formatDateForDisplay(formatDateForInput(tireDueDate))})`);
                    if (highestSeverity !== 'error') highestSeverity = 'warning';
                }
            } else if (!lastTireChangeRecord) {
                 vehicleAlertMessages.push(`No tire change record found`);
            }

            // Verifica Freios
            if (brakeDueDate && !isNaN(brakeDueDate)) {
                if (brakeDueDate <= today) {
                    vehicleAlertMessages.push(`Brake check due (Last: ${formatDateForDisplay(formatDateForInput(lastBrakeChangeRecord.date))})`);
                    highestSeverity = 'error';
                } else if (brakeDueDate <= alertThresholdDate) {
                    vehicleAlertMessages.push(`Brake check soon (Due: ${formatDateForDisplay(formatDateForInput(brakeDueDate))})`);
                    if (highestSeverity !== 'error') highestSeverity = 'warning';
                }
            } else if (!lastBrakeChangeRecord){
                 vehicleAlertMessages.push(`No brake change record found`);
            }

            if (vehicleAlertMessages.length > 0) {
                createAlert(plate, vehicleAlertMessages, highestSeverity);
                hasAnyAlerts = true; // Marca que pelo menos um alerta foi gerado
            }
        } // Fim do loop por veículo

        // 4. Exibe mensagem se nenhum alerta foi gerado para nenhum veículo
        if (!hasAnyAlerts) {
            alertsContent.innerHTML = '<p class="text-muted-foreground">No immediate maintenance alerts found based on time intervals.</p>';
        }
    }

    // Função auxiliar para criar o HTML do alerta AGRUPADO E MINIMALISTA
    function createAlert(plate, messages, type) {
        const alertDiv = document.createElement('div');
        let borderColor = 'border-muted';
        let bgColor = 'bg-muted/10';
        let title = 'Info';
        let titleColor = 'text-blue-700 dark:text-blue-300'; // Cor para info

        if (type === 'warning') {
            borderColor = 'border-yellow-500'; // Tailwind padrão
            bgColor = 'bg-yellow-500/10';
            title = 'Warning';
            titleColor = 'text-yellow-700 dark:text-yellow-300';
        } else if (type === 'error') {
            borderColor = 'border-destructive'; // Cor do tema
            bgColor = 'bg-destructive/10';
            title = 'Alert / Due'; // Título mais claro para erro
            titleColor = 'text-destructive';
        }

       // Estilo mais compacto: padding reduzido, margin-bottom
       alertDiv.className = `p-3 border ${borderColor} rounded-lg ${bgColor} mb-2`;

       // Cria string única com mensagens separadas por " • "
       const messageString = messages.join(' • ');

       alertDiv.innerHTML = `
           <div class="flex justify-between items-center">
                <span class="font-semibold text-sm ${titleColor}">${title}: Vehicle ${plate}</span>
           </div>
           <p class="text-xs text-muted-foreground mt-1">${messageString}</p>
       `;
       alertsContent.appendChild(alertDiv);
   }


    // --- Lógica de Autofill ---
    function handleTechnicianChange() {
        const selectedTechName = technicianSelect.value;
        const selectedTechData = techCarsData.find(tech => tech.tech_name === selectedTechName);

        if (selectedTechData) {
            vinInput.value = selectedTechData.vin_number || '';
            licensePlateInput.value = selectedTechData.car_plate || '';
        } else {
            vinInput.value = '';
            licensePlateInput.value = '';
        }
    }

    // --- Lógica de Submissão do Formulário ---
    costControlForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(costControlForm);
        const data = {};

        // Coleta dados do formulário
        formData.forEach((value, key) => {
            if (key === 'price' && typeof value === 'string') {
                // Substitui vírgula por ponto para formato numérico padrão ANTES de enviar
                data[key] = value.replace(',', '.');
            } else {
                data[key] = value;
            }
        });

        // Adiciona VIN e Placa manualmente (pois são readonly)
        data['vin'] = vinInput.value;
        data['license_plate'] = licensePlateInput.value;

        // Garante valor 'TRUE' ou 'FALSE' para checkboxes
        ['tire_change', 'oil_and_filter_change', 'brake_change'].forEach(key => {
            data[key] = formData.has(key) ? 'TRUE' : 'FALSE';
        });

        // Validação: Técnico deve ser selecionado
        if (!data.technician) {
            showToast('Please select a Technician (Driver).', 'error');
            return; // Impede o envio
        }
        // Validação adicional: Placa e VIN não podem estar vazios
         if (!data.license_plate || !data.vin) {
            showToast('VIN and License Plate must be autofilled by selecting a Technician.', 'error');
            return;
        }


        const submitButton = costControlForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        try {
            const response = await fetch('/api/register-cost-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) { // Tratamento de erro melhorado
                let errorText = `Server responded with status: ${response.status}`;
                try {
                    const errorResult = await response.json(); errorText = errorResult.message || errorText;
                } catch(e) {
                    try { errorText = await response.text(); if (errorText.length > 150) errorText = errorText.substring(0, 150) + "..."; } catch (e2) {}
                }
                 console.error("API Error Response:", errorText);
                 throw new Error(`Failed to save record. ${response.status === 500 ? 'Internal server error. Check server logs.' : errorText}`);
            }

            const result = await response.json();

            if (result.success) {
                showToast('Record saved successfully!', 'success');
                costControlForm.reset(); // Limpa o formulário
                setTodaysDate(); // Define data novamente
                vinInput.value = ''; // Limpa campos autofill
                licensePlateInput.value = ''; // Limpa campos autofill
                await fetchInitialData(); // Recarrega dados para atualizar tabela e alertas
            } else {
                // Caso a API retorne status 2xx mas success: false
                throw new Error(result.message || 'Failed to save record.');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showToast(`Error: ${error.message || 'Could not save record.'}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Save Record';
        }
    });

    // --- Adiciona Event Listener para o Dropdown de Técnico ---
    if (technicianSelect) {
        technicianSelect.addEventListener('change', handleTechnicianChange);
    }

    // --- Inicialização ---
    setTodaysDate(); // Define a data de hoje no carregamento
    fetchInitialData(); // Busca os dados iniciais
});
