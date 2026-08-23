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

  // Menerima identifier (bisa berupa email atau username)
  const identifier = (body.email || body.username || '').trim();
  const password = body.password;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Email/Username dan password harus diisi!' });
  }

  try {
    let authenticatedUser = null;

    // 1. Cek tabel data_cabang (Mendukung login via Email ATAU Username)
    const { data: dbCabang, error: dbErr } = await supabase
      .from('data_cabang')
      .select('*')
      .or(`email.eq.${identifier},username.eq.${identifier}`)
      .eq('password', password)
      .maybeSingle();

    if (dbCabang) {
      authenticatedUser = {
        email: dbCabang.email || identifier,
        username: dbCabang.username || identifier,
        nama_cabang: dbCabang.nama_cabang || dbCabang.cabang || 'Cabang Utama',
        kode_cabang: dbCabang.kode_cabang || 'TSK-01',
        role: dbCabang.role
      };
    } else {
      // 2. Fallback: Coba via Supabase Auth jika menggunakan Email
      if (identifier.includes('@')) {
        try {
          const { data: authData } = await supabase.auth.signInWithPassword({
            email: identifier,
            password: password
          });
          
          if (authData?.user) {
            authenticatedUser = {
              email: authData.user.email,
              username: authData.user.email.split('@')[0],
              nama_cabang: 'Cabang Utama',
              kode_cabang: '',
              role: 'admin_cabang'
            };
          }
        } catch (authErr) {
          console.warn("Auth Native Error:", authErr.message);
        }
      }
    }

    // Jika akun tidak ditemukan
    if (!authenticatedUser) {
      return res.status(401).json({ success: false, message: 'Email/Username atau password salah!' });
    }

    // Tentukan Role & Halaman Redirect
    const isPusat = 
      identifier.includes('pusat') || 
      identifier.includes('admin@terabaca') || 
      authenticatedUser.kode_cabang === 'PST-01' ||
      authenticatedUser.role === 'super_admin';

    const userRole = isPusat ? 'super_admin' : 'admin_cabang';
    const redirectUrl = isPusat ? 'admin.html' : 'admin_cabang.html';

    const userData = {
      email: authenticatedUser.email,
      username: authenticatedUser.username,
      role: userRole,
      nama_cabang: authenticatedUser.nama_cabang,
      cabang: authenticatedUser.nama_cabang,
      kode_cabang: authenticatedUser.kode_cabang,
      redirectUrl: redirectUrl
    };

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      user: userData, // Dikirim ke kunci 'user' dan 'data' untuk kompatibilitas frontend
      data: userData
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan server: ' + error.message });
  }
}