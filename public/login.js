/**
 * login.js - Script Penanganan Login Cabang TeraBaca
 */

// Fungsi untuk membuka & menutup Modal (jika digunakan di landing page)
window.openLoginModal = function () {
  const modal = document.getElementById('loginModal');
  if (modal) modal.style.display = 'flex';
};

window.closeLoginModal = function () {
  const modal = document.getElementById('loginModal');
  if (modal) modal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
  // Mencari Form Login (Mendukung ID 'login-form' maupun 'secretLoginForm')
  const loginForm = document.getElementById('login-form') || document.getElementById('secretLoginForm');
  if (!loginForm) return;

  // Hilangkan atribut inline 'onsubmit' di HTML jika ada untuk mencegah eksekusi ganda
  loginForm.removeAttribute('onsubmit');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btn = document.getElementById('btn-submit') || loginForm.querySelector('button[type="submit"]');
    const usernameInput = document.getElementById('username') || document.getElementById('loginEmail');
    const passwordInput = document.getElementById('password') || document.getElementById('loginPassword');

    const identifier = usernameInput?.value.trim();
    const password = passwordInput?.value;

    if (!identifier || !password) {
      alert("Email/Username dan Password wajib diisi!");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = "Memeriksa...";
    }

    let userData = null;

    // --- TAHAP 1: Kirim ke Backend Serverless API (/api/login) ---
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: identifier, 
          username: identifier, 
          password: password 
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        userData = result.user || result.data || { username: identifier };
      } else if (response.status === 401 || response.status === 400) {
        alert(result.message || "Email/Username atau Password salah!");
        resetButton(btn);
        return;
      }
    } catch (apiError) {
      console.warn("Backend API tidak merespon, mencoba fallback direct Supabase...", apiError);
    }

    // --- TAHAP 2: Fallback Direct Supabase Client (Jika API Luring) ---
    if (!userData) {
      const sb = window.supabaseClient || (typeof supabase !== 'undefined' ? supabase : null);
      if (sb && typeof sb.from === 'function') {
        try {
          // Cari berdasarkan email atau username
          const { data: dbCabang, error: dbErr } = await sb
            .from('data_cabang')
            .select('*')
            .or(`email.eq.${identifier},username.eq.${identifier}`)
            .eq('password', password)
            .maybeSingle();

          if (dbCabang) {
            const isPusat = dbCabang.kode_cabang === 'PST-01' || dbCabang.role === 'super_admin';
            userData = {
              email: dbCabang.email || identifier,
              username: dbCabang.username || identifier,
              role: isPusat ? 'super_admin' : 'admin_cabang',
              nama_cabang: dbCabang.nama_cabang || dbCabang.cabang || 'Cabang Utama',
              kode_cabang: dbCabang.kode_cabang || 'TSK-01',
              redirectUrl: isPusat ? 'admin.html' : 'admin_cabang.html'
            };
          }
        } catch (dbErr) {
          console.error("Fallback DB Error:", dbErr);
        }
      }
    }

    // --- TAHAP 3: Simpan Sesi & Redirect ---
    if (userData) {
      const sessionPayload = JSON.stringify(userData);
      
      // Simpan ke sessionStorage & localStorage untuk ketersediaan antarhalaman
      sessionStorage.setItem('user_cabang', sessionPayload);
      sessionStorage.setItem('user_session', sessionPayload);
      localStorage.setItem('user_terabaca', sessionPayload);

      const targetPage = userData.redirectUrl || 'admin_cabang.html';
      window.location.href = targetPage;
    } else {
      alert("Login gagal! Periksa kembali Email/Username dan Password Anda.");
      resetButton(btn);
    }
  });
});

function resetButton(btn) {
  if (btn) {
    btn.disabled = false;
    btn.innerText = "Masuk";
  }
}