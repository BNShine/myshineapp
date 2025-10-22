document.addEventListener('DOMContentLoaded', async () => {
    const costControlFormElement = document.getElementById('cost-control-form');
    const costControlTableBodyElement = document.getElementById('cost-control-table-body');
    const technicianSelectElement = document.getElementById('technician');
    const licensePlateInputElement = document.getElementById('license_plate');
    const vinInputElement = document.getElementById('vin');
    const alertsContentElement = document.getElementById('alerts-content');
    const toastContainerElement = document.getElementById('toast-container');
    const configurationFormElement = document.getElementById('config-form');
    const saveConfigurationButtonElement = document.getElementById('save-config-btn');
    const filterHistorySectionElement = document.getElementById('filter-history-section');
    const filterStartDateInputElement = document.getElementById('filter-start-date');
    const filterEndDateInputElement = document.getElementById('filter-end-date');
    const filterTechnicianSelectElement = document.getElementById('filter-technician');
    const filterLicensePlateInputElement = document.getElementById('filter-license-plate');
    const searchHistoryButtonElement = document.getElementById('search-history-btn');
    const listingSectionElement = document.getElementById('listing-section');

    let allCostControlData = [];
    let technicianCarsData = [];
    let maintenanceIntervalConfiguration = {};

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

    function populateDropdown(selectElement, items, defaultText = 'Select...', valueKey = null, textKey = null) {
         selectElement.innerHTML = `<option value="">${defaultText}</option>`;
        if (items && Array.isArray(items)) {
            items.sort((itemA, itemB) => {
                const textA = textKey ? (itemA[textKey] || '') : (itemA || '');
                const textB = textKey ? (itemB[textKey] || '') : (itemB || '');
                return textA.localeCompare(textB);
            }).forEach(item => {
                const value = valueKey ? (item[valueKey] || '') : (item || '');
                const text = textKey ? (item[textKey] || '') : (item || '');
                if (value) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = text;
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
            populateDropdown(technicianSelectElement, technicianCarsData, 'Select Technician...', 'tech_name', 'tech_name');
            populateDropdown(filterTechnicianSelectElement, technicianCarsData, 'All Technicians', 'tech_name', 'tech_name');
            if (!costControlResponse.ok) {
                let errorMessage = 'Failed to load cost control data.';
                try { const errorJson = await costControlResponse.json(); errorMessage = errorJson.error || errorJson.message || errorMessage; } catch(error){ errorMessage = `Status: ${costControlResponse.status}`; }
                throw new Error(errorMessage);
            }
            const costDataResult = await costControlResponse.json();
            allCostControlData = (costDataResult.costs || []).filter(record => record.date && formatDateForInput(record.date));
            costControlTableBodyElement.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>`;
            renderMaintenanceAlerts(allCostControlData);
        } catch (error) {
            console.error('Error fetching cost/car data:', error);
            showToastNotification(`Error loading data: ${error.message}`, 'error');
            costControlTableBodyElement.innerHTML = `<tr><td colspan="14" class="p-4 text-center text-red-600">Failed to load cost data. ${error.message}</td></tr>`;
            alertsContentElement.innerHTML = `<p class="text-destructive">Failed to load alert data. ${error.message}</p>`;
            if (technicianSelectElement) { technicianSelectElement.disabled = true; populateDropdown(technicianSelectElement, [], 'Error loading'); }
            if (filterTechnicianSelectElement) { filterTechnicianSelectElement.disabled = true; populateDropdown(filterTechnicianSelectElement, [], 'Error loading'); }
        }
    }

    function renderHistoryTable(dataToRender) {
        const numberOfColumns = 14;
        costControlTableBodyElement.innerHTML = '';
        if (!Array.isArray(dataToRender) || dataToRender.length === 0) {
            if (listingSectionElement.classList.contains('hidden')) {
                costControlTableBodyElement.innerHTML = `<tr><td colspan="${numberOfColumns}" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>`;
            } else {
                costControlTableBodyElement.innerHTML = `<tr><td colspan="${numberOfColumns}" class="p-4 text-center text-muted-foreground">No maintenance records found matching your filters.</td></tr>`;
            }
            return;
        }
        const sortedData = dataToRender.sort((recordA, recordB) => {
             const dateStringA = formatDateForInput(recordA.date);
             const dateStringB = formatDateForInput(recordB.date);
             if (!dateStringA && !dateStringB) return 0;
             if (!dateStringA) return 1;
             if (!dateStringB) return -1;
             const dateObjectA = new Date(dateStringA);
             const dateObjectB = new Date(dateStringB);
             return dateObjectB.getTime() - dateObjectA.getTime();
        });
        sortedData.forEach(record => {
            const tableRowElement = document.createElement('tr');
            tableRowElement.classList.add('border-b', 'border-border', 'hover:bg-muted/50', 'transition-colors');
            const isChecked = (value) => value && String(value).toUpperCase() === 'TRUE' ? '✔️' : '❌';
            const priceValue = parseFloat(record.price);
            const fullDescription = record.description || '';
            const shortDescription = fullDescription.length > 15 ? fullDescription.substring(0, 15) + '...' : fullDescription;

            tableRowElement.innerHTML = `
                <td class="p-4 whitespace-nowrap">${formatDateForDisplay(record['date'])}</td>
                <td class="p-4">${record['license_plate'] || ''}</td>
                <td class="p-4">${record['odometer'] || ''}</td>
                <td class="p-4">${record['cost_type'] || ''}</td>
                <td class="p-4">${record['subtype'] || ''}</td>
                <td class="p-4">${record['technician'] || ''}</td>
                <td class="p-4 text-right">${!isNaN(priceValue) ? `$${priceValue.toFixed(2)}` : ''}</td>
                <td class="p-4 max-w-[150px] truncate" title="${fullDescription}">${shortDescription}</td>
                <td class="p-4">${record['invoice_number'] || ''}</td>
                <td class="p-4 text-center">${isChecked(record['tire_change'])}</td>
                <td class="p-4 text-center">${isChecked(record['oil_and_filter_change'])}</td>
                <td class="p-4 text-center">${isChecked(record['brake_change'])}</td>
                <td class="p-4 text-center">${isChecked(record['battery_change'])}</td>
                <td class="p-4 text-center">${isChecked(record['air_filter_change'])}</td>
            `;
            costControlTableBodyElement.appendChild(tableRowElement);
        });
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
                const recordDateString = formatDateForInput(record['date']);
                const recordDateObject = recordDateString ? new Date(recordDateString + "T00:00:00") : null;
                if (!recordDateObject || isNaN(recordDateObject)) return;
                if (!vehicleMaintenanceData[plate]) { vehicleMaintenanceData[plate] = { records: [], lastTechnician: record['technician'] }; }
                vehicleMaintenanceData[plate].records.push({
                    date: recordDateObject,
                    tire_change: String(record['tire_change']).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record['oil_and_filter_change']).toUpperCase() === 'TRUE',
                    brake_change: String(record['brake_change']).toUpperCase() === 'TRUE',
                    battery_change: String(record['battery_change']).toUpperCase() === 'TRUE',
                    air_filter_change: String(record['air_filter_change']).toUpperCase() === 'TRUE',
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
                const categoryConfiguration = maintenanceIntervalConfiguration[categoryKey];
                if (!categoryConfiguration || !categoryConfiguration.type || isNaN(categoryConfiguration.value) || categoryConfiguration.value <= 0) continue;
                let lastPerformedRecord;
                 if (categoryKey === 'other') {
                    lastPerformedRecord = vehicleRecords.find(record =>
                        (record.cost_type === 'Maintenance' || record.cost_type === 'Repair') &&
                        !record.tire_change && !record.oil_and_filter_change && !record.brake_change && !record.battery_change && !record.air_filter_change
                    );
                 } else { lastPerformedRecord = vehicleRecords.find(record => record[categoryKey] === true); }
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

    function handleTechnicianSelectionChange() {
        const selectedTechnicianName = technicianSelectElement.value;
        const selectedTechnicianCarData = technicianCarsData.find(tech => tech.tech_name === selectedTechnicianName);
        if (selectedTechnicianCarData) {
            vinInputElement.value = selectedTechnicianCarData.vin_number || '';
            licensePlateInputElement.value = selectedTechnicianCarData.car_plate || '';
        } else {
            vinInputElement.value = '';
            licensePlateInputElement.value = '';
        }
    }

    costControlFormElement.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(costControlFormElement);
        const registrationData = {};
        formData.forEach((value, key) => {
            if (key === 'price' && typeof value === 'string') { registrationData[key] = value.replace(',', '.'); }
            else { registrationData[key] = value; }
        });
        registrationData['vin'] = vinInputElement.value;
        registrationData['license_plate'] = licensePlateInputElement.value;
        ['tire_change', 'oil_and_filter_change', 'brake_change', 'battery_change', 'air_filter_change'].forEach(key => {
            registrationData[key] = formData.has(key) ? 'TRUE' : 'FALSE';
        });
        if (!registrationData.technician) { showToastNotification('Please select a Technician (Driver).', 'error'); return; }
        if (!registrationData.license_plate || !registrationData.vin) { showToastNotification('VIN and License Plate must be autofilled by selecting a Technician.', 'error'); return; }
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
                vinInputElement.value = '';
                licensePlateInputElement.value = '';
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

    searchHistoryButtonElement.addEventListener('click', () => {
        const startDateString = filterStartDateInputElement.value;
        const endDateString = filterEndDateInputElement.value;
        const technicianName = filterTechnicianSelectElement.value;
        const licensePlateQuery = filterLicensePlateInputElement.value.trim().toLowerCase();
        const startDate = startDateString ? new Date(startDateString + 'T00:00:00') : null;
        const endDate = endDateString ? new Date(endDateString + 'T23:59:59') : null;
        const filteredData = allCostControlData.filter(record => {
            const recordDateString = formatDateForInput(record['date']);
            const recordDateObject = recordDateString ? new Date(recordDateString + 'T00:00:00') : null;
            if (!recordDateObject || isNaN(recordDateObject)) return false;
            const matchesDateRange = (!startDate || recordDateObject >= startDate) && (!endDate || recordDateObject <= endDate);
            const matchesTechnician = !technicianName || (record['technician'] && record['technician'] === technicianName);
            const matchesLicensePlate = !licensePlateQuery || (record['license_plate'] && record['license_plate'].toLowerCase().includes(licensePlateQuery));
            return matchesDateRange && matchesTechnician && matchesLicensePlate;
        });
        listingSectionElement.classList.remove('hidden');
        renderHistoryTable(filteredData);
    });

    if (technicianSelectElement) { technicianSelectElement.addEventListener('change', handleTechnicianSelectionChange); }
    if (saveConfigurationButtonElement) { saveConfigurationButtonElement.addEventListener('click', saveMaintenanceIntervalConfiguration); }

    async function initializePage() {
        setTodaysDateInRegistrationForm();
        console.log("Initializing page, loading configuration...");
        maintenanceIntervalConfiguration = await loadMaintenanceIntervalConfiguration();
        console.log("Configuration loaded, populating configuration form...");
        populateConfigurationForm();
        console.log("Configuration form populated, fetching core data (cars/costs)...");
        await fetchCoreData();
        console.log("Initialization complete.");
    }

    initializePage();

});
