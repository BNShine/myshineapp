// api/update-appointment-showed-data.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import { SHEET_NAME_APPOINTMENTS } from './configs/sheets-config.js';

dotenv.config();

const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;

function parseToNumeric(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    const cleanedValue = String(value).replace(/[R$$,%]/g, '').trim();
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? 0 : parsed;
}

function formatToSheetDate(dateTimeStr) {
    return dateTimeStr;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { 
            rowIndex, technician, petShowed, serviceShowed, tips, 
            percentage, paymentMethod, verification, appointmentDate,
            pets, margin, travelTime // Novos campos recebidos
        } = req.body;

        if (rowIndex === undefined || rowIndex < 2) { 
            return res.status(400).json({ success: false, message: `O índice da linha é inválido: ${rowIndex}` });
        }
        
        const serviceValue = parseToNumeric(serviceShowed);
        const tipsValue = parseToNumeric(tips);
        const petShowedValue = parseToNumeric(petShowed);
        const percentageValue = parseToNumeric(percentage) / 100;
        const toPayValue = (serviceValue * percentageValue) + tipsValue;

        // Recalcula a Duração Total
        const travelTimeMinutes = parseInt(travelTime, 10) || 0;
        const marginMinutes = parseInt(margin, 10) || 30;
        const petsCount = parseInt(pets, 10) || 1;
        const duration = travelTimeMinutes + (petsCount * 60) + marginMinutes;

        const doc = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_APPOINTMENTS];

        if (!sheet) {
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }
        
        const rows = await sheet.getRows();
        const targetRow = rows.find(row => row.rowNumber === rowIndex);

        if (!targetRow) {
            return res.status(404).json({ success: false, message: 'Agendamento não encontrado para atualização.' });
        }
        
        targetRow.set('Date (Appointment)', formatToSheetDate(appointmentDate));
        targetRow.set('Verification', verification);
        targetRow.set('Technician', technician);
        targetRow.set('Method', paymentMethod);
        targetRow.set('Service Showed', serviceValue);
        targetRow.set('Tips', tipsValue);
        targetRow.set('Pet Showed', petShowedValue);
        targetRow.set('To Pay', toPayValue);
        targetRow.set('Percentage', percentageValue);
        
        // Salva os novos campos
        targetRow.set('Pets', petsCount);
        targetRow.set('Margin', marginMinutes);
        targetRow.set('Travel Time', travelTimeMinutes);
        targetRow.set('Duration', duration);
        
        await targetRow.save();
        
        return res.status(200).json({ success: true, message: 'Dados atualizados com sucesso!' });

    } catch (error) {
        console.error('[ERRO CRÍTICO] Falha ao atualizar planilha:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro no servidor. Verifique os logs.' });
    }
}
