require('dotenv').config();
const express = require('express');
const cors = require('cors');
const midtransClient = require('midtrans-client');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inisialisasi Midtrans Snap (Aman dari peringatan GitHub)
const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY || '',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || ''
});

// 1. Endpoint Membuat Snap Token Pembayaran
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
        res.json({ token: transaction.token, orderId: orderId });

    } catch (error) {
        console.error('Error Midtrans:', error);
        res.status(500).json({ error: error.message });
    }
});

// 2. Endpoint Callback Notifikasi Midtrans
app.post('/api/midtrans-notification', async (req, res) => {
    try {
        const statusResponse = await snap.transaction.notification(req.body);
        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        if (transactionStatus == 'capture' || transactionStatus == 'settlement') {
            if (fraudStatus == 'accept' || !fraudStatus) {
                await kirimNotifikasiWA(orderId, statusResponse.gross_amount);
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Notification error:', error);
        res.status(500).send(error.message);
    }
});

// Fungsi Pengiriman Notifikasi WA
async function kirimNotifikasiWA(orderId, nominal) {
    const fonnteToken = process.env.FONNTE_TOKEN;
    if (!fonnteToken) return;

    const pesan = `*PEMBAYARAN SUKSES - TERABACA*\n\nOrder ID: ${orderId}\nNominal: Rp ${Number(nominal).toLocaleString('id-ID')}\nStatus: LUNAS\n\nPeserta siap mengisi form pendaftaran & mengunggah berkas.`;

    try {
        await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': fonnteToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: '08123456789', // Nomor Admin Pusat / Cabang
                message: pesan
            })
        });
    } catch (err) {
        console.error('Gagal kirim WA:', err);
    }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server TERABACA berjalan di port ${PORT}`));
