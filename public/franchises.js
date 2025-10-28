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
    const addNewServiceRuleButton = document.getElementById('add-new-service-rule-button');
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
                          config.customFeeConfig = config.customFeeConfig && typeof config.customFeeConfig === 'object' ? config.customFeeConfig : { ...defaultRatesAndFees.customFeeConfig };
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
            const response = await fetch('/api/manage-franchise-config', { method: 'POST',
