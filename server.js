require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const midtransClient = require('midtrans-client');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Menyajikan file statis dari root folder (karena tanpa folder public)
app.use(express.static(__dirname));

// Pastikan folder uploads ada untuk menyimpan berkas lembar coretan
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Database sementara (Array/Memory storage)
let dataPendaftar = [];

// Inisialisasi Midtrans Snap
const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || ''
});

// 1. Endpoint Membuat Token Pembayaran Midtrans
app.post('/api/create-transaction', async (req, res) => {
    try {
        const { nama, email, phone, cabang, nominal, paket } = req.body;
        const orderId = 'TERA-' + Date.now();

        const parameter = {
            transaction_details: {
                order_id: orderId,
                gross_amount: Number(nominal)
            },
            customer_details: {
                first_name: nama,
                email: email,
                phone: phone
            },
            item_details: [{
                id: paket.toLowerCase(),
                price: Number(nominal),
                quantity: 1,
                name: `Paket Tes TERABACA - ${paket}`
            }],
            custom_field1: cabang
        };

        const transaction = await snap.createTransaction(parameter);
        
        // Simpan draf transaksi awal
        dataPendaftar.push({
            orderId: orderId,
            namaPembayar: nama,
            email: email,
            phone: phone,
            cabang: cabang,
            paket: paket,
            nominal: nominal,
            statusBayar: 'Pending',
            tanggal: new Date().toISOString(),
            dataPeserta: null,
            fileCoretan: null
        });

        res.json({ token: transaction.token, orderId: orderId });

    } catch (error) {
        console.error('Error Midtrans:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Webhook Callback Notifikasi dari Midtrans (Otomatis Kirim WA)
app.post('/api/midtrans-notification', async (req, res) => {
    try {
        const statusResponse = await snap.transaction.notification(req.body);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
            if (fraudStatus == 'accept' || !fraudStatus) {
                // Update status di database internal
                const item = dataPendaftar.find(d => d.orderId === orderId);
                if (item) {
                    item.statusBayar = 'LUNAS';
                }

                // Kirim Notifikasi WA Otomatis ke Cabang & Pusat
                await kirimNotifikasiWA(orderId, statusResponse.gross_amount);
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Notification error:', error);
        res.status(500).send(error.message);
    }
});

// 3. Endpoint Simpan Form Pendaftaran & Lembar Coretan
app.post('/api/submit-pendaftaran', (req, res) => {
    try {
        const { orderId, namaAnak, ttl, jenisKelamin, sekolah, namaOrtu, waOrtu, fileCoretanBase64, namaFile } = req.body;

        let item = dataPendaftar.find(d => d.orderId === orderId);
        
        // Jika data belum ada, buat entri baru
        if (!item) {
            item = { orderId, statusBayar: 'LUNAS', tanggal: new Date().toISOString() };
            dataPendaftar.push(item);
        }

        // Simpan detail peserta
        item.dataPeserta = { namaAnak, ttl, jenisKelamin, sekolah, namaOrtu, waOrtu };

        // Simpan berkas jika ada
        if (fileCoretanBase64 && namaFile) {
            const fileName = `${orderId}-${Date.now()}-${namaFile}`;
            const filePath = path.join(uploadDir, fileName);
            const base64Data = fileCoretanBase64.replace(/^data:.*;base64,/, "");
            
            fs.writeFileSync(filePath, base64Data, 'base64');
            item.fileCoretan = `/uploads/${fileName}`;
        }

        res.json({ success: true, message: 'Data pendaftaran & berkas berhasil disimpan!' });
    } catch (err) {
        console.error('Error submit pendaftaran:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Endpoint Ambil Data untuk Dashboard Admin Cabang & Pusat
app.get('/api/admin/peserta', (req, res) => {
    const { cabang } = req.query;
    if (cabang && cabang !== 'Pusat') {
        const filtered = dataPendaftar.filter(d => d.cabang === cabang);
        return res.json(filtered);
    }
    res.json(dataPendaftar);
});

// Fungsi Kirim WA Otomatis via Fonnte API
async function kirimNotifikasiWA(orderId, nominal) {
    const fonnteToken = process.env.FONNTE_TOKEN;
    if (!fonnteToken) return;

    const pesan = `*PEMBAYARAN SUKSES - TERABACA*\n\nOrder ID: ${orderId}\nNominal: Rp ${Number(nominal).toLocaleString('id-ID')}\nStatus: LUNAS\n\nPeserta diarahkan untuk mengisi form pendaftaran & upload berkas.`;

    try {
        await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': fonnteToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: '08123456789', // Nomor WA Admin Cabang/Pusat
                message: pesan
            })
        });
    } catch (err) {
        console.error('Gagal kirim WA:', err);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server TERABACA berjalan di port ${PORT}`));
