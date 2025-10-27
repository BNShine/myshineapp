document.addEventListener('DOMContentLoaded', () => {
    const franchisesContainer = document.getElementById('franchises-container');
    const addFranchiseBtn = document.getElementById('add-franchise-btn');
    const franchiseTemplate = document.getElementById('franchise-template');

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // Estado da aplicação (armazena dados de todas as franquias)
    let franchisesState = [];
    let nextFranchiseId = 0;

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

    // --- Lógica de Cálculo (Traduzida do Python) ---
    function calculateServiceValue(description, currentServiceValue) {
        description = String(description || '');
        currentServiceValue = parseCurrency(currentServiceValue);

        if (description.includes("01- Dog Cleaning - Small - Under 30 Lbs") || description.includes("Dental Under 40 LBS")) {
            return currentServiceValue < 170 ? 180 : currentServiceValue;
        } else if (description.includes("02- Dog Cleaning - Medium - 31 to 70 Lbs")) {
            return currentServiceValue < 200 ? 210 : currentServiceValue;
        } else if (description.includes("03- Dog Cleaning - Max - 71 to 1000 Lbs") || description.includes("03- Dog Cleaning - Max - 71 to 100 Lbs")) {
            return currentServiceValue < 230 ? 240 : currentServiceValue;
        } else if (description.includes("04- Dog Cleaning - Ultra - Above 101 Lbs")) {
            return currentServiceValue < 260 ? 270 : currentServiceValue;
        } else if (description.includes("05- Cat Cleaning")) {
            return currentServiceValue < 200 ? 210 : currentServiceValue;
        } else if (description.includes("Nail Clipping")) {
            return 10; // Nail Clipping tem valor fixo
        } else {
            return currentServiceValue; // Retorna o valor atual se não houver regra específica
        }
    }

    // --- Funções de Manipulação do DOM ---

    function createFranchiseBlock(id) {
        const content = franchiseTemplate.content.cloneNode(true);
        const franchiseBlock = content.querySelector('.franchise-block');
        franchiseBlock.dataset.id = id;

        // Populate month dropdown
        const monthSelect = franchiseBlock.querySelector('.franchise-month');
        const currentMonthIndex = new Date().getMonth();
        MONTHS.forEach((month, index) => {
            const option = document.createElement('option');
            option.value = month;
            option.textContent = month;
            if (index === currentMonthIndex) {
                option.selected = true;
            }
            monthSelect.appendChild(option);
        });

        // Add initial calculation rows
        updateCalculationTable(franchiseBlock, getDefaultCalculationRows());

        // Attach event listeners for this specific block
        attachFranchiseEventListeners(franchiseBlock);

        return franchiseBlock;
    }

    function addFranchise() {
        const newId = nextFranchiseId++;
        const newBlock = createFranchiseBlock(newId);
        franchisesContainer.appendChild(newBlock);
        // Add to state (optional, can also manage directly via DOM data attributes if preferred)
        franchisesState.push({
            id: newId,
            name: '',
            month: MONTHS[new Date().getMonth()],
            royaltyRate: 6.0,
            marketingRate: 1.0,
            totalValue: 0,
            calculationRows: getDefaultCalculationRows()
        });
        updateFranchiseTitle(newBlock, newId); // Update title after adding
    }

    function deleteFranchise(franchiseId) {
        const blockToDelete = franchisesContainer.querySelector(`.franchise-block[data-id="${franchiseId}"]`);
        if (blockToDelete && confirm('Are you sure you want to delete this franchise block?')) {
            blockToDelete.remove();
            franchisesState = franchisesState.filter(f => f.id !== parseInt(franchiseId));
        }
    }

    function updateFranchiseTitle(franchiseBlock, id) {
        const nameInput = franchiseBlock.querySelector('.franchise-name');
        const titleElement = franchiseBlock.querySelector('.franchise-title');
        const name = nameInput.value.trim();
        titleElement.textContent = name ? `Franchise: ${name}` : `Franchise #${parseInt(id) + 1}`;
    }

    function getDefaultCalculationRows() {
        // Retorna uma cópia profunda para evitar modificação do template
        return JSON.parse(JSON.stringify([
            { Item: "Royalty Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true },
            { Item: "Marketing Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true },
            { Item: "Software Fee", Description: "", Qty: 1, Unit_price: 350.00, Amount: 0, verified: false, fixed: true },
            { Item: "Call Center Fee", Description: "", Qty: 1, Unit_price: 1200.00, Amount: 0, verified: false, fixed: true },
            { Item: "Call Center Fee Extra", Description: "", Qty: 0, Unit_price: 600.00, Amount: 0, verified: false, fixed: true }
        ]));
    }

    function updateCalculationTable(franchiseBlock, calculationRows) {
        const tbody = franchiseBlock.querySelector('.calculation-tbody');
        tbody.innerHTML = ''; // Clear existing rows

        calculationRows.forEach((rowData, rowIndex) => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-border';
            tr.dataset.index = rowIndex;

            const isFixed = rowData.fixed || false;
            const isRateFee = rowData.Item === "Royalty Fee" || rowData.Item === "Marketing Fee";
            const isSoftwareFee = rowData.Item === "Software Fee";
            const isCallCenterBase = rowData.Item === "Call Center Fee";
            const isCallCenterExtra = rowData.Item === "Call Center Fee Extra";

            // Determine Qty value and disable state
            let qtyValue = rowData.Qty;
            let qtyDisabled = isFixed; // Disable for all fixed initially
            if (isRateFee) {
                const rate = parseCurrency(franchiseBlock.querySelector(rowData.Item === "Royalty Fee" ? '.royalty-rate' : '.marketing-rate').value) || 0;
                qtyValue = rate.toFixed(1); // Show rate as percentage
                rowData.Qty = rate; // Store rate internally
                qtyDisabled = true;
            } else if (isSoftwareFee || isCallCenterBase) {
                 qtyValue = 1; // Always 1
                 rowData.Qty = 1;
                 qtyDisabled = false; // Allow changing Qty for software/call center base
            } else if (isCallCenterExtra) {
                qtyValue = rowData.Qty; // Use stored Qty
                qtyDisabled = false; // Allow changing Qty for extra
            } else if (!isFixed) {
                qtyDisabled = false; // Enable for custom rows
                qtyValue = rowData.Qty;
            }


            // Determine Unit Price value and disable state
            let unitPriceValue = rowData.Unit_price;
            let unitPriceDisabled = isFixed; // Disable for all fixed initially
            let unitPriceElement = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" ${unitPriceDisabled ? 'disabled' : ''}>`;

            if (isRateFee) {
                const totalServiceValue = parseCurrency(franchiseBlock.querySelector('.metric-total-value').textContent);
                unitPriceValue = totalServiceValue;
                rowData.Unit_price = totalServiceValue;
                unitPriceDisabled = true;
                unitPriceElement = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
            } else if (isSoftwareFee) {
                // Use a select box for Software Fee Unit Price
                const options = [0.00, 250.00, 350.00];
                unitPriceValue = rowData.Unit_price; // Use stored value
                unitPriceDisabled = false; // Allow changing
                unitPriceElement = `
                    <select class="w-full text-right unit-price">
                        ${options.map(o => `<option value="${o.toFixed(2)}" ${Math.abs(o - unitPriceValue) < 0.01 ? 'selected' : ''}>${formatCurrency(o)}</option>`).join('')}
                    </select>`;
            } else if (isCallCenterBase || isCallCenterExtra) {
                unitPriceValue = rowData.Item === "Call Center Fee" ? 1200.00 : 600.00; // Fixed unit prices
                rowData.Unit_price = unitPriceValue;
                unitPriceDisabled = true;
                 unitPriceElement = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
            } else if (!isFixed) {
                 unitPriceDisabled = false; // Enable for custom rows
                 unitPriceValue = rowData.Unit_price;
                 unitPriceElement = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}">`;
            }


            // Calculate Amount
            let amount = 0;
            const qty = parseFloat(rowData.Qty) || 0;
            const unitPrice = parseFloat(rowData.Unit_price) || 0;
            if (isRateFee) {
                amount = (qty / 100) * unitPrice; // Rate calculation
            } else {
                amount = qty * unitPrice; // Standard calculation
            }
            rowData.Amount = amount; // Update the stored amount

            tr.innerHTML = `
                <td class="p-2"><input type="text" class="w-full item-name" value="${rowData.Item}" ${isFixed ? 'disabled' : ''}></td>
                <td class="p-2"><input type="text" class="w-full description" value="${rowData.Description}"></td>
                <td class="p-2"><input type="number" step="0.1" class="w-full text-center qty ${qty === 0 && !isFixed ? 'red-text' : ''}" value="${isRateFee ? qty.toFixed(1) : qty}" ${qtyDisabled ? 'disabled' : ''}></td>
                <td class="p-2">${unitPriceElement}</td>
                <td class="p-2"><input type="text" class="w-full text-right amount" value="${formatCurrency(amount)}" disabled></td>
                <td class="p-2 checkbox-cell"><input type="checkbox" class="verified" ${rowData.verified ? 'checked' : ''}></td>
                <td class="p-2">
                    ${!isFixed ? '<button class="text-red-600 hover:text-red-800 delete-calculation-row-btn">🗑️</button>' : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        calculateAndDisplayTotals(franchiseBlock);
    }

    function addCalculationRow(franchiseBlock) {
        const franchiseId = parseInt(franchiseBlock.dataset.id);
        const state = franchisesState.find(f => f.id === franchiseId);
        if (state) {
            state.calculationRows.push({ Item: "", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: false });
            updateCalculationTable(franchiseBlock, state.calculationRows);
        }
    }

     function deleteCalculationRow(franchiseBlock, rowIndex) {
        const franchiseId = parseInt(franchiseBlock.dataset.id);
        const state = franchisesState.find(f => f.id === franchiseId);
        // Only allow deleting custom rows (index 5 or greater)
        if (state && rowIndex >= 5) {
            state.calculationRows.splice(rowIndex, 1);
            updateCalculationTable(franchiseBlock, state.calculationRows);
        }
    }

    function calculateAndDisplayTotals(franchiseBlock) {
        let totalAmount = 0;
        const franchiseId = parseInt(franchiseBlock.dataset.id);
        const state = franchisesState.find(f => f.id === franchiseId);

        if (state) {
            // Recalculate amounts based on current inputs before summing
             state.calculationRows.forEach(row => {
                const isRateFee = row.Item === "Royalty Fee" || row.Item === "Marketing Fee";
                const qty = parseFloat(row.Qty) || 0;
                const unitPrice = parseFloat(row.Unit_price) || 0;
                 if (isRateFee) {
                    row.Amount = (qty / 100) * unitPrice;
                 } else {
                    row.Amount = qty * unitPrice;
                 }
                totalAmount += row.Amount;
            });

            // Update the total display in the footer
            franchiseBlock.querySelector('.calculation-total').textContent = formatCurrency(totalAmount);
            franchiseBlock.querySelector('.metric-total-fees').textContent = formatCurrency(totalAmount);
        }
    }


    // --- File Processing ---
    async function handleFileUpload(event) {
        const franchiseBlock = event.target.closest('.franchise-block');
        const fileInput = event.target;
        const loadingSpinner = franchiseBlock.querySelector('.loading-spinner');

        if (fileInput.files.length === 0) return;

        loadingSpinner.classList.remove('hidden');
        let combinedData = [];

        for (const file of fileInput.files) {
            try {
                const data = await file.arrayBuffer();
                const workbook = XLSX.read(data);
                const sheetName = workbook.SheetNames[0]; // Assume data is on the first sheet
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                combinedData.push(...jsonData);
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                alert(`Error reading file ${file.name}. Please ensure it's a valid CSV or XLSX file.`);
            }
        }

        loadingSpinner.classList.add('hidden');
        processUploadedData(franchiseBlock, combinedData);
    }

    function processUploadedData(franchiseBlock, data) {
        if (!data || data.length === 0) {
            alert("No valid data found in the uploaded file(s).");
            // Reset metrics if no data
            franchiseBlock.querySelector('.metric-pets').textContent = '0';
            franchiseBlock.querySelector('.metric-services-count').textContent = '0';
            franchiseBlock.querySelector('.metric-total-value').textContent = formatCurrency(0);
             // Trigger recalculation which will likely set Royalty/Marketing unit price to 0
            updateRatesAndRecalculate(franchiseBlock);
            return;
        }

        let petsServiced = 0;
        let servicesCount = 0;
        let totalAdjustedValue = 0;

        data.forEach(row => {
            // Skip "Grand Total" rows often found in reports
            if (row['Ticket ID'] === 'Grand Total' || String(row['Description']).includes('Grand Total')) {
                return;
            }

            const description = row['Description'];
            const totalValue = parseCurrency(row['Total']); // Use 'Total' column

            if (description && totalValue > 0) { // Consider only rows with description and positive value
                 const adjustedValue = calculateServiceValue(description, totalValue);
                 totalAdjustedValue += adjustedValue;
                 servicesCount++;
                 // Basic pet count assumption: one service = one pet (can be refined if needed)
                 petsServiced++;
            }
        });

        // Update metric cards
        franchiseBlock.querySelector('.metric-pets').textContent = petsServiced;
        franchiseBlock.querySelector('.metric-services-count').textContent = servicesCount;
        franchiseBlock.querySelector('.metric-total-value').textContent = formatCurrency(totalAdjustedValue);

        // Update state and recalculate table
        const franchiseId = parseInt(franchiseBlock.dataset.id);
        const state = franchisesState.find(f => f.id === franchiseId);
        if (state) {
            state.totalValue = totalAdjustedValue;
        }

        // Trigger recalculation of the table based on the new total value
        updateRatesAndRecalculate(franchiseBlock);
    }

    function updateRatesAndRecalculate(franchiseBlock) {
         const franchiseId = parseInt(franchiseBlock.dataset.id);
         const state = franchisesState.find(f => f.id === franchiseId);
         if (!state) return;

         // Get current rates from inputs
         state.royaltyRate = parseCurrency(franchiseBlock.querySelector('.royalty-rate').value) || 0;
         state.marketingRate = parseCurrency(franchiseBlock.querySelector('.marketing-rate').value) || 0;

         // Update the Qty and Unit Price for Royalty and Marketing rows in the state
         state.calculationRows.forEach(row => {
             if (row.Item === "Royalty Fee") {
                 row.Qty = state.royaltyRate;
                 row.Unit_price = state.totalValue;
             } else if (row.Item === "Marketing Fee") {
                 row.Qty = state.marketingRate;
                 row.Unit_price = state.totalValue;
             }
             // Recalculate amount for all rows
              const qty = parseFloat(row.Qty) || 0;
              const unitPrice = parseFloat(row.Unit_price) || 0;
              if (row.Item === "Royalty Fee" || row.Item === "Marketing Fee") {
                  row.Amount = (qty / 100) * unitPrice; // Rate calculation
              } else {
                  row.Amount = qty * unitPrice; // Standard calculation
              }
         });

         // Re-render the table which includes recalculating amounts and totals
         updateCalculationTable(franchiseBlock, state.calculationRows);
    }


    // --- Event Listeners ---

    function attachFranchiseEventListeners(franchiseBlock) {
        franchiseBlock.querySelector('.delete-franchise-btn').addEventListener('click', (e) => {
            const id = e.target.closest('.franchise-block').dataset.id;
            deleteFranchise(id);
        });

        franchiseBlock.querySelector('.franchise-name').addEventListener('input', (e) => {
             const id = e.target.closest('.franchise-block').dataset.id;
             updateFranchiseTitle(franchiseBlock, id);
             // Update state if managing state separately
             const state = franchisesState.find(f => f.id === parseInt(id));
             if (state) state.name = e.target.value;
        });

         franchiseBlock.querySelector('.franchise-month').addEventListener('change', (e) => {
            const id = e.target.closest('.franchise-block').dataset.id;
            const state = franchisesState.find(f => f.id === parseInt(id));
            if (state) state.month = e.target.value;
         });

        franchiseBlock.querySelector('.file-input').addEventListener('change', handleFileUpload);

        franchiseBlock.querySelector('.royalty-rate').addEventListener('change', (e) => updateRatesAndRecalculate(franchiseBlock));
        franchiseBlock.querySelector('.marketing-rate').addEventListener('change', (e) => updateRatesAndRecalculate(franchiseBlock));

        franchiseBlock.querySelector('.add-calculation-row-btn').addEventListener('click', (e) => addCalculationRow(franchiseBlock));

        // Event delegation for calculation table inputs/selects/checkboxes/delete
        franchiseBlock.querySelector('.calculation-tbody').addEventListener('change', (e) => {
            const target = e.target;
            const rowElement = target.closest('tr');
            if (!rowElement) return;

            const rowIndex = parseInt(rowElement.dataset.index);
            const franchiseId = parseInt(franchiseBlock.dataset.id);
            const state = franchisesState.find(f => f.id === franchiseId);
            if (!state || rowIndex >= state.calculationRows.length) return;

             const rowData = state.calculationRows[rowIndex];

            if (target.classList.contains('item-name')) {
                rowData.Item = target.value;
            } else if (target.classList.contains('description')) {
                rowData.Description = target.value;
            } else if (target.classList.contains('qty')) {
                 rowData.Qty = target.value; // Store as string temporarily, will be parsed later
                 target.classList.toggle('red-text', (parseFloat(target.value) || 0) === 0 && !rowData.fixed);
            } else if (target.classList.contains('unit-price')) {
                 rowData.Unit_price = target.value; // Store as string temporarily
            } else if (target.classList.contains('verified')) {
                 rowData.verified = target.checked;
            }

            // Always recalculate and update the table state on any change
             updateRatesAndRecalculate(franchiseBlock); // This re-renders the whole table section
        });

         franchiseBlock.querySelector('.calculation-tbody').addEventListener('click', (e) => {
             if (e.target.classList.contains('delete-calculation-row-btn')) {
                 const rowElement = e.target.closest('tr');
                 if (rowElement) {
                     const rowIndex = parseInt(rowElement.dataset.index);
                     deleteCalculationRow(franchiseBlock, rowIndex);
                 }
             }
         });
    }

    addFranchiseBtn.addEventListener('click', addFranchise);

    // --- Inicialização ---
    addFranchise(); // Adiciona o primeiro bloco ao carregar a página

});
