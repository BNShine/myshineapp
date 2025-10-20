// api/get-cost-control-data.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_COST_CONTROL } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Apenas leitura
});

const SPREADSHEET_ID = process.env.SHEET_ID;

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Ou configure CORS mais restritivo

    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_COST_CONTROL];

        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_COST_CONTROL}" not found.`);
            return res.status(404).json({ error: `Spreadsheet tab "${SHEET_NAME_COST_CONTROL}" not found.` });
        }

        const rows = await sheet.getRows();

        // Mapeia as linhas para um formato JSON mais limpo
        const costs = rows.map(row => {
            const rowData = {};
            // Itera sobre os cabeçalhos reais da planilha para pegar os dados
            sheet.headerValues.forEach(header => {
                // Remove caracteres inválidos ou espaços extras dos cabeçalhos para usar como chaves
                // Você pode ajustar isso se precisar de um formato específico como camelCase
                const key = header.trim(); // Mantém o nome exato do cabeçalho como chave
                rowData[key] = row.get(header) !== undefined && row.get(header) !== null ? String(row.get(header)) : ''; // Pega o valor e garante que seja string
            });
            return rowData;
        });


        return res.status(200).json({ costs });

    } catch (error) {
        console.error('Error fetching cost control data:', error);
        res.status(500).json({ error: `Failed to fetch cost control data: ${error.message}` });
    }
}
