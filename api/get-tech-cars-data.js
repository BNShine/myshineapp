// api/get-tech-cars-data.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
// ficheiro de configuração com nomes das folhas
import { SHEET_NAME_TECH_CARS } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    // Apenas permissão de leitura é necessária aqui
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Usa a variável de ambiente principal para o ID da folha de cálculo
const SPREADSHEET_ID = process.env.SHEET_ID;

export default async function handler(req, res) {
    // Define os cabeçalhos da resposta
    res.setHeader('Content-Type', 'application/json');
    // Permite acesso de qualquer origem (ajuste se necessário para produção)
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
        // Inicializa o acesso à folha de cálculo
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
        // Carrega informações básicas do documento (títulos das folhas, etc.)
        await doc.loadInfo();
        // Acede à folha específica 'TechCars' pelo nome definido na configuração
        const sheet = doc.sheetsByTitle[SHEET_NAME_TECH_CARS];

        // Verifica se a folha foi encontrada
        if (!sheet) {
            console.error(`Sheet "${SHEET_NAME_TECH_CARS}" not found.`);
            // Retorna um erro 404 se a folha não existir
            return res.status(404).json({ error: `Spreadsheet tab "${SHEET_NAME_TECH_CARS}" not found.` });
        }

        // Obtém todas as linhas da folha
        const rows = await sheet.getRows();

        // Mapeia cada linha para um objeto JavaScript
        const techCarsData = rows.map(row => ({
            // Usa .get('NomeDoCabecalho') para obter o valor da célula, com fallback para string vazia
            tech_name: row.get('tech_name') || '',
            vin_number: row.get('vin_number') || '',
            car_plate: row.get('car_plate') || '',
        }))
        // **FILTRO REMOVIDO:** A linha abaixo foi removida para incluir todas as entradas
        // .filter(tech => tech.tech_name);

        // Adiciona um filtro para garantir que a linha não esteja completamente vazia
        .filter(item => item.tech_name || item.vin_number || item.car_plate);


        // Retorna os dados mapeados e filtrados como JSON com status 200 (OK)
        return res.status(200).json({ techCars: techCarsData });

    } catch (error) {
        // Captura e regista quaisquer erros durante o processo
        console.error('Error fetching TechCars data:', error);
        // Retorna um erro 500 (Internal Server Error) com uma mensagem
        res.status(500).json({ error: `Failed to fetch TechCars data: ${error.message}` });
    }
}
