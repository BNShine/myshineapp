// api/get-maintenance-config.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
// Assumindo que você terá um nome para a aba de configuração
import { SHEET_NAME_CONFIG } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    // Precisa de permissão de leitura
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Usando a variável SHEET_ID principal onde está a aba 'Config'
const SPREADSHEET_ID = process.env.SHEET_ID;
const CONFIG_COLUMN_HEADER = 'maintenance_1'; // Nome exato da coluna

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_CONFIG]; // Usa a constante importada

        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_CONFIG}" not found.`);
            // Retorna um objeto JSON vazio como fallback se a aba não existir,
            // permitindo que os padrões sejam usados no frontend.
            return res.status(200).json({});
        }

        // Carrega apenas a célula necessária (A2, assumindo cabeçalho na linha 1)
        // Ajuste 'A2' se a célula estiver em outra posição
        const cellAddress = 'A2'; // Onde está o JSON na coluna maintenance_1
        await sheet.loadCells(cellAddress);
        const cell = sheet.getCellByA1(cellAddress);
        const configJsonString = cell.value || '{}'; // Retorna '{}' se a célula estiver vazia

        let configData = {};
        try {
            configData = JSON.parse(configJsonString);
        } catch (parseError) {
            console.error('Failed to parse maintenance config JSON from sheet:', parseError);
            // Retorna objeto vazio em caso de erro de parse, usa defaults no frontend
             configData = {};
        }

        return res.status(200).json(configData);

    } catch (error) {
        console.error('Error fetching maintenance config:', error);
        res.status(500).json({ error: `Failed to fetch maintenance config: ${error.message}` });
    }
}
