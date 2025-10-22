// api/verify-sales-key.js
import dotenv from 'dotenv';

dotenv.config();

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { password: providedPassword } = request.body;
        const correctPassword = process.env.KEY_SALES;

        // Check if the environment variable is set
        if (!correctPassword) {
            console.error('SERVER ERROR: KEY_SALES environment variable is not set.');
            return response.status(500).json({ success: false, message: 'Server configuration error. Key not set.' });
        }

        // Validate if password was provided
        if (providedPassword === undefined || providedPassword === null) {
            return response.status(400).json({ success: false, message: 'Password is required.' });
        }

        // Compare the provided password with the environment variable
        if (String(providedPassword).trim() === String(correctPassword).trim()) {
            // Passwords match
            return response.status(200).json({ success: true });
        } else {
            // Passwords do not match
            return response.status(401).json({ success: false, message: 'Incorrect password.' });
        }

    } catch (error) {
        console.error('CRITICAL ERROR in /api/verify-sales-key:', error);
        return response.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
}
