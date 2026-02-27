// =========================================================================
// 1. FIREBASE CONFIGURATION (WAJIB GANTI DENGAN KODE PROJECT ANDA)
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBrbRkpbYszvLNYlTe2j6X1X2IGlLsxBKg",
        authDomain: "liverystudio-cbcc5.firebaseapp.com",
        projectId: "liverystudio-cbcc5",
        storageBucket: "liverystudio-cbcc5.firebasestorage.app",
        messagingSenderId: "207187493422",
        appId: "1:207187493422:web:c97229c4bd47639b7055bf"
    };

// Inisialisasi Firebase Database
let db;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
}

// =========================================================================
// 2. SISTEM DETEKSI IP & DEVICE (DISAMAKAN 100% DENGAN REGISTER.HTML)
// =========================================================================

// Mengambil IP dengan 3 Lapis Cadangan API agar tembus AdBlocker
async function getUserIP() {
    try {
        let response = await fetch('https://api.ipify.org?format=json');
        let data = await response.json();
        return data.ip;
    } catch (error1) {
        try {
            let response2 = await fetch('https://api.seeip.org/jsonip');
            let data2 = await response2.json();
            return data2.ip;
        } catch (error2) {
            try {
                let response3 = await fetch('https://ipapi.co/json/');
                let data3 = await response3.json();
                return data3.ip;
            } catch (error3) {
                return "Gagal mengambil IP";
            }
        }
    }
}

// Mengambil Merek HP yang spesifik
async function getDeviceModel() {
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        try {
            const uaData = await navigator.userAgentData.getHighEntropyValues(["model", "platform"]);
            if (uaData.model) return `${uaData.platform} - ${uaData.model}`;
        } catch (e) {}
    }
    
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return "Apple iPhone";
    if (/iPad/i.test(ua)) return "Apple iPad";
    if (/Macintosh/i.test(ua)) return "Apple Mac";
    
    const androidMatch = ua.match(/Android\s+[.\d]+;\s+([^;]+?)\s+Build/i) || ua.match(/Android\s+[.\d]+;\s+([^;]+?)\)/i);
    if (androidMatch && androidMatch[1]) {
        let model = androidMatch[1].trim();
        if (model.includes("wv")) model = model.replace("wv", "").trim();
        return `Android - ${model}`;
    }
    
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Linux/i.test(ua)) return "Linux PC";
    return "Unknown Device";
}

