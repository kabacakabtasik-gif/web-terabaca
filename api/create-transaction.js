const midtransClient = require('midtrans-client');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const snap = new midtransClient.Snap({
            isProduction: false, // Ubah true jika sudah live
            serverKey: process.env.MIDTRANS_SERVER_KEY || 'Mid-server-EAtUEPxspPR8vrU4GC8qk9gT',
            clientKey: process.env.MIDTRANS_CLIENT_KEY || 'Mid-client-2-2L5XUm_r2zrd6p'
        });

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
                id: (paket || 'TEST').toLowerCase(),
                price: Number(nominal),
                quantity: 1,
                name: `Paket Tes TERABACA - ${paket}`
            }],
            custom_field1: cabang
        };

        const transaction = await snap.createTransaction(parameter);
        return res.status(200).json({ token: transaction.token, orderId: orderId });

    } catch (error) {
        console.error('Error Midtrans:', error);
        return res.status(500).json({ error: error.message });
    }
};
