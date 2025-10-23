document.addEventListener('DOMContentLoaded', async () => {
    const costControlFormElement = document.getElementById('cost-control-form');
    const costControlTableBodyElement = document.getElementById('cost-control-table-body');
    const technicianSelectElement = document.getElementById('technician');
    const vinSelectElement = document.getElementById('vin');
    const licensePlateSelectElement = document.getElementById('license_plate');
    const alertsContentElement = document.getElementById('alerts-content');
    const toastContainerElement = document.getElementById('toast-container');
    const configurationFormElement = document.getElementById('config-form');
    const saveConfigurationButtonElement = document.getElementById('save-config-btn');
    const listingSectionElement = document.getElementById('listing-section');
    const totalPriceSumElement = document.getElementById('total-price-sum');

    let allCostControlData = [];
    let technicianCarsData = [];
    let maintenanceIntervalConfiguration = {};

    const MAINTENANCE_CATEGORIES = {
        'tire_change': 'Tire Change',
        'oil_and_filter_change': 'Oil & Filter Change',
        'brake_change': 'Brake Change',
        'battery_change': 'Battery Change',
        'others': 'Others' // Adicionado Others
    };

    const DEFAULT_INTERVALS = {
        'tire_change': { type: 'monthly', value: 6 },
        'oil_and_filter_change': { type: 'monthly', value: 2 },
        'brake_change': { type: 'monthly', value: 4 },
        'battery_change': { type: 'monthly', value: 24 },
        // 'others' não precisa ter um intervalo padrão para alertas
        'alert_threshold_days': 15
    };

    function showToastNotification(message, type = 'info') {
        if (!toastContainerElement) return;
        const toastElement = document.createElement('div');
        let backgroundClass = 'bg-card text-foreground';
        if (type === 'success') backgroundClass = 'bg-success text-success-foreground';
        if (type === 'error') backgroundClass = 'bg-destructive text-destructive-foreground';
        if (type === 'warning') backgroundClass = 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300';
        toastElement.className = `w-80 p-4 rounded-lg shadow-large ${backgroundClass} mb-2 animate-toast-in`;
        toastElement.innerHTML = `<p class="font-semibold">${message}</p>`;
        toastContainerElement.appendChild(toastElement);
        setTimeout(() => {
            toastElement.classList.remove('animate-toast-in');
            toastElement.classList.add('animate-toast-out');
            toastElement.addEventListener('animationend', () => toastElement.remove());
        }, 5000);
    }

    function formatDateForDisplay(dateInput) {
        if (!dateInput) return '';
        let dateObject;
        if (dateInput instanceof Date && !isNaN(dateInput)) { dateObject = dateInput; }
        else if (typeof dateInput === 'string') {
            try {
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                     dateObject = new Date(dateInput + 'T00:00:00Z');
                     dateObject.setMinutes(dateObject.getMinutes() + dateObject.getTimezoneOffset());
                } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
                    const parts = dateInput.split('/');
                    dateObject = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
                } else { dateObject = new Date(dateInput); }
            } catch (error) { dateObject = null; }
        }
        if (dateObject instanceof Date && !isNaN(dateObject)) {
            const year = dateObject.getFullYear();
             if (year < 1900) return typeof dateInput === 'string' ? dateInput : '';
            const month = String(dateObject.getMonth() + 1).padStart(2, '0');
            const day = String(dateObject.getDate()).padStart(2, '0');
            return `${month}/${day}/${year}`;
        }
        return typeof dateInput === 'string' ? dateInput : '';
    }

    function formatDateForInput(dateInput) {
        if (!dateInput) return '';
        let dateObject;
        if (dateInput instanceof Date && !isNaN(dateInput)) { dateObject = dateInput; }
        else if (typeof dateInput === 'string') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                const temporaryDate = new Date(dateInput + "T00:00:00Z");
                if (!isNaN(temporaryDate)) return dateInput;
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
                 const parts = dateInput.split('/');
                 dateObject = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
            } else {
                try {
                    const temporaryDate = new Date(dateInput);
                    if (!isNaN(temporaryDate)) dateObject = temporaryDate;
                 } catch (error) {}
            }
        }
        if (dateObject instanceof Date && !isNaN(dateObject)) {
            const year = dateObject.getFullYear();
            if (year < 1900) return '';
            const month = String(dateObject.getMonth() + 1).padStart(2, '0');
            const day = String(dateObject.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        console.warn("Could not format date for input:", dateInput);
        return '';
    }

    function createDateObjectFromMMDDYYYY(dateStringMMDDYYYY) {
        if (!dateStringMMDDYYYY || typeof dateStringMMDDYYYY !== 'string' || !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStringMMDDYYYY)) {
            return null;
        }
        try {
            const parts = dateStringMMDDYYYY.split('/');
            const year = parseInt(parts[2], 10);
            const month = parseInt(parts[0], 10) - 1;
            const day = parseInt(parts[1], 10);
            if (year < 1900 || year > 2100 || month < 0 || month > 11 || day < 1 || day > 31) {
                 console.warn("Invalid date components from MM/DD/YYYY:", dateStringMMDDYYYY);
                 return null;
            }
            const dateObject = new Date(year, month, day);
            if (isNaN(dateObject) || dateObject.getFullYear() !== year || dateObject.getMonth() !== month || dateObject.getDate() !== day) {
                console.warn("Date object mismatch after creation from MM/DD/YYYY:", dateStringMMDDYYYY);
                return null;
            }
            dateObject.setHours(0, 0, 0, 0);
            return dateObject;
        } catch (error) {
            console.error("Error creating Date object from MM/DD/YYYY:", dateStringMMDDYYYY, error);
            return null;
        }
    }

    function calculateDueDate(startDate, intervalValue, intervalType) {
        if (!startDate || isNaN(intervalValue) || intervalValue <= 0) return null;
        const dueDate = (startDate instanceof Date && !isNaN(startDate)) ? new Date(startDate) : null;
        if (!dueDate) return null;
        const originalDay = dueDate.getDate();
        if (intervalType === 'monthly') {
            dueDate.setMonth(dueDate.getMonth() + intervalValue);
            if (dueDate.getDate() !== originalDay) dueDate.setDate(0);
        } else if (intervalType === 'weekly') {
            dueDate.setDate(dueDate.getDate() + (intervalValue * 7));
        } else { return null; }
        dueDate.setHours(0,0,0,0);
        return dueDate;
    }

    function populateSimpleDropdown(selectElement, items, defaultText = 'Select...') {
        if (!selectElement) {
            console.error(`populateSimpleDropdown: Elemento select não encontrado.`);
            return;
        }
        selectElement.innerHTML = `<option value="">${defaultText}</option>`;
        if (items && Array.isArray(items)) {
            [...new Set(items)].sort((a, b) => (a || '').localeCompare(b || '')).forEach(item => {
                if (item) {
                    const option = document.createElement('option');
                    option.value = item;
                    option.textContent = item;
                    selectElement.appendChild(option);
                }
            });
        }
    }

    function setTodaysDateInRegistrationForm() {
        const today = new Date();
        const dateInputElement = document.getElementById('date');
        if (dateInputElement) dateInputElement.value = formatDateForInput(today);
     }

    async function loadMaintenanceIntervalConfiguration() {
        try {
            const response = await fetch('/api/get-maintenance-config');
            if (!response.ok) {
                 let errorMessage = `HTTP error ${response.status}`;
                 try { const errorJson = await response.json(); errorMessage += `: ${errorJson.error || errorJson.message || 'Unknown server error'}`; } catch (error) {}
                 throw new Error(errorMessage);
            }
            const configurationFromServer = await response.json();
             const validConfigurationFromServer = (typeof configurationFromServer === 'object' && configurationFromServer !== null) ? configurationFromServer : {};
            const mergedConfiguration = JSON.parse(JSON.stringify(DEFAULT_INTERVALS));
            for (const key in DEFAULT_INTERVALS) {
                 if (key === 'air_filter_change' || key === 'other' || key === 'others') continue; // Ignora também 'others' se existir
                if (validConfigurationFromServer.hasOwnProperty(key)) {
                    if (typeof DEFAULT_INTERVALS[key] === 'object' && DEFAULT_INTERVALS[key] !== null && typeof validConfigurationFromServer[key] === 'object' && validConfigurationFromServer[key] !== null) {
                        let type = validConfigurationFromServer[key].type === 'weekly' ? 'weekly' : 'monthly';
                        let value = parseInt(validConfigurationFromServer[key].value, 10);
                        if(isNaN(value) || value < 1) value = DEFAULT_INTERVALS[key].value;
                        mergedConfiguration[key] = { type: type, value: value };
                    } else if (key === 'alert_threshold_days') {
                        let threshold = parseInt(validConfigurationFromServer[key], 10);
                         if(isNaN(threshold) || threshold < 0) threshold = DEFAULT_INTERVALS[key];
                         mergedConfiguration[key] = threshold;
                    }
                }
            }
            console.log("Configuration loaded and merged:", mergedConfiguration);
            return mergedConfiguration;
        } catch (error) {
            console.error("Error loading interval configuration via API:", error);
            showToastNotification(`Error loading maintenance configuration: ${error.message}. Using default values.`, 'error');
            return JSON.parse(JSON.stringify(DEFAULT_INTERVALS));
        }
    }

     async function saveMaintenanceIntervalConfiguration() {
        const newConfiguration = { };
        let formIsValid = true;
        configurationFormElement.querySelectorAll('[data-config-key]').forEach(element => {
            const keyPath = element.dataset.configKey;
             if (keyPath.startsWith('air_filter_change.') || keyPath.startsWith('other.') || keyPath.startsWith('others.')) return; // Ignora removidos/novos

            let value = element.value;
            if (element.type === 'number') {
                const numericValue = parseInt(value, 10);
                const isThresholdField = keyPath === 'alert_threshold_days';
                const minimumValue = isThresholdField ? 0 : 1;
                if (isNaN(numericValue) || numericValue < minimumValue) {
                    const keys = keyPath.split('.');
                    let defaultValue = (keys.length === 2 && DEFAULT_INTERVALS[keys[0]]) ? DEFAULT_INTERVALS[keys[0]][keys[1]] : DEFAULT_INTERVALS[keyPath];
                    value = (defaultValue !== undefined) ? defaultValue : minimumValue;
                    element.value = value;
                    formIsValid = false;
                } else { value = numericValue; }
            } else if (element.tagName === 'SELECT' && !value) {
                const keys = keyPath.split('.');
                let defaultValue = (keys.length === 2 && DEFAULT_INTERVALS[keys[0]]) ? DEFAULT_INTERVALS[keys[0]].type : undefined;
                value = defaultValue || 'monthly';
                element.value = value;
                formIsValid = false;
            }
            const keys = keyPath.split('.');
            if (keys.length === 2) {
                if (!newConfiguration[keys[0]]) newConfiguration[keys[0]] = {};
                newConfiguration[keys[0]][keys[1]] = value;
            } else { newConfiguration[keyPath] = value; }
        });
         if (!formIsValid) { showToastNotification('Some invalid values were reset to defaults before saving.', 'warning'); }
        console.log("Attempting to save configuration:", newConfiguration);
        saveConfigurationButtonElement.disabled = true;
        saveConfigurationButtonElement.textContent = 'Saving...';
        try {
            const response = await fetch('/api/save-maintenance-config', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newConfiguration)
            });
            const result = await response.json();
            if (result.success) {
                maintenanceIntervalConfiguration = newConfiguration;
                showToastNotification('Configuration saved successfully!', 'success');
                renderMaintenanceAlerts(allCostControlData);
            } else { throw new Error(result.message || 'Failed to save configuration.'); }
        } catch (error) {
            console.error("Error saving interval configuration via API:", error);
            showToastNotification(`Failed to save configuration: ${error.message}`, 'error');
        } finally {
             saveConfigurationButtonElement.disabled = false;
             saveConfigurationButtonElement.textContent = 'Save Configuration';
        }
    }

    function populateConfigurationForm() {
        if (!configurationFormElement || !maintenanceIntervalConfiguration || Object.keys(maintenanceIntervalConfiguration).length === 0) {
             console.warn("Configuration form or interval configuration not ready/empty.");
             if (typeof maintenanceIntervalConfiguration !== 'object' || maintenanceIntervalConfiguration === null || Object.keys(maintenanceIntervalConfiguration).length === 0) {
                 maintenanceIntervalConfiguration = JSON.parse(JSON.stringify(DEFAULT_INTERVALS));
                 console.log("Using pure defaults for config form population.");
             } else { return; }
        }
        configurationFormElement.querySelectorAll('[data-config-key]').forEach(element => {
            const keyPath = element.dataset.configKey;
             if (keyPath.startsWith('air_filter_change.') || keyPath.startsWith('other.') || keyPath.startsWith('others.')) return;
            const keys = keyPath.split('.');
            let configurationValue;
            if (keys.length === 2) { configurationValue = maintenanceIntervalConfiguration[keys[0]] ? maintenanceIntervalConfiguration[keys[0]][keys[1]] : undefined; }
            else { configurationValue = maintenanceIntervalConfiguration[keyPath]; }
            if (configurationValue === undefined) {
                 let defaultValue;
                 if (keys.length === 2) { defaultValue = DEFAULT_INTERVALS[keys[0]] ? DEFAULT_INTERVALS[keys[0]][keys[1]] : undefined; }
                 else { defaultValue = DEFAULT_INTERVALS[keyPath]; }
                 configurationValue = defaultValue;
            }
             if (configurationValue === undefined) {
                if (element.tagName === 'SELECT') configurationValue = 'monthly';
                else if (element.type === 'number') configurationValue = keyPath === 'alert_threshold_days' ? 0 : 1;
                else configurationValue = '';
            }
            element.value = configurationValue;
        });
        console.log("Configuration form populated.");
    }

    async function fetchCoreData() {
        costControlTableBodyElement.innerHTML = `<tr><td colspan="14" class="p-4 text-center">Loading cost data...</td></tr>`;
        alertsContentElement.innerHTML = '<p class="text-muted-foreground">Loading alerts...</p>';
        try {
            const [technicianCarsResponse, costControlResponse] = await Promise.all([
                fetch('/api/get-tech-cars-data'),
                fetch('/api/get-cost-control-data')
            ]);
            if (!technicianCarsResponse.ok) {
                 let errorMessage = 'Failed to load technician/car list.';
                 try { const errorJson = await technicianCarsResponse.json(); errorMessage = errorJson.error || errorJson.message || errorMessage; } catch(error){ errorMessage = `Status: ${technicianCarsResponse.status}`; }
                 throw new Error(errorMessage);
            }
            const technicianCarsResult = await technicianCarsResponse.json();
            technicianCarsData = technicianCarsResult.techCars || [];

            const techNames = technicianCarsData.map(car => car.tech_name);
            const vinNumbers = technicianCarsData.map(car => car.vin_number);
            const carPlates = technicianCarsData.map(car => car.car_plate);

            populateSimpleDropdown(technicianSelectElement, techNames, 'Select Technician...');
            populateSimpleDropdown(vinSelectElement, vinNumbers, 'Select VIN...');
            populateSimpleDropdown(licensePlateSelectElement, carPlates, 'Select Plate...');


            if (!costControlResponse.ok) {
                let errorMessage = 'Failed to load cost control data.';
                try { const errorJson = await costControlResponse.json(); errorMessage = errorJson.error || errorJson.message || errorMessage; } catch(error){ errorMessage = `Status: ${costControlResponse.status}`; }
                throw new Error(errorMessage);
            }
            const costDataResult = await costControlResponse.json();
            allCostControlData = (costDataResult.costs || []).filter(record => record['date'] && createDateObjectFromMMDDYYYY(record['date']));
            if (allCostControlData.length < (costDataResult.costs || []).length) {
                console.warn(`Filtered out ${ (costDataResult.costs || []).length - allCostControlData.length} records due to invalid date format received from API.`);
            }
            renderHistoryTable(allCostControlData);
            renderMaintenanceAlerts(allCostControlData);
        } catch (error) {
            console.error('Error fetching cost/car data:', error);
            showToastNotification(`Error loading data: ${error.message}`, 'error');
            costControlTableBodyElement.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-red-600">Failed to load cost data. ${error.message}</td></tr>`;
            alertsContentElement.innerHTML = `<p class="text-destructive">Failed to load alert data. ${error.message}</p>`;
            if (technicianSelectElement) { technicianSelectElement.disabled = true; populateSimpleDropdown(technicianSelectElement, [], 'Error loading'); }
            if (vinSelectElement) { vinSelectElement.disabled = true; populateSimpleDropdown(vinSelectElement, [], 'Error loading'); }
            if (licensePlateSelectElement) { licensePlateSelectElement.disabled = true; populateSimpleDropdown(licensePlateSelectElement, [], 'Error loading'); }
        }
    }

    function renderHistoryTable(dataToRender) {
        const numberOfColumns = 14;
        costControlTableBodyElement.innerHTML = '';
        let currentTotalSum = 0;

        function parsePriceSafely(value) {
            if (value === null || value === undefined) return 0;
            let stringValue = String(value).trim();
            stringValue = stringValue.replace(/[$\s]|R\$/g, '');
            const lastCommaIndex = stringValue.lastIndexOf(',');
            const lastPeriodIndex = stringValue.lastIndexOf('.');
            let decimalSeparator = '.';
            if (lastCommaIndex > lastPeriodIndex) { decimalSeparator = ','; }
            if (decimalSeparator === '.') { stringValue = stringValue.replace(/,/g, ''); }
            else { stringValue = stringValue.replace(/\./g, ''); }
            if (decimalSeparator === ',') { stringValue = stringValue.replace(',', '.'); }
            const parsedValue = parseFloat(stringValue);
            return isNaN(parsedValue) ? 0 : parsedValue;
        }

        if (!Array.isArray(dataToRender) || dataToRender.length === 0) {
            costControlTableBodyElement.innerHTML = `<tr><td colspan="${numberOfColumns}" class="p-4 text-center text-muted-foreground">No maintenance records found.</td></tr>`;
            if (totalPriceSumElement) {
                totalPriceSumElement.textContent = '$0.00';
            }
            return;
        }
        const sortedData = dataToRender.sort((recordA, recordB) => {
             const dateObjectA = createDateObjectFromMMDDYYYY(recordA['date']);
             const dateObjectB = createDateObjectFromMMDDYYYY(recordB['date']);
             if (!dateObjectA && !dateObjectB) return 0;
             if (!dateObjectA) return 1;
             if (!dateObjectB) return -1;
             return dateObjectB.getTime() - dateObjectA.getTime();
        });
        sortedData.forEach(record => {
            const tableRowElement = document.createElement('tr');
            tableRowElement.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            const isChecked = (value) => value && String(value).toUpperCase() === 'TRUE' ? '✔️' : '❌';
            const rawPriceForDisplay = record['price'] || '';
            const priceValueForSum = parsePriceSafely(record['price']);
            currentTotalSum += priceValueForSum;
            const fullDescription = record['description'] || '';
            const shortDescription = fullDescription.length > 15 ? fullDescription.substring(0, 15) + '...' : fullDescription;

            // Ajuste na ordem e no conteúdo das células
            tableRowElement.innerHTML = `
                <td class="p-4 whitespace-nowrap">${formatDateForDisplay(record['date'])}</td>
                <td class="p-4">${record['license_plate'] || ''}</td>
                <td class="p-4">${record['odometer'] || ''}</td>
                <td class="p-4">${record['cost_type'] || ''}</td>
                <td class="p-4">${record['subtype'] || ''}</td>
                <td class="p-4">${record['technician'] || ''}</td>
                <td class="p-4 text-right">${rawPriceForDisplay}</td>
                <td class="p-4 max-w-[150px] truncate" title="${fullDescription}">${shortDescription}</td>
                <td class="p-4">${record['invoice_number'] || ''}</td>
                <td class="p-4 text-center">${isChecked(record['tire_change'])}</td>
                <td class="p-4 text-center">${isChecked(record['oil_and_filter_change'])}</td>
                <td class="p-4 text-center">${isChecked(record['brake_change'])}</td>
                <td class="p-4 text-center">${isChecked(record['battery_change'])}</td>
                <td class="p-4 text-center">${isChecked(record['others'])}</td>
            `;
            costControlTableBodyElement.appendChild(tableRowElement);
        });
        if (totalPriceSumElement) {
            totalPriceSumElement.textContent = `$${currentTotalSum.toFixed(2)}`;
        }
    }

    function renderMaintenanceAlerts(costData) {
        alertsContentElement.innerHTML = '';
        let anyAlertsGenerated = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const alertThresholdInDays = parseInt(maintenanceIntervalConfiguration.alert_threshold_days, 10);
        const validThresholdInDays = (!isNaN(alertThresholdInDays) && alertThresholdInDays >= 0) ? alertThresholdInDays : DEFAULT_INTERVALS.alert_threshold_days;
        const alertThresholdDate = new Date(today);
        alertThresholdDate.setDate(today.getDate() + validThresholdInDays);
        const vehicleMaintenanceData = {};
        costData.forEach(record => {
            if (record['license_plate']) {
                const plate = record['license_plate'].toUpperCase().trim();
                const recordDateObject = createDateObjectFromMMDDYYYY(record['date']);
                if (!recordDateObject) return;
                if (!vehicleMaintenanceData[plate]) { vehicleMaintenanceData[plate] = { records: [], lastTechnician: record['technician'] }; }
                vehicleMaintenanceData[plate].records.push({
                    date: recordDateObject,
                    tire_change: String(record['tire_change']).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record['oil_and_filter_change']).toUpperCase() === 'TRUE',
                    brake_change: String(record['brake_change']).toUpperCase() === 'TRUE',
                    battery_change: String(record['battery_change']).toUpperCase() === 'TRUE',
                    // Não precisa mais ler air_filter_change aqui para alertas
                    others: String(record['others']).toUpperCase() === 'TRUE', // Inclui 'others' se necessário para futuras lógicas
                    cost_type: record['cost_type'],
                });
                vehicleMaintenanceData[plate].lastTechnician = record['technician'];
            }
        });
        for (const plate in vehicleMaintenanceData) {
            const carInformation = technicianCarsData.find(car => car.car_plate && car.car_plate.toUpperCase().trim() === plate);
            const vinNumber = carInformation ? carInformation.vin_number : 'N/A';
            const technicianName = vehicleMaintenanceData[plate].lastTechnician || (carInformation ? carInformation.tech_name : 'N/A');
            const vehicleRecords = vehicleMaintenanceData[plate].records.sort((recordA, recordB) => recordB.date.getTime() - recordA.date.getTime());
            if (vehicleRecords.length === 0) continue;
            let alertMessagesForVehicle = [];
            let highestSeverityLevel = 'info';
            for (const categoryKey in MAINTENANCE_CATEGORIES) {
                 // Pula 'others' e 'air_filter_change' (se ainda existir nos dados antigos) para alertas
                 if (categoryKey === 'air_filter_change' || categoryKey === 'others') continue;
                const categoryConfiguration = maintenanceIntervalConfiguration[categoryKey];
                if (!categoryConfiguration || !categoryConfiguration.type || isNaN(categoryConfiguration.value) || categoryConfiguration.value <= 0) continue;
                let lastPerformedRecord;
                 lastPerformedRecord = vehicleRecords.find(record => record[categoryKey] === true);
                const categoryDisplayName = MAINTENANCE_CATEGORIES[categoryKey];
                if (lastPerformedRecord) {
                    const dueDate = calculateDueDate(lastPerformedRecord.date, categoryConfiguration.value, categoryConfiguration.type);
                    if (dueDate && !isNaN(dueDate)) {
                        if (dueDate <= today) {
                            alertMessagesForVehicle.push(`${categoryDisplayName} due (Last: ${formatDateForDisplay(lastPerformedRecord.date)})`);
                            highestSeverityLevel = 'error';
                        } else if (dueDate <= alertThresholdDate) {
                            alertMessagesForVehicle.push(`${categoryDisplayName} soon (Due: ${formatDateForDisplay(dueDate)})`);
                            if (highestSeverityLevel !== 'error') highestSeverityLevel = 'warning';
                        }
                    }
                }
            }
            if (alertMessagesForVehicle.length > 0) {
                createAlertHTML(plate, vinNumber, technicianName, alertMessagesForVehicle, highestSeverityLevel);
                anyAlertsGenerated = true;
            }
        }
        if (!anyAlertsGenerated) {
            alertsContentElement.innerHTML = '<p class="text-muted-foreground">No immediate maintenance alerts found based on configured intervals.</p>';
        }
    }

    function createAlertHTML(plate, vinNumber, technicianName, messages, severityType) {
        const alertDivElement = document.createElement('div');
        let borderColorClass = 'border-border';
        let backgroundColorClass = 'bg-muted/10';
        let titlePrefix = 'Info';
        let titleColorClass = 'text-foreground';
        if (severityType === 'warning') {
            borderColorClass = 'border-yellow-500'; backgroundColorClass = 'bg-yellow-500/10';
            titlePrefix = 'Warning'; titleColorClass = 'text-yellow-700 dark:text-yellow-300';
        } else if (severityType === 'error') {
            borderColorClass = 'border-destructive'; backgroundColorClass = 'bg-destructive/10';
            titlePrefix = 'Alert / Due'; titleColorClass = 'text-destructive';
        }
       alertDivElement.className = `p-3 border ${borderColorClass} rounded-lg ${backgroundColorClass} mb-2`;
       const messageString = messages.join(' • ');
       const titleText = `${titlePrefix}: Vehicle ${plate} (VIN: ${vinNumber || 'N/A'}, Tech: ${technicianName || 'N/A'})`;
       alertDivElement.innerHTML = `
           <div class="flex justify-between items-center"><span class="font-semibold text-sm ${titleColorClass}">${titleText}</span></div>
           <p class="text-xs text-foreground mt-1">${messageString}</p>
       `;
       alertsContentElement.appendChild(alertDivElement);
    }

    costControlFormElement.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(costControlFormElement);
        const registrationData = {};

        registrationData['technician'] = technicianSelectElement.value;
        registrationData['vin'] = vinSelectElement.value;
        registrationData['license_plate'] = licensePlateSelectElement.value;

        formData.forEach((value, key) => {
            if (key !== 'technician' && key !== 'vin' && key !== 'license_plate') {
                if (key === 'price' && typeof value === 'string') {
                    registrationData[key] = value.replace(',', '.');
                } else {
                    registrationData[key] = value;
                }
            }
        });

        // Inclui 'others', remove 'air_filter_change'
        ['tire_change', 'oil_and_filter_change', 'brake_change', 'battery_change', 'others'].forEach(key => {
            registrationData[key] = formData.has(key) ? 'TRUE' : 'FALSE';
        });
        // Garante que air_filter_change não seja enviado se ainda existir no form por algum motivo
        delete registrationData['air_filter_change'];


        if (!registrationData.technician) { showToastNotification('Please select a Technician (Driver).', 'error'); return; }
        if (!registrationData.vin) { showToastNotification('Please select a VIN.', 'error'); return; }
        if (!registrationData.license_plate) { showToastNotification('Please select a License Plate.', 'error'); return; }
        if (!registrationData.date || !registrationData.odometer || !registrationData.cost_type || registrationData.price === undefined || registrationData.price === '') {
             showToastNotification('Date, Odometer, Cost Type, and Price are required.', 'error'); return; }

        const submitButtonElement = costControlFormElement.querySelector('button[type="submit"]');
        submitButtonElement.disabled = true;
        submitButtonElement.textContent = 'Saving...';
        try {
            const response = await fetch('/api/register-cost-control', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(registrationData),
            });
            if (!response.ok) {
                let errorText = `Server error ${response.status}`;
                try { const errorResult = await response.json(); errorText = errorResult.message || errorText; } catch(error) {}
                 console.error("API Error Response:", await response.text());
                 throw new Error(`Failed to save record: ${errorText}`);
            }
            const result = await response.json();
            if (result.success) {
                showToastNotification('Record saved successfully!', 'success');
                costControlFormElement.reset();
                setTodaysDateInRegistrationForm();
                if (technicianSelectElement) technicianSelectElement.value = '';
                if (vinSelectElement) vinSelectElement.value = '';
                if (licensePlateSelectElement) licensePlateSelectElement.value = '';
                await initializePage();
            } else { throw new Error(result.message || 'Failed to save record.'); }
        } catch (error) {
            console.error('Error submitting form:', error);
            showToastNotification(`Error: ${error.message || 'Could not save record.'}`, 'error');
        } finally {
            submitButtonElement.disabled = false;
            submitButtonElement.textContent = 'Save Record';
        }
    });

    if (saveConfigurationButtonElement) { saveConfigurationButtonElement.addEventListener('click', saveMaintenanceIntervalConfiguration); }

    async function initializePage() {
        setTodaysDateInRegistrationForm();
        console.log("Initializing page, loading configuration...");
        maintenanceIntervalConfiguration = await loadMaintenanceIntervalConfiguration();
        console.log("Configuration loaded, populating configuration form...");
        populateConfigurationForm();
        console.log("Configuration form populated, fetching core data (cars/costs)...");
        await fetchCoreData();
        if (totalPriceSumElement) {
        }
        console.log("Initialization complete.");
    }

    initializePage();

});
