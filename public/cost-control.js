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

    // NEW: Configuration Form Selectors
    const configForm = document.getElementById('config-form');
    const saveConfigBtn = document.getElementById('save-config-btn');

    // NEW: History Filter Selectors
    const filterHistorySection = document.getElementById('filter-history-section');
    const filterStartDateInput = document.getElementById('filter-start-date');
    const filterEndDateInput = document.getElementById('filter-end-date');
    const filterTechnicianSelect = document.getElementById('filter-technician');
    const filterLicensePlateInput = document.getElementById('filter-license-plate');
    const searchHistoryBtn = document.getElementById('search-history-btn');
    const listingSection = document.getElementById('listing-section'); // The history table section

    let allCostData = [];
    let techCarsData = [];
    let intervalConfig = loadIntervalConfig(); // Load config on start

    // --- Configuration Constants ---
    const MAINTENANCE_CATEGORIES = {
        'tire_change': 'Tire Change',
        'oil_and_filter_change': 'Oil & Filter Change',
        'brake_change': 'Brake Change',
        'battery_change': 'Battery Change',
        'air_filter_change': 'Air Filter Change',
        'other': 'Other Maintenance' // Generic for other types if needed
    };

    const DEFAULT_INTERVALS = {
        'tire_change': { type: 'monthly', value: 6 },
        'oil_and_filter_change': { type: 'monthly', value: 2 },
        'brake_change': { type: 'monthly', value: 4 },
        'battery_change': { type: 'monthly', value: 24 }, // Example default
        'air_filter_change': { type: 'monthly', value: 12 }, // Example default
        'other': { type: 'monthly', value: 12 }, // Example default for 'Other' type
        'alert_threshold_days': 15 // Default warning period
    };

    // --- Toast Notification ---
    function showToast(message, type = 'info') {
        // ... (keep existing showToast function) ...
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
        // ... (keep existing formatDateForDisplay function) ...
         if (!dateStr) return '';
        if (dateStr.includes('/') && !dateStr.includes('-')) {
             const parts = dateStr.split('/');
             if (parts.length === 3 && parts[2] && parts[2].length === 4) return dateStr;
        }
        const [year, month, day] = dateStr.split('-');
        if (year && month && day && year.length === 4) {
            return `${month}/${day}/${year}`;
        }
        // Attempt parsing if it's potentially a JS Date string output (e.g., from new Date())
        try {
            const d = new Date(dateStr);
            if (!isNaN(d)) {
                 const y = d.getFullYear();
                 const m = String(d.getMonth() + 1).padStart(2, '0');
                 const dy = String(d.getDate()).padStart(2, '0');
                 return `${m}/${dy}/${y}`;
            }
        } catch(e){}

        console.warn("Could not format date for display:", dateStr)
        return dateStr;
    }

    function formatDateForInput(dateInput) {
        // ... (keep existing formatDateForInput function) ...
         if (!dateInput) return '';
        let dateObj;
        if (dateInput instanceof Date) {
            dateObj = dateInput;
        } else if (typeof dateInput === 'string') {
            if (dateInput.includes('/')) {
                 const parts = dateInput.split('/');
                 if (parts.length === 3 && parts[2] && parts[2].length === 4) {
                     dateObj = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
                 }
            } else if (dateInput.includes('-')) {
                 const parts = dateInput.split('-');
                 if (parts.length === 3 && parts[0].length === 4) {
                     const tempDate = new Date(dateInput + "T00:00:00");
                     if (!isNaN(tempDate)) {
                         return dateInput;
                     }
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
        return '';
    }

    // --- Date Calculation Helpers ---
    // Modified addMonths to handle weeks as well
    function calculateDueDate(startDate, intervalValue, intervalType) {
        if (!startDate || isNaN(intervalValue) || intervalValue <= 0) return null;
        const d = new Date(startDate);
        const originalDay = d.getDate();

        if (intervalType === 'monthly') {
            d.setMonth(d.getMonth() + intervalValue);
            if (d.getDate() !== originalDay) {
                d.setDate(0); // Adjust to last day of target month if day changed
            }
        } else if (intervalType === 'weekly') {
            d.setDate(d.getDate() + (intervalValue * 7));
        } else {
            return null; // Invalid type
        }
        return d;
    }


    // --- Dropdown Population ---
    function populateDropdown(selectElement, items, defaultText = 'Select...', valueKey = null, textKey = null) {
        // ... (keep existing populateDropdown function) ...
         selectElement.innerHTML = `<option value="">${defaultText}</option>`;
        if (items && Array.isArray(items)) {
            items.sort((a, b) => {
                const textA = textKey ? (a[textKey] || '') : (a || '');
                const textB = textKey ? (b[textKey] || '') : (b || '');
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

    // --- Set Today's Date ---
    function setTodaysDate() {
        // ... (keep existing setTodaysDate function) ...
        const today = new Date();
        const dateInput = document.getElementById('date');
        if (dateInput) {
            dateInput.value = formatDateForInput(today);
        }
    }


    // --- NEW: Configuration Management ---
    function loadIntervalConfig() {
        try {
            const storedConfig = localStorage.getItem('maintenanceIntervalConfig');
            // Merge stored config with defaults, ensuring all default keys exist
            return { ...DEFAULT_INTERVALS, ...(storedConfig ? JSON.parse(storedConfig) : {}) };
        } catch (e) {
            console.error("Error loading interval config:", e);
            return { ...DEFAULT_INTERVALS }; // Return defaults on error
        }
    }

    function saveIntervalConfig() {
        const newConfig = { ...intervalConfig }; // Start with current/loaded config
        // Iterate through form elements with data-config-key attribute
        configForm.querySelectorAll('[data-config-key]').forEach(el => {
            const keyPath = el.dataset.configKey;
            const value = el.type === 'number' ? parseInt(el.value, 10) || 1 : el.value; // Default number to 1 if invalid

            // Handle nested keys like 'tire_change.type'
            const keys = keyPath.split('.');
            if (keys.length === 2) {
                if (!newConfig[keys[0]]) newConfig[keys[0]] = {}; // Ensure parent object exists
                newConfig[keys[0]][keys[1]] = value;
            } else {
                newConfig[keyPath] = value; // Direct key like 'alert_threshold_days'
            }
        });

        // Validate threshold days
        if (isNaN(newConfig.alert_threshold_days) || newConfig.alert_threshold_days < 0) {
            newConfig.alert_threshold_days = DEFAULT_INTERVALS.alert_threshold_days; // Reset to default if invalid
        }

        try {
            localStorage.setItem('maintenanceIntervalConfig', JSON.stringify(newConfig));
            intervalConfig = newConfig; // Update global state
            showToast('Configuration saved successfully!', 'success');
            // Re-render alerts immediately after saving config
            renderAlerts(allCostData);
        } catch (e) {
            console.error("Error saving interval config:", e);
            showToast('Failed to save configuration.', 'error');
        }
    }

    function populateConfigForm() {
        configForm.querySelectorAll('[data-config-key]').forEach(el => {
            const keyPath = el.dataset.configKey;
            const keys = keyPath.split('.');
            let value;
            if (keys.length === 2) {
                value = intervalConfig[keys[0]] ? intervalConfig[keys[0]][keys[1]] : undefined;
            } else {
                value = intervalConfig[keyPath];
            }

            // Set default value if config value is missing
            let defaultValue;
            if (keys.length === 2) {
                 defaultValue = DEFAULT_INTERVALS[keys[0]] ? DEFAULT_INTERVALS[keys[0]][keys[1]] : undefined;
            } else {
                 defaultValue = DEFAULT_INTERVALS[keyPath];
            }

            el.value = value !== undefined ? value : (defaultValue !== undefined ? defaultValue : '');
        });
    }

    // --- Fetch Initial Data ---
    async function fetchInitialData() {
        // Set initial state for table and alerts
        costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center">Loading initial data...</td></tr>';
        alertsContent.innerHTML = '<p class="text-muted-foreground">Loading alerts...</p>';
        try {
            const [techCarsResponse, costResponse] = await Promise.all([
                fetch('/api/get-tech-cars-data'),
                fetch('/api/get-cost-control-data')
            ]);

            if (!techCarsResponse.ok) { /* ... (keep existing error handling) ... */
                let errorMsg = 'Failed to load technician/car list.';
                 try { const errorJson = await techCarsResponse.json(); errorMsg = errorJson.error || errorJson.message || errorMsg; } catch(e){ errorMsg = `Status: ${techCarsResponse.status}`; }
                 throw new Error(errorMsg);
            }
            const techCarsResult = await techCarsResponse.json();
            techCarsData = techCarsResult.techCars || [];
            populateDropdown(technicianSelect, techCarsData, 'Select Technician...', 'tech_name', 'tech_name');
            // NEW: Populate history filter dropdown
            populateDropdown(filterTechnicianSelect, techCarsData, 'All Technicians', 'tech_name', 'tech_name');

            if (!costResponse.ok) { /* ... (keep existing error handling) ... */
                 let errorMsg = 'Failed to load cost control data.';
                 try { const errorJson = await costResponse.json(); errorMsg = errorJson.error || errorJson.message || errorMsg; } catch(e){ errorMsg = `Status: ${costResponse.status}`; }
                throw new Error(errorMsg);
            }
            const costDataResult = await costResponse.json();
            allCostData = (costDataResult.costs || []).filter(record => record.date && formatDateForInput(record.date));

            // MODIFIED: Don't render table on initial load, only alerts
            costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>'; // Set initial message
            renderAlerts(allCostData);

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
            // Display different message based on whether it's initial state or no results from filter
             if (listingSection.classList.contains('hidden')) { // Check if section is still hidden (initial state)
                costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-muted-foreground">Use the filters above and click "Search History" to view records.</td></tr>';
            } else {
                costControlTableBody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-muted-foreground">No maintenance records found matching your filters.</td></tr>';
            }
            return;
        }

        const sortedData = data.sort((a, b) => {
             const dateA = a.date ? new Date(formatDateForInput(a.date)) : 0;
             const dateB = b.date ? new Date(formatDateForInput(b.date)) : 0;
             const timeA = !isNaN(dateA) ? dateA.getTime() : 0;
             const timeB = !isNaN(dateB) ? dateB.getTime() : 0;
             return timeB - timeA;
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
                 {/* Display new checkbox states */}
                <td class="p-4 text-center">${isChecked(record.battery_change)}</td>
                <td class="p-4 text-center">${isChecked(record.air_filter_change)}</td>
            `;
            costControlTableBody.appendChild(row);
        });
    }

    // --- REVISED: Alert Logic (Using Config, Grouped by Vehicle) ---
    function renderAlerts(data) {
        alertsContent.innerHTML = '';
        let hasAnyAlerts = false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alertThresholdDays = intervalConfig.alert_threshold_days || DEFAULT_INTERVALS.alert_threshold_days; // Get threshold from config
        const alertThresholdDate = new Date(today);
        alertThresholdDate.setDate(today.getDate() + alertThresholdDays);

        const vehicleData = {};

        // 1. Group records by plate
        data.forEach(record => {
            if (record.license_plate) {
                const plate = record.license_plate.toUpperCase().trim();
                const recordDate = record.date ? new Date(formatDateForInput(record.date)) : null;
                if (!recordDate || isNaN(recordDate)) return;

                if (!vehicleData[plate]) vehicleData[plate] = [];
                // Store relevant info
                vehicleData[plate].push({
                    date: recordDate,
                    tire_change: String(record.tire_change).toUpperCase() === 'TRUE',
                    oil_and_filter_change: String(record.oil_and_filter_change).toUpperCase() === 'TRUE',
                    brake_change: String(record.brake_change).toUpperCase() === 'TRUE',
                    battery_change: String(record.battery_change).toUpperCase() === 'TRUE',
                    air_filter_change: String(record.air_filter_change).toUpperCase() === 'TRUE',
                    cost_type: record.cost_type // Needed for 'Other' type check
                });
            }
        });

        // 2. Process each vehicle
        for (const plate in vehicleData) {
            const records = vehicleData[plate].sort((a, b) => b.date - a.date); // Most recent first
            if (records.length === 0) continue;

            let vehicleAlertMessages = [];
            let highestSeverity = 'info'; // Default to info

            // Check each configured maintenance category
            for (const key in MAINTENANCE_CATEGORIES) {
                const config = intervalConfig[key];
                if (!config || !config.type || !config.value) continue; // Skip if not configured

                let lastRecord;
                 // Find the last record where this specific service was performed
                 if (key === 'other') {
                    // Special case for 'Other': Find last record with cost_type 'Maintenance' or 'Repair' that *wasn't* one of the specific types
                    lastRecord = records.find(r =>
                        (r.cost_type === 'Maintenance' || r.cost_type === 'Repair') &&
                        !r.tire_change && !r.oil_and_filter_change && !r.brake_change && !r.battery_change && !r.air_filter_change
                    );
                 } else {
                    // For specific types like 'tire_change', find the last record where that flag is true
                     lastRecord = records.find(r => r[key] === true);
                 }

                const categoryName = MAINTENANCE_CATEGORIES[key];

                if (lastRecord) {
                    const dueDate = calculateDueDate(lastRecord.date, config.value, config.type);
                    if (dueDate && !isNaN(dueDate)) {
                        if (dueDate <= today) { // Vencido
                            vehicleAlertMessages.push(`${categoryName} due (Last: ${formatDateForDisplay(lastRecord.date)})`);
                            highestSeverity = 'error';
                        } else if (dueDate <= alertThresholdDate) { // Próximo
                            vehicleAlertMessages.push(`${categoryName} soon (Due: ${formatDateForDisplay(dueDate)})`);
                            if (highestSeverity !== 'error') highestSeverity = 'warning';
                        }
                    }
                } else {
                    // Only add "no record found" if it's not the generic 'Other' type
                    if (key !== 'other') {
                        vehicleAlertMessages.push(`No ${categoryName} record found`);
                    }
                }
            } // End loop through categories

            // 3. Create a single alert div for the vehicle if needed
            if (vehicleAlertMessages.length > 0) {
                createAlert(plate, vehicleAlertMessages, highestSeverity);
                hasAnyAlerts = true;
            }
        } // End loop through vehicles

        if (!hasAnyAlerts) {
            alertsContent.innerHTML = '<p class="text-muted-foreground">No immediate maintenance alerts found based on configured intervals.</p>';
        }
    }


    // Create Alert HTML (Keep existing compact style)
    function createAlert(plate, messages, type) {
        // ... (keep existing createAlert function) ...
        const alertDiv = document.createElement('div');
        let borderColor = 'border-muted';
        let bgColor = 'bg-muted/10';
        let title = 'Info';
        let titleColor = 'text-blue-700 dark:text-blue-300'; // Cor para info
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
       alertDiv.innerHTML = `
           <div class="flex justify-between items-center">
                <span class="font-semibold text-sm ${titleColor}">${title}: Vehicle ${plate}</span>
           </div>
           <p class="text-xs text-muted-foreground mt-1">${messageString}</p>
       `;
       alertsContent.appendChild(alertDiv);
    }

    // --- Autofill Logic ---
    function handleTechnicianChange() {
        // ... (keep existing handleTechnicianChange function) ...
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
        // ... (keep existing form submission logic, ensuring new checkboxes are handled) ...
        event.preventDefault();
        const formData = new FormData(costControlForm);
        const data = {};
        formData.forEach((value, key) => {
            if (key === 'price' && typeof value === 'string') {
                data[key] = value.replace(',', '.');
            } else { data[key] = value; }
        });
        data['vin'] = vinInput.value;
        data['license_plate'] = licensePlateInput.value;
        // Include new checkboxes
        ['tire_change', 'oil_and_filter_change', 'brake_change', 'battery_change', 'air_filter_change'].forEach(key => {
            data[key] = formData.has(key) ? 'TRUE' : 'FALSE';
        });
        if (!data.technician) { showToast('Please select a Technician (Driver).', 'error'); return; }
        if (!data.license_plate || !data.vin) { showToast('VIN and License Plate must be autofilled by selecting a Technician.', 'error'); return; }

        const submitButton = costControlForm.querySelector('button[type="submit"]');
        submitButton.disabled = true; submitButton.textContent = 'Saving...';
        try {
            const response = await fetch('/api/register-cost-control', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
            });
            if (!response.ok) {
                 let errorText = `Server responded with status: ${response.status}`;
                 try { const errorResult = await response.json(); errorText = errorResult.message || errorText; } catch(e) { try { errorText = await response.text(); if (errorText.length > 150) errorText = errorText.substring(0, 150) + "..."; } catch (e2) {} }
                 console.error("API Error Response:", errorText);
                 throw new Error(`Failed to save record. ${response.status === 500 ? 'Internal server error. Check server logs.' : errorText}`);
            }
            const result = await response.json();
            if (result.success) {
                showToast('Record saved successfully!', 'success');
                costControlForm.reset(); setTodaysDate(); vinInput.value = ''; licensePlateInput.value = '';
                await fetchInitialData(); // Reload all data
            } else { throw new Error(result.message || 'Failed to save record.'); }
        } catch (error) { console.error('Error submitting form:', error); showToast(`Error: ${error.message || 'Could not save record.'}`, 'error');
        } finally { submitButton.disabled = false; submitButton.textContent = 'Save Record'; }
    });

    // --- NEW: History Search Logic ---
    searchHistoryBtn.addEventListener('click', () => {
        const startDateStr = filterStartDateInput.value;
        const endDateStr = filterEndDateInput.value;
        const techName = filterTechnicianSelect.value;
        const plate = filterLicensePlateInput.value.trim().toLowerCase();

        // Convert filter dates to Date objects for comparison (set time to cover full days)
        const startDate = startDateStr ? new Date(startDateStr + 'T00:00:00') : null;
        const endDate = endDateStr ? new Date(endDateStr + 'T23:59:59') : null;

        const filteredData = allCostData.filter(record => {
            // Convert record date to Date object
            const recordDateStr = formatDateForInput(record.date);
            const recordDate = recordDateStr ? new Date(recordDateStr + 'T00:00:00') : null;

            if (!recordDate) return false; // Skip records with invalid dates

            const matchesDate =
                (!startDate || recordDate >= startDate) &&
                (!endDate || recordDate <= endDate);
            const matchesTech = !techName || (record.technician && record.technician === techName);
            const matchesPlate = !plate || (record.license_plate && record.license_plate.toLowerCase().includes(plate));

            return matchesDate && matchesTech && matchesPlate;
        });

        // Make history section visible and render the filtered table
        listingSection.classList.remove('hidden');
        renderTable(filteredData);
    });

    // --- Event Listeners ---
    if (technicianSelect) { technicianSelect.addEventListener('change', handleTechnicianChange); }
    if (saveConfigBtn) { saveConfigBtn.addEventListener('click', saveIntervalConfig); }

    // --- Initialization ---
    setTodaysDate();
    populateConfigForm(); // Populate config form with loaded/default values
    fetchInitialData(); // Fetch data and render alerts

});
