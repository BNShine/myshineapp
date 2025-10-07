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

// Função auxiliar para extrair dados de uma planilha de forma segura
async function safelyExtractData(doc, sheetName, headerName) {
    const data = [];
    const sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
        console.error(`[API ERROR] Planilha "${sheetName}" não encontrada.`);
        return data; // Retorna array vazio se a planilha não existir
    }
    
    console.log(`[API TRACE] Lendo planilha: "${sheetName}"`);
    const rows = await sheet.getRows();
    const header = sheet.headerValues.find(h => h && h.trim().toLowerCase() === headerName.toLowerCase());

    if (!header) {
        console.error(`[API ERROR] Cabeçalho "${headerName}" não encontrado na planilha "${sheetName}".`);
        return data;
    }

    rows.forEach(row => {
        const value = row.get(header);
        if (value && value.trim() !== '') {
            data.push(value.trim());
        }
    });
    console.log(`[API TRACE] Extraídos ${data.length} itens da planilha "${sheetName}".`);
    return data;
}


export default async function handler(req, res) {
    console.log('[API LOG] /api/get-dashboard-data endpoint hit.');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);

        console.log('[API LOG] Carregando informações das planilhas...');
        await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);
        console.log('[API LOG] Informações carregadas com sucesso.');

        // --- Busca de dados usando a função auxiliar segura ---
        const technicians = await safelyExtractData(docData, SHEET_NAME_TECH_COVERAGE, 'Name');
        const employees = await safelyExtractData(docData, SHEET_NAME_EMPLOYEES, 'Name'); // Assumindo que o cabeçalho é 'Name'
        const franchises = await safelyExtractData(docData, SHEET_NAME_FRANCHISES, 'Franchise'); // Assumindo que o cabeçalho é 'Franchise'

        // --- Busca de Appointments (para os Cards) ---
        let appointments = [];
        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (sheetAppointments) {
            console.log(`[API TRACE] Lendo planilha: "${SHEET_NAME_APPOINTMENTS}"`);
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
            console.log(`[API TRACE] Extraídos ${appointments.length} agendamentos para os cards.`);
        } else {
            console.error(`[API ERROR] Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.`);
        }

        const responseData = { appointments, employees, technicians, franchises };
        console.log(`[API FINAL] Enviando resposta com ${technicians.length} técnicos, ${employees.length} funcionários, ${franchises.length} franquias.`);
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('[API CRITICAL ERROR] em /api/get-dashboard-data:', error);
        return res.status(500).json({ 
            error: `Erro crítico no servidor: ${error.message}`,
            appointments: [], employees: [], technicians: [], franchises: []
        });
    }
}
