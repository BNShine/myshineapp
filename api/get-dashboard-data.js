// api/get-dashboard-data.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { excelDateToYYYYMMDD } from './utils.js';
import { 
    SHEET_NAME_APPOINTMENTS, 
    SHEET_NAME_EMPLOYEES, 
    SHEET_NAME_FRANCHISES, 
    SHEET_NAME_TECH_COVERAGE
} from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

// Função auxiliar robusta para extrair dados de uma coluna específica
async function safelyExtractColumnData(doc, sheetName, expectedHeaderName) {
    const data = [];
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
        console.error(`[API ERROR] A planilha com o nome "${sheetName}" não foi encontrada.`);
        return data;
    }
    const rows = await sheet.getRows();
    const header = sheet.headerValues.find(h => h && h.trim().toLowerCase() === expectedHeaderName.toLowerCase());
    if (!header) {
        console.error(`[API ERROR] O cabeçalho "${expectedHeaderName}" não foi encontrado na planilha "${sheetName}".`);
        return data;
    }
    rows.forEach(row => {
        const value = row.get(header);
        if (value && value.trim() !== '') data.push(value.trim());
    });
    console.log(`[API TRACE] Extraídos ${data.length} itens da planilha "${sheetName}".`);
    return data;
}

export default async function handler(req, res) {
    try {
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);

        await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);

        // --- Busca de dados das planilhas ---
        const employees = await safelyExtractColumnData(docData, SHEET_NAME_EMPLOYEES, 'Name'); 
        const franchises = await safelyExtractColumnData(docData, SHEET_NAME_FRANCHISES, 'Franchise');
        const technicians = await safelyExtractColumnData(docData, SHEET_NAME_TECH_COVERAGE, 'Name');
        
        let appointments = [];
        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (sheetAppointments) {
            const rows = await sheetAppointments.getRows();
            rows.forEach(row => {
                if (row.get('Date')) {
                    appointments.push({ 
                        date: excelDateToYYYYMMDD(row.get('Date')),
                        pets: row.get('Pets'),
                        closer1: row.get('Closer (1)'),
                        closer2: row.get('Closer (2)')
                    });
                }
            });
        }

        // REMOVEMOS 'sources' da resposta desta API
        const responseData = { appointments, employees, technicians, franchises };
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('[API CRITICAL ERROR] em /api/get-dashboard-data:', error);
        return res.status(500).json({ 
            error: `Erro crítico no servidor: ${error.message}`,
            appointments: [], employees: [], technicians: [], franchises: []
        });
    }
}
