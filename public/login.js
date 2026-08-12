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

        try {
            // Nembak backend API
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            // Jika email/password tidak ada di list api/login.js
            if (!response.ok || !result.success) {
                alert(result.message || "Akses Ditolak!");
                return;
            }

            // Simpan Sesi
            const userData = result.data;
            const sessionData = {
                email: userData.email,
                role: userData.role,
                cabang: userData.cabang,
                nama: userData.email.split('@')[0]
            };

            localStorage.setItem('user_session', JSON.stringify(sessionData));
            sessionStorage.setItem('user_session', JSON.stringify(sessionData));

            // Pindah sesuai redirectUrl dari API
            window.location.href = userData.redirectUrl;

        } catch (error) {
            console.error("Error:", error);
            alert("Gagal terhubung ke API server login.");
        }
    });
});