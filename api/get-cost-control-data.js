// api/get-cost-control-data.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_COST_CONTROL } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID = process.env.SHEET_ID;

// --- Nova Função Robusta para Parse e Formatação de Data ---
function parseAndFormatDateToMMDDYYYY(rawValue) {
    if (!rawValue && rawValue !== 0) { // Considera 0 como inválido aqui
        return '';
    }

    // 1. Tenta tratar como número serial do Excel
    const numericValue = Number(rawValue);
    if (!isNaN(numericValue) && numericValue > 0) {
        try {
            // Lógica de conversão de data serial do Excel (ajustada para UTC)
            // Base Date: Dec 30, 1899 for Excel (serial date 1 is Jan 1, 1900)
             // O +1 ajusta a base para Dec 31, 1899 para que o dia 1 seja 1/1/1900
            const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Base date in UTC
            // Adiciona os dias (numericValue - 1 porque o dia 1 já é adicionado pela base)
            // Multiplica por milissegundos em um dia
            const dateMilliseconds = excelEpoch.getTime() + (numericValue) * 24 * 60 * 60 * 1000;
            const dateObject = new Date(dateMilliseconds);

            // Verifica se a data resultante é válida
            if (isNaN(dateObject.getTime())) return '';

            const year = dateObject.getUTCFullYear();
            // Garante que o ano seja razoável
            if (year < 1900 || year > 2100) return ''; // Filtra anos improváveis

            const month = String(dateObject.getUTCMonth() + 1).padStart(2, '0');
            const day = String(dateObject.getUTCDate()).padStart(2, '0');
            return `${month}/${day}/${year}`;
        } catch (error) {
            console.warn(`Error converting Excel serial date ${numericValue}:`, error);
            return ''; // Retorna vazio se a conversão falhar
        }
    }

    // 2. Tenta tratar como string
    if (typeof rawValue === 'string') {
        const dateString = rawValue.trim();
        let dateObject;
        try {
            // Tenta YYYY-MM-DD (comum de inputs ou APIs)
            if (/^\d{4}-\d{2}-\d{2}/.test(dateString)) {
                dateObject = new Date(dateString + 'T00:00:00Z'); // Trata como UTC
                dateObject.setMinutes(dateObject.getMinutes() + dateObject.getTimezoneOffset()); // Ajusta para dia local
            }
            // Tenta MM/DD/YYYY (formato desejado)
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dateString)) {
                const parts = dateString.split(' ')[0].split('/'); // Pega só a parte da data
                dateObject = new Date(parts[2], parseInt(parts[0], 10) - 1, parts[1]);
            }
             // Tenta outros formatos via construtor Date (menos confiável)
             else {
                 dateObject = new Date(dateString);
             }

            // Se conseguiu um objeto Date válido, formata
            if (dateObject instanceof Date && !isNaN(dateObject)) {
                const year = dateObject.getFullYear();
                 if (year < 1900 || year > 2100) return ''; // Filtra anos improváveis
                const month = String(dateObject.getMonth() + 1).padStart(2, '0');
                const day = String(dateObject.getDate()).padStart(2, '0');
                return `${month}/${day}/${year}`;
            }
        } catch(error) {
             console.warn(`Error parsing date string "${dateString}":`, error);
            return '';
        }
    }

    // Se não for número nem string reconhecida, retorna vazio
    return '';
}
// --- Fim da Função ---

export default async function handler(request, response) { // Renomeado req/res
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const document = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth); // Nome completo
        await document.loadInfo();
        const sheet = document.sheetsByTitle[SHEET_NAME_COST_CONTROL];

        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_COST_CONTROL}" not found.`);
            return response.status(404).json({ error: `Spreadsheet tab "${SHEET_NAME_COST_CONTROL}" not found.` });
        }

        const rows = await sheet.getRows();

        const costs = rows.map(row => {
            const rowData = {};
            sheet.headerValues.forEach(header => {
                const key = header.trim(); // Usa o nome exato do cabeçalho
                const rawValue = row.get(header); // Pega o valor bruto

                // *** APLICA A FORMATAÇÃO PADRÃO PARA A COLUNA 'date' ***
                if (key.toLowerCase() === 'date') { // Compara case-insensitive
                    rowData[key] = parseAndFormatDateToMMDDYYYY(rawValue);
                }
                 // Para outras colunas, converte para string (ou vazio)
                 else {
                    rowData[key] = (rawValue !== undefined && rawValue !== null) ? String(rawValue) : '';
                }
            });
            return rowData;
        });

        // Filtra novamente registros onde a data não pôde ser formatada
        const validCosts = costs.filter(record => record['date']);

        return response.status(200).json({ costs: validCosts }); // Envia apenas os válidos

    } catch (error) {
        console.error('Error fetching cost control data:', error);
        response.status(500).json({ error: `Failed to fetch cost control data: ${error.message}` });
    }
}
