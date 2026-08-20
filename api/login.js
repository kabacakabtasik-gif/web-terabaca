import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const { email, password } = body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email dan password harus diisi!' });
  }

  try {
    let authenticatedUser = null;

    // 1. Cek dulu ke tabel data_cabang (Fallback Manual DB)
    const { data: dbCabang } = await supabase
      .from('data_cabang')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .maybeSingle();

    if (dbCabang) {
      authenticatedUser = {
        email: dbCabang.email,
        cabang: dbCabang.nama_cabang || dbCabang.cabang,
        kode_cabang: dbCabang.kode_cabang
      };
    } else {
      // 2. Jika tidak ada di tabel, coba via Supabase Auth
      try {
        const { data: authData } = await supabase.auth.signInWithPassword({ email, password });
        if (authData?.user) {
          authenticatedUser = {
            email: authData.user.email,
            cabang: 'Cabang',
            kode_cabang: ''
          };
        }
      } catch (authErr) {
        console.warn("Auth Native Error (Abaikan jika user DB):", authErr.message);
      }
    }

    // Jika keduanya gagal
    if (!authenticatedUser) {
      return res.status(401).json({ success: false, message: 'Email atau password salah!' });
    }

    // Tentukan Role & Redirect
    const isPusat = email.includes('pusat') || email.includes('admin@terabaca') || authenticatedUser.kode_cabang === 'PST-01';
    const userRole = isPusat ? 'super_admin' : 'admin_cabang';
    const redirectUrl = isPusat ? 'admin.html' : 'admin_cabang.html';

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        email: authenticatedUser.email,
        role: userRole,
        cabang: authenticatedUser.cabang,
        kode_cabang: authenticatedUser.kode_cabang,
        redirectUrl: redirectUrl
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server: ' + error.message });
  }
}