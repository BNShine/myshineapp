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
    const newIncludeCallCenterExtraCheckbox = document.getElementById('new-include-callcenter-extra-fee');
    const newExtraVehiclesWrapper = document.getElementById('new-extra-vehicles-wrapper');
    const newExtraVehiclesInputElement = document.getElementById('new-extra-vehicles');
    const newRoyaltyRateInputElement = document.getElementById('new-royalty-rate');
    const newMarketingRateInputElement = document.getElementById('new-marketing-rate');
    const newSoftwareFeeInputElement = document.getElementById('new-software-fee');
    const newCallCenterFeeInputElement = document.getElementById('new-callcenter-fee');
    const newCallCenterExtraInputElement = document.getElementById('new-callcenter-extra');
    const newCustomFeesContainer = document.getElementById('new-custom-fees-container');
    const addNewCustomFeeButton = document.getElementById('add-new-custom-fee-button');
    const newHasLoanCheckbox = document.getElementById('new-has-loan');
    const newLoanDetailsWrapper = document.getElementById('new-loan-details-wrapper');
    const newLoanCurrentInstallmentInputElement = document.getElementById('new-loan-current-installment');
    const newLoanTotalInstallmentsInputElement = document.getElementById('new-loan-total-installments');
    const newLoanValueInputElement = document.getElementById('new-loan-value');
    const newServiceRulesContainer = document.getElementById('new-service-rules-container');
    const addNewServiceRuleButton = document.getElementById('add-new-service-rule-button');
    const registeredFranchisesListElement = document.getElementById('registered-franchises-list');
    const registerSectionElement = document.getElementById('franchise-register-section');
    const registerSectionOverlayElementById = document.getElementById('register-section-loader');

    const editModalElement = document.getElementById('edit-franchise-modal');
    const editFormElement = document.getElementById('edit-franchise-form');
    const editOriginalNameInputElement = document.getElementById('edit-original-franchise-name');
    const editNameInputElement = document.getElementById('edit-franchise-name');
    const editFeeCheckboxElements = document.querySelectorAll('.edit-fee-checkbox');
    const editIncludeCallCenterExtraCheckbox = document.getElementById('edit-include-callcenter-extra-fee');
    const editExtraVehiclesWrapper = document.getElementById('edit-extra-vehicles-wrapper');
    const editExtraVehiclesInputElement = document.getElementById('edit-extra-vehicles');
    const editRoyaltyRateInputElement = document.getElementById('edit-royalty-rate');
    const editMarketingRateInputElement = document.getElementById('edit-marketing-rate');
    const editSoftwareFeeInputElement = document.getElementById('edit-software-fee');
    const editCallCenterFeeInputElement = document.getElementById('edit-callcenter-fee');
    const editCallCenterExtraInputElement = document.getElementById('edit-callcenter-extra');
    const editCustomFeesContainer = document.getElementById('edit-custom-fees-container');
    const addEditCustomFeeButton = document.getElementById('add-edit-custom-fee-button');
    const editHasLoanCheckbox = document.getElementById('edit-has-loan');
    const editLoanDetailsWrapper = document.getElementById('edit-loan-details-wrapper');
    const editLoanCurrentInstallmentInputElement = document.getElementById('edit-loan-current-installment');
    const editLoanTotalInstallmentsInputElement = document.getElementById('edit-loan-total-installments');
    const editLoanValueInputElement = document.getElementById('edit-loan-value');
    const editServiceRulesContainer = document.getElementById('edit-service-rules-container');
    const addEditServiceRuleButton = document.getElementById('add-edit-service-rule-button');
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
        extraVehicles: 0,
        customFeesConfig: [],
        hasLoan: false,
        loanCurrentInstallment: 0,
        loanTotalInstallments: 0,
        loanValue: 0
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

    function parseIntInput(value, defaultValue = 0) {
        const num = parseInt(value, 10);
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
             overlayElement.style.display = 'flex';
             overlayElement.classList.remove('hidden');
         } else {
             console.error(`showLoadingOverlayById: Overlay element with ID '${elementId}' NOT FOUND!`);
         }
     }

     function hideLoadingOverlayById(elementId) {
         const overlayElement = document.getElementById(elementId);
         if (overlayElement) {
             overlayElement.classList.add('hidden');
             overlayElement.style.display = 'none';
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
                if (rule.threshold === 0) { return rule.adjusted; }
                else if (currentServiceValue < rule.threshold) { return rule.adjusted; }
                else { return currentServiceValue; }
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
        try {
            const response = await fetch('/api/manage-franchise-config');
            const responseText = await response.text();
            if (!response.ok) {
                let errorMessage = `API Error: Status ${response.status}`;
                try { const errorData = JSON.parse(responseText); errorMessage = errorData.message || errorMessage; }
                catch (e) { errorMessage += ` - Response: ${responseText.substring(0, 150)}...`; }
                throw new Error(errorMessage);
            }
            try {
                franchisesConfiguration = JSON.parse(responseText);
                if (!Array.isArray(franchisesConfiguration)) {
                    franchisesConfiguration = [];
                 } else {
                      franchisesConfiguration.forEach(config => {
                          config.serviceValueRules = config.serviceValueRules && Array.isArray(config.serviceValueRules) ? config.serviceValueRules : JSON.parse(JSON.stringify(defaultServiceValueRules));
                          config.customFeesConfig = config.customFeesConfig && Array.isArray(config.customFeesConfig) ? config.customFeesConfig : [];
                          config.extraVehicles = config.extraVehicles !== undefined ? config.extraVehicles : defaultRatesAndFees.extraVehicles;
                          config.hasLoan = config.hasLoan !== undefined ? config.hasLoan : defaultRatesAndFees.hasLoan;
                          config.loanCurrentInstallment = config.loanCurrentInstallment !== undefined ? config.loanCurrentInstallment : defaultRatesAndFees.loanCurrentInstallment;
                          config.loanTotalInstallments = config.loanTotalInstallments !== undefined ? config.loanTotalInstallments : defaultRatesAndFees.loanTotalInstallments;
                          config.loanValue = config.loanValue !== undefined ? config.loanValue : defaultRatesAndFees.loanValue;
                      });
                 }
            } catch (parseError) {
                throw new Error("Invalid data format received.");
            }
            renderRegisteredFranchises();
            populateFranchiseSelect();
        } catch (error) {
            console.error("Error during fetchFranchiseConfigs:", error);
            registeredFranchisesListElement.innerHTML = `<p class="p-4 text-red-600">Error loading configurations: ${error.message}</p>`;
            franchisesConfiguration = [];
            populateFranchiseSelect();
        } finally {
            hideLoadingOverlayById(overlayId);
        }
    }

    async function addFranchiseConfig(configData) {
        const overlayId = 'register-section-loader';
        showLoadingOverlayById(overlayId);
        addFranchiseFormElement.querySelector('button[type="submit"]').disabled = true;
        try {
            const response = await fetch('/api/manage-franchise-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configData) });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            showToast(result.message, 'success');
            await fetchFranchiseConfigs();
            addFranchiseFormElement.reset();
            populateServiceRuleInputs(newServiceRulesContainer, defaultServiceValueRules);
            populateCustomFeeInputs(newCustomFeesContainer, []);
            resetNewFeeInputs();
            newFeeCheckboxElements.forEach(checkboxElement => checkboxElement.checked = (checkboxElement.dataset.feeItem !== 'Call Center Fee Extra'));
            if(newExtraVehiclesWrapper) newExtraVehiclesWrapper.classList.add('hidden');
            if(newLoanDetailsWrapper) newLoanDetailsWrapper.classList.add('hidden');
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
             const response = await fetch('/api/manage-franchise-config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(configData) });
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
        if (!containerElement) return;
        containerElement.innerHTML = '';
        rules.forEach(rule => {
            appendServiceRuleInputRow(containerElement, rule);
        });
    }

    function appendServiceRuleInputRow(containerElement, rule = { id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, keyword: '', threshold: 0, adjusted: 0, enabled: true }) {
         if (!containerElement) return;
         const ruleDiv = document.createElement('div');
         ruleDiv.className = 'rule-grid';
         ruleDiv.dataset.ruleId = rule.id;
         ruleDiv.innerHTML = `
             <input type="checkbox" id="rule-enabled-${rule.id}-${containerElement.id}" class="rule-enabled" ${rule.enabled ? 'checked' : ''} title="Enable/Disable Rule">
             <input type="text" placeholder="Keyword in description" id="rule-keyword-${rule.id}-${containerElement.id}" class="rule-keyword-input input-base h-7" value="${rule.keyword}">
             <div class="flex items-center space-x-2">
                <label for="rule-threshold-${rule.id}-${containerElement.id}" class="text-xs text-muted-foreground whitespace-nowrap">Thr:</label>
                <input type="number" step="1" min="0" id="rule-threshold-${rule.id}-${containerElement.id}" class="rule-threshold input-base h-7" value="${rule.threshold}">
                <label for="rule-adjusted-${rule.id}-${containerElement.id}" class="text-xs text-muted-foreground whitespace-nowrap ml-2">Adj:</label>
                <input type="number" step="1" min="0" id="rule-adjusted-${rule.id}-${containerElement.id}" class="rule-adjusted input-base h-7" value="${rule.adjusted}">
            </div>
             <button type="button" class="delete-rule-btn" title="Delete Rule">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
             </button>
         `;
         ruleDiv.querySelector('.delete-rule-btn').addEventListener('click', (event) => {
             event.target.closest('.rule-grid').remove();
         });
         containerElement.appendChild(ruleDiv);
     }

    function getServiceRulesFromInputs(containerElement) {
        const rules = [];
        if (!containerElement) return rules;
        const ruleDivs = containerElement.querySelectorAll('.rule-grid');
        ruleDivs.forEach(ruleDiv => {
            const enabledInput = ruleDiv.querySelector('.rule-enabled');
            const keywordInput = ruleDiv.querySelector('.rule-keyword-input');
            const thresholdInput = ruleDiv.querySelector('.rule-threshold');
            const adjustedInput = ruleDiv.querySelector('.rule-adjusted');
            let ruleId = ruleDiv.dataset.ruleId;
            const keyword = keywordInput ? keywordInput.value.trim() : '';
            if (enabledInput && keyword && thresholdInput && adjustedInput) {
                if(ruleId.startsWith('new_')) {
                    ruleId = keyword.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 20) || `custom_${Date.now()}`;
                }
                rules.push({ id: ruleId, keyword: keyword, threshold: parseInt(thresholdInput.value, 10) || 0, adjusted: parseInt(adjustedInput.value, 10) || 0, enabled: enabledInput.checked });
            } else if (keyword){ console.warn("Could not find all inputs for a service rule row:", ruleDiv); }
        });
        return rules;
    }

    function populateCustomFeeInputs(containerElement, fees) {
        if (!containerElement) return;
        containerElement.innerHTML = '';
        if (fees.length === 0) {
             appendCustomFeeInputRow(containerElement); // Adiciona uma linha em branco se não houver nenhuma
        } else {
            fees.forEach(fee => {
                appendCustomFeeInputRow(containerElement, fee);
            });
        }
    }

    function appendCustomFeeInputRow(containerElement, fee = { id: `new_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: '', type: 'percentage', value: 0, enabled: false }) {
         if (!containerElement) return;
         const feeDiv = document.createElement('div');
         feeDiv.className = 'custom-fee-row';
         feeDiv.dataset.feeId = fee.id;
         feeDiv.innerHTML = `
             <input type="checkbox" id="custom-fee-enabled-${fee.id}-${containerElement.id}" class="custom-fee-enabled fee-checkbox" ${fee.enabled ? 'checked' : ''}>
             <input type="text" placeholder="Fee Name" id="custom-fee-name-${fee.id}-${containerElement.id}" class="custom-fee-name input-base" value="${fee.name}">
             <select id="custom-fee-type-${fee.id}-${containerElement.id}" class="custom-fee-type input-base">
                 <option value="percentage" ${fee.type === 'percentage' ? 'selected' : ''}>Percent (%)</option>
                 <option value="fixed" ${fee.type === 'fixed' ? 'selected' : ''}>Fixed ($)</option>
             </select>
             <input type="number" step="0.01" id="custom-fee-value-${fee.id}-${containerElement.id}" class="custom-fee-value input-base" value="${fee.value}">
             <button type="button" class="delete-fee-btn" title="Delete Custom Fee">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
             </button>
         `;
         feeDiv.querySelector('.delete-fee-btn').addEventListener('click', (event) => {
             event.target.closest('.custom-fee-row').remove();
         });
         containerElement.appendChild(feeDiv);
     }

    function getCustomFeesFromInputs(containerElement) {
        const fees = [];
        if (!containerElement) return fees;
        const feeDivs = containerElement.querySelectorAll('.custom-fee-row');
        feeDivs.forEach(feeDiv => {
            const enabledInput = feeDiv.querySelector('.custom-fee-enabled');
            const nameInput = feeDiv.querySelector('.custom-fee-name');
            const typeSelect = feeDiv.querySelector('.custom-fee-type');
            const valueInput = feeDiv.querySelector('.custom-fee-value');
            let feeId = feeDiv.dataset.feeId;
            const name = nameInput ? nameInput.value.trim() : '';
            if (enabledInput && name && typeSelect && valueInput) {
                 if(feeId.startsWith('new_')) { feeId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 20) || `custom_${Date.now()}`; }
                fees.push({ id: feeId, name: name, type: typeSelect.value, value: parseNumberInput(valueInput.value, 0), enabled: enabledInput.checked });
            } else if (name) { console.warn("Could not find all inputs for a custom fee row:", feeDiv); }
        });
        return fees;
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
            registeredFranchisesListElement.innerHTML = `<p class="p-4 text-muted-foreground italic">No franchises registered yet.</p>`; return;
        }
        franchisesConfiguration.sort((a, b) => a.franchiseName.localeCompare(b.franchiseName)).forEach(config => {
            const includedItems = Object.entries(config) .filter(([key, value]) => key.startsWith('Include') && value === true) .map(([key]) => apiFieldToFeeItemMap[key] || key.replace('Include', '')) .join(', ');
            const customFeesSummary = (config.customFeesConfig || []).filter(f => f.enabled && f.name).map(f => f.name).join(', ');
            const loanSummary = config.hasLoan ? ` | Loan (${config.loanCurrentInstallment}/${config.loanTotalInstallments})` : '';
            const listItem = document.createElement('div');
            listItem.className = 'franchise-list-item';
            listItem.innerHTML = `
                <div>
                    <p class="font-semibold">${config.franchiseName}</p>
                    <p class="text-xs text-muted-foreground">Fees: R ${config.royaltyRate}% | M ${config.marketingRate}% ${customFeesSummary ? `| ${customFeesSummary}` : ''}${loanSummary}</p>
                    <p class="text-xs text-muted-foreground">Included Base: ${includedItems || 'None'}</p>
                </div>
                <div class="space-x-2"> <button class="edit-franchise-btn text-blue-600 hover:text-blue-800 p-1" data-name="${config.franchiseName}" title="Edit"> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> </button> <button class="delete-registered-franchise-btn text-red-600 hover:text-red-800 p-1" data-name="${config.franchiseName}" title="Delete"> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> </button> </div>
            `;
            registeredFranchisesListElement.appendChild(listItem);
        });
        registeredFranchisesListElement.querySelectorAll('.edit-franchise-btn').forEach(button => { button.addEventListener('click', (event) => openEditModal(event.currentTarget.dataset.name)); });
        registeredFranchisesListElement.querySelectorAll('.delete-registered-franchise-btn').forEach(button => { button.addEventListener('click', (event) => deleteFranchiseConfig(event.currentTarget.dataset.name)); });
    }

    function populateMonthSelect() {
        const currentMonthIndex = new Date().getMonth();
        reportMonthSelectElement.innerHTML = MONTHS.map((month, index) => `<option value="${month}" ${index === currentMonthIndex ? 'selected' : ''}>${month}</option>`).join('');
        if (currentCalculationState) currentCalculationState.month = reportMonthSelectElement.value;
    }

    function generateCalculationRows() {
         const config = currentCalculationState.config;
         if (!config) return [];
         const rowsToShow = [];
         const baseFeeItemsOrder = ["Royalty Fee", "Marketing Fee", "Software Fee", "Call Center Fee", "Call Center Fee Extra"];
         baseFeeItemsOrder.forEach(itemName => {
             const apiField = feeItemToApiFieldMap[itemName];
             if (config[apiField]) {
                 let unitPrice = 0; let quantity = 1; let isRate = false;
                 switch (itemName) {
                    case "Royalty Fee": unitPrice = currentCalculationState.totalValue; quantity = config.royaltyRate; isRate = true; break;
                    case "Marketing Fee": unitPrice = currentCalculationState.totalValue; quantity = config.marketingRate; isRate = true; break;
                    case "Software Fee": unitPrice = config.softwareFeeValue; break;
                    case "Call Center Fee": unitPrice = config.callCenterFeeValue; break;
                    case "Call Center Fee Extra": unitPrice = config.callCenterExtraFeeValue; quantity = config.extraVehicles; break;
                 }
                 rowsToShow.push({ Item: itemName, Description: "", Qty: quantity, Unit_price: unitPrice, Amount: 0, verified: false, fixed: true, isRate: isRate });
             }
         });
         (config.customFeesConfig || []).forEach(customFee => {
             if (customFee.enabled && customFee.name) {
                 let customUnitPrice = 0; let customQuantity = 1; let isCustomRate = customFee.type === 'percentage';
                 if (isCustomRate) { customUnitPrice = currentCalculationState.totalValue; customQuantity = customFee.value; }
                 else { customUnitPrice = customFee.value; customQuantity = 1; }
                 rowsToShow.push({ Item: customFee.name, Description: "Custom Fee", Qty: customQuantity, Unit_price: customUnitPrice, Amount: 0, verified: false, fixed: true, isRate: isCustomRate });
             }
         });
         if (config.hasLoan && config.loanValue > 0 && config.loanTotalInstallments > 0 && config.loanCurrentInstallment > 0 && config.loanCurrentInstallment <= config.loanTotalInstallments) {
             rowsToShow.push({ Item: "Loan Payment", Description: `Installment ${config.loanCurrentInstallment} of ${config.loanTotalInstallments}`, Qty: 1, Unit_price: config.loanValue, Amount: 0, verified: false, fixed: true, isRate: false });
         }
         return rowsToShow;
     }

    function updateCalculationTableDOM() {
         calculationTbodyElement.innerHTML = '';
         const calculationRows = currentCalculationState.calculationRows;
         if (!currentCalculationState.selectedFranchiseName || calculationRows.length === 0) {
              calculationTbodyElement.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select franchise and upload file.</td></tr>`;
              calculateAndDisplayTotals(); return;
         }
         calculationRows.forEach((rowData, rowIndex) => {
            const tableRow = document.createElement('tr');
            tableRow.className = 'border-b border-border calculation-row';
            tableRow.dataset.index = rowIndex;
            const isFixedRow = rowData.fixed || false;
            const isRateFee = rowData.isRate || false;
            const isEditableQuantity = !isFixedRow;
            const isEditableUnitPrice = !isFixedRow;
            let quantityValue = rowData.Qty;
            let unitPriceValue = rowData.Unit_price;
            let amount = 0;
            if (isRateFee) { amount = (parseFloat(quantityValue) / 100) * parseFloat(unitPriceValue); }
            else { amount = parseFloat(quantityValue) * parseFloat(unitPriceValue); }
            quantityValue = isNaN(quantityValue) ? 0 : quantityValue;
            unitPriceValue = isNaN(unitPriceValue) ? 0 : unitPriceValue;
            amount = isNaN(amount) ? 0 : amount;
            tableRow.innerHTML = `
                <td class="p-2"><input type="text" class="w-full item-name" value="${rowData.Item}" ${isFixedRow ? 'disabled' : ''}></td>
                <td class="p-2"><input type="text" class="w-full description" value="${rowData.Description}" ${!isFixedRow ? '' : 'disabled'}></td>
                <td class="p-2"><input type="number" step="${isRateFee ? 0.1 : 1}" class="w-full text-center qty ${quantityValue === 0 && !isFixedRow ? 'red-text' : ''}" value="${isRateFee ? quantityValue.toFixed(1) : quantityValue}" ${!isEditableQuantity ? 'disabled' : ''}></td>
                <td class="p-2"><input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" ${!isEditableUnitPrice ? 'disabled' : ''}></td>
                <td class="p-2"><input type="text" class="w-full text-right amount" value="${formatCurrency(amount)}" disabled title="${formatCurrency(amount)}"></td>
                <td class="p-2 checkbox-cell"><input type="checkbox" class="verified" ${rowData.verified ? 'checked' : ''}></td>
                <td class="p-2 text-center"> ${!isFixedRow ? '<button class="delete-calculation-row-btn text-red-600 hover:text-red-800 p-1" title="Delete row">🗑️</button>' : ''} </td>
            `;
            calculationTbodyElement.appendChild(tableRow);
        });
         calculateAndDisplayTotals();
    }

    function addCalculationRowUI() {
         if (!currentCalculationState.selectedFranchiseName) { showToast("Select a franchise first.", "warning"); return; }
         currentCalculationState.calculationRows.push({ Item: "", Description: "", Qty: 1, Unit_price: 0, Amount: 0, verified: false, fixed: false, isRate: false });
         updateCalculationTableDOM();
    }

    function deleteCalculationRowUI(rowIndex) {
         if (!currentCalculationState.selectedFranchiseName || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) return;
         if(currentCalculationState.calculationRows[rowIndex].fixed) { showToast("Configured fee rows cannot be deleted.", "warning"); return; }
         currentCalculationState.calculationRows.splice(rowIndex, 1);
         updateCalculationTableDOM();
     }

    function calculateAndDisplayTotals() {
        let totalAmountSum = 0;
        calculationTbodyElement.querySelectorAll('.calculation-row').forEach(tableRowElement => {
            const rowIndex = parseInt(tableRowElement.dataset.index);
             if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) { return; }
            const rowData = currentCalculationState.calculationRows[rowIndex];
            const quantityInputElement = tableRowElement.querySelector('.qty');
            const unitPriceInputElement = tableRowElement.querySelector('.unit-price');
            const amountInputElement = tableRowElement.querySelector('.amount');
            const quantity = parseFloat(quantityInputElement.value) || 0;
            let unitPrice = parseFloat(unitPriceInputElement.value) || 0;
            let currentAmount = 0;
            if (rowData.isRate) {
                unitPrice = currentCalculationState.totalValue;
                if (!unitPriceInputElement.disabled) unitPriceInputElement.value = unitPrice.toFixed(2);
                currentAmount = (quantity / 100) * unitPrice;
            } else {
                 if(!rowData.fixed) { rowData.Unit_price = unitPrice; }
                currentAmount = quantity * unitPrice;
            }
             if(!rowData.fixed) { rowData.Qty = quantity; }
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
        if (fileInputElement) fileInputElement.value = '';
        currentCalculationState = {
            selectedFranchiseName: null, config: null,
            month: reportMonthSelectElement ? reportMonthSelectElement.value : MONTHS[new Date().getMonth()],
            totalValue: 0,
            calculationRows: [], fileData: [], metrics: { pets: 0, services: 0 }
        };
        updateMetrics();
        if (calculationTbodyElement) calculationTbodyElement.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file.</td></tr>`;
        if (calculationTotalDisplayElement) calculationTotalDisplayElement.textContent = formatCurrency(0);
        toggleCalculationFields(false);
    }

     function resetNewFeeInputs() {
         if(newRoyaltyRateInputElement) newRoyaltyRateInputElement.value = defaultRatesAndFees.royaltyRate;
         if(newMarketingRateInputElement) newMarketingRateInputElement.value = defaultRatesAndFees.marketingRate;
         if(newSoftwareFeeInputElement) newSoftwareFeeInputElement.value = defaultRatesAndFees.softwareFeeValue.toFixed(2);
         if(newCallCenterFeeInputElement) newCallCenterFeeInputElement.value = defaultRatesAndFees.callCenterFeeValue.toFixed(2);
         if(newCallCenterExtraInputElement) newCallCenterExtraInputElement.value = defaultRatesAndFees.callCenterExtraFeeValue.toFixed(2);
         if(newExtraVehiclesInputElement) newExtraVehiclesInputElement.value = defaultRatesAndFees.extraVehicles;
         if(newHasLoanCheckbox) newHasLoanCheckbox.checked = defaultRatesAndFees.hasLoan;
         if(newLoanCurrentInstallmentInputElement) newLoanCurrentInstallmentInputElement.value = defaultRatesAndFees.loanCurrentInstallment;
         if(newLoanTotalInstallmentsInputElement) newLoanTotalInstallmentsInputElement.value = defaultRatesAndFees.loanTotalInstallments;
         if(newLoanValueInputElement) newLoanValueInputElement.value = defaultRatesAndFees.loanValue.toFixed(2);
         if(newExtraVehiclesWrapper) newExtraVehiclesWrapper.classList.add('hidden');
         if(newLoanDetailsWrapper) newLoanDetailsWrapper.classList.add('hidden');
         populateCustomFeeInputs(newCustomFeesContainer, []);
     }

    function toggleCalculationFields(enabled) {
         if (fileInputElement) { fileInputElement.disabled = !enabled; }
         else { console.error("fileInputElement not found!"); }
         if (addCalculationRowButtonElement) { addCalculationRowButtonElement.disabled = !enabled; }
         else { console.error("addCalculationRowButtonElement not found!"); }
         if (!enabled && franchiseSelectElement && franchiseSelectElement.value !== "") { resetCalculationSection(); }
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
         console.log("[handleFileUpload] Change event detected.");
         if (!currentCalculationState.selectedFranchiseName) {
             console.warn("[handleFileUpload] No franchise selected."); showToast("Please select a franchise first.", "warning"); if(fileInputElement) fileInputElement.value = ''; return;
         }
         const files = event.target.files;
         console.log(`[handleFileUpload] Files selected: ${files ? files.length : 'null'}`);
         if (!files || files.length === 0) { console.log("[handleFileUpload] No files selected."); return; }
         if(loadingSpinnerElement) { loadingSpinnerElement.classList.remove('hidden'); }
         else { console.error("[handleFileUpload] loadingSpinnerElement not found!"); }

         let combinedJsonData = [];
         try {
             await Promise.all(Array.from(files).map(async (file) => {
                 console.log(`[handleFileUpload] Processing file: ${file.name}`);
                 try {
                     const data = await file.arrayBuffer(); const workbook = XLSX.read(data);
                     const firstSheetName = workbook.SheetNames[0]; if(!firstSheetName) { throw new Error("No sheets in file."); }
                     const worksheet = workbook.Sheets[firstSheetName]; if(!worksheet) { throw new Error(`Sheet invalid.`); }
                     const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                     combinedJsonData.push(...jsonData);
                     console.log(`[handleFileUpload] Read ${jsonData.length} rows from ${file.name}`);
                 } catch (error) { console.error(`[handleFileUpload] Error processing ${file.name}:`, error); showToast(`Error reading ${file.name}: ${error.message}`, 'error'); }
             }));
         } finally {
             if(loadingSpinnerElement) { loadingSpinnerElement.classList.add('hidden'); }
             currentCalculationState.fileData = combinedJsonData;
             console.log(`[handleFileUpload] Read complete. Total rows: ${combinedJsonData.length}. Processing...`);
             processUploadedData();
             if(fileInputElement) fileInputElement.value = '';
             console.log("[handleFileUpload] Input cleared.");
         }
     }

    function processUploadedData() {
         console.log("[processUploadedData] Starting...");
         const fileData = currentCalculationState.fileData;
         const config = currentCalculationState.config;
         currentCalculationState.metrics = { pets: 0, services: 0 };
         currentCalculationState.totalValue = 0;

         if (!config) { console.warn("[processUploadedData] No config."); showToast("Error: No config loaded.", "error"); updateCalculationTableDOM(); return; }
         if (!fileData || fileData.length === 0) { console.log("[processUploadedData] No file data."); currentCalculationState.calculationRows = generateCalculationRows(); updateMetrics(); updateCalculationTableDOM(); showToast("No valid data found.", 'warning'); return; }

         console.log(`[processUploadedData] Processing ${fileData.length} rows...`);
         let petsServicedCount = 0; let servicesPerformedCount = 0; let totalAdjustedRevenue = 0;
         fileData.forEach((row, index) => {
             if (row['Ticket ID'] === 'Grand Total' || String(row['Description']).includes('Grand Total') || !row['Description']) return;
             const description = row['Description'];
             const originalTotalValue = parseCurrency(row['Total']);
             if (description && originalTotalValue >= 0) {
                 const adjustedServiceValue = calculateServiceValue(description, originalTotalValue);
                 totalAdjustedRevenue += adjustedServiceValue; servicesPerformedCount++; petsServicedCount++;
             }
         });
         console.log(`[processUploadedData] Complete. Pets=${petsServicedCount}, Services=${servicesPerformedCount}, TotalValue=${totalAdjustedRevenue}`);
         currentCalculationState.metrics = { pets: petsServicedCount, services: servicesPerformedCount };
         currentCalculationState.totalValue = totalAdjustedRevenue;
         currentCalculationState.calculationRows = generateCalculationRows();
         updateMetrics(); updateCalculationTableDOM();
         console.log("[processUploadedData] UI Updated.");
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
        editExtraVehiclesInputElement.value = configToEdit.extraVehicles || 0;
        const customFees = configToEdit.customFeesConfig || [];
        populateCustomFeeInputs(editCustomFeesContainer, customFees);
        editHasLoanCheckbox.checked = configToEdit.hasLoan || false;
        editLoanCurrentInstallmentInputElement.value = configToEdit.loanCurrentInstallment || 0;
        editLoanTotalInstallmentsInputElement.value = configToEdit.loanTotalInstallments || 0;
        editLoanValueInputElement.value = (configToEdit.loanValue || 0).toFixed(2);
        if(editExtraVehiclesWrapper) editExtraVehiclesWrapper.classList.toggle('hidden', !editIncludeCallCenterExtraCheckbox.checked);
        if(editLoanDetailsWrapper) editLoanDetailsWrapper.classList.toggle('hidden', !editHasLoanCheckbox.checked);
        populateServiceRuleInputs(editServiceRulesContainer, configToEdit.serviceValueRules || defaultServiceValueRules);
        editModalElement.classList.remove('hidden');
    }

    function closeEditModal() {
        editModalElement.classList.add('hidden');
        editFormElement.reset();
        populateServiceRuleInputs(editServiceRulesContainer, []);
        populateCustomFeeInputs(editCustomFeesContainer, []);
        if(editExtraVehiclesWrapper) editExtraVehiclesWrapper.classList.add('hidden');
        if(editLoanDetailsWrapper) editLoanDetailsWrapper.classList.add('hidden');
    }

    function handleSaveEdit() {
        const originalName = editOriginalNameInputElement.value;
        const newName = editNameInputElement.value.trim();
        const includedFeesMap = {};
        editFeeCheckboxElements.forEach(checkbox => { includedFeesMap[checkbox.dataset.feeItem] = checkbox.checked; });
        const serviceValueRules = getServiceRulesFromInputs(editServiceRulesContainer);
        const customFeesConfig = getCustomFeesFromInputs(editCustomFeesContainer);
        if (!newName) { alert("Franchise name cannot be empty."); return; }
        const configData = {
            originalFranchiseName: originalName, newFranchiseName: newName, includedFees: includedFeesMap,
            royaltyRate: parseNumberInput(editRoyaltyRateInputElement.value, defaultRatesAndFees.royaltyRate),
            marketingRate: parseNumberInput(editMarketingRateInputElement.value, defaultRatesAndFees.marketingRate),
            softwareFeeValue: parseNumberInput(editSoftwareFeeInputElement.value, defaultRatesAndFees.softwareFeeValue),
            callCenterFeeValue: parseNumberInput(editCallCenterFeeInputElement.value, defaultRatesAndFees.callCenterFeeValue),
            callCenterExtraFeeValue: parseNumberInput(editCallCenterExtraInputElement.value, defaultRatesAndFees.callCenterExtraFeeValue),
            extraVehicles: parseIntInput(editExtraVehiclesInputElement.value, 0),
            hasLoan: editHasLoanCheckbox.checked,
            loanCurrentInstallment: parseIntInput(editLoanCurrentInstallmentInputElement.value, 0),
            loanTotalInstallments: parseIntInput(editLoanTotalInstallmentsInputElement.value, 0),
            loanValue: parseNumberInput(editLoanValueInputElement.value, 0),
            customFeesConfig: customFeesConfig, serviceValueRules: serviceValueRules
        };
        updateFranchiseConfig(configData);
    }

    addFranchiseFormElement.addEventListener('submit', (event) => {
        event.preventDefault();
        const franchiseName = newFranchiseNameInputElement.value.trim();
        const includedFeesMap = {};
        newFeeCheckboxElements.forEach(checkbox => { includedFeesMap[checkbox.dataset.feeItem] = checkbox.checked; });
        const serviceValueRules = getServiceRulesFromInputs(newServiceRulesContainer);
        const customFeesConfig = getCustomFeesFromInputs(newCustomFeesContainer);
        if (!franchiseName) { alert("Please enter a franchise name."); return; }
        const configData = {
            franchiseName: franchiseName, includedFees: includedFeesMap,
            royaltyRate: parseNumberInput(newRoyaltyRateInputElement.value, defaultRatesAndFees.royaltyRate),
            marketingRate: parseNumberInput(newMarketingRateInputElement.value, defaultRatesAndFees.marketingRate),
            softwareFeeValue: parseNumberInput(newSoftwareFeeInputElement.value, defaultRatesAndFees.softwareFeeValue),
            callCenterFeeValue: parseNumberInput(newCallCenterFeeInputElement.value, defaultRatesAndFees.callCenterFeeValue),
            callCenterExtraFeeValue: parseNumberInput(newCallCenterExtraInputElement.value, defaultRatesAndFees.callCenterExtraFeeValue),
            extraVehicles: parseIntInput(newExtraVehiclesInputElement.value, 0),
            hasLoan: newHasLoanCheckbox.checked,
            loanCurrentInstallment: parseIntInput(newLoanCurrentInstallmentInputElement.value, 0),
            loanTotalInstallments: parseIntInput(newLoanTotalInstallmentsInputElement.value, 0),
            loanValue: parseNumberInput(newLoanValueInputElement.value, 0),
            customFeesConfig: customFeesConfig, serviceValueRules: serviceValueRules
        };
        addFranchiseConfig(configData);
    });

    franchiseSelectElement.addEventListener('change', (event) => {
        const selectedName = event.target.value;
        if (selectedName) {
            currentCalculationState.selectedFranchiseName = selectedName;
            currentCalculationState.config = franchisesConfiguration.find(config => config.franchiseName === selectedName);
            if (fileInputElement) fileInputElement.value = '';
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

    if (reportMonthSelectElement) {
        reportMonthSelectElement.addEventListener('change', (event) => { if(currentCalculationState) currentCalculationState.month = event.target.value; });
    }

    if (fileInputElement) {
        fileInputElement.addEventListener('change', handleFileUpload);
    } else {
        console.error("Initialization Error: File input element not found!");
    }

    if (addCalculationRowButtonElement) {
        addCalculationRowButtonElement.addEventListener('click', addCalculationRowUI);
    }

    // Delegação de eventos unificada para cliques em botões delete
    document.body.addEventListener('click', (event) => {
        const deleteRuleButton = event.target.closest('.delete-rule-btn');
        const deleteFeeButton = event.target.closest('.delete-fee-btn');
        const deleteRowButton = event.target.closest('.delete-calculation-row-btn');

        if (deleteRuleButton) { deleteRuleButton.closest('.rule-grid').remove(); }
        else if (deleteFeeButton) { deleteFeeButton.closest('.custom-fee-row').remove(); }
        else if (deleteRowButton && deleteRowButton.closest('#royalty-calculation-section')) {
            const tableRowElement = deleteRowButton.closest('.calculation-row');
            if (tableRowElement) { const rowIndex = parseInt(tableRowElement.dataset.index); deleteCalculationRowUI(rowIndex); }
        }
    });

    if (calculationTbodyElement) {
        calculationTbodyElement.addEventListener('change', (event) => {
            const targetElement = event.target;
            const tableRowElement = targetElement.closest('.calculation-row');
            if (!tableRowElement) return;
            const rowIndex = parseInt(tableRowElement.dataset.index);
            if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) return;
            const rowData = currentCalculationState.calculationRows[rowIndex];
            if (targetElement.classList.contains('qty') && !rowData.fixed) { rowData.Qty = targetElement.value; targetElement.classList.toggle('red-text', (parseFloat(targetElement.value) || 0) === 0); }
            else if (targetElement.classList.contains('description') && !rowData.fixed) { rowData.Description = targetElement.value; }
            else if (targetElement.classList.contains('unit-price') && !rowData.fixed) { rowData.Unit_price = targetElement.value; }
            else if (targetElement.classList.contains('verified')) { rowData.verified = targetElement.checked; }
            calculateAndDisplayTotals();
        });
    }

    if(editModalSaveButtonElement) editModalSaveButtonElement.addEventListener('click', handleSaveEdit);
    if(editModalCancelButtonElement) editModalCancelButtonElement.addEventListener('click', closeEditModal);

    if(addNewServiceRuleButton) { addNewServiceRuleButton.addEventListener('click', () => appendServiceRuleInputRow(newServiceRulesContainer)); }
    if(addEditServiceRuleButton) { addEditServiceRuleButton.addEventListener('click', () => appendServiceRuleInputRow(editServiceRulesContainer)); }
    if(addNewCustomFeeButton) { addNewCustomFeeButton.addEventListener('click', () => appendCustomFeeInputRow(newCustomFeesContainer)); }
    if(addEditCustomFeeButton) { addEditCustomFeeButton.addEventListener('click', () => appendCustomFeeInputRow(editCustomFeesContainer)); }

    if (newIncludeCallCenterExtraCheckbox && newExtraVehiclesWrapper) {
        newIncludeCallCenterExtraCheckbox.addEventListener('change', (event) => {
            newExtraVehiclesWrapper.classList.toggle('hidden', !event.target.checked);
            if (!event.target.checked && newExtraVehiclesInputElement) { newExtraVehiclesInputElement.value = 0; }
        });
    }
     if (editIncludeCallCenterExtraCheckbox && editExtraVehiclesWrapper) {
         editIncludeCallCenterExtraCheckbox.addEventListener('change', (event) => {
             editExtraVehiclesWrapper.classList.toggle('hidden', !event.target.checked);
              if (!event.target.checked && editExtraVehiclesInputElement) { editExtraVehiclesInputElement.value = 0; }
         });
     }
     if (newHasLoanCheckbox && newLoanDetailsWrapper) {
         newHasLoanCheckbox.addEventListener('change', (event) => {
             newLoanDetailsWrapper.classList.toggle('hidden', !event.target.checked);
             if(!event.target.checked) {
                 if(newLoanCurrentInstallmentInputElement) newLoanCurrentInstallmentInputElement.value = 0;
                 if(newLoanTotalInstallmentsInputElement) newLoanTotalInstallmentsInputElement.value = 0;
                 if(newLoanValueInputElement) newLoanValueInputElement.value = 0;
             }
         });
     }
     if (editHasLoanCheckbox && editLoanDetailsWrapper) {
         editHasLoanCheckbox.addEventListener('change', (event) => {
             editLoanDetailsWrapper.classList.toggle('hidden', !event.target.checked);
             if(!event.target.checked) {
                 if(editLoanCurrentInstallmentInputElement) editLoanCurrentInstallmentInputElement.value = 0;
                 if(editLoanTotalInstallmentsInputElement) editLoanTotalInstallmentsInputElement.value = 0;
                 if(editLoanValueInputElement) editLoanValueInputElement.value = 0;
             }
         });
     }

    console.log("Initializing page...");
    populateMonthSelect();
    populateServiceRuleInputs(newServiceRulesContainer, defaultServiceValueRules);
    populateCustomFeeInputs(newCustomFeesContainer, []);
    fetchFranchiseConfigs();
    resetCalculationSection();
    resetNewFeeInputs();
    console.log("Page initialization scripts running.");

});
