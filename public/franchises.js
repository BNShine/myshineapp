document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos DOM ---
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
    const mainContentElement = document.querySelector('.main-content'); // Para overlay geral, se necessário

    // --- Elementos da Seção de Registro ---
    const addFranchiseFormElement = document.getElementById('add-franchise-form');
    const newFranchiseNameInputElement = document.getElementById('new-franchise-name');
    const newFeeCheckboxElements = document.querySelectorAll('.new-fee-checkbox');
    const registeredFranchisesListElement = document.getElementById('registered-franchises-list');
    // Seleciona a seção pai do formulário de adicionar
    const registerSectionElement = document.getElementById('franchise-register-section');
    // Seleciona o overlay DENTRO da seção de registro (deve existir no HTML)
    const registerSectionOverlayElement = registerSectionElement?.querySelector('.loading-overlay');

    // --- Elementos do Modal de Edição ---
    const editModalElement = document.getElementById('edit-franchise-modal');
    const editFormElement = document.getElementById('edit-franchise-form');
    const editOriginalNameInputElement = document.getElementById('edit-original-franchise-name');
    const editNameInputElement = document.getElementById('edit-franchise-name');
    const editFeeCheckboxElements = document.querySelectorAll('.edit-fee-checkbox');
    const editModalSaveButtonElement = document.getElementById('edit-modal-save-btn');
    const editModalCancelButtonElement = document.getElementById('edit-modal-cancel-btn');

    // --- Constantes e Variáveis de Estado ---
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const BASE_FEE_ITEMS = ["Royalty Fee", "Marketing Fee", "Software Fee", "Call Center Fee", "Call Center Fee Extra"];

    // Mapeamento Nome do Item <-> Campo na API/Planilha
    const feeItemToApiFieldMap = {
        "Royalty Fee": "IncludeRoyalty",
        "Marketing Fee": "IncludeMarketing",
        "Software Fee": "IncludeSoftware",
        "Call Center Fee": "IncludeCallCenter",
        "Call Center Fee Extra": "IncludeCallCenterExtra"
    };
    const apiFieldToFeeItemMap = Object.fromEntries(Object.entries(feeItemToApiFieldMap).map(([key, value]) => [value, key]));

    // Estado global da página
    let franchisesConfiguration = []; // Armazena as configurações lidas da API
    let currentCalculationState = { // Estado da seção de cálculo atual
        selectedFranchiseName: null,
        config: null, // Configuração da franquia selecionada
        month: MONTHS[new Date().getMonth()],
        royaltyRate: 6.0,
        marketingRate: 1.0,
        totalValue: 0, // Valor total calculado a partir do ficheiro
        calculationRows: [], // Linhas da tabela de cálculo (baseadas na config + customizadas)
        fileData: [], // Dados brutos lidos do ficheiro
        metrics: { pets: 0, services: 0 } // Métricas calculadas
    };

    // --- Funções Auxiliares ---

    /** Formata um número como moeda (ex: $1,234.56) */
    function formatCurrency(value) {
        if (typeof value !== 'number') value = parseFloat(value) || 0;
        return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
    }

    /** Converte uma string de moeda para número (ex: "$1,234.56" -> 1234.56) */
    function parseCurrency(value) {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return 0;
        const cleaned = value.replace(/[$,]/g, '');
        return parseFloat(cleaned) || 0;
    }

    /** Exibe uma notificação toast */
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

    /** Mostra um overlay de carregamento sobre um elemento */
    function showLoadingOverlay(overlayElement) {
        if (overlayElement) {
            console.log("Showing overlay..."); // Log
            overlayElement.classList.remove('hidden');
        } else {
            console.warn("showLoadingOverlay: Overlay element not found.");
        }
    }

    /** Esconde um overlay de carregamento */
    function hideLoadingOverlay(overlayElement) {
        if (overlayElement) {
            console.log("Hiding overlay..."); // Log
            overlayElement.classList.add('hidden');
        } else {
             console.warn("hideLoadingOverlay: Overlay element not found.");
        }
    }

    // --- Lógica de Cálculo de Serviço (Traduzida do Python) ---
    function calculateServiceValue(description, currentServiceValue) {
        description = String(description || '');
        currentServiceValue = parseCurrency(currentServiceValue);
        // ... (regras de cálculo idênticas à versão anterior) ...
        if (description.includes("01- Dog Cleaning - Small - Under 30 Lbs") || description.includes("Dental Under 40 LBS")) return currentServiceValue < 170 ? 180 : currentServiceValue;
        if (description.includes("02- Dog Cleaning - Medium - 31 to 70 Lbs")) return currentServiceValue < 200 ? 210 : currentServiceValue;
        if (description.includes("03- Dog Cleaning - Max - 71 to 1000 Lbs") || description.includes("03- Dog Cleaning - Max - 71 to 100 Lbs")) return currentServiceValue < 230 ? 240 : currentServiceValue;
        if (description.includes("04- Dog Cleaning - Ultra - Above 101 Lbs")) return currentServiceValue < 260 ? 270 : currentServiceValue;
        if (description.includes("05- Cat Cleaning")) return currentServiceValue < 200 ? 210 : currentServiceValue;
        if (description.includes("Nail Clipping")) return 10;
        return currentServiceValue;
    }

    // --- Funções de Interação com a API ---

    /** Busca as configurações de todas as franquias registadas */
    async function fetchFranchiseConfigs() {
        showLoadingOverlay(registerSectionOverlayElement); // Mostra overlay específico da seção
        registeredFranchisesListElement.innerHTML = `<p class="p-4 text-muted-foreground italic">Loading configurations...</p>`;
        console.log("Attempting to fetch franchise configs...");

        try {
            const response = await fetch('/api/manage-franchise-config');
            console.log("API Response Status:", response.status); // Log status

            const responseText = await response.text(); // Lê como texto
            console.log("API Raw Response Text:", responseText); // Log resposta crua

            if (!response.ok) {
                // Tenta extrair mensagem de erro do JSON, senão usa status/texto
                let errorMsg = `API Error: Status ${response.status}`;
                try {
                    const errorData = JSON.parse(responseText);
                    console.error("API Error Response Body (Parsed):", errorData);
                    errorMsg = errorData.message || errorMsg;
                } catch (e) {
                    console.error("Failed to parse error response as JSON:", e);
                    errorMsg += ` - Response: ${responseText.substring(0, 150)}...`;
                }
                throw new Error(errorMsg); // Lança o erro para o catch
            }

            // Se a resposta foi OK (2xx), tenta parsear como JSON
            try {
                franchisesConfiguration = JSON.parse(responseText);
                if (!Array.isArray(franchisesConfiguration)) { // Validação extra
                    console.warn("API response was OK but not an array, resetting config.", franchisesConfiguration);
                    franchisesConfiguration = [];
                }
                console.log("Configs received and parsed:", franchisesConfiguration);
            } catch (parseError) {
                console.error("Error parsing successful API response as JSON:", parseError);
                throw new Error("Received invalid data format from server.");
            }

            renderRegisteredFranchises(); // Atualiza a lista no HTML
            populateFranchiseSelect(); // Atualiza o dropdown de seleção

        } catch (error) {
            // Log e exibição do erro no frontend
            console.error(">>> Error during fetchFranchiseConfigs:", error);
            const errorDisplayMessage = `Error loading configurations: ${error.message}`;
            registeredFranchisesListElement.innerHTML = `<p class="p-4 text-red-600">${errorDisplayMessage}</p>`;
            showToast(errorDisplayMessage, 'error', 6000); // Mostra toast de erro
            franchisesConfiguration = []; // Reseta o estado em caso de erro
            populateFranchiseSelect(); // Popula dropdown (ficará vazio)
        } finally {
            // Garante que o overlay seja escondido, independentemente do sucesso ou falha
            hideLoadingOverlay(registerSectionOverlayElement); // Esconde overlay específico
            console.log("Finished fetchFranchiseConfigs attempt.");
        }
    }

    /** Adiciona uma nova configuração de franquia via API */
    async function addFranchiseConfig(name, includedFees) {
        showLoadingOverlay(registerSectionOverlayElement); // Mostra overlay
        try {
            const response = await fetch('/api/manage-franchise-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ franchiseName: name, includedFees: includedFees })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            showToast(result.message, 'success');
            await fetchFranchiseConfigs(); // Recarrega a lista após adicionar
            addFranchiseFormElement.reset(); // Limpa formulário de adição
             // Reseta checkboxes para o estado padrão (todos menos Extra Call Center)
             newFeeCheckboxElements.forEach(cb => cb.checked = (cb.dataset.feeItem !== 'Call Center Fee Extra'));
        } catch (error) {
            console.error("Error adding franchise:", error);
            showToast(`Error adding franchise: ${error.message}`, 'error');
        } finally {
            hideLoadingOverlay(registerSectionOverlayElement); // Esconde overlay
        }
    }

    /** Atualiza uma configuração de franquia existente via API */
    async function updateFranchiseConfig(originalName, newName, includedFees) {
        showLoadingOverlay(editModalElement); // Mostra overlay no modal (adicionar div no HTML do modal se quiser)
        editModalSaveButtonElement.disabled = true;
        try {
            const response = await fetch('/api/manage-franchise-config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalFranchiseName: originalName, newFranchiseName: newName, includedFees: includedFees })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            showToast(result.message, 'success');
            closeEditModal();
            await fetchFranchiseConfigs(); // Recarrega a lista após atualizar
        } catch (error) {
            console.error("Error updating franchise:", error);
            showToast(`Error updating franchise: ${error.message}`, 'error');
        } finally {
            hideLoadingOverlay(editModalElement); // Esconde overlay do modal
            editModalSaveButtonElement.disabled = false;
        }
    }

    /** Deleta uma configuração de franquia via API */
    async function deleteFranchiseConfig(name) {
        if (!confirm(`Are you sure you want to delete the franchise configuration for "${name}"? This action cannot be undone.`)) {
            return;
        }
        showLoadingOverlay(registerSectionOverlayElement); // Mostra overlay na seção de registro
        try {
            const response = await fetch('/api/manage-franchise-config', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ franchiseName: name })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            showToast(result.message, 'success');
            await fetchFranchiseConfigs(); // Recarrega a lista após deletar
        } catch (error) {
            console.error("Error deleting franchise:", error);
            showToast(`Error deleting franchise: ${error.message}`, 'error');
        } finally {
            hideLoadingOverlay(registerSectionOverlayElement); // Esconde overlay
        }
    }

    // --- Funções de Renderização e UI ---

    /** Popula o dropdown de seleção de franquia na seção de cálculo */
    function populateFranchiseSelect() {
        const currentSelection = franchiseSelectElement.value; // Guarda seleção atual
        franchiseSelectElement.innerHTML = '<option value="">-- Select a Registered Franchise --</option>'; // Limpa e adiciona opção padrão
        // Ordena alfabeticamente e adiciona opções
        franchisesConfiguration
            .sort((a, b) => a.franchiseName.localeCompare(b.franchiseName))
            .forEach(config => {
                const option = document.createElement('option');
                option.value = config.franchiseName;
                option.textContent = config.franchiseName;
                franchiseSelectElement.appendChild(option);
            });
        // Restaura seleção anterior se ainda existir na lista atualizada
        if (franchisesConfiguration.some(c => c.franchiseName === currentSelection)) {
            franchiseSelectElement.value = currentSelection;
        } else {
            franchiseSelectElement.value = ""; // Reseta se a seleção não existe mais
            resetCalculationSection(); // Reseta seção de cálculo se a franquia selecionada foi removida
        }
        // Habilita/desabilita campos da seção de cálculo
        toggleCalculationFields(franchiseSelectElement.value !== "");
    }

    /** Renderiza a lista de franquias registradas na seção de registro */
    function renderRegisteredFranchises() {
        registeredFranchisesListElement.innerHTML = ''; // Limpa lista atual
        if (franchisesConfiguration.length === 0) {
            registeredFranchisesListElement.innerHTML = `<p class="p-4 text-muted-foreground italic">No franchises registered yet.</p>`;
            return;
        }

        // Ordena e cria elementos HTML para cada configuração
        franchisesConfiguration
            .sort((a, b) => a.franchiseName.localeCompare(b.franchiseName))
            .forEach(config => {
                // Cria string com as taxas incluídas
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

        // Adiciona listeners aos botões de editar/deletar recém-criados
        registeredFranchisesListElement.querySelectorAll('.edit-franchise-btn').forEach(button => {
            button.addEventListener('click', (event) => openEditModal(event.currentTarget.dataset.name));
        });
        registeredFranchisesListElement.querySelectorAll('.delete-registered-franchise-btn').forEach(button => {
            button.addEventListener('click', (event) => deleteFranchiseConfig(event.currentTarget.dataset.name));
        });
    }

    /** Popula o dropdown de seleção de mês */
    function populateMonthSelect() {
        const currentMonthIndex = new Date().getMonth();
        reportMonthSelectElement.innerHTML = MONTHS.map((month, index) =>
            `<option value="${month}" ${index === currentMonthIndex ? 'selected' : ''}>${month}</option>`
        ).join('');
        // Atualiza estado inicial
        if (currentCalculationState) currentCalculationState.month = reportMonthSelectElement.value;
    }

    /** Gera o array de linhas da tabela de cálculo com base na configuração da franquia */
    function generateCalculationRows() {
        const config = currentCalculationState.config;
        if (!config) return []; // Retorna vazio se nenhuma config selecionada

        const defaultRowTemplates = getDefaultCalculationRowTemplates(); // Pega o template base
        const rowsToShow = [];

        // Adiciona as linhas base que estão incluídas na configuração
        defaultRowTemplates.forEach(templateRow => {
            const apiField = feeItemToApiFieldMap[templateRow.Item];
            // Inclui a linha SE for fixa E existir mapeamento E estiver marcada como true na config
            if (templateRow.fixed && apiField && config[apiField]) {
                rowsToShow.push(JSON.parse(JSON.stringify(templateRow))); // Adiciona uma cópia
            }
        });

        // Aqui poderíamos adicionar lógica para restaurar linhas customizadas salvas, se houvesse
        // Por enquanto, apenas retorna as linhas base configuradas.

        return rowsToShow;
    }

    /** Atualiza o HTML da tabela de cálculo com base no array de linhas fornecido */
    function updateCalculationTableDOM() {
        calculationTbodyElement.innerHTML = ''; // Limpa tabela
        const calculationRows = currentCalculationState.calculationRows;

        // Mostra mensagem se não houver franquia selecionada ou linhas para mostrar
        if (!currentCalculationState.selectedFranchiseName || calculationRows.length === 0) {
            calculationTbodyElement.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
            calculateAndDisplayTotals(); // Atualiza total (será $0.00)
            return;
        }

        // Cria e adiciona cada linha (TR) à tabela (TBODY)
        calculationRows.forEach((rowData, rowIndex) => {
            const tableRow = document.createElement('tr');
            tableRow.className = 'border-b border-border calculation-row';
            tableRow.dataset.index = rowIndex; // Guarda o índice da linha

            // Determina estados (fixo, taxa, tipo de taxa)
            const isFixed = rowData.fixed || false;
            const isRateFee = rowData.Item === "Royalty Fee" || rowData.Item === "Marketing Fee";
            const isSoftwareFee = rowData.Item === "Software Fee";
            const isCallCenterBase = rowData.Item === "Call Center Fee";
            const isCallCenterExtra = rowData.Item === "Call Center Fee Extra";

            // --- Lógica para Qty (Valor e Estado Desabilitado) ---
            let quantityValue = rowData.Qty;
            let isQuantityDisabled = isFixed; // Desabilita inicialmente se for linha fixa
            if (isRateFee) {
                // Para Royalty/Marketing, Qty é a taxa percentual
                quantityValue = (rowData.Item === "Royalty Fee" ? currentCalculationState.royaltyRate : currentCalculationState.marketingRate).toFixed(1);
                isQuantityDisabled = true; // Taxa não é editável diretamente aqui
            } else if (isSoftwareFee || isCallCenterBase) {
                quantityValue = 1; // Quantidade fixa para Software e Call Center Base
                isQuantityDisabled = false; // Permite editar (ex: múltiplos softwares?)
            } else if (isCallCenterExtra) {
                quantityValue = rowData.Qty; // Usa valor guardado
                isQuantityDisabled = false; // Permite editar
            } else { // Linha customizada
                quantityValue = rowData.Qty;
                isQuantityDisabled = false;
            }

            // --- Lógica para Unit Price (Elemento HTML, Valor e Estado Desabilitado) ---
            let unitPriceValue = rowData.Unit_price;
            let isUnitPriceDisabled = isFixed; // Desabilita inicialmente se for linha fixa
            let unitPriceElementHTML; // Guarda o HTML do input/select

            if (isRateFee) {
                // Para Royalty/Marketing, Unit Price é o valor total calculado do ficheiro
                unitPriceValue = currentCalculationState.totalValue;
                isUnitPriceDisabled = true;
                unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
            } else if (isSoftwareFee) {
                // Software Fee usa um dropdown para preços pré-definidos
                const options = [0.00, 250.00, 350.00];
                unitPriceValue = rowData.Unit_price; // Usa valor guardado
                isUnitPriceDisabled = false; // Permite alterar
                unitPriceElementHTML = `
                    <select class="w-full text-right unit-price">
                        ${options.map(optionValue => `<option value="${optionValue.toFixed(2)}" ${Math.abs(optionValue - unitPriceValue) < 0.01 ? 'selected' : ''}>${formatCurrency(optionValue)}</option>`).join('')}
                    </select>`;
            } else if (isCallCenterBase || isCallCenterExtra) {
                // Call Center tem preços fixos
                unitPriceValue = isCallCenterBase ? 1200.00 : 600.00;
                isUnitPriceDisabled = true;
                unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}" disabled>`;
            } else { // Linha customizada
                unitPriceValue = rowData.Unit_price;
                isUnitPriceDisabled = false;
                unitPriceElementHTML = `<input type="number" step="0.01" class="w-full text-right unit-price" value="${unitPriceValue.toFixed(2)}">`;
            }

            // --- Cálculo do Amount (Valor da Linha) ---
            // Usa os valores ATUAIS (podem ter sido editados) para mostrar o cálculo imediato
            let amount = 0;
            const currentQuantity = parseFloat(quantityValue) || 0;
            const currentUnitPrice = parseFloat(unitPriceValue) || 0;
            if (isRateFee) {
                amount = (currentQuantity / 100) * currentUnitPrice; // Cálculo percentual
            } else {
                amount = currentQuantity * currentUnitPrice; // Cálculo direto
            }
            // NOTA: O valor `amount` não é guardado de volta em `rowData` aqui,
            // isso acontece na função `calculateAndDisplayTotals` que lê os valores do DOM.

            // --- Montagem do HTML da Linha (TR) ---
            tableRow.innerHTML = `
                <td class="p-2"><input type="text" class="w-full item-name" value="${rowData.Item}" ${isFixed ? 'disabled title="Base fee item"' : 'placeholder="Custom item"'}></td>
                <td class="p-2"><input type="text" class="w-full description" value="${rowData.Description}" placeholder="Optional description"></td>
                <td class="p-2"><input type="number" step="${isRateFee ? 0.1 : 1}" class="w-full text-center qty ${currentQuantity === 0 && !isFixed ? 'red-text' : ''}" value="${isRateFee ? quantityValue : currentQuantity}" ${isQuantityDisabled ? 'disabled' : ''}></td>
                <td class="p-2">${unitPriceElementHTML}</td>
                <td class="p-2"><input type="text" class="w-full text-right amount" value="${formatCurrency(amount)}" disabled title="${formatCurrency(amount)}"></td>
                <td class="p-2 checkbox-cell"><input type="checkbox" class="verified" ${rowData.verified ? 'checked' : ''}></td>
                <td class="p-2 text-center">
                    ${!isFixed ? '<button class="delete-calculation-row-btn text-red-600 hover:text-red-800 p-1" title="Delete row">🗑️</button>' : ''}
                </td>
            `;
            calculationTbodyElement.appendChild(tableRow); // Adiciona a linha ao corpo da tabela
        });

        calculateAndDisplayTotals(); // Recalcula e exibe o total geral após renderizar as linhas
    }

    /** Adiciona uma nova linha customizada ao estado e atualiza a tabela */
    function addCalculationRowUI() {
        if (!currentCalculationState.selectedFranchiseName) {
             showToast("Select a franchise before adding custom rows.", "warning");
             return;
        }
        currentCalculationState.calculationRows.push({ Item: "", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: false });
        updateCalculationTableDOM(); // Re-renderiza a tabela com a nova linha
    }

    /** Remove uma linha customizada do estado e atualiza a tabela */
    function deleteCalculationRowUI(rowIndex) {
        if (!currentCalculationState.selectedFranchiseName || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) return;

        // Calcula quantas linhas fixas (base) estão sendo exibidas atualmente
        const baseFeeCount = currentCalculationState.calculationRows.filter(row => row.fixed).length;

        // Impede a deleção se o índice for menor que o número de linhas base (ou seja, é uma linha base)
        if (rowIndex < baseFeeCount) {
            console.warn("Cannot delete base fee rows.");
            showToast("Base fee rows cannot be deleted.", "warning");
            return;
        }

        // Remove a linha do array no estado
        currentCalculationState.calculationRows.splice(rowIndex, 1);
        updateCalculationTableDOM(); // Re-renderiza a tabela sem a linha removida
    }

    /** Recalcula os valores 'Amount' de cada linha e o total geral, atualizando o DOM */
    function calculateAndDisplayTotals() {
        let totalAmountSum = 0;
        // Itera sobre cada linha (TR) na tabela
        calculationTbodyElement.querySelectorAll('.calculation-row').forEach(tableRowElement => {
            const rowIndex = parseInt(tableRowElement.dataset.index);
             // Segurança: Verifica se o índice é válido e se a linha de dados correspondente existe
            if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) {
                 console.warn("Skipping row with invalid index during total calculation:", rowIndex);
                 return; // Pula esta linha se o índice for inválido
            }
            const rowData = currentCalculationState.calculationRows[rowIndex];

            // Obtém os elementos de input/select da linha atual
            const quantityInputElement = tableRowElement.querySelector('.qty');
            const unitPriceInputElement = tableRowElement.querySelector('.unit-price'); // Pode ser input ou select
            const amountInputElement = tableRowElement.querySelector('.amount');

            const isRateFee = rowData.Item === "Royalty Fee" || rowData.Item === "Marketing Fee";

            // Lê os valores atuais dos inputs/selects
            const quantity = parseFloat(quantityInputElement.value) || 0;
            const unitPrice = parseFloat(unitPriceInputElement.value) || 0;
            let currentAmount = 0;

            // Calcula o 'Amount' com base no tipo de taxa
            if (isRateFee) {
                currentAmount = (quantity / 100) * unitPrice;
            } else {
                currentAmount = quantity * unitPrice;
            }

            // Atualiza o valor 'Amount' no estado interno E no input de exibição
            rowData.Amount = currentAmount;
            amountInputElement.value = formatCurrency(currentAmount);
            amountInputElement.title = formatCurrency(currentAmount); // Atualiza tooltip

            // Adiciona ao total geral
            totalAmountSum += currentAmount;
        });

        // Atualiza a exibição do total no rodapé da tabela e no card de métrica
        calculationTotalDisplayElement.textContent = formatCurrency(totalAmountSum);
        metricTotalFeesElement.textContent = formatCurrency(totalAmountSum);
    }

    /** Atualiza os cards de métricas (Pets, Serviços, Valor Total) */
    function updateMetrics() {
        metricPetsElement.textContent = currentCalculationState.metrics.pets;
        metricServicesCountElement.textContent = currentCalculationState.metrics.services;
        metricTotalValueElement.textContent = formatCurrency(currentCalculationState.totalValue);
        // O total de taxas (metricTotalFees) é atualizado por calculateAndDisplayTotals()
    }

    /** Reseta a seção de cálculo para o estado inicial */
    function resetCalculationSection() {
        fileInputElement.value = ''; // Limpa ficheiro selecionado
        royaltyRateInputElement.value = '6.0'; // Valor padrão
        marketingRateInputElement.value = '1.0'; // Valor padrão
        // Reseta o estado interno
        currentCalculationState = {
            selectedFranchiseName: null, config: null,
            month: reportMonthSelectElement.value || MONTHS[new Date().getMonth()], // Mantém o mês selecionado
            royaltyRate: 6.0, marketingRate: 1.0, totalValue: 0,
            calculationRows: [], fileData: [], metrics: { pets: 0, services: 0 }
        };
        updateMetrics(); // Reseta exibição das métricas
        // Limpa a tabela e mostra mensagem padrão
        calculationTbodyElement.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-muted-foreground italic">Select a franchise and upload a file to calculate fees.</td></tr>`;
        calculationTotalDisplayElement.textContent = formatCurrency(0); // Reseta total
        toggleCalculationFields(false); // Desabilita campos
    }

    /** Habilita ou desabilita os campos na seção de cálculo */
    function toggleCalculationFields(enabled) {
        fileInputElement.disabled = !enabled;
        royaltyRateInputElement.disabled = !enabled;
        marketingRateInputElement.disabled = !enabled;
        addCalculationRowButtonElement.disabled = !enabled;
        // Se estiver desabilitando E não for o estado inicial (nenhuma franquia selecionada), reseta a seção
        if (!enabled && franchiseSelectElement.value !== "") {
            resetCalculationSection();
        }
    }

    /** Retorna um array com os templates das linhas de cálculo base (fixas) */
    function getDefaultCalculationRowTemplates() {
        // Retorna sempre uma CÓPIA PROFUNDA para evitar modificações acidentais no template
        return JSON.parse(JSON.stringify([
           { Item: "Royalty Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true },
           { Item: "Marketing Fee", Description: "", Qty: 0, Unit_price: 0, Amount: 0, verified: false, fixed: true },
           { Item: "Software Fee", Description: "", Qty: 1, Unit_price: 350.00, Amount: 0, verified: false, fixed: true },
           { Item: "Call Center Fee", Description: "", Qty: 1, Unit_price: 1200.00, Amount: 0, verified: false, fixed: true },
           { Item: "Call Center Fee Extra", Description: "", Qty: 0, Unit_price: 600.00, Amount: 0, verified: false, fixed: true }
       ]));
   }


    // --- Processamento de Ficheiro ---

    /** Lida com o evento de seleção de ficheiro(s) */
    async function handleFileUpload(event) {
        // Verifica se uma franquia está selecionada
        if (!currentCalculationState.selectedFranchiseName) {
            showToast("Please select a franchise before uploading a file.", "warning");
            fileInputElement.value = ''; // Limpa seleção
            return;
        }

        const files = event.target.files;
        if (files.length === 0) return; // Nenhum ficheiro selecionado

        loadingSpinnerElement.classList.remove('hidden'); // Mostra spinner de processamento
        let combinedJsonData = [];

        // Lê cada ficheiro selecionado
        for (const file of files) {
            try {
                const data = await file.arrayBuffer(); // Lê conteúdo como ArrayBuffer
                const workbook = XLSX.read(data); // Processa com a biblioteca xlsx
                const firstSheetName = workbook.SheetNames[0]; // Assume dados na primeira aba
                const worksheet = workbook.Sheets[firstSheetName];
                // Converte aba para array de objetos JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
                combinedJsonData.push(...jsonData); // Adiciona dados ao array combinado
            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                showToast(`Error reading file ${file.name}. Please check format.`, 'error');
            }
        }

        loadingSpinnerElement.classList.add('hidden'); // Esconde spinner
        currentCalculationState.fileData = combinedJsonData; // Guarda dados brutos no estado
        processUploadedData(); // Chama a função para processar os dados combinados
    }

    /** Processa os dados lidos do(s) ficheiro(s) e atualiza o estado/UI */
    function processUploadedData() {
        const fileData = currentCalculationState.fileData;
        const config = currentCalculationState.config; // Configuração da franquia selecionada

        // Reseta métricas e valor total antes de re-calcular
        currentCalculationState.metrics = { pets: 0, services: 0 };
        currentCalculationState.totalValue = 0;

        // Verifica se há configuração e dados válidos
        if (!config || !fileData || fileData.length === 0) {
            currentCalculationState.calculationRows = generateCalculationRows(); // Gera linhas base (vazias ou conforme config)
            updateMetrics(); // Reseta métricas na UI
            updateCalculationTableDOM(); // Renderiza tabela (provavelmente com msg de aviso)
            // Mostra aviso se havia ficheiro mas sem dados válidos
            if (fileData && fileData.length > 0) showToast("No valid service data found in the uploaded file(s).", 'warning');
            return;
        }

        let petsServicedCount = 0;
        let servicesPerformedCount = 0;
        let totalAdjustedRevenue = 0;

        // Itera sobre cada linha (objeto) dos dados lidos da planilha
        fileData.forEach(row => {
            // Ignora linhas de total ou sem descrição válida
            if (row['Ticket ID'] === 'Grand Total' || String(row['Description']).includes('Grand Total') || !row['Description']) {
                return;
            }

            const description = row['Description'];
            const originalTotalValue = parseCurrency(row['Total']); // Usa coluna 'Total'

            // Processa apenas linhas com descrição e valor positivo
            if (description && originalTotalValue > 0) {
                // Aplica a lógica de ajuste de valor (ex: valor mínimo para certos serviços)
                const adjustedServiceValue = calculateServiceValue(description, originalTotalValue);
                totalAdjustedRevenue += adjustedServiceValue; // Acumula valor ajustado
                servicesPerformedCount++; // Incrementa contador de serviços
                // Assume 1 pet por serviço (pode precisar de lógica mais complexa se houver coluna de pets)
                petsServicedCount++;
            }
        });

        // Atualiza o estado com os valores calculados
        currentCalculationState.metrics = { pets: petsServicedCount, services: servicesPerformedCount };
        currentCalculationState.totalValue = totalAdjustedRevenue;
        // Gera as linhas da tabela de cálculo COM BASE NA CONFIGURAÇÃO da franquia selecionada
        currentCalculationState.calculationRows = generateCalculationRows();

        // Atualiza a interface do utilizador
        updateMetrics(); // Atualiza os cards de métricas
        updateCalculationTableDOM(); // Re-renderiza a tabela de cálculo (agora com Unit Price correto para taxas)
    }

    // --- Funções do Modal de Edição ---

    /** Abre o modal de edição preenchido com os dados da franquia */
    function openEditModal(franchiseName) {
        const configToEdit = franchisesConfiguration.find(config => config.franchiseName === franchiseName);
        if (!configToEdit) return; // Não faz nada se não encontrar

        editOriginalNameInputElement.value = configToEdit.franchiseName; // Guarda nome original
        editNameInputElement.value = configToEdit.franchiseName; // Preenche campo de nome
        // Marca/desmarca os checkboxes com base na configuração atual
        editFeeCheckboxElements.forEach(checkbox => {
            const feeItem = checkbox.dataset.feeItem;
            const apiField = feeItemToApiFieldMap[feeItem];
            checkbox.checked = configToEdit[apiField] || false; // Marca se for true na config
        });
        editModalElement.classList.remove('hidden'); // Exibe o modal
    }

    /** Fecha o modal de edição */
    function closeEditModal() {
        editModalElement.classList.add('hidden'); // Esconde o modal
        editFormElement.reset(); // Limpa o formulário do modal
    }

    /** Lida com o clique no botão Salvar do modal de edição */
    function handleSaveEdit() {
        const originalName = editOriginalNameInputElement.value;
        const newName = editNameInputElement.value.trim(); // Novo nome (sem espaços extra)
        const includedFeesMap = {}; // Objeto para guardar estado dos checkboxes

        // Lê o estado de cada checkbox de taxa no modal
        editFeeCheckboxElements.forEach(checkbox => {
            includedFeesMap[checkbox.dataset.feeItem] = checkbox.checked;
        });

        if (!newName) { // Validação simples
            alert("Franchise name cannot be empty.");
            return;
        }

        // Chama a função da API para atualizar a configuração
        updateFranchiseConfig(originalName, newName, includedFeesMap);
    }

    // --- Event Listeners ---

    // Listener para o formulário de adicionar nova franquia
    addFranchiseFormElement.addEventListener('submit', (event) => {
        event.preventDefault(); // Impede envio padrão do formulário
        const franchiseName = newFranchiseNameInputElement.value.trim();
        const includedFeesMap = {};
        // Obtém o estado dos checkboxes de taxa
        newFeeCheckboxElements.forEach(checkbox => {
            includedFeesMap[checkbox.dataset.feeItem] = checkbox.checked;
        });
        if (franchiseName) {
            addFranchiseConfig(franchiseName, includedFeesMap); // Chama API para adicionar
        } else {
            alert("Please enter a franchise name.");
        }
    });

    // Listener para o dropdown de seleção de franquia
    franchiseSelectElement.addEventListener('change', (event) => {
        const selectedName = event.target.value;
        if (selectedName) {
            // Se uma franquia foi selecionada
            currentCalculationState.selectedFranchiseName = selectedName;
            // Encontra a configuração correspondente no estado global
            currentCalculationState.config = franchisesConfiguration.find(config => config.franchiseName === selectedName);
            // Reseta dados de ficheiro, valor total, métricas
            fileInputElement.value = ''; // Limpa seleção de ficheiro
            currentCalculationState.fileData = [];
            currentCalculationState.totalValue = 0;
            currentCalculationState.metrics = { pets: 0, services: 0 };
            // Gera as linhas da tabela com base na nova configuração selecionada
            currentCalculationState.calculationRows = generateCalculationRows();
            updateMetrics(); // Atualiza cards
            updateCalculationTableDOM(); // Renderiza a tabela (mostrará estrutura ou msg)
            toggleCalculationFields(true); // Habilita campos de upload/taxas
        } else {
            // Se "-- Select..." foi selecionado, reseta toda a seção de cálculo
            resetCalculationSection();
        }
    });

    // Listener para o dropdown de seleção de mês
    reportMonthSelectElement.addEventListener('change', (event) => {
        currentCalculationState.month = event.target.value; // Atualiza o mês no estado
    });

    // Listener para o input de upload de ficheiro
    fileInputElement.addEventListener('change', handleFileUpload);

    // Listeners para os inputs de taxas (Royalty e Marketing)
    royaltyRateInputElement.addEventListener('change', (event) => {
        if (currentCalculationState.selectedFranchiseName) { // Só atualiza se uma franquia estiver selecionada
            currentCalculationState.royaltyRate = parseCurrency(event.target.value) || 0;
            updateCalculationTableDOM(); // Re-renderiza a tabela para atualizar Qty/Amount
        }
    });
    marketingRateInputElement.addEventListener('change', (event) => {
        if (currentCalculationState.selectedFranchiseName) {
            currentCalculationState.marketingRate = parseCurrency(event.target.value) || 0;
            updateCalculationTableDOM(); // Re-renderiza a tabela
        }
    });

    // Listener para o botão de adicionar linha customizada na tabela
    addCalculationRowButtonElement.addEventListener('click', addCalculationRowUI);

    // Listener centralizado (delegação de eventos) para a tabela de cálculo (tbody)
    calculationTbodyElement.addEventListener('change', (event) => {
        const targetElement = event.target;
        // Encontra a linha (TR) pai do elemento que disparou o evento
        const tableRowElement = targetElement.closest('.calculation-row');
        if (!tableRowElement) return; // Sai se o evento não ocorreu numa linha da tabela

        const rowIndex = parseInt(tableRowElement.dataset.index);
        // Validação de segurança para o índice
        if (isNaN(rowIndex) || rowIndex < 0 || rowIndex >= currentCalculationState.calculationRows.length) return;

        const rowData = currentCalculationState.calculationRows[rowIndex]; // Obtém os dados da linha no estado

        // Atualiza o estado interno (currentCalculationState.calculationRows) com base no input alterado
        if (targetElement.classList.contains('item-name')) {
            rowData.Item = targetElement.value;
        } else if (targetElement.classList.contains('description')) {
            rowData.Description = targetElement.value;
        } else if (targetElement.classList.contains('qty')) {
            rowData.Qty = targetElement.value; // Guarda como string, será parseado no cálculo
            // Adiciona/remove classe 'red-text' se Qty for 0 e não for linha fixa
            targetElement.classList.toggle('red-text', (parseFloat(targetElement.value) || 0) === 0 && !rowData.fixed);
        } else if (targetElement.classList.contains('unit-price')) {
            rowData.Unit_price = targetElement.value; // Guarda como string
        } else if (targetElement.classList.contains('verified')) {
            rowData.verified = targetElement.checked;
        }

        // Recalcula todos os 'Amounts' e o total geral sempre que algo na tabela muda
        calculateAndDisplayTotals();
    });

    // Listener centralizado (delegação) para cliques na tabela de cálculo (para botão delete)
    calculationTbodyElement.addEventListener('click', (event) => {
        // Verifica se o clique foi no botão de deletar linha
        if (event.target.classList.contains('delete-calculation-row-btn')) {
            const tableRowElement = event.target.closest('.calculation-row');
            if (tableRowElement) {
                const rowIndex = parseInt(tableRowElement.dataset.index);
                deleteCalculationRowUI(rowIndex); // Chama a função para remover a linha
            }
        }
    });

    // Listeners para os botões do Modal de Edição
    editModalSaveButtonElement.addEventListener('click', handleSaveEdit);
    editModalCancelButtonElement.addEventListener('click', closeEditModal);

    // --- Inicialização da Página ---
    populateMonthSelect(); // Popula dropdown de meses
    fetchFranchiseConfigs(); // Busca configurações da API (isso renderizará a lista e o select)
    resetCalculationSection(); // Garante que a seção de cálculo comece limpa e desabilitada

}); // Fim do DOMContentLoaded
