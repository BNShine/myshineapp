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
    // *** CORREÇÃO AQUI: Usar o escopo mais amplo ***
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Usando a variável SHEET_ID principal onde está a aba 'Config'
const SPREADSHEET_ID = process.env.SHEET_ID;
// const CONFIG_COLUMN_HEADER = 'maintenance_1'; // Não é necessário se acessamos por A1
const cellAddress = 'A2'; // Onde está o JSON na coluna maintenance_1 (assumindo cabeçalho em A1)

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_CONFIG]; // Usa a constante importada

        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_CONFIG}" not found in spreadsheet ${SPREADSHEET_ID}.`);
            // Retorna um objeto JSON vazio como fallback
            // Isso permite que os padrões sejam usados no frontend sem erro.
            return res.status(200).json({});
        }

        // Carrega apenas a célula necessária
        try {
            await sheet.loadCells(cellAddress);
        } catch (loadCellError) {
             console.error(`Error loading cell ${cellAddress} from sheet "${SHEET_NAME_CONFIG}":`, loadCellError);
             // Retorna objeto vazio se a célula não puder ser carregada
             return res.status(200).json({});
        }

        const cell = sheet.getCellByA1(cellAddress);
        // Usa '{}' como fallback se a célula estiver vazia ou for null/undefined
        const configJsonString = cell.value ? String(cell.value) : '{}';

        let configData = {};
        try {
            // Tenta parsear o JSON. Se falhar, usa objeto vazio.
            configData = JSON.parse(configJsonString);
             // Garante que seja um objeto
             if (typeof configData !== 'object' || configData === null) {
                 console.warn(`Value in cell ${cellAddress} is not a valid JSON object. Using empty object.`);
                 configData = {};
             }
        } catch (parseError) {
            console.error(`Failed to parse maintenance config JSON from cell ${cellAddress}:`, parseError, `Raw value: "${configJsonString}"`);
            // Retorna objeto vazio em caso de erro de parse
             configData = {};
        }

        return res.status(200).json(configData); // Retorna o objeto parseado (ou vazio)

    } catch (error) {
        console.error('Error fetching maintenance config:', error);
        // Retorna 500 apenas para erros inesperados do servidor, não para planilha/célula não encontrada
        // Passa a mensagem de erro original para depuração no frontend/logs
        res.status(500).json({ error: `Failed to fetch maintenance config: ${error.message || 'Unknown server error'}` });
    }
}
