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

// --- Função MAIS ROBUSTA para Parse e Formatação de Data ---
function parseAndFormatDateToMMDDYYYY(rawValue) {
    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
        return ''; // Retorna vazio para nulo, indefinido ou string vazia
    }

    let dateObject = null;

    // 1. Tenta tratar como número serial do Excel
    if (typeof rawValue === 'number' && rawValue > 0) {
        try {
            const excelEpoch = Date.UTC(1899, 11, 30);
            const dateMilliseconds = excelEpoch + rawValue * 24 * 60 * 60 * 1000;
            const potentialDateObject = new Date(dateMilliseconds);
            // Valida se o objeto Date é válido e o ano está num intervalo razoável
            if (!isNaN(potentialDateObject.getTime())) {
                 const year = potentialDateObject.getUTCFullYear();
                 if (year >= 1900 && year <= 2100) { // Intervalo razoável de anos
                    dateObject = potentialDateObject;
                 } else {
                     console.warn(`Excel serial ${rawValue} resulted in unlikely year: ${year}`);
                 }
            } else {
                 console.warn(`Excel serial ${rawValue} resulted in invalid Date object.`);
            }
        } catch (error) {
            console.warn(`Error converting Excel serial date ${rawValue}:`, error);
        }
    }
    // 2. Tenta tratar como string (se ainda não conseguiu converter como número)
    else if (typeof rawValue === 'string') {
        const dateString = rawValue.trim();
        try {
            // Tenta formatos específicos primeiro (mais confiável)
            let year, month, day;
            // Tenta YYYY-MM-DD (com ou sem hora)
            let match = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (match) {
                year = parseInt(match[1], 10);
                month = parseInt(match[2], 10);
                day = parseInt(match[3], 10);
            } else {
                 // Tenta MM/DD/YYYY (com ou sem hora)
                 match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                 if (match) {
                     year = parseInt(match[3], 10);
                     month = parseInt(match[1], 10);
                     day = parseInt(match[2], 10);
                 }
            }

            // Se encontrou componentes de data via regex
            if (year && month && day) {
                 // Valida componentes e tenta criar Date object
                 if (year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                     const potentialDateObject = new Date(Date.UTC(year, month - 1, day)); // Usa UTC para evitar timezone shift na criação
                     // Validação final (ex: 31 de Fev)
                     if (!isNaN(potentialDateObject.getTime()) &&
                         potentialDateObject.getUTCFullYear() === year &&
                         potentialDateObject.getUTCMonth() === month - 1 &&
                         potentialDateObject.getUTCDate() === day)
                     {
                         dateObject = potentialDateObject;
                     } else {
                         console.warn(`Date components from string "${dateString}" created an invalid Date object.`);
                     }
                 } else {
                      console.warn(`Parsed date components seem invalid: Y=${year}, M=${month}, D=${day} from string "${dateString}"`);
                 }
            } else {
                // Tenta parse genérico como ÚLTIMO RECURSO (menos confiável)
                 const potentialDateObject = new Date(dateString);
                 if (!isNaN(potentialDateObject.getTime())) {
                     const yearCheck = potentialDateObject.getFullYear();
                     if (yearCheck >= 1900 && yearCheck <= 2100) { // Valida ano
                         dateObject = potentialDateObject;
                          // Ajusta para UTC se o parse genérico foi usado, para consistência
                          dateObject = new Date(Date.UTC(dateObject.getFullYear(), dateObject.getMonth(), dateObject.getDate()));
                     } else {
                          console.warn(`Generic parse of "${dateString}" resulted in unlikely year: ${yearCheck}`);
                     }
                 }
            }
        } catch(error) {
             console.warn(`Error parsing date string "${dateString}":`, error);
        }
    }

    // 3. Formata se um objeto Date válido foi obtido
    if (dateObject instanceof Date && !isNaN(dateObject)) {
        // Usa UTC para formatação consistente, já que criamos/ajustamos para UTC
        const year = dateObject.getUTCFullYear();
        const month = String(dateObject.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObject.getUTCDate()).padStart(2, '0');
        return `${month}/${day}/${year}`; // Formato MM/DD/YYYY
    }

    // Se falhou em todas as tentativas, loga e retorna vazio
    console.warn(`Unparseable or invalid date value encountered: ${rawValue} (Type: ${typeof rawValue})`);
    return '';
}
// --- Fim da Função ---

export default async function handler(request, response) {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const document = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
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
                const key = header.trim();
                const rawValue = row.get(header);

                if (key.toLowerCase() === 'date') {
                    rowData[key] = parseAndFormatDateToMMDDYYYY(rawValue);
                } else {
                    rowData[key] = (rawValue !== undefined && rawValue !== null) ? String(rawValue) : '';
                }
            });
            return rowData;
        });

        // Filtra registros onde a data não pôde ser formatada
        const validCosts = costs.filter(record => record['date']);

        return response.status(200).json({ costs: validCosts });

    } catch (error) {
        console.error('Error fetching cost control data:', error);
        response.status(500).json({ error: `Failed to fetch cost control data: ${error.message}` });
    }
}
