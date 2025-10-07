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

        // --- CORREÇÃO APLICADA AQUI (BUSCA PELO CABEÇALHO 'Name') ---
        console.log(`[API LOG] Attempting to find sheet: "${SHEET_NAME_TECH_COVERAGE}" for technicians list.`);
        const sheetTechCoverage = docData.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
        
        if (sheetTechCoverage) {
            console.log(`[API LOG] SUCCESS: Found sheet "${SHEET_NAME_TECH_COVERAGE}". Reading rows...`);
            const rows = await sheetTechCoverage.getRows();
            console.log(`[API LOG] Found ${rows.length} rows in TechCoverageData sheet.`);
            
            // Procura pelo cabeçalho 'Name' de forma explícita.
            const header = sheetTechCoverage.headerValues.find(h => h.trim().toLowerCase() === 'name');
            
            if (header) {
                 rows.forEach(row => {
                    const techName = row.get(header);
                    if (techName && techName.trim() !== '') {
                        technicians.push(techName.trim());
                    }
                });
                console.log(`[API LOG] Extracted ${technicians.length} technicians using the 'Name' header.`);
            } else {
                 console.error(`[API ERROR] The specific header 'Name' was not found in the "${SHEET_NAME_TECH_COVERAGE}" sheet. Please ensure the first column header is exactly 'Name'.`);
            }
        } else {
            console.error(`[API ERROR] FAILED to find sheet "${SHEET_NAME_TECH_COVERAGE}". Please check the sheet name.`);
        }
        // --- FIM DA CORREÇÃO ---

        // --- Buscas Resilientes (sem alterações) ---
        const sheetEmployees = docData.sheetsByTitle[SHEET_NAME_EMPLOYEES];
        if (sheetEmployees) {
            const rows = await sheetEmployees.getRows();
            const header = sheetEmployees.headerValues[0];
            if(header) rows.forEach(row => { if(row.get(header)) employees.push(row.get(header)) });
        }
        
        const sheetFranchises = docData.sheetsByTitle[SHEET_NAME_FRANCHISES];
        if (sheetFranchises) {
            const rows = await sheetFranchises.getRows();
            const header = sheetFranchises.headerValues[0];
            if(header) rows.forEach(row => { if(row.get(header)) franchises.push(row.get(header)) });
        }

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

        const responseData = { appointments, employees, technicians, franchises };
        console.log(`[API LOG] Sending response with ${technicians.length} technicians.`);
        return res.status(200).json(responseData);

    } catch (error) {
        console.error('[API CRITICAL ERROR] in /api/get-dashboard-data:', error);
        res.status(500).json({ 
            error: `A critical server error occurred: ${error.message}`,
            appointments: [], employees: [], technicians: [], franchises: []
        });
    }
}
