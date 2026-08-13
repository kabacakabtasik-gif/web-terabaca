import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase Server Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password harus diisi!' });
  }

  try {
    // 1. Verifikasi Login via Supabase Auth Native (Otomatis enkripsi & aman)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // 2. Jika Auth Gagal (Gagal login Supabase Auth), Cek fallback ke tabel data_cabang
    let isAuthSuccess = !authError && authData?.user;
    let userRole = 'admin_cabang';
    let userCabang = '';
    let redirectUrl = 'admin_cabang.html';

    // Cek apakah akun ini adalah Pusat (contoh: email mengandung pusat/admin utama)
    if (email.includes('pusat') || email.includes('admin@terabaca')) {
      userRole = 'super_admin';
      userCabang = 'ALL';
      redirectUrl = 'admin.html';
    }

    if (!isAuthSuccess) {
      // Fallback: Cek tabel data_cabang jika password di DB manual masih dipasang
      const { data: dbCabang, error: dbError } = await supabase
        .from('data_cabang')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single();

      if (dbError || !dbCabang) {
        return res.status(401).json({ 
          success: false, 
          message: 'Email atau password salah!' 
        });
      }

      userCabang = dbCabang.nama_cabang || dbCabang.cabang || 'Cabang';
    } else {
      // Jika berhasil via Supabase Auth, ambil info cabang dari tabel data_cabang
      const { data: dbCabang } = await supabase
        .from('data_cabang')
        .select('nama_cabang, cabang, penanggung_jawab')
        .eq('email', email)
        .maybeSingle();

      if (dbCabang) {
        userCabang = dbCabang.nama_cabang || dbCabang.cabang || 'Cabang';
      }
    }

    // 3. Response Berhasil (Session dinamis, bukan hardcode!)
    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        email: email,
        role: userRole,
        cabang: userCabang || (userRole === 'super_admin' ? 'ALL' : 'Cabang'),
        redirectUrl: redirectUrl
      }
    });

  } catch (error) {
    console.error("Login Server Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server internal: ' + error.message 
    });
  }
}