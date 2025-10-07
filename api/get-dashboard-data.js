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
        return data; // Retorna array vazio
    }
    
    console.log(`[API TRACE] Lendo planilha: "${sheetName}"`);
    const rows = await sheet.getRows();
    
    // Procura pelo cabeçalho exato, ignorando maiúsculas/minúsculas e espaços
    const header = sheet.headerValues.find(h => h && h.trim().toLowerCase() === expectedHeaderName.toLowerCase());

    if (!header) {
        console.error(`[API ERROR] O cabeçalho "${expectedHeaderName}" não foi encontrado na planilha "${sheetName}". Verifique a ortografia do cabeçalho na sua planilha.`);
        console.log(`[API INFO] Cabeçalhos encontrados nesta planilha: [${sheet.headerValues.join(', ')}]`);
        return data; // Retorna array vazio
    }

    rows.forEach(row => {
        const value = row.get(header);
        if (value && value.trim() !== '') {
            data.push(value.trim());
        }
    });
    console.log(`[API TRACE] Extraídos ${data.length} itens da coluna "${header}" na planilha "${sheetName}".`);
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

        // --- Busca de dados usando a nova função segura ---
        const technicians = await safelyExtractColumnData(docData, SHEET_NAME_TECH_COVERAGE, 'Name');
        const employees = await safelyExtractColumnData(docData, SHEET_NAME_EMPLOYEES, 'Name'); 
        const franchises = await safelyExtractColumnData(docData, SHEET_NAME_FRANCHISES, 'Franchise');
        
        // --- Busca de Appointments (para os Cards) ---
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
            console.log(`[API TRACE] Extraídos ${appointments.length} agendamentos para os cards.`);
        } else {
            console.error(`[API ERROR] Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.`);
        }

        const responseData = { appointments, employees, technicians, franchises };
        console.log(`[API FINAL] Enviando resposta ao cliente.`);
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('[API CRITICAL ERROR] em /api/get-dashboard-data:', error);
        return res.status(500).json({ 
            error: `Erro crítico no servidor: ${error.message}`,
            // Envia arrays vazios para evitar que o frontend quebre
            appointments: [], employees: [], technicians: [], franchises: []
        });
    }
}
