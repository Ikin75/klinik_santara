// js/app.js

// 1. IMPORT Semua Laci di Paling Atas
import { supabaseClient } from "./config.js";
import { handleLogin, handleLogout, checkSession } from "./auth.js";
import { renderSidebar, getEmptyState } from "./components.js";
import { getRegistrationHTML, initRegistration } from "./pendaftaran.js";
import {
  loadTriageQueue,
  getInputTTVHTML,
  attachTTVListeners,
} from "./perawat.js";
import {
  loadDoctorQueue,
  loadSOAPData,
  doctorCurrentRegistrationId,
} from "./dokter.js";
// IMPORT Laci Cetak Dokumen
import "./cetak.js";
import { loadMedicationManagement } from "./obat.js";
import { loadPharmacyQueue, loadPrescriptionDetail } from "./farmasi.js";
import { loadBillingQueue, loadBillingDetail } from "./kasir.js";
import { loadStatisticsDashboard } from "./statistik.js";
import { loadMasterCorporate } from "./master_corporate.js";
import { initSuperAdmin } from "./super-admin.js";

// 2. Variabel Global
let currentUser = null;
let userRole = null;
let clinicSettings = null;
let currentView = "registration";
// ... (biarkan variabel global lainnya di sini) ...

// 3. Fungsi Navigasi (Router)
window.navigateTo = function (view, data = null) {
  currentView = view;
  renderSidebar(currentView, userRole, clinicSettings);

  const mainContent = document.getElementById("main-content");
  const pageTitle = document.getElementById("page-title");

  if (view === "registration") {
    pageTitle.textContent = "Dashboard Pendaftaran";
    mainContent.innerHTML = getRegistrationHTML();
    initRegistration(currentUser, clinicSettings);
  }

  // --- MULAI PERUBAHAN PERAWAT DI SINI ---
  else if (view === "triage") {
    pageTitle.textContent = "Antrian Pasien (Menunggu TTV)";
    loadTriageQueue(currentUser); // Panggil fungsi dari perawat.js
  } else if (view === "input-ttv") {
    pageTitle.textContent = "Input Tanda-Tanda Vital";
    mainContent.innerHTML = getInputTTVHTML(data); // Render form HTML-nya
    attachTTVListeners(data.id, currentUser); // Aktifkan tombol simpannya
  } // --- MULAI PERUBAHAN DOKTER DI SINI ---
  else if (view === "doctor-queue") {
    pageTitle.textContent = "Antrian Pasien (Menunggu Dokter)";
    loadDoctorQueue(currentUser); // Panggil dari dokter.js
  } else if (view === "input-soap") {
    pageTitle.textContent = "Pemeriksaan & SOAP";
    loadSOAPData(data.id, currentUser); // Panggil dari dokter.js
  } else if (view === "pharmacy") {
    pageTitle.textContent = "Dashboard Farmasi";
    loadPharmacyQueue(currentUser);
  } else if (view === "process-prescription") {
    pageTitle.textContent = "Proses Resep";
    loadPrescriptionDetail(data);
  } else if (view === "billing") {
    pageTitle.textContent = "Kasir / Billing";
    loadBillingQueue(currentUser);
  } else if (view === "billing-detail") {
    pageTitle.textContent = "Buat Tagihan";
    loadBillingDetail(data);
  } else if (view === "medications") {
    pageTitle.textContent = "Manajemen Obat";
    loadMedicationManagement(currentUser);
  } else if (view === "statistics" || view === "dashboard-stats") {
    pageTitle.textContent = "Dashboard Statistik";
    loadStatisticsDashboard(currentUser);
  } else if (view === "master-corporate") {
    pageTitle.textContent = "Master Corporate";
    loadMasterCorporate(currentUser);
  } else if (view === "super-admin") {
    pageTitle.textContent = "🏢 Manajemen Klinik";
    initSuperAdmin();
  }
};

// 4. Logika Login
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  btn.textContent = "Memproses...";

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  const error = await handleLogin(email, password);

  if (error) {
    document.getElementById("login-error").textContent = error.message;
    document.getElementById("login-error").classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Masuk";
  } else {
    await checkAuth(); // Lanjut masuk ke dalam aplikasi
  }
});

