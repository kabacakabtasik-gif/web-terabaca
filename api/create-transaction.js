const { createClient } = require('@supabase/supabase-js');
const midtransClient = require('midtrans-client');

module.exports = async function handler(req, res) {
  // Set header agar respons selalu JSON
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Safe Body Parsing
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = {};
      }
    }
    body = body || {};

    const { nama, email, phone, whatsapp, cabang, nominal, gross_amount, paket, tipe_bayar, catatan } = body;

    // Nilai fallback
    const cleanNama = nama || 'Pelanggan';
    const cleanEmail = email || 'pelanggan@example.com';
    const cleanPhone = phone || whatsapp || '08123456789';
    const cleanCabang = cabang || 'Pusat';
    const cleanPaket = paket || 'Umum';
    const cleanNominal = Number(nominal || gross_amount) || 10000;
    const cleanTipeBayar = tipe_bayar || 'personal';
    const cleanCatatan = catatan || null;

    const orderId = 'TERA-' + Date.now();

    // 2. Simpan Data ke Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { error: dbError } = await supabase.from('pembayaran').insert([
          {
            order_id: orderId,
            nama: cleanNama,
            email: cleanEmail,
            whatsapp: cleanPhone,
            cabang: cleanCabang,
            paket: cleanPaket,
            gross_amount: cleanNominal,
            tipe_bayar: cleanTipeBayar,
            catatan: cleanCatatan,
            status_pembayaran: 'pending'
          }
        ]);
        if (dbError) {
          console.error('Supabase insert warning:', dbError.message);
        }
      } catch (dbErr) {
        console.error('Supabase warning:', dbErr.message);
      }
    }

    // 3. Buat Transaksi Midtrans Snap
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true' || process.env.NODE_ENV === 'production';
    const snap = new midtransClient.Snap({
      isProduction: isProduction,
      serverKey: process.env.MIDTRANS_SERVER_KEY || 'Mid-server-EAtUEPxspPR8vrU4GC8qk9gT',
      clientKey: process.env.MIDTRANS_CLIENT_KEY || 'Mid-client-2-2L5XUm_r2zrd6p'
    });

    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: cleanNominal
      },
      customer_details: {
        first_name: cleanNama,
        email: cleanEmail,
        phone: cleanPhone
      },
      item_details: [{
        id: cleanPaket.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50),
        price: cleanNominal,
        quantity: 1,
        name: `Paket TERABACA - ${cleanPaket}`.substring(0, 50)
      }],
      custom_field1: cleanCabang
    };

    const transaction = await snap.createTransaction(parameter);
    return res.status(200).json({ token: transaction.token, orderId: orderId });

  } catch (error) {
    console.error('Error Backend:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};