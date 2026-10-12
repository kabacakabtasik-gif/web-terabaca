const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      success: false,
      message: 'Supabase credentials not configured in environment variables'
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lakukan query ringan untuk memicu aktivitas database Supabase
    const { data, error } = await supabase
      .from('data_cabang')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('Keep-alive query warning:', error.message);
      // Fallback query ke tabel pembayaran jika data_cabang ada kendala
      await supabase.from('pembayaran').select('id').limit(1);
    }

    const timestamp = new Date().toISOString();
    console.log(`[Keep-Alive] Supabase successfully pinged at ${timestamp}`);

    return res.status(200).json({
      success: true,
      message: 'Supabase keep-alive ping successful! Database remains active.',
      timestamp: timestamp
    });
  } catch (err) {
    console.error('[Keep-Alive Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
