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

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const data = req.body;

        if (!data.date || !data.odometer || !data.cost_type || !data.price) {
            return res.status(400).json({ success: false, message: 'Required fields are missing (Date, Odometer, Cost Type, Price).' });
        }

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_COST_CONTROL];

        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_COST_CONTROL}" not found in spreadsheet ID "${SPREADSHEET_ID}".`);
            return res.status(500).json({ success: false, message: `Spreadsheet tab "${SHEET_NAME_COST_CONTROL}" not found.` });
        }

        // **REMOVED setHeaderRow**

        // Prepare the row data - ensure keys match sheet headers EXACTLY
        const newRow = {
            date: data.date,
            license_plate: data.license_plate || '',
            vin: data.vin || '',
            odometer: data.odometer,
            cost_type: data.cost_type,
            subtype: data.subtype || '',
            technician: data.technician || '',
            price: data.price, // Ensure price is sent with '.' for decimals from frontend
            description: data.description || '',
            business_name: data.business_name || '',
            business_address: data.business_address || '',
            invoice_number: data.invoice_number || '',
            tire_change: data.tire_change || 'FALSE',
            oil_and_filter_change: data.oil_and_filter_change || 'FALSE',
            brake_change: data.brake_change || 'FALSE',
        };

        await sheet.addRow(newRow);

        return res.status(201).json({ success: true, message: 'Maintenance record added successfully!' });

    } catch (error) {
        console.error('Error adding cost control record:', error);
        // Provide a more generic error message to the client, but log the details
        return res.status(500).json({ success: false, message: 'A server error occurred while saving the record.' });
    }
}
