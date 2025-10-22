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
    function formatDateForDisplay(dateStr) {
        if (!dateStr) return '';
        // Tenta detectar se já está em MM/DD/YYYY
        if (dateStr.includes('/') && !dateStr.includes('-')) {
             const parts = dateStr.split('/');
             // Verifica se o ano tem 4 dígitos
             if (parts.length === 3 && parts[2] && parts[2].length === 4) return dateStr;
        }
        // Assume YYYY-MM-DD
        const [year, month, day] = dateStr.split('-');
        if (year && month && day && year.length === 4) {
            return `${month}/${day}/${year}`;
        }
        // Tenta analisar se é uma string de data JS (menos comum vindo da planilha)
        try {
            const d = new Date(dateStr);
            if (!isNaN(d)) {
                 const y = d.getFullYear();
                 const m = String(d.getMonth() + 1).padStart(2, '0');
                 const dy = String(d.getDate()).padStart(2, '0');
                 // Garante que o ano seja válido
                 if (y > 1900) return `${m}/${dy}/${y}`;
            }
        } catch(e){}

        console.warn("Could not format date for display:", dateStr)
        return dateStr; // Retorna original se não conseguir formatar
    }

    function formatDateForInput(dateInput) {
        if (!dateInput) return '';
        let dateObj;
        if (dateInput instanceof Date) {
            dateObj = dateInput;
        } else if (typeof dateInput === 'string') {
            // Verifica MM/DD/YYYY
            if (dateInput.includes('/') && !dateInput.includes('T')) {
                 const parts = dateInput.split('/');
                 if (parts.length === 3 && parts[2] && parts[2].length === 4) {
                     // Month is 0-indexed for Date constructor
                     dateObj = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
                 }
            // Verifica YYYY-MM-DD (já no formato correto)
            } else if (dateInput.includes('-') && !dateInput.includes('T')) {
                 const parts = dateInput.split('-');
                 if (parts.length === 3 && parts[0].length === 4) {
                     // Cria um objeto Date para validar, mas retorna a string original se válida
                     const tempDate = new Date(dateInput + "T00:00:00"); // Adiciona T00:00:00 para evitar timezone shift
                     if (!isNaN(tempDate)) {
                         return dateInput; // Retorna como está se válido YYYY-MM-DD
                     }
                 }
            }
             // Tenta analisar outros formatos de string de data comuns
             else {
                try {
                    dateObj = new Date(dateInput);
                 } catch (e) {
                    console.warn("Could not parse date string for input:", dateInput);
                    return ''; // Retorna vazio se o parse falhar
                 }
            }
        }

        // Se conseguimos um objeto Date válido, formata para YYYY-MM-DD
        if (dateObj instanceof Date && !isNaN(dateObj)) {
            const year = dateObj.getFullYear();
            // Verifica se o ano é razoável
            if (year < 1900) {
                 console.warn("Year seems invalid:", year, "Original input:", dateInput);
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
        const d = new Date(startDate);
        // Garante que estamos lidando com um objeto Date válido
        if (isNaN(d.getTime())) return null;

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
        d.setHours(0,0,0,0); // Zera a hora para comparação
        return d;
    }


    // --- Dropdown Population ---
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

    // --- Set Today's Date ---
    function setTodaysDate() {
        const today = new Date();
        const dateInput = document.getElementById('date');
        if (dateInput) {
            // Formata o objeto Date para YYYY-MM-DD
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
                 return { ...DEFAULT_INTERVALS };
            }
            const configFromServer = await response.json();

            // Mescla config do servidor com defaults para garantir que todas as chaves existam
            const mergedConfig = { ...DEFAULT_INTERVALS };

            // Itera sobre as chaves do DEFAULT_INTERVALS para garantir a estrutura correta
            for (const key in DEFAULT_INTERVALS) {
                if (configFromServer.hasOwnProperty(key)) {
                    // Se for um objeto aninhado (como tire_change), mescla internamente
                    if (typeof DEFAULT_INTERVALS[key] === 'object' && DEFAULT_INTERVALS[key] !== null && typeof configFromServer[key] === 'object' && configFromServer[key] !== null) {
                        // Garante que 'type' e 'value' existam e sejam válidos
                        let type = configFromServer[key].type === 'weekly' ? 'weekly' : 'monthly';
                        let value = parseInt(configFromServer[key].value, 10);
                        if(isNaN(value) || value < 1) value = DEFAULT_INTERVALS[key].value;
                        mergedConfig[key] = { type: type, value: value };
                    } else if (key === 'alert_threshold_days') {
                        // Valida o threshold
                        let threshold = parseInt(configFromServer[key], 10);
                         if(isNaN(threshold) || threshold < 0) threshold = DEFAULT_INTERVALS[key];
                         mergedConfig[key] = threshold;
                    } else {
                         // Para outras chaves diretas (se houver no futuro)
                         mergedConfig[key] = configFromServer[key];
                    }
                }
                // Se a chave não existir no servidor, o valor padrão já está em mergedConfig
            }
             console.log("Loaded and merged config:", mergedConfig); // Debug log
            return mergedConfig;

        } catch (e) {
            console.error("Error loading interval config via API:", e);
            showToast('Error loading maintenance config, using defaults.', 'error');
            return { ...DEFAULT_INTERVALS }; // Retorna defaults em caso de erro de fetch/parse
        }
    }

    async function saveIntervalConfig() {
        const newConfig = { }; // Começa com objeto vazio
        let isValid = true;
        // Lê os valores atuais do formulário
        configForm.querySelectorAll('[data-config-key]').forEach(el => {
            const keyPath = el.dataset.configKey;
            let value = el.value;

            // Validações básicas
            if (el.type === 'number') {
                const numValue = parseInt(value, 10);
                if (isNaN(numValue) || numValue < (keyPath === 'alert_threshold_days' ? 0 : 1) ) {
                    // Se inválido, busca o default para aquela chave específica
                    const keys = keyPath.split('.');
                    let defaultValue = (keys.length === 2 && DEFAULT_INTERVALS[keys[0]]) ? DEFAULT_INTERVALS[keys[0]][keys[1]] : DEFAULT_INTERVALS[keyPath];
                    if (defaultValue === undefined) defaultValue = (keyPath === 'alert_threshold_days' ? 0 : 1); // Último recurso
                    value = defaultValue;
                    el.value = value; // Corrige no formulário
                    isValid = false; // Marca como inválido para alertar
                     showToast(`Invalid value for ${keyPath.replace('_', ' ')}. Resetting to default.`, 'warning');
                } else {
                    value = numValue; // Usa o valor numérico validado
                }
            } else if (el.tagName === 'SELECT') {
                if (!value) { // Caso o select esteja vazio por algum motivo
                     const keys = keyPath.split('.');
                     let defaultValue = (keys.length === 2 && DEFAULT_INTERVALS[keys[0]]) ? DEFAULT_INTERVALS[keys[0]][keys[1]] : DEFAULT_INTERVALS[keyPath];
                     if (!defaultValue) defaultValue = 'monthly'; // Default genérico
                     value = defaultValue;
                     el.value = value;
                     isValid = false;
                     showToast(`Invalid type for ${keyPath.replace('_', ' ')}. Resetting to default.`, 'warning');
                }
            }


            const keys = keyPath.split('.');
            if (keys.length === 2) {
                if (!newConfig[keys[0]]) newConfig[keys[0]] = {};
                newConfig[keys[0]][keys[1]] = value;
            } else {
                newConfig[keyPath] = value;
            }
        });

         if (!isValid) {
            showToast('Some configuration values were invalid and reset to defaults. Please review and save again if needed.', 'warning');
            // Não impede o salvamento, mas avisa o usuário
        }

        console.log("Saving config:", newConfig); // Debug log

        // Desabilita botão enquanto salva
        saveConfigBtn.disabled = true;
        saveConfigBtn.textContent = 'Saving...';

        try {
            const response = await fetch('/api/save-maintenance-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig) // Envia o objeto JSON para a API
            });

            const result = await response.json();

            if (result.success) {
                intervalConfig = newConfig; // Atualiza o estado global
                showToast('Configuration saved successfully!', 'success');
                renderAlerts(allCostData); // Re-renderiza alertas com a nova config
            } else {
                throw new Error(result.message || 'Failed to save configuration.');
            }
        } catch (e) {
            console.error("Error saving interval config via API:", e);
            showToast(`Failed to save configuration: ${e.message}`, 'error');
        } finally {
             // Reabilita o botão
             saveConfigBtn.disabled = false;
             saveConfigBtn.textContent = 'Save Configuration';
        }
    }


    function populateConfigForm() {
        if (!configForm) return;
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

            // Busca o valor default se não encontrar na config carregada
            let defaultValue;
            if (value === undefined) {
                if (keys.length === 2) {
                     defaultValue = DEFAULT_INTERVALS[keys[0]] ? DEFAULT_INTERVALS[keys[0]][keys[1]] : undefined;
                } else {
                     defaultValue = DEFAULT_INTERVALS[keyPath];
                }
                value = defaultValue; // Usa o default se carregado for undefined
            }

            // Garante um fallback final se nem carregado nem default existirem
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
            // Carrega a configuração ANTES de buscar os outros dados
            intervalConfig = await loadIntervalConfig();
            populateConfigForm(); // Popula o form com a config carregada/mesclada

            const [techCarsResponse, costResponse] = await Promise.all([
                fetch('/api/get-tech-cars-data'),
                fetch('/api/get-cost-control-data')
            ]);

            if (!techCarsResponse.ok) {
                let errorMsg = 'Failed to load technician/car list.';
                try { const errorJson = await techCarsResponse.json(); errorMsg = errorJson.error || errorJson.message || errorMsg; } catch(e){ errorMsg = `Status: ${techCarsResponse.status}`; }
                throw new Error(errorMsg);
            }
            const techCarsResult = await techCarsResponse.json();
            techCarsData = techCarsResult.techCars || [];
            populateDropdown(technicianSelect, techCarsData, 'Select Technician...', 'tech_name', 'tech_name');
            populateDropdown(filterTechnicianSelect, techCarsData, 'All Technicians', 'tech_name', 'tech_name');

            if (!costResponse.ok) {
                let errorMsg = 'Failed to load cost control data.';
                try { const errorJson = await costResponse.json(); errorMsg = errorJson.error || errorJson.message || errorMsg; } catch(e){ errorMsg = `Status: ${costResponse.status}`; }
                throw new Error(errorMsg);
            }
            const costDataResult = await costResponse.json();
            allCostData = (costDataResult.costs || []).filter(record => record.date && formatDateForInput(record.date));

            // Não renderiza a tabela inicialmente
            costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>';
            renderAlerts(allCostData); // Renderiza alertas com a config carregada

        } catch (error) {
            console.error('Error fetching initial data:', error);
            showToast(`Error loading data: ${error.message}`, 'error');
            costControlTableBody.innerHTML = `<tr><td colspan="15" class="p-4 text-center text-red-600">Failed to load data. ${error.message}</td></tr>`;
            alertsContent.innerHTML = `<p class="text-destructive">Failed to load alert data: ${error.message}</p>`;
            if (technicianSelect) { technicianSelect.disabled = true; populateDropdown(technicianSelect, [], 'Error loading'); }
            if (filterTechnicianSelect) { filterTechnicianSelect.disabled = true; populateDropdown(filterTechnicianSelect, [], 'Error loading'); }
        }
    }


    // --- Table Rendering (Now accepts filtered data) ---
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

        // Ordena por data (mais recente primeiro) ANTES de exibir
        const sortedData = data.sort((a, b) => {
             const dateAStr = formatDateForInput(a.date);
             const dateBStr = formatDateForInput(b.date);
             // Coloca datas inválidas no final
             if (!dateAStr && !dateBStr) return 0;
             if (!dateAStr) return 1;
             if (!dateBStr) return -1;
             // Compara datas válidas
             const dateA = new Date(dateAStr);
             const dateB = new Date(dateBStr);
             return dateB.getTime() - dateA.getTime(); // Mais recente primeiro
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

    // --- Alert Logic (Using Config, Grouped by Vehicle) ---
    function renderAlerts(data) {
        alertsContent.innerHTML = '';
        let hasAnyAlerts = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alertThresholdDays = parseInt(intervalConfig.alert_threshold_days, 10);
        // Garante que alertThresholdDays seja um número válido >= 0
        const validThresholdDays = (!isNaN(alertThresholdDays) && alertThresholdDays >= 0) ? alertThresholdDays : DEFAULT_INTERVALS.alert_threshold_days;

        const alertThresholdDate = new Date(today);
        alertThresholdDate.setDate(today.getDate() + validThresholdDays);

        const vehicleData = {};

        // 1. Agrupa registros válidos por placa
        data.forEach(record => {
            if (record.license_plate) {
                const plate = record.license_plate.toUpperCase().trim();
                const recordDateStr = formatDateForInput(record.date); // Garante YYYY-MM-DD
                const recordDate = recordDateStr ? new Date(recordDateStr + "T00:00:00") : null; // Adiciona T00:00:00

                // Ignora registros sem data válida
                if (!recordDate || isNaN(recordDate)) return;

                if (!vehicleData[plate]) vehicleData[plate] = [];

                // Armazena informações relevantes, incluindo as novas flags
                vehicleData[plate].push({
                    date: recordDate,
                    tire_change: String(record.tire_change).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record.oil_and_filter_change).toUpperCase() === 'TRUE',
                    brake_change: String(record.brake_change).toUpperCase() === 'TRUE',
                    battery_change: String(record.battery_change).toUpperCase() === 'TRUE',
                    air_filter_change: String(record.air_filter_change).toUpperCase() === 'TRUE',
                    cost_type: record.cost_type,
                    subtype: record.subtype // Pode ser útil para 'Other'
                });
            }
        });

        // 2. Processa cada veículo
        for (const plate in vehicleData) {
            const records = vehicleData[plate].sort((a, b) => b.date.getTime() - a.date.getTime()); // Mais recente primeiro
            if (records.length === 0) continue;

            let vehicleAlertMessages = [];
            let highestSeverity = 'info'; // 'info', 'warning', 'error'

            // Verifica cada categoria de manutenção configurada
            for (const key in MAINTENANCE_CATEGORIES) {
                const config = intervalConfig[key];
                 // Pula se a configuração para esta chave não existir ou for inválida
                if (!config || !config.type || isNaN(config.value) || config.value <= 0) {
                     console.warn(`Invalid or missing config for ${key}. Skipping alert check.`);
                     continue;
                 }

                let lastRecord;
                 // Encontra o último registro onde este serviço específico foi realizado
                 if (key === 'other') {
                    // Para 'Other', procura pelo último 'Maintenance' ou 'Repair' que não seja um dos específicos
                    lastRecord = records.find(r =>
                        (r.cost_type === 'Maintenance' || r.cost_type === 'Repair') &&
                        !r.tire_change && !r.oil_and_filter_change && !r.brake_change && !r.battery_change && !r.air_filter_change
                    );
                 } else {
                    // Para tipos específicos (ex: 'tire_change'), procura pelo último onde a flag correspondente é true
                     lastRecord = records.find(r => r[key] === true);
                 }

                const categoryName = MAINTENANCE_CATEGORIES[key];

                if (lastRecord) {
                    const dueDate = calculateDueDate(lastRecord.date, config.value, config.type);

                    // Verifica se dueDate é uma data válida antes de comparar
                    if (dueDate && !isNaN(dueDate)) {
                        if (dueDate <= today) { // Vencido
                            vehicleAlertMessages.push(`${categoryName} due (Last: ${formatDateForDisplay(lastRecord.date)})`);
                            highestSeverity = 'error'; // Prioridade máxima
                        } else if (dueDate <= alertThresholdDate) { // Próximo do vencimento
                            vehicleAlertMessages.push(`${categoryName} soon (Due: ${formatDateForDisplay(dueDate)})`);
                            // Define como warning apenas se não houver um erro mais grave
                            if (highestSeverity !== 'error') highestSeverity = 'warning';
                        }
                    } else {
                         console.warn(`Could not calculate due date for ${categoryName} on vehicle ${plate}. Last record date: ${lastRecord.date}`);
                    }
                } else {
                    // Adiciona "no record found" apenas para os tipos específicos, não para 'Other'
                    if (key !== 'other') {
                        vehicleAlertMessages.push(`No ${categoryName} record found`);
                        // Mantém 'info' como severidade padrão se não houver outros alertas mais graves
                    }
                }
            } // Fim do loop pelas categorias

            // 3. Cria um único bloco de alerta para o veículo, se houver mensagens
            if (vehicleAlertMessages.length > 0) {
                createAlert(plate, vehicleAlertMessages, highestSeverity);
                hasAnyAlerts = true; // Marca que pelo menos um alerta foi gerado
            }
        } // Fim do loop pelos veículos

        // 4. Exibe mensagem se nenhum alerta foi gerado
        if (!hasAnyAlerts) {
            alertsContent.innerHTML = '<p class="text-muted-foreground">No immediate maintenance alerts found based on configured intervals.</p>';
        }
    }


    // Create Alert HTML (Mantém o estilo compacto)
    function createAlert(plate, messages, type) {
        const alertDiv = document.createElement('div');
        let borderColor = 'border-border'; // Cor padrão para 'info' e 'no record'
        let bgColor = 'bg-muted/10';
        let title = 'Info';
        let titleColor = 'text-foreground'; // Cor padrão

        if (type === 'warning') {
            borderColor = 'border-yellow-500';
            bgColor = 'bg-yellow-500/10';
            title = 'Warning';
            titleColor = 'text-yellow-700 dark:text-yellow-300';
        } else if (type === 'error') {
            borderColor = 'border-destructive'; // Cor do tema para erro
            bgColor = 'bg-destructive/10';
            title = 'Alert / Due'; // Título mais claro para erro
            titleColor = 'text-destructive';
        }

       // Estilo mais compacto
       alertDiv.className = `p-3 border ${borderColor} rounded-lg ${bgColor} mb-2`;

       // Cria string única com mensagens separadas por " • "
       const messageString = messages.join(' • ');

       alertDiv.innerHTML = `
           <div class="flex justify-between items-center">
                {/* Título com cor baseada na severidade */}
                <span class="font-semibold text-sm ${titleColor}">${title}: Vehicle ${plate}</span>
           </div>
           {/* Mensagens com cor padrão */}
           <p class="text-xs text-foreground mt-1">${messageString}</p>
       `;
       alertsContent.appendChild(alertDiv);
    }

    // --- Autofill Logic ---
    function handleTechnicianChange() {
        const selectedTechName = technicianSelect.value;
        // Tenta encontrar dados do técnico na lista carregada
        const selectedTechData = techCarsData.find(tech => tech.tech_name === selectedTechName);

        if (selectedTechData) {
            // Preenche VIN e Placa se encontrados
            vinInput.value = selectedTechData.vin_number || '';
            licensePlateInput.value = selectedTechData.car_plate || '';
        } else {
            // Limpa os campos se o técnico não for encontrado ou "Select..." for escolhido
            vinInput.value = '';
            licensePlateInput.value = '';
        }
    }

    // --- Form Submission ---
    costControlForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o envio padrão do formulário
        const formData = new FormData(costControlForm);
        const data = {};

        // Coleta dados do formulário
        formData.forEach((value, key) => {
            if (key === 'price' && typeof value === 'string') {
                // Substitui vírgula por ponto ANTES de enviar
                data[key] = value.replace(',', '.');
            } else {
                data[key] = value;
            }
        });

        // Adiciona VIN e Placa (que são readonly e podem não estar no FormData)
        data['vin'] = vinInput.value;
        data['license_plate'] = licensePlateInput.value;

        // Garante valor 'TRUE' ou 'FALSE' para checkboxes, incluindo os novos
        ['tire_change', 'oil_and_filter_change', 'brake_change', 'battery_change', 'air_filter_change'].forEach(key => {
            data[key] = formData.has(key) ? 'TRUE' : 'FALSE';
        });

        // Validações Essenciais
        if (!data.technician) {
            showToast('Please select a Technician (Driver).', 'error');
            return; // Impede o envio
        }
        if (!data.license_plate || !data.vin) {
            showToast('VIN and License Plate must be autofilled by selecting a Technician.', 'error');
            return;
        }
        if (!data.date || !data.odometer || !data.cost_type || !data.price) {
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

            // Tratamento de erro melhorado
            if (!response.ok) {
                let errorText = `Server responded with status: ${response.status}`;
                try {
                    const errorResult = await response.json();
                    errorText = errorResult.message || errorText;
                } catch(e) { /* Ignora erro de parse do JSON de erro */ }
                 console.error("API Error Response:", await response.text()); // Loga a resposta completa se possível
                 throw new Error(`Failed to save record. ${errorText}`);
            }

            const result = await response.json();

            if (result.success) {
                showToast('Record saved successfully!', 'success');
                costControlForm.reset(); // Limpa o formulário
                setTodaysDate(); // Define data novamente
                vinInput.value = ''; // Limpa campos autofill
                licensePlateInput.value = ''; // Limpa campos autofill
                // Recarrega todos os dados para atualizar a lista e os alertas
                await fetchInitialData();
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

    // --- History Search Logic ---
    searchHistoryBtn.addEventListener('click', () => {
        const startDateStr = filterStartDateInput.value;
        const endDateStr = filterEndDateInput.value;
        const techName = filterTechnicianSelect.value;
        const plate = filterLicensePlateInput.value.trim().toLowerCase();

        // Converte datas do filtro para objetos Date para comparação
        // Adiciona T00:00:00 e T23:59:59 para incluir o dia inteiro
        const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;
        const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : null;

        const filteredData = allCostData.filter(record => {
            // Converte data do registro para objeto Date
            const recordDateStr = formatDateForInput(record.date); // Garante YYYY-MM-DD
            // Adiciona T00:00:00 para consistência na comparação
            const recordDate = recordDateStr ? new Date(recordDateStr + 'T00:00:00') : null;

            // Se a data do registro for inválida, não inclui no resultado
            if (!recordDate || isNaN(recordDate)) return false;

            // Verifica se a data está dentro do range (se os filtros de data foram definidos)
            const matchesDate =
                (!startDate || recordDate >= startDate) &&
                (!endDate || recordDate <= endDate);

            // Verifica se o técnico corresponde (se um técnico foi selecionado)
            const matchesTech = !techName || (record.technician && record.technician === techName);

            // Verifica se a placa corresponde (case-insensitive, partial match)
            const matchesPlate = !plate || (record.license_plate && record.license_plate.toLowerCase().includes(plate));

            // Retorna true apenas se TODAS as condições ativas forem atendidas
            return matchesDate && matchesTech && matchesPlate;
        });

        // Mostra a seção de histórico e renderiza a tabela com os dados filtrados
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
