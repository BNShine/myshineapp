document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM ---
    const franchiseSelect = document.getElementById('franchise-select');
    const reportMonthSelect = document.getElementById('report-month-select');
    const fileInput = document.getElementById('file-input');
    const royaltyRateInput = document.getElementById('royalty-rate-input');
    const marketingRateInput = document.getElementById('marketing-rate-input');
    const loadingSpinner = document.querySelector('#royalty-calculation-section .loading-spinner');
    const calculationTbody = document.querySelector('#royalty-calculation-section .calculation-tbody');
    const calculationTotalDisplay = document.querySelector('#royalty-calculation-section .calculation-total');
    const addCalculationRowBtn = document.querySelector('#royalty-calculation-section .add-calculation-row-btn');
    const metricPets = document.querySelector('#royalty-calculation-section .metric-pets');
    const metricServicesCount = document.querySelector('#royalty-calculation-section .metric-services-count');
    const metricTotalValue = document.querySelector('#royalty-calculation-section .metric-total-value');
    const metricTotalFees = document.querySelector('#royalty-calculation-section .metric-total-fees');
    const toastContainer = document.getElementById('toast-container');
    const mainContent = document.querySelector('.main-content'); // Para overlay

    // Elementos da Seção de Registro
    const addFranchiseForm = document.getElementById('add-franchise-form');
    const newFranchiseNameInput = document.getElementById('new-franchise-name');
    const newFeeCheckboxes = document.querySelectorAll('.new-fee-checkbox');
    const registeredFranchisesList = document.getElementById('registered-franchises-list');
    const registerSectionOverlay = document.querySelector('#franchise-register-section .loading-overlay'); // Adicionado

    // Elementos do Modal de Edição
    const editModal = document.getElementById('edit-franchise-modal');
    const editForm = document.getElementById('edit-franchise-form');
    const editOriginalNameInput = document.getElementById('edit-original-franchise-name');
    const editNameInput = document.getElementById('edit-franchise-name');
    const editFeeCheckboxes = document.querySelectorAll('.edit-fee-checkbox');
    const editModalSaveBtn = document.getElementById('edit-modal-save-btn');
    const editModalCancelBtn = document.getElementById('edit-modal-cancel-btn');

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const BASE_FEE_ITEMS = ["Royalty Fee", "Marketing Fee", "Software Fee", "Call Center Fee", "Call Center Fee Extra"];

    // --- Estado da Aplicação ---
    let franchisesConfig = [];
    let currentCalculationData = {
        selectedFranchiseName: null, config: null, month: MONTHS[new Date().getMonth()],
        royaltyRate: 6.0, marketingRate: 1.0, totalValue: 0,
        calculationRows: [], fileData: [], metrics: { pets: 0, services: 0 }
    };

    // --- Funções Auxiliares ---
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
        if (!toastContainer) return;
        const toast = document.createElement('div');
        let bgColor = 'bg-card text-foreground border border-border';
        if (type === 'success') bgColor = 'bg-success text-success-foreground border border-green-700';
        if (type === 'error') bgColor = 'bg-destructive text-destructive-foreground border border-red-800';
        toast.className = `w-80 p-4 rounded-lg shadow-large ${bgColor} animate-toast-in`;
        toast.innerHTML = `<p class="font-semibold">${message}</p>`;
        toastContainer.prepend(toast); // Adiciona no topo
        setTimeout(() => {
            toast.classList.add('animate-toast-out');
            toast.addEventListener('animationend', () => toast.remove());
        }, duration);
    }

     function showLoadingOverlay(sectionElement = mainContent) {
         const overlay = sectionElement.querySelector('.loading-overlay');
         if (overlay) overlay.classList.remove('hidden');
         else { // Cria se não existir (para o main content)
             const newOverlay = document.createElement('div');
             newOverlay.className = 'loading-overlay';
             newOverlay.innerHTML = `<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>`;
             sectionElement.style.position = 'relative'; // Garante que o overlay fique contido
             sectionElement.appendChild(newOverlay);
         }
     }

     function hideLoadingOverlay(sectionElement = mainContent) {
         const overlay = sectionElement.querySelector('.loading-overlay');
         if (overlay) overlay.classList.add('hidden');
     }

    const feeItemToApiField = { "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing", "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter", "Call Center Fee Extra": "IncludeCallCenterExtra" };
    const apiFieldToFeeItem = Object.fromEntries(Object.entries(feeItemToApiField).map(([key, value]) => [value, key]));

    // --- Lógica de Cálculo ---
    function calculateServiceValue(description, currentServiceValue) {
        // ... (igual à versão anterior)
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

    // --- Funções API ---
    async function fetchFranchiseConfigs() {
        showLoadingOverlay(document.getElementById('registered-franchises-list').closest('section'));
        try {
            registeredFranchisesList.innerHTML = `<p class="p-4 text-muted-foreground italic">Loading...</p>`;
            const response = await fetch('/api/manage-franchise-config');
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `HTTP error ${response.status}` }));
                throw new Error(errorData.message);
            }
            franchisesConfig = await response.json();
            renderRegisteredFranchises();
            populateFranchiseSelect();
        } catch (error) {
            console.error("Error fetching franchise configurations:", error);
            registeredFranchisesList.innerHTML = `<p class="p-4 text-red-600">Error loading configurations: ${error.message}</p>`;
            showToast(`Error loading configurations: ${error.message}`, 'error');
            franchisesConfig = [];
            populateFranchiseSelect();
        } finally {
            hideLoadingOverlay(document.getElementById('registered-franchises-list').closest('section'));
        }
    }

    async function addFranchiseConfig(name, includedFees) {
        showLoadingOverlay(addFranchiseForm.closest('section'));
        try {
            const response = await fetch('/api/manage-franchise-config', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ franchiseName: name, includedFees: includedFees })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            showToast(result.message, 'success');
            await fetchFranchiseConfigs();
            addFranchiseForm.reset();
            // Reset checkboxes
             newFeeCheckboxes.forEach(cb => cb.checked = (cb.dataset.feeItem !== 'Call Center Fee Extra')); // Default checked state

        } catch (error) {
            console.error("Error adding franchise:", error);
            showToast(`Error adding franchise: ${error.message}`, 'error');
        } finally {
             hideLoadingOverlay(addFranchiseForm.closest('section'));
        }
    }

    async function updateFranchiseConfig(originalName, newName, includedFees) {
        showLoadingOverlay(editModal); // Mostra overlay no modal
        editModalSaveBtn.disabled = true;
        try {
            const response = await fetch('/api/manage-franchise-config', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalFranchiseName: originalName, newFranchiseName: newName, includedFees: includedFees })
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
            hideLoadingOverlay(editModal);
            editModalSaveBtn.disabled = false;
        }
    }

    async function deleteFranchiseConfig(name) {
        if (!confirm(`Are you sure you want to delete the franchise "${name}"? This cannot be undone.`)) return;
        showLoadingOverlay(registeredFranchisesList.closest('section'));
        try {
            const response = await fetch('/api/manage-franchise-config', {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ franchiseName: name })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            showToast(result.message, 'success');
            await fetchFranchiseConfigs();
        } catch (error) {
            console.error("Error deleting franchise:", error);
            showToast(`Error deleting franchise: ${error.message}`, 'error');
        } finally {
            hideLoadingOverlay(registeredFranchisesList.closest('section'));
        }
    }

    // --- Funções de Renderização ---
    function populateFranchiseSelect() {
        // ... (igual à versão anterior)
         const currentSelection = franchiseSelect.value;
         franchiseSelect.innerHTML = '<option value="">-- Select a Registered Franchise --</option>';
         franchisesConfig.sort((a, b) => a.franchiseName.localeCompare(b.franchiseName)).forEach(config => {
             const option = document.createElement('option');
             option.value = config.franchiseName;
             option.textContent = config.franchiseName;
             franchiseSelect.appendChild(option);
         });
         if (franchisesConfig.some(c => c.franchiseName === currentSelection)) {
             franchiseSelect.value = currentSelection;
         } else {
             franchiseSelect.value = "";
             resetCalculationSection();
         }
         toggleCalculationFields(franchiseSelect.value !== "");
    }

    function renderRegisteredFranchises() {
        // ... (igual à versão anterior, incluindo listeners para edit/delete)
        registeredFranchisesList.innerHTML = '';
         if (franchisesConfig.length === 0) {
             registeredFranchisesList.innerHTML = `<p class="p-4 text-muted-foreground italic">No franchises registered yet.</p>`;
             return;
         }

         franchisesConfig.sort((a, b) => a.franchiseName.localeCompare(b.franchiseName)).forEach(config => {
             const includedItems = Object.entries(config)
                 .filter(([key, value]) => key.startsWith('Include') && value === true)
                 .map(([key]) => apiFieldToFeeItem[key] || key.replace('Include', ''))
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
             registeredFranchisesList.appendChild(listItem);
         });

         registeredFranchisesList.querySelectorAll('.edit-franchise-btn').forEach(btn => {
             btn.addEventListener('click', (e) => openEditModal(e.currentTarget.dataset.name));
         });
         registeredFranchisesList.querySelectorAll('.delete-registered-franchise-btn').forEach(btn => {
             btn.addEventListener('click', (e) => deleteFranchiseConfig(e.currentTarget.dataset.name));
         });
    }

    function populateMonthSelect() {
        // ... (igual à versão anterior)
        const currentMonthIndex = new Date().getMonth();
        reportMonthSelect.innerHTML = MONTHS.map((month, index) =>
            `<option value="${month}" ${index === currentMonthIndex ? 'selected' : ''}>${month}</option>`
        ).join('');
    }

    // Gera as linhas baseadas na config ATUAL da franquia SELECIONADA
    function generateCalculationRows() {
         const config = currentCalculationData.config;
         if (!config) return [];

         const defaultRows = getDefaultCalculationRows();
         const rowsToShow = [];

         defaultRows.forEach(defaultRow => {
             const apiField = feeItemToApiField[defaultRow.Item];
             if (defaultRow.fixed && apiField && config[apiField]) {
                 rowsToShow.push(JSON.parse(JSON.stringify(defaultRow)));
             }
         });
        // Adiciona quaisquer linhas customizadas já existentes para esta franquia (se tivéssemos essa lógica)
        // Por enquanto, só adiciona as linhas base configuradas.
         return rowsToShow;
     }

    function updateCalculationTableDOM() {
        // ... (igual à versão anterior, mas usa currentCalculationData.calculationRows)
         calculationTbody.innerHTML = '';
         const calculationRows = currentCalculationData.calculationRows;

         if (!currentCalculationData.selectedFranchiseName || calculationRows.length === 0) {
              calculationTbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
              calculateAndDisplayTotals();
              return;
         }

         calculationRows.forEach((rowData, rowIndex) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-border calculation-row';
            tr.dataset.index = rowIndex;

            const isFixed = rowData.fixed || false;
            const isRateFee = rowData.Item === "Royalty Fee" || rowData.Item === "Marketing Fee";
            const isSoftwareFee = rowData.Item === "Software Fee";
            const isCallCenterBase = rowData.Item === "Call Center Fee";
            const isCallCenterExtra = rowData.Item === "Call Center Fee Extra";

            // Qty
            let qtyValue = rowData.Qty;
            let qtyDisabled = isFixed;
            if (isRateFee) {
                qtyValue = (rowData.Item === "Royalty Fee" ? currentCalculationData.royaltyRate : currentCalculationData.marketingRate).toFixed(1);
                qtyDisabled = true;
            } else if (isSoftwareFee || isCallCenterBase) {
                qtyValue = 1; qtyDisabled = false; // Permitir edição
            } else if (isCallCenterExtra) {
                qtyValue = rowData.Qty; qtyDisabled = false; // Permitir edição
            } else { qtyValue = rowData.Qty; qtyDisabled = false; } // Custom

            // Unit Price
            let unitPriceValue = rowData.Unit_price;
            let unitPriceDisabled = isFixed;
            let unitPriceElementHTML;
            if (isRateFee) {
                unitPriceValue = currentCalculationData.totalValue; unitPriceDisabled = true;
                unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
            } else if (isSoftwareFee) {
                const options = [0.00, 250.00, 350.00]; unitPriceValue = rowData.Unit_price; unitPriceDisabled = false;
                unitPriceElementHTML = `<select class="w-full text-right unit-price">${options.map(o => `<option value="${o.toFixed(2)}" ${Math.abs(o - unitPriceValue) < 0.01 ? 'selected' : ''}>${formatCurrency(o)}</option>`).join('')}</select>`;
            } else if (isCallCenterBase || isCallCenterExtra) {
                unitPriceValue = isCallCenterBase ? 1200.00 : 600.00; unitPriceDisabled = true;
                unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
            } else { unitPriceValue = rowData.Unit_price; unitPriceDisabled = false; // Custom
                 unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}">`;
            }

            // Amount (calculated) - Não guarda no rowData aqui
            let amount = 0;
            const currentQty = parseFloat(qtyValue) || 0;
            const currentUnitPrice = parseFloat(unitPriceValue) || 0;
            if (isRateFee) { amount = (currentQty / 100) * currentUnitPrice; }
            else { amount = currentQty * currentUnitPrice; }

            tr.innerHTML = `
                <td class="p-2"><input type="text" class="w-full item-name" value="${rowData.Item}" ${isFixed ? 'disabled' : ''}></td>
                <td class="p-2"><input type="text" class="w-full description" value="${rowData.Description}"></td>
                <td class="p-2"><input type="number" step="${isRateFee ? 0.1 : 1}" class="w-full text-center qty ${currentQty === 0 && !isFixed ? 'red-text' : ''}" value="${isRateFee ? qtyValue : currentQty}" ${qtyDisabled ? 'disabled' : ''}></td>
                <td class="p-2">${unitPriceElementHTML}</td>
                <td class="p-2"><input type="text" class="w-full text-right amount" value="${formatCurrency(amount)}" disabled></td>
                <td class="p-2 checkbox-cell"><input type="checkbox" class="verified" ${rowData.verified ? 'checked' : ''}></td>
                <td class="p-2"> ${!isFixed ? '<button class="text-red-600 hover:text-red-800 delete-calculation-row-btn p-1">🗑️</button>' : ''} </td>
            `;
            calculationTbody.appendChild(tr);
        });

         calculateAndDisplayTotals();
    }

    function addCalculationRowUI() {
        // ... (igual à versão anterior)
         if (!currentCalculationData.selectedFranchiseName) return;
         currentCalculationData.calculationRows.push({ Item: "", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: false });
         updateCalculationTableDOM();
    }

    function deleteCalculationRowUI(rowIndex) {
        // ... (igual à versão anterior, mas usa updateCalculationTableDOM())
         if (!currentCalculationData.selectedFranchiseName || rowIndex < 0 || rowIndex >= currentCalculationData.calculationRows.length) return;

         const baseFeeCount = currentCalculationData.calculationRows.filter(r => r.fixed).length;
         if (rowIndex < baseFeeCount) {
             console.warn("Cannot delete base fee rows."); return;
         }
         currentCalculationData.calculationRows.splice(rowIndex, 1);
         updateCalculationTableDOM();
     }


    function calculateAndDisplayTotals() {
        // ... (igual à versão anterior)
        let totalAmount = 0;
        calculationTbody.querySelectorAll('.calculation-row').forEach(tr => {
            const rowIndex = parseInt(tr.dataset.index);
             // Adiciona verificação para índice inválido (pode acontecer durante re-render rápido)
             if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentCalculationData.calculationRows.length) {
                 console.warn("Skipping row with invalid index during total calculation:", rowIndex);
                 return;
             }
            const rowData = currentCalculationData.calculationRows[rowIndex];

            const qtyInput = tr.querySelector('.qty');
            const unitPriceInput = tr.querySelector('.unit-price');
            const amountInput = tr.querySelector('.amount');

            const isRateFee = rowData.Item === "Royalty Fee" || rowData.Item === "Marketing Fee";

            const qty = parseFloat(qtyInput.value) || 0;
            const unitPrice = parseFloat(unitPriceInput.value) || 0;
            let amount = 0;

            if (isRateFee) { amount = (qty / 100) * unitPrice; }
            else { amount = qty * unitPrice; }

            rowData.Amount = amount; // Atualiza estado
            amountInput.value = formatCurrency(amount); // Atualiza display
            totalAmount += amount;
        });

        calculationTotalDisplay.textContent = formatCurrency(totalAmount);
        metricTotalFees.textContent = formatCurrency(totalAmount);
    }

    function updateMetrics() {
        // ... (igual à versão anterior)
         metricPets.textContent = currentCalculationData.metrics.pets;
         metricServicesCount.textContent = currentCalculationData.metrics.services;
         metricTotalValue.textContent = formatCurrency(currentCalculationData.totalValue);
         // Total Fees é atualizado por calculateAndDisplayTotals()
    }

    function resetCalculationSection() {
        // ... (igual à versão anterior)
        fileInput.value = '';
        royaltyRateInput.value = '6.0';
        marketingRateInput.value = '1.0';
        currentCalculationData = {
             selectedFranchiseName: null, config: null,
             month: reportMonthSelect.value || MONTHS[new Date().getMonth()],
             royaltyRate: 6.0, marketingRate: 1.0, totalValue: 0,
             calculationRows: [], fileData: [], metrics: { pets: 0, services: 0 }
        };
        updateMetrics();
        calculationTbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
        calculationTotalDisplay.textContent = formatCurrency(0);
        toggleCalculationFields(false); // Garante que campos fiquem desabilitados
    }

    function toggleCalculationFields(enabled) {
        // ... (igual à versão anterior)
         fileInput.disabled = !enabled;
         royaltyRateInput.disabled = !enabled;
         marketingRateInput.disabled = !enabled;
         addCalculationRowBtn.disabled = !enabled;
         if (!enabled && franchiseSelect.value !== "") { // Só reseta se DESABILITANDO e não for o estado inicial
              resetCalculationSection(); // Chama reset se desabilitar
         }
     }


    function getDefaultCalculationRows() {
         // Retorna cópia profunda do template base (não depende mais da config aqui)
         return JSON.parse(JSON.stringify([
            { Item: "Royalty Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true },
            { Item: "Marketing Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true },
            { Item: "Software Fee", Description: "", Qty: 1, Unit_price: 350.00, Amount: 0, verified: false, fixed: true },
            { Item: "Call Center Fee", Description: "", Qty: 1, Unit_price: 1200.00, Amount: 0, verified: false, fixed: true },
            { Item: "Call Center Fee Extra", Description: "", Qty: 0, Unit_price: 600.00, Amount: 0, verified: false, fixed: true }
        ]));
    }

    // --- File Processing ---
    async function handleFileUpload(event) {
        // ... (igual à versão anterior)
         if (!currentCalculationData.selectedFranchiseName) {
             alert("Please select a franchise first."); fileInput.value = ''; return;
         }
         const files = event.target.files; if (files.length === 0) return;
         loadingSpinner.classList.remove('hidden');
         let combinedData = [];
         for (const file of files) {
             try {
                 const data = await file.arrayBuffer(); const workbook = XLSX.read(data);
                 const sheetName = workbook.SheetNames[0]; const worksheet = workbook.Sheets[sheetName];
                 const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                 combinedData.push(...jsonData);
             } catch (error) { console.error(`Error processing file ${file.name}:`, error); alert(`Error reading file ${file.name}.`); }
         }
         loadingSpinner.classList.add('hidden');
         currentCalculationData.fileData = combinedData;
         processUploadedData();
     }

    function processUploadedData() {
        // ... (igual à versão anterior, mas chama generateCalculationRows() no final)
         const data = currentCalculationData.fileData;
         const config = currentCalculationData.config;

         // Reset antes de processar
         currentCalculationData.metrics = { pets: 0, services: 0 };
         currentCalculationData.totalValue = 0;

         if (!config || !data || data.length === 0) {
             currentCalculationData.calculationRows = generateCalculationRows(); // Gera linhas base vazias
             updateMetrics();
             updateCalculationTableDOM(); // Renderiza msg 'Select...'
             if (data && data.length > 0) showToast("No valid service data found in the uploaded file(s).", 'warning');
             return;
         }

         let petsServiced = 0; let servicesCount = 0; let totalAdjustedValue = 0;
         data.forEach(row => {
             if (row['Ticket ID'] === 'Grand Total' || String(row['Description']).includes('Grand Total')) return;
             const description = row['Description']; const totalValue = parseCurrency(row['Total']);
             if (description && totalValue > 0) {
                 const adjustedValue = calculateServiceValue(description, totalValue);
                 totalAdjustedValue += adjustedValue; servicesCount++; petsServiced++;
             }
         });
         currentCalculationData.metrics = { pets: petsServiced, services: servicesCount };
         currentCalculationData.totalValue = totalAdjustedValue;
         currentCalculationData.calculationRows = generateCalculationRows(); // Gera linhas com base na config
         updateMetrics();
         updateCalculationTableDOM(); // Renderiza a tabela com valores calculados
    }

    // --- Funções do Modal de Edição ---
    function openEditModal(franchiseName) {
        // ... (igual à versão anterior)
        const config = franchisesConfig.find(c => c.franchiseName === franchiseName);
         if (!config) return;
         editOriginalNameInput.value = config.franchiseName; editNameInput.value = config.franchiseName;
         editFeeCheckboxes.forEach(checkbox => {
             const feeItem = checkbox.dataset.feeItem; const apiField = feeItemToApiField[feeItem];
             checkbox.checked = config[apiField] || false;
         });
         editModal.classList.remove('hidden');
    }
    function closeEditModal() {
        // ... (igual à versão anterior)
        editModal.classList.add('hidden'); editForm.reset();
    }
    function handleSaveEdit() {
        // ... (igual à versão anterior)
        const originalName = editOriginalNameInput.value; const newName = editNameInput.value.trim();
        const includedFees = {};
        editFeeCheckboxes.forEach(checkbox => { includedFees[checkbox.dataset.feeItem] = checkbox.checked; });
        if (!newName) { alert("Franchise name cannot be empty."); return; }
        updateFranchiseConfig(originalName, newName, includedFees);
    }

    // --- Event Listeners ---
    addFranchiseForm.addEventListener('submit', (e) => {
        // ... (igual à versão anterior)
        e.preventDefault(); const name = newFranchiseNameInput.value.trim();
        const includedFees = {};
        newFeeCheckboxes.forEach(checkbox => { includedFees[checkbox.dataset.feeItem] = checkbox.checked; });
        if (name) { addFranchiseConfig(name, includedFees); } else { alert("Please enter a franchise name."); }
    });

    franchiseSelect.addEventListener('change', (e) => {
        // ... (igual à versão anterior)
        const selectedName = e.target.value;
        if (selectedName) {
            currentCalculationData.selectedFranchiseName = selectedName;
            currentCalculationData.config = franchisesConfig.find(c => c.franchiseName === selectedName);
            // Reset fields related to file upload and specific rates
            fileInput.value = '';
            currentCalculationData.fileData = [];
            currentCalculationData.totalValue = 0;
            currentCalculationData.metrics = { pets: 0, services: 0 };
            currentCalculationData.calculationRows = generateCalculationRows(); // Gera linhas baseadas na nova config
            updateMetrics();
            updateCalculationTableDOM(); // Renderiza a estrutura da tabela (ou mensagem)
            toggleCalculationFields(true);
        } else {
            resetCalculationSection(); // Reseta tudo se nenhuma franquia for selecionada
        }
    });

    reportMonthSelect.addEventListener('change', (e) => { currentCalculationData.month = e.target.value; });
    fileInput.addEventListener('change', handleFileUpload);
    royaltyRateInput.addEventListener('change', (e) => { currentCalculationData.royaltyRate = parseCurrency(e.target.value) || 0; updateCalculationTableDOM(); });
    marketingRateInput.addEventListener('change', (e) => { currentCalculationData.marketingRate = parseCurrency(e.target.value) || 0; updateCalculationTableDOM(); });
    addCalculationRowBtn.addEventListener('click', addCalculationRowUI);

    calculationTbody.addEventListener('change', (e) => {
         // ... (igual à versão anterior, chama calculateAndDisplayTotals)
         const target = e.target;
         const rowElement = target.closest('.calculation-row');
         if (!rowElement) return;
         const rowIndex = parseInt(rowElement.dataset.index);
         if (isNaN(rowIndex) || rowIndex >= currentCalculationData.calculationRows.length) return;
         const rowData = currentCalculationData.calculationRows[rowIndex];

         if (target.classList.contains('item-name')) { rowData.Item = target.value; }
         else if (target.classList.contains('description')) { rowData.Description = target.value; }
         else if (target.classList.contains('qty')) { rowData.Qty = target.value; target.classList.toggle('red-text', (parseFloat(target.value) || 0) === 0 && !rowData.fixed); }
         else if (target.classList.contains('unit-price')) { rowData.Unit_price = target.value; }
         else if (target.classList.contains('verified')) { rowData.verified = target.checked; }
         calculateAndDisplayTotals();
     });

    calculationTbody.addEventListener('click', (e) => {
         // ... (igual à versão anterior)
          if (e.target.classList.contains('delete-calculation-row-btn')) {
              const rowElement = e.target.closest('.calculation-row');
              if (rowElement) { const rowIndex = parseInt(rowElement.dataset.index); deleteCalculationRowUI(rowIndex); }
          }
      });

    editModalSaveBtn.addEventListener('click', handleSaveEdit);
    editModalCancelBtn.addEventListener('click', closeEditModal);

    // --- Inicialização ---
    populateMonthSelect();
    fetchFranchiseConfigs();
    resetCalculationSection();

});
