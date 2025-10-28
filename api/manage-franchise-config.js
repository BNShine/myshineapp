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

const parseBoolean = (value) => (value === true || String(value).toUpperCase() === 'TRUE' || value === 1 || value === '1');
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';

const feeItemToColumnMap = {
    "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing",
    "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter",
    "Call Center Fee Extra": "IncludeCallCenterExtra"
};
const columnToFeeItemMap = Object.fromEntries(Object.entries(feeItemToColumnMap).map(([key, value]) => [value, key]));

// Estrutura padrão das regras de serviço
const getDefaultServiceRules = () => ([
    { id: 'dog_small', keyword: 'Dog Cleaning - Small', threshold: 170, adjusted: 180, enabled: true },
    { id: 'dental_small', keyword: 'Dental Under 40 LBS', threshold: 170, adjusted: 180, enabled: true }, // Adicionado Dental
    { id: 'dog_medium', keyword: 'Dog Cleaning - Medium', threshold: 200, adjusted: 210, enabled: true },
    { id: 'dog_max', keyword: 'Dog Cleaning - Max', threshold: 230, adjusted: 240, enabled: true }, // Simplificado Max
    { id: 'dog_ultra', keyword: 'Dog Cleaning - Ultra', threshold: 260, adjusted: 270, enabled: true },
    { id: 'cat_cleaning', keyword: 'Cat Cleaning', threshold: 200, adjusted: 210, enabled: true },
    { id: 'nail_clipping', keyword: 'Nail Clipping', threshold: 0, adjusted: 10, enabled: true } // Representa valor fixo
]);


