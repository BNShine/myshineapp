// api/get-travel-time.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { originZip, destinationZip } = req.body;
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ success: false, message: 'Server configuration error: API key is missing.' });
        }

        if (!originZip || !destinationZip) {
            return res.status(400).json({ success: false, message: 'Origin and destination are required.' });
        }

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=zip%20${originZip}&destinations=zip%20${destinationZip}&key=${apiKey}`;

        const apiResponse = await fetch(url);
        const data = await apiResponse.json();

        if (data.status !== 'OK' || !data.rows[0].elements[0].duration) {
            console.warn(`Google Maps API could not calculate travel time between ${originZip} and ${destinationZip}. Status: ${data.status}`);
            // Retorna 0 se não encontrar, para não quebrar o cálculo
            return res.status(200).json({ success: true, travelTimeInMinutes: 0 });
        }
        
        const travelTimeInMinutes = Math.round(data.rows[0].elements[0].duration.value / 60);
        return res.status(200).json({ success: true, travelTimeInMinutes });

    } catch (error) {
        console.error('CRITICAL ERROR in /api/get-travel-time:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
}