// --- FUNGSI AUTENTIKASI & TAMPILAN (Tambahkan di bawah file app.js) ---

async function checkAuth() {
  // Panggil checkSession yang sudah kita import dari auth.js
  const session = await checkSession();

  if (session) {
    currentUser = session.user;
    await loadUserData();
    showDashboard();
  } else {
    showLogin();
  }
}

async function loadUserData() {
  try {
    // Ambil profile dulu
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    // Kalau berhasil, ambil data klinik terpisah
    if (profile && profile.clinic_id) {
      const { data: clinic } = await supabaseClient
        .from("clinics")
        .select("name, logo_url, primary_color, secondary_color")
        .eq("id", profile.clinic_id)
        .single();

      // Gabungkan
      profile.clinics = clinic;
    }

    if (error || !profile) {
      alert("Akun tidak memiliki profil klinik.");
      await handleLogout();
      showLogin();
      return;
    }

    const { data: settings } = await supabaseClient
      .from("clinic_settings")
      .select("*")
      .eq("clinic_id", profile.clinic_id)
      .single();

    clinicSettings = settings || {
      use_nurse_triage: true,
      has_internal_pharmacy: true,
    };

    userRole = profile.role;
    window.userRole = userRole;
    window.clinicSettings = clinicSettings;
    window.currentUser = currentUser;
    const clinicName =
      profile.clinics?.name || profile.clinic_id || "Super Admin";
    document.getElementById("user-role-badge").textContent =
      `Role: ${userRole} | ${clinicName}`;
    // ============================================
    // 🎨 LOAD THEME DARI CLINIC
    // ============================================
    try {
      const { applyClinicTheme } = await import("./theme.js");

      // Ambil data klinik lengkap
      const { data: clinicData } = await supabaseClient
        .from("clinics")
        .select("*")
        .eq("id", profile.clinic_id)
        .single();

      if (clinicData) {
        applyClinicTheme(clinicData);
        console.log("✅ Theme loaded:", clinicData.name);
      }
    } catch (themeError) {
      console.warn("⚠️ Gagal load theme:", themeError.message);
    }
    // ============================================
  } catch (err) {
    alert("Error: " + err.message);
    await handleLogout();
    showLogin();
  }
}

function showLogin() {
  document.getElementById("login-view").classList.remove("hidden");
  document.getElementById("dashboard-view").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("dashboard-view").classList.remove("hidden");

  // Render menu samping sesuai role
  renderSidebar(currentView, userRole, clinicSettings);

  // Buka halaman pendaftaran sebagai halaman pertama
  window.navigateTo("registration");
}

window.handlePrintClick = async function () {
  console.log("🖨️ Tombol cetak diklik");

  // Gunakan ID Registrasi yang disimpan di global saat loadSOAPData dipanggil
  const regId = window.currentRegistrationId;

  // Cek apakah SOAP sudah tersimpan
  const { data: existingSOAP } = await supabaseClient
    .from("medical_records")
    .select("id")
    .eq("registration_id", regId)
    .maybeSingle();

  if (!existingSOAP) {
    alert("Simpan data SOAP terlebih dahulu sebelum mencetak!");
    return;
  }

  // 🛠️ PERBAIKAN DI SINI: Gunakan window. dan masukkan regId ke dalam kurung
  if (window.loadPrintDataAndOpenModal) {
    await window.loadPrintDataAndOpenModal(regId);
  } else {
    alert("Sistem cetak belum siap atau file cetak.js belum dimuat.");
  }
};

// ============================================
// LOGOUT HANDLER
// ============================================
document.getElementById("btn-logout").addEventListener("click", async () => {
  const confirmLogout = confirm("Apakah Anda yakin ingin keluar?");
  if (!confirmLogout) return;

  try {
    await handleLogout();
  } catch (error) {
    console.error("Logout error:", error);
    // Force logout anyway
    localStorage.clear();
    window.location.reload();
  }
});

// LOGOUT
document.getElementById("btn-logout").addEventListener("click", async () => {
  if (confirm("Yakin keluar?")) {
    await handleLogout();
  }
});

checkAuth();
