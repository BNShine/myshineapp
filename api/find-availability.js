// api/find-availability.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { SHEET_NAME_APPOINTMENTS, SHEET_NAME_TECH_COVERAGE, SHEET_NAME_AVAILABILITY } from './configs/sheets-config.js';

dotenv.config();

// --- Autenticação e Configuração do Google Sheets ---
const serviceAccountAuth = new JWT({
    email: process.env.CLIENT_EMAIL,
    key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const SPREADSHEET_ID_APPOINTMENTS = process.env.SHEET_ID_APPOINTMENTS;
const SPREADSHEET_ID_DATA = process.env.SHEET_ID_DATA;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// --- Funções Auxiliares ---
const parseSheetDate = (dateStr) => {
    if (!dateStr) return null;
    const [datePart, timePart] = dateStr.split(' ');
    if (!datePart || !timePart) return null;
    const [month, day, year] = datePart.split('/').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    if ([year, month, day, hour, minute].some(isNaN)) return null;
    return new Date(year, month - 1, day, hour, minute);
};

const getCityFromZip = async (zipCode) => {
    try {
        const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.places?.[0]?.['place name'] || null;
    } catch (error) {
        console.error(`Zippopotam API error for zip ${zipCode}:`, error);
        return null;
    }
};

const getTravelTime = async (originZip, destinationZip) => {
    if (!GOOGLE_MAPS_API_KEY) {
        throw new Error("Google Maps API key is not configured on the server.");
    }
    if (originZip === destinationZip) return 0;
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=zip%20${originZip}&destinations=zip%20${destinationZip}&key=${GOOGLE_MAPS_API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.status !== 'OK' || !data.rows[0].elements[0].duration) {
            console.warn(`[LOG] Google Maps API não pôde calcular o tempo de viagem entre ${originZip} e ${destinationZip}. Status: ${data.status}`);
            return Infinity;
        }
        return data.rows[0].elements[0].duration.value / 60; // Retorna em minutos
    } catch (error) {
        return Infinity;
    }
};

const getAllData = async () => {
    const docAppointments = new GoogleSpreadsheet(SPREADSHEET_ID_APPOINTMENTS, serviceAccountAuth);
    const docData = new GoogleSpreadsheet(SPREADSHEET_ID_DATA, serviceAccountAuth);
    await Promise.all([docAppointments.loadInfo(), docData.loadInfo()]);

    const techSheet = docData.sheetsByTitle[SHEET_NAME_TECH_COVERAGE];
    const availabilitySheet = docData.sheetsByTitle[SHEET_NAME_AVAILABILITY];
    const appointmentSheet = docAppointments.sheetsByTitle[SHEET_NAME_APPOINTMENTS];

    const techRows = await techSheet.getRows();
    const technicians = techRows.map(row => ({
        name: row.get('Name'),
        zipCode: row.get('OriginZipCode'),
        restrictions: row.get('Restrictions'),
        cities: JSON.parse(row.get('Cities') || '[]'),
    })).filter(t => t.name && t.zipCode);

    const availabilityRows = await availabilitySheet.getRows();
    const availabilityBlocks = availabilityRows.map(row => ({
        technician: row.get('TechnicianName'), date: row.get('Date'),
        start: row.get('StartHour'), end: row.get('EndHour'),
    }));

    const appointmentRows = await appointmentSheet.getRows();
    const appointments = appointmentRows.map(row => ({
        technician: row.get('Technician'), zipCode: row.get('Zip Code'),
        dateTime: parseSheetDate(row.get('Date (Appointment)')),
        duration: parseInt(row.get('Duration'), 10) || 120,
    })).filter(a => a.technician && a.dateTime);

    return { technicians, availabilityBlocks, appointments };
};

// --- Handler Principal da API ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { zipCode, numPets, margin } = req.body;
        console.log(`\n\n--- [LOG] Nova Requisição de Disponibilidade ---`);
        console.log(`[LOG] Inputs: CEP=${zipCode}, Pets=${numPets}, Margem=${margin}`);

        const appointmentDuration = (60 * parseInt(numPets, 10));
        const marginDuration = parseInt(margin, 10);

        const [customerCity, { technicians, availabilityBlocks, appointments }] = await Promise.all([
            getCityFromZip(zipCode),
            getAllData(),
        ]);

        if (!customerCity) {
            console.error(`[LOG] ERRO: Não foi possível encontrar a cidade para o CEP ${zipCode}.`);
            return res.status(404).json({ success: false, message: `Could not find city for Zip Code ${zipCode}.` });
        }

        const qualifiedTechs = technicians.filter(tech => {
            const serviceAreas = (tech.cities || []).map(area => String(area).toLowerCase().trim());
            return serviceAreas.includes(String(customerCity).toLowerCase().trim()) || serviceAreas.includes(String(zipCode).toLowerCase().trim());
        });

        if (qualifiedTechs.length === 0) {
            console.warn(`[LOG] AVISO: Nenhum técnico qualificado encontrado para a cidade "${customerCity}" ou CEP "${zipCode}".`);
            return res.status(200).json({ options: [] });
        }
        console.log(`[LOG] Técnicos qualificados encontrados: ${qualifiedTechs.map(t => t.name).join(', ')}`);
        
        const allOptions = new Map();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 2; i < 16; i++) {
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + i);

            if (currentDate.getDay() === 0) continue;
            console.log(`\n[LOG] Verificando data: ${currentDate.toDateString()}`);

            for (const tech of qualifiedTechs) {
                console.log(`[LOG] Verificando técnico: ${tech.name}`);
                const techSchedule = [];
                
                appointments.forEach(appt => {
                    if (appt.technician === tech.name && appt.dateTime.toDateString() === currentDate.toDateString()) {
                        const endTime = new Date(appt.dateTime.getTime() + (appt.duration * 60000));
                        techSchedule.push({ start: appt.dateTime, end: endTime, zip: appt.zipCode, type: 'appointment' });
                    }
                });

                availabilityBlocks.forEach(block => {
                    if (block.technician === tech.name) {
                        const [bMonth, bDay, bYear] = block.date.split('/').map(Number);
                        const blockDate = new Date(bYear, bMonth - 1, bDay);
                        if (blockDate.toDateString() === currentDate.toDateString()) {
                            const [sH, sM] = block.start.split(':').map(Number);
                            const [eH, eM] = block.end.split(':').map(Number);
                            const start = new Date(currentDate);
                            start.setHours(sH, sM, 0, 0);
                            const end = new Date(currentDate);
                            end.setHours(eH, eM, 0, 0);
                            techSchedule.push({ start, end, type: 'block' });
                        }
                    }
                });

                techSchedule.sort((a, b) => a.start - b.start);
                if (techSchedule.length > 0) {
                    console.log(`[LOG] Agenda de ${tech.name} para ${currentDate.toDateString()}:`, techSchedule.map(s => ({ type: s.type, start: s.start.toLocaleTimeString(), end: s.end.toLocaleTimeString() })));
                } else {
                    console.log(`[LOG] Agenda de ${tech.name} para ${currentDate.toDateString()} está vazia.`);
                }

                const workDayStart = new Date(currentDate);
                workDayStart.setHours(8, 0, 0, 0);
                const workDayEnd = new Date(currentDate);
                workDayEnd.setHours(17, 0, 0, 0);

                const startOfDay = new Date(currentDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(currentDate);
                endOfDay.setHours(23, 59, 59, 999);

                const fullSchedule = [
                    { start: startOfDay, end: workDayStart, type: 'block' },
                    ...techSchedule,
                    { start: workDayEnd, end: endOfDay, type: 'block' }
                ];

                for (let hour = 9; hour < 17; hour++) {
                    const candidateStartTime = new Date(currentDate);
                    candidateStartTime.setHours(hour, 0, 0, 0);
                    console.log(`[LOG] -- Verificando slot candidato: ${candidateStartTime.toLocaleTimeString()}`);

                    let previousEvent = { end: workDayStart, zip: tech.zipCode };
                    for(const event of fullSchedule) {
                        if (event.end <= candidateStartTime) {
                            previousEvent = event;
                        } else {
                            break;
                        }
                    }
                    console.log(`[LOG] ---- Evento anterior termina às: ${previousEvent.end.toLocaleTimeString()} no CEP ${previousEvent.zip || tech.zipCode}`);

                    const travelFrom = await getTravelTime(previousEvent.zip || tech.zipCode, zipCode);
                    if (travelFrom === Infinity) {
                         console.log(`[LOG] ---- SEM ROTA do evento anterior para o cliente. Pulando slot.`);
                        continue;
                    }
                     console.log(`[LOG] ---- Tempo de viagem do evento anterior: ${Math.round(travelFrom)} min.`);

                    const proposedStartTime = new Date(candidateStartTime.getTime());
                    if (proposedStartTime < new Date(previousEvent.end.getTime() + travelFrom * 60000)) {
                        console.log(`[LOG] ---- CONFLITO DE VIAGEM: O slot candidato (${proposedStartTime.toLocaleTimeString()}) é antes do fim do evento anterior + viagem (${new Date(previousEvent.end.getTime() + travelFrom * 60000).toLocaleTimeString()}).`);
                        continue;
                    }

                    const totalRequiredDuration = travelFrom + appointmentDuration + marginDuration;
                    const proposedEndTime = new Date(proposedStartTime.getTime() + totalRequiredDuration * 60000);
                     console.log(`[LOG] ---- Duração total necessária: ${totalRequiredDuration} min. Fim proposto: ${proposedEndTime.toLocaleTimeString()}`);

                    let hasConflict = false;
                    for(const event of fullSchedule) {
                        if (proposedStartTime < event.end && proposedEndTime > event.start) {
                            console.log(`[LOG] ---- CONFLITO DE AGENDA: O slot proposto (${proposedStartTime.toLocaleTimeString()} - ${proposedEndTime.toLocaleTimeString()}) conflita com um evento existente (${event.start.toLocaleTimeString()} - ${event.end.toLocaleTimeString()}).`);
                            hasConflict = true;
                            break;
                        }
                    }
                    
                    if (!hasConflict) {
                        console.log(`[LOG] ✅ SUCESSO! Slot encontrado para ${tech.name} às ${proposedStartTime.toLocaleTimeString()}`);
                        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                        const key = `${tech.name}|${dateStr}`;
                        
                        if (!allOptions.has(key)) {
                            allOptions.set(key, {
                                technician: tech.name,
                                restrictions: tech.restrictions || 'N/A',
                                date: dateStr,
                                availableSlots: [],
                            });
                        }
                        
                        const slotHour = String(proposedStartTime.getHours()).padStart(2, '0');
                        const slotMinute = String(proposedStartTime.getMinutes()).padStart(2, '0');
                        
                        allOptions.get(key).availableSlots.push({
                            time: `${slotHour}:${slotMinute}`,
                            travelTime: Math.round(travelFrom)
                        });
                    }
                }
            }
        }

        const sortedOptions = Array.from(allOptions.values())
            .filter(opt => opt.availableSlots.length > 0)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        console.log(`[LOG] FINAL: Retornando ${sortedOptions.length} opções de agendamento.`);
        return res.status(200).json({ success: true, options: sortedOptions });

    } catch (error) {
        console.error('CRITICAL ERROR in /api/find-availability:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred while finding availability.' });
    }
}
