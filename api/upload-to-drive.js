import { google } from 'googleapis';
import { Readable } from 'stream';

export default async function handler(req, res) {
    // Set CORS Header agar dapat dipanggil dari halaman frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { fileName, fileData, mimeType } = req.body;

        if (!fileName || !fileData) {
            return res.status(400).json({ success: false, message: 'fileName dan fileData wajib diisi.' });
        }

        // Autentikasi Google Service Account
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Ubah string Base64 menjadi Buffer/Stream
        const buffer = Buffer.from(fileData, 'base64');
        const mediaStream = new Readable();
        mediaStream.push(buffer);
        mediaStream.push(null);

        const fileMetadata = {
            name: fileName,
            parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : [],
        };

        const media = {
            mimeType: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            body: mediaStream,
        };

        const response = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, name, webViewLink',
        });

        return res.status(200).json({
            success: true,
            fileId: response.data.id,
            webViewLink: response.data.webViewLink,
        });

    } catch (error) {
        console.error('Drive Upload Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

export const config = {
    api: { bodyParser: { sizeLimit: '10mb' } },
};