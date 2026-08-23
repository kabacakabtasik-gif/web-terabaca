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

    const pureBase64 = base64Content.includes(',') ? base64Content.split(',')[1] : base64Content;
    const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

    if (!APPS_SCRIPT_URL) {
      return res.status(500).json({ 
        success: false, 
        message: 'GOOGLE_APPS_SCRIPT_URL belum diisi di Environment Variables Vercel.' 
      });
    }

    // Mengirim request ke Apps Script dengan instruksi wajib follow redirect
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: fileName,
        fileData: pureBase64
      }),
      redirect: 'follow'
    });

    const textResponse = await response.text();

    let result;
    try {
      result = JSON.parse(textResponse);
    } catch (e) {
      console.error("Non-JSON Response from Apps Script:", textResponse);
      return res.status(500).json({ 
        success: false, 
        message: 'Apps Script mengembalikan HTML. Pastikan opsi akses di Google Apps Script sudah diatur ke "Anyone" (Siapa saja).' 
      });
    }

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
