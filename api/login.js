export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, password } = req.body;

  try {
    // 1. DATA USER DUMMY (Bisa diganti koneksi Database/Supabase nanti)
    const users = [
      {
        id: 1,
        email: 'pusat@terabaca.com',
        password: 'adminpusatpass',
        role: 'super_admin',
        cabang: 'ALL',
        redirectUrl: 'admin_pusat.html'
      },
      {
        id: 2,
        email: 'kab.tasikmalaya@terabaca.com',
        password: 'password123',
        role: 'admin_cabang',
        cabang: 'Kab. Tasikmalaya', // <-- SAMAKAN DENGAN TEKS CABANG
        redirectUrl: 'admin_cabang.html' // <-- HAPUS PARAMETER ?cabang_id=...
      },
      {
        id: 3,
        email: 'admin@terabaca.com',
        password: 'adminpass',
        role: 'admin_monitor',
        cabang: 'PUSAT',
        redirectUrl: 'admin.html'
      }
    ];

    // 2. Cek email & password
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Email atau password salah!' 
      });
    }

    // 3. Response Berhasil
    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        email: user.email,
        role: user.role,
        cabang: user.cabang,
        redirectUrl: user.redirectUrl
      }
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Terjadi kesalahan server internal' 
    });
  }
}