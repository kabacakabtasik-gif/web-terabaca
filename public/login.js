window.openLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
};

window.closeLoginModal = function() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('secretLoginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!email || !password) {
      alert("Email dan password harus diisi!");
      return;
    }

    let userData = null;

    // --- TAHAP 1: Coba Backend API Serverless ---
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        userData = result.data;
      } else if (response.status === 401 || response.status === 400) {
        // Jika API merespon error login resmi, hentikan proses
        alert(result.message || "Email atau Password salah!");
        return;
      }
    } catch (apiError) {
      console.warn("API Serverless tidak merespon, mencoba fallback direct Supabase...", apiError);
    }

    // --- TAHAP 2: Fallback Direct ke Supabase Client ---
    if (!userData) {
      const sb = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
      if (sb && typeof sb.from === 'function') {
        try {
          const { data: dbCabang, error: dbErr } = await sb
            .from('data_cabang')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .maybeSingle();

          if (dbCabang) {
            // Lebih aman menggunakan kode_cabang atau role resmi
            const isPusat = dbCabang.kode_cabang === 'PST-01' || dbCabang.role === 'super_admin';
            userData = {
              email: email,
              role: isPusat ? 'super_admin' : 'admin_cabang',
              cabang: dbCabang.nama_cabang || dbCabang.cabang || 'Cabang',
              kode_cabang: dbCabang.kode_cabang || 'TSK-01',
              redirectUrl: isPusat ? 'admin.html' : 'admin_cabang.html'
            };
          }
        } catch (dbErr) {
          console.error("Fallback DB Error:", dbErr);
        }
      }
    }

    // --- TAHAP 3: Eksekusi Hasil Login ---
    if (userData) {
      const sessionData = {
        email: userData.email,
        role: userData.role,
        cabang: userData.cabang,
        kode_cabang: userData.kode_cabang,
        nama: userData.email.split('@')[0]
      };

      localStorage.setItem('user_session', JSON.stringify(sessionData));
      localStorage.setItem('user_terabaca', JSON.stringify(sessionData));
      sessionStorage.setItem('user_session', JSON.stringify(sessionData));

      window.location.href = userData.redirectUrl;
    } else {
      alert("Email atau Password salah / Akun tidak ditemukan!");
    }
  });
});