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
    // Retorna vazio imediatamente para null, undefined ou string vazia
    if (rawValue === null || rawValue === undefined || rawValue === '') {
        return '';
    }

    // 1. Tenta tratar como número serial do Excel
    // Verifica se é realmente um número e maior que um valor razoável (datas do Excel começam > 0)
    if (typeof rawValue === 'number' && rawValue > 0) {
        try {
            // Base Date: Dec 30, 1899 UTC (Excel base)
            const excelEpoch = Date.UTC(1899, 11, 30);
            // Calcula milissegundos desde a época do Excel
            const dateMilliseconds = excelEpoch + rawValue * 24 * 60 * 60 * 1000;
            const dateObject = new Date(dateMilliseconds);

            // Validação crucial: Verifica se o objeto Date é válido
            if (isNaN(dateObject.getTime())) {
                 console.warn(`Excel serial ${rawValue} resulted in invalid Date object.`);
                 return ''; // Data inválida
            }

            const year = dateObject.getUTCFullYear();
            // Filtra anos muito improváveis
            if (year < 1900 || year > 2100) {
                 console.warn(`Excel serial ${rawValue} resulted in unlikely year: ${year}`);
                 return '';
            }

            const month = String(dateObject.getUTCMonth() + 1).padStart(2, '0');
            const day = String(dateObject.getUTCDate()).padStart(2, '0');
            return `${month}/${day}/${year}`; // Formato MM/DD/YYYY

        } catch (error) {
            console.warn(`Error converting Excel serial date ${rawValue}:`, error);
            return ''; // Retorna vazio se a conversão falhar
        }
    }

    // 2. Tenta tratar como string
    if (typeof rawValue === 'string') {
        const dateString = rawValue.trim();
        let year, month, day;

        try {
            // Tenta formato YYYY-MM-DD (comum de inputs)
            const matchYYYYMMDD = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (matchYYYYMMDD) {
                year = parseInt(matchYYYYMMDD[1], 10);
                month = parseInt(matchYYYYMMDD[2], 10);
                day = parseInt(matchYYYYMMDD[3], 10);
            }
            // Tenta formato MM/DD/YYYY (formato desejado)
            else {
                 const matchMMDDYYYY = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                 if (matchMMDDYYYY) {
                     year = parseInt(matchMMDDYYYY[3], 10);
                     month = parseInt(matchMMDDYYYY[1], 10);
                     day = parseInt(matchMMDDYYYY[2], 10);
                 }
            }

            // Se conseguiu extrair ano, mês e dia pelos regex
            if (year && month && day) {
                 // Validações básicas
                 if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
                      console.warn(`Parsed date components seem invalid: Y=${year}, M=${month}, D=${day} from string "${dateString}"`);
                      return '';
                 }
                 // Tenta criar um objeto Date para validação mais profunda (ex: 31 de Fev)
                 const testDate = new Date(year, month - 1, day);
                 if (isNaN(testDate.getTime()) || testDate.getFullYear() !== year || testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
                      console.warn(`Date string "${dateString}" resulted in an invalid Date object after parsing.`);
                      return '';
                 }
                 // Se passou nas validações, formata
                 return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
            }
        } catch (error) {
             console.warn(`Error parsing date string "${dateString}":`, error);
             return ''; // Retorna vazio em caso de erro no parse
        }
    }

    // Se não for número nem string reconhecida, loga e retorna vazio
    console.warn(`Unparseable date value encountered: ${rawValue} (Type: ${typeof rawValue})`);
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

                // *** APLICA A NOVA FORMATAÇÃO PADRÃO PARA A COLUNA 'date' ***
                if (key.toLowerCase() === 'date') {
                    rowData[key] = parseAndFormatDateToMMDDYYYY(rawValue);
                }
                 // Para outras colunas, converte para string (ou vazio)
                 else {
                    rowData[key] = (rawValue !== undefined && rawValue !== null) ? String(rawValue) : '';
                }
            });
            return rowData;
        });

        // Filtra novamente registros onde a data não pôde ser formatada (retornou '')
        const validCosts = costs.filter(record => record['date']);

        return response.status(200).json({ costs: validCosts });

    } catch (error) {
        console.error('Error fetching cost control data:', error);
        response.status(500).json({ error: `Failed to fetch cost control data: ${error.message}` });
    }
}
