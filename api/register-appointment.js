// api/register-appointment.js

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

const doc = new GoogleSpreadsheet(process.env.SHEET_ID_APPOINTMENTS, serviceAccountAuth);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Método não permitido.' });
    }

    try {
        const { 
            type, pets, closer1, closer2, customers, phone, oldNew, 
            appointmentDate, serviceValue, franchise, city, source, week, 
            month, year, code, reminderDate, verification, zipCode, technician,
            travelTime,
            margin
        } = req.body;

        // Validação de campos essenciais (removido o campo 'data' da validação)
        if (!type || !customers || !phone || !appointmentDate || !serviceValue || !franchise || !city || !source || !code) {
            return res.status(400).json({ success: false, message: 'Todos os campos obrigatórios, incluindo o código, precisam ser preenchidos.' });
        }
        
        if (!verification) {
             return res.status(400).json({ success: false, message: 'O campo de verificação está faltando.' });
        }
        
        if (!technician) {
            return res.status(400).json({ success: false, message: 'O campo Suggested Technician é obrigatório.' });
        }

        await doc.loadInfo();
        const sheet = doc.sheetsByTitle[SHEET_NAME_APPOINTMENTS];
        if (!sheet) {
            return res.status(500).json({ success: false, message: `Planilha "${SHEET_NAME_APPOINTMENTS}" não encontrada.` });
        }

        // --- LÓGICA DE VERIFICAÇÃO DE CÓDIGO ---
        const rows = await sheet.getRows();
        const codeExists = rows.some(row => row.get('Code') === code);

        if (codeExists) {
            return res.status(409).json({ success: false, message: `Erro: O código de confirmação "${code}" já existe. O agendamento pode ser um duplicado.` });
        }
        
        const travelTimeMinutes = parseInt(travelTime, 10) || 0;
        const marginMinutes = parseInt(margin, 10) || 30;
        const petsCount = parseInt(pets, 10) || 1;
        const duration = travelTimeMinutes + (petsCount * 60) + marginMinutes;

        // O campo 'Date' agora usa a data atual do servidor se não for fornecido, mas o appointment-form.js irá fornecê-lo.
        const registrationDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

        const newRow = {
            'Type': type,
            'Date': req.body.data || registrationDate, // Usa a data do form ou a data atual como fallback
            'Pets': pets,
            'Closer (1)': closer1, 
            'Closer (2)': closer2, 
            'Customers': customers,
            'Phone': phone,
            'Old/New': oldNew,
            'Date (Appointment)': appointmentDate,
            'Service Value': serviceValue,
            'Franchise': franchise,
            'City': city,
            'Source': source,
            'Week': week,
            'Month': month,
            'Year': year,
            'Code': code,
            'Reminder Date': reminderDate,
            'Verification': verification, 
            'Zip Code': zipCode,
            'Technician': technician,
            'Travel Time': travelTimeMinutes,
            'Margin': marginMinutes,
            'Duration': duration
        };

        await sheet.addRow(newRow);

        return res.status(201).json({ success: true, message: 'Agendamento registrado com sucesso!' });
    } catch (error) {
        console.error('Erro ao registrar agendamento:', error);
        return res.status(500).json({ success: false, message: `Ocorreu um erro no servidor. Detalhes: ${error.message}` });
    }
}