// =========================================================================
// 3. LOGIKA KEAMANAN LOGIN
// =========================================================================
async function attemptLogin() {
    const id = document.getElementById('loginId').value.trim();
    const pass = document.getElementById('loginPass').value;
    const msgBox = document.getElementById('loginMsg');
    
    // Ambil elemen tombol untuk diubah jadi animasi loading
    const loginBtn = document.querySelector('.btn-primary');

    if (!id || !pass) {
        msgBox.style.color = "var(--danger)";
        msgBox.innerText = "Mohon isi User ID dan Password terlebih dahulu!";
        return;
    }

    // UI Loading State (Mencegah user nge-klik berkali-kali)
    msgBox.style.color = "var(--border-focus)";
    msgBox.innerText = "Memeriksa izin Admin & Keamanan Perangkat...";
    loginBtn.disabled = true;
    loginBtn.innerText = "⏳ Memproses...";
    
    // Ambil data device saat ini
    const currentIp = await getUserIP();
    const currentDevice = await getDeviceModel();

    try {
        const userDoc = await db.collection("members").doc(id).get();
        
        if (!userDoc.exists) {
            msgBox.style.color = "var(--danger)";
            msgBox.innerText = "User ID tidak ditemukan. Silakan mendaftar.";
            resetBtn(loginBtn);
            return;
        }

        const userData = userDoc.data();

        // A. Pengecekan Password
        if (userData.password !== pass) {
            msgBox.style.color = "var(--danger)";
            msgBox.innerText = "Password yang Anda masukkan salah.";
            resetBtn(loginBtn);
            return;
        }

        // B. Pengecekan Status Akses Admin (Sangat Ketat)
        const status = userData.status || "pending"; 
        if (status === "pending") {
            msgBox.style.color = "var(--warning)";
            msgBox.innerText = "Akun Anda masih Pending. Harap tunggu persetujuan Admin.";
            resetBtn(loginBtn);
            return;
        }
        if (status === "banned") {
            msgBox.style.color = "var(--danger)";
            msgBox.innerText = "Akses Ditolak: Akun Anda telah di-BANNED oleh Admin.";
            resetBtn(loginBtn);
            return;
        }
        if (status === "expired") {
            msgBox.style.color = "#fca5a5"; // Warna merah muda untuk expired
            msgBox.innerText = "Akses Ditolak: Masa aktif VIP / Trial Anda telah habis.";
            resetBtn(loginBtn);
            return;
        }

        // C. Pengecekan IP & Device Binding (Anti-Share Akun)
        if (userData.ip !== currentIp) {
            msgBox.style.color = "var(--danger)";
            msgBox.innerText = `Akses Ditolak! IP berubah. (Terdaftar: ${userData.ip}, Anda: ${currentIp})`;
            resetBtn(loginBtn);
            return;
        }
        if (userData.device !== currentDevice) {
            msgBox.style.color = "var(--danger)";
            msgBox.innerText = `Akses Ditolak! HP/Device berbeda. Anda memakai: ${currentDevice}`;
            resetBtn(loginBtn);
            return;
        }

        // D. Jika Lolos Semua: Ubah Status di Database Menjadi ONLINE
        await db.collection("members").doc(id).update({
            isOnline: true
        });

        // Simpan sesi login di browser pengguna
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('username', id);
        
        msgBox.style.color = "var(--success)";
        msgBox.innerText = "Login Berhasil! Membuka Dashboard...";
        loginBtn.innerText = "✅ Berhasil";
        
        // Alihkan ke Dashboard
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1000);

    } catch (error) {
        console.error(error);
        msgBox.style.color = "var(--danger)";
        msgBox.innerText = "Gagal terhubung ke database. Periksa koneksi internet Anda.";
        resetBtn(loginBtn);
    }
}

// Fungsi kecil untuk mengembalikan tombol login seperti semula jika terjadi eror
function resetBtn(btn) {
    btn.disabled = false;
    btn.innerText = "Login ke Dashboard";
}


// =========================================================================
// 4. LOGIKA LOGOUT (Kembali Offline)
// =========================================================================
async function logoutUser() {
    const username = sessionStorage.getItem('username');
    if (username) {
        try {
            // Ubah status ke offline di Firestore sebelum logout
            await db.collection("members").doc(username).update({
                isOnline: false
            });
        } catch (error) {
            console.error("Gagal update status online:", error);
        }
    }
    
    // Hapus sesi lokal & kembalikan ke halaman login
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('username');
    window.location.href = 'index.html';
}


// =========================================================================
// 5. MOCKUP CONVERTER GTA V TO SA (Fitur Dashboard)
// =========================================================================
function convertFiles() {
    const handlingFile = document.getElementById('handlingV').files[0];
    const vehiclesFile = document.getElementById('vehiclesV').files[0];

    // Validasi apakah user sudah mengupload file
    if (!handlingFile || !vehiclesFile) {
        alert("⚠️ Harap upload kedua file (handling.meta dan vehicles.meta) terlebih dahulu!");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        // Output Dummy / Simulasi GTA SA
        const dummyHandlingSA = "; Konversi otomatis oleh Modder Tools\nELEGY       1500.0 3200.0 2.0 0.0 0.0 -0.15 70 0.85 0.85 0.47 5 200.0 24.0 10.0 R P 8.0 0.55 0 30.0 1.2 0.15 0.0 0.28 -0.15 0.5 0.3 0.25 0.27 35000 280010 4000000 1 1 0";
        const dummyVehiclesSA = "# Konversi kendaraan\n562, elegy, elegy, car, ELEGY, ELEGY, null, executive, 10, 0, 0, -1, 0.77, 0.77, 0";

        // Tampilkan ke layar
        document.getElementById('outputHandling').value = dummyHandlingSA;
        document.getElementById('outputVehicles').value = dummyVehiclesSA;
        
        alert("✅ Konversi Selesai! (Ini adalah format hasil simulasi)");
    };
    
    reader.readAsText(handlingFile);
}
