export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { fileName, fileData, fileBase64 } = req.body;
    const base64Content = fileData || fileBase64;

    if (!fileName || !base64Content) {
      return res.status(400).json({ success: false, message: 'Data file tidak ditemukan.' });
    }

    // Membersihkan prefix data URL jika ada
    const pureBase64 = base64Content.includes(',') ? base64Content.split(',')[1] : base64Content;

    // Mengambil URL Google Apps Script dari Environment Variable Vercel
    const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

    if (!APPS_SCRIPT_URL) {
      return res.status(500).json({ 
        success: false, 
        message: 'GOOGLE_APPS_SCRIPT_URL belum dikonfigurasi di Environment Variables Vercel.' 
      });
    }

    // Mengirimkan request ke Apps Script
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: fileName,
        fileData: pureBase64
      })
    });

    const result = await response.json();

    if (result.success) {
      return res.status(200).json({
        success: true,
        fileId: result.fileId,
        webViewLink: result.webViewLink
      });
    } else {
      return res.status(500).json({ success: false, message: result.message || 'Gagal upload via Apps Script' });
    }

  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};