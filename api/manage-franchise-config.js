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

const parseBoolean = (value) => {
    if (value === true || String(value).toUpperCase() === 'TRUE' || value === 1 || value === '1') return true;
    return false;
};
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';

const feeItemToColumnMap = {
    "Royalty Fee": "IncludeRoyalty", "Marketing Fee": "IncludeMarketing",
    "Software Fee": "IncludeSoftware", "Call Center Fee": "IncludeCallCenter",
    "Call Center Fee Extra": "IncludeCallCenterExtra"
};
const columnToFeeItemMap = Object.fromEntries(Object.entries(feeItemToColumnMap).map(([key, value]) => [value, key]));

export default async function handler(req, res) {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        await doc.loadInfo();
        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];
        const expectedHeaders = ['FranchiseName', ...Object.values(feeItemToColumnMap)];

        if (!sheet) {
            sheet = await doc.addSheet({ title: SHEET_NAME_FRANCHISE_CONFIG, headerValues: expectedHeaders });
            console.log(`Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" created.`);
            // Headers are set on creation, no need to reload here immediately unless reading rows right after.
        } else {
             // Load existing headers to check them
             await sheet.loadHeaderRow(); // Load headers explicitly FIRST
             const currentHeaders = sheet.headerValues;
             if (JSON.stringify(currentHeaders) !== JSON.stringify(expectedHeaders)) {
                 console.warn(`Headers mismatch for sheet "${SHEET_NAME_FRANCHISE_CONFIG}". Correcting headers.`);
                 // Clear might implicitly require reloading headers later
                 await sheet.clear();
                 await sheet.setHeaderRow(expectedHeaders);
                 await sheet.resize({ rowCount: 1, columnCount: expectedHeaders.length });
                 // After modifying headers, ensure they are loaded for subsequent operations
                 await sheet.loadHeaderRow(); // Reload headers after setting them
                 console.log(`Headers corrected and sheet cleared for "${SHEET_NAME_FRANCHISE_CONFIG}".`);
             }
        }

        // --- GET: Ler Configurações ---
        if (req.method === 'GET') {
            // **GARANTIR CABEÇALHOS CARREGADOS ANTES DE GETROWS**
            await sheet.loadHeaderRow(); // Adicionado aqui
            const rows = await sheet.getRows();
            const configs = rows.map(row => {
                const config = { franchiseName: row.get('FranchiseName') };
                Object.values(feeItemToColumnMap).forEach(colName => {
                    config[colName] = parseBoolean(row.get(colName));
                });
                return config;
            }).filter(c => c.franchiseName);
            return res.status(200).json(configs);
        }

        // --- POST: Adicionar Nova Configuração ---
        if (req.method === 'POST') {
            const { franchiseName, includedFees } = req.body;
            if (!franchiseName || !includedFees || typeof includedFees !== 'object') {
                return res.status(400).json({ success: false, message: 'Franchise name and included fees object are required.' });
            }

            // **GARANTIR CABEÇALHOS CARREGADOS ANTES DE GETROWS**
            await sheet.loadHeaderRow(); // Adicionado aqui
            const rows = await sheet.getRows();
            const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (existing) {
                return res.status(409).json({ success: false, message: `Franchise "${franchiseName}" already exists.` });
            }

            const newRowData = { FranchiseName: franchiseName.trim() };
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                newRowData[feeItemToColumnMap[feeItem]] = formatBoolean(includedFees[feeItem]);
            });

            // addRow *might* handle headers correctly, but reloading after isn't harmful
            const addedRowGSheet = await sheet.addRow(newRowData);
             await sheet.loadHeaderRow(); // Reload headers after adding row just in case

            const addedConfig = { franchiseName: addedRowGSheet.get('FranchiseName') };
             Object.values(feeItemToColumnMap).forEach(colName => {
                 addedConfig[colName] = parseBoolean(addedRowGSheet.get(colName));
             });

            return res.status(201).json({ success: true, message: 'Franchise configuration added successfully.', config: addedConfig });
        }

        // --- PUT: Atualizar Configuração Existente ---
        if (req.method === 'PUT') {
            const { originalFranchiseName, newFranchiseName, includedFees } = req.body;
            // ... (validações) ...
             if (!originalFranchiseName || !newFranchiseName || !includedFees || typeof includedFees !== 'object') {
                return res.status(400).json({ success: false, message: 'Original name, new name, and included fees object are required for update.' });
            }

            // **GARANTIR CABEÇALHOS CARREGADOS ANTES DE GETROWS**
            await sheet.loadHeaderRow(); // Adicionado aqui
            const rows = await sheet.getRows();
            const rowToUpdate = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === originalFranchiseName.trim().toLowerCase());

            if (!rowToUpdate) {
                return res.status(404).json({ success: false, message: `Franchise "${originalFranchiseName}" not found for update.` });
            }

            // ... (verificação de conflito de nome) ...
             const normalizedNewName = newFranchiseName.trim().toLowerCase();
            if (originalFranchiseName.trim().toLowerCase() !== normalizedNewName) {
                const nameConflict = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === normalizedNewName);
                if (nameConflict && nameConflict.rowNumber !== rowToUpdate.rowNumber) {
                    return res.status(409).json({ success: false, message: `Cannot rename to "${newFranchiseName}", this name already exists.` });
                }
            }


            rowToUpdate.set('FranchiseName', newFranchiseName.trim());
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                const columnName = feeItemToColumnMap[feeItem];
                const newValue = includedFees.hasOwnProperty(feeItem) ? formatBoolean(includedFees[feeItem]) : 'FALSE';
                rowToUpdate.set(columnName, newValue);
            });

            await rowToUpdate.save();
             // loadHeaderRow não deve ser necessário após save(), mas não prejudica
             await sheet.loadHeaderRow();

             const updatedConfig = { franchiseName: rowToUpdate.get('FranchiseName') };
             Object.values(feeItemToColumnMap).forEach(colName => {
                 updatedConfig[colName] = parseBoolean(rowToUpdate.get(colName));
             });


            return res.status(200).json({ success: true, message: 'Franchise configuration updated successfully.', config: updatedConfig });
        }

        // --- DELETE: Remover Configuração ---
        if (req.method === 'DELETE') {
            const { franchiseName } = req.body;
            if (!franchiseName) {
                return res.status(400).json({ success: false, message: 'Franchise name is required for deletion.' });
            }

            // **GARANTIR CABEÇALHOS CARREGADOS ANTES DE GETROWS**
            await sheet.loadHeaderRow(); // Adicionado aqui
            const rows = await sheet.getRows();
            const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());

            if (!rowToDelete) {
                return res.status(404).json({ success: false, message: `Franchise "${franchiseName}" not found for deletion.` });
            }

            await rowToDelete.delete();
            // Header row should still be valid after delete
            return res.status(200).json({ success: true, message: `Franchise "${franchiseName}" configuration deleted successfully.` });
        }

        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error('Error in /api/manage-franchise-config:', error);
        // Retorna a mensagem de erro específica se for o erro de cabeçalho
        if (error.message && error.message.includes("Header values are not yet loaded")) {
             return res.status(500).json({ success: false, message: 'Internal Server Error: Failed to load sheet headers correctly. Please try again or check sheet structure.' });
        }
        const errorMessage = error.message && error.message.includes('permission denied')
            ? 'Permission denied. Check Google Sheets API key, sheet sharing settings, and ensure the service account has Editor rights.'
            : (error.message || 'An internal server error occurred.');
        return res.status(500).json({ success: false, message: errorMessage });
    }
}
