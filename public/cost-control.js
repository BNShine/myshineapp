// public/cost-control.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Seletores dos Elementos do DOM ---
    const costControlForm = document.getElementById('cost-control-form');
    const costControlTableBody = document.getElementById('cost-control-table-body');
    const technicianSelect = document.getElementById('technician'); // Dropdown no formulário de registro
    const licensePlateInput = document.getElementById('license_plate'); // Input Placa no formulário de registro
    const vinInput = document.getElementById('vin'); // Input VIN no formulário de registro
    const alertsContent = document.getElementById('alerts-content'); // Div para exibir alertas
    const toastContainer = document.getElementById('toast-container'); // Container para notificações

    // Seletores do Formulário de Configuração
    const configForm = document.getElementById('config-form');
    const saveConfigButton = document.getElementById('save-config-btn');

    // Seletores dos Filtros de Histórico
    const filterHistorySection = document.getElementById('filter-history-section');
    const filterStartDateInput = document.getElementById('filter-start-date');
    const filterEndDateInput = document.getElementById('filter-end-date');
    const filterTechnicianSelect = document.getElementById('filter-technician'); // Dropdown no filtro de histórico
    const filterLicensePlateInput = document.getElementById('filter-license-plate');
    const searchHistoryButton = document.getElementById('search-history-btn');
    const listingSection = document.getElementById('listing-section'); // Seção da tabela de histórico

    // --- Variáveis Globais de Estado ---
    let allCostControlData = []; // Armazena todos os registros de custo carregados
    let technicianCarsData = []; // Armazena dados de nome_tecnico, numero_vin, placa_carro
    let maintenanceIntervalConfiguration = {}; // Armazena a configuração carregada da API

    // --- Constantes de Configuração ---
    const MAINTENANCE_CATEGORIES = {
        'tire_change': 'Tire Change',
        'oil_and_filter_change': 'Oil & Filter Change',
        'brake_change': 'Brake Change',
        'battery_change': 'Battery Change',
        'air_filter_change': 'Air Filter Change',
        'other': 'Other Maintenance' // Categoria genérica
    };

    // Valores padrão usados se a configuração da planilha estiver ausente ou inválida
    const DEFAULT_INTERVALS = {
        'tire_change': { type: 'monthly', value: 6 },
        'oil_and_filter_change': { type: 'monthly', value: 2 },
        'brake_change': { type: 'monthly', value: 4 },
        'battery_change': { type: 'monthly', value: 24 },
        'air_filter_change': { type: 'monthly', value: 12 },
        'other': { type: 'monthly', value: 12 },
        'alert_threshold_days': 15 // Dias de antecedência para aviso
    };

    // --- Funções Auxiliares ---

    // Função para exibir notificações (toast)
    function showToastNotification(message, type = 'info') {
        if (!toastContainer) return;
        const toastElement = document.createElement('div');
        let backgroundClass = 'bg-card text-foreground'; // Estilo padrão (info)
        if (type === 'success') backgroundClass = 'bg-success text-success-foreground';
        if (type === 'error') backgroundClass = 'bg-destructive text-destructive-foreground';
        if (type === 'warning') backgroundClass = 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300'; // Estilo de aviso

        toastElement.className = `w-80 p-4 rounded-lg shadow-large ${backgroundClass} mb-2 animate-toast-in`;
        toastElement.innerHTML = `<p class="font-semibold">${message}</p>`;
        toastContainer.appendChild(toastElement);

        // Remove a notificação após alguns segundos
        setTimeout(() => {
            toastElement.classList.remove('animate-toast-in');
            toastElement.classList.add('animate-toast-out');
            toastElement.addEventListener('animationend', () => toastElement.remove());
        }, 5000); // Duração aumentada para avisos/erros
    }

    // Formata data (string YYYY-MM-DD/MM/DD/YYYY ou objeto Date) para MM/DD/YYYY (exibição)
    function formatDateForDisplay(dateInput) {
        if (!dateInput) return '';
        let dateObject;

        if (dateInput instanceof Date && !isNaN(dateInput)) {
            dateObject = dateInput;
        } else if (typeof dateInput === 'string') {
            try { // Tentativa mais robusta de parse
                // Trata YYYY-MM-DD (ajusta para UTC para evitar problemas de dia)
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                     dateObject = new Date(dateInput + 'T00:00:00Z'); // Trata como UTC
                     dateObject.setMinutes(dateObject.getMinutes() + dateObject.getTimezoneOffset()); // Ajusta para o dia do fuso horário local
                // Trata MM/DD/YYYY
                } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
                    const parts = dateInput.split('/');
                    dateObject = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
                } else {
                     // Tenta parse genérico como último recurso
                     dateObject = new Date(dateInput);
                }
            } catch (error) {
                 console.warn("Erro de parse em formatDateForDisplay:", error);
                 dateObject = null;
            }
        }

        // Se conseguiu um objeto Date válido, formata
        if (dateObject instanceof Date && !isNaN(dateObject)) {
            const year = dateObject.getFullYear();
             // Verifica se o ano é razoável
             if (year < 1900) {
                  console.warn("formatDateForDisplay: Ano parece inválido:", year, "Input original:", dateInput);
                  return typeof dateInput === 'string' ? dateInput : ''; // Retorna original se string, vazio senão
             }
            const month = String(dateObject.getMonth() + 1).padStart(2, '0');
            const day = String(dateObject.getDate()).padStart(2, '0');
            return `${month}/${day}/${year}`;
        }

        // console.warn("Não foi possível formatar a data para exibição:", dateInput);
        return typeof dateInput === 'string' ? dateInput : ''; // Retorna original se string, vazio senão
    }

    // Formata data (string qualquer formato parseável ou objeto Date) para YYYY-MM-DD (input[type=date])
    function formatDateForInput(dateInput) {
        if (!dateInput) return '';
        let dateObject;
        if (dateInput instanceof Date && !isNaN(dateInput)) { // Verifica se já é um objeto Date válido
            dateObject = dateInput;
        } else if (typeof dateInput === 'string') {
            // Verifica YYYY-MM-DD (já no formato correto, sem hora) - Otimização
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                const tempDate = new Date(dateInput + "T00:00:00Z"); // Usa UTC para validar
                if (!isNaN(tempDate)) return dateInput; // Retorna como está se válido
            }
            // Verifica MM/DD/YYYY
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
                 const parts = dateInput.split('/');
                 // Mês é 0-indexado no construtor Date
                 dateObject = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
            }
            // Tenta parse genérico para outros formatos comuns (incluindo ISO com hora)
            else {
                try {
                    const tempDate = new Date(dateInput);
                    // Verifica se o objeto criado é válido
                    if (!isNaN(tempDate)) dateObject = tempDate;
                 } catch (error) {
                    // Ignora erro se o parse falhar
                 }
            }
        }

        // Se conseguiu um objeto Date válido, formata para YYYY-MM-DD
        if (dateObject instanceof Date && !isNaN(dateObject)) {
            const year = dateObject.getFullYear();
            // Verifica se o ano é razoável
            if (year < 1900) {
                 console.warn("formatDateForInput: Ano parece inválido:", year, "Input original:", dateInput);
                 return '';
            }
            const month = String(dateObject.getMonth() + 1).padStart(2, '0');
            const day = String(dateObject.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        console.warn("Não foi possível formatar a data para input:", dateInput);
        return ''; // Retorna vazio para formatos inválidos ou datas inválidas
    }


    // Calcula a data de vencimento da manutenção
    function calculateDueDate(startDate, intervalValue, intervalType) {
        if (!startDate || isNaN(intervalValue) || intervalValue <= 0) return null;
        // Cria uma nova data baseada na data de início
        const dueDate = (startDate instanceof Date && !isNaN(startDate)) ? new Date(startDate) : null;
        // Retorna null se a data de início for inválida
        if (!dueDate) {
            console.warn("calculateDueDate recebeu uma data de início inválida:", startDate);
            return null;
        }

        const originalDay = dueDate.getDate(); // Guarda o dia original

        if (intervalType === 'monthly') {
            dueDate.setMonth(dueDate.getMonth() + intervalValue);
            // Ajusta para o último dia do mês alvo se o dia mudou (ex: Jan 31 + 1 mês = Feb 28/29)
            if (dueDate.getDate() !== originalDay) dueDate.setDate(0);
        } else if (intervalType === 'weekly') {
            dueDate.setDate(dueDate.getDate() + (intervalValue * 7));
        } else {
            return null; // Tipo de intervalo inválido
        }
        dueDate.setHours(0,0,0,0); // Zera a hora para comparação de data apenas
        return dueDate;
    }

    // Popula um elemento <select> com opções
    function populateDropdown(selectElement, items, defaultText = 'Select...', valueKey = null, textKey = null) {
         selectElement.innerHTML = `<option value="">${defaultText}</option>`; // Limpa e adiciona opção padrão
        if (items && Array.isArray(items)) {
            // Ordena alfabeticamente pelo texto
            items.sort((a, b) => {
                const textA = textKey ? (a[textKey] || '') : (a || '');
                const textB = textKey ? (b[textKey] || '') : (b || '');
                return textA.localeCompare(textB);
            }).forEach(item => {
                const value = valueKey ? (item[valueKey] || '') : (item || '');
                const text = textKey ? (item[textKey] || '') : (item || '');
                if (value) { // Adiciona apenas se houver valor
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = text;
                    selectElement.appendChild(option);
                }
            });
        }
    }

    // Define a data atual no campo de data do formulário de registro
    function setTodaysDateInRegistrationForm() {
        const today = new Date();
        const dateInput = document.getElementById('date'); // Campo de data no formulário de registro
        if (dateInput) dateInput.value = formatDateForInput(today);
     }


    // --- Gerenciamento da Configuração (via API) ---

    // Carrega a configuração da API, mesclando com os padrões
    async function loadMaintenanceIntervalConfiguration() {
        try {
            const response = await fetch('/api/get-maintenance-config');
            if (!response.ok) {
                 let errorMessage = `HTTP error ${response.status}`;
                 try {
                     const errorJson = await response.json();
                     errorMessage += `: ${errorJson.error || errorJson.message || 'Unknown server error'}`;
                 } catch (error) { /* Ignora erro de parse do JSON de erro */ }
                 throw new Error(errorMessage); // Lança o erro para ser pego pelo catch
            }
            const configFromServer = await response.json();
             // Garante que configFromServer seja um objeto
             const validConfigFromServer = (typeof configFromServer === 'object' && configFromServer !== null) ? configFromServer : {};

            // Mescla config do servidor com defaults (cópia profunda)
            const mergedConfig = JSON.parse(JSON.stringify(DEFAULT_INTERVALS));

            // Itera sobre as chaves padrão para garantir a estrutura
            for (const key in DEFAULT_INTERVALS) {
                if (validConfigFromServer.hasOwnProperty(key)) {
                    // Trata objetos aninhados (type, value)
                    if (typeof DEFAULT_INTERVALS[key] === 'object' && DEFAULT_INTERVALS[key] !== null && typeof validConfigFromServer[key] === 'object' && validConfigFromServer[key] !== null) {
                        let type = validConfigFromServer[key].type === 'weekly' ? 'weekly' : 'monthly';
                        let value = parseInt(validConfigFromServer[key].value, 10);
                        // Usa valor padrão se o do servidor for inválido
                        if(isNaN(value) || value < 1) value = DEFAULT_INTERVALS[key].value;
                        mergedConfig[key] = { type: type, value: value };
                    // Trata alert_threshold_days
                    } else if (key === 'alert_threshold_days') {
                        let threshold = parseInt(validConfigFromServer[key], 10);
                         // Usa valor padrão se o do servidor for inválido
                         if(isNaN(threshold) || threshold < 0) threshold = DEFAULT_INTERVALS[key];
                         mergedConfig[key] = threshold;
                    }
                }
                // Se a chave não existir no servidor, o valor padrão já está em mergedConfig
            }
            console.log("Configuration loaded and merged:", mergedConfig);
            return mergedConfig; // Retorna a configuração mesclada

        } catch (error) {
            console.error("Error loading interval configuration via API:", error);
            showToastNotification(`Error loading maintenance config: ${error.message}. Using default values.`, 'error');
            // Retorna uma cópia profunda dos defaults em caso de erro crítico
            return JSON.parse(JSON.stringify(DEFAULT_INTERVALS));
        }
    }

    // Salva a configuração atual do formulário via API
     async function saveMaintenanceIntervalConfiguration() {
        const newConfiguration = { }; // Objeto para guardar a nova configuração
        let formIsValid = true; // Flag para validação

        // Lê e valida os valores do formulário de configuração
        configForm.querySelectorAll('[data-config-key]').forEach(element => {
            const keyPath = element.dataset.configKey;
            let value = element.value;

            // Validação para campos numéricos
            if (element.type === 'number') {
                const numericValue = parseInt(value, 10);
                const isThresholdField = keyPath === 'alert_threshold_days';
                const minimumValue = isThresholdField ? 0 : 1; // Threshold pode ser 0, intervalos >= 1

                // Se inválido, busca o valor padrão correspondente
                if (isNaN(numericValue) || numericValue < minimumValue) {
                    const keys = keyPath.split('.');
                    let defaultValue = (keys.length === 2 && DEFAULT_INTERVALS[keys[0]]) ? DEFAULT_INTERVALS[keys[0]][keys[1]] : DEFAULT_INTERVALS[keyPath];
                    // Fallback final se o default não for encontrado
                    value = (defaultValue !== undefined) ? defaultValue : minimumValue;
                    element.value = value; // Corrige o valor no formulário
                    formIsValid = false; // Indica que houve correção
                } else {
                    value = numericValue; // Usa o valor numérico validado
                }
            // Validação para campos select (tipo de frequência)
            } else if (element.tagName === 'SELECT' && !value) { // Seletor está vazio
                const keys = keyPath.split('.');
                // Busca o tipo padrão correspondente
                let defaultValue = (keys.length === 2 && DEFAULT_INTERVALS[keys[0]]) ? DEFAULT_INTERVALS[keys[0]].type : undefined;
                value = defaultValue || 'monthly'; // Usa 'monthly' como fallback final
                element.value = value; // Corrige o valor no formulário
                formIsValid = false; // Indica que houve correção
            }

            // Atribui o valor (validado ou corrigido) ao objeto newConfiguration
            const keys = keyPath.split('.');
            if (keys.length === 2) { // Para chaves aninhadas como 'tire_change.type'
                if (!newConfiguration[keys[0]]) newConfiguration[keys[0]] = {};
                newConfiguration[keys[0]][keys[1]] = value;
            } else { // Para chaves diretas como 'alert_threshold_days'
                newConfiguration[keyPath] = value;
            }
        });

         // Mostra aviso se algum valor foi corrigido
         if (!formIsValid) {
             showToastNotification('Some invalid values were reset to defaults before saving.', 'warning');
         }

        console.log("Attempting to save configuration:", newConfiguration); // Log para depuração

        // Desabilita o botão enquanto salva
        saveConfigButton.disabled = true;
        saveConfigButton.textContent = 'Saving...';

        try {
            // Envia a nova configuração para a API
            const response = await fetch('/api/save-maintenance-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfiguration) // Envia o objeto JSON completo
            });
            const result = await response.json(); // Aguarda a resposta da API

            // Verifica se o salvamento foi bem-sucedido
            if (result.success) {
                maintenanceIntervalConfiguration = newConfiguration; // Atualiza a configuração global
                showToastNotification('Configuration saved successfully!', 'success');
                renderMaintenanceAlerts(allCostControlData); // Re-renderiza os alertas com a nova configuração
            } else {
                // Lança erro se a API indicar falha
                throw new Error(result.message || 'Failed to save configuration.');
            }
        } catch (error) {
            console.error("Error saving interval configuration via API:", error);
            showToastNotification(`Failed to save configuration: ${error.message}`, 'error');
        } finally {
             // Reabilita o botão após a tentativa de salvar
             saveConfigButton.disabled = false;
             saveConfigButton.textContent = 'Save Configuration';
        }
    }

    // Popula o formulário de configuração com os valores carregados
    function populateConfigurationForm() {
        // Verifica se o formulário e a configuração global existem
        if (!configForm || !maintenanceIntervalConfiguration || Object.keys(maintenanceIntervalConfiguration).length === 0) {
             console.warn("Configuration form or interval configuration not ready for population or is empty.");
             // Tenta usar defaults puros se a configuração estiver vazia após o carregamento
             if (typeof maintenanceIntervalConfiguration !== 'object' || maintenanceIntervalConfiguration === null || Object.keys(maintenanceIntervalConfiguration).length === 0) {
                 maintenanceIntervalConfiguration = JSON.parse(JSON.stringify(DEFAULT_INTERVALS));
                 console.log("Using pure defaults for configuration form population.");
             } else {
                return; // Sai se o formulário não existir
             }
        }

        // Itera sobre todos os elementos com 'data-config-key' no formulário
        configForm.querySelectorAll('[data-config-key]').forEach(element => {
            const keyPath = element.dataset.configKey; // Ex: 'tire_change.type' ou 'alert_threshold_days'
            const keys = keyPath.split('.'); // Divide para chaves aninhadas
            let configValue;

            // Busca o valor na configuração global carregada (intervalConfig)
            if (keys.length === 2) { // Chave aninhada
                configValue = maintenanceIntervalConfiguration[keys[0]] ? maintenanceIntervalConfiguration[keys[0]][keys[1]] : undefined;
            } else { // Chave direta
                configValue = maintenanceIntervalConfiguration[keyPath];
            }

            // Se o valor não foi encontrado na config carregada, busca o valor padrão
            if (configValue === undefined) {
                 let defaultValue;
                 if (keys.length === 2) {
                     defaultValue = DEFAULT_INTERVALS[keys[0]] ? DEFAULT_INTERVALS[keys[0]][keys[1]] : undefined;
                 } else {
                     defaultValue = DEFAULT_INTERVALS[keyPath];
                 }
                 configValue = defaultValue; // Usa o default se carregado for undefined
            }

            // Define um valor final de fallback se ainda for undefined (garantia extra)
             if (configValue === undefined) {
                if (element.tagName === 'SELECT') configValue = 'monthly';
                else if (element.type === 'number') configValue = keyPath === 'alert_threshold_days' ? 0 : 1;
                else configValue = '';
            }

            // Define o valor no elemento do formulário (input ou select)
            element.value = configValue;
        });
        console.log("Configuration form populated."); // Log para confirmar
    }

    // --- Fetch Initial Data (Carros e Custos) ---
    async function fetchCoreData() {
        // Define mensagens de loading
        costControlTableBody.innerHTML = `<tr><td colspan="14" class="p-4 text-center">Loading cost data...</td></tr>`;
        alertsContent.innerHTML = '<p class="text-muted-foreground">Loading alerts...</p>';
        try {
            // Configuração já carregada em initializePage()
            const [techCarsResponse, costResponse] = await Promise.all([
                fetch('/api/get-tech-cars-data'),
                fetch('/api/get-cost-control-data')
            ]);

            // Trata resposta de TechCars
            if (!techCarsResponse.ok) {
                let errorMessage = 'Failed to load technician/car list.';
                try { const errorJson = await techCarsResponse.json(); errorMessage = errorJson.error || errorJson.message || errorMessage; } catch(error){ errorMessage = `Status: ${techCarsResponse.status}`; }
                throw new Error(errorMessage);
            }
            const techCarsResult = await techCarsResponse.json();
            technicianCarsData = techCarsResult.techCars || [];
            // Popula os dropdowns de técnico (registro e filtro)
            populateDropdown(technicianSelect, technicianCarsData, 'Select Technician...', 'tech_name', 'tech_name');
            populateDropdown(filterTechnicianSelect, technicianCarsData, 'All Technicians', 'tech_name', 'tech_name');

            // Trata resposta de Custos
            if (!costResponse.ok) {
                let errorMessage = 'Failed to load cost control data.';
                try { const errorJson = await costResponse.json(); errorMessage = errorJson.error || errorJson.message || errorMessage; } catch(error){ errorMessage = `Status: ${costResponse.status}`; }
                throw new Error(errorMessage);
            }
            const costDataResult = await costResponse.json();
            // Filtra registros sem data válida ANTES de armazenar globalmente
            allCostControlData = (costDataResult.costs || []).filter(record => record.date && formatDateForInput(record.date));

            // Define mensagem inicial da tabela de histórico (não renderiza dados ainda)
            costControlTableBody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>`;
            renderMaintenanceAlerts(allCostControlData); // Renderiza alertas usando a configuração já carregada

        } catch (error) {
            console.error('Error fetching cost/car data:', error);
            showToastNotification(`Error loading data: ${error.message}`, 'error');
            costControlTableBody.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-red-600">Failed to load cost data. ${error.message}</td></tr>`;
            alertsContent.innerHTML = `<p class="text-destructive">Failed to load alert data. ${error.message}</p>`;
            // Desabilita dropdowns se o carregamento falhar
            if (technicianSelect) { technicianSelect.disabled = true; populateDropdown(technicianSelect, [], 'Error loading'); }
            if (filterTechnicianSelect) { filterTechnicianSelect.disabled = true; populateDropdown(filterTechnicianSelect, [], 'Error loading'); }
        }
    }


    // --- Renderização da Tabela de Histórico ---
    function renderHistoryTable(dataToRender) {
        const numberOfColumns = 14; // Ajustado após remover coluna Business
        costControlTableBody.innerHTML = ''; // Limpa tabela

        // Verifica se há dados para exibir
        if (!Array.isArray(dataToRender) || dataToRender.length === 0) {
            // Mensagem diferente se a seção ainda estiver oculta (antes da primeira busca)
            if (listingSection.classList.contains('hidden')) {
                costControlTableBody.innerHTML = `<tr><td colspan="${numberOfColumns}" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>`;
            } else { // Mensagem para quando a busca não retorna resultados
                costControlTableBody.innerHTML = `<tr><td colspan="${numberOfColumns}" class="p-4 text-center text-muted-foreground">No maintenance records found matching your filters.</td></tr>`;
            }
            return; // Sai da função
        }

        // Ordena os dados por data (mais recente primeiro)
        const sortedData = dataToRender.sort((a, b) => {
             const dateStringA = formatDateForInput(a.date);
             const dateStringB = formatDateForInput(b.date);
             // Coloca datas inválidas no final
             if (!dateStringA && !dateStringB) return 0;
             if (!dateStringA) return 1; // 'a' inválido vai depois
             if (!dateStringB) return -1; // 'b' inválido vai depois
             // Compara datas válidas
             const dateObjectA = new Date(dateStringA);
             const dateObjectB = new Date(dateStringB);
             return dateObjectB.getTime() - dateObjectA.getTime(); // Ordena descendente
        });

        // Cria as linhas da tabela
        sortedData.forEach(record => {
            const tableRow = document.createElement('tr');
            tableRow.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            // Função interna para verificar checkboxes
            const isChecked = (value) => value && String(value).toUpperCase() === 'TRUE' ? '✔️' : '❌';
            // Converte preço para número
            const priceValue = parseFloat(record.price);
            // Prepara descrição (completa para tooltip, curta para exibição)
            const fullDescription = record.description || '';
            const shortDescription = fullDescription.length > 20 ? fullDescription.substring(0, 20) + '...' : fullDescription; // Limite de 20 caracteres

            // Define o HTML interno da linha (removida a coluna Business)
            tableRow.innerHTML = `
                <td class="p-4 whitespace-nowrap">${formatDateForDisplay(record.date)}</td>
                <td class="p-4">${record.license_plate || ''}</td>
                <td class="p-4">${record.odometer || ''}</td>
                <td class="p-4">${record.cost_type || ''}</td>
                <td class="p-4">${record.subtype || ''}</td>
                <td class="p-4">${record.technician || ''}</td>
                <td class="p-4 text-right">${!isNaN(priceValue) ? `$${priceValue.toFixed(2)}` : ''}</td>
                <td class="p-4 max-w-[150px] truncate" title="${fullDescription}">${shortDescription}</td> {/* Descrição curta */}
                {/* Coluna Business removida */}
                <td class="p-4">${record.invoice_number || ''}</td>
                <td class="p-4 text-center">${isChecked(record.tire_change)}</td>
                <td class="p-4 text-center">${isChecked(record.oil_and_filter_change)}</td>
                <td class="p-4 text-center">${isChecked(record.brake_change)}</td>
                <td class="p-4 text-center">${isChecked(record.battery_change)}</td>
                <td class="p-4 text-center">${isChecked(record.air_filter_change)}</td>
            `;
            costControlTableBody.appendChild(tableRow); // Adiciona linha à tabela
        });
    }

    // --- Lógica de Alertas (Não exibe "no record found") ---
    function renderMaintenanceAlerts(costData) {
        alertsContent.innerHTML = ''; // Limpa alertas existentes
        let anyAlertsGenerated = false; // Flag para verificar se algum alerta foi gerado
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas datas

        // Obtém o threshold de dias do objeto de configuração global
        const alertThresholdDays = parseInt(maintenanceIntervalConfiguration.alert_threshold_days, 10);
        // Garante que o threshold seja um número válido >= 0, senão usa o padrão
        const validThresholdDays = (!isNaN(alertThresholdDays) && alertThresholdDays >= 0) ? alertThresholdDays : DEFAULT_INTERVALS.alert_threshold_days;

        // Calcula a data limite para avisos 'soon'
        const alertThresholdDate = new Date(today);
        alertThresholdDate.setDate(today.getDate() + validThresholdDays);

        // Objeto para agrupar dados por placa de veículo
        const vehicleMaintenanceData = {};

        // 1. Agrupa registros válidos por placa, guardando também o técnico do último registro
        costData.forEach(record => {
            if (record.license_plate) { // Processa apenas se houver placa
                const plate = record.license_plate.toUpperCase().trim();
                const recordDateString = formatDateForInput(record.date); // Garante formato YYYY-MM-DD
                // Cria objeto Date a partir da string formatada (adiciona T00:00:00 para evitar timezone shift)
                const recordDateObject = recordDateString ? new Date(recordDateString + "T00:00:00") : null;

                // Pula o registro se a data for inválida
                if (!recordDateObject || isNaN(recordDateObject)) return;

                // Inicializa o objeto para a placa se ainda não existir
                if (!vehicleMaintenanceData[plate]) {
                    vehicleMaintenanceData[plate] = { records: [], lastTechnician: record.technician }; // Guarda o técnico do primeiro registro visto
                }
                // Adiciona os dados relevantes do registro ao array da placa
                vehicleMaintenanceData[plate].records.push({
                    date: recordDateObject, // Armazena como objeto Date
                    tire_change: String(record.tire_change).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record.oil_and_filter_change).toUpperCase() === 'TRUE',
                    brake_change: String(record.brake_change).toUpperCase() === 'TRUE',
                    battery_change: String(record.battery_change).toUpperCase() === 'TRUE',
                    air_filter_change: String(record.air_filter_change).toUpperCase() === 'TRUE',
                    cost_type: record.cost_type, // Necessário para a lógica 'Other'
                });
                // Atualiza o último técnico associado a esta placa (pode mudar se outro técnico usou o carro)
                vehicleMaintenanceData[plate].lastTechnician = record.technician;
            }
        });

        // 2. Processa os dados de cada veículo agrupado
        for (const plate in vehicleMaintenanceData) {
            // Busca informações adicionais do carro (VIN) usando a placa
            const carInfo = technicianCarsData.find(car => car.car_plate && car.car_plate.toUpperCase().trim() === plate);
            const vin = carInfo ? carInfo.vin_number : 'N/A'; // Obtém VIN ou 'N/A'
            // Obtém o último técnico associado aos registros ou da lista de carros
            const technician = vehicleMaintenanceData[plate].lastTechnician || (carInfo ? carInfo.tech_name : 'N/A');

            // Ordena os registros daquele veículo pela data, do mais recente para o mais antigo
            const vehicleRecords = vehicleMaintenanceData[plate].records.sort((a, b) => b.date.getTime() - a.date.getTime());
            if (vehicleRecords.length === 0) continue; // Pula se não houver registros válidos para o veículo

            let alertMessagesForVehicle = []; // Array para guardar mensagens de alerta deste veículo
            let highestSeverityLevel = 'info'; // Nível de severidade ('info', 'warning', 'error')

            // Verifica cada categoria de manutenção definida em MAINTENANCE_CATEGORIES
            for (const categoryKey in MAINTENANCE_CATEGORIES) {
                // Obtém a configuração específica para esta categoria (ex: { type: 'monthly', value: 2 })
                const categoryConfig = maintenanceIntervalConfiguration[categoryKey];
                 // Pula esta categoria se não houver configuração válida para ela
                if (!categoryConfig || !categoryConfig.type || isNaN(categoryConfig.value) || categoryConfig.value <= 0) continue;

                let lastPerformedRecord; // Guarda o último registro onde este serviço foi feito
                 // Lógica especial para 'other': busca último registro de 'Maintenance' ou 'Repair'
                 // que NÃO seja um dos tipos específicos já verificados
                 if (categoryKey === 'other') {
                    lastPerformedRecord = vehicleRecords.find(record =>
                        (record.cost_type === 'Maintenance' || record.cost_type === 'Repair') &&
                        !record.tire_change && !record.oil_and_filter_change && !record.brake_change && !record.battery_change && !record.air_filter_change
                    );
                 } else { // Para tipos específicos (ex: 'tire_change'), busca o último onde a flag é true
                     lastPerformedRecord = vehicleRecords.find(record => record[categoryKey] === true);
                 }

                const categoryDisplayName = MAINTENANCE_CATEGORIES[categoryKey]; // Nome amigável (ex: "Tire Change")

                // Processa apenas se encontrou um registro anterior para este serviço
                if (lastPerformedRecord) {
                    // Calcula a data de vencimento usando a data do último registro e a configuração
                    const dueDate = calculateDueDate(lastPerformedRecord.date, categoryConfig.value, categoryConfig.type);

                    // Verifica se a data de vencimento é válida antes de comparar
                    if (dueDate && !isNaN(dueDate)) {
                        if (dueDate <= today) { // Manutenção Vencida
                            alertMessagesForVehicle.push(`${categoryDisplayName} due (Last: ${formatDateForDisplay(lastPerformedRecord.date)})`);
                            highestSeverityLevel = 'error'; // Define severidade máxima
                        } else if (dueDate <= alertThresholdDate) { // Próximo do vencimento
                            alertMessagesForVehicle.push(`${categoryDisplayName} soon (Due: ${formatDateForDisplay(dueDate)})`);
                            // Define como aviso apenas se não houver um erro mais grave já registrado
                            if (highestSeverityLevel !== 'error') highestSeverityLevel = 'warning';
                        }
                    } else {
                         // Loga aviso se não conseguiu calcular data de vencimento (problema raro)
                         console.warn(`Could not calculate due date for ${categoryDisplayName} on vehicle ${plate}. Last record date: ${lastPerformedRecord.date}`);
                    }
                }
                 // Não adiciona mensagem "No record found"

            } // Fim do loop pelas categorias de manutenção

            // 3. Cria um único bloco de alerta para o veículo, se houver mensagens acumuladas
            if (alertMessagesForVehicle.length > 0) {
                // Chama função para criar o HTML do alerta, passando todos os dados necessários
                createAlertHTML(plate, vin, technician, alertMessagesForVehicle, highestSeverityLevel);
                anyAlertsGenerated = true; // Marca que pelo menos um alerta foi gerado
            }
        } // Fim do loop pelos veículos

        // Se nenhum alerta foi gerado para nenhum veículo, exibe mensagem padrão
        if (!anyAlertsGenerated) {
            alertsContent.innerHTML = '<p class="text-muted-foreground">No immediate maintenance alerts found based on configured intervals.</p>';
        }
    }


    // Cria o HTML para um bloco de alerta de veículo
    function createAlertHTML(plate, vin, technician, messages, severityType) {
        const alertDiv = document.createElement('div');
        // Define estilos padrão
        let borderColorClass = 'border-border';
        let backgroundColorClass = 'bg-muted/10';
        let titlePrefix = 'Info'; // Prefixo do título (Info, Warning, Alert / Due)
        let titleColorClass = 'text-foreground'; // Cor do título

        // Ajusta estilos com base na severidade
        if (severityType === 'warning') {
            borderColorClass = 'border-yellow-500';
            backgroundColorClass = 'bg-yellow-500/10';
            titlePrefix = 'Warning';
            titleColorClass = 'text-yellow-700 dark:text-yellow-300';
        } else if (severityType === 'error') {
            borderColorClass = 'border-destructive'; // Cor de erro do tema
            backgroundColorClass = 'bg-destructive/10';
            titlePrefix = 'Alert / Due'; // Título para erro
            titleColorClass = 'text-destructive'; // Cor de erro do tema
        }

       // Define classes CSS para o container do alerta
       alertDiv.className = `p-3 border ${borderColorClass} rounded-lg ${backgroundColorClass} mb-2`;
       // Junta as mensagens de alerta com um separador
       const messageString = messages.join(' • ');

       // Monta o texto do título incluindo Placa, VIN e Técnico
       const titleText = `${titlePrefix}: Vehicle ${plate} (VIN: ${vin || 'N/A'}, Tech: ${technician || 'N/A'})`;

       // Define o HTML interno do alerta
       alertDiv.innerHTML = `
           <div class="flex justify-between items-center">
                <span class="font-semibold text-sm ${titleColorClass}">${titleText}</span>
           </div>
           <p class="text-xs text-foreground mt-1">${messageString}</p>
       `;
       alertsContent.appendChild(alertDiv); // Adiciona o alerta ao DOM
    }

    // --- Lógica de Autofill para VIN e Placa ao selecionar Técnico ---
    function handleTechnicianSelectionChange() {
        const selectedTechnicianName = technicianSelect.value;
        // Encontra os dados do carro do técnico selecionado na lista `technicianCarsData`
        const selectedTechnicianData = technicianCarsData.find(tech => tech.tech_name === selectedTechnicianName);

        // Se encontrou dados, preenche os campos VIN e Placa
        if (selectedTechnicianData) {
            vinInput.value = selectedTechnicianData.vin_number || '';
            licensePlateInput.value = selectedTechnicianData.car_plate || '';
        } else { // Senão, limpa os campos
            vinInput.value = '';
            licensePlateInput.value = '';
        }
    }

    // --- Lógica de Submissão do Formulário de Registro ---
    costControlForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o envio padrão do formulário
        const formData = new FormData(costControlForm); // Pega os dados do formulário
        const registrationData = {}; // Objeto para guardar os dados formatados

        // Formata os dados do formulário
        formData.forEach((value, key) => {
            // Substitui vírgula por ponto no preço antes de enviar para API
            if (key === 'price' && typeof value === 'string') {
                registrationData[key] = value.replace(',', '.');
            } else {
                registrationData[key] = value;
            }
        });

        // Adiciona VIN e Placa (que são readonly)
        registrationData['vin'] = vinInput.value;
        registrationData['license_plate'] = licensePlateInput.value;

        // Converte estado dos checkboxes para 'TRUE' ou 'FALSE'
        ['tire_change', 'oil_and_filter_change', 'brake_change', 'battery_change', 'air_filter_change'].forEach(key => {
            registrationData[key] = formData.has(key) ? 'TRUE' : 'FALSE';
        });

        // --- Validações Essenciais Antes do Envio ---
        if (!registrationData.technician) {
            showToastNotification('Please select a Technician (Driver).', 'error');
            return; // Impede o envio
        }
        if (!registrationData.license_plate || !registrationData.vin) {
            showToastNotification('VIN and License Plate must be autofilled by selecting a Technician.', 'error');
            return;
        }
        if (!registrationData.date || !registrationData.odometer || !registrationData.cost_type || registrationData.price === undefined || registrationData.price === '') {
             showToastNotification('Date, Odometer, Cost Type, and Price are required.', 'error');
             return;
        }

        // Desabilita botão de submit e mostra estado de "salvando"
        const submitButton = costControlForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';

        try {
            // Envia os dados para a API de registro
            const response = await fetch('/api/register-cost-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData), // Envia os dados formatados
            });

            // Verifica se a resposta da API foi bem-sucedida (status 2xx)
            if (!response.ok) {
                let errorText = `Server responded with status: ${response.status}`;
                try { // Tenta obter mensagem de erro do corpo da resposta
                    const errorResult = await response.json();
                    errorText = errorResult.message || errorText;
                } catch(error) { /* Ignora erro de parse do JSON de erro */ }
                 console.error("API Error Response:", await response.text()); // Loga a resposta completa
                 throw new Error(`Failed to save record. ${errorText}`); // Lança erro com detalhes
            }

            const result = await response.json(); // Obtém o resultado da API

            // Se a API indicar sucesso
            if (result.success) {
                showToastNotification('Record saved successfully!', 'success');
                costControlForm.reset(); // Limpa o formulário
                setTodaysDateInRegistrationForm(); // Redefine a data para hoje
                vinInput.value = ''; // Limpa campo VIN
                licensePlateInput.value = ''; // Limpa campo Placa
                // Recarrega todos os dados da página (config, carros, custos, alertas)
                await initializePage();
            } else { // Se a API retornar 2xx mas indicar falha no corpo
                throw new Error(result.message || 'Failed to save record.');
            }
        } catch (error) { // Captura erros de rede ou lançados acima
            console.error('Error submitting form:', error);
            showToastNotification(`Error: ${error.message || 'Could not save record.'}`, 'error');
        } finally { // Garante que o botão seja reabilitado
            submitButton.disabled = false;
            submitButton.textContent = 'Save Record';
        }
    });

    // --- Lógica da Busca no Histórico ---
    searchHistoryButton.addEventListener('click', () => {
        // Pega os valores dos filtros
        const startDateString = filterStartDateInput.value;
        const endDateString = filterEndDateInput.value;
        const technicianName = filterTechnicianSelect.value;
        const licensePlateQuery = filterLicensePlateInput.value.trim().toLowerCase();

        // Converte as datas do filtro para objetos Date (ajusta para incluir o dia inteiro)
        const startDate = startDateString ? new Date(startDateString + 'T00:00:00') : null;
        const endDate = endDateString ? new Date(endDateString + 'T23:59:59') : null;

        // Filtra os dados globais `allCostControlData`
        const filteredData = allCostControlData.filter(record => {
            // Converte a data do registro para objeto Date para comparação
            const recordDateString = formatDateForInput(record.date); // Garante YYYY-MM-DD
            const recordDateObject = recordDateString ? new Date(recordDateString + 'T00:00:00') : null;

            // Pula registro se a data for inválida
            if (!recordDateObject || isNaN(recordDateObject)) return false;

            // Verifica condição de data (apenas se filtros de data estiverem ativos)
            const matchesDateRange =
                (!startDate || recordDateObject >= startDate) &&
                (!endDate || recordDateObject <= endDate);

            // Verifica condição de técnico (apenas se um técnico foi selecionado)
            const matchesTechnician = !technicianName || (record.technician && record.technician === technicianName);

            // Verifica condição de placa (case-insensitive, busca parcial)
            const matchesLicensePlate = !licensePlateQuery || (record.license_plate && record.license_plate.toLowerCase().includes(licensePlateQuery));

            // Retorna true apenas se TODAS as condições ativas forem verdadeiras
            return matchesDateRange && matchesTechnician && matchesLicensePlate;
        });

        // Torna a seção de histórico visível e renderiza a tabela com os dados filtrados
        listingSection.classList.remove('hidden');
        renderHistoryTable(filteredData);
    });


    // --- Adiciona Event Listeners ---
    // Autofill ao mudar técnico no formulário de registro
    if (technicianSelect) { technicianSelect.addEventListener('change', handleTechnicianSelectionChange); }
    // Salvar configuração ao clicar no botão
    if (saveConfigButton) { saveConfigButton.addEventListener('click', saveMaintenanceIntervalConfiguration); }

    // --- Função de Inicialização Principal ---
    async function initializePage() {
        setTodaysDateInRegistrationForm(); // Define data no formulário de registro
        // Carrega a configuração da API ANTES de buscar os outros dados
        console.log("Initializing page, loading configuration...");
        maintenanceIntervalConfiguration = await loadMaintenanceIntervalConfiguration();
        console.log("Configuration loaded, populating configuration form...");
        populateConfigurationForm(); // Popula o formulário de configuração
        console.log("Configuration form populated, fetching core data (cars/costs)...");
        // Busca os dados de carros e custos, e então renderiza os alertas
        await fetchCoreData();
        console.log("Initialization complete.");
    }

    // --- Inicia a Página ---
    initializePage();

});
