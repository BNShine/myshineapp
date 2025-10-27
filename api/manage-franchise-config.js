// api/manage-franchise-config.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_FRANCHISE_CONFIG } from './configs/sheets-config.js';

dotenv.config();

// ... (definições de serviceAccountAuth, SPREADSHEET_ID, parseBoolean, formatBoolean, feeItemToColumnMap, columnToFeeItemMap - iguais às anteriores) ...
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SPREADSHEET_ID = process.env.SHEET_ID;
const parseBoolean = (value) => { /* ... */ return (value === true || String(value).toUpperCase() === 'TRUE' || value === 1 || value === '1'); };
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';
const feeItemToColumnMap = { "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing", "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter", "Call Center Fee Extra": "IncludeCallCenterExtra" };
const columnToFeeItemMap = Object.fromEntries(Object.entries(feeItemToColumnMap).map(([key, value]) => [value, key]));
// --- Fim das definições auxiliares ---

export default async function handler(req, res) {
    // Log detalhado do início da requisição
    console.log(`[API LOG ${new Date().toISOString()}] Received request: ${req.method} /api/manage-franchise-config`);

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        console.log(`[API LOG ${new Date().toISOString()}] Attempting to load spreadsheet info for ID: ${SPREADSHEET_ID}`);
        await doc.loadInfo();
        console.log(`[API LOG ${new Date().toISOString()}] Spreadsheet info loaded successfully. Available sheet titles: ${doc.sheetTitles.join(', ')}`);

        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        const expectedHeaders = ['FranchiseName', ...Object.values(feeItemToColumnMap)];

        if (!sheet) {
             // Se a aba não existe e a requisição é GET, retorna vazio.
            if (req.method === 'GET') {
                console.log(`[API LOG ${new Date().toISOString()}] Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Returning empty array for GET request.`);
                return res.status(200).json([]);
            }
            // Se for POST/PUT/DELETE e a aba não existe, tenta criar.
            console.log(`[API LOG ${new Date().toISOString()}] Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Attempting to create it...`);
             try {
                 sheet = await doc.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
                 console.log(`[API LOG ${new Date().toISOString()}] Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" created successfully.`);
                 // Headers should be loaded implicitly after creation for the current instance
             } catch (creationError) {
                  console.error(`[API CRITICAL ${new Date().toISOString()}] Failed to create sheet "${SHEET_NAME_FRANCHISE_CONFIG}":`, creationError);
                  throw new Error(`Failed to create necessary sheet: ${creationError.message}`); // Lança erro para ser pego pelo catch geral
             }
        } else {
            console.log(`[API LOG ${new Date().toISOString()}] Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" found.`);
            // Verifica os cabeçalhos se a aba já existe
            console.log(`[API LOG ${new Date().toISOString()}] Loading headers for existing sheet...`);
            await sheet.loadHeaderRow(); // Carrega os cabeçalhos existentes
            const currentHeaders = sheet.headerValues;
             console.log(`[API LOG ${new Date().toISOString()}] Existing headers: ${currentHeaders.join(', ')}`);
             if (JSON.stringify(currentHeaders) !== JSON.stringify(expectedHeaders)) {
                 console.warn(`[API WARN ${new Date().toISOString()}] Headers mismatch! Expected: ${expectedHeaders.join(', ')}. Found: ${currentHeaders.join(', ')}. Attempting to correct headers (data may be lost)...`);
                 try {
                     await sheet.clear(); // Limpa a aba inteira
                     await sheet.setHeaderRow(expectedHeaders); // Define os cabeçalhos corretos
                     await sheet.resize({ rowCount: 1, columnCount: expectedHeaders.length }); // Garante o tamanho certo (apenas cabeçalho)
                     await sheet.loadHeaderRow(); // Recarrega os cabeçalhos após a correção
                     console.log(`[API LOG ${new Date().toISOString()}] Headers corrected and sheet cleared.`);
                 } catch (headerError) {
                      console.error(`[API CRITICAL ${new Date().toISOString()}] Failed to correct headers:`, headerError);
                      throw new Error(`Failed to correct sheet headers: ${headerError.message}`);
                 }
             } else {
                  console.log(`[API LOG ${new Date().toISOString()}] Headers match expected.`);
             }
        }

        // --- Processamento baseado no método HTTP ---

        // --- GET ---
        if (req.method === 'GET') {
            console.log(`[API LOG ${new Date().toISOString()}] Processing GET request...`);
            // Garante que os cabeçalhos estão carregados (pode ser redundante, mas seguro)
            await sheet.loadHeaderRow();
            console.log(`[API LOG ${new Date().toISOString()}] Fetching rows...`);
            const rows = await sheet.getRows();
            console.log(`[API LOG ${new Date().toISOString()}] Fetched ${rows.length} rows.`);
            const configs = rows.map(row => { /* ... (lógica de mapeamento igual à anterior) ... */
                 const config = { franchiseName: row.get('FranchiseName') };
                 Object.values(feeItemToColumnMap).forEach(colName => {
                     config[colName] = parseBoolean(row.get(colName));
                 });
                 return config.franchiseName ? config : null;
             }).filter(Boolean);
            console.log(`[API LOG ${new Date().toISOString()}] Parsed ${configs.length} configurations. Sending response.`);
            return res.status(200).json(configs);
        }

        // --- POST ---
        if (req.method === 'POST') {
            console.log(`[API LOG ${new Date().toISOString()}] Processing POST request... Body:`, req.body);
            // ... (lógica do POST igual à anterior, talvez adicionar logs internos) ...
            const { franchiseName, includedFees } = req.body;
            if (!franchiseName || !includedFees || typeof includedFees !== 'object') { /* ... */ return res.status(400).json(/*...*/); }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows(); const existing = rows.find(/*...*/);
            if (existing) { /* ... */ return res.status(409).json(/*...*/); }
            const newRowData = { FranchiseName: franchiseName.trim() };
            Object.keys(feeItemToColumnMap).forEach(/*...*/);
            const addedRowGSheet = await sheet.addRow(newRowData);
            await sheet.loadHeaderRow(); // Recarregar
            const addedConfig = { franchiseName: addedRowGSheet.get('FranchiseName') };
            Object.values(feeItemToColumnMap).forEach(/*...*/);
             console.log(`[API LOG ${new Date().toISOString()}] Franchise added successfully. Sending response.`);
            return res.status(201).json({ success: true, message: 'Franchise configuration added successfully.', config: addedConfig });
        }

        // --- PUT ---
        if (req.method === 'PUT') {
             console.log(`[API LOG ${new Date().toISOString()}] Processing PUT request... Body:`, req.body);
            // ... (lógica do PUT igual à anterior, talvez adicionar logs internos) ...
             const { originalFranchiseName, newFranchiseName, includedFees } = req.body;
             if (!originalFranchiseName || !newFranchiseName || !includedFees || typeof includedFees !== 'object') { /* ... */ return res.status(400).json(/*...*/); }
             await sheet.loadHeaderRow(); const rows = await sheet.getRows(); const rowToUpdate = rows.find(/*...*/);
             if (!rowToUpdate) { /* ... */ return res.status(404).json(/*...*/); }
             // ... (verificação de conflito) ...
             rowToUpdate.set('FranchiseName', newFranchiseName.trim());
             Object.keys(feeItemToColumnMap).forEach(/*...*/);
             await rowToUpdate.save();
             await sheet.loadHeaderRow(); // Recarregar
             const updatedConfig = { franchiseName: rowToUpdate.get('FranchiseName') };
             Object.values(feeItemToColumnMap).forEach(/*...*/);
             console.log(`[API LOG ${new Date().toISOString()}] Franchise updated successfully. Sending response.`);
             return res.status(200).json({ success: true, message: 'Franchise configuration updated successfully.', config: updatedConfig });
        }

        // --- DELETE ---
        if (req.method === 'DELETE') {
             console.log(`[API LOG ${new Date().toISOString()}] Processing DELETE request... Body:`, req.body);
            // ... (lógica do DELETE igual à anterior, talvez adicionar logs internos) ...
             const { franchiseName } = req.body;
             if (!franchiseName) { /* ... */ return res.status(400).json(/*...*/); }
             await sheet.loadHeaderRow(); const rows = await sheet.getRows(); const rowToDelete = rows.find(/*...*/);
             if (!rowToDelete) { /* ... */ return res.status(404).json(/*...*/); }
             await rowToDelete.delete();
             console.log(`[API LOG ${new Date().toISOString()}] Franchise deleted successfully. Sending response.`);
             return res.status(200).json({ success: true, message: `Franchise "${franchiseName}" configuration deleted successfully.` });
        }

        console.log(`[API LOG ${new Date().toISOString()}] Method ${req.method} not allowed.`);
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        // Log do erro completo no servidor
        console.error(`[API CRITICAL ${new Date().toISOString()}] Error in /api/manage-franchise-config:`, error);

        // Mensagem mais genérica para o cliente, mas ainda útil
        const clientErrorMessage = error.message && error.message.includes('permission denied')
            ? 'Permission denied accessing Google Sheet. Check sharing settings.'
            : (error.message && error.message.includes("Header values are not yet loaded") // Captura específica do erro anterior
                ? 'Internal Server Error: Failed to load sheet headers. Please try again.'
                : (error.message || 'An internal server error occurred while accessing configuration.'));

        return res.status(500).json({ success: false, message: clientErrorMessage });
    }
}
