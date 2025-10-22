// api/register-cost-control.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_COST_CONTROL } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = process.env.SHEET_ID;

// --- Nova Função para converter YYYY-MM-DD para MM/DD/YYYY ---
function convertYYYYMMDDtoMMDDYYYY(dateStringYYYYMMDD) {
    if (!dateStringYYYYMMDD || !/^\d{4}-\d{2}-\d{2}$/.test(dateStringYYYYMMDD)) {
        return dateStringYYYYMMDD; // Retorna original se inválido
    }
    const [year, month, day] = dateStringYYYYMMDD.split('-');
    return `${month}/${day}/${year}`;
}
// --- Fim da Função ---

export default async function handler(request, response) { // Renomeado req/res
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const requestData = request.body; // Nome completo

        // Validação de campos essenciais
        if (!requestData.date || !requestData.odometer || !requestData.cost_type || !requestData.price) {
            return response.status(400).json({ success: false, message: 'Required fields are missing (Date, Odometer, Cost Type, Price).' });
        }
        if (!requestData.technician || !requestData.license_plate || !requestData.vin) {
             return response.status(400).json({ success: false, message: 'Technician, License Plate, and VIN are required.' });
        }


        const document = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth); // Nome completo
        await document.loadInfo();
        const sheet = document.sheetsByTitle[SHEET_NAME_COST_CONTROL];

        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_COST_CONTROL}" not found in spreadsheet ID "${SPREADSHEET_ID}".`);
            return response.status(500).json({ success: false, message: `Spreadsheet tab "${SHEET_NAME_COST_CONTROL}" not found.` });
        }

        // Prepara os dados da nova linha
        const newRowData = { // Nome completo
            // *** CONVERTE A DATA PARA MM/DD/YYYY ANTES DE SALVAR ***
            date: convertYYYYMMDDtoMMDDYYYY(requestData.date),
            license_plate: requestData.license_plate || '',
            vin: requestData.vin || '',
            odometer: requestData.odometer,
            cost_type: requestData.cost_type,
            subtype: requestData.subtype || '',
            technician: requestData.technician || '',
            price: requestData.price, // Já deve estar com '.' vindo do frontend
            description: requestData.description || '',
            business_name: requestData.business_name || '',
            business_address: requestData.business_address || '',
            invoice_number: requestData.invoice_number || '',
            tire_change: requestData.tire_change || 'FALSE',
            oil_and_filter_change: requestData.oil_and_filter_change || 'FALSE',
            brake_change: requestData.brake_change || 'FALSE',
            battery_change: requestData.battery_change || 'FALSE', // Incluído
            air_filter_change: requestData.air_filter_change || 'FALSE', // Incluído
        };

        await sheet.addRow(newRowData);

        return response.status(201).json({ success: true, message: 'Maintenance record added successfully!' });

    } catch (error) {
        console.error('Error adding cost control record:', error);
        return response.status(500).json({ success: false, message: `A server error occurred while saving the record: ${error.message}` });
    }
}
