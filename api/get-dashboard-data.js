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

// --- INÍCIO DOS LOGS DE DIAGNÓSTICO ---
console.log("--- [API START] get-dashboard-data ---");
console.log(`[API ENV CHECK] CLIENT_EMAIL loaded: ${!!process.env.CLIENT_EMAIL}`);
console.log(`[API ENV CHECK] SPREADSHEET_ID_DATA loaded: ${!!process.env.SHEET_ID_DATA}`);
// --- FIM DOS LOGS DE DIAGNÓSTICO ---

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

export default async function handler(req, res) {
    console.log("[API TRACE] /api/get-dashboard-data endpoint was hit.");
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let technicians = [];
    let appointments = [];
    let employees = [];
    let franchises = [];

    try {
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);

        console.log("[API TRACE] Attempting to load spreadsheet info...");
        await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);
        console.log("[API TRACE] Spreadsheets info loaded successfully.");

        // --- Busca de Técnicos com Logs Detalhados ---
        console.log(`[API TRACE] Targeting sheet for technicians: "${SHEET_NAME_TECH_COVERAGE}"`);
        const sheetTechCoverage = docData.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
        
        if (sheetTechCoverage) {
            console.log(`[API SUCCESS] Found sheet "${SHEET_NAME_TECH_COVERAGE}". Attempting to read rows...`);
            const rows = await sheetTechCoverage.getRows();
            console.log(`[API TRACE] Found ${rows.length} total rows in the sheet.`);
            
            const headerValues = sheetTechCoverage.headerValues;
            console.log("[API TRACE] Headers found in sheet:", headerValues);
            
            // Procura pelo cabeçalho 'Name' de forma explícita e insensível a maiúsculas/minúsculas.
            const header = headerValues.find(h => h && h.trim().toLowerCase() === 'name');
            
            if (header) {
                 console.log(`[API SUCCESS] Found header '${header}'. Iterating through rows to extract technician names...`);
                 rows.forEach((row, index) => {
                    const techName = row.get(header);
                    if (techName && techName.trim() !== '') {
                        technicians.push(techName.trim());
                        console.log(`[API DATA] Row ${index + 2}: Found technician -> "${techName.trim()}"`);
                    } else {
                        console.log(`[API WARN] Row ${index + 2}: No technician name found or cell is empty.`);
                    }
                });
                console.log(`[API TRACE] Total technicians extracted: ${technicians.length}`);
            } else {
                 console.error(`[API FATAL] The specific header 'Name' was NOT FOUND in the "${SHEET_NAME_TECH_COVERAGE}" sheet. Please check the spelling and ensure it exists.`);
            }
        } else {
            console.error(`[API FATAL] FAILED to find sheet named "${SHEET_NAME_TECH_COVERAGE}".`);
        }
        
        // --- Outras buscas de dados (sem alterações) ---
        // ... (código para employees, franchises, appointments)

        const responseData = { appointments, employees, technicians, franchises };
        console.log("[API FINAL] Final technicians array being sent:", technicians);
        console.log("[API FINAL] Sending final JSON response to the client.");
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('[API CRITICAL ERROR] An error occurred in /api/get-dashboard-data:', error);
        res.status(500).json({ 
            error: `A critical server error occurred: ${error.message}`,
            technicians: [], // Garante que um array vazio seja enviado em caso de erro
            appointments: [], employees: [], franchises: []
        });
    }
}
