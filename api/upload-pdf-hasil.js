require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const { batchId, fileName, fileBase64, driveUrl } = body;

  if (!batchId) {
    return res.status(400).json({ success: false, message: 'ID Batch target wajib disertakan.' });
  }

  try {
    // KASUS 1: Input Link Google Drive
    if (driveUrl && driveUrl.trim()) {
      const cleanDriveUrl = driveUrl.trim();
      const { error: updErr } = await supabase
        .from('batch_upload')
        .update({ hasil_pusat_url: cleanDriveUrl })
        .eq('id', batchId);

      if (updErr) throw updErr;

      return res.status(200).json({
        success: true,
        message: 'Tautan Google Drive hasil berhasil disimpan!',
        driveUrl: cleanDriveUrl
      });
    }

    // KASUS 2: Upload File PDF via Base64 (Bypass semua kendala izin mobile/anon)
    if (!fileName || !fileBase64) {
      return res.status(400).json({ success: false, message: 'Data file PDF (nama dan konten base64) belum lengkap.' });
    }

    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const fileBuffer = Buffer.from(cleanBase64, 'base64');

    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `batch_${batchId}/${Date.now()}_${cleanFileName}`;

    // Upload file ke storage hasil-pdf menggunakan hak akses admin
    const { data: uploadData, error: uploadErr } = await supabase
      .storage
      .from('hasil-pdf')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadErr) throw uploadErr;

    // Dapatkan Public URL
    const { data: pubData } = supabase
      .storage
      .from('hasil-pdf')
      .getPublicUrl(storagePath);

    const publicUrl = pubData.publicUrl;
    const newFileObj = { name: fileName, url: publicUrl };

    // Update data di tabel batch_upload
    const { data: bData } = await supabase
      .from('batch_upload')
      .select('hasil_pusat_url')
      .eq('id', batchId)
      .single();

    let existingFiles = [];
    if (bData && bData.hasil_pusat_url) {
      try {
        const parsed = JSON.parse(bData.hasil_pusat_url);
        if (Array.isArray(parsed)) existingFiles = parsed;
      } catch (e) {
        if (bData.hasil_pusat_url.startsWith('http')) {
          existingFiles = [{ name: 'Hasil Sebelumnya', url: bData.hasil_pusat_url }];
        }
      }
    }

    // Hindari duplikasi file dengan nama yang sama
    const filtered = existingFiles.filter(f => f.name !== fileName);
    const allFiles = [...filtered, newFileObj];

    const { error: batchUpdErr } = await supabase
      .from('batch_upload')
      .update({ hasil_pusat_url: JSON.stringify(allFiles) })
      .eq('id', batchId);

    if (batchUpdErr) throw batchUpdErr;

    return res.status(200).json({
      success: true,
      message: `File ${fileName} berhasil diunggah!`,
      file: newFileObj
    });

  } catch (error) {
    console.error('[Upload PDF Error]:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan saat memproses file di server.'
    });
  }
};
