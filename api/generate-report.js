const { google } = require('googleapis');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Fungsi helper untuk autentikasi Google API (Lokal vs Vercel)
function getGoogleAuth() {
  const scopes = ['https://www.googleapis.com/auth/drive.file'];

  // 1. Cek apakah ada kredensial di Vercel Environment Variables
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      return new google.auth.GoogleAuth({
        credentials,
        scopes,
      });
    } catch (err) {
      console.error('Error parsing GOOGLE_CREDENTIALS env:', err);
    }
  }

  // 2. Fallback untuk Server Lokal: Membaca file credentials.json fisik
  const localKeyPath = path.join(process.cwd(), 'credentials.json');
  if (fs.existsSync(localKeyPath)) {
    return new google.auth.GoogleAuth({
      keyFile: localKeyPath,
      scopes,
    });
  }

  throw new Error('Kredensial Google Cloud tidak ditemukan di ENV maupun file credentials.json!');
}

module.exports = async (req, res) => {
  // Hanya izinkan method GET atau POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    // 1. Dapatkan Folder ID dari Environment Variable
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return res.status(500).json({
        success: false,
        message: 'GOOGLE_DRIVE_FOLDER_ID belum dikonfigurasi di file .env / Vercel!',
      });
    }

    // 2. Simulasi/Ambil Data Transaksi
    // (Nanti bagian ini bisa disesuaikan dengan koneksi database/Firestore/Supabase/Midtrans kamu)
    const dataTransaksi = req.body?.transactions || [
      {
        id: 'TRX-001',
        tanggal: new Date().toISOString().split('T')[0],
        namaSiswa: 'Budi Santoso',
        paket: 'Kelas Membaca Reguler',
        nominal: 150000,
        status: 'PAID',
      },
      {
        id: 'TRX-002',
        tanggal: new Date().toISOString().split('T')[0],
        namaSiswa: 'Siti Aminah',
        paket: 'Kelas Intensif',
        nominal: 250000,
        status: 'PAID',
      },
    ];

    // 3. Buat Workbook Excel Menggunakan ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Transaksi');

    // Setup Header Kolom
    worksheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'ID Transaksi', key: 'id', width: 18 },
      { header: 'Tanggal', key: 'tanggal', width: 15 },
      { header: 'Nama Siswa', key: 'namaSiswa', width: 25 },
      { header: 'Paket / Layanan', key: 'paket', width: 25 },
      { header: 'Nominal (Rp)', key: 'nominal', width: 18, style: { numFmt: '"Rp "#,##0' } },
      { header: 'Status Payment', key: 'status', width: 15 },
    ];

    // Format Header (Bold, Background Biru Gelap, Text Putih Center)
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A8A' }, // Warna Navy Blue
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Isi Data ke Sheet Excel
    let totalNominal = 0;
    dataTransaksi.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1,
        id: item.id,
        tanggal: item.tanggal,
        namaSiswa: item.namaSiswa,
        paket: item.paket,
        nominal: item.nominal,
        status: item.status,
      });
      totalNominal += item.nominal || 0;
    });

    // Tambahkan Baris Total di Paling Bawah
    const totalRow = worksheet.addRow({
      no: '',
      id: '',
      tanggal: '',
      namaSiswa: '',
      paket: 'TOTAL PENDAPATAN',
      nominal: totalNominal,
      status: '',
    });
    totalRow.font = { bold: true };
    worksheet.getCell(`F${totalRow.number}`).numFmt = '"Rp "#,##0';

    // Tambahkan Border Rapi di Seluruh Tabel
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'D1D5DB' } },
          left: { style: 'thin', color: { argb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
          right: { style: 'thin', color: { argb: 'D1D5DB' } },
        };
      });
    });

    // Convert Excel ke Buffer (In-Memory Buffer, Cocok untuk Serverless Vercel)
    const buffer = await workbook.xlsx.writeBuffer();

    // 4. Inisialisasi Google Drive API Client
    const auth = getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    // Format Nama File Excel (Contoh: Laporan_TERABACA_2026-08-19.xlsx)
    const todayStr = new Date().toISOString().split('T')[0];
    const fileName = `Laporan_TERABACA_${todayStr}.xlsx`;

    // Stream Buffer ke Google Drive Upload
    const { Readable } = require('stream');
    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(buffer),
    };

    // Upload File ke Google Drive
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const driveResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
    });

    // 5. Berikan Respon Sukses Ke Client / Admin
    return res.status(200).json({
      success: true,
      message: 'Laporan Excel berhasil dibuat dan terunggah ke Google Drive!',
      file: {
        id: driveResponse.data.id,
        name: driveResponse.data.name,
        link: driveResponse.data.webViewLink,
      },
    });
  } catch (error) {
    console.error('Error generating / uploading report:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat/mengunggah laporan Excel',
      error: error.message,
    });
  }
};