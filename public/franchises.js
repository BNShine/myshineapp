document.addEventListener('DOMContentLoaded', () => {
    const franchiseSelectElement = document.getElementById('franchise-select');
    const reportMonthSelectElement = document.getElementById('report-month-select');
    const fileInputElement = document.getElementById('file-input');
    const royaltyRateInputElement = document.getElementById('royalty-rate-input');
    const marketingRateInputElement = document.getElementById('marketing-rate-input');
    const loadingSpinnerElement = document.querySelector('#royalty-calculation-section .loading-spinner');
    const calculationTbodyElement = document.querySelector('#royalty-calculation-section .calculation-tbody');
    const calculationTotalDisplayElement = document.querySelector('#royalty-calculation-section .calculation-total');
    const addCalculationRowButtonElement = document.querySelector('#royalty-calculation-section .add-calculation-row-btn');
    const metricPetsElement = document.querySelector('#royalty-calculation-section .metric-pets');
    const metricServicesCountElement = document.querySelector('#royalty-calculation-section .metric-services-count');
    const metricTotalValueElement = document.querySelector('#royalty-calculation-section .metric-total-value');
    const metricTotalFeesElement = document.querySelector('#royalty-calculation-section .metric-total-fees');
    const toastContainerElement = document.getElementById('toast-container');

    const addFranchiseFormElement = document.getElementById('add-franchise-form');
    const newFranchiseNameInputElement = document.getElementById('new-franchise-name');
    const newFeeCheckboxElements = document.querySelectorAll('.new-fee-checkbox');
    const registeredFranchisesListElement = document.getElementById('registered-franchises-list');
    const registerSectionElement = document.getElementById('franchise-register-section');

    const editModalElement = document.getElementById('edit-franchise-modal');
    const editFormElement = document.getElementById('edit-franchise-form');
    const editOriginalNameInputElement = document.getElementById('edit-original-franchise-name');
    const editNameInputElement = document.getElementById('edit-franchise-name');
    const editFeeCheckboxElements = document.querySelectorAll('.edit-fee-checkbox');
    const editModalSaveButtonElement = document.getElementById('edit-modal-save-btn');
    const editModalCancelButtonElement = document.getElementById('edit-modal-cancel-btn');

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const BASE_FEE_ITEMS = ["Royalty Fee", "Marketing Fee", "Software Fee", "Call Center Fee", "Call Center Fee Extra"];
    const feeItemToApiFieldMap = { "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing", "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter", "Call Center Fee Extra": "IncludeCallCenterExtra" };
    const apiFieldToFeeItemMap = Object.fromEntries(Object.entries(feeItemToApiFieldMap).map(([key, value]) => [value, key]));

    let franchisesConfiguration = [];
    let currentCalculationState = {
        selectedFranchiseName: null, config: null, month: MONTHS[new Date().getMonth()],
        royaltyRate: 6.0, marketingRate: 1.0, totalValue: 0,
        calculationRows: [], fileData: [], metrics: { pets: 0, services: 0 }
    };

    function formatCurrency(value) {
        if (typeof value !== 'number') value = parseFloat(value) || 0;
        return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }

    function parseCurrency(value) {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return 0;
        const cleaned = value.replace(/[$,]/g, '');
        return parseFloat(cleaned) || 0;
    }

    function showToast(message, type = 'info', duration = 4000) {
        if (!toastContainerElement) return;
        const toast = document.createElement('div');
        let backgroundClass = 'bg-card text-foreground border border-border';
        if (type === 'success') backgroundClass = 'bg-success text-success-foreground border border-green-700';
        if (type === 'error') backgroundClass = 'bg-destructive text-destructive-foreground border border-red-800';
        toast.className = `w-80 p-4 rounded-lg shadow-large ${backgroundClass} animate-toast-in`;
        toast.innerHTML = `<p class="font-semibold">${message}</p>`;
        toastContainerElement.prepend(toast);
        setTimeout(() => {
            toast.classList.add('animate-toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }

    function showLoadingOverlayById(elementId) {
         const overlayElement = document.getElementById(elementId);
         if (overlayElement) {
             console.log(`Showing overlay for ID: ${elementId}`);
             overlayElement.classList.remove('hidden');
         } else {
             console.error(`showLoadingOverlayById: Overlay element with ID '${elementId}' NOT FOUND!`);
         }
     }

     function hideLoadingOverlayById(elementId) {
         const overlayElement = document.getElementById(elementId);
         if (overlayElement) {
              console.log(`Hiding overlay for ID: ${elementId}`);
             overlayElement.classList.add('hidden');
         } else {
              console.error(`hideLoadingOverlayById: Overlay element with ID '${elementId}' NOT FOUND!`);
         }
     }

    function calculateServiceValue(description, currentServiceValue) {
        description = String(description || '');
        currentServiceValue = parseCurrency(currentServiceValue);
        if (description.includes("01- Dog Cleaning - Small - Under 30 Lbs") || description.includes("Dental Under 40 LBS")) return currentServiceValue < 170 ? 180 : currentServiceValue;
        if (description.includes("02- Dog Cleaning - Medium - 31 to 70 Lbs")) return currentServiceValue < 200 ? 210 : currentServiceValue;
        if (description.includes("03- Dog Cleaning - Max - 71 to 1000 Lbs") || description.includes("03- Dog Cleaning - Max - 71 to 100 Lbs")) return currentServiceValue < 230 ? 240 : currentServiceValue;
        if (description.includes("04- Dog Cleaning - Ultra - Above 101 Lbs")) return currentServiceValue < 260 ? 270 : currentServiceValue;
        if (description.includes("05- Cat Cleaning")) return currentServiceValue < 200 ? 210 : currentServiceValue;
        if (description.includes("Nail Clipping")) return 10;
        return currentServiceValue;
    }

    async function fetchFranchiseConfigs() {
        const overlayId = 'register-section-loader';
        showLoadingOverlayById(overlayId);
        registeredFranchisesListElement.innerHTML = `<p class="p-4 text-muted-foreground italic">Loading configurations...</p>`;
        console.log("[fetchFranchiseConfigs] Attempting to fetch...");

        let response = null;
        let responseText = null;

        try {
            response = await fetch('/api/manage-franchise-config');
            console.log("[fetchFranchiseConfigs] API Response Status:", response.status);

            responseText = await response.text();
            console.log("[fetchFranchiseConfigs] API Raw Response Text:", responseText);

            if (!response.ok) {
                let errorMessage = `API Error: Status ${response.status}`;
                try {
                    const errorData = JSON.parse(responseText);
                    console.error("[fetchFranchiseConfigs] API Error Response Body (Parsed):", errorData);
                    errorMessage = errorData.message || errorMessage;
                } catch (jsonParseError) {
                    console.error("[fetchFranchiseConfigs] Failed to parse error response as JSON:", jsonParseError);
                    errorMessage += ` - Response: ${responseText.substring(0, 150)}...`;
                }
                throw new Error(errorMessage);
            }

            try {
                franchisesConfiguration = JSON.parse(responseText);
                if (!Array.isArray(franchisesConfiguration)) {
                    console.warn("[fetchFranchiseConfigs] API response was OK but not an array, resetting config.", franchisesConfiguration);
                    franchisesConfiguration = [];
                }
                console.log("[fetchFranchiseConfigs] Configs received and parsed:", franchisesConfiguration);
            } catch (parseError) {
                console.error("[fetchFranchiseConfigs] Error parsing successful API response as JSON:", parseError);
                throw new Error("Received invalid data format from server.");
            }

            renderRegisteredFranchises();
            populateFranchiseSelect();

        } catch (error) {
            console.error(">>> CRITICAL Error during fetchFranchiseConfigs:", error);
            const errorDisplayMessage = `Error loading configurations: ${error.message}`;
            registeredFranchisesListElement.innerHTML = `<p class="p-4 text-red-600">${errorDisplayMessage}</p>`;
            franchisesConfiguration = [];
            populateFranchiseSelect();
        } finally {
            console.log("[fetchFranchiseConfigs] Entering finally block...");
            // Tenta esconder o overlay usando o ID diretamente aqui
            hideLoadingOverlayById(overlayId);
            console.log("[fetchFranchiseConfigs] Finished fetch attempt (finally executed).");
        }
    }

    async function addFranchiseConfig(name, includedFees) {
        const overlayId = 'register-section-loader';
        showLoadingOverlayById(overlayId);
        try {
            const response = await fetch('/api/manage-franchise-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ franchiseName: name, includedFees: includedFees }) });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            showToast(result.message, 'success');
            await fetchFranchiseConfigs();
            addFranchiseFormElement.reset();
            newFeeCheckboxElements.forEach(checkboxElement => checkboxElement.checked = (checkboxElement.dataset.feeItem !== 'Call Center Fee Extra'));
        } catch (error) {
            console.error("Error adding franchise:", error);
            showToast(`Error adding franchise: ${error.message}`, 'error');
        } finally {
            hideLoadingOverlayById(overlayId);
        }
    }

    async function updateFranchiseConfig(originalName, newName, includedFees) {
         const overlayId = 'register-section-loader';
         showLoadingOverlayById(overlayId);
         editModalSaveButtonElement.disabled = true;
         try {
             const response = await fetch('/api/manage-franchise-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ originalFranchiseName: originalName, newFranchiseName: newName, includedFees: includedFees }) });
             const result = await response.json();
             if (!result.success) throw new Error(result.message);
             showToast(result.message, 'success');
             closeEditModal();
             await fetchFranchiseConfigs();
         } catch (error) {
             console.error("Error updating franchise:", error);
             showToast(`Error updating franchise: ${error.message}`, 'error');
         } finally {
             hideLoadingOverlayById(overlayId);
             editModalSaveButtonElement.disabled = false;
         }
     }

    async function deleteFranchiseConfig(name) {
         if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
         const overlayId = 'register-section-loader';
         showLoadingOverlayById(overlayId);
         try {
             const response = await fetch('/api/manage-franchise-config', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ franchiseName: name }) });
             const result = await response.json();
             if (!result.success) throw new Error(result.message);
             showToast(result.message, 'success');
             await fetchFranchiseConfigs();
         } catch (error) {
             console.error("Error deleting franchise:", error);
             showToast(`Error deleting franchise: ${error.message}`, 'error');
         } finally {
             hideLoadingOverlayById(overlayId);
         }
     }

    function populateFranchiseSelect() {
         const currentSelection = franchiseSelectElement.value;
         franchiseSelectElement.innerHTML = '<option value="">-- Select a Registered Franchise --</option>';
         franchisesConfiguration.sort((a, b) => a.franchiseName.localeCompare(b.franchiseName)).forEach(config => {
             const option = document.createElement('option');
             option.value = config.franchiseName;
             option.textContent = config.franchiseName;
             franchiseSelectElement.appendChild(option);
         });
         if (franchisesConfiguration.some(config => config.franchiseName === currentSelection)) {
             franchiseSelectElement.value = currentSelection;
         } else {
             franchiseSelectElement.value = "";
             resetCalculationSection();
         }
         toggleCalculationFields(franchiseSelectElement.value !== "");
    }

    function renderRegisteredFranchises() {
        registeredFranchisesListElement.innerHTML = '';
        if (franchisesConfiguration.length === 0) {
            registeredFranchisesListElement.innerHTML = `<p class="p-4 text-muted-foreground italic">No franchises registered yet.</p>`;
            return;
        }

        franchisesConfiguration.sort((a, b) => a.franchiseName.localeCompare(b.franchiseName)).forEach(config => {
            const includedItems = Object.entries(config)
                .filter(([key, value]) => key.startsWith('Include') && value === true)
                .map(([key]) => apiFieldToFeeItemMap[key] || key.replace('Include', ''))
                .join(', ');

            const listItem = document.createElement('div');
            listItem.className = 'franchise-list-item';
            listItem.innerHTML = `
                <div>
                    <p class="font-semibold">${config.franchiseName}</p>
                    <p class="text-xs text-muted-foreground">Includes: ${includedItems || 'None'}</p>
                </div>
                <div class="space-x-2">
                    <button class="edit-franchise-btn text-blue-600 hover:text-blue-800 p-1" data-name="${config.franchiseName}" title="Edit">
                         <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button class="delete-registered-franchise-btn text-red-600 hover:text-red-800 p-1" data-name="${config.franchiseName}" title="Delete">
                         <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                </div>
            `;
            registeredFranchisesListElement.appendChild(listItem);
        });

        registeredFranchisesListElement.querySelectorAll('.edit-franchise-btn').forEach(button => {
            button.addEventListener('click', (event) => openEditModal(event.currentTarget.dataset.name));
        });
        registeredFranchisesListElement.querySelectorAll('.delete-registered-franchise-btn').forEach(button => {
            button.addEventListener('click', (event) => deleteFranchiseConfig(event.currentTarget.dataset.name));
        });
    }

    function populateMonthSelect() {
        const currentMonthIndex = new Date().getMonth();
        reportMonthSelectElement.innerHTML = MONTHS.map((month, index) =>
            `<option value="${month}" ${index === currentMonthIndex ? 'selected' : ''}>${month}</option>`
        ).join('');
        if (currentCalculationState) currentCalculationState.month = reportMonthSelectElement.value;
    }

    function generateCalculationRows() {
         const config = currentCalculationState.config;
         if (!config) return [];
         const defaultRowTemplates = getDefaultCalculationRowTemplates();
         const rowsToShow = [];
         defaultRowTemplates.forEach(templateRow => {
             const apiField = feeItemToApiFieldMap[templateRow.Item];
             if (templateRow.fixed && apiField && config[apiField]) {
                 rowsToShow.push(JSON.parse(JSON.stringify(templateRow)));
             }
         });
         return rowsToShow;
     }

    function updateCalculationTableDOM() {
         calculationTbodyElement.innerHTML = '';
         const calculationRows = currentCalculationState.calculationRows;

         if (!currentCalculationState.selectedFranchiseName || calculationRows.length === 0) {
              calculationTbodyElement.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
              calculateAndDisplayTotals();
              return;
         }

         calculationRows.forEach((rowData, rowIndex) => {
            const tableRow = document.createElement('tr');
            tableRow.className = 'border-b border-border calculation-row';
            tableRow.dataset.index = rowIndex;

            const isFixed = rowData.fixed || false;
            const isRateFee = rowData.Item === "Royalty Fee" || rowData.Item === "Marketing Fee";
            const isSoftwareFee = rowData.Item === "Software Fee";
            const isCallCenterBase = rowData.Item === "Call Center Fee";
            const isCallCenterExtra = rowData.Item === "Call Center Fee Extra";

            let quantityValue = rowData.Qty;
            let isQuantityDisabled = isFixed;
            if (isRateFee) {
                quantityValue = (rowData.Item === "Royalty Fee" ? currentCalculationState.royaltyRate : currentCalculationState.marketingRate).toFixed(1);
                isQuantityDisabled = true;
            } else if (isSoftwareFee || isCallCenterBase) {
                quantityValue = 1; isQuantityDisabled = false;
            } else if (isCallCenterExtra) {
                quantityValue = rowData.Qty; isQuantityDisabled = false;
            } else { quantityValue = rowData.Qty; isQuantityDisabled = false; }

            let unitPriceValue = rowData.Unit_price;
            let isUnitPriceDisabled = isFixed;
            let unitPriceElementHTML;
            if (isRateFee) {
                unitPriceValue = currentCalculationState.totalValue; isUnitPriceDisabled = true;
                unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
            } else if (isSoftwareFee) {
                const options = [0.00, 250.00, 350.00]; unitPriceValue = rowData.Unit_price; isUnitPriceDisabled = false;
                unitPriceElementHTML = `<select class="w-full text-right unit-price">${options.map(o => `<option value="${o.toFixed(2)}" ${Math.abs(o - unitPriceValue) < 0.01 ? 'selected' : ''}>${formatCurrency(o)}</option>`).join('')}</select>`;
            } else if (isCallCenterBase || isCallCenterExtra) {
                unitPriceValue = isCallCenterBase ? 1200.00 : 600.00; isUnitPriceDisabled = true;
                unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
            } else { unitPriceValue = rowData.Unit_price; isUnitPriceDisabled = false;
                 unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}">`;
            }

            let amount = 0;
            const currentQuantity = parseFloat(quantityValue) || 0;
            const currentUnitPrice = parseFloat(unitPriceValue) || 0;
            if (isRateFee) { amount = (currentQuantity / 100) * currentUnitPrice; }
            else { amount = currentQuantity * currentUnitPrice; }

            tableRow.innerHTML = `
                <td class="p-2"><input type="text" class="w-full item-name" value="${rowData.Item}" ${isFixed ? 'disabled title="Base fee item"' : 'placeholder="Custom item"'}></td>
                <td class="p-2"><input type="text" class="w-full description" value="${rowData.Description}" placeholder="Optional description"></td>
                <td class="p-2"><input type="number" step="${isRateFee ? 0.1 : 1}" class="w-full text-center qty ${currentQuantity === 0 && !isFixed ? 'red-text' : ''}" value="${isRateFee ? quantityValue : currentQuantity}" ${isQuantityDisabled ? 'disabled' : ''}></td>
                <td class="p-2">${unitPriceElementHTML}</td>
                <td class="p-2"><input type="text" class="w-full text-right amount" value="${formatCurrency(amount)}" disabled title="${formatCurrency(amount)}"></td>
                <td class="p-2 checkbox-cell"><input type="checkbox" class="verified" ${rowData.verified ? 'checked' : ''}></td>
                <td class="p-2 text-center"> ${!isFixed ? '<button class="delete-calculation-row-btn text-red-600 hover:text-red-800 p-1" title="Delete row">🗑️</button>' : ''} </td>
            `;
            calculationTbodyElement.appendChild(tableRow);
        });

         calculateAndDisplayTotals();
    }

    function addCalculationRowUI() {
         if (!currentCalculationState.selectedFranchiseName) {
             showToast("Select a franchise before adding custom rows.", "warning");
             return;
         }
         currentCalculationState.calculationRows.push({ Item: "", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: false });
         updateCalculationTableDOM();
    }

    function deleteCalculationRowUI(rowIndex) {
         if (!currentCalculationState.selectedFranchiseName || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) return;
         const baseFeeCount = currentCalculationState.calculationRows.filter(row => row.fixed).length;
         if (rowIndex < baseFeeCount) {
             console.warn("Cannot delete base fee rows.");
             showToast("Base fee rows cannot be deleted.", "warning");
             return;
         }
         currentCalculationState.calculationRows.splice(rowIndex, 1);
         updateCalculationTableDOM();
     }

    function calculateAndDisplayTotals() {
        let totalAmountSum = 0;
        calculationTbodyElement.querySelectorAll('.calculation-row').forEach(tableRowElement => {
            const rowIndex = parseInt(tableRowElement.dataset.index);
             if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) {
                 console.warn("Skipping row with invalid index during total calculation:", rowIndex);
                 return;
             }
            const rowData = currentCalculationState.calculationRows[rowIndex];
            const quantityInputElement = tableRowElement.querySelector('.qty');
            const unitPriceInputElement = tableRowElement.querySelector('.unit-price');
            const amountInputElement = tableRowElement.querySelector('.amount');
            const isRateFee = rowData.Item === "Royalty Fee" || rowData.Item === "Marketing Fee";
            const quantity = parseFloat(quantityInputElement.value) || 0;
            const unitPrice = parseFloat(unitPriceInputElement.value) || 0;
            let currentAmount = 0;
            if (isRateFee) { currentAmount = (quantity / 100) * unitPrice; }
            else { currentAmount = quantity * unitPrice; }
            rowData.Amount = currentAmount;
            amountInputElement.value = formatCurrency(currentAmount);
            amountInputElement.title = formatCurrency(currentAmount);
            totalAmountSum += currentAmount;
        });
        calculationTotalDisplayElement.textContent = formatCurrency(totalAmountSum);
        metricTotalFeesElement.textContent = formatCurrency(totalAmountSum);
    }

    function updateMetrics() {
         metricPetsElement.textContent = currentCalculationState.metrics.pets;
         metricServicesCountElement.textContent = currentCalculationState.metrics.services;
         metricTotalValueElement.textContent = formatCurrency(currentCalculationState.totalValue);
    }

    function resetCalculationSection() {
        fileInputElement.value = '';
        royaltyRateInputElement.value = '6.0';
        marketingRateInputElement.value = '1.0';
        currentCalculationState = {
            selectedFranchiseName: null, config: null,
            month: reportMonthSelectElement.value || MONTHS[new Date().getMonth()],
            royaltyRate: 6.0, marketingRate: 1.0, totalValue: 0,
            calculationRows: [], fileData: [], metrics: { pets: 0, services: 0 }
        };
        updateMetrics();
        calculationTbodyElement.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
        calculationTotalDisplayElement.textContent = formatCurrency(0);
        toggleCalculationFields(false);
    }

    function toggleCalculationFields(enabled) {
         fileInputElement.disabled = !enabled;
         royaltyRateInputElement.disabled = !enabled;
         marketingRateInputElement.disabled = !enabled;
         addCalculationRowButtonElement.disabled = !enabled;
         if (!enabled && franchiseSelectElement.value !== "") {
              resetCalculationSection();
         }
     }

    function getDefaultCalculationRowTemplates() {
         return JSON.parse(JSON.stringify([
           { Item: "Royalty Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true },
           { Item: "Marketing Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true },
           { Item: "Software Fee", Description: "", Qty: 1, Unit_price: 350.00, Amount: 0, verified: false, fixed: true },
           { Item: "Call Center Fee", Description: "", Qty: 1, Unit_price: 1200.00, Amount: 0, verified: false, fixed: true },
           { Item: "Call Center Fee Extra", Description: "", Qty: 0, Unit_price: 600.00, Amount: 0, verified: false, fixed: true }
       ]));
   }

    async function handleFileUpload(event) {
         if (!currentCalculationState.selectedFranchiseName) {
             showToast("Please select a franchise first.", "warning"); fileInputElement.value = ''; return;
         }
         const files = event.target.files; if (files.length === 0) return;
         loadingSpinnerElement.classList.remove('hidden');
         let combinedJsonData = [];
         for (const file of files) {
             try {
                 const data = await file.arrayBuffer(); const workbook = XLSX.read(data);
                 const firstSheetName = workbook.SheetNames[0]; const worksheet = workbook.Sheets[firstSheetName];
                 const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                 combinedJsonData.push(...jsonData);
             } catch (error) { console.error(`Error processing file ${file.name}:`, error); showToast(`Error reading file ${file.name}.`, 'error'); }
         }
         loadingSpinnerElement.classList.add('hidden');
         currentCalculationState.fileData = combinedJsonData;
         processUploadedData();
     }

    function processUploadedData() {
         const fileData = currentCalculationState.fileData;
         const config = currentCalculationState.config;
         currentCalculationState.metrics = { pets: 0, services: 0 };
         currentCalculationState.totalValue = 0;

         if (!config || !fileData || fileData.length === 0) {
             currentCalculationState.calculationRows = generateCalculationRows();
             updateMetrics();
             updateCalculationTableDOM();
             if (fileData && fileData.length > 0) showToast("No valid service data found.", 'warning');
             return;
         }

         let petsServicedCount = 0; let servicesPerformedCount = 0; let totalAdjustedRevenue = 0;
         fileData.forEach(row => {
             if (row['Ticket ID'] === 'Grand Total' || String(row['Description']).includes('Grand Total') || !row['Description']) return;
             const description = row['Description']; const originalTotalValue = parseCurrency(row['Total']);
             if (description && originalTotalValue > 0) {
                 const adjustedServiceValue = calculateServiceValue(description, originalTotalValue);
                 totalAdjustedRevenue += adjustedServiceValue; servicesPerformedCount++; petsServicedCount++;
             }
         });
         currentCalculationState.metrics = { pets: petsServicedCount, services: servicesPerformedCount };
         currentCalculationState.totalValue = totalAdjustedRevenue;
         currentCalculationState.calculationRows = generateCalculationRows();
         updateMetrics();
         updateCalculationTableDOM();
    }

    function openEditModal(franchiseName) {
        const configToEdit = franchisesConfiguration.find(config => config.franchiseName === franchiseName);
        if (!configToEdit) return;
        editOriginalNameInputElement.value = configToEdit.franchiseName;
        editNameInputElement.value = configToEdit.franchiseName;
        editFeeCheckboxElements.forEach(checkbox => {
            const feeItem = checkbox.dataset.feeItem;
            const apiField = feeItemToApiFieldMap[feeItem];
            checkbox.checked = configToEdit[apiField] || false;
        });
        editModalElement.classList.remove('hidden');
    }

    function closeEditModal() {
        editModalElement.classList.add('hidden');
        editFormElement.reset();
    }

    function handleSaveEdit() {
        const originalName = editOriginalNameInputElement.value;
        const newName = editNameInputElement.value.trim();
        const includedFeesMap = {};
        editFeeCheckboxElements.forEach(checkbox => {
            includedFeesMap[checkbox.dataset.feeItem] = checkbox.checked;
        });
        if (!newName) { alert("Franchise name cannot be empty."); return; }
        updateFranchiseConfig(originalName, newName, includedFeesMap);
    }

    addFranchiseFormElement.addEventListener('submit', (event) => {
        event.preventDefault();
        const franchiseName = newFranchiseNameInputElement.value.trim();
        const includedFeesMap = {};
        newFeeCheckboxElements.forEach(checkbox => { includedFeesMap[checkbox.dataset.feeItem] = checkbox.checked; });
        if (franchiseName) { addFranchiseConfig(franchiseName, includedFeesMap); }
        else { alert("Please enter a franchise name."); }
    });

    franchiseSelectElement.addEventListener('change', (event) => {
        const selectedName = event.target.value;
        if (selectedName) {
            currentCalculationState.selectedFranchiseName = selectedName;
            currentCalculationState.config = franchisesConfiguration.find(config => config.franchiseName === selectedName);
            fileInputElement.value = '';
            currentCalculationState.fileData = [];
            currentCalculationState.totalValue = 0;
            currentCalculationState.metrics = { pets: 0, services: 0 };
            currentCalculationState.calculationRows = generateCalculationRows();
            updateMetrics();
            updateCalculationTableDOM();
            toggleCalculationFields(true);
        } else {
            resetCalculationSection();
        }
    });

    reportMonthSelectElement.addEventListener('change', (event) => { currentCalculationState.month = event.target.value; });
    fileInputElement.addEventListener('change', handleFileUpload);
    royaltyRateInputElement.addEventListener('change', (event) => { if (currentCalculationState.selectedFranchiseName) { currentCalculationState.royaltyRate = parseCurrency(event.target.value) || 0; updateCalculationTableDOM(); } });
    marketingRateInputElement.addEventListener('change', (event) => { if (currentCalculationState.selectedFranchiseName) { currentCalculationState.marketingRate = parseCurrency(event.target.value) || 0; updateCalculationTableDOM(); } });
    addCalculationRowButtonElement.addEventListener('click', addCalculationRowUI);

    calculationTbodyElement.addEventListener('change', (event) => {
         const targetElement = event.target;
         const tableRowElement = targetElement.closest('.calculation-row');
         if (!tableRowElement) return;
         const rowIndex = parseInt(tableRowElement.dataset.index);
         if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) return;
         const rowData = currentCalculationState.calculationRows[rowIndex];
         if (targetElement.classList.contains('item-name')) { rowData.Item = targetElement.value; }
         else if (targetElement.classList.contains('description')) { rowData.Description = targetElement.value; }
         else if (targetElement.classList.contains('qty')) { rowData.Qty = targetElement.value; targetElement.classList.toggle('red-text', (parseFloat(targetElement.value) || 0) === 0 && !rowData.fixed); }
         else if (targetElement.classList.contains('unit-price')) { rowData.Unit_price = targetElement.value; }
         else if (targetElement.classList.contains('verified')) { rowData.verified = targetElement.checked; }
         calculateAndDisplayTotals();
     });

    calculationTbodyElement.addEventListener('click', (event) => {
          if (event.target.classList.contains('delete-calculation-row-btn')) {
              const tableRowElement = event.target.closest('.calculation-row');
              if (tableRowElement) { const rowIndex = parseInt(tableRowElement.dataset.index); deleteCalculationRowUI(rowIndex); }
          }
      });

    editModalSaveButtonElement.addEventListener('click', handleSaveEdit);
    editModalCancelButtonElement.addEventListener('click', closeEditModal);

    console.log("Initializing page...");
    populateMonthSelect();
    fetchFranchiseConfigs();
    resetCalculationSection();
    console.log("Page initialization scripts running.");

});
