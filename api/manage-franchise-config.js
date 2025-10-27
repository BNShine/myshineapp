// api/manage-franchise-config.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_FRANCHISE_CONFIG } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Leitura e escrita
});

// Usando a variável SHEET_ID principal onde está a aba 'FranchiseConfig'
const SPREADSHEET_ID = process.env.SHEET_ID;

// Função auxiliar para garantir valores booleanos consistentes
const parseBoolean = (value) => {
    if (value === true || value === 'true' || value === 'TRUE' || value === 1 || value === '1') return true;
    return false;
};
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';

// Mapeamento dos nomes dos itens para as colunas do Sheets
const feeItemToColumnMap = {
    "Royalty Fee": "IncludeRoyalty",
    "Marketing Fee": "IncludeMarketing",
    "Software Fee": "IncludeSoftware",
    "Call Center Fee": "IncludeCallCenter",
    "Call Center Fee Extra": "IncludeCallCenterExtra"
};
const columnToFeeItemMap = Object.fromEntries(Object.entries(feeItemToColumnMap).map(([key, value]) => [value, key]));

export default async function handler(req, res) {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        await doc.loadInfo();
        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];

        // Se a aba não existir, cria
        if (!sheet) {
            sheet = await doc.addSheet({
                title: SHEET_NAME_FRANCHISE_CONFIG,
                headerValues: ['FranchiseName', ...Object.values(feeItemToColumnMap)]
            });
            console.log(`Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" created.`);
        } else {
             // Garante que os cabeçalhos existem se a planilha já existia
             const currentHeaders = sheet.headerValues;
             const expectedHeaders = ['FranchiseName', ...Object.values(feeItemToColumnMap)];
             if (JSON.stringify(currentHeaders) !== JSON.stringify(expectedHeaders)) {
                 await sheet.setHeaderRow(expectedHeaders);
                 console.log(`Headers updated for sheet "${SHEET_NAME_FRANCHISE_CONFIG}".`);
             }
        }

        // --- GET: Ler Configurações ---
        if (req.method === 'GET') {
            const rows = await sheet.getRows();
            const configs = rows.map(row => {
                const config = {
                    franchiseName: row.get('FranchiseName'),
                    // rowNumber: row.rowNumber // Inclui o número da linha para facilitar updates/deletes
                };
                Object.values(feeItemToColumnMap).forEach(colName => {
                    config[colName] = parseBoolean(row.get(colName));
                });
                return config;
            }).filter(c => c.franchiseName); // Filtra linhas sem nome
            return res.status(200).json(configs);
        }

        // --- POST: Adicionar Nova Configuração ---
        if (req.method === 'POST') {
            const { franchiseName, includedFees } = req.body;
            if (!franchiseName || !includedFees || typeof includedFees !== 'object') {
                return res.status(400).json({ success: false, message: 'Franchise name and included fees object are required.' });
            }

            // Verifica se já existe
            const rows = await sheet.getRows();
            const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (existing) {
                return res.status(409).json({ success: false, message: `Franchise "${franchiseName}" already exists.` });
            }

            const newRow = { FranchiseName: franchiseName };
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                const columnName = feeItemToColumnMap[feeItem];
                newRow[columnName] = formatBoolean(includedFees[feeItem]); // Usa o nome do Item como chave no objeto includedFees
            });

            const addedRowGSheet = await sheet.addRow(newRow);
            // Retorna a configuração adicionada formatada como no GET
            const addedConfig = { franchiseName: addedRowGSheet.get('FranchiseName')};
             Object.values(feeItemToColumnMap).forEach(colName => {
                 addedConfig[colName] = parseBoolean(addedRowGSheet.get(colName));
             });

            return res.status(201).json({ success: true, message: 'Franchise configuration added.', config: addedConfig });
        }

        // --- PUT: Atualizar Configuração Existente ---
        if (req.method === 'PUT') {
             // Identifica pelo nome original para encontrar a linha
            const { originalFranchiseName, newFranchiseName, includedFees } = req.body;

            if (!originalFranchiseName || !newFranchiseName || !includedFees || typeof includedFees !== 'object') {
                return res.status(400).json({ success: false, message: 'Original name, new name, and included fees object are required for update.' });
            }

            const rows = await sheet.getRows();
            const rowToUpdate = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === originalFranchiseName.trim().toLowerCase());

            if (!rowToUpdate) {
                return res.status(404).json({ success: false, message: `Franchise "${originalFranchiseName}" not found for update.` });
            }

            // Verifica se o NOVO nome já existe (em outra linha)
            if (originalFranchiseName.trim().toLowerCase() !== newFranchiseName.trim().toLowerCase()) {
                const nameConflict = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === newFranchiseName.trim().toLowerCase());
                if (nameConflict && nameConflict.rowNumber !== rowToUpdate.rowNumber) {
                    return res.status(409).json({ success: false, message: `Cannot rename to "${newFranchiseName}", this name already exists.` });
                }
            }

            rowToUpdate.set('FranchiseName', newFranchiseName);
             Object.keys(feeItemToColumnMap).forEach(feeItem => {
                 const columnName = feeItemToColumnMap[feeItem];
                 // Verifica se a chave existe no objeto recebido, senão mantém o valor antigo (ou define como FALSE)
                 const newValue = includedFees.hasOwnProperty(feeItem) ? formatBoolean(includedFees[feeItem]) : 'FALSE';
                 rowToUpdate.set(columnName, newValue);
             });

            await rowToUpdate.save();

             // Retorna a configuração atualizada formatada
             const updatedConfig = { franchiseName: rowToUpdate.get('FranchiseName')};
             Object.values(feeItemToColumnMap).forEach(colName => {
                 updatedConfig[colName] = parseBoolean(rowToUpdate.get(colName));
             });

            return res.status(200).json({ success: true, message: 'Franchise configuration updated.', config: updatedConfig });
        }

        // --- DELETE: Remover Configuração ---
        if (req.method === 'DELETE') {
            const { franchiseName } = req.body; // Identifica pelo nome
            if (!franchiseName) {
                return res.status(400).json({ success: false, message: 'Franchise name is required for deletion.' });
            }

            const rows = await sheet.getRows();
            const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());

            if (!rowToDelete) {
                return res.status(404).json({ success: false, message: `Franchise "${franchiseName}" not found for deletion.` });
            }

            await rowToDelete.delete();
            return res.status(200).json({ success: true, message: 'Franchise configuration deleted.' });
        }

        // --- Método não permitido ---
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error('Error in /api/manage-franchise-config:', error);
        // Evita expor detalhes internos no erro de produção
        const errorMessage = error.message.includes('permission')
            ? 'Permission denied. Check Google Sheets API key and sheet sharing settings.'
            : 'An internal server error occurred.';
        return res.status(500).json({ success: false, message: errorMessage });
    }
}
