document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos DOM ---
    const franchisesContainer = document.getElementById('franchises-container'); // Container principal (agora só tem uma seção de cálculo)
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

    // Elementos da Seção de Registro
    const addFranchiseForm = document.getElementById('add-franchise-form');
    const newFranchiseNameInput = document.getElementById('new-franchise-name');
    const newFeeCheckboxes = document.querySelectorAll('.new-fee-checkbox');
    const registeredFranchisesList = document.getElementById('registered-franchises-list');

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
    let franchisesConfig = []; // Armazena [{ franchiseName: "...", IncludeRoyalty: true, ... }, ...]
    let currentCalculationData = {
        selectedFranchiseName: null,
        config: null, // Configuração da franquia selecionada
        month: MONTHS[new Date().getMonth()],
        royaltyRate: 6.0,
        marketingRate: 1.0,
        totalValue: 0,
        calculationRows: [], // Linhas da tabela DESTA instância
        fileData: [], // Dados brutos do arquivo processado
        metrics: { pets: 0, services: 0 }
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

    // Mapeamento Coluna API <-> Nome do Item (para facilitar)
    const feeItemToApiField = {
        "Royalty Fee": "IncludeRoyalty",
        "Marketing Fee": "IncludeMarketing",
        "Software Fee": "IncludeSoftware",
        "Call Center Fee": "IncludeCallCenter",
        "Call Center Fee Extra": "IncludeCallCenterExtra"
    };
    const apiFieldToFeeItem = Object.fromEntries(Object.entries(feeItemToApiField).map(([key, value]) => [value, key]));

    // --- Lógica de Cálculo (Traduzida do Python) ---
    function calculateServiceValue(description, currentServiceValue) {
         description = String(description || '');
         currentServiceValue = parseCurrency(currentServiceValue);
         // Regras copiadas da versão Python...
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
        try {
            registeredFranchisesList.innerHTML = `<p class="p-4 text-muted-foreground italic">Loading...</p>`;
            const response = await fetch('/api/manage-franchise-config');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }
            franchisesConfig = await response.json();
            renderRegisteredFranchises();
            populateFranchiseSelect();
        } catch (error) {
            console.error("Error fetching franchise configurations:", error);
            registeredFranchisesList.innerHTML = `<p class="p-4 text-red-600">Error loading configurations: ${error.message}</p>`;
            franchisesConfig = []; // Reseta em caso de erro
            populateFranchiseSelect(); // Popula o select mesmo vazio
        }
    }

    async function addFranchiseConfig(name, includedFees) {
        try {
            const response = await fetch('/api/manage-franchise-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ franchiseName: name, includedFees: includedFees })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            alert(result.message);
            await fetchFranchiseConfigs(); // Recarrega a lista
            addFranchiseForm.reset(); // Limpa o formulário
        } catch (error) {
            console.error("Error adding franchise:", error);
            alert(`Error adding franchise: ${error.message}`);
        }
    }

     async function updateFranchiseConfig(originalName, newName, includedFees) {
         try {
             const response = await fetch('/api/manage-franchise-config', {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ originalFranchiseName: originalName, newFranchiseName: newName, includedFees: includedFees })
             });
             const result = await response.json();
             if (!result.success) throw new Error(result.message);
             alert(result.message);
             closeEditModal();
             await fetchFranchiseConfigs(); // Recarrega a lista
         } catch (error) {
             console.error("Error updating franchise:", error);
             alert(`Error updating franchise: ${error.message}`);
         }
     }

     async function deleteFranchiseConfig(name) {
         if (!confirm(`Are you sure you want to delete the franchise "${name}"? This cannot be undone.`)) {
             return;
         }
         try {
             const response = await fetch('/api/manage-franchise-config', {
                 method: 'DELETE',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ franchiseName: name })
             });
             const result = await response.json();
             if (!result.success) throw new Error(result.message);
             alert(result.message);
             await fetchFranchiseConfigs(); // Recarrega a lista
         } catch (error) {
             console.error("Error deleting franchise:", error);
             alert(`Error deleting franchise: ${error.message}`);
         }
     }


    // --- Funções de Renderização ---

    function populateFranchiseSelect() {
        const currentSelection = franchiseSelect.value;
        franchiseSelect.innerHTML = '<option value="">-- Select a Registered Franchise --</option>';
        franchisesConfig.sort((a, b) => a.franchiseName.localeCompare(b.franchiseName)).forEach(config => {
            const option = document.createElement('option');
            option.value = config.franchiseName;
            option.textContent = config.franchiseName;
            franchiseSelect.appendChild(option);
        });
         // Tenta manter a seleção anterior, se ainda existir
        if (franchisesConfig.some(c => c.franchiseName === currentSelection)) {
            franchiseSelect.value = currentSelection;
        } else {
             franchiseSelect.value = ""; // Reseta se a seleção anterior não existe mais
             resetCalculationSection();
        }
         // Habilita/desabilita campos dependendo se uma franquia está selecionada
         toggleCalculationFields(franchiseSelect.value !== "");
    }

     function renderRegisteredFranchises() {
         registeredFranchisesList.innerHTML = ''; // Limpa a lista
         if (franchisesConfig.length === 0) {
             registeredFranchisesList.innerHTML = `<p class="p-4 text-muted-foreground italic">No franchises registered yet.</p>`;
             return;
         }

         franchisesConfig.sort((a, b) => a.franchiseName.localeCompare(b.franchiseName)).forEach(config => {
             const includedItems = Object.entries(config)
                 .filter(([key, value]) => key.startsWith('Include') && value === true)
                 .map(([key]) => apiFieldToFeeItem[key] || key.replace('Include', '')) // Mapeia de volta para nome amigável
                 .join(', ');

             const listItem = document.createElement('div');
             listItem.className = 'franchise-list-item';
             listItem.innerHTML = `
                 <div>
                     <p class="font-semibold">${config.franchiseName}</p>
                     <p class="text-xs text-muted-foreground">Includes: ${includedItems || 'None'}</p>
                 </div>
                 <div class="space-x-2">
                     <button class="edit-franchise-btn text-blue-600 hover:text-blue-800" data-name="${config.franchiseName}" title="Edit">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                     </button>
                     <button class="delete-registered-franchise-btn text-red-600 hover:text-red-800" data-name="${config.franchiseName}" title="Delete">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                     </button>
                 </div>
             `;
             registeredFranchisesList.appendChild(listItem);
         });

         // Adiciona listeners para os botões de editar e deletar da lista
         registeredFranchisesList.querySelectorAll('.edit-franchise-btn').forEach(btn => {
             btn.addEventListener('click', (e) => openEditModal(e.currentTarget.dataset.name));
         });
         registeredFranchisesList.querySelectorAll('.delete-registered-franchise-btn').forEach(btn => {
             btn.addEventListener('click', (e) => deleteFranchiseConfig(e.currentTarget.dataset.name));
         });
     }

     function populateMonthSelect() {
         const currentMonthIndex = new Date().getMonth();
         reportMonthSelect.innerHTML = MONTHS.map((month, index) =>
             `<option value="${month}" ${index === currentMonthIndex ? 'selected' : ''}>${month}</option>`
         ).join('');
     }

     // Gera as linhas da tabela de cálculo baseadas na configuração da franquia selecionada
     function generateCalculationRows(config) {
         if (!config) return [];

         const defaultRows = getDefaultCalculationRows(); // Pega o template base
         const rowsToShow = [];

         defaultRows.forEach(defaultRow => {
             const apiField = feeItemToApiField[defaultRow.Item];
             // Inclui a linha se for uma linha fixa E estiver marcada na configuração
             if (defaultRow.fixed && apiField && config[apiField]) {
                  // Cria uma cópia profunda para evitar modificar o template original
                 rowsToShow.push(JSON.parse(JSON.stringify(defaultRow)));
             }
         });
         return rowsToShow;
     }

     // Atualiza a tabela de cálculo no DOM
     function updateCalculationTableDOM(calculationRows) {
         calculationTbody.innerHTML = ''; // Limpa antes de renderizar

         if (!currentCalculationData.selectedFranchiseName || calculationRows.length === 0) {
              calculationTbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
              calculateAndDisplayTotals(); // Atualiza o total (deve ser $0.00)
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
                 const rate = rowData.Item === "Royalty Fee" ? currentCalculationData.royaltyRate : currentCalculationData.marketingRate;
                 qtyValue = rate.toFixed(1);
                 qtyDisabled = true;
             } else if (isSoftwareFee || isCallCenterBase) {
                 qtyValue = 1;
                 qtyDisabled = false; // Permitir edição
             } else if (isCallCenterExtra) {
                 qtyValue = rowData.Qty;
                 qtyDisabled = false; // Permitir edição
             } else if (!isFixed) { // Custom row
                  qtyValue = rowData.Qty;
                  qtyDisabled = false;
             }

             // Unit Price
             let unitPriceValue = rowData.Unit_price;
             let unitPriceDisabled = isFixed;
             let unitPriceElementHTML;

             if (isRateFee) {
                 unitPriceValue = currentCalculationData.totalValue; // Usa o valor total calculado do arquivo
                 unitPriceDisabled = true;
                 unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
             } else if (isSoftwareFee) {
                 const options = [0.00, 250.00, 350.00];
                 unitPriceValue = rowData.Unit_price; // Usa valor guardado
                 unitPriceDisabled = false;
                 unitPriceElementHTML = `
                     <select class="w-full text-right unit-price">
                         ${options.map(o => `<option value="${o.toFixed(2)}" ${Math.abs(o - unitPriceValue) < 0.01 ? 'selected' : ''}>${formatCurrency(o)}</option>`).join('')}
                     </select>`;
             } else if (isCallCenterBase || isCallCenterExtra) {
                 unitPriceValue = isCallCenterBase ? 1200.00 : 600.00;
                 unitPriceDisabled = true;
                 unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
             } else { // Custom row
                 unitPriceValue = rowData.Unit_price;
                 unitPriceDisabled = false;
                 unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}">`;
             }

             // Amount (calculated)
             let amount = 0;
             const currentQty = parseFloat(qtyValue) || 0; // Usa o valor exibido para cálculo imediato
             const currentUnitPrice = parseFloat(unitPriceValue) || 0;
              if (isRateFee) {
                  amount = (currentQty / 100) * currentUnitPrice;
              } else {
                  amount = currentQty * currentUnitPrice;
              }
             // NÃO atualiza rowData.Amount aqui, isso é feito no handler de change


             tr.innerHTML = `
                 <td class="p-2"><input type="text" class="w-full item-name" value="${rowData.Item}" ${isFixed ? 'disabled' : ''}></td>
                 <td class="p-2"><input type="text" class="w-full description" value="${rowData.Description}"></td>
                 <td class="p-2"><input type="number" step="${isRateFee ? 0.1 : 1}" class="w-full text-center qty ${currentQty === 0 && !isFixed ? 'red-text' : ''}" value="${isRateFee ? qtyValue : currentQty}" ${qtyDisabled ? 'disabled' : ''}></td>
                 <td class="p-2">${unitPriceElementHTML}</td>
                 <td class="p-2"><input type="text" class="w-full text-right amount" value="${formatCurrency(amount)}" disabled></td>
                 <td class="p-2 checkbox-cell"><input type="checkbox" class="verified" ${rowData.verified ? 'checked' : ''}></td>
                 <td class="p-2">
                     ${!isFixed ? '<button class="text-red-600 hover:text-red-800 delete-calculation-row-btn">🗑️</button>' : ''}
                 </td>
             `;
             calculationTbody.appendChild(tr);
         });

         calculateAndDisplayTotals(); // Calcula e exibe o total geral
     }

     function addCalculationRowUI() {
         if (!currentCalculationData.selectedFranchiseName) return; // Não adiciona se nenhuma franquia selecionada

         currentCalculationData.calculationRows.push({ Item: "", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: false });
         updateCalculationTableDOM(currentCalculationData.calculationRows);
     }

      function deleteCalculationRowUI(rowIndex) {
         if (!currentCalculationData.selectedFranchiseName || rowIndex < 0 || rowIndex >= currentCalculationData.calculationRows.length) return;

         // Impede deletar linhas fixas (as primeiras N, onde N é o número de fees base)
         const baseFeeCount = BASE_FEE_ITEMS.filter(item => {
             const apiField = feeItemToApiField[item];
             return currentCalculationData.config && currentCalculationData.config[apiField];
         }).length;

         if (rowIndex < baseFeeCount) {
              console.warn("Cannot delete base fee rows.");
              return;
         }


         currentCalculationData.calculationRows.splice(rowIndex, 1);
         updateCalculationTableDOM(currentCalculationData.calculationRows); // Re-renderiza a tabela
     }

    function calculateAndDisplayTotals() {
        let totalAmount = 0;
        // Recalcula todos os amounts antes de somar, pegando valores direto do DOM para garantir atualização
        calculationTbody.querySelectorAll('.calculation-row').forEach(tr => {
            const rowIndex = parseInt(tr.dataset.index);
            const rowData = currentCalculationData.calculationRows[rowIndex];
            if(!rowData) return; // Skip if row data doesn't exist

            const qtyInput = tr.querySelector('.qty');
            const unitPriceInput = tr.querySelector('.unit-price'); // Pode ser input ou select
            const amountInput = tr.querySelector('.amount');

            const isRateFee = rowData.Item === "Royalty Fee" || rowData.Item === "Marketing Fee";

            const qty = parseFloat(qtyInput.value) || 0;
            const unitPrice = parseFloat(unitPriceInput.value) || 0;
            let amount = 0;

             if (isRateFee) {
                 amount = (qty / 100) * unitPrice;
             } else {
                 amount = qty * unitPrice;
             }
             rowData.Amount = amount; // Atualiza o valor no estado interno
             amountInput.value = formatCurrency(amount); // Atualiza o display do amount
             totalAmount += amount;
        });


        calculationTotalDisplay.textContent = formatCurrency(totalAmount);
        metricTotalFees.textContent = formatCurrency(totalAmount);
    }

    function updateMetrics() {
        metricPets.textContent = currentCalculationData.metrics.pets;
        metricServicesCount.textContent = currentCalculationData.metrics.services;
        metricTotalValue.textContent = formatCurrency(currentCalculationData.totalValue);
        // Total Fees é atualizado por calculateAndDisplayTotals()
    }

    // Reseta a seção de cálculo
    function resetCalculationSection() {
        fileInput.value = ''; // Limpa seleção de arquivo
        royaltyRateInput.value = '6.0';
        marketingRateInput.value = '1.0';
        currentCalculationData = {
             selectedFranchiseName: null,
             config: null,
             month: reportMonthSelect.value || MONTHS[new Date().getMonth()],
             royaltyRate: 6.0,
             marketingRate: 1.0,
             totalValue: 0,
             calculationRows: [],
             fileData: [],
             metrics: { pets: 0, services: 0 }
        };
        updateMetrics();
        calculationTbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
        calculationTotalDisplay.textContent = formatCurrency(0);
    }

     // Habilita/desabilita campos da seção de cálculo
     function toggleCalculationFields(enabled) {
         fileInput.disabled = !enabled;
         royaltyRateInput.disabled = !enabled;
         marketingRateInput.disabled = !enabled;
         addCalculationRowBtn.disabled = !enabled;
         // Também reseta se desabilitado
         if (!enabled) {
             resetCalculationSection();
         }
     }

     // --- File Processing ---
     async function handleFileUpload(event) {
         if (!currentCalculationData.selectedFranchiseName) {
             alert("Please select a franchise before uploading a file.");
             fileInput.value = ''; // Limpa seleção
             return;
         }

         const files = event.target.files;
         if (files.length === 0) return;

         loadingSpinner.classList.remove('hidden');
         let combinedData = [];

         for (const file of files) {
             try {
                 const data = await file.arrayBuffer();
                 const workbook = XLSX.read(data);
                 const sheetName = workbook.SheetNames[0];
                 const worksheet = workbook.Sheets[sheetName];
                 const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                 combinedData.push(...jsonData);
             } catch (error) {
                 console.error(`Error processing file ${file.name}:`, error);
                 alert(`Error reading file ${file.name}.`);
             }
         }

         loadingSpinner.classList.add('hidden');
         currentCalculationData.fileData = combinedData; // Armazena dados brutos
         processUploadedData(); // Processa os dados armazenados
     }

     function processUploadedData() {
         const data = currentCalculationData.fileData;
         const config = currentCalculationData.config;

         if (!config || !data || data.length === 0) {
             // Reset metrics and table if no data or config
             currentCalculationData.metrics = { pets: 0, services: 0 };
             currentCalculationData.totalValue = 0;
             currentCalculationData.calculationRows = generateCalculationRows(config); // Gera linhas baseadas no config (podem estar vazias)
             updateMetrics();
             updateCalculationTableDOM(currentCalculationData.calculationRows); // Renderiza (provavelmente a msg 'Select...')
             if (data && data.length > 0) alert("No valid service data found in the uploaded file(s).");
             return;
         }

         let petsServiced = 0;
         let servicesCount = 0;
         let totalAdjustedValue = 0;

         data.forEach(row => {
             if (row['Ticket ID'] === 'Grand Total' || String(row['Description']).includes('Grand Total')) return;

             const description = row['Description'];
             const totalValue = parseCurrency(row['Total']);

             if (description && totalValue > 0) {
                 const adjustedValue = calculateServiceValue(description, totalValue);
                 totalAdjustedValue += adjustedValue;
                 servicesCount++;
                 petsServiced++; // Ajustar se a lógica for mais complexa
             }
         });

         // Atualiza estado
         currentCalculationData.metrics = { pets: petsServiced, services: servicesCount };
         currentCalculationData.totalValue = totalAdjustedValue;
         currentCalculationData.calculationRows = generateCalculationRows(config); // Gera linhas com base no config ATUAL

         // Atualiza DOM
         updateMetrics();
         updateCalculationTableDOM(currentCalculationData.calculationRows); // Renderiza a tabela agora com valores
     }


     // --- Funções do Modal de Edição ---
     function openEditModal(franchiseName) {
         const config = franchisesConfig.find(c => c.franchiseName === franchiseName);
         if (!config) return;

         editOriginalNameInput.value = config.franchiseName;
         editNameInput.value = config.franchiseName;
         editFeeCheckboxes.forEach(checkbox => {
             const feeItem = checkbox.dataset.feeItem;
             const apiField = feeItemToApiField[feeItem];
             checkbox.checked = config[apiField] || false;
         });
         editModal.classList.remove('hidden');
     }

     function closeEditModal() {
         editModal.classList.add('hidden');
         editForm.reset(); // Limpa o formulário do modal
     }

     function handleSaveEdit() {
         const originalName = editOriginalNameInput.value;
         const newName = editNameInput.value.trim();
         const includedFees = {};
         editFeeCheckboxes.forEach(checkbox => {
             includedFees[checkbox.dataset.feeItem] = checkbox.checked;
         });

         if (!newName) {
             alert("Franchise name cannot be empty.");
             return;
         }

         updateFranchiseConfig(originalName, newName, includedFees);
     }

    // --- Event Listeners ---
    addFranchiseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = newFranchiseNameInput.value.trim();
        const includedFees = {};
        newFeeCheckboxes.forEach(checkbox => {
            includedFees[checkbox.dataset.feeItem] = checkbox.checked;
        });
        if (name) {
            addFranchiseConfig(name, includedFees);
        } else {
            alert("Please enter a franchise name.");
        }
    });

    franchiseSelect.addEventListener('change', (e) => {
        const selectedName = e.target.value;
        if (selectedName) {
            currentCalculationData.selectedFranchiseName = selectedName;
            currentCalculationData.config = franchisesConfig.find(c => c.franchiseName === selectedName);
             // Limpa dados anteriores e gera a estrutura da tabela, mas espera o upload
             currentCalculationData.fileData = [];
             currentCalculationData.totalValue = 0;
             currentCalculationData.metrics = { pets: 0, services: 0 };
             currentCalculationData.calculationRows = generateCalculationRows(currentCalculationData.config);
             updateMetrics(); // Reseta métricas
             updateCalculationTableDOM(currentCalculationData.calculationRows); // Mostra estrutura da tabela
             toggleCalculationFields(true); // Habilita campos
             fileInput.value = ''; // Limpa seleção de arquivo anterior
        } else {
            // Se desmarcar, reseta tudo
            resetCalculationSection();
            toggleCalculationFields(false);
        }
    });

     reportMonthSelect.addEventListener('change', (e) => {
          if(currentCalculationData) currentCalculationData.month = e.target.value;
     });

     fileInput.addEventListener('change', handleFileUpload);

     royaltyRateInput.addEventListener('change', (e) => {
         if(currentCalculationData.selectedFranchiseName) {
             currentCalculationData.royaltyRate = parseCurrency(e.target.value) || 0;
             updateCalculationTableDOM(currentCalculationData.calculationRows); // Recalcula e re-renderiza
         }
     });

     marketingRateInput.addEventListener('change', (e) => {
          if(currentCalculationData.selectedFranchiseName) {
             currentCalculationData.marketingRate = parseCurrency(e.target.value) || 0;
             updateCalculationTableDOM(currentCalculationData.calculationRows); // Recalcula e re-renderiza
          }
     });

     addCalculationRowBtn.addEventListener('click', addCalculationRowUI);

     // Event delegation para a tabela de cálculo
     calculationTbody.addEventListener('change', (e) => {
         const target = e.target;
         const rowElement = target.closest('.calculation-row');
         if (!rowElement) return;

         const rowIndex = parseInt(rowElement.dataset.index);
         if (isNaN(rowIndex) || rowIndex >= currentCalculationData.calculationRows.length) return;

         const rowData = currentCalculationData.calculationRows[rowIndex];

         if (target.classList.contains('item-name')) {
             rowData.Item = target.value;
         } else if (target.classList.contains('description')) {
             rowData.Description = target.value;
         } else if (target.classList.contains('qty')) {
             rowData.Qty = target.value; // Guarda como string, será parseado no cálculo
             target.classList.toggle('red-text', (parseFloat(target.value) || 0) === 0 && !rowData.fixed);
         } else if (target.classList.contains('unit-price')) {
             rowData.Unit_price = target.value; // Guarda como string
         } else if (target.classList.contains('verified')) {
             rowData.verified = target.checked;
         }

         // Recalcula totais sempre que algo na tabela muda
         calculateAndDisplayTotals();
     });

      calculationTbody.addEventListener('click', (e) => {
          if (e.target.classList.contains('delete-calculation-row-btn')) {
              const rowElement = e.target.closest('.calculation-row');
              if (rowElement) {
                  const rowIndex = parseInt(rowElement.dataset.index);
                   deleteCalculationRowUI(rowIndex); // Chama a função que atualiza o estado e re-renderiza
              }
          }
      });

      // Listeners do Modal de Edição
      editModalSaveBtn.addEventListener('click', handleSaveEdit);
      editModalCancelBtn.addEventListener('click', closeEditModal);


    // --- Inicialização ---
    populateMonthSelect();
    fetchFranchiseConfigs(); // Carrega configs, popula dropdown e lista
    resetCalculationSection(); // Garante estado inicial limpo
    toggleCalculationFields(false); // Começa com campos desabilitados

});
