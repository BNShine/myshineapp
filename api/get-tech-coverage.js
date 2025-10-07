// api/get-tech-coverage.js
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_TECH_COVERAGE } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA; 

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
        
        if (!sheet) {
            return res.status(500).json({ error: `Sheet "${SHEET_NAME_TECH_COVERAGE}" not found.` });
        }

        const rows = await sheet.getRows();
        
        const techCoverageData = rows.map(row => {
            // Usando .get('Header Name') que é mais seguro
            const name = row.get('Name');
            const category = row.get('Category');
            const restrictions = row.get('Restrictions');
            const zipCode = row.get('OriginZipCode');
            const citiesRaw = row.get('Cities') || '[]';
            
            let parsedCities = [];
            try {
                parsedCities = JSON.parse(citiesRaw);
                if (!Array.isArray(parsedCities)) parsedCities = [];
            } catch (e) {
                console.error(`Falha ao converter Cities para JSON para o técnico: ${name}`);
                parsedCities = [];
            }
            
            return {
                nome: name,
                categoria: category,
                tipo_atendimento: restrictions,
                zip_code: zipCode,
                cidades: parsedCities,
            };
        }).filter(t => t.nome); // Filtra linhas que não têm nome de técnico

        return res.status(200).json(techCoverageData);

    } catch (error) {
        console.error('Error fetching tech coverage data from Sheets:', error);
        res.status(500).json({ error: 'Failed to fetch technician coverage data.' });
    }
}
