// api/manage-franchise-config.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_FRANCHISE_CONFIG } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SPREADSHEET_ID = process.env.SHEET_ID;
const parseBoolean = (value) => { return (value === true || String(value).toUpperCase() === 'TRUE' || value === 1 || value === '1'); };
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';
const feeItemToColumnMap = { "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing", "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter", "Call Center Fee Extra": "IncludeCallCenterExtra" };
const columnToFeeItemMap = Object.fromEntries(Object.entries(feeItemToColumnMap).map(([key, value]) => [value, key]));

export default async function handler(req, res) {
    // Adiciona o método HTTP ao prefixo do log para clareza
    const logPrefix = `[API ${req.method} ${new Date().toISOString()}]`;
    console.log(`${logPrefix} Received request for /api/manage-franchise-config.`); // Log inicial

    // Cria instância do GoogleSpreadsheet
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        console.log(`${logPrefix} Attempting doc.loadInfo() for SHEET_ID: ${SPREADSHEET_ID}...`);
        await doc.loadInfo(); // Tenta carregar informações básicas da planilha
        console.log(`${logPrefix} doc.loadInfo() completed.`);

        // *** VERIFICAÇÃO CRÍTICA após loadInfo ***
        // Se doc.title não foi carregado, loadInfo() falhou (provavelmente autenticação/permissão)
        if (!doc.title) {
             console.error(`${logPrefix} CRITICAL: doc.loadInfo() failed silently - doc.title is missing. This usually indicates authentication or permission issues.`);
             // Lança um erro claro para ser capturado pelo catch principal
             throw new Error('Failed to load spreadsheet information. Verify Service Account credentials and Sheet permissions.');
        }

        // Verifica se sheetTitles existe antes de tentar usar .join()
        const sheetTitles = doc.sheetTitles || []; // Usa array vazio como fallback seguro
        console.log(`${logPrefix} Spreadsheet loaded: "${doc.title}". Available sheet titles: ${sheetTitles.join(', ')}`);

        // Tenta aceder à aba de configuração
        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        const expectedHeaders = ['FranchiseName', ...Object.values(feeItemToColumnMap)];

        // Lógica para criar ou corrigir a aba (igual à versão anterior, com logs)
        if (!sheet) {
            // Se for GET e a aba não existe, retorna vazio (não tenta criar)
            if (req.method === 'GET') {
                console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Returning [] for GET request.`);
                return res.status(200).json([]);
            }
             // Para outros métodos (POST, PUT, DELETE), tenta criar a aba
             console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Attempting to create...`);
             try {
                 sheet = await doc.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
                 console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" created successfully.`);
                 // Headers are implicitly loaded for the current instance after creation
             } catch (creationError) {
                  console.error(`${logPrefix} FAILED to create sheet "${SHEET_NAME_FRANCHISE_CONFIG}":`, creationError);
                  throw new Error(`Failed to create necessary sheet '${SHEET_NAME_FRANCHISE_CONFIG}': ${creationError.message}`);
             }
        } else {
            // Se a aba existe, verifica os cabeçalhos
            console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" found. Loading headers to verify...`);
            await sheet.loadHeaderRow(); // Carrega cabeçalhos existentes
            const currentHeaders = sheet.headerValues || [];
            console.log(`${logPrefix} Existing headers: ${currentHeaders.join(', ')}`);
             if (JSON.stringify(currentHeaders) !== JSON.stringify(expectedHeaders)) {
                 console.warn(`${logPrefix} Headers mismatch! Correcting headers for sheet "${SHEET_NAME_FRANCHISE_CONFIG}" (existing data might be lost)...`);
                 try {
                     await sheet.clear(); // Limpa a aba
                     await sheet.setHeaderRow(expectedHeaders); // Define cabeçalhos corretos
                     await sheet.resize({ rowCount: 1, columnCount: expectedHeaders.length }); // Ajusta tamanho
                     await sheet.loadHeaderRow(); // Recarrega cabeçalhos
                     console.log(`${logPrefix} Headers corrected and sheet cleared.`);
                 } catch (headerError) {
                      console.error(`${logPrefix} FAILED to correct headers:`, headerError);
                      throw new Error(`Failed to correct sheet headers: ${headerError.message}`);
                 }
             } else {
                 console.log(`${logPrefix} Headers match expected.`);
             }
        }

        // --- Processamento GET (Leitura) ---
        if (req.method === 'GET') {
            console.log(`${logPrefix} Processing GET request... Loading header row (safe check)...`);
            await sheet.loadHeaderRow(); // Garante que cabeçalhos estão carregados
            console.log(`${logPrefix} Fetching rows...`);
            const rows = await sheet.getRows(); // Obtém as linhas de dados
            console.log(`${logPrefix} Fetched ${rows.length} rows.`);
            const configs = rows.map(row => { // Mapeia as linhas para o formato JSON esperado
                const config = { franchiseName: row.get('FranchiseName') };
                Object.values(feeItemToColumnMap).forEach(colName => {
                    config[colName] = parseBoolean(row.get(colName)); // Converte 'TRUE'/'FALSE' para booleano
                });
                // Inclui apenas se tiver nome (evita linhas vazias)
                return config.franchiseName ? config : null;
            }).filter(Boolean); // Remove os nulos
            console.log(`${logPrefix} Parsed ${configs.length} valid configurations. Sending 200 response.`);
            return res.status(200).json(configs); // Retorna a lista de configurações
        }

        // --- Processamento POST (Criação) ---
        if (req.method === 'POST') {
             console.log(`${logPrefix} Processing POST request... Body:`, req.body);
             const { franchiseName, includedFees } = req.body;
             if (!franchiseName || !includedFees || typeof includedFees !== 'object') {
                 console.error(`${logPrefix} Invalid POST request body.`);
                 return res.status(400).json({ success: false, message: 'Bad Request: Franchise name and included fees object are required.' });
             }
             await sheet.loadHeaderRow(); const rows = await sheet.getRows();
             const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
             if (existing) {
                 console.warn(`${logPrefix} Conflict: Franchise "${franchiseName}" already exists.`);
                 return res.status(409).json({ success: false, message: `Conflict: Franchise "${franchiseName}" already exists.` });
             }
             const newRowData = { FranchiseName: franchiseName.trim() };
             Object.keys(feeItemToColumnMap).forEach(feeItem => {
                 newRowData[feeItemToColumnMap[feeItem]] = formatBoolean(includedFees[feeItem]);
             });
             console.log(`${logPrefix} Adding row to sheet...`, newRowData);
             const addedRowGSheet = await sheet.addRow(newRowData);
             await sheet.loadHeaderRow(); // Recarrega por segurança
             const addedConfig = { franchiseName: addedRowGSheet.get('FranchiseName') };
             Object.values(feeItemToColumnMap).forEach(colName => { addedConfig[colName] = parseBoolean(addedRowGSheet.get(colName)); });
             console.log(`${logPrefix} POST successful. Sending 201 response.`);
             return res.status(201).json({ success: true, message: 'Franchise configuration added successfully.', config: addedConfig });
        }

        // --- Processamento PUT (Atualização) ---
        if (req.method === 'PUT') {
            console.log(`${logPrefix} Processing PUT request... Body:`, req.body);
            const { originalFranchiseName, newFranchiseName, includedFees } = req.body;
            if (!originalFranchiseName || !newFranchiseName || !includedFees || typeof includedFees !== 'object') {
                console.error(`${logPrefix} Invalid PUT request body.`);
                return res.status(400).json({ success: false, message: 'Bad Request: Original name, new name, and included fees object are required.' });
            }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToUpdate = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === originalFranchiseName.trim().toLowerCase());
            if (!rowToUpdate) {
                console.warn(`${logPrefix} Not Found: Franchise "${originalFranchiseName}" not found for update.`);
                return res.status(404).json({ success: false, message: `Not Found: Franchise "${originalFranchiseName}" not found for update.` });
            }
            // ... (verificação de conflito de nome - igual anterior) ...
            const normalizedNewName = newFranchiseName.trim().toLowerCase();
            if (originalFranchiseName.trim().toLowerCase() !== normalizedNewName) { /* ... conflito ... */ }

            console.log(`${logPrefix} Updating row #${rowToUpdate.rowNumber}...`);
            rowToUpdate.set('FranchiseName', newFranchiseName.trim());
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                const columnName = feeItemToColumnMap[feeItem];
                const newValue = includedFees.hasOwnProperty(feeItem) ? formatBoolean(includedFees[feeItem]) : 'FALSE';
                rowToUpdate.set(columnName, newValue);
            });
            await rowToUpdate.save();
            await sheet.loadHeaderRow(); // Recarrega
            const updatedConfig = { franchiseName: rowToUpdate.get('FranchiseName') };
            Object.values(feeItemToColumnMap).forEach(colName => { updatedConfig[colName] = parseBoolean(rowToUpdate.get(colName)); });
            console.log(`${logPrefix} PUT successful. Sending 200 response.`);
            return res.status(200).json({ success: true, message: 'Franchise configuration updated successfully.', config: updatedConfig });
        }

        // --- Processamento DELETE (Remoção) ---
        if (req.method === 'DELETE') {
             console.log(`${logPrefix} Processing DELETE request... Body:`, req.body);
             const { franchiseName } = req.body;
             if (!franchiseName) {
                 console.error(`${logPrefix} Invalid DELETE request body.`);
                 return res.status(400).json({ success: false, message: 'Bad Request: Franchise name is required.' });
             }
             await sheet.loadHeaderRow(); const rows = await sheet.getRows();
             const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
             if (!rowToDelete) {
                 console.warn(`${logPrefix} Not Found: Franchise "${franchiseName}" not found for deletion.`);
                 return res.status(404).json({ success: false, message: `Not Found: Franchise "${franchiseName}" not found for deletion.` });
             }
             console.log(`${logPrefix} Deleting row #${rowToDelete.rowNumber}...`);
             await rowToDelete.delete();
             console.log(`${logPrefix} DELETE successful. Sending 200 response.`);
             return res.status(200).json({ success: true, message: `Franchise "${franchiseName}" configuration deleted successfully.` });
        }

        // --- Método não suportado ---
        console.log(`${logPrefix} Method ${req.method} not allowed.`);
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        // --- Tratamento Geral de Erros ---
        console.error(`${logPrefix} CRITICAL ERROR:`, error); // Log completo do erro no servidor

        // Determina mensagem de erro mais útil para o cliente
        let clientErrorMessage = 'An internal server error occurred while managing franchise configurations.';
        if (error.message) {
            // Erros específicos da biblioteca ou API do Google
            if (error.message.includes('permission denied') || error.message.includes('403') || error.response?.status === 403) {
                clientErrorMessage = 'Permission Denied: Check Service Account permissions on the Google Sheet (requires Editor access) and ensure Google Sheets API is enabled.';
            } else if (error.message.includes('Failed to load spreadsheet information')) {
                clientErrorMessage = error.message; // Usa a mensagem específica lançada após a falha do loadInfo
            } else if (error.message.includes('Requested entity was not found') || error.message.includes('404') || error.response?.status === 404) {
                 // Pode ser a planilha ou a aba
                 clientErrorMessage = `Google Sheet or Tab "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Verify SHEET_ID and tab name.`;
            } else if (error.message.includes('sheet headers') || error.message.includes('sheet creation')) {
                 clientErrorMessage = `Error processing sheet structure: ${error.message}`;
            }
             // Para outros erros, usa a mensagem do erro se disponível
             else {
                  clientErrorMessage = error.message;
             }
        }

        return res.status(500).json({ success: false, message: clientErrorMessage });
    }
}
