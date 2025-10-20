// api/get-tech-cars-data.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_TECH_CARS } from './configs/sheets-config.js'; // Importa o novo nome

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'], // Apenas leitura
});

// Assume SHEET_ID é a variável de ambiente correta
const SPREADSHEET_ID = process.env.SHEET_ID;

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Ou configure CORS

    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_TECH_CARS];

        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_TECH_CARS}" not found.`);
            return res.status(404).json({ error: `Spreadsheet tab "${SHEET_NAME_TECH_CARS}" not found.` });
        }

        const rows = await sheet.getRows();

        // Mapeia as linhas para objetos com as colunas necessárias
        // Garante que os nomes das chaves (tech_name, vin_number, car_plate)
        // correspondem EXATAMENTE aos cabeçalhos na sua planilha TechCars
        const techCarsData = rows.map(row => ({
            tech_name: row.get('tech_name') || '',
            vin_number: row.get('vin_number') || '',
            car_plate: row.get('car_plate') || '',
        })).filter(tech => tech.tech_name); // Filtra linhas sem nome de técnico

        return res.status(200).json({ techCars: techCarsData });

    } catch (error) {
        console.error('Error fetching TechCars data:', error);
        res.status(500).json({ error: `Failed to fetch TechCars data: ${error.message}` });
    }
}
