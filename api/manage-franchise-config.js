// api/manage-franchise-config.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_FRANCHISE_CONFIG } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Permissão de Leitura e Escrita
});

// Usando a variável SHEET_ID principal onde a aba 'FranchiseConfig' estará
const SPREADSHEET_ID = process.env.SHEET_ID;

// Função auxiliar para garantir valores booleanos (TRUE/FALSE) consistentes na planilha
const parseBoolean = (value) => {
    if (value === true || String(value).toUpperCase() === 'TRUE' || value === 1 || value === '1') return true;
    return false;
};
const formatBoolean = (value) => parseBoolean(value) ? 'TRUE' : 'FALSE';

// Mapeia os nomes dos itens de taxa para os nomes das colunas na planilha
const feeItemToColumnMap = {
    "Royalty Fee": "IncludeRoyalty",
    "Marketing Fee": "IncludeMarketing",
    "Software Fee": "IncludeSoftware",
    "Call Center Fee": "IncludeCallCenter",
    "Call Center Fee Extra": "IncludeCallCenterExtra"
};
// Mapeamento inverso para facilitar a leitura
const columnToFeeItemMap = Object.fromEntries(Object.entries(feeItemToColumnMap).map(([key, value]) => [value, key]));

export default async function handler(req, res) {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

    try {
        await doc.loadInfo();
        let sheet = doc.sheetsByTitle[SHEET_NAME_FRANCHISE_CONFIG];

        // Se a aba não existir, cria ela com os cabeçalhos corretos
        if (!sheet) {
            const expectedHeaders = ['FranchiseName', ...Object.values(feeItemToColumnMap)];
            sheet = await doc.addSheet({
                title: SHEET_NAME_FRANCHISE_CONFIG,
                headerValues: expectedHeaders
            });
            console.log(`Sheet "${SHEET_NAME_FRANCHISE_CONFIG}" created.`);
        } else {
             // Garante que os cabeçalhos estão corretos se a planilha já existia
             const currentHeaders = sheet.headerValues;
             const expectedHeaders = ['FranchiseName', ...Object.values(feeItemToColumnMap)];
             if (JSON.stringify(currentHeaders) !== JSON.stringify(expectedHeaders)) {
                 await sheet.clear(); // Limpa dados existentes se os cabeçalhos mudarem
                 await sheet.setHeaderRow(expectedHeaders);
                 await sheet.resize({ rowCount: 1, columnCount: expectedHeaders.length }); // Garante o tamanho correto
                 console.log(`Headers corrected and sheet cleared for "${SHEET_NAME_FRANCHISE_CONFIG}".`);
             }
        }

        // --- GET: Ler todas as configurações salvas ---
        if (req.method === 'GET') {
            const rows = await sheet.getRows();
            const configs = rows.map(row => {
                const config = {
                    franchiseName: row.get('FranchiseName'),
                    // rowNumber: row.rowNumber // Pode ser útil incluir para updates/deletes futuros se o nome puder mudar
                };
                // Converte as colunas de inclusão (TRUE/FALSE) para booleanos
                Object.values(feeItemToColumnMap).forEach(colName => {
                    config[colName] = parseBoolean(row.get(colName));
                });
                return config;
            }).filter(c => c.franchiseName); // Remove linhas que possam ter ficado sem nome
            return res.status(200).json(configs);
        }

        // --- POST: Adicionar uma nova configuração de franquia ---
        if (req.method === 'POST') {
            const { franchiseName, includedFees } = req.body; // includedFees deve ser um objeto como {"Royalty Fee": true, "Marketing Fee": false, ...}
            if (!franchiseName || !includedFees || typeof includedFees !== 'object') {
                return res.status(400).json({ success: false, message: 'Franchise name and included fees object are required.' });
            }

            // Verifica se o nome já existe (ignorando maiúsculas/minúsculas e espaços)
            const rows = await sheet.getRows();
            const existing = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());
            if (existing) {
                return res.status(409).json({ success: false, message: `Franchise "${franchiseName}" already exists.` });
            }

            const newRowData = { FranchiseName: franchiseName.trim() };
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                const columnName = feeItemToColumnMap[feeItem];
                // Formata o valor booleano do objeto 'includedFees' para 'TRUE'/'FALSE'
                newRowData[columnName] = formatBoolean(includedFees[feeItem]);
            });

            const addedRowGSheet = await sheet.addRow(newRowData);

            // Retorna a configuração recém-adicionada no mesmo formato do GET
            const addedConfig = { franchiseName: addedRowGSheet.get('FranchiseName') };
             Object.values(feeItemToColumnMap).forEach(colName => {
                 addedConfig[colName] = parseBoolean(addedRowGSheet.get(colName));
             });

            return res.status(201).json({ success: true, message: 'Franchise configuration added successfully.', config: addedConfig });
        }

        // --- PUT: Atualizar uma configuração existente ---
        if (req.method === 'PUT') {
            const { originalFranchiseName, newFranchiseName, includedFees } = req.body;
            if (!originalFranchiseName || !newFranchiseName || !includedFees || typeof includedFees !== 'object') {
                return res.status(400).json({ success: false, message: 'Original name, new name, and included fees object are required for update.' });
            }

            const rows = await sheet.getRows();
            // Encontra a linha pelo nome original (ignorando maiúsculas/minúsculas e espaços)
            const rowToUpdate = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === originalFranchiseName.trim().toLowerCase());

            if (!rowToUpdate) {
                return res.status(404).json({ success: false, message: `Franchise "${originalFranchiseName}" not found for update.` });
            }

            // Verifica conflito se o nome foi alterado
            const normalizedNewName = newFranchiseName.trim().toLowerCase();
            if (originalFranchiseName.trim().toLowerCase() !== normalizedNewName) {
                const nameConflict = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === normalizedNewName);
                // Se encontrou conflito E não é a mesma linha que estamos atualizando
                if (nameConflict && nameConflict.rowNumber !== rowToUpdate.rowNumber) {
                    return res.status(409).json({ success: false, message: `Cannot rename to "${newFranchiseName}", this name already exists.` });
                }
            }

            // Atualiza os dados na linha
            rowToUpdate.set('FranchiseName', newFranchiseName.trim());
            Object.keys(feeItemToColumnMap).forEach(feeItem => {
                const columnName = feeItemToColumnMap[feeItem];
                // Se a taxa veio no objeto 'includedFees', usa o valor, senão assume FALSE
                const newValue = includedFees.hasOwnProperty(feeItem) ? formatBoolean(includedFees[feeItem]) : 'FALSE';
                rowToUpdate.set(columnName, newValue);
            });

            await rowToUpdate.save(); // Salva as alterações na planilha

            // Retorna a configuração atualizada
            const updatedConfig = { franchiseName: rowToUpdate.get('FranchiseName') };
            Object.values(feeItemToColumnMap).forEach(colName => {
                updatedConfig[colName] = parseBoolean(rowToUpdate.get(colName));
            });

            return res.status(200).json({ success: true, message: 'Franchise configuration updated successfully.', config: updatedConfig });
        }

        // --- DELETE: Remover uma configuração ---
        if (req.method === 'DELETE') {
            const { franchiseName } = req.body; // Identifica pelo nome
            if (!franchiseName) {
                return res.status(400).json({ success: false, message: 'Franchise name is required for deletion.' });
            }

            const rows = await sheet.getRows();
            // Encontra a linha pelo nome (ignorando maiúsculas/minúsculas e espaços)
            const rowToDelete = rows.find(row => row.get('FranchiseName')?.trim().toLowerCase() === franchiseName.trim().toLowerCase());

            if (!rowToDelete) {
                return res.status(404).json({ success: false, message: `Franchise "${franchiseName}" not found for deletion.` });
            }

            await rowToDelete.delete(); // Deleta a linha da planilha
            return res.status(200).json({ success: true, message: `Franchise "${franchiseName}" configuration deleted successfully.` });
        }

        // --- Método não permitido ---
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);

    } catch (error) {
        console.error('Error in /api/manage-franchise-config:', error);
        // Tenta dar uma mensagem de erro mais útil em caso de falha de permissão
        const errorMessage = error.message && error.message.includes('permission denied')
            ? 'Permission denied. Check Google Sheets API key, sheet sharing settings, and ensure the service account has Editor rights.'
            : (error.message || 'An internal server error occurred.');
        return res.status(500).json({ success: false, message: errorMessage });
    }
}
