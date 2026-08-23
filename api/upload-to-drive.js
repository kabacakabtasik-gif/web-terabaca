import { google } from 'googleapis';
import { Readable } from 'stream';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // Tangkap fileData (atau fileBase64) dari body frontend
    const { fileName, fileData, fileBase64, mimeType } = req.body;
    const base64String = fileData || fileBase64;

    if (!fileName || !base64String) {
      return res.status(400).json({ success: false, message: 'fileName dan fileData/fileBase64 wajib diisi.' });
    }

    // Ambil Kredensial dari Env Variables terpisah
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Convert Base64 ke Buffer/Stream
    const pureBase64 = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    const buffer = Buffer.from(pureBase64, 'base64');
    
    const mediaStream = new Readable();
    mediaStream.push(buffer);
    mediaStream.push(null);

    const media = {
      mimeType: mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: mediaStream,
    };

    // Tentukan Folder Tujuan Wajib
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '1EjBesYcFuDLH2qWYycC2kJItpbJiywU_';
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
      supportsAllDrives: true,
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