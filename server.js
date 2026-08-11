require('dotenv').config();
const express = require('express');
const cors = require('cors');
const midtransClient = require('midtrans-client');

const app = express();
app.use(cors());
app.use(express.json());

// Inisialisasi Midtrans Snap
const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY || 'Mid-server-EAtUEPxspPR8vrU4GC8qk9gT',
    clientKey: process.env.MIDTRANS_CLIENT_KEY || 'Mid-client-2-2L5XUm_r2zrd6p'
});

// Endpoint Transaksi Midtrans
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

module.exports = app;
