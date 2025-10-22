// api/save-maintenance-config.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_CONFIG } from './configs/sheets-config.js'; // Importa nome da aba

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    // Precisa de permissão de escrita
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = process.env.SHEET_ID;
const CONFIG_COLUMN_HEADER = 'maintenance_1';
const cellAddress = 'A2'; // Onde salvar o JSON na coluna maintenance_1

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const configData = req.body; // Recebe o objeto JSON da configuração

        if (!configData || typeof configData !== 'object') {
            return res.status(400).json({ success: false, message: 'Invalid configuration data format provided.' });
        }

        const configJsonString = JSON.stringify(configData); // Converte para string JSON

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_CONFIG];

        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_CONFIG}" not found.`);
            return res.status(500).json({ success: false, message: `Sheet "${SHEET_NAME_CONFIG}" not found. Cannot save.` });
        }

        // Carrega a célula e atualiza seu valor
        await sheet.loadCells(cellAddress);
        const cell = sheet.getCellByA1(cellAddress);
        cell.value = configJsonString;
        await sheet.saveUpdatedCells(); // Salva a célula atualizada

        return res.status(200).json({ success: true, message: 'Configuration saved successfully to Google Sheets.' });

    } catch (error) {
        console.error('Error saving maintenance config:', error);
        res.status(500).json({ success: false, message: `Internal Server Error during configuration saving: ${error.message}` });
    }
}
