const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Fungsi Kirim Notifikasi WA via Fonnte
async function sendWANotification(data) {
  const token = process.env.WA_GATEWAY_TOKEN;
  const target = process.env.NO_WA_BENDAHARA || '082115343686';

  if (!token) {
    console.error('WA_GATEWAY_TOKEN belum diatur di Vercel');
    return;
  }

  const message = 
`🔔 *NOTIFIKASI PEMBAYARAN LUNAS* 🔔\n\n` +
`Ada pembayaran baru masuk ke sistem:\n\n` +
`📌 *Order ID:* ${data.order_id}\n` +
`👤 *Nama:* ${data.nama}\n` +
`🏢 *Cabang:* ${data.cabang}\n` +
`📦 *Paket:* ${data.paket}\n` +
`💰 *Nominal:* Rp ${Number(data.gross_amount).toLocaleString('id-ID')}\n` +
`📱 *WA Pembayar:* ${data.whatsapp}\n\n` +
`_Status di database telah diperbarui menjadi *PAID*._`;

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        target: target,
        message: message
      })
    });
    const resData = await response.json();
    console.log('Fonnte Response:', resData);
  } catch (err) {
    console.error('Gagal mengirim WA via Fonnte:', err);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    let notification = req.body;
    if (typeof notification === 'string') {
      try { notification = JSON.parse(notification); } catch (e) { notification = {}; }
    }
    notification = notification || {};

    // 1. Verifikasi Signature Key dari Midtrans demi keamanan
    const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
    const hash = crypto.createHash('sha512')
      .update((notification.order_id || '') + (notification.status_code || '') + (notification.gross_amount || '') + serverKey)
      .digest('hex');

    if (hash !== notification.signature_key) {
      return res.status(400).json({ message: 'Invalid Signature' });
    }

    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;
    const fraudStatus = notification.fraud_status;

    let isSuccess = false;

    if (transactionStatus === 'capture') {
      if (fraudStatus === 'accept') isSuccess = true;
    } else if (transactionStatus === 'settlement') {
      isSuccess = true;
    }

    if (isSuccess && orderId) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        // 2. Update status pembayaran di Supabase menjadi 'paid'
        const { data, error } = await supabase
          .from('pembayaran')
          .update({ 
            status_pembayaran: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('order_id', orderId)
          .select()
          .single();

        if (error) {
          console.error('Error update status di Supabase:', error);
          throw error;
        }

        // 3. Kirim notifikasi WA ke Bendahara Pusat
        if (data) {
          await sendWANotification(data);
        }
      }
    }

    return res.status(200).json({ status: 'OK' });

  } catch (error) {
    console.error('Midtrans Callback Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

