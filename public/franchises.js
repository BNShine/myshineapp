document.addEventListener('DOMContentLoaded', () => {
    const franchiseSelectElement = document.getElementById('franchise-select');
    const reportMonthSelectElement = document.getElementById('report-month-select');
    const fileInputElement = document.getElementById('file-input');
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
    const newRoyaltyRateInputElement = document.getElementById('new-royalty-rate');
    const newMarketingRateInputElement = document.getElementById('new-marketing-rate');
    const newSoftwareFeeInputElement = document.getElementById('new-software-fee');
    const newCallCenterFeeInputElement = document.getElementById('new-callcenter-fee');
    const newCallCenterExtraInputElement = document.getElementById('new-callcenter-extra');
    const newCustomFeeNameInputElement = document.getElementById('new-custom-fee-name');
    const newCustomFeeTypeElement = document.getElementById('new-custom-fee-type');
    const newCustomFeeValueInputElement = document.getElementById('new-custom-fee-value');
    const newCustomFeeEnabledCheckbox = document.getElementById('new-custom-fee-enabled');
    const newServiceRulesContainer = document.getElementById('new-service-rules-container');
    const registeredFranchisesListElement = document.getElementById('registered-franchises-list');
    const registerSectionElement = document.getElementById('franchise-register-section');
    const registerSectionOverlayElementById = document.getElementById('register-section-loader');

    const editModalElement = document.getElementById('edit-franchise-modal');
    const editFormElement = document.getElementById('edit-franchise-form');
    const editOriginalNameInputElement = document.getElementById('edit-original-franchise-name');
    const editNameInputElement = document.getElementById('edit-franchise-name');
    const editFeeCheckboxElements = document.querySelectorAll('.edit-fee-checkbox');
    const editRoyaltyRateInputElement = document.getElementById('edit-royalty-rate');
    const editMarketingRateInputElement = document.getElementById('edit-marketing-rate');
    const editSoftwareFeeInputElement = document.getElementById('edit-software-fee');
    const editCallCenterFeeInputElement = document.getElementById('edit-callcenter-fee');
    const editCallCenterExtraInputElement = document.getElementById('edit-callcenter-extra');
    const editCustomFeeNameInputElement = document.getElementById('edit-custom-fee-name');
    const editCustomFeeTypeElement = document.getElementById('edit-custom-fee-type');
    const editCustomFeeValueInputElement = document.getElementById('edit-custom-fee-value');
    const editCustomFeeEnabledCheckbox = document.getElementById('edit-custom-fee-enabled');
    const editServiceRulesContainer = document.getElementById('edit-service-rules-container');
    const editModalSaveButtonElement = document.getElementById('edit-modal-save-btn');
    const editModalCancelButtonElement = document.getElementById('edit-modal-cancel-btn');

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const BASE_FEE_ITEMS = ["Royalty Fee", "Marketing Fee", "Software Fee", "Call Center Fee", "Call Center Fee Extra"];
    const feeItemToApiFieldMap = { "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing", "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter", "Call Center Fee Extra": "IncludeCallCenterExtra" };
    const apiFieldToFeeItemMap = Object.fromEntries(Object.entries(feeItemToApiFieldMap).map(([key, value]) => [value, key]));

    const defaultServiceValueRules = [
        { id: 'dog_small', keyword: 'Dog Cleaning - Small', threshold: 170, adjusted: 180, enabled: true },
        { id: 'dental_small', keyword: 'Dental Under 40 LBS', threshold: 170, adjusted: 180, enabled: true },
        { id: 'dog_medium', keyword: 'Dog Cleaning - Medium', threshold: 200, adjusted: 210, enabled: true },
        { id: 'dog_max', keyword: 'Dog Cleaning - Max', threshold: 230, adjusted: 240, enabled: true },
        { id: 'dog_ultra', keyword: 'Dog Cleaning - Ultra', threshold: 260, adjusted: 270, enabled: true },
        { id: 'cat_cleaning', keyword: 'Cat Cleaning', threshold: 200, adjusted: 210, enabled: true },
        { id: 'nail_clipping', keyword: 'Nail Clipping', threshold: 0, adjusted: 10, enabled: true }
    ];

    const defaultRatesAndFees = {
        royaltyRate: 6.0,
        marketingRate: 1.0,
        softwareFeeValue: 350.00,
        callCenterFeeValue: 1200.00,
        callCenterExtraFeeValue: 600.00,
        customFeeConfig: { name: "", type: "percentage", value: 0, enabled: false }
    };

    let franchisesConfiguration = [];
    let currentCalculationState = {
        selectedFranchiseName: null, config: null, month: MONTHS[new Date().getMonth()],
        totalValue: 0,
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

    function parseNumberInput(value, defaultValue = 0) {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
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
             overlayElement.style.display = '';
             overlayElement.classList.remove('hidden');
         } else {
             console.error(`showLoadingOverlayById: Overlay element with ID '${elementId}' NOT FOUND!`);
         }
     }

     function hideLoadingOverlayById(elementId) {
         console.log(`[Hide Overlay] Attempting to hide element with ID: ${elementId}`);
         const overlayElement = document.getElementById(elementId);
         if (overlayElement) {
             console.log(`[Hide Overlay] Element found. Current classes: "${overlayElement.className}"`);
             console.log(`[Hide Overlay] Adding 'hidden' class and setting style.display = 'none'...`);
             overlayElement.classList.add('hidden');
             overlayElement.style.display = 'none';
             const currentDisplay = window.getComputedStyle(overlayElement).display;
             console.log(`[Hide Overlay] Element display style after hiding: "${currentDisplay}"`);
             if (currentDisplay !== 'none') {
                 console.warn(`[Hide Overlay] WARN: Element display style is not 'none' after attempting to hide! Check CSS conflicts.`);
             }
         } else {
             console.error(`hideLoadingOverlayById: Overlay element with ID '${elementId}' NOT FOUND when trying to hide!`);
         }
     }


    function calculateServiceValue(description, currentServiceValue) {
        description = String(description || '');
        currentServiceValue = parseCurrency(currentServiceValue);
        const rules = currentCalculationState?.config?.serviceValueRules || [];

        for (const rule of rules) {
            if (rule.enabled && rule.keyword && description.includes(rule.keyword)) {
                if (rule.threshold === 0) {
                     return rule.adjusted;
                } else if (currentServiceValue < rule.threshold) {
                    return rule.adjusted;
                } else {
                    return currentServiceValue;
                }
            }
        }
        return currentServiceValue;
    }

    async function fetchFranchiseConfigs() {
        const overlayId = 'register-section-loader';
        const overlayElementDirect = document.getElementById(overlayId);
        if (!overlayElementDirect) {
             console.error(`CRITICAL: Overlay element with ID '${overlayId}' not found!`);
             registeredFranchisesListElement.innerHTML = `<p class="p-4 text-red-600">Error: UI component missing (loader).</p>`;
             return;
        }

        showLoadingOverlayById(overlayId);
        registeredFranchisesListElement.innerHTML = `<p class="p-4 text-muted-foreground italic">Loading configurations...</p>`;
        console.log("[fetchFranchiseConfigs] Attempting to fetch...");

        try {
            const response = await fetch('/api/manage-franchise-config');
            const responseText = await response.text();
            console.log("[fetchFranchiseConfigs] API Response Status:", response.status, "Text:", responseText.substring(0,100)+"...");

            if (!response.ok) {
                let errorMessage = `API Error: Status ${response.status}`;
                try { const errorData = JSON.parse(responseText); errorMessage = errorData.message || errorMessage; }
                catch (e) { errorMessage += ` - Response: ${responseText.substring(0, 150)}...`; }
                throw new Error(errorMessage);
            }

            try {
                franchisesConfiguration = JSON.parse(responseText);
                if (!Array.isArray(franchisesConfiguration)) {
                    console.warn("[fetchFranchiseConfigs] API response not an array.", franchisesConfiguration); franchisesConfiguration = [];
                 } else {
                      franchisesConfiguration.forEach(config => {
                          config.serviceValueRules = config.serviceValueRules && Array.isArray(config.serviceValueRules) ? config.serviceValueRules : JSON.parse(JSON.stringify(defaultServiceValueRules));
                          config.customFeeConfig = config.customFeeConfig && typeof config.customFeeConfig === 'object' ? config.customFeeConfig : { ...defaultRatesAndFees.customFeeConfig };
                      });
                 }
                console.log("[fetchFranchiseConfigs] Configs received:", franchisesConfiguration);
            } catch (parseError) {
                console.error("[fetchFranchiseConfigs] Error parsing API response:", parseError); throw new Error("Invalid data format received.");
            }

            renderRegisteredFranchises();
            populateFranchiseSelect();

        } catch (error) {
            console.error(">>> Error during fetchFranchiseConfigs:", error);
            registeredFranchisesListElement.innerHTML = `<p class="p-4 text-red-600">Error loading configurations: ${error.message}</p>`;
            franchisesConfiguration = [];
            populateFranchiseSelect();
        } finally {
            hideLoadingOverlayById(overlayId);
            console.log("[fetchFranchiseConfigs] Finished fetch attempt.");
        }
    }

    async function addFranchiseConfig(configData) {
        const overlayId = 'register-section-loader';
        showLoadingOverlayById(overlayId);
        addFranchiseFormElement.querySelector('button[type="submit"]').disabled = true;
        try {
            const response = await fetch('/api/manage-franchise-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData)
             });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            showToast(result.message, 'success');
            await fetchFranchiseConfigs();
            addFranchiseFormElement.reset();
            populateServiceRuleInputs(newServiceRulesContainer, defaultServiceValueRules);
            resetNewFeeInputs();
            newFeeCheckboxElements.forEach(checkboxElement => checkboxElement.checked = (checkboxElement.dataset.feeItem !== 'Call Center Fee Extra'));
        } catch (error) {
            console.error("Error adding franchise:", error);
            showToast(`Error adding franchise: ${error.message}`, 'error');
        } finally {
            hideLoadingOverlayById(overlayId);
            addFranchiseFormElement.querySelector('button[type="submit"]').disabled = false;
        }
    }

    async function updateFranchiseConfig(configData) {
         const overlayId = 'register-section-loader';
         showLoadingOverlayById(overlayId);
         editModalSaveButtonElement.disabled = true;
         try {
             const response = await fetch('/api/manage-franchise-config', {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(configData)
              });
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

    function populateServiceRuleInputs(containerElement, rules) {
        containerElement.innerHTML = '';
        rules.forEach(rule => {
            const ruleDiv = document.createElement('div');
            ruleDiv.className = 'rule-grid border-b pb-2';
            ruleDiv.innerHTML = `
                <input type="checkbox" id="rule-enabled-${rule.id}-${containerElement.id}" data-rule-id="${rule.id}" class="rule-enabled" ${rule.enabled ? 'checked' : ''} title="Enable/Disable Rule">
                <span class="rule-keyword">${rule.keyword}</span>
                <span class="text-xs text-muted-foreground">(Matches if description contains text)</span>

                <label for="rule-threshold-${rule.id}-${containerElement.id}" class="text-muted-foreground">Threshold:</label>
                <input type="number" step="1" min="0" id="rule-threshold-${rule.id}-${containerElement.id}" data-rule-id="${rule.id}" class="rule-threshold input-base h-7" value="${rule.threshold}">
                <span class="text-xs text-muted-foreground">(Value below which adjustment occurs. 0 for fixed value)</span>

                <label for="rule-adjusted-${rule.id}-${containerElement.id}" class="text-muted-foreground">Adjusted:</label>
                <input type="number" step="1" min="0" id="rule-adjusted-${rule.id}-${containerElement.id}" data-rule-id="${rule.id}" class="rule-adjusted input-base h-7" value="${rule.adjusted}">
                <span class="text-xs text-muted-foreground">(New value if threshold met, or fixed value if threshold is 0)</span>
            `;
            containerElement.appendChild(ruleDiv);
        });
    }

    function getServiceRulesFromInputs(containerElement) {
        const rules = [];
        const ruleDivs = containerElement.querySelectorAll('.rule-grid');
        ruleDivs.forEach(ruleDiv => {
            const enabledInput = ruleDiv.querySelector('.rule-enabled');
            const keywordSpan = ruleDiv.querySelector('.rule-keyword');
            const thresholdInput = ruleDiv.querySelector('.rule-threshold');
            const adjustedInput = ruleDiv.querySelector('.rule-adjusted');

            if (enabledInput && keywordSpan && thresholdInput && adjustedInput) {
                const ruleId = enabledInput.dataset.ruleId;
                rules.push({
                    id: ruleId,
                    keyword: keywordSpan.textContent,
                    threshold: parseInt(thresholdInput.value, 10) || 0,
                    adjusted: parseInt(adjustedInput.value, 10) || 0,
                    enabled: enabledInput.checked
                });
            } else {
                 console.warn("Could not find all inputs for a service rule in container:", containerElement);
            }
        });
        return rules;
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
                    <p class="text-xs text-muted-foreground">Fees: R ${config.royaltyRate}% | M ${config.marketingRate}% ${config.customFeeConfig?.enabled ? `| ${config.customFeeConfig.name} ` + (config.customFeeConfig.type === 'percentage' ? `${config.customFeeConfig.value}%` : `${formatCurrency(config.customFeeConfig.value)}`) : ''}</p>
                    <p class="text-xs text-muted-foreground">Included: ${includedItems || 'None'}</p>
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

         const rowsToShow = [];
         const baseFeeItemsOrder = ["Royalty Fee", "Marketing Fee", "Software Fee", "Call Center Fee", "Call Center Fee Extra"];

         baseFeeItemsOrder.forEach(itemName => {
             const apiField = feeItemToApiFieldMap[itemName];
             if (config[apiField]) { // Verifica se está incluído
                 let unitPrice = 0;
                 let quantity = 1; // Default quantity
                 let isRate = false;

                 switch (itemName) {
                    case "Royalty Fee":
                        unitPrice = currentCalculationState.totalValue; // Base de cálculo é o total
                        quantity = config.royaltyRate; // Quantidade é a taxa
                        isRate = true;
                        break;
                    case "Marketing Fee":
                        unitPrice = currentCalculationState.totalValue; // Base de cálculo é o total
                        quantity = config.marketingRate; // Quantidade é a taxa
                        isRate = true;
                        break;
                    case "Software Fee":
                        unitPrice = config.softwareFeeValue;
                        break;
                    case "Call Center Fee":
                        unitPrice = config.callCenterFeeValue;
                        break;
                    case "Call Center Fee Extra":
                        unitPrice = config.callCenterExtraFeeValue;
                        quantity = 0; // Começa com 0, editável na tabela
                        break;
                 }

                 rowsToShow.push({
                     Item: itemName,
                     Description: "",
                     Qty: quantity,
                     Unit_price: unitPrice,
                     Amount: 0, // Será calculado depois
                     verified: false,
                     fixed: true, // Indica que é uma linha base/configurada
                     isRate: isRate // Flag para cálculo percentual
                 });
             }
         });

         // Adiciona a linha da taxa customizada se estiver habilitada
         if (config.customFeeConfig?.enabled && config.customFeeConfig.name) {
             let customUnitPrice = 0;
             let customQuantity = 1;
             let isCustomRate = config.customFeeConfig.type === 'percentage';

             if (isCustomRate) {
                 customUnitPrice = currentCalculationState.totalValue; // Base é o total
                 customQuantity = config.customFeeConfig.value; // Quantidade é a taxa
             } else {
                 customUnitPrice = config.customFeeConfig.value; // Preço unitário é o valor fixo
                 customQuantity = 1; // Quantidade é 1
             }

             rowsToShow.push({
                Item: config.customFeeConfig.name,
                Description: "Custom Fee",
                Qty: customQuantity,
                Unit_price: customUnitPrice,
                Amount: 0,
                verified: false,
                fixed: true, // Considera configurada como fixa na estrutura
                isRate: isCustomRate
             });
         }

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

            const isFixedRow = rowData.fixed || false; // Linhas base/configuradas + custom
            const isRateFee = rowData.isRate || false; // Flag para %
            const isEditableQuantity = rowData.Item === "Call Center Fee Extra" || !isFixedRow; // Só CallCenterExtra e custom podem ter Qty editado

            let quantityValue = rowData.Qty;
            let unitPriceValue = rowData.Unit_price;
            let amount = 0;

            if (isRateFee) {
                amount = (parseFloat(quantityValue) / 100) * parseFloat(unitPriceValue);
            } else {
                amount = parseFloat(quantityValue) * parseFloat(unitPriceValue);
            }

            // Garante que não sejam NaN
            quantityValue = isNaN(quantityValue) ? 0 : quantityValue;
            unitPriceValue = isNaN(unitPriceValue) ? 0 : unitPriceValue;
            amount = isNaN(amount) ? 0 : amount;

            tableRow.innerHTML = `
                <td class="p-2"><input type="text" class="w-full item-name" value="${rowData.Item}" ${isFixedRow ? 'disabled' : ''}></td>
                <td class="p-2"><input type="text" class="w-full description" value="${rowData.Description}" ${!isFixedRow ? 'placeholder="Optional description"' : 'disabled'}></td>
                <td class="p-2"><input type="number" step="${isRateFee ? 0.1 : 1}" class="w-full text-center qty ${quantityValue === 0 && !isFixedRow ? 'red-text' : ''}" value="${isRateFee ? quantityValue.toFixed(1) : quantityValue}" ${!isEditableQuantity ? 'disabled' : ''}></td>
                <td class="p-2"><input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" ${isFixedRow ? 'disabled' : ''}></td>
                <td class="p-2"><input type="text" class="w-full text-right amount" value="${formatCurrency(amount)}" disabled title="${formatCurrency(amount)}"></td>
                <td class="p-2 checkbox-cell"><input type="checkbox" class="verified" ${rowData.verified ? 'checked' : ''}></td>
                <td class="p-2 text-center"> ${!isFixedRow ? '<button class="delete-calculation-row-btn text-red-600 hover:text-red-800 p-1" title="Delete row">🗑️</button>' : ''} </td>
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
         currentCalculationState.calculationRows.push({ Item: "", Description: "", Qty: 1, Unit_price: 0, Amount: 0, verified: false, fixed: false, isRate: false });
         updateCalculationTableDOM();
    }

    function deleteCalculationRowUI(rowIndex) {
         if (!currentCalculationState.selectedFranchiseName || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) return;
         // Permite deletar apenas linhas que NÃO são 'fixed' (ou seja, apenas as adicionadas manualmente)
         if(currentCalculationState.calculationRows[rowIndex].fixed) {
             console.warn("Cannot delete configured fee rows.");
             showToast("Configured fee rows cannot be deleted.", "warning");
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
                 console.warn("Skipping row with invalid index during total calculation:", rowIndex); return;
             }
            const rowData = currentCalculationState.calculationRows[rowIndex];
            const quantityInputElement = tableRowElement.querySelector('.qty');
            const unitPriceInputElement = tableRowElement.querySelector('.unit-price');
            const amountInputElement = tableRowElement.querySelector('.amount');

            const quantity = parseFloat(quantityInputElement.value) || 0;
            let unitPrice = parseFloat(unitPriceInputElement.value) || 0;
            let currentAmount = 0;

            // Para taxas (%) base ou custom, a base (unitPrice) é sempre o totalValue atualizado
            if (rowData.isRate) {
                unitPrice = currentCalculationState.totalValue; // Atualiza unit price no cálculo
                unitPriceInputElement.value = unitPrice.toFixed(2); // Atualiza display do unit price
                currentAmount = (quantity / 100) * unitPrice;
            } else {
                 // Para linhas custom (não-rate), atualiza o unitPrice no estado se editado
                 if(!rowData.fixed) {
                      rowData.Unit_price = unitPrice;
                 }
                currentAmount = quantity * unitPrice;
            }

             // Atualiza Qty no estado APENAS se for editável
             if(rowData.Item === "Call Center Fee Extra" || !rowData.fixed) {
                 rowData.Qty = quantity;
             }

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
        currentCalculationState = {
            selectedFranchiseName: null, config: null,
            month: reportMonthSelectElement.value || MONTHS[new Date().getMonth()],
            totalValue: 0,
            calculationRows: [], fileData: [], metrics: { pets: 0, services: 0 }
        };
        updateMetrics();
        calculationTbodyElement.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
        calculationTotalDisplayElement.textContent = formatCurrency(0);
        toggleCalculationFields(false);
    }

     function resetNewFeeInputs() {
         newRoyaltyRateInputElement.value = defaultRatesAndFees.royaltyRate;
         newMarketingRateInputElement.value = defaultRatesAndFees.marketingRate;
         newSoftwareFeeInputElement.value = defaultRatesAndFees.softwareFeeValue.toFixed(2);
         newCallCenterFeeInputElement.value = defaultRatesAndFees.callCenterFeeValue.toFixed(2);
         newCallCenterExtraInputElement.value = defaultRatesAndFees.callCenterExtraFeeValue.toFixed(2);
         newCustomFeeNameInputElement.value = defaultRatesAndFees.customFeeConfig.name;
         newCustomFeeTypeElement.value = defaultRatesAndFees.customFeeConfig.type;
         newCustomFeeValueInputElement.value = defaultRatesAndFees.customFeeConfig.value;
         newCustomFeeEnabledCheckbox.checked = defaultRatesAndFees.customFeeConfig.enabled;
     }

    function toggleCalculationFields(enabled) {
         fileInputElement.disabled = !enabled;
         addCalculationRowButtonElement.disabled = !enabled;
         if (!enabled && franchiseSelectElement.value !== "") {
              resetCalculationSection();
         }
     }

    function getDefaultCalculationRowTemplates() {
         return JSON.parse(JSON.stringify([
           { Item: "Royalty Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true, isRate: true },
           { Item: "Marketing Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true, isRate: true },
           { Item: "Software Fee", Description: "", Qty: 1, Unit_price: 0, Amount: 0, verified: false, fixed: true, isRate: false },
           { Item: "Call Center Fee", Description: "", Qty: 1, Unit_price: 0, Amount: 0, verified: false, fixed: true, isRate: false },
           { Item: "Call Center Fee Extra", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true, isRate: false }
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
         currentCalculationState.calculationRows = generateCalculationRows(); // Regenera linhas com base no novo totalValue
         updateMetrics();
         updateCalculationTableDOM(); // Re-renderiza a tabela
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
        editRoyaltyRateInputElement.value = configToEdit.royaltyRate;
        editMarketingRateInputElement.value = configToEdit.marketingRate;
        editSoftwareFeeInputElement.value = configToEdit.softwareFeeValue.toFixed(2);
        editCallCenterFeeInputElement.value = configToEdit.callCenterFeeValue.toFixed(2);
        editCallCenterExtraInputElement.value = configToEdit.callCenterExtraFeeValue.toFixed(2);

        const customFee = configToEdit.customFeeConfig || defaultRatesAndFees.customFeeConfig;
        editCustomFeeNameInputElement.value = customFee.name;
        editCustomFeeTypeElement.value = customFee.type;
        editCustomFeeValueInputElement.value = customFee.value;
        editCustomFeeEnabledCheckbox.checked = customFee.enabled;

        populateServiceRuleInputs(editServiceRulesContainer, configToEdit.serviceValueRules || defaultServiceValueRules);
        editModalElement.classList.remove('hidden');
    }

    function closeEditModal() {
        editModalElement.classList.add('hidden');
        editFormElement.reset();
        populateServiceRuleInputs(editServiceRulesContainer, []);
    }

    function handleSaveEdit() {
        const originalName = editOriginalNameInputElement.value;
        const newName = editNameInputElement.value.trim();
        const includedFeesMap = {};
        editFeeCheckboxElements.forEach(checkbox => {
            includedFeesMap[checkbox.dataset.feeItem] = checkbox.checked;
        });
        const serviceValueRules = getServiceRulesFromInputs(editServiceRulesContainer);

        const customFeeConfig = {
             name: editCustomFeeNameInputElement.value.trim(),
             type: editCustomFeeTypeElement.value,
             value: parseNumberInput(editCustomFeeValueInputElement.value, 0),
             enabled: editCustomFeeEnabledCheckbox.checked
        };

        if (!newName) { alert("Franchise name cannot be empty."); return; }

        const configData = {
            originalFranchiseName: originalName,
            newFranchiseName: newName,
            includedFees: includedFeesMap,
            royaltyRate: parseNumberInput(editRoyaltyRateInputElement.value, defaultRatesAndFees.royaltyRate),
            marketingRate: parseNumberInput(editMarketingRateInputElement.value, defaultRatesAndFees.marketingRate),
            softwareFeeValue: parseNumberInput(editSoftwareFeeInputElement.value, defaultRatesAndFees.softwareFeeValue),
            callCenterFeeValue: parseNumberInput(editCallCenterFeeInputElement.value, defaultRatesAndFees.callCenterFeeValue),
            callCenterExtraFeeValue: parseNumberInput(editCallCenterExtraInputElement.value, defaultRatesAndFees.callCenterExtraFeeValue),
            customFeeConfig: customFeeConfig,
            serviceValueRules: serviceValueRules
        };

        updateFranchiseConfig(configData);
    }

    addFranchiseFormElement.addEventListener('submit', (event) => {
        event.preventDefault();
        const franchiseName = newFranchiseNameInputElement.value.trim();
        const includedFeesMap = {};
        newFeeCheckboxElements.forEach(checkbox => { includedFeesMap[checkbox.dataset.feeItem] = checkbox.checked; });
        const serviceValueRules = getServiceRulesFromInputs(newServiceRulesContainer);

        const customFeeConfig = {
             name: newCustomFeeNameInputElement.value.trim(),
             type: newCustomFeeTypeElement.value,
             value: parseNumberInput(newCustomFeeValueInputElement.value, 0),
             enabled: newCustomFeeEnabledCheckbox.checked
        };

        if (!franchiseName) { alert("Please enter a franchise name."); return; }

        const configData = {
            franchiseName: franchiseName,
            includedFees: includedFeesMap,
            royaltyRate: parseNumberInput(newRoyaltyRateInputElement.value, defaultRatesAndFees.royaltyRate),
            marketingRate: parseNumberInput(newMarketingRateInputElement.value, defaultRatesAndFees.marketingRate),
            softwareFeeValue: parseNumberInput(newSoftwareFeeInputElement.value, defaultRatesAndFees.softwareFeeValue),
            callCenterFeeValue: parseNumberInput(newCallCenterFeeInputElement.value, defaultRatesAndFees.callCenterFeeValue),
            callCenterExtraFeeValue: parseNumberInput(newCallCenterExtraInputElement.value, defaultRatesAndFees.callCenterExtraFeeValue),
            customFeeConfig: customFeeConfig,
            serviceValueRules: serviceValueRules
        };
        addFranchiseConfig(configData);
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
            currentCalculationState.calculationRows = generateCalculationRows(); // Gera linhas com base na config
            updateMetrics();
            updateCalculationTableDOM(); // Renderiza a tabela
            toggleCalculationFields(true);
        } else {
            resetCalculationSection();
        }
    });

    reportMonthSelectElement.addEventListener('change', (event) => { currentCalculationState.month = event.target.value; });
    fileInputElement.addEventListener('change', handleFileUpload);
    addCalculationRowButtonElement.addEventListener('click', addCalculationRowUI);

    calculationTbodyElement.addEventListener('change', (event) => {
         const targetElement = event.target;
         const tableRowElement = targetElement.closest('.calculation-row');
         if (!tableRowElement) return;
         const rowIndex = parseInt(tableRowElement.dataset.index);
         if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) return;
         const rowData = currentCalculationState.calculationRows[rowIndex];

         // Apenas permite editar Qty de Call Center Extra e linhas manuais
         if (targetElement.classList.contains('qty') && (rowData.Item === "Call Center Fee Extra" || !rowData.fixed)) {
             rowData.Qty = targetElement.value;
             targetElement.classList.toggle('red-text', (parseFloat(targetElement.value) || 0) === 0);
         }
         // Apenas permite editar Descrição e Preço Unitário de linhas manuais
         else if (targetElement.classList.contains('description') && !rowData.fixed) { rowData.Description = targetElement.value; }
         else if (targetElement.classList.contains('unit-price') && !rowData.fixed) { rowData.Unit_price = targetElement.value; }
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
    populateServiceRuleInputs(newServiceRulesContainer, defaultServiceValueRules);
    fetchFranchiseConfigs();
    resetCalculationSection();
    resetNewFeeInputs(); // Garante valores padrão no form de adicionar
    console.log("Page initialization scripts running.");

});
