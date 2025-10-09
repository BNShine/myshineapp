import dotenv from 'dotenv';

dotenv.config();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { password } = req.body;
        const serverKey = process.env.F_KEY;

        if (!serverKey) {
            console.error('SERVER ERROR: F_KEY environment variable is not set.');
            return res.status(500).json({ success: false, message: 'Server configuration error.' });
        }

        if (!password) {
            return res.status(400).json({ success: false, message: 'Password is required.' });
        }

        if (password === serverKey) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }

    } catch (error) {
        console.error('CRITICAL ERROR in /api/verify-fkey:', error);
        return res.status(500).json({ success: false, message: 'An internal server error occurred.' });
    }
}
