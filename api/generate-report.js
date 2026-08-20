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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      return res.status(500).json({
        success: false,
        message: 'GOOGLE_DRIVE_FOLDER_ID belum dikonfigurasi di file .env / Vercel!',
      });
    }

    // Ambil data dari Body Request
    const dataTransaksi = req.body?.transactions || [
      {
        buktiTransfer: 'https://link-bukti-transfer.com/123.jpg',
        gambar: 'https://link-gambar.com/456.jpg',
        jenisPaket: 'Paket Tes Bakat',
        namaLengkap: 'Budi Santoso',
        noTestee: '', // 5. Dikosongkan saja tidak perlu diisi
        namaLembaga: 'SMA Negeri 1 Tasikmalaya',
        tempatLahir: 'Tasikmalaya',
        tanggalLahir: '2008-05-12',
        usia: '18 Tahun',
        tanggalTes: '2026-08-20',
        jenisKelamin: 'Laki-laki',
        levelPendidikan: 'SMA',
        jurusanSma: 'IPA',
        prosesMenggambar: 'Mandiri',
        kondisiKertas: 'Baik/Bersih',
        posisiKertas: 'Landscape',
        alatGambar: 'Pensil 2B',
        dominasiWarna: 'Merah',
        catatanGambar: 'Garis tegas, gambar di tengah',
        email: 'budi@example.com',
        paketBerbayarBonus: 'Berbayar',
        bentukKerjasama: 'Kolektif Sekolah',
        namaPenginput: 'Admin Cabang Tasik',
        noWhatsapp: '081234567890',
        cabang: 'Tasikmalaya',
        catatanKhusus: '-',
        pilihanJurusan: 'Teknik Informatika, Sistem Informasi, Manajemen'
      }
    ];

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan Cabang');

    // Setup Header 27 Kolom Presisi Sesuai Format Pusat
    worksheet.columns = [
      { header: 'Upload Bukti Transfer', key: 'col1', width: 25 },
      { header: 'Upload gambar', key: 'col2', width: 25 },
      { header: 'Jenis Paket', key: 'col3', width: 20 },
      { header: 'Nama Lengkap Testee', key: 'col4', width: 25 },
      { header: 'No Testee', key: 'col5', width: 15 },
      { header: 'Nama Lembaga/Institusi/Komunitas/umum', key: 'col6', width: 30 },
      { header: 'Tempat Lahir Testee', key: 'col7', width: 20 },
      { header: 'Tanggal lahir Testee', key: 'col8', width: 18 },
      { header: 'Usia Testee', key: 'col9', width: 15 },
      { header: 'Tanggal Tes', key: 'col10', width: 18 },
      { header: 'Jenis Kelamin', key: 'col11', width: 15 },
      { header: 'Level Pendidikan', key: 'col12', width: 18 },
      { header: 'Jurusan yang di jalani ketika di SMA/SMK*', key: 'col13', width: 25 },
      { header: 'Proses menggambar dibantu oleh', key: 'col14', width: 22 },
      { header: 'Kondisi kertas', key: 'col15', width: 18 },
      { header: 'Posisi kertas', key: 'col16', width: 18 },
      { header: 'Alat gambar', key: 'col17', width: 18 },
      { header: 'Dominasi Warna (*Merah = Hitam, cokelat, abu, dan gelap / *Biru = Semua warna terang)', key: 'col18', width: 35 },
      { header: 'Catatan terkait gambar (Temuan2 lainnya saat Testee menggambar)', key: 'col19', width: 35 },
      { header: 'Alamat e-mail.', key: 'col20', width: 25 },
      { header: 'Paket Berbayar/Bonus', key: 'col21', width: 20 },
      { header: 'Bentuk kerja sama', key: 'col22', width: 20 },
      { header: 'Nama Penginput', key: 'col23', width: 20 },
      { header: 'No Whatsapp yang bisa dihubungi', key: 'col24', width: 22 },
      { header: 'Cabang', key: 'col25', width: 18 },
      { header: 'Catatan khusus :', key: 'col26', width: 20 },
      { header: 'Sebutkan maksimal 3 Jurusan apa saja yang ingin dipilih/terlintas dalam fikiran', key: 'col27', width: 35 }
    ];

    // Format Header Excel (Bold, Text Putih, Navy Blue Background)
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E3A8A' },
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Mapping Data ke 27 Kolom
    dataTransaksi.forEach((item) => {
      worksheet.addRow({
        col1: item.buktiTransfer || '',
        col2: item.gambar || '',
        col3: item.jenisPaket || '',
        col4: item.namaLengkap || '',
        col5: '', // Dikosongkan sesuai instruksi Pusat
        col6: item.namaLembaga || '',
        col7: item.tempatLahir || '',
        col8: item.tanggalLahir || '',
        col9: item.usia || '',
        col10: item.tanggalTes || '',
        col11: item.jenisKelamin || '',
        col12: item.levelPendidikan || '',
        col13: item.jurusanSma || '-',
        col14: item.prosesMenggambar || '',
        col15: item.kondisiKertas || '',
        col16: item.posisiKertas || '',
        col17: item.alatGambar || '',
        col18: item.dominasiWarna || '',
        col19: item.catatanGambar || '',
        col20: item.email || '',
        col21: item.paketBerbayarBonus || '',
        col22: item.bentukKerjasama || '',
        col23: item.namaPenginput || '',
        col24: item.noWhatsapp || '',
        col25: item.cabang || '',
        col26: item.catatanKhusus || '-',
        col27: item.pilihanJurusan || '-'
      });
    });

    // Tambahkan Border Rapi
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

    const buffer = await workbook.xlsx.writeBuffer();

    // Inisialisasi Google Drive API Client
    const auth = getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    const todayStr = new Date().toISOString().split('T')[0];
    const fileName = `Laporan_Cabang_TERABACA_${todayStr}.xlsx`;

    const { Readable } = require('stream');
    const media = {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Readable.from(buffer),
    };

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const driveResponse = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink',
    });

    return res.status(200).json({
      success: true,
      message: 'Laporan Excel 27 Kolom berhasil diunggah ke Google Drive!',
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