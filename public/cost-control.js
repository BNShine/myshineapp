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

    // Configuration Form Selectors
    const configForm = document.getElementById('config-form');
    const saveConfigBtn = document.getElementById('save-config-btn');

    // History Filter Selectors
    const filterHistorySection = document.getElementById('filter-history-section');
    const filterStartDateInput = document.getElementById('filter-start-date');
    const filterEndDateInput = document.getElementById('filter-end-date');
    const filterTechnicianSelect = document.getElementById('filter-technician');
    const filterLicensePlateInput = document.getElementById('filter-license-plate');
    const searchHistoryBtn = document.getElementById('search-history-btn');
    const listingSection = document.getElementById('listing-section'); // The history table section

    let allCostData = [];
    let techCarsData = [];
    let intervalConfig = {}; // Será carregado da API

    // --- Configuration Constants ---
    const MAINTENANCE_CATEGORIES = {
        'tire_change': 'Tire Change',
        'oil_and_filter_change': 'Oil & Filter Change',
        'brake_change': 'Brake Change',
        'battery_change': 'Battery Change',
        'air_filter_change': 'Air Filter Change',
        'other': 'Other Maintenance'
    };

    const DEFAULT_INTERVALS = {
        'tire_change': { type: 'monthly', value: 6 },
        'oil_and_filter_change': { type: 'monthly', value: 2 },
        'brake_change': { type: 'monthly', value: 4 },
        'battery_change': { type: 'monthly', value: 24 },
        'air_filter_change': { type: 'monthly', value: 12 },
        'other': { type: 'monthly', value: 12 },
        'alert_threshold_days': 15
    };

    // --- Toast Notification ---
    function showToast(message, type = 'info') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        let bgColor = 'bg-card text-foreground'; // Default info style
        if (type === 'success') bgColor = 'bg-success text-success-foreground';
        if (type === 'error') bgColor = 'bg-destructive text-destructive-foreground';
        toast.className = `w-80 p-4 rounded-lg shadow-large ${bgColor} mb-2 animate-toast-in`;
        toast.innerHTML = `<p class="font-semibold">${message}</p>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('animate-toast-in');
            toast.classList.add('animate-toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    }

    // --- Date Formatting ---
    // CORRIGIDO: Aceita string (YYYY-MM-DD ou MM/DD/YYYY) ou Date object
    function formatDateForDisplay(dateInput) {
        if (!dateInput) return '';
        let dateObj;

        if (dateInput instanceof Date && !isNaN(dateInput)) {
            dateObj = dateInput;
        } else if (typeof dateInput === 'string') {
            // Tenta detectar MM/DD/YYYY
            if (dateInput.includes('/') && !dateInput.includes('-')) {
                 const parts = dateInput.split('/');
                 if (parts.length === 3 && parts[2] && parts[2].length === 4) {
                     dateObj = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
                 }
            // Tenta detectar YYYY-MM-DD
            } else if (dateInput.includes('-') && !dateInput.includes('/')) {
                 const parts = dateInput.split('-');
                 if (parts.length === 3 && parts[0].length === 4) {
                     // Adiciona T00:00:00 para evitar timezone shift ao criar o objeto
                     dateObj = new Date(dateInput + "T00:00:00");
                 }
            }
             // Tenta analisar outros formatos (menos provável vindo da planilha)
             else {
                 try { dateObj = new Date(dateInput); } catch (e) {}
             }
        }

        // Se temos um objeto Date válido, formata
        if (dateObj instanceof Date && !isNaN(dateObj)) {
            const year = dateObj.getFullYear();
             // Verifica ano razoável
             if (year < 1900) {
                  console.warn("formatDateForDisplay: Year seems invalid:", year, "Original input:", dateInput);
                  return typeof dateInput === 'string' ? dateInput : ''; // Retorna original se string, vazio senão
             }
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${month}/${day}/${year}`;
        }

        console.warn("Could not format date for display:", dateInput);
        return typeof dateInput === 'string' ? dateInput : ''; // Retorna original se string, vazio senão
    }


    function formatDateForInput(dateInput) {
        if (!dateInput) return '';
        let dateObj;
        if (dateInput instanceof Date && !isNaN(dateInput)) { // Verifica se já é um objeto Date válido
            dateObj = dateInput;
        } else if (typeof dateInput === 'string') {
            // Verifica MM/DD/YYYY (sem hora)
            if (dateInput.includes('/') && !dateInput.includes('T') && !dateInput.includes(' ')) {
                 const parts = dateInput.split('/');
                 if (parts.length === 3 && parts[2] && parts[2].length === 4) {
                     // Month is 0-indexed for Date constructor
                     dateObj = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
                 }
            // Verifica YYYY-MM-DD (já no formato correto, sem hora)
            } else if (dateInput.includes('-') && !dateInput.includes('T') && !dateInput.includes(' ')) {
                 const parts = dateInput.split('-');
                 if (parts.length === 3 && parts[0].length === 4) {
                     // Cria um objeto Date para validar, mas retorna a string original se válida
                     const tempDate = new Date(dateInput + "T00:00:00"); // Adiciona T00:00:00 para evitar timezone shift
                     if (!isNaN(tempDate)) {
                         return dateInput; // Retorna como está se válido YYYY-MM-DD
                     }
                 }
            }
             // Tenta analisar outros formatos de string de data comuns (incluindo ISO com hora)
             else {
                try {
                    // Tenta criar o objeto Date diretamente
                    const tempDate = new Date(dateInput);
                    // Verifica se o objeto criado é válido
                    if (!isNaN(tempDate)) {
                        dateObj = tempDate;
                    }
                 } catch (e) {
                    // Ignora o erro se o parse falhar
                 }
            }
        }

        // Se conseguimos um objeto Date válido, formata para YYYY-MM-DD
        if (dateObj instanceof Date && !isNaN(dateObj)) {
            const year = dateObj.getFullYear();
            // Verifica se o ano é razoável
            if (year < 1900) {
                 console.warn("formatDateForInput: Year seems invalid:", year, "Original input:", dateInput);
                 return '';
            }
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        console.warn("Could not format date for input:", dateInput);
        return ''; // Retorna vazio para formatos inválidos ou datas inválidas
    }


    // --- Date Calculation Helper ---
    function calculateDueDate(startDate, intervalValue, intervalType) {
        if (!startDate || isNaN(intervalValue) || intervalValue <= 0) return null;
        // Cria uma nova data baseada na data de início para evitar modificar a original
        // Garante que startDate seja um objeto Date
        const d = (startDate instanceof Date && !isNaN(startDate)) ? new Date(startDate) : null;

        // Retorna null se a data de início for inválida
        if (!d) {
            console.warn("calculateDueDate received an invalid start date:", startDate);
            return null;
        }

        const originalDay = d.getDate(); // Guarda o dia original

        if (intervalType === 'monthly') {
            d.setMonth(d.getMonth() + intervalValue);
            // Se o dia mudou (ex: Jan 31 + 1 mês = Feb 28/29), ajusta para o último dia do mês alvo
            if (d.getDate() !== originalDay) {
              // Volta para o dia 0 do *próximo* mês, que é o último dia do mês alvo
              d.setDate(0);
            }
        } else if (intervalType === 'weekly') {
            d.setDate(d.getDate() + (intervalValue * 7));
        } else {
            return null; // Tipo de intervalo inválido
        }
        d.setHours(0,0,0,0); // Zera a hora para comparação de data apenas
        return d;
    }


    // --- Dropdown Population ---
    function populateDropdown(selectElement, items, defaultText = 'Select...', valueKey = null, textKey = null) {
         selectElement.innerHTML = `<option value="">${defaultText}</option>`; // Limpa e adiciona opção padrão
        if (items && Array.isArray(items)) {
            items.sort((a, b) => {
                const textA = textKey ? (a[textKey] || '') : (a || '');
                const textB = textKey ? (b[textKey] || '') : (b || '');
                return textA.localeCompare(textB); // Ordenação alfabética
            }).forEach(item => {
                const value = valueKey ? (item[valueKey] || '') : (item || '');
                const text = textKey ? (item[textKey] || '') : (item || '');
                if (value) { // Só adiciona se tiver um valor
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = text;
                    selectElement.appendChild(option);
                }
            });
        }
    }

    // --- Set Today's Date ---
    function setTodaysDate() {
        const today = new Date();
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.value = formatDateForInput(today);
        }
     }


    // --- Configuration Management (API) ---
    async function loadIntervalConfig() {
        try {
            const response = await fetch('/api/get-maintenance-config');
            if (!response.ok) {
                 console.error('Failed to fetch config from server, status:', response.status);
                 showToast('Failed to load maintenance config, using defaults.', 'warning');
                 // Retorna uma cópia dos defaults se a API falhar
                 return JSON.parse(JSON.stringify(DEFAULT_INTERVALS));
            }
            const configFromServer = await response.json();

            // Mescla config do servidor com defaults para garantir que todas as chaves existam
            const mergedConfig = JSON.parse(JSON.stringify(DEFAULT_INTERVALS)); // Deep copy defaults

            for (const key in DEFAULT_INTERVALS) {
                if (configFromServer.hasOwnProperty(key)) {
                    // Se for um objeto aninhado (como tire_change), mescla internamente
                    if (typeof DEFAULT_INTERVALS[key] === 'object' && DEFAULT_INTERVALS[key] !== null && typeof configFromServer[key] === 'object' && configFromServer[key] !== null) {
                        let type = configFromServer[key].type === 'weekly' ? 'weekly' : 'monthly';
                        let value = parseInt(configFromServer[key].value, 10);
                        if(isNaN(value) || value < 1) value = DEFAULT_INTERVALS[key].value;
                        mergedConfig[key] = { type: type, value: value };
                    } else if (key === 'alert_threshold_days') {
                        // Valida o threshold
                        let threshold = parseInt(configFromServer[key], 10);
                         if(isNaN(threshold) || threshold < 0) threshold = DEFAULT_INTERVALS[key];
                         mergedConfig[key] = threshold;
                    }
                    // Ignora outras chaves que não sejam objetos nem o threshold (caso existam por erro)
                }
            }
            console.log("Loaded and merged config:", mergedConfig);
            return mergedConfig;

        } catch (e) {
            console.error("Error loading interval config via API:", e);
            showToast('Error loading maintenance config, using defaults.', 'error');
            return JSON.parse(JSON.stringify(DEFAULT_INTERVALS)); // Retorna cópia dos defaults
        }
    }

     async function saveIntervalConfig() {
        const newConfig = { };
        let isValid = true;
        configForm.querySelectorAll('[data-config-key]').forEach(el => {
            const keyPath = el.dataset.configKey;
            let value = el.value;

            if (el.type === 'number') {
                const numValue = parseInt(value, 10);
                const isThreshold = keyPath === 'alert_threshold_days';
                const minValue = isThreshold ? 0 : 1;
                if (isNaN(numValue) || numValue < minValue) {
                    const keys = keyPath.split('.');
                    let defaultValue = (keys.length === 2 && DEFAULT_INTERVALS[keys[0]]) ? DEFAULT_INTERVALS[keys[0]][keys[1]] : DEFAULT_INTERVALS[keyPath];
                    value = (defaultValue !== undefined) ? defaultValue : minValue;
                    el.value = value;
                    isValid = false;
                    showToast(`Invalid value for ${keyPath.replace(/_/g, ' ')}. Resetting to default.`, 'warning');
                } else {
                    value = numValue;
                }
            } else if (el.tagName === 'SELECT' && !value) {
                const keys = keyPath.split('.');
                let defaultValue = (keys.length === 2 && DEFAULT_INTERVALS[keys[0]]) ? DEFAULT_INTERVALS[keys[0]][keys[1]] : DEFAULT_INTERVALS[keyPath];
                value = defaultValue || 'monthly';
                el.value = value;
                isValid = false;
                showToast(`Invalid type for ${keyPath.replace(/_/g, ' ')}. Resetting to default.`, 'warning');
            }

            const keys = keyPath.split('.');
            if (keys.length === 2) {
                if (!newConfig[keys[0]]) newConfig[keys[0]] = {};
                newConfig[keys[0]][keys[1]] = value;
            } else {
                newConfig[keyPath] = value;
            }
        });

        console.log("Saving config:", newConfig);

        saveConfigBtn.disabled = true;
        saveConfigBtn.textContent = 'Saving...';

        try {
            const response = await fetch('/api/save-maintenance-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });

            const result = await response.json();

            if (result.success) {
                intervalConfig = newConfig; // Atualiza estado global
                showToast('Configuration saved successfully!', 'success');
                renderAlerts(allCostData); // Re-renderiza alertas
            } else {
                throw new Error(result.message || 'Failed to save configuration.');
            }
        } catch (e) {
            console.error("Error saving interval config via API:", e);
            showToast(`Failed to save configuration: ${e.message}`, 'error');
        } finally {
             saveConfigBtn.disabled = false;
             saveConfigBtn.textContent = 'Save Configuration';
        }
    }


    function populateConfigForm() {
        if (!configForm || !intervalConfig) return; // Garante que ambos existam
        configForm.querySelectorAll('[data-config-key]').forEach(el => {
            const keyPath = el.dataset.configKey;
            const keys = keyPath.split('.');
            let value;
            // Busca o valor na config carregada
            if (keys.length === 2) {
                value = intervalConfig[keys[0]] ? intervalConfig[keys[0]][keys[1]] : undefined;
            } else {
                value = intervalConfig[keyPath];
            }

            // Usa o default APENAS se o valor carregado for undefined
            if (value === undefined) {
                 let defaultValue;
                 if (keys.length === 2) {
                     defaultValue = DEFAULT_INTERVALS[keys[0]] ? DEFAULT_INTERVALS[keys[0]][keys[1]] : undefined;
                 } else {
                     defaultValue = DEFAULT_INTERVALS[keyPath];
                 }
                 value = defaultValue;
            }

            // Fallback final
             if (value === undefined) {
                if (el.tagName === 'SELECT') value = 'monthly';
                else if (el.type === 'number') value = keyPath === 'alert_threshold_days' ? 0 : 1;
                else value = '';
            }

            el.value = value;
        });
    }

    // --- Fetch Initial Data ---
    async function fetchInitialData() {
        costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center">Loading initial data...</td></tr>';
        alertsContent.innerHTML = '<p class="text-muted-foreground">Loading alerts...</p>';
        try {
            // Config já foi carregada em initializePage()

            const [techCarsResponse, costResponse] = await Promise.all([
                fetch('/api/get-tech-cars-data'),
                fetch('/api/get-cost-control-data')
            ]);

            // Trata TechCars
            if (!techCarsResponse.ok) {
                let errorMsg = 'Failed to load technician/car list.';
                try { const errorJson = await techCarsResponse.json(); errorMsg = errorJson.error || errorJson.message || errorMsg; } catch(e){ errorMsg = `Status: ${techCarsResponse.status}`; }
                throw new Error(errorMsg);
            }
            const techCarsResult = await techCarsResponse.json();
            techCarsData = techCarsResult.techCars || [];
            populateDropdown(technicianSelect, techCarsData, 'Select Technician...', 'tech_name', 'tech_name');
            populateDropdown(filterTechnicianSelect, techCarsData, 'All Technicians', 'tech_name', 'tech_name');

            // Trata Custos
            if (!costResponse.ok) {
                let errorMsg = 'Failed to load cost control data.';
                try { const errorJson = await costResponse.json(); errorMsg = errorJson.error || errorJson.message || errorMsg; } catch(e){ errorMsg = `Status: ${costResponse.status}`; }
                throw new Error(errorMsg);
            }
            const costDataResult = await costResponse.json();
            // Filtra registros sem data válida ANTES de usar
            allCostData = (costDataResult.costs || []).filter(record => record.date && formatDateForInput(record.date));

            // Não renderiza tabela inicialmente
            costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>';
            renderAlerts(allCostData); // Renderiza alertas com a config

        } catch (error) {
            console.error('Error fetching initial data:', error);
            showToast(`Error loading data: ${error.message}`, 'error');
            costControlTableBody.innerHTML = `<tr><td colspan="15" class="p-4 text-center text-red-600">Failed to load data. ${error.message}</td></tr>`;
            alertsContent.innerHTML = `<p class="text-destructive">Failed to load alert data: ${error.message}</p>`;
            // Desabilita dropdowns se falhar
            if (technicianSelect) { technicianSelect.disabled = true; populateDropdown(technicianSelect, [], 'Error loading'); }
            if (filterTechnicianSelect) { filterTechnicianSelect.disabled = true; populateDropdown(filterTechnicianSelect, [], 'Error loading'); }
        }
    }


    // --- Table Rendering ---
    function renderTable(data) {
        costControlTableBody.innerHTML = '';
        if (!Array.isArray(data) || data.length === 0) {
            if (listingSection.classList.contains('hidden')) {
                costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>';
            } else {
                costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-muted-foreground">No maintenance records found matching your filters.</td></tr>';
            }
            return;
        }

        const sortedData = data.sort((a, b) => {
             const dateAStr = formatDateForInput(a.date);
             const dateBStr = formatDateForInput(b.date);
             if (!dateAStr && !dateBStr) return 0;
             if (!dateAStr) return 1;
             if (!dateBStr) return -1;
             const dateA = new Date(dateAStr);
             const dateB = new Date(dateBStr);
             return dateB.getTime() - dateA.getTime();
        });

        sortedData.forEach(record => {
            const row = document.createElement('tr');
            row.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            const isChecked = (value) => value && String(value).toUpperCase() === 'TRUE' ? '✔️' : '❌';
            const priceValue = parseFloat(record.price);
            const descriptionFull = record.description || '';
            const descriptionShort = descriptionFull.length > 30 ? descriptionFull.substring(0, 30) + '...' : descriptionFull;

            row.innerHTML = `
                <td class="p-4 whitespace-nowrap">${formatDateForDisplay(record.date)}</td>
                <td class="p-4">${record.license_plate || ''}</td>
                <td class="p-4">${record.odometer || ''}</td>
                <td class="p-4">${record.cost_type || ''}</td>
                <td class="p-4">${record.subtype || ''}</td>
                <td class="p-4">${record.technician || ''}</td>
                <td class="p-4 text-right">${!isNaN(priceValue) ? `$${priceValue.toFixed(2)}` : ''}</td>
                <td class="p-4 max-w-[200px] truncate" title="${descriptionFull}">${descriptionShort}</td>
                <td class="p-4 max-w-[150px] truncate" title="${record.business_name || ''}">${record.business_name || ''}</td>
                <td class="p-4">${record.invoice_number || ''}</td>
                <td class="p-4 text-center">${isChecked(record.tire_change)}</td>
                <td class="p-4 text-center">${isChecked(record.oil_and_filter_change)}</td>
                <td class="p-4 text-center">${isChecked(record.brake_change)}</td>
                <td class="p-4 text-center">${isChecked(record.battery_change)}</td>
                <td class="p-4 text-center">${isChecked(record.air_filter_change)}</td>
            `;
            costControlTableBody.appendChild(row);
        });
    }

    // --- Alert Logic ---
    function renderAlerts(data) {
        alertsContent.innerHTML = ''; // Limpa alertas
        let hasAnyAlerts = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Zera hora

        // Usa o valor da config global 'intervalConfig'
        const alertThresholdDays = parseInt(intervalConfig.alert_threshold_days, 10);
        const validThresholdDays = (!isNaN(alertThresholdDays) && alertThresholdDays >= 0) ? alertThresholdDays : DEFAULT_INTERVALS.alert_threshold_days;

        const alertThresholdDate = new Date(today);
        alertThresholdDate.setDate(today.getDate() + validThresholdDays);

        const vehicleData = {};

        // 1. Agrupa registros válidos por placa
        data.forEach(record => {
            if (record.license_plate) {
                const plate = record.license_plate.toUpperCase().trim();
                const recordDateStr = formatDateForInput(record.date); // Garante YYYY-MM-DD
                const recordDate = recordDateStr ? new Date(recordDateStr + "T00:00:00") : null;

                if (!recordDate || isNaN(recordDate)) return; // Pula se data inválida

                if (!vehicleData[plate]) vehicleData[plate] = [];
                vehicleData[plate].push({
                    date: recordDate,
                    tire_change: String(record.tire_change).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record.oil_and_filter_change).toUpperCase() === 'TRUE',
                    brake_change: String(record.brake_change).toUpperCase() === 'TRUE',
                    battery_change: String(record.battery_change).toUpperCase() === 'TRUE',
                    air_filter_change: String(record.air_filter_change).toUpperCase() === 'TRUE',
                    cost_type: record.cost_type,
                    subtype: record.subtype
                });
            }
        });

        // 2. Processa cada veículo
        for (const plate in vehicleData) {
            const records = vehicleData[plate].sort((a, b) => b.date.getTime() - a.date.getTime());
            if (records.length === 0) continue;

            let vehicleAlertMessages = [];
            let highestSeverity = 'info';

            // Verifica cada categoria
            for (const key in MAINTENANCE_CATEGORIES) {
                const config = intervalConfig[key];
                 // Pula se config inválida
                if (!config || !config.type || isNaN(config.value) || config.value <= 0) continue;

                let lastRecord;
                 if (key === 'other') {
                    lastRecord = records.find(r =>
                        (r.cost_type === 'Maintenance' || r.cost_type === 'Repair') &&
                        !r.tire_change && !r.oil_and_filter_change && !r.brake_change && !r.battery_change && !r.air_filter_change
                    );
                 } else {
                     lastRecord = records.find(r => r[key] === true);
                 }

                const categoryName = MAINTENANCE_CATEGORIES[key];

                if (lastRecord) {
                    // Passa o objeto Date diretamente
                    const dueDate = calculateDueDate(lastRecord.date, config.value, config.type);

                    if (dueDate && !isNaN(dueDate)) { // Verifica se dueDate é válido
                        if (dueDate <= today) { // Vencido
                            // Passa o objeto Date para formatDateForDisplay
                            vehicleAlertMessages.push(`${categoryName} due (Last: ${formatDateForDisplay(lastRecord.date)})`);
                            highestSeverity = 'error';
                        } else if (dueDate <= alertThresholdDate) { // Próximo
                            // Passa o objeto Date para formatDateForDisplay
                            vehicleAlertMessages.push(`${categoryName} soon (Due: ${formatDateForDisplay(dueDate)})`);
                            if (highestSeverity !== 'error') highestSeverity = 'warning';
                        }
                    } else {
                         console.warn(`Could not calculate due date for ${categoryName} on vehicle ${plate}. Last record date: ${lastRecord.date}`);
                    }
                } else {
                    if (key !== 'other') {
                        vehicleAlertMessages.push(`No ${categoryName} record found`);
                    }
                }
            } // Fim loop categorias

            // 3. Cria alerta se houver mensagens
            if (vehicleAlertMessages.length > 0) {
                createAlert(plate, vehicleAlertMessages, highestSeverity);
                hasAnyAlerts = true;
            }
        } // Fim loop veículos

        if (!hasAnyAlerts) {
            alertsContent.innerHTML = '<p class="text-muted-foreground">No immediate maintenance alerts found based on configured intervals.</p>';
        }
    }


    // Create Alert HTML (CORRIGIDO: Removeu comentários que apareciam no HTML)
    function createAlert(plate, messages, type) {
        const alertDiv = document.createElement('div');
        let borderColor = 'border-border';
        let bgColor = 'bg-muted/10';
        let title = 'Info';
        let titleColor = 'text-foreground';

        if (type === 'warning') {
            borderColor = 'border-yellow-500';
            bgColor = 'bg-yellow-500/10';
            title = 'Warning';
            titleColor = 'text-yellow-700 dark:text-yellow-300';
        } else if (type === 'error') {
            borderColor = 'border-destructive';
            bgColor = 'bg-destructive/10';
            title = 'Alert / Due';
            titleColor = 'text-destructive';
        }

       alertDiv.className = `p-3 border ${borderColor} rounded-lg ${bgColor} mb-2`;
       const messageString = messages.join(' • ');

       // Removeu os comentários {/**/} daqui
       alertDiv.innerHTML = `
           <div class="flex justify-between items-center">
                <span class="font-semibold text-sm ${titleColor}">${title}: Vehicle ${plate}</span>
           </div>
           <p class="text-xs text-foreground mt-1">${messageString}</p>
       `;
       alertsContent.appendChild(alertDiv);
    }

    // --- Autofill Logic ---
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

    // --- Form Submission ---
    costControlForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(costControlForm);
        const data = {};

        formData.forEach((value, key) => {
            if (key === 'price' && typeof value === 'string') {
                data[key] = value.replace(',', '.');
            } else {
                data[key] = value;
            }
        });

        data['vin'] = vinInput.value;
        data['license_plate'] = licensePlateInput.value;

        ['tire_change', 'oil_and_filter_change', 'brake_change', 'battery_change', 'air_filter_change'].forEach(key => {
            data[key] = formData.has(key) ? 'TRUE' : 'FALSE';
        });

        // Validações
        if (!data.technician) { showToast('Please select a Technician (Driver).', 'error'); return; }
        if (!data.license_plate || !data.vin) { showToast('VIN and License Plate must be autofilled by selecting a Technician.', 'error'); return; }
        if (!data.date || !data.odometer || !data.cost_type || data.price === undefined || data.price === '') { // Verificação mais robusta para preço
             showToast('Date, Odometer, Cost Type, and Price are required.', 'error');
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

            if (!response.ok) {
                let errorText = `Server responded with status: ${response.status}`;
                try { const errorResult = await response.json(); errorText = errorResult.message || errorText; } catch(e) {}
                 console.error("API Error Response:", await response.text());
                 throw new Error(`Failed to save record. ${errorText}`);
            }

            const result = await response.json();

            if (result.success) {
                showToast('Record saved successfully!', 'success');
                costControlForm.reset();
                setTodaysDate();
                vinInput.value = '';
                licensePlateInput.value = '';
                // Recarrega todos os dados
                await initializePage(); // Chama a função principal de inicialização
            } else {
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

    // --- History Search Logic ---
    searchHistoryBtn.addEventListener('click', () => {
        const startDateStr = filterStartDateInput.value;
        const endDateStr = filterEndDateInput.value;
        const techName = filterTechnicianSelect.value;
        const plate = filterLicensePlateInput.value.trim().toLowerCase();

        const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;
        const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : null;

        const filteredData = allCostData.filter(record => {
            const recordDateStr = formatDateForInput(record.date); // YYYY-MM-DD
            const recordDate = recordDateStr ? new Date(recordDateStr + 'T00:00:00') : null;

            if (!recordDate || isNaN(recordDate)) return false;

            const matchesDate =
                (!startDate || recordDate >= startDate) &&
                (!endDate || recordDate <= endDate);
            const matchesTech = !techName || (record.technician && record.technician === techName);
            const matchesPlate = !plate || (record.license_plate && record.license_plate.toLowerCase().includes(plate));

            return matchesDate && matchesTech && matchesPlate;
        });

        listingSection.classList.remove('hidden');
        renderTable(filteredData);
    });


    // --- Event Listeners ---
    if (technicianSelect) { technicianSelect.addEventListener('change', handleTechnicianChange); }
    if (saveConfigBtn) { saveConfigBtn.addEventListener('click', saveIntervalConfig); }

    // --- Initialization ---
    async function initializePage() {
        setTodaysDate();
        await fetchInitialData(); // Carrega config da API, popula form, busca dados, renderiza alertas
    }

    initializePage(); // Inicia a página

});
