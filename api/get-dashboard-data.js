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
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;

export default async function handler(req, res) {
    console.log('[API LOG] /api/get-dashboard-data endpoint hit.');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    let technicians = [];
    let appointments = [];
    let employees = [];
    let franchises = [];

    try {
        const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);

        console.log('[API LOG] Loading spreadsheet info...');
        await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);
        console.log('[API LOG] Spreadsheets info loaded.');

        // --- Busca de Técnicos (Já corrigido e funcionando) ---
        const sheetTechCoverage = docData.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
        if (sheetTechCoverage) {
            const rows = await sheetTechCoverage.getRows();
            const header = sheetTechCoverage.headerValues.find(h => h && h.trim().toLowerCase() === 'name');
            if (header) {
                 rows.forEach(row => {
                    const techName = row.get(header);
                    if (techName && techName.trim() !== '') technicians.push(techName.trim());
                });
            }
        }

        // --- CORREÇÃO PARA DROPDOWNS E CARDS ---

        // 1. Busca de Employees (Closers/SDRs)
        const sheetEmployees = docData.sheetsByTitle[SHEET_NAME_EMPLOYEES];
        if (sheetEmployees) {
            console.log(`[API TRACE] Found sheet: "${SHEET_NAME_EMPLOYEES}". Reading rows...`);
            const rows = await sheetEmployees.getRows();
            // A primeira coluna geralmente contém o nome do funcionário.
            const header = sheetEmployees.headerValues[0]; 
            if(header) {
                rows.forEach(row => { 
                    const employeeName = row.get(header);
                    if(employeeName && employeeName.trim() !== '') employees.push(employeeName.trim());
                });
                console.log(`[API TRACE] Extracted ${employees.length} employees.`);
            } else {
                console.error(`[API ERROR] No header found in the first column of "${SHEET_NAME_EMPLOYEES}".`);
            }
        } else {
             console.error(`[API ERROR] Sheet "${SHEET_NAME_EMPLOYEES}" not found.`);
        }
        
        // 2. Busca de Franchises (Regions)
        const sheetFranchises = docData.sheetsByTitle[SHEET_NAME_FRANCHISES];
        if (sheetFranchises) {
            console.log(`[API TRACE] Found sheet: "${SHEET_NAME_FRANCHISES}". Reading rows...`);
            const rows = await sheetFranchises.getRows();
            // A primeira coluna geralmente contém o nome da franquia/região.
            const header = sheetFranchises.headerValues[0];
            if(header) {
                rows.forEach(row => { 
                    const franchiseName = row.get(header);
                    if(franchiseName && franchiseName.trim() !== '') franchises.push(franchiseName.trim());
                });
                console.log(`[API TRACE] Extracted ${franchises.length} franchises.`);
            } else {
                 console.error(`[API ERROR] No header found in the first column of "${SHEET_NAME_FRANCHISES}".`);
            }
        } else {
            console.error(`[API ERROR] Sheet "${SHEET_NAME_FRANCHISES}" not found.`);
        }

        // 3. Busca de Appointments (para os Cards)
        const sheetAppointments = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (sheetAppointments) {
             console.log(`[API TRACE] Found sheet: "${SHEET_NAME_APPOINTMENTS}". Reading rows...`);
            const rows = await sheetAppointments.getRows();
            rows.forEach(row => {
                // Usamos row.get('Header Name') que é mais robusto
                if (row.get('Date')) {
                    appointments.push({ 
                        date: excelDateToYYYYMMDD(row.get('Date')),
                        pets: row.get('Pets'),
                        closer1: row.get('Closer (1)'),
                        closer2: row.get('Closer (2)')
                    });
                }
            });
            console.log(`[API TRACE] Extracted ${appointments.length} appointments for cards.`);
        } else {
             console.error(`[API ERROR] Sheet "${SHEET_NAME_APPOINTMENTS}" not found.`);
        }
        
        // --- FIM DA CORREÇÃO ---

        const responseData = { appointments, employees, technicians, franchises };
        console.log(`[API FINAL] Sending response with ${employees.length} employees, ${franchises.length} franchises, and ${appointments.length} appointments.`);
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('[API CRITICAL ERROR] in /api/get-dashboard-data:', error);
        res.status(500).json({ 
            error: `A critical server error occurred: ${error.message}`,
            appointments: [], employees: [], technicians: [], franchises: []
        });
    }
}