export default async function handler(req, res) {
    const logPrefix = `[API ${req.method} ${new Date().toISOString()}]`;
    console.log(`${logPrefix} Received request for /api/manage-franchise-config.`);

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        await doc.loadInfo();
        if (!doc.title) {
             throw new Error('Failed to load spreadsheet information. Verify Service Account credentials and Sheet permissions.');
        }
        const sheetTitles = doc.sheetTitles || [];
        console.log(`${logPrefix} Spreadsheet loaded: "${doc.title}". Available sheets: ${sheetTitles.join(', ')}`);

        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        // Adiciona a nova coluna esperada
        const expectedHeaders = ['FranchiseName', ...Object.values(feeItemToColumnMap), 'ServiceValueRules'];

        if (!sheet) {
            if (req.method === 'GET') {
                console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Returning [] for GET.`);
                return res.status(200).json([]);
            }
             console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" not found. Attempting to create...`);
             try {
                 sheet = await doc.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
                 console.log(`${logPrefix} Sheet created successfully.`);
             } catch (creationError) {
                  throw new Error(`Failed to create necessary sheet '${SHEET_NAME_FRANCHISE_CONFIG}': ${creationError.message}`);
             }
        } else {
            console.log(`${logPrefix} Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" found. Verifying headers...`);
            await sheet.loadHeaderRow();
            const currentHeaders = sheet.headerValues || [];
            console.log(`${logPrefix} Existing headers: ${currentHeaders.join(', ')}`);
             // Verifica se todos os cabeçalhos esperados existem
             let headersOk = expectedHeaders.every(header => currentHeaders.includes(header));

             if (!headersOk || currentHeaders.length < expectedHeaders.length) {
                 console.warn(`${logPrefix} Headers mismatch or incomplete! Expected: ${expectedHeaders.join(', ')}. Found: ${currentHeaders.join(', ')}. Attempting to add missing headers...`);
                 // Tenta adicionar apenas as colunas em falta sem limpar (mais seguro)
                 const missingHeaders = expectedHeaders.filter(header => !currentHeaders.includes(header));
                 if (missingHeaders.length > 0) {
                     try {
                         // Adiciona as colunas ausentes mantendo as existentes
                         const updatedHeaders = [...currentHeaders, ...missingHeaders];
                         await sheet.setHeaderRow(updatedHeaders);
                         await sheet.loadHeaderRow(); // Recarrega para confirmar
                         console.log(`${logPrefix} Added missing headers. New headers: ${sheet.headerValues.join(', ')}`);
                     } catch (headerError) {
                          console.error(`${logPrefix} FAILED to add missing headers:`, headerError);
                          // Considera lançar um erro ou continuar com os cabeçalhos existentes
                          // throw new Error(`Failed to update sheet headers: ${headerError.message}`);
                          console.warn(`${logPrefix} Proceeding with potentially incomplete headers.`);
                     }
                 }
             } else {
                 console.log(`${logPrefix} Headers OK.`);
             }
        }

        if (req.method === 'GET') {
            await sheet.loadHeaderRow();
            const rows = await sheet.getRows();
            const configs = rows.map(row => {
                const config = { franchiseName: row.get('FranchiseName') };
                Object.values(feeItemToColumnMap).forEach(colName => {
                    config[colName] = parseBoolean(row.get(colName));
                });
                // Lê e parseia as regras de serviço (ou usa padrão se vazio/inválido)
                let rules = getDefaultServiceRules(); // Começa com o padrão
                const rulesJsonString = row.get('ServiceValueRules');
                if (rulesJsonString) {
                    try {
                        const parsedRules = JSON.parse(rulesJsonString);
                        // Poderia adicionar validação da estrutura aqui se necessário
                        if (Array.isArray(parsedRules)) {
                           rules = parsedRules;
                        } else {
                            console.warn(`[API GET WARN] Invalid JSON structure in ServiceValueRules for ${config.franchiseName}. Using default.`);
                        }
                    } catch (parseError) {
                        console.warn(`[API GET WARN] Failed to parse ServiceValueRules JSON for ${config.franchiseName}. Using default. Error: ${parseError.message}`);
                    }
                }
                config.serviceValueRules = rules; // Adiciona as regras ao objeto de configuração
                return config.franchiseName ? config : null;
            }).filter(Boolean);
            return res.status(200).json(configs);
        }

        if (req.method === 'POST') {
             // Recebe 'serviceValueRules' como objeto do frontend
            const { franchiseName, includedFees, serviceValueRules } = req.body;
            if (!franchiseName || !includedFees || typeof includedFees !== 'object' || !Array.isArray(serviceValueRules)) {
                 return res.status(400).json({ success: false, message: 'Bad Request: Missing required fields or invalid service rules format.' });
            }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (existing) {
                 return res.status(409).json({ success: false, message: `Conflict: Franchise "${franchiseName}" already exists.` });
            }
            const newRowData = { FranchiseName: franchiseName.trim() };
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                 newRowData[feeItemToColumnMap[feeItem]] = formatBoolean(includedFees[feeItem]);
            });
             // Converte as regras para string JSON antes de salvar
            try {
                newRowData['ServiceValueRules'] = JSON.stringify(serviceValueRules);
            } catch (stringifyError) {
                 console.error(`[API POST ERROR] Failed to stringify serviceValueRules:`, stringifyError);
                 return res.status(500).json({ success: false, message: 'Internal Error: Could not process service value rules.' });
            }

            const addedRowGSheet = await sheet.addRow(newRowData);
            await sheet.loadHeaderRow();
            const addedConfig = { franchiseName: addedRowGSheet.get('FranchiseName') };
            Object.values(feeItemToColumnMap).forEach(colName => { addedConfig[colName] = parseBoolean(addedRowGSheet.get(colName)); });
            addedConfig.serviceValueRules = serviceValueRules; // Retorna o objeto original

            return res.status(201).json({ success: true, message: 'Franchise configuration added successfully.', config: addedConfig });
        }

        if (req.method === 'PUT') {
            const { originalFranchiseName, newFranchiseName, includedFees, serviceValueRules } = req.body;
            if (!originalFranchiseName || !newFranchiseName || !includedFees || typeof includedFees !== 'object' || !Array.isArray(serviceValueRules)) {
                 return res.status(400).json({ success: false, message: 'Bad Request: Missing required fields or invalid service rules format for update.' });
            }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToUpdate = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === originalFranchiseName.trim().toLowerCase());
            if (!rowToUpdate) {
                return res.status(404).json({ success: false, message: `Not Found: Franchise "${originalFranchiseName}" not found for update.` });
            }
            // ... (verificação de conflito de nome) ...
            const normalizedNewName = newFranchiseName.trim().toLowerCase();
            if (originalFranchiseName.trim().toLowerCase() !== normalizedNewName) { /* ... conflito ... */ }

            rowToUpdate.set('FranchiseName', newFranchiseName.trim());
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                 const columnName = feeItemToColumnMap[feeItem];
                 const newValue = includedFees.hasOwnProperty(feeItem) ? formatBoolean(includedFees[feeItem]) : 'FALSE';
                 rowToUpdate.set(columnName, newValue);
            });
            // Converte as regras para string JSON antes de salvar
             try {
                rowToUpdate.set('ServiceValueRules', JSON.stringify(serviceValueRules));
             } catch (stringifyError) {
                  console.error(`[API PUT ERROR] Failed to stringify serviceValueRules:`, stringifyError);
                  return res.status(500).json({ success: false, message: 'Internal Error: Could not process service value rules for update.' });
             }

            await rowToUpdate.save();
            await sheet.loadHeaderRow();
            const updatedConfig = { franchiseName: rowToUpdate.get('FranchiseName') };
            Object.values(feeItemToColumnMap).forEach(colName => { updatedConfig[colName] = parseBoolean(rowToUpdate.get(colName)); });
            updatedConfig.serviceValueRules = serviceValueRules; // Retorna o objeto original

            return res.status(200).json({ success: true, message: 'Franchise configuration updated successfully.', config: updatedConfig });
        }

        if (req.method === 'DELETE') {
             // DELETE não precisa mexer na coluna de regras, só deleta a linha
            const { franchiseName } = req.body;
            if (!franchiseName) {
                return res.status(400).json({ success: false, message: 'Bad Request: Franchise name is required.' });
            }
            await sheet.loadHeaderRow(); const rows = await sheet.getRows();
            const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (!rowToDelete) {
                return res.status(404).json({ success: false, message: `Not Found: Franchise "${franchiseName}" not found for deletion.` });
            }
            await rowToDelete.delete();
            return res.status(200).json({ success: true, message: `Franchise "${franchiseName}" configuration deleted successfully.` });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error(`${logPrefix} CRITICAL ERROR:`, error);
        // ... (bloco catch com mensagens de erro detalhadas - igual anterior) ...
        let clientErrorMessage = 'An internal server error occurred while managing franchise configurations.'; /* ... */
        return res.status(500).json({ success: false, message: clientErrorMessage });
    }
}
