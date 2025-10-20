// api/register-cost-control.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_COST_CONTROL } from './configs/sheets-config.js'; // Importa o novo nome

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Necessita escopo de escrita
});

// Assume que SHEET_ID é a variável de ambiente correta para esta planilha
const SPREADSHEET_ID = process.env.SHEET_ID;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const data = req.body;

        // Validação básica (pode adicionar mais conforme necessário)
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

        // Garante que os cabeçalhos existam (caso a planilha esteja vazia)
        // Se a planilha já tiver cabeçalhos, esta linha não fará nada prejudicial.
        // Se estiver vazia, ela definirá os cabeçalhos esperados.
        // **IMPORTANTE:** Certifique-se que esta lista corresponde EXATAMENTE
        // aos cabeçalhos que você QUER na sua planilha, na ordem correta.
        await sheet.setHeaderRow([
            'date','license_plate','vin','odometer','cost_type','subtype',
            'technician','price','description','business_name','business_address',
            'invoice_number','tire_change','oil_and_filter_change','brake_change'
        ]);


        // Mapeia os dados do corpo da requisição para os nomes das colunas na planilha
        const newRow = {
            date: data.date,
            license_plate: data.license_plate || '',
            vin: data.vin || '',
            odometer: data.odometer,
            cost_type: data.cost_type,
            subtype: data.subtype || '',
            technician: data.technician || '',
            price: data.price,
            description: data.description || '',
            business_name: data.business_name || '',
            business_address: data.business_address || '',
            invoice_number: data.invoice_number || '',
            tire_change: data.tire_change || 'FALSE', // Default to FALSE if not provided
            oil_and_filter_change: data.oil_and_filter_change || 'FALSE',
            brake_change: data.brake_change || 'FALSE',
        };

        // Adiciona a nova linha usando o objeto mapeado pelos cabeçalhos
        await sheet.addRow(newRow);

        return res.status(201).json({ success: true, message: 'Maintenance record added successfully!' });

    } catch (error) {
        console.error('Error adding cost control record:', error);
        return res.status(500).json({ success: false, message: `Server error: ${error.message}` });
    }
}
