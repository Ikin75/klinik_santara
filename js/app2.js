// js/app.js
import { supabaseClient } from "./config2.js";
import { renderSidebar, getEmptyState } from "./components.js";

// --- GLOBAL VARIABLES & STATE ---
let currentUser = null;
let userRole = null;
let clinicSettings = null;
let currentView = "registration";
let currentRegistrationId = null;
let prescriptionItemCount = 0;

// ========================================
// HELPER FUNCTIONS (TARUH DI SINI)
// ========================================

// Fungsi convert UTC ke WIB (Waktu Indonesia Barat)
function convertToWIB(utcDate) {
  if (!utcDate) return new Date();

  const date = new Date(utcDate);
  // Convert ke WIB (UTC+7)
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
}

// Format tanggal Indonesia dengan WIB
function formatDateID(date) {
  const wibDate = convertToWIB(date);
  return wibDate.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Format tanggal pendek Indonesia
function formatDateShort(date) {
  const wibDate = convertToWIB(date);
  return wibDate.toLocaleDateString("id-ID");
}

// Format waktu Indonesia
function formatTimeID(date) {
  const wibDate = convertToWIB(date);
  return wibDate.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Generate nomor antrean otomatis
async function generateQueueNumber(poly) {
  const today = new Date().toISOString().split("T")[0];

  let prefix = "A";
  if (poly.includes("Gigi")) prefix = "B";
  if (poly.includes("Anak")) prefix = "C";

  const { data: profileData } = await supabaseClient
    .from("profiles")
    .select("clinic_id")
    .eq("id", currentUser.id)
    .single();

  const { count } = await supabaseClient
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", profileData.clinic_id)
    .eq("target_poly", poly)
    .gte("created_at", today);

  const number = String((count || 0) + 1).padStart(3, "0");
  return `${prefix}-${number}`;
}

// --- INIT & AUTH ---
async function checkAuth() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
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
    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("*, clinics(name)")
      .eq("id", currentUser.id)
      .single();
    if (error || !profile) {
      alert("Akun tidak memiliki profil klinik.");
      await handleLogout();
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
    document.getElementById("user-role-badge").textContent =
      `Role: ${userRole} | ${profile.clinics.name}`;
  } catch (err) {
    alert("Error: " + err.message);
    await handleLogout();
  }
}

function showLogin() {
  document.getElementById("login-view").classList.remove("hidden");
  document.getElementById("dashboard-view").classList.add("hidden");
}

function showDashboard() {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("dashboard-view").classList.remove("hidden");
  renderSidebar(currentView, userRole, clinicSettings);
  navigateTo("registration");
}

// --- ROUTING ---
window.navigateTo = function (view, data = null) {
  currentView = view;
  renderSidebar(currentView, userRole, clinicSettings);
  const mainContent = document.getElementById("main-content");
  const pageTitle = document.getElementById("page-title");

  if (view === "registration") {
    pageTitle.textContent = "Dashboard Pendaftaran";
    mainContent.innerHTML = getRegistrationHTML();
    attachRegistrationListeners();
  } else if (view === "dashboard-stats") {
    pageTitle.textContent = "Dashboard Statistik";
    loadDashboardStats();
  } else if (view === "triage") {
    pageTitle.textContent = "Antrian Pasien (Menunggu TTV)";
    loadTriageQueue();
  } else if (view === "input-ttv") {
    pageTitle.textContent = "Input TTV Pasien";
    mainContent.innerHTML = getInputTTVHTML(data);
    attachTTVListeners(data.id);
  } else if (view === "doctor-queue") {
    pageTitle.textContent = "Antrian Pasien (Menunggu Dokter)";
    loadDoctorQueue();
  } else if (view === "input-soap") {
    pageTitle.textContent = "Pemeriksaan & SOAP";
    loadSOAPData(data.id);
  } else if (view === "pharmacy") {
    pageTitle.textContent = "Dashboard Farmasi";
    loadPharmacyQueue();
  } else if (view === "process-prescription") {
    pageTitle.textContent = "Proses Resep";
    loadPrescriptionDetail(data);
  } else if (view === "billing") {
    pageTitle.textContent = "Kasir / Billing";
    loadBillingQueue();
  } else if (view === "billing-detail") {
    pageTitle.textContent = "Buat Tagihan";
    loadBillingDetail(data);
  } else if (view === "medications") {
    pageTitle.textContent = "Manajemen Obat";
    loadMedicationsPage();
  } else if (view === "billing") {
    // ... existing code ...
  }
};

// --- HALAMAN: PENDAFTARAN ---
function getRegistrationHTML() {
  return `
    <div class="max-w-4xl mx-auto fade-in">
      <!-- Tab Switcher -->
      <div class="flex gap-2 mb-6 bg-white dark:bg-darkCard p-2 rounded-xl border border-gray-200 dark:border-gray-800">
        <button id="tab-search" onclick="window.switchRegTab('search')" class="flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition bg-primary text-white flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          Cari Pasien Terdaftar
        </button>
        <button id="tab-new" onclick="window.switchRegTab('new')" class="flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          Daftar Pasien Baru
        </button>
      </div>

      <!-- TAB 1: SEARCH PASIEN -->
      <div id="tab-content-search" class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          Cari Pasien untuk Didaftarkan
        </h3>
        
        <div class="relative mb-4">
          <input type="text" id="search-patient-input" class="w-full px-4 py-3 pl-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary outline-none transition" placeholder="Ketik NIK atau Nama Pasien...">
          <svg class="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>

        <div id="search-results" class="space-y-2 max-h-96 overflow-y-auto">
          <div class="text-center py-8 text-gray-500">
            <svg class="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            <p class="text-sm">Ketik minimal 2 karakter untuk mencari</p>
          </div>
        </div>

        <!-- Form Kunjungan (muncul setelah pilih pasien) -->
        <div id="visit-form" class="hidden mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
            <p class="text-sm font-medium text-blue-700 dark:text-blue-400">Pasien Terpilih:</p>
            <p id="selected-patient-info" class="font-bold text-gray-900 dark:text-gray-100"></p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Poli *</label>
              <select id="visit-poly" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none">
                <option value="">-- Pilih Poli --</option>
                <option value="Poli Umum">Poli Umum</option>
                <option value="Poli Gigi">Poli Gigi</option>
                <option value="Poli Anak">Poli Anak</option>
              </select>
            </div>
          </div>
          <div class="mt-4">
            <label class="block text-sm font-medium mb-1">Keluhan Utama *</label>
            <textarea id="visit-complaint" rows="3" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" placeholder="Contoh: Sakit perut sejak 2 hari"></textarea>
          </div>
          <button id="btn-submit-visit" class="mt-4 w-full bg-primary hover:bg-primaryHover text-white font-semibold py-3 rounded-lg transition">
            Daftarkan Kunjungan
          </button>
          <p id="visit-message" class="text-sm hidden mt-2"></p>
        </div>
      </div>

      <!-- TAB 2: DAFTAR PASIEN BARU -->
      <div id="tab-content-new" class="hidden bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
          Formulir Pasien Baru (Lengkap)
        </h3>
        
        <form id="new-patient-form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Nama Lengkap *</label>
              <input type="text" id="new-name" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">NIK</label>
              <input type="text" id="new-nik" maxlength="16" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" placeholder="16 digit">
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">Tanggal Lahir *</label>
              <input type="date" id="new-dob" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Jenis Kelamin *</label>
              <select id="new-gender" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none">
                <option value="">-- Pilih --</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">No. Handphone</label>
              <input type="tel" id="new-phone" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Alamat Lengkap</label>
            <textarea id="new-address" rows="2" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" placeholder="Jalan, RT/RW, Kelurahan, Kecamatan"></textarea>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label class="block text-sm font-medium mb-1">Poli *</label>
              <select id="new-poly" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none">
                <option value="">-- Pilih Poli --</option>
                <option value="Poli Umum">Poli Umum</option>
                <option value="Poli Gigi">Poli Gigi</option>
                <option value="Poli Anak">Poli Anak</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Keluhan Utama *</label>
            <textarea id="new-complaint" rows="3" required class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none"></textarea>
          </div>

          <button type="submit" id="btn-submit-new" class="w-full bg-primary hover:bg-primaryHover text-white font-semibold py-3 rounded-lg transition">
            Simpan Pasien & Daftarkan Kunjungan
          </button>
          <p id="new-message" class="text-sm hidden mt-2"></p>
        </form>
      </div>
    </div>
  `;
}

// --- HALAMAN: TTV (LENGKAP) ---
async function loadTriageQueue() {
  const mainContent = document.getElementById("main-content");
  const { data: profileData } = await supabaseClient
    .from("profiles")
    .select("clinic_id")
    .eq("id", currentUser.id)
    .single();

  const { data: regs, error } = await supabaseClient
    .from("registrations")
    .select(
      "id, queue_number, complaint, target_poly, created_at, patients(full_name)",
    )
    .eq("clinic_id", profileData.clinic_id)
    .eq("status", "waiting_triage")
    .order("created_at", { ascending: true }); // Urutkan berdasarkan waktu daftar

  if (error || regs.length === 0) {
    mainContent.innerHTML = getEmptyState("Belum ada pasien menunggu TTV.");
    return;
  }

  mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">${regs
    .map(
      (r) => `
    <div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-md" onclick='window.navigateTo("input-ttv", ${JSON.stringify(r)})'>
      <div class="flex justify-between items-start mb-3">
        <span class="px-3 py-1 text-sm font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded">${r.queue_number}</span>
        <span class="text-xs text-gray-500">${formatTimeID(r.created_at)}</span>
      </div>
      <h4 class="font-bold text-lg">${r.patients.full_name}</h4>
      <p class="text-sm text-gray-500 mt-1">${r.complaint}</p>
      <button class="mt-3 text-xs font-semibold text-primary">Input TTV &rarr;</button>
    </div>
  `,
    )
    .join("")}</div>`;
}

function getInputTTVHTML(reg) {
  return `<div class="max-w-2xl mx-auto fade-in">
    <button onclick="window.navigateTo('triage')" class="mb-4 text-sm text-gray-500 flex items-center gap-1 hover:text-primary transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> Kembali ke Antrian
    </button>
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-xl font-bold">${reg.patients.full_name}</h3>
          <p class="text-sm text-gray-500">No. Antrian: <span class="font-bold text-primary">${reg.queue_number}</span> | Poli: ${reg.target_poly}</p>
        </div>
        <span class="px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full">Menunggu TTV</span>
      </div>
      <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keluhan Utama (Dari Pendaftaran):</p>
        <p class="text-gray-900 dark:text-gray-100">${reg.complaint}</p>
      </div>
    </div>
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
      <h4 class="font-semibold mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        Input TTV & Catatan
      </h4>
      <form id="ttv-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm mb-1">Tensi (mmHg)</label>
            <div class="flex gap-2">
              <input type="number" id="sys-bp" class="w-full px-3 py-2 rounded border dark:bg-gray-900 dark:border-gray-700" placeholder="120">
              <span class="flex items-center text-gray-500">/</span>
              <input type="number" id="dia-bp" class="w-full px-3 py-2 rounded border dark:bg-gray-900 dark:border-gray-700" placeholder="80">
            </div>
          </div>
          <div>
            <label class="block text-sm mb-1">Nadi (x/menit)</label>
            <input type="number" id="heart-rate" class="w-full px-3 py-2 rounded border dark:bg-gray-900 dark:border-gray-700" placeholder="80">
          </div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div><label class="block text-sm mb-1">Suhu (°C)</label><input type="number" step="0.1" id="temperature" class="w-full px-3 py-2 rounded border dark:bg-gray-900 dark:border-gray-700" placeholder="36.5"></div>
          <div><label class="block text-sm mb-1">BB (kg)</label><input type="number" step="0.1" id="weight" class="w-full px-3 py-2 rounded border dark:bg-gray-900 dark:border-gray-700" placeholder="60"></div>
          <div><label class="block text-sm mb-1">TB (cm)</label><input type="number" id="height" class="w-full px-3 py-2 rounded border dark:bg-gray-900 dark:border-gray-700" placeholder="170"></div>
        </div>
        <div>
          <label class="block text-sm mb-1">Catatan Tambahan Perawat</label>
          <textarea id="ttv-notes" rows="2" class="w-full px-3 py-2 rounded border dark:bg-gray-900 dark:border-gray-700" placeholder="Catatan tambahan..."></textarea>
        </div>
        <button type="submit" class="bg-primary hover:bg-primaryHover text-white font-semibold py-2 px-6 rounded-lg transition w-full">Simpan & Kirim ke Dokter</button>
      </form>
    </div>
  </div>`;
}

function attachTTVListeners(regId) {
  document.getElementById("ttv-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    try {
      await supabaseClient.from("vital_signs").insert([
        {
          registration_id: regId,
          checked_by: currentUser.id,
          systolic_bp: document.getElementById("sys-bp").value || null,
          diastolic_bp: document.getElementById("dia-bp").value || null,
          heart_rate: document.getElementById("heart-rate").value || null,
          temperature: document.getElementById("temperature").value || null,
          weight: document.getElementById("weight").value || null,
          height: document.getElementById("height").value || null,
          notes: document.getElementById("ttv-notes").value || null,
        },
      ]);
      await supabaseClient
        .from("registrations")
        .update({ status: "waiting_doctor" })
        .eq("id", regId);

      alert("✅ TTV Tersimpan! Pasien dikirim ke Dokter.");
      window.navigateTo("triage");
    } catch (err) {
      alert(" Gagal: " + err.message);
      btn.disabled = false;
      btn.textContent = "Simpan & Kirim ke Dokter";
    }
  });
}

// --- HALAMAN: DOKTER / SOAP (LENGKAP) ---
async function loadDoctorQueue() {
  const mainContent = document.getElementById("main-content");
  const { data: profileData } = await supabaseClient
    .from("profiles")
    .select("clinic_id")
    .eq("id", currentUser.id)
    .single();
  const { data: regs, error } = await supabaseClient
    .from("registrations")
    .select(
      "id, queue_number, complaint, target_poly, created_at, patients(full_name)",
    )
    .eq("clinic_id", profileData.clinic_id)
    .eq("status", "waiting_doctor")
    .order("created_at", { ascending: true });

  if (error || regs.length === 0) {
    mainContent.innerHTML = getEmptyState("Belum ada pasien menunggu Dokter.");
    return;
  }

  mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">${regs
    .map(
      (r) => `
    <div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-md" onclick='window.navigateTo("input-soap", ${JSON.stringify(r)})'>
  <div class="flex justify-between items-start mb-2">
    <span class="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">${r.queue_number}</span>
    <span class="text-xs text-gray-500">${formatTimeID(r.created_at)}</span>
  </div>
  <h4 class="font-bold">${r.patients.full_name}</h4>
  <p class="text-sm text-gray-500">${r.complaint}</p>
  <button class="mt-3 text-xs font-semibold text-primary">Periksa (SOAP) &rarr;</button>
</div>`,
    )
    .join("")}</div>`;
}

async function loadSOAPData(regId) {
  currentRegistrationId = regId;
  const mainContent = document.getElementById("main-content");

  const { data: reg } = await supabaseClient
    .from("registrations")
    .select("*, patients(full_name)")
    .eq("id", regId)
    .single();
  const { data: ttv } = await supabaseClient
    .from("vital_signs")
    .select("*")
    .eq("registration_id", regId)
    .single();

  const ttvHTML = ttv
    ? `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
      <div class="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg"><p class="text-xs text-gray-500">Tensi</p><p class="font-bold">${ttv.systolic_bp || "-"}/${ttv.diastolic_bp || "-"} <span class="text-xs font-normal">mmHg</span></p></div>
      <div class="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg"><p class="text-xs text-gray-500">Nadi</p><p class="font-bold">${ttv.heart_rate || "-"} <span class="text-xs font-normal">x/mnt</span></p></div>
      <div class="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg"><p class="text-xs text-gray-500">Suhu</p><p class="font-bold">${ttv.temperature || "-"} <span class="text-xs font-normal">°C</span></p></div>
      <div class="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg"><p class="text-xs text-gray-500">BB</p><p class="font-bold">${ttv.weight || "-"} <span class="text-xs font-normal">kg</span></p></div>
      <div class="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg"><p class="text-xs text-gray-500">TB</p><p class="font-bold">${ttv.height || "-"} <span class="text-xs font-normal">cm</span></p></div>
    </div>
    ${ttv.notes ? `<div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg mb-4"><p class="text-xs font-medium text-yellow-800 dark:text-yellow-400">Catatan Perawat:</p><p class="text-sm">${ttv.notes}</p></div>` : ""}
  `
    : '<p class="text-sm text-gray-500 italic mb-4">Belum ada data TTV dari perawat.</p>';

  mainContent.innerHTML = `<div class="max-w-4xl mx-auto fade-in">
    <button onclick="window.navigateTo('doctor-queue')" class="mb-4 text-sm text-gray-500 flex items-center gap-1 hover:text-primary transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> Kembali ke Antrian
    </button>
    
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
                <div class="flex justify-between items-start">
            <div>
              <h3 class="text-xl font-bold">${reg.patients.full_name}</h3>
              <p class="text-sm text-gray-500">No. Antrian: <span class="font-bold text-primary">${reg.queue_number}</span> | Poli: ${reg.target_poly}</p>
            </div>
            <button onclick="window.openHistoryModal('${reg.patient_id}', '${reg.patients.full_name}')" class="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Lihat Riwayat
            </button>
          </div>
        <span class="px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">Menunggu Dokter</span>
      </div>
      <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mb-4">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keluhan Utama (Dari Pendaftaran):</p>
        <p class="text-gray-900 dark:text-gray-100">${reg.complaint}</p>
      </div>
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Data TTV (Tanda-Tanda Vital)</h4>
      ${ttvHTML}
    </div>

    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
      <h4 class="font-semibold mb-4 flex items-center gap-2">
        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        Catatan Medis (SOAP) & ICD-10
      </h4>
      <div class="space-y-4">
        <div><label class="block text-sm mb-1">Subjective (Keluhan tambahan / Riwayat)</label><textarea id="soap-s" rows="2" class="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder="Keluhan tambahan dari pasien..."></textarea></div>
        <div><label class="block text-sm mb-1">Objective (Hasil Pemeriksaan Fisik)</label><textarea id="soap-o" rows="2" class="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder="Hasil pemeriksaan fisik dokter..."></textarea></div>
        <div class="relative">
          <label class="block text-sm mb-1">Assessment (Cari Kode ICD-10)</label>
          <input type="text" id="icd10-input" placeholder="Ketik kode (misal: J00)" class="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-700">
          <div id="icd10-list" class="hidden absolute z-10 w-full bg-white dark:bg-gray-800 border rounded shadow-lg max-h-40 overflow-y-auto mt-1"></div>
        </div>
        <div><label class="block text-sm mb-1">Diagnosa (Otomatis dari ICD-10)</label><input type="text" id="soap-a" class="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder="Diagnosa akan muncul otomatis"></div>
        <div><label class="block text-sm mb-1">Plan (Tindakan)</label><textarea id="soap-p" rows="2" class="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder="Contoh: Rawat jalan, kontrol 1 minggu"></textarea></div>
      </div>
    </div>

    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
  <div class="flex justify-between items-center mb-4">
    <h4 class="font-semibold flex items-center gap-2">
      <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
      Resep Obat
    </h4>
    <div class="flex gap-2">
      <button onclick="window.toggleMedicationMode('database')" id="btn-mode-db" class="px-3 py-1 text-xs rounded-lg bg-primary text-white font-medium">Dari Database</button>
      <button onclick="window.toggleMedicationMode('manual')" id="btn-mode-manual" class="px-3 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Manual</button>
    </div>
  </div>
  
  <!-- Mode Selection Info -->
  <div id="medication-mode-info" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
    💡 Mode Database: Pilih obat dari stok klinik (stok otomatis berkurang)
  </div>

  <!-- Database Mode: Search & Select -->
  <div id="medication-database-mode" class="mb-4">
    <div class="relative mb-3">
      <input type="text" id="medication-search" class="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary" placeholder="Cari obat (ketik nama atau kode)...">
      <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
    </div>
    <div id="medication-search-results" class="max-h-60 overflow-y-auto space-y-2 mb-3"></div>
  </div>

  <!-- Manual Mode: Free Input -->
  <div id="medication-manual-mode" class="hidden mb-4">
    <div class="grid grid-cols-12 gap-2 items-end mb-2">
      <div class="col-span-5">
        <label class="block text-xs font-medium mb-1">Nama Obat</label>
        <input type="text" id="manual-med-name" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" placeholder="Contoh: Paracetamol">
      </div>
      <div class="col-span-3">
        <label class="block text-xs font-medium mb-1">Dosis</label>
        <input type="text" id="manual-med-dose" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" placeholder="3x1">
      </div>
      <div class="col-span-2">
        <label class="block text-xs font-medium mb-1">Qty</label>
        <input type="number" id="manual-med-qty" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" placeholder="10">
      </div>
      <div class="col-span-2">
        <button onclick="window.addManualMedication()" class="w-full px-3 py-2 bg-primary text-white rounded-lg hover:bg-primaryHover transition">+ Tambah</button>
      </div>
    </div>
  </div>

  <!-- List Obat yang Ditambahkan -->
  <div id="rx-items" class="space-y-3 mb-4"></div>
  
    <!-- Bungkus tombol jadi flex agar berdampingan -->
  <div class="flex gap-2 mt-4">
  <button id="btn-save-soap" class="flex-1 bg-primary hover:bg-primaryHover text-white font-semibold py-3 rounded-lg transition">
    Simpan & Kirim Farmasi
  </button>
  
  <!-- Tombol Cetak -->
  <button onclick="window.handlePrintClick()" class="px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center gap-2">
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
    Cetak
  </button>
</div>
  
  <p id="soap-msg" class="text-sm hidden mt-2"></p>
</div>
  </div>`;

  // Reset medications untuk pasien baru
  window.selectedMedications = [];
  selectedMedications = window.selectedMedications;
  console.log("💾 DEBUG - Reset selectedMedications untuk pasien baru");

  // Setup medication search
  setupMedicationSearch();
  renderMedicationList();

  setupICD10();
  // ✅ BENAR - panggil submitSOAPWithMedications
  document
    .getElementById("btn-save-soap")
    .addEventListener("click", submitSOAPWithMedications);

  // Load Odontogram jika Poli Gigi
  if (reg.target_poly === "Poli Gigi") {
    loadOdontogramForSOAP(regId, reg.target_poly);
  }

  // Setup medication search
  setupMedicationSearch();

  // Reset selected medications
  selectedMedications = [];
  renderMedicationList();

  // Attach submit listener
  document
    .getElementById("btn-save-soap")
    .addEventListener("click", submitSOAPWithMedications);
}

function setupICD10() {
  const input = document.getElementById("icd10-input");
  const list = document.getElementById("icd10-list");
  let timer;
  input.addEventListener("input", (e) => {
    clearTimeout(timer);
    if (e.target.value.length < 2) {
      list.classList.add("hidden");
      return;
    }
    timer = setTimeout(async () => {
      const { data } = await supabaseClient
        .from("icd10_codes")
        .select("*")
        .or(
          `code.ilike.%${e.target.value}%,description.ilike.%${e.target.value}%`,
        )
        .limit(5);
      if (data && data.length) {
        list.innerHTML = data
          .map(
            (i) =>
              `<div class="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" onclick="window.pickICD('${i.code}', '${i.description.replace(/'/g, "\\'")}')"><b>${i.code}</b> - ${i.description}</div>`,
          )
          .join("");
        list.classList.remove("hidden");
      }
    }, 300);
  });
}

window.pickICD = (code, desc) => {
  document.getElementById("icd10-input").value = `${code} - ${desc}`;
  document.getElementById("soap-a").value = desc;
  document.getElementById("icd10-list").classList.add("hidden");
};

// HANYA ADA 1 DECLARATION DI SINI
window.addRxItem = function () {
  prescriptionItemCount++;
  const id = prescriptionItemCount;
  document.getElementById("rx-items").insertAdjacentHTML(
    "beforeend",
    `
    <div id="rx-${id}" class="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
      <input type="text" class="col-span-5 p-2 border rounded dark:bg-gray-800 dark:border-gray-700" placeholder="Nama Obat">
      <input type="text" class="col-span-3 p-2 border rounded dark:bg-gray-800 dark:border-gray-700" placeholder="Dosis (3x1)">
      <input type="number" class="col-span-2 p-2 border rounded dark:bg-gray-800 dark:border-gray-700" placeholder="Qty">
      <button onclick="document.getElementById('rx-${id}').remove()" class="col-span-2 text-red-500 hover:text-red-700 flex justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    </div>
  `,
  );
};

// --- HALAMAN: FARMASI ---
async function loadPharmacyQueue() {
  const mainContent = document.getElementById("main-content");
  const { data: profileData } = await supabaseClient
    .from("profiles")
    .select("clinic_id")
    .eq("id", currentUser.id)
    .single();

  const { data: regs, error } = await supabaseClient
    .from("registrations")
    .select(
      `
      id, 
      queue_number, 
      status, 
      created_at, 
      patients(full_name), 
      prescriptions!inner(id, items, status)
    `,
    )
    .eq("clinic_id", profileData.clinic_id)
    .eq("status", "waiting_pharmacy")
    .order("created_at", { ascending: true });

  if (error || regs.length === 0) {
    mainContent.innerHTML = getEmptyState("Tidak ada resep pending.");
    return;
  }

  // Filter duplikat prescriptions (ambil yang pertama saja)
  const uniqueRegs = regs.map((reg) => {
    const prescription = reg.prescriptions?.[0]; // Ambil prescription pertama
    return {
      ...reg,
      prescriptions: prescription ? [prescription] : [],
    };
  });

  mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">${uniqueRegs
    .map((r) => {
      const prescription = r.prescriptions?.[0];
      const itemCount = prescription?.items?.length || 0;
      return `<div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-md" onclick='window.navigateTo("process-prescription", ${JSON.stringify(r)})'>
      <div class="flex justify-between items-start mb-2">
        <span class="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">${formatTimeID(r.created_at)}</span>
      </div>
      <h4 class="font-bold text-lg">${r.patients.full_name}</h4>
      <p class="text-sm text-gray-500 mt-1">${itemCount} item obat</p>
      <button class="mt-3 text-xs font-semibold text-primary">Proses &rarr;</button>
    </div>`;
    })
    .join("")}</div>`;
}

function loadPrescriptionDetail(registration) {
  const mainContent = document.getElementById("main-content");
  const prescription = registration.prescriptions?.[0];

  if (!prescription || !prescription.items) {
    mainContent.innerHTML = `<div class="text-red-500 text-center">Data resep tidak ditemukan atau rusak.</div>`;
    return;
  }

  const itemsHTML = prescription.items
    .map(
      (item) => `
    <div class="flex justify-between py-3 border-b dark:border-gray-700">
      <div><p class="font-semibold">${item.drug_name}</p><p class="text-sm text-gray-500">${item.dose}</p></div>
      <span class="font-bold">x${item.qty}</span>
    </div>
  `,
    )
    .join("");

  mainContent.innerHTML = `<div class="max-w-2xl mx-auto fade-in">
    <button onclick="window.navigateTo('pharmacy')" class="mb-4 text-sm text-gray-500">&larr; Kembali</button>
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
      <h3 class="text-xl font-bold">${registration.patients.full_name}</h3>
      <p class="text-sm text-gray-500">Antrian: ${registration.queue_number}</p>
    </div>
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
      <h4 class="font-semibold mb-4">Daftar Obat</h4>
      <div class="divide-y dark:divide-gray-700">${itemsHTML}</div>
    </div>
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
      <button onclick="window.updateRxStatus('${prescription.id}', 'preparing', '${registration.id}')" class="w-full bg-yellow-500 text-white py-2 rounded">Sedang Disiapkan</button>
      <button onclick="window.updateRxStatus('${prescription.id}', 'ready', '${registration.id}')" class="w-full bg-blue-500 text-white py-2 rounded">Siap Diambil</button>
      <button onclick="window.updateRxStatus('${prescription.id}', 'handed_over', '${registration.id}')" class="w-full bg-green-500 text-white py-2 rounded">Sudah Diserahkan (Selesai)</button>
    </div>
  </div>`;
}

window.updateRxStatus = async function (rxId, status, regId) {
  await supabaseClient.from("prescriptions").update({ status }).eq("id", rxId);
  if (status === "handed_over")
    await supabaseClient
      .from("registrations")
      .update({ status: "completed" })
      .eq("id", regId);
  alert(`Status: ${status}`);
  if (status === "handed_over")
    await supabaseClient
      .from("registrations")
      .update({ status: "waiting_payment" })
      .eq("id", regId);
};

// --- GLOBAL EVENT LISTENERS ---
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  btn.textContent = "Memproses...";
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: document.getElementById("login-email").value,
    password: document.getElementById("login-password").value,
  });
  if (error) {
    document.getElementById("login-error").textContent = error.message;
    document.getElementById("login-error").classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Masuk";
  } else {
    await checkAuth();
  }
});

async function handleLogout() {
  await supabaseClient.auth.signOut({ scope: "local" });
  currentUser = null;
  userRole = null;
  clinicSettings = null;
  showLogin();
}
document.getElementById("btn-logout").addEventListener("click", handleLogout);

const themeBtn = document.getElementById("theme-toggle");
const html = document.documentElement;
if (
  localStorage.theme === "dark" ||
  (!("theme" in localStorage) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
)
  html.classList.add("dark");
themeBtn.addEventListener("click", () => {
  html.classList.toggle("dark");
  localStorage.theme = html.classList.contains("dark") ? "dark" : "light";
});

// --- HALAMAN: KASIR / BILLING ---
async function loadBillingQueue() {
  const mainContent = document.getElementById("main-content");
  const { data: profileData } = await supabaseClient
    .from("profiles")
    .select("clinic_id")
    .eq("id", currentUser.id)
    .single();

  const { data: regs, error } = await supabaseClient
    .from("registrations")
    .select(
      "id, queue_number, status, created_at, patients(full_name), prescriptions(id, items)",
    )
    .eq("clinic_id", profileData.clinic_id)
    .eq("status", "waiting_payment")
    .order("created_at", { ascending: true });

  if (error || regs.length === 0) {
    mainContent.innerHTML = getEmptyState(
      "Tidak ada pasien yang menunggu pembayaran.",
    );
    return;
  }

  mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">${regs
    .map((r) => {
      const medCount = r.prescriptions?.[0]?.items?.length || 0;
      return `<div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-md" onclick='window.navigateTo("billing-detail", ${JSON.stringify(r)})'>
      <div class="flex justify-between items-start mb-2">
        <span class="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">${r.queue_number}</span>
        <!-- PERUBAHAN DI SINI -->
        <span class="text-xs text-gray-500">${formatTimeID(r.created_at)}</span>
      </div>
      <h4 class="font-bold text-lg">${r.patients.full_name}</h4>
      <p class="text-sm text-gray-500 mt-1">${medCount > 0 ? medCount + " item obat" : "Tanpa Resep"}</p>
      <button class="mt-3 text-xs font-semibold text-primary">Buat Tagihan &rarr;</button>
    </div>`;
    })
    .join("")}</div>`;
}

window.billingItems = []; // State sementara untuk item tagihan

function loadBillingDetail(registration) {
  window.currentBillingReg = registration;
  window.billingItems = [];

  // Auto-add obat dari farmasi jika ada
  if (registration.prescriptions?.[0]?.items) {
    registration.prescriptions[0].items.forEach((item) => {
      window.billingItems.push({
        name: `Obat: ${item.drug_name} (${item.dose})`,
        price: 0,
        qty: item.qty,
      }); // Harga obat diinput manual/nanti
    });
  }

  renderBillingForm(registration);
}

function renderBillingForm(registration) {
  const mainContent = document.getElementById("main-content");
  const total = window.billingItems.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );

  const itemsHTML = window.billingItems
    .map(
      (item, index) => `
    <div class="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
      <input type="text" value="${item.name}" onchange="window.updateBillingItem(${index}, 'name', this.value)" class="col-span-5 p-2 border rounded dark:bg-gray-800 dark:border-gray-700">
      <input type="number" value="${item.price}" onchange="window.updateBillingItem(${index}, 'price', this.value)" class="col-span-3 p-2 border rounded dark:bg-gray-800 dark:border-gray-700" placeholder="Harga">
      <input type="number" value="${item.qty}" onchange="window.updateBillingItem(${index}, 'qty', this.value)" class="col-span-2 p-2 border rounded dark:bg-gray-800 dark:border-gray-700">
      <button onclick="window.removeBillingItem(${index})" class="col-span-2 text-red-500 flex justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    </div>
  `,
    )
    .join("");

  mainContent.innerHTML = `<div class="max-w-4xl mx-auto fade-in no-print">
    <button onclick="window.navigateTo('billing')" class="mb-4 text-sm text-gray-500">&larr; Kembali</button>
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
      <h3 class="text-xl font-bold">${registration.patients.full_name} <span class="text-sm font-normal text-gray-500">(${registration.queue_number})</span></h3>
    </div>

    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
      <h4 class="font-semibold mb-4">Item Tagihan</h4>
      <div class="space-y-3 mb-4">${itemsHTML}</div>
      
      <div class="flex gap-2 mb-4">
        <select id="add-service-type" class="flex-grow p-2 border rounded dark:bg-gray-900 dark:border-gray-700">
          <option value="Konsultasi Umum">Konsultasi Umum</option>
          <option value="Konsultasi Gigi">Konsultasi Gigi</option>
          <option value="Tindakan Medis">Tindakan Medis</option>
          <option value="Obat Bebas">Obat Bebas</option>
        </select>
        <button onclick="window.addBillingService()" class="bg-primary text-white px-4 py-2 rounded-lg">+ Tambah</button>
      </div>

      <div class="flex justify-between items-center pt-4 border-t dark:border-gray-700">
        <span class="text-lg font-bold">Total Tagihan:</span>
        <span class="text-2xl font-bold text-primary">Rp ${total.toLocaleString("id-ID")}</span>
      </div>
    </div>

    <button onclick="window.processPayment()" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg text-lg transition">
      Proses Pembayaran & Cetak Struk
    </button>
  </div>

  <!-- AREA CETAK STRUK -->
  <div id="print-area" class="hidden bg-white text-black p-8 max-w-sm mx-auto">
    <div class="text-center mb-6">
      <h2 class="text-2xl font-bold">KlinikHub</h2>
      <p class="text-sm">Jl. Merdeka No. 1</p>
      <p class="text-sm">Telp: 08123456789</p>
      <hr class="my-4 border-dashed border-black">
      <p class="text-sm font-bold">STRUK PEMBAYARAN</p>
      <p class="text-xs">${new Date().toLocaleString("id-ID")}</p>
    </div>
    <div class="mb-4">
      <p class="text-sm"><b>Pasien:</b> ${registration.patients.full_name}</p>
      <p class="text-sm"><b>No. Antrian:</b> ${registration.queue_number}</p>
    </div>
    <hr class="my-2 border-dashed border-black">
    <div class="space-y-2 text-sm">
      ${window.billingItems
        .map(
          (item) => `
        <div class="flex justify-between">
          <span>${item.name} x${item.qty}</span>
          <span>Rp ${(item.price * item.qty).toLocaleString("id-ID")}</span>
        </div>
      `,
        )
        .join("")}
    </div>
    <hr class="my-4 border-dashed border-black">
    <div class="flex justify-between font-bold text-lg">
      <span>TOTAL</span>
      <span>Rp ${total.toLocaleString("id-ID")}</span>
    </div>
    <div class="text-center mt-8 text-xs">
      <p>Terima kasih atas kunjungan Anda</p>
      <p>Semoga lekas sembuh!</p>
    </div>
  </div>`;
}

window.updateBillingItem = (index, field, value) => {
  window.billingItems[index][field] = field === "name" ? value : Number(value);
  renderBillingForm(window.currentBillingReg);
};

window.removeBillingItem = (index) => {
  window.billingItems.splice(index, 1);
  renderBillingForm(window.currentBillingReg);
};

window.addBillingService = () => {
  const type = document.getElementById("add-service-type").value;
  let defaultPrice = 0;
  if (type === "Konsultasi Umum") defaultPrice = 50000;
  if (type === "Konsultasi Gigi") defaultPrice = 75000;
  if (type === "Tindakan Medis") defaultPrice = 100000;

  window.billingItems.push({ name: type, price: defaultPrice, qty: 1 });
  renderBillingForm(window.currentBillingReg);
};

window.processPayment = async () => {
  if (window.billingItems.length === 0) {
    alert("Tagihan kosong!");
    return;
  }

  const total = window.billingItems.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );
  const reg = window.currentBillingReg;

  try {
    // 1. Simpan Invoice
    await supabaseClient.from("invoices").insert([
      {
        clinic_id: (
          await supabaseClient
            .from("profiles")
            .select("clinic_id")
            .eq("id", currentUser.id)
            .single()
        ).data.clinic_id,
        registration_id: reg.id,
        items: window.billingItems,
        total_amount: total,
        status: "paid",
      },
    ]);

    // 2. Update Status Registrasi jadi Selesai
    await supabaseClient
      .from("registrations")
      .update({ status: "completed" })
      .eq("id", reg.id);

    // 3. Tampilkan Struk & Print
    document.getElementById("print-area").classList.remove("hidden");
    window.print();

    setTimeout(() => window.navigateTo("billing"), 1000);
  } catch (err) {
    alert("Gagal memproses pembayaran: " + err.message);
  }
};

// --- HALAMAN: DASHBOARD STATISTIK (ENHANCED) ---
let currentStatsFilter = "month"; // 'today', 'week', 'month', 'custom'
let customDateStart = null;
let customDateEnd = null;

async function loadDashboardStats() {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

  try {
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();
    const clinicId = profileData.clinic_id;

    // Hitung date range berdasarkan filter
    let startDate, endDate;
    const now = new Date();

    if (currentStatsFilter === "today") {
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
    } else if (currentStatsFilter === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      endDate = new Date();
    } else if (currentStatsFilter === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
    } else if (
      currentStatsFilter === "custom" &&
      customDateStart &&
      customDateEnd
    ) {
      startDate = new Date(customDateStart);
      endDate = new Date(customDateEnd);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
    }

    // 1. Total Pasien dalam Periode
    const { count: patientsTotal } = await supabaseClient
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    // 2. Total Pendapatan dalam Periode
    const { data: invoices } = await supabaseClient
      .from("invoices")
      .select("total_amount, created_at, items")
      .eq("clinic_id", clinicId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .eq("status", "paid");

    const revenueTotal =
      invoices?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;

    // 3. Rata-rata per Hari
    const daysDiff = Math.max(
      1,
      Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
    );
    const avgPatientsPerDay = Math.round((patientsTotal || 0) / daysDiff);
    const avgRevenuePerDay = Math.round(revenueTotal / daysDiff);

    // 4. Grafik Pasien per Hari (dalam periode)
    const patientChartData = [];
    const patientChartLabels = [];
    const daysToShow = Math.min(daysDiff, 30); // Max 30 hari

    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { count } = await supabaseClient
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("created_at", dateStr)
        .lt("created_at", nextDate.toISOString());

      patientChartData.push(count || 0);
      patientChartLabels.push(
        date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      );
    }

    // 5. Top 10 Penyakit (dalam periode)
    const { data: registrations } = await supabaseClient
      .from("registrations")
      .select("id")
      .eq("clinic_id", clinicId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const regIds = registrations?.map((r) => r.id) || [];
    const { data: medicalRecords } = await supabaseClient
      .from("medical_records")
      .select("soap_assessment")
      .in("registration_id", regIds);

    const diseaseCount = {};
    medicalRecords?.forEach((record) => {
      if (record.soap_assessment) {
        diseaseCount[record.soap_assessment] =
          (diseaseCount[record.soap_assessment] || 0) + 1;
      }
    });

    const topDiseases = Object.entries(diseaseCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // 6. Breakdown per Poli
    const { data: regsByPoly } = await supabaseClient
      .from("registrations")
      .select("target_poly")
      .eq("clinic_id", clinicId)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const polyCount = {};
    regsByPoly?.forEach((reg) => {
      if (reg.target_poly) {
        polyCount[reg.target_poly] = (polyCount[reg.target_poly] || 0) + 1;
      }
    });

    const polyData = Object.entries(polyCount).sort((a, b) => b[1] - a[1]);

    // Render Dashboard dengan Filter
    mainContent.innerHTML = `
      <div class="space-y-6 fade-in">
        <!-- Filter & Export -->
        <div class="bg-white dark:bg-darkCard p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-wrap gap-3 items-center justify-between">
          <div class="flex flex-wrap gap-2">
            <button onclick="window.setStatsFilter('today')" class="px-4 py-2 rounded-lg text-sm font-medium transition ${currentStatsFilter === "today" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}">Hari Ini</button>
            <button onclick="window.setStatsFilter('week')" class="px-4 py-2 rounded-lg text-sm font-medium transition ${currentStatsFilter === "week" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}">7 Hari</button>
            <button onclick="window.setStatsFilter('month')" class="px-4 py-2 rounded-lg text-sm font-medium transition ${currentStatsFilter === "month" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}">Bulan Ini</button>
            <div class="flex items-center gap-2">
              <input type="date" id="custom-start" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm">
              <span class="text-gray-500">-</span>
              <input type="date" id="custom-end" class="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm">
              <button onclick="window.setStatsFilter('custom')" class="px-4 py-2 rounded-lg text-sm font-medium transition ${currentStatsFilter === "custom" ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"}">Custom</button>
            </div>
          </div>
          <button onclick="window.exportStatsCSV()" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Export CSV
          </button>
        </div>

        <!-- Card Statistik -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Total Pasien</p>
                <p class="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">${patientsTotal || 0}</p>
                <p class="text-xs text-gray-500 mt-1">Rata-rata ${avgPatientsPerDay}/hari</p>
              </div>
              <div class="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Total Pendapatan</p>
                <p class="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">Rp ${revenueTotal.toLocaleString("id-ID")}</p>
                <p class="text-xs text-gray-500 mt-1">Rata-rata Rp ${avgRevenuePerDay.toLocaleString("id-ID")}/hari</p>
              </div>
              <div class="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
            </div>
          </div>

          <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Periode</p>
                <p class="text-lg font-bold text-gray-900 dark:text-gray-100 mt-2">${daysDiff} Hari</p>
                <p class="text-xs text-gray-500 mt-1">${startDate.toLocaleDateString("id-ID")} - ${endDate.toLocaleDateString("id-ID")}</p>
              </div>
              <div class="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Grafik Pasien per Hari -->
        <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
          <h3 class="text-lg font-semibold mb-4">Trend Pasien per Hari</h3>
          <canvas id="patientChart"></canvas>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Top 10 Penyakit -->
          <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
            <h3 class="text-lg font-semibold mb-4">Top 10 Penyakit Terbanyak</h3>
            <div class="space-y-3">
              ${
                topDiseases.length > 0
                  ? topDiseases
                      .map(
                        (disease, index) => `
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <span class="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm">${index + 1}</span>
                    <span class="text-gray-900 dark:text-gray-100 text-sm">${disease[0]}</span>
                  </div>
                  <span class="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-semibold">${disease[1]} pasien</span>
                </div>
              `,
                      )
                      .join("")
                  : '<p class="text-gray-500 text-center py-4">Belum ada data penyakit</p>'
              }
            </div>
          </div>

          <!-- Breakdown per Poli -->
          <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
            <h3 class="text-lg font-semibold mb-4">Pasien per Poli</h3>
            <canvas id="polyChart"></canvas>
          </div>
        </div>
      </div>
    `;

    // Store data for export
    window.statsData = {
      invoices,
      startDate,
      endDate,
      patientsTotal,
      revenueTotal,
    };

    // Render Charts
    setTimeout(() => {
      // Patient Chart
      const patientCtx = document.getElementById("patientChart");
      if (patientCtx) {
        new Chart(patientCtx, {
          type: "line",
          data: {
            labels: patientChartLabels,
            datasets: [
              {
                label: "Jumlah Pasien",
                data: patientChartData,
                borderColor: "#FF6B00",
                backgroundColor: "rgba(255, 107, 0, 0.1)",
                tension: 0.4,
                fill: true,
              },
            ],
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
          },
        });
      }

      // Poly Chart
      const polyCtx = document.getElementById("polyChart");
      if (polyCtx && polyData.length > 0) {
        new Chart(polyCtx, {
          type: "doughnut",
          data: {
            labels: polyData.map((p) => p[0]),
            datasets: [
              {
                data: polyData.map((p) => p[1]),
                backgroundColor: [
                  "#FF6B00",
                  "#10B981",
                  "#3B82F6",
                  "#8B5CF6",
                  "#F59E0B",
                  "#EF4444",
                ],
              },
            ],
          },
          options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } },
          },
        });
      }
    }, 100);
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 text-center">Gagal memuat statistik: ${err.message}</div>`;
  }
}

// Filter Handler
window.setStatsFilter = function (filter) {
  if (filter === "custom") {
    const start = document.getElementById("custom-start").value;
    const end = document.getElementById("custom-end").value;
    if (!start || !end) {
      alert("Pilih tanggal mulai dan selesai terlebih dahulu");
      return;
    }
    customDateStart = start;
    customDateEnd = end;
  }
  currentStatsFilter = filter;
  loadDashboardStats();
};

// Export CSV Handler
window.exportStatsCSV = function () {
  if (!window.statsData || !window.statsData.invoices) {
    alert("Tidak ada data untuk diexport");
    return;
  }

  const { invoices, startDate, endDate } = window.statsData;

  // Generate CSV
  let csv = "Tanggal,No. Invoice,Pasien,Total Item,Total Pendapatan\n";

  invoices.forEach((inv) => {
    const date = new Date(inv.created_at).toLocaleDateString("id-ID");
    const itemCount = inv.items?.length || 0;
    const total = Number(inv.total_amount);

    csv += `${date},INV-${inv.id.substring(0, 8).toUpperCase()},Pasien,${itemCount},${total}\n`;
  });

  // Download CSV
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `Laporan_Keuangan_${startDate.toISOString().split("T")[0]}_sampai_${endDate.toISOString().split("T")[0]}.csv`,
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- FITUR: RIWAYAT MEDIS PASIEN ---

window.openHistoryModal = async function (patientId, patientName) {
  console.log("🔍 DEBUG - Patient ID:", patientId);
  console.log("🔍 DEBUG - Patient Name:", patientName);
  console.log("🔍 DEBUG - Current Registration ID:", currentRegistrationId);

  document.getElementById("history-modal").classList.remove("hidden");
  document.getElementById("history-patient-name").textContent =
    `Pasien: ${patientName}`;
  document.getElementById("history-content").innerHTML =
    '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

  try {
    const { data: profileData, error: profileError } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();

    console.log("🔍 DEBUG - Profile Data:", profileData);
    console.log("🔍 DEBUG - Clinic ID:", profileData?.clinic_id);

    if (profileError) throw profileError;

    // Query SEMUA registrasi pasien ini dulu (tanpa filter neq)
    const { data: allRegs, error: regError } = await supabaseClient
      .from("registrations")
      .select("id, patient_id, created_at, complaint, target_poly, clinic_id")
      .eq("patient_id", patientId)
      .eq("clinic_id", profileData.clinic_id)
      .order("created_at", { ascending: false });

    console.log("📋 DEBUG - All Registrations for patient:", allRegs);
    console.log("📋 DEBUG - Total found:", allRegs?.length);
    console.log("📋 DEBUG - Error:", regError);

    if (regError) throw regError;

    if (!allRegs || allRegs.length === 0) {
      // Cek apakah patient_id di database berbeda
      const { data: patientCheck } = await supabaseClient
        .from("patients")
        .select("id, full_name")
        .eq("id", patientId)
        .single();

      console.log("🔍 DEBUG - Patient Check:", patientCheck);

      document.getElementById("history-content").innerHTML = `
        <div class="text-center py-10">
          <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Belum Ada Riwayat</h3>
          <p class="text-gray-500 dark:text-gray-400 mt-2">Ini adalah kunjungan pertama pasien ini di klinik kita.</p>
          <p class="text-xs text-gray-400 mt-4">Patient ID: ${patientId}</p>
        </div>
      `;
      return;
    }

    // Filter out current registration
    const history = allRegs.filter((reg) => reg.id !== currentRegistrationId);
    console.log("📋 DEBUG - After filtering current reg:", history);

    if (history.length === 0) {
      document.getElementById("history-content").innerHTML = `
        <div class="text-center py-10">
          <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Hanya Ada 1 Kunjungan</h3>
          <p class="text-gray-500 dark:text-gray-400 mt-2">Pasien ini baru pernah berobat 1 kali (kunjungan yang sedang dibuka).</p>
        </div>
      `;
      return;
    }

    // Step 2: Ambil data tambahan
    const regIds = history.map((h) => h.id);
    console.log("🔍 DEBUG - Registration IDs to fetch:", regIds);

    const [ttvData, soapData, rxData] = await Promise.all([
      supabaseClient
        .from("vital_signs")
        .select("*")
        .in("registration_id", regIds),
      supabaseClient
        .from("medical_records")
        .select("*")
        .in("registration_id", regIds),
      supabaseClient
        .from("prescriptions")
        .select("*")
        .in("registration_id", regIds),
    ]);

    console.log("💉 TTV:", ttvData);
    console.log("📝 SOAP:", soapData);
    console.log("💊 Resep:", rxData);

    // Step 3: Gabungkan data
    const historyWithDetails = history.map((reg) => ({
      ...reg,
      vital_signs: ttvData.data?.find((v) => v.registration_id === reg.id),
      medical_records: soapData.data?.find((s) => s.registration_id === reg.id),
      prescriptions: rxData.data?.find((r) => r.registration_id === reg.id),
    }));

    // Step 4: Render Timeline
    let timelineHTML =
      '<div class="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8">';

    historyWithDetails.forEach((visit, index) => {
      const date = new Date(visit.created_at).toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const time = new Date(visit.created_at).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const record = visit.medical_records;
      const ttv = visit.vital_signs;
      const rx = visit.prescriptions;

      timelineHTML += `
        <div class="mb-8 ml-6 relative">
          <span class="absolute flex items-center justify-center w-6 h-6 bg-primary rounded-full -left-[37px] ring-4 ring-white dark:ring-darkCard">
            <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"></path></svg>
          </span>
          
          <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <div class="flex justify-between items-start mb-3">
              <div>
                <h4 class="font-bold text-gray-900 dark:text-gray-100">${date}</h4>
                <p class="text-xs text-gray-500">${time} • ${visit.target_poly}</p>
              </div>
              <span class="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">Kunjungan ${historyWithDetails.length - index}</span>
            </div>

            <div class="space-y-3 text-sm">
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase">Keluhan</p>
                <p class="text-gray-900 dark:text-gray-100">${visit.complaint}</p>
              </div>

              ${
                ttv
                  ? `
              <div class="grid grid-cols-3 gap-2 bg-white dark:bg-darkCard p-2 rounded-lg">
                <div><span class="text-xs text-gray-500">Tensi:</span> <b>${ttv.systolic_bp || "-"}/${ttv.diastolic_bp || "-"}</b></div>
                <div><span class="text-xs text-gray-500">Nadi:</span> <b>${ttv.heart_rate || "-"}</b></div>
                <div><span class="text-xs text-gray-500">Suhu:</span> <b>${ttv.temperature || "-"}</b></div>
              </div>`
                  : ""
              }

              ${
                record
                  ? `
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase">Diagnosa (ICD-10)</p>
                <p class="font-medium text-primary">${record.soap_assessment || "-"}</p>
                <p class="text-xs text-gray-500 mt-1">Plan: ${record.soap_plan || "-"}</p>
              </div>`
                  : '<p class="text-xs text-gray-400 italic">Belum ada catatan dokter.</p>'
              }

              ${
                rx && rx.items && rx.items.length > 0
                  ? `
              <div>
                <p class="text-xs font-semibold text-gray-500 uppercase mb-1">Resep Obat</p>
                <ul class="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  ${rx.items.map((item) => `<li>${item.drug_name} (${item.dose}) x${item.qty}</li>`).join("")}
                </ul>
              </div>`
                  : ""
              }
            </div>
          </div>
        </div>
      `;
    });

    timelineHTML += "</div>";
    document.getElementById("history-content").innerHTML = timelineHTML;
  } catch (err) {
    console.error("❌ Error detail:", err);
    document.getElementById("history-content").innerHTML =
      `<div class="text-red-500 text-center p-4">Gagal memuat riwayat: ${err.message}</div>`;
  }
};

window.closeHistoryModal = function () {
  document.getElementById("history-modal").classList.add("hidden");
};

// Tutup modal jika klik di luar area konten
document
  .getElementById("history-modal")
  .addEventListener("click", function (e) {
    if (e.target === this) window.closeHistoryModal();
  });

// --- FITUR: TAB & SEARCH PASIEN ---

let selectedPatientForVisit = null;

window.switchRegTab = function (tab) {
  const tabSearch = document.getElementById("tab-search");
  const tabNew = document.getElementById("tab-new");
  const contentSearch = document.getElementById("tab-content-search");
  const contentNew = document.getElementById("tab-content-new");

  if (tab === "search") {
    tabSearch.className =
      "flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition bg-primary text-white flex items-center justify-center gap-2";
    tabNew.className =
      "flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2";
    contentSearch.classList.remove("hidden");
    contentNew.classList.add("hidden");
    setTimeout(
      () => document.getElementById("search-patient-input")?.focus(),
      100,
    );
  } else {
    tabNew.className =
      "flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition bg-primary text-white flex items-center justify-center gap-2";
    tabSearch.className =
      "flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2";
    contentNew.classList.remove("hidden");
    contentSearch.classList.add("hidden");
  }
};

function setupPatientSearch() {
  const input = document.getElementById("search-patient-input");
  if (!input) return;

  let searchTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();

    if (query.length < 2) {
      document.getElementById("search-results").innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p class="text-sm">Ketik minimal 2 karakter untuk mencari</p>
        </div>
      `;
      return;
    }

    searchTimer = setTimeout(async () => {
      const resultsDiv = document.getElementById("search-results");
      resultsDiv.innerHTML =
        '<div class="text-center py-4"><svg class="animate-spin h-6 w-6 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

      try {
        const { data: profileData } = await supabaseClient
          .from("profiles")
          .select("clinic_id")
          .eq("id", currentUser.id)
          .single();

        // Cek apakah query adalah NIK (angka 16 digit) atau nama
        const isNik = /^\d{5,}$/.test(query);

        let queryBuilder = supabaseClient
          .from("patients")
          .select("id, full_name, nik, date_of_birth, gender, phone, address")
          .eq("clinic_id", profileData.clinic_id)
          .limit(10);

        if (isNik) {
          queryBuilder = queryBuilder.ilike("nik", `%${query}%`);
        } else {
          queryBuilder = queryBuilder.ilike("full_name", `%${query}%`);
        }

        const { data: patients, error } = await queryBuilder;

        if (error) throw error;

        if (!patients || patients.length === 0) {
          resultsDiv.innerHTML = `
            <div class="text-center py-8 text-gray-500">
              <svg class="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p class="text-sm">Tidak ada pasien ditemukan</p>
              <p class="text-xs mt-1">Coba daftar sebagai pasien baru</p>
            </div>
          `;
          return;
        }

        resultsDiv.innerHTML = patients
          .map(
            (p) => `
          <div class="patient-card p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary dark:hover:border-primary cursor-pointer transition" onclick="window.selectPatientForVisit('${p.id}', '${p.full_name.replace(/'/g, "\\'")}', '${p.nik || ""}', '${p.date_of_birth || ""}', '${p.phone || ""}')">
            <div class="flex justify-between items-start mb-2">
              <h4 class="font-bold text-gray-900 dark:text-gray-100">${p.full_name}</h4>
              <span class="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">${p.gender === "L" ? "♂ Laki-laki" : p.gender === "P" ? "♀ Perempuan" : "-"}</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
              <div><span class="font-medium">NIK:</span> ${p.nik || "-"}</div>
              <div><span class="font-medium">TTL:</span> ${p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("id-ID") : "-"}</div>
              <div><span class="font-medium">HP:</span> ${p.phone || "-"}</div>
              <div><span class="font-medium">Alamat:</span> ${p.address || "-"}</div>
            </div>
          </div>
        `,
          )
          .join("");
      } catch (err) {
        resultsDiv.innerHTML = `<div class="text-red-500 text-center py-4">Error: ${err.message}</div>`;
      }
    }, 300);
  });
}

window.selectPatientForVisit = function (id, name, nik, dob, phone) {
  selectedPatientForVisit = { id, name, nik, dob, phone };

  document.getElementById("selected-patient-info").innerHTML = `
    <div class="flex justify-between items-start">
      <div>
        <p class="font-bold">${name}</p>
        <p class="text-xs text-gray-500">NIK: ${nik || "-"} • TTL: ${dob ? new Date(dob).toLocaleDateString("id-ID") : "-"}</p>
      </div>
      <button onclick="window.clearSelectedPatient()" class="text-xs text-red-500 hover:text-red-700">Ganti</button>
    </div>
  `;

  document.getElementById("visit-form").classList.remove("hidden");
  document
    .getElementById("visit-form")
    .scrollIntoView({ behavior: "smooth", block: "start" });
};

window.clearSelectedPatient = function () {
  selectedPatientForVisit = null;
  document.getElementById("visit-form").classList.add("hidden");
  document.getElementById("search-patient-input").value = "";
  document.getElementById("search-results").innerHTML = `
    <div class="text-center py-8 text-gray-500">
      <p class="text-sm">Ketik minimal 2 karakter untuk mencari</p>
    </div>
  `;
};

async function attachVisitFormListeners() {
  const btn = document.getElementById("btn-submit-visit");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const poly = document.getElementById("visit-poly").value;
    const complaint = document.getElementById("visit-complaint").value;
    const msg = document.getElementById("visit-message");

    if (!selectedPatientForVisit || !poly || !complaint) {
      msg.textContent = "❌ Lengkapi data kunjungan!";
      msg.className = "text-sm text-red-600 mt-2";
      msg.classList.remove("hidden");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Mendaftarkan...";

    try {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("clinic_id")
        .eq("id", currentUser.id)
        .single();

      // Generate nomor antrean otomatis
      const queueNumber = await generateQueueNumber(poly);

      const { error: rErr } = await supabaseClient
        .from("registrations")
        .insert([
          {
            clinic_id: profileData.clinic_id,
            patient_id: selectedPatientForVisit.id,
            registered_by: currentUser.id,
            status: clinicSettings.use_nurse_triage
              ? "waiting_triage"
              : "waiting_doctor",
            complaint: complaint,
            target_poly: poly,
            queue_number: queueNumber, // Pakai nomor otomatis
          },
        ]);

      if (rErr) throw rErr;

      msg.textContent = `✅ Kunjungan berhasil! Nomor antrean: ${queueNumber}`;
      msg.className = "text-sm text-green-600 mt-2";
      msg.classList.remove("hidden");

      document.getElementById("visit-poly").value = "";
      document.getElementById("visit-complaint").value = "";
      window.clearSelectedPatient();
    } catch (err) {
      msg.textContent = "❌ Gagal: " + err.message;
      msg.className = "text-sm text-red-600 mt-2";
      msg.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Daftarkan Kunjungan";
    }
  });
}

function attachNewPatientFormListeners() {
  const form = document.getElementById("new-patient-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-submit-new");
    const msg = document.getElementById("new-message");

    btn.disabled = true;
    btn.textContent = "Menyimpan...";

    try {
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("clinic_id")
        .eq("id", currentUser.id)
        .single();
      const clinicId = profileData.clinic_id;
      const poly = document.getElementById("new-poly").value;

      // Generate nomor antrean otomatis
      const queueNumber = await generateQueueNumber(poly);

      // 1. Buat Pasien Baru
      const { data: newPatient, error: pErr } = await supabaseClient
        .from("patients")
        .insert([
          {
            clinic_id: clinicId,
            full_name: document.getElementById("new-name").value.trim(),
            nik: document.getElementById("new-nik").value.trim() || null,
            date_of_birth: document.getElementById("new-dob").value || null,
            gender: document.getElementById("new-gender").value,
            phone: document.getElementById("new-phone").value.trim() || null,
            address:
              document.getElementById("new-address").value.trim() || null,
          },
        ])
        .select()
        .single();

      if (pErr) throw pErr;

      // 2. Buat Registrasi dengan nomor otomatis
      const { error: rErr } = await supabaseClient
        .from("registrations")
        .insert([
          {
            clinic_id: clinicId,
            patient_id: newPatient.id,
            registered_by: currentUser.id,
            status: clinicSettings.use_nurse_triage
              ? "waiting_triage"
              : "waiting_doctor",
            complaint: document.getElementById("new-complaint").value,
            target_poly: poly,
            queue_number: queueNumber, // Pakai nomor otomatis
          },
        ]);

      if (rErr) throw rErr;

      msg.textContent = `✅ Pasien baru "${newPatient.full_name}" berhasil! Antrean: ${queueNumber}`;
      msg.className = "text-sm text-green-600 mt-2";
      msg.classList.remove("hidden");

      form.reset();
    } catch (err) {
      msg.textContent = "❌ Gagal: " + err.message;
      msg.className = "text-sm text-red-600 mt-2";
      msg.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan Pasien & Daftarkan Kunjungan";
    }
  });
}

// Update fungsi attachRegistrationListeners untuk setup search & form baru
function attachRegistrationListeners() {
  setupPatientSearch();
  attachVisitFormListeners();
  attachNewPatientFormListeners();
}

// --- FITUR: ODONTOGRAM (MULTI-CONDITION) ---

let currentSelectedTooth = null;
let currentOdontogramRegId = null;
let odontogramData = {}; // Format: { '11': ['caries', 'calculus'], '12': ['filled'] }

// Mapping kondisi ke ICD-10 (untuk Satu Sehat)
const ICD10_MAP = {
  healthy: null,
  caries: "K02.9",
  calculus: "K11.5",
  filled: "Z98.818",
  missing: "K08.1",
  pulpitis: "K04.0",
};

// Mapping kondisi ke SNOMED CT (untuk bodySite di Satu Sehat)
const SNOMED_MAP = {
  healthy: null,
  caries: "245627001",
  calculus: "399230001",
  filled: "399230001",
  missing: "278046003",
  pulpitis: "399230001",
};

// Prioritas visualisasi (kondisi paling parah ditampilkan)
const PRIORITY_MAP = {
  caries: 5,
  pulpitis: 4,
  calculus: 3,
  filled: 2,
  missing: 1,
  healthy: 0,
};

// Render chart gigi dengan support multi-condition
function renderOdontogramChart(containerId, data = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const quadrants = [
    {
      id: "upper-right",
      teeth: ["18", "17", "16", "15", "14", "13", "12", "11"],
      label: "Kanan Atas",
    },
    {
      id: "upper-left",
      teeth: ["21", "22", "23", "24", "25", "26", "27", "28"],
      label: "Kiri Atas",
    },
    {
      id: "lower-right",
      teeth: ["48", "47", "46", "45", "44", "43", "42", "41"],
      label: "Kanan Bawah",
    },
    {
      id: "lower-left",
      teeth: ["31", "32", "33", "34", "35", "36", "37", "38"],
      label: "Kiri Bawah",
    },
  ];

  const colorMap = {
    healthy: "bg-white border-gray-300 text-gray-800",
    caries: "bg-red-500 border-red-600 text-white",
    calculus: "bg-yellow-500 border-yellow-600 text-white",
    filled: "bg-blue-500 border-blue-600 text-white",
    missing: "bg-gray-800 border-gray-900 text-white",
    pulpitis: "bg-purple-500 border-purple-600 text-white",
  };

  let html = '<div class="space-y-4">';

  // Baris Atas
  html += '<div class="grid grid-cols-2 gap-4">';
  quadrants.slice(0, 2).forEach((q) => {
    html += `<div class="bg-white dark:bg-darkCard p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <p class="text-xs text-center text-gray-500 mb-2 font-semibold">${q.label}</p>
      <div class="grid grid-cols-8 gap-1">`;
    q.teeth.forEach((tooth) => {
      const conditions = data[tooth] || [];
      // Tampilkan kondisi dengan prioritas tertinggi untuk visualisasi
      let displayCondition = "healthy";
      let maxPriority = 0;
      conditions.forEach((cond) => {
        if ((PRIORITY_MAP[cond] || 0) > maxPriority) {
          maxPriority = PRIORITY_MAP[cond];
          displayCondition = cond;
        }
      });

      const isClickable = containerId === "odontogram-chart-preview";
      const clickAttr = isClickable
        ? `onclick="window.openToothModal('${tooth}')"`
        : "";
      const cursorClass = isClickable
        ? "cursor-pointer hover:scale-110 transition-transform"
        : "cursor-default";
      const hasMultiple = conditions.length > 1;
      const multiIndicator = hasMultiple
        ? `<span class="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">${conditions.length}</span>`
        : "";

      html += `<div class="relative ${colorMap[displayCondition]} ${cursorClass} border-2 rounded-md aspect-square flex items-center justify-center text-xs font-bold" ${clickAttr}>${tooth}${multiIndicator}</div>`;
    });
    html += `</div></div>`;
  });
  html += "</div>";

  // Baris Bawah
  html += '<div class="grid grid-cols-2 gap-4">';
  quadrants.slice(2, 4).forEach((q) => {
    html += `<div class="bg-white dark:bg-darkCard p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <p class="text-xs text-center text-gray-500 mb-2 font-semibold">${q.label}</p>
      <div class="grid grid-cols-8 gap-1">`;
    q.teeth.forEach((tooth) => {
      const conditions = data[tooth] || [];
      let displayCondition = "healthy";
      let maxPriority = 0;
      conditions.forEach((cond) => {
        if ((PRIORITY_MAP[cond] || 0) > maxPriority) {
          maxPriority = PRIORITY_MAP[cond];
          displayCondition = cond;
        }
      });

      const isClickable = containerId === "odontogram-chart-preview";
      const clickAttr = isClickable
        ? `onclick="window.openToothModal('${tooth}')"`
        : "";
      const cursorClass = isClickable
        ? "cursor-pointer hover:scale-110 transition-transform"
        : "cursor-default";
      const hasMultiple = conditions.length > 1;
      const multiIndicator = hasMultiple
        ? `<span class="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">${conditions.length}</span>`
        : "";

      html += `<div class="relative ${colorMap[displayCondition]} ${cursorClass} border-2 rounded-md aspect-square flex items-center justify-center text-xs font-bold" ${clickAttr}>${tooth}${multiIndicator}</div>`;
    });
    html += `</div></div>`;
  });
  html += "</div></div>";

  // Legend
  html += `
    <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
      <p class="text-xs font-semibold text-gray-500 mb-2">Keterangan:</p>
      <div class="flex flex-wrap gap-3 text-xs">
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-white border-2 border-gray-300 rounded"></div>Sehat</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-red-500 rounded"></div>Karies</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-yellow-500 rounded"></div>Karang Gigi</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-blue-500 rounded"></div>Tambalan</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-gray-800 rounded"></div>Hilang</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-purple-500 rounded"></div>Pulpitis</div>
        <div class="flex items-center gap-1"><span class="w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">2</span>Multi-kondisi</div>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Buka modal dengan info kondisi aktif
window.openToothModal = async function (toothNumber) {
  currentSelectedTooth = toothNumber;

  // Fetch semua kondisi untuk gigi ini
  const { data: conditions } = await supabaseClient
    .from("dental_records")
    .select("condition_type, notes")
    .eq("registration_id", currentOdontogramRegId)
    .eq("tooth_number", toothNumber);

  const activeConditions = conditions?.map((c) => c.condition_type) || [];
  const notes = conditions?.[0]?.notes || "";

  // Update title
  document.getElementById("odontogram-tooth-title").textContent =
    `Gigi Nomor: ${toothNumber}`;

  // Update info kondisi aktif
  const conditionNames = {
    healthy: "Sehat",
    caries: "Karies",
    calculus: "Karang Gigi",
    filled: "Tambalan",
    missing: "Hilang",
    pulpitis: "Pulpitis",
  };

  const activeText =
    activeConditions.length > 0
      ? `Aktif: ${activeConditions.map((c) => conditionNames[c]).join(", ")}`
      : "Belum ada kondisi";
  document.getElementById("odontogram-active-conditions").textContent =
    activeText;

  // Update UI tombol untuk show active state
  document.querySelectorAll(".condition-btn").forEach((btn) => {
    const condition = btn.getAttribute("data-condition");
    const isActive = activeConditions.includes(condition);
    const statusEl = btn.querySelector(".condition-status");

    if (isActive) {
      btn.classList.add(
        "ring-4",
        "ring-primary",
        "bg-orange-50",
        "dark:bg-orange-900/20",
      );
      if (statusEl) {
        statusEl.textContent = "✓ Aktif";
        statusEl.classList.add("text-primary", "font-semibold");
        statusEl.classList.remove("text-gray-400");
      }
    } else {
      btn.classList.remove(
        "ring-4",
        "ring-primary",
        "bg-orange-50",
        "dark:bg-orange-900/20",
      );
      if (statusEl) {
        statusEl.textContent = "Tidak aktif";
        statusEl.classList.remove("text-primary", "font-semibold");
        statusEl.classList.add("text-gray-400");
      }
    }
  });

  // Set notes
  document.getElementById("tooth-notes").value = notes;

  document.getElementById("odontogram-modal").classList.remove("hidden");
};

window.closeOdontogramModal = function () {
  document.getElementById("odontogram-modal").classList.add("hidden");
  currentSelectedTooth = null;
};

// Toggle kondisi (add/remove)
window.toggleToothCondition = async function (condition) {
  console.log("🦷 Toggle condition:", condition);

  if (!currentSelectedTooth || !currentOdontogramRegId) {
    alert("Error: Data tidak lengkap. Silakan refresh halaman.");
    return;
  }

  try {
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();

    // Cek apakah kondisi ini sudah ada
    const { data: existing, error: fetchError } = await supabaseClient
      .from("dental_records")
      .select("id")
      .eq("registration_id", currentOdontogramRegId)
      .eq("tooth_number", currentSelectedTooth)
      .eq("condition_type", condition)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = not found
      throw fetchError;
    }

    if (existing) {
      // Hapus kondisi
      const { error: deleteError } = await supabaseClient
        .from("dental_records")
        .delete()
        .eq("id", existing.id);

      if (deleteError) throw deleteError;
      console.log(`✅ Kondisi ${condition} dihapus`);
    } else {
      // Tambah kondisi
      const { error: insertError } = await supabaseClient
        .from("dental_records")
        .insert([
          {
            clinic_id: profileData.clinic_id,
            registration_id: currentOdontogramRegId,
            tooth_number: currentSelectedTooth,
            condition_type: condition,
            icd10_code: ICD10_MAP[condition] || null,
            snomed_code: SNOMED_MAP[condition] || null,
            notes: document.getElementById("tooth-notes")?.value || null,
          },
        ]);

      if (insertError) throw insertError;
      console.log(`✅ Kondisi ${condition} ditambahkan`);
    }

    await reloadOdontogramData();
    await window.openToothModal(currentSelectedTooth);
  } catch (err) {
    console.error("❌ Error toggle condition:", err);
    alert("Gagal menyimpan kondisi gigi: " + err.message);
  }
};

// Reload data odontogram dari database
async function reloadOdontogramData() {
  const { data: records } = await supabaseClient
    .from("dental_records")
    .select("tooth_number, condition_type")
    .eq("registration_id", currentOdontogramRegId);

  // Reset odontogramData jadi object dengan array
  odontogramData = {};

  if (records) {
    records.forEach((r) => {
      if (!odontogramData[r.tooth_number]) {
        odontogramData[r.tooth_number] = [];
      }
      if (!odontogramData[r.tooth_number].includes(r.condition_type)) {
        odontogramData[r.tooth_number].push(r.condition_type);
      }
    });
  }

  renderOdontogramChart("odontogram-chart-preview", odontogramData);
}

// Load odontogram saat buka SOAP (Poli Gigi)
async function loadOdontogramForSOAP(registrationId, targetPoly) {
  console.log("🦷 Target Poli:", targetPoly);

  if (targetPoly !== "Poli Gigi") {
    console.log("❌ Bukan Poli Gigi, skip odontogram");
    return;
  }

  currentOdontogramRegId = registrationId;
  odontogramData = {};

  // Fetch semua data dari database
  const { data: records, error } = await supabaseClient
    .from("dental_records")
    .select("tooth_number, condition_type")
    .eq("registration_id", registrationId);

  if (error) console.log("⚠️ Error:", error);
  console.log("📊 Data odontogram:", records);

  // Konversi ke format array per tooth
  if (records) {
    records.forEach((r) => {
      if (!odontogramData[r.tooth_number]) {
        odontogramData[r.tooth_number] = [];
      }
      if (!odontogramData[r.tooth_number].includes(r.condition_type)) {
        odontogramData[r.tooth_number].push(r.condition_type);
      }
    });
  }

  // Hapus odontogram lama (jika ada)
  const existingOdontogram = document.getElementById("odontogram-section");
  if (existingOdontogram) existingOdontogram.remove();

  const odontogramSection = `
    <div id="odontogram-section" class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4 fade-in">
      <div class="flex justify-between items-center mb-4">
        <h4 class="font-semibold flex items-center gap-2">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Odontogram (Klik gigi untuk mengubah kondisi)
        </h4>
        <span class="text-xs text-gray-500">💡 Bisa pilih lebih dari 1 kondisi per gigi</span>
      </div>
      <div id="odontogram-chart-preview"></div>
    </div>
  `;

  const mainContent = document.getElementById("main-content");
  mainContent.insertAdjacentHTML("afterbegin", odontogramSection);

  setTimeout(() => {
    renderOdontogramChart("odontogram-chart-preview", odontogramData);
    console.log("✅ Odontogram rendered");
  }, 100);
}

// ========================================
// FITUR: HYBRID MEDICATION SYSTEM
// ========================================

let currentMedicationMode = "database"; // 'database' atau 'manual'
window.selectedMedications = window.selectedMedications || [];
let selectedMedications = window.selectedMedications; // Array untuk menyimpan obat yang dipilih

// Toggle mode database/manual
window.toggleMedicationMode = function (mode) {
  currentMedicationMode = mode;

  const btnDb = document.getElementById("btn-mode-db");
  const btnManual = document.getElementById("btn-mode-manual");
  const sectionDb = document.getElementById("medication-database-mode");
  const sectionManual = document.getElementById("medication-manual-mode");
  const infoBox = document.getElementById("medication-mode-info");

  if (mode === "database") {
    btnDb.className =
      "px-3 py-1 text-xs rounded-lg bg-primary text-white font-medium";
    btnManual.className =
      "px-3 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
    sectionDb.classList.remove("hidden");
    sectionManual.classList.add("hidden");
    infoBox.textContent =
      "💡 Mode Database: Pilih obat dari stok klinik (stok otomatis berkurang)";
    infoBox.className =
      "mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400";
  } else {
    btnManual.className =
      "px-3 py-1 text-xs rounded-lg bg-primary text-white font-medium";
    btnDb.className =
      "px-3 py-1 text-xs rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
    sectionManual.classList.remove("hidden");
    sectionDb.classList.add("hidden");
    infoBox.textContent =
      "📝 Mode Manual: Input bebas untuk resep eksternal (tidak tracking stok)";
    infoBox.className =
      "mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400";
  }
};

// Setup search medication
function setupMedicationSearch() {
  const input = document.getElementById("medication-search");
  if (!input) return;

  let searchTimer;
  input.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();

    if (query.length < 2) {
      document.getElementById("medication-search-results").innerHTML = "";
      return;
    }

    searchTimer = setTimeout(async () => {
      const resultsDiv = document.getElementById("medication-search-results");
      resultsDiv.innerHTML =
        '<div class="text-center py-4"><svg class="animate-spin h-6 w-6 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

      try {
        const { data: profileData } = await supabaseClient
          .from("profiles")
          .select("clinic_id")
          .eq("id", currentUser.id)
          .single();

        const { data: medications, error } = await supabaseClient
          .from("medications")
          .select("*")
          .eq("clinic_id", profileData.clinic_id)
          .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
          .eq("is_active", true)
          .limit(10);

        if (error) throw error;

        if (!medications || medications.length === 0) {
          resultsDiv.innerHTML =
            '<div class="text-center py-4 text-gray-500 text-sm">Tidak ada obat ditemukan</div>';
          return;
        }

        resultsDiv.innerHTML = medications
          .map((med) => {
            const stockStatus =
              med.stock <= 0
                ? '<span class="text-xs text-red-600 font-semibold">Stok Habis</span>'
                : med.stock <= med.min_stock
                  ? `<span class="text-xs text-yellow-600 font-semibold">Stok Rendah (${med.stock})</span>`
                  : `<span class="text-xs text-green-600">Stok: ${med.stock}</span>`;

            return `
            <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary cursor-pointer transition" onclick="window.selectMedicationFromDatabase('${med.id}', '${med.name.replace(/'/g, "\\'")}', '${med.strength || ""}', ${med.stock})">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">${med.name}</p>
                  <p class="text-xs text-gray-500">${med.generic_name || ""} • ${med.unit} • ${med.strength || "-"}</p>
                </div>
                ${stockStatus}
              </div>
              <p class="text-xs text-gray-500 mt-1">Rp ${med.price_sell?.toLocaleString("id-ID") || 0}</p>
            </div>
          `;
          })
          .join("");
      } catch (err) {
        console.error("Search error:", err);
        resultsDiv.innerHTML = `<div class="text-red-500 text-center py-4 text-sm">Error: ${err.message}</div>`;
      }
    }, 300);
  });
}

// Select medication from database
window.selectMedicationFromDatabase = function (id, name, strength, stock) {
  console.log(" DEBUG - selectMedicationFromDatabase called");

  if (stock <= 0) {
    alert("Stok obat habis!");
    return;
  }

  // Gunakan window.selectedMedications
  const existing = window.selectedMedications.find(
    (m) => m.medication_id === id && !m.is_manual,
  );

  if (existing) {
    existing.qty += 1;
    console.log("✅ DEBUG - Qty incremented");
  } else {
    window.selectedMedications.push({
      medication_id: id,
      drug_name: name + (strength ? ` ${strength}` : ""),
      dose: "3x1",
      qty: 1,
      is_manual: false,
    });
    console.log("✅ DEBUG - New medication added");
  }

  console.log(
    "🔍 DEBUG - Updated window.selectedMedications:",
    window.selectedMedications,
  );
  console.log("🔍 DEBUG - Length:", window.selectedMedications.length);

  // Sync ke local variable
  selectedMedications = window.selectedMedications;

  renderMedicationList();
  document.getElementById("medication-search").value = "";
  document.getElementById("medication-search-results").innerHTML = "";
};

// Add manual medication
window.addManualMedication = function () {
  const name = document.getElementById("manual-med-name").value.trim();
  const dose = document.getElementById("manual-med-dose").value.trim();
  const qty = parseInt(document.getElementById("manual-med-qty").value) || 0;

  if (!name || qty <= 0) {
    alert("Nama obat dan qty harus diisi!");
    return;
  }

  // Gunakan window.selectedMedications
  window.selectedMedications.push({
    medication_id: null,
    drug_name: name,
    dose: dose,
    qty: qty,
    is_manual: true,
  });

  // Sync ke local variable
  selectedMedications = window.selectedMedications;

  renderMedicationList();

  document.getElementById("manual-med-name").value = "";
  document.getElementById("manual-med-dose").value = "";
  document.getElementById("manual-med-qty").value = "";
};
// Render medication list
function renderMedicationList() {
  console.log("🔍 DEBUG - renderMedicationList called");
  console.log(
    "🔍 DEBUG - selectedMedications before render:",
    selectedMedications,
  );
  console.log("🔍 DEBUG - Array length:", selectedMedications.length);

  const container = document.getElementById("rx-items");
  if (!container) return;

  if (selectedMedications.length === 0) {
    container.innerHTML =
      '<div class="text-center py-8 text-gray-500 text-sm">Belum ada obat yang ditambahkan</div>';
    return;
  }

  container.innerHTML = selectedMedications
    .map(
      (med, index) => `
    <div class="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
      <input type="text" value="${med.drug_name}" onchange="window.updateMedication(${index}, 'drug_name', this.value)" class="col-span-5 p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm">
      <input type="text" value="${med.dose}" onchange="window.updateMedication(${index}, 'dose', this.value)" class="col-span-3 p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm">
      <input type="number" value="${med.qty}" onchange="window.updateMedication(${index}, 'qty', this.value)" class="col-span-2 p-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm">
      <button onclick="window.removeMedication(${index})" class="col-span-2 text-red-500 hover:text-red-700 flex justify-center">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
      </button>
    </div>
  `,
    )
    .join("");
}

window.updateMedication = function (index, field, value) {
  selectedMedications[index][field] =
    field === "qty" ? parseInt(value) || 0 : value;
};

window.removeMedication = function (index) {
  window.selectedMedications.splice(index, 1);
  selectedMedications = window.selectedMedications;
  renderMedicationList();
};

// Submit SOAP dengan HYBRID MEDICATION (versi final yang sudah fix)
async function submitSOAPWithMedications() {
  const btn = document.getElementById("btn-save-soap");
  const msg = document.getElementById("soap-msg");

  if (btn.disabled) return;

  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  msg.classList.add("hidden");

  try {
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();
    const clinicId = profileData.clinic_id;

    // Clone array untuk avoid reference issue
    const medicationsToProcess = JSON.parse(
      JSON.stringify(window.selectedMedications || []),
    );

    console.log("🔍 Total obat:", medicationsToProcess.length);

    if (medicationsToProcess.length === 0) {
      msg.textContent = "⚠️ Tambahkan minimal 1 obat!";
      msg.className = "text-sm text-yellow-600 mt-2";
      msg.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Simpan & Kirim Farmasi";
      return;
    }

    const prescriptionItems = [];

    // Process semua obat
    for (let i = 0; i < medicationsToProcess.length; i++) {
      const med = medicationsToProcess[i];

      try {
        if (!med.is_manual && med.medication_id) {
          // Mode Database: Update stok manual (tanpa RPC)
          const { data: medData, error: fetchError } = await supabaseClient
            .from("medications")
            .select("stock, name")
            .eq("id", med.medication_id)
            .single();

          if (fetchError) throw new Error(`Gagal ambil data: ${med.drug_name}`);
          if (medData.stock < med.qty)
            throw new Error(`Stok habis: ${med.drug_name}`);

          const newStock = medData.stock - med.qty;

          // Update stok
          const { error: updateError } = await supabaseClient
            .from("medications")
            .update({ stock: newStock })
            .eq("id", med.medication_id);

          if (updateError)
            throw new Error(`Gagal update stok: ${med.drug_name}`);

          // Insert stock log
          await supabaseClient.from("medication_stock_logs").insert([
            {
              clinic_id: clinicId,
              medication_id: med.medication_id,
              type: "out",
              quantity: med.qty,
              previous_stock: medData.stock,
              new_stock: newStock,
              reference_type: "prescription",
              reference_id: currentRegistrationId,
              created_by: currentUser.id,
            },
          ]);

          prescriptionItems.push({
            drug_name: med.drug_name,
            dose: med.dose,
            qty: med.qty,
            medication_id: med.medication_id,
            is_manual: false,
          });

          console.log(`✅ ${med.drug_name} berhasil`);
        } else {
          // Mode Manual
          prescriptionItems.push({
            drug_name: med.drug_name,
            dose: med.dose,
            qty: med.qty,
            medication_id: null,
            is_manual: true,
          });
          console.log(`✅ Manual: ${med.drug_name}`);
        }
      } catch (itemError) {
        console.error(`❌ Error ${med.drug_name}:`, itemError);
        // Continue ke item berikutnya
      }
    }

    console.log("🔍 Final items:", prescriptionItems.length);

    if (prescriptionItems.length === 0) {
      msg.textContent = "❌ Tidak ada obat yang berhasil disimpan!";
      msg.className = "text-sm text-red-600 mt-2";
      msg.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Simpan & Kirim Farmasi";
      return;
    }

    // 1. Simpan SOAP (UPSERT - update jika sudah ada)
    console.log("💾 Menyimpan SOAP...");
    const soapData = {
      registration_id: currentRegistrationId,
      doctor_id: currentUser.id,
      clinic_id: clinicId,
      soap_subject: document.getElementById("soap-s")?.value || "",
      soap_objective: document.getElementById("soap-o")?.value || "",
      soap_assessment: document.getElementById("soap-a")?.value || "",
      soap_plan: document.getElementById("soap-p")?.value || "",
    };

    console.log("📦 Data SOAP:", soapData);

    const { data: soapResult, error: soapError } = await supabaseClient
      .from("medical_records")
      .upsert([soapData], {
        onConflict: "registration_id",
      })
      .select(); // ← TAMBAHKAN .select() untuk lihat hasilnya

    if (soapError) {
      console.error("❌ SOAP Error:", soapError);
      throw soapError;
    }

    console.log("✅ SOAP saved:", soapResult);

    // 2. Hapus prescription lama (jika ada)
    const { data: existingPresc } = await supabaseClient
      .from("prescriptions")
      .select("id")
      .eq("registration_id", currentRegistrationId)
      .maybeSingle();

    if (existingPresc) {
      await supabaseClient
        .from("prescriptions")
        .delete()
        .eq("id", existingPresc.id);
      console.log("🗑️ Old prescription deleted");
    }

    // 3. Insert prescription baru (dengan clinic_id!)
    const { error: prescError } = await supabaseClient
      .from("prescriptions")
      .insert([
        {
          registration_id: currentRegistrationId,
          prescribed_by: currentUser.id,
          clinic_id: clinicId, // ← PENTING!
          items: prescriptionItems,
          status: "pending",
        },
      ]);

    if (prescError) {
      console.error("❌ Prescription error:", prescError);
      throw prescError;
    }

    console.log("✅ Prescription saved");

    // 4. Update status registrasi
    await supabaseClient
      .from("registrations")
      .update({ status: "waiting_pharmacy" })
      .eq("id", currentRegistrationId);

    // GANTI bagian ini di submitSOAPWithMedications:

    msg.textContent = `✅ Berhasil! ${prescriptionItems.length} obat disimpan.`;
    msg.className = "text-sm text-green-600 mt-2";
    msg.classList.remove("hidden");

    // Reset global array
    window.selectedMedications = [];
    selectedMedications = [];

    // KEMBALIKAN KE ANTRIAN (jangan auto-print!)
    setTimeout(() => window.navigateTo("doctor-queue"), 1500);
  } catch (err) {
    console.error("❌ Error SOAP:", err);
    msg.textContent = "❌ Gagal: " + err.message;
    msg.className = "text-sm text-red-600 mt-2";
    msg.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Simpan & Kirim Farmasi";
  }
}

// --- HALAMAN: MANAJEMEN OBAT ---

async function loadMedicationsPage() {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

  try {
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();

    const { data: medications, error } = await supabaseClient
      .from("medications")
      .select("*")
      .eq("clinic_id", profileData.clinic_id)
      .order("name", { ascending: true });

    if (error) throw error;

    mainContent.innerHTML = `
      <div class="space-y-6 fade-in">
        <!-- Header dengan tombol tambah -->
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Daftar Obat Klinik</h3>
            <p class="text-gray-500 dark:text-gray-400 mt-1">Kelola stok obat dan inventory</p>
          </div>
          <button onclick="window.openMedicationModal()" class="px-4 py-2 bg-primary hover:bg-primaryHover text-white rounded-lg font-medium flex items-center gap-2 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Tambah Obat
          </button>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white dark:bg-darkCard p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <p class="text-sm text-gray-500">Total Obat</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">${medications?.length || 0}</p>
          </div>
          <div class="bg-white dark:bg-darkCard p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <p class="text-sm text-gray-500">Stok Tersedia</p>
            <p class="text-2xl font-bold text-green-600">${medications?.reduce((sum, m) => sum + (m.stock || 0), 0) || 0}</p>
          </div>
          <div class="bg-white dark:bg-darkCard p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <p class="text-sm text-gray-500">Stok Habis</p>
            <p class="text-2xl font-bold text-red-600">${medications?.filter((m) => m.stock === 0).length || 0}</p>
          </div>
          <div class="bg-white dark:bg-darkCard p-4 rounded-xl border border-gray-200 dark:border-gray-800">
            <p class="text-sm text-gray-500">Stok Rendah</p>
            <p class="text-2xl font-bold text-yellow-600">${medications?.filter((m) => m.stock > 0 && m.stock <= m.min_stock).length || 0}</p>
          </div>
        </div>

        <!-- Table -->
        <div class="bg-white dark:bg-darkCard rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Obat</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategori</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stok</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expired</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                ${
                  medications && medications.length > 0
                    ? medications
                        .map(
                          (med) => `
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition">
                    <td class="px-6 py-4">
                      <div>
                        <p class="font-semibold text-gray-900 dark:text-gray-100">${med.name}</p>
                        <p class="text-xs text-gray-500">${med.generic_name || "-"} • ${med.unit} • ${med.strength || "-"}</p>
                      </div>
                    </td>
                    <td class="px-6 py-4">
                      <span class="px-2 py-1 text-xs font-semibold rounded-full ${getCategoryBadgeColor(med.category)}">${med.category || "-"}</span>
                    </td>
                    <td class="px-6 py-4">
                      ${
                        med.stock === 0
                          ? '<span class="text-red-600 font-semibold">Habis</span>'
                          : med.stock <= med.min_stock
                            ? `<span class="text-yellow-600 font-semibold">${med.stock} (Rendah)</span>`
                            : `<span class="text-green-600">${med.stock}</span>`
                      }
                    </td>
                    <td class="px-6 py-4">
                      <p class="text-sm text-gray-900 dark:text-gray-100">Rp ${(med.price_sell || 0).toLocaleString("id-ID")}</p>
                      <p class="text-xs text-gray-500">Beli: Rp ${(med.price_buy || 0).toLocaleString("id-ID")}</p>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      ${med.expired_date ? new Date(med.expired_date).toLocaleDateString("id-ID") : "-"}
                    </td>
                    <td class="px-6 py-4">
                      <div class="flex gap-2">
                        <button onclick="window.openStockModal('${med.id}')" class="text-blue-600 hover:text-blue-800 text-sm font-medium">+ Stok</button>
                        <button onclick="window.editMedication('${med.id}')" class="text-yellow-600 hover:text-yellow-800 text-sm font-medium">Edit</button>
                        <button onclick="window.deleteMedication('${med.id}')" class="text-red-600 hover:text-red-800 text-sm font-medium">Hapus</button>
                      </div>
                    </td>
                  </tr>
                `,
                        )
                        .join("")
                    : '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Belum ada data obat</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Error loading medications:", err);
    mainContent.innerHTML = `<div class="text-red-500 text-center py-10">Gagal memuat data: ${err.message}</div>`;
  }
}

function getCategoryBadgeColor(category) {
  const colors = {
    Antibiotik: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    Analgesik:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    Vitamin:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    Antipiretik:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    Antihistamin:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    Antasida:
      "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  };
  return (
    colors[category] ||
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
  );
}

window.openMedicationModal = function (medicationId = null) {
  // Implementasi modal tambah/edit obat
  alert("Fitur tambah obat - akan diimplementasi selanjutnya");
};

window.openStockModal = function (medicationId) {
  // Implementasi modal tambah stok
  alert("Fitur tambah stok - akan diimplementasi selanjutnya");
};

window.editMedication = function (medicationId) {
  alert("Fitur edit obat - akan diimplementasi selanjutnya");
};

window.deleteMedication = async function (medicationId) {
  if (!confirm("Yakin ingin menghapus obat ini?")) return;

  try {
    await supabaseClient
      .from("medications")
      .update({ is_active: false })
      .eq("id", medicationId);

    alert("Obat berhasil dihapus (soft delete)");
    loadMedicationsPage();
  } catch (err) {
    alert("Gagal menghapus: " + err.message);
  }
};

// ========================================
// FITUR: CETAK DOKUMEN
// ========================================

let currentPrintType = null;
let currentPrintData = null;

// Buka modal cetak
window.openPrintModal = async function () {
  console.log("🖨️ Membuka modal cetak...");

  try {
    // Load data registrasi saat ini
    const { data: reg, error } = await supabaseClient
      .from("registrations")
      .select("*, patients(*), medical_records(*), prescriptions(*)")
      .eq("id", currentRegistrationId)
      .single();

    if (error) throw error;

    currentPrintData = reg;
    console.log("✅ Data registrasi dimuat:", reg);

    // Tampilkan modal
    document.getElementById("print-modal").classList.remove("hidden");
    document.getElementById("print-form-container").classList.add("hidden");
    currentPrintType = null;

    // Reset highlight tombol
    document.querySelectorAll(".print-type-btn").forEach((btn) => {
      btn.classList.remove("ring-4", "ring-primary");
    });
  } catch (err) {
    console.error("❌ Error loading data:", err);
    alert("Gagal memuat data: " + err.message);
  }
};

// Tutup modal
window.closePrintModal = function () {
  document.getElementById("print-modal").classList.add("hidden");
  currentPrintType = null;
};

// Pilih jenis dokumen
window.selectPrintType = function (type) {
  console.log("📄 Pilih dokumen:", type);
  currentPrintType = type;

  // Highlight tombol
  document.querySelectorAll(".print-type-btn").forEach((btn) => {
    btn.classList.remove("ring-4", "ring-primary");
  });
  event.currentTarget.classList.add("ring-4", "ring-primary");

  // Tampilkan form
  document.getElementById("print-form-container").classList.remove("hidden");

  const titles = {
    resep: "📝 Detail Resep Obat",
    sakit: "🤒 Surat Keterangan Sakit",
    sehat: "✅ Surat Keterangan Sehat",
    laik: "💼 Surat Keterangan Laik Kerja",
    invoice: "💰 Invoice/Struk Pembayaran",
  };

  document.getElementById("print-form-title").textContent = titles[type];
  renderPrintFormFields(type);
};

// Render form fields sesuai tipe
function renderPrintFormFields(type) {
  const container = document.getElementById("print-form-fields");
  let html = "";

  if (type === "resep") {
    html = `<div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-400">ℹ️ Resep akan otomatis terisi dari data SOAP yang sudah disimpan.</div>`;
  } else if (type === "sakit") {
    html = `
      <div><label class="block text-sm font-medium mb-1">Lama Istirahat (hari)</label>
      <input type="number" id="print-sick-days" value="3" min="1" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Tanggal Mulai</label>
      <input type="date" id="print-sick-start" value="${new Date().toISOString().split("T")[0]}" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Rekomendasi</label>
      <textarea id="print-sick-recommendation" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">Istirahat total di rumah</textarea></div>
    `;
  } else if (type === "sehat") {
    html = `
      <div><label class="block text-sm font-medium mb-1">Keperluan</label>
      <input type="text" id="print-healthy-purpose" value="Administrasi" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Kesimpulan</label>
      <textarea id="print-healthy-conclusion" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">Berdasarkan hasil pemeriksaan, pasien dinyatakan sehat.</textarea></div>
    `;
  } else if (type === "laik") {
    html = `
      <div><label class="block text-sm font-medium mb-1">Jenis Pekerjaan</label>
      <input type="text" id="print-fit-purpose" value="Pekerjaan Umum" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Hasil Pemeriksaan</label>
      <textarea id="print-fit-result" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">Secara fisik dan mental, pasien dinyatakan LAIK untuk bekerja.</textarea></div>
    `;
  } else if (type === "invoice") {
    html = `
      <div><label class="block text-sm font-medium mb-1">Biaya Konsultasi (Rp)</label>
      <input type="number" id="print-consult-fee" value="150000" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Biaya Tindakan Lain (Rp)</label>
      <input type="number" id="print-action-fee" value="0" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">ℹ️ Biaya obat akan otomatis ditambahkan dari data resep.</div>
    `;
  }

  container.innerHTML = html;
}

// Preview dokumen
window.previewPrintDocument = function () {
  if (!currentPrintType) {
    alert("Pilih jenis dokumen terlebih dahulu!");
    return;
  }

  const html = generatePrintDocument();
  const previewWindow = window.open("", "_blank", "width=800,height=600");
  previewWindow.document.write(`
    <html>
      <head>
        <title>Preview Dokumen</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .doc-header { text-align: center; border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 20px; }
          .doc-header h1 { font-size: 24px; margin: 0; }
          .doc-header h2 { font-size: 16px; margin: 5px 0; font-weight: normal; }
          .doc-title { text-align: center; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background: #f0f0f0; }
          .sign-line { border-top: 1px solid #000; width: 200px; display: inline-block; margin-top: 60px; padding-top: 5px; }
          .doc-signature { margin-top: 40px; text-align: right; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  previewWindow.document.close();
};

// Cetak dokumen
window.doPrintDocument = function () {
  if (!currentPrintType) {
    alert("Pilih jenis dokumen terlebih dahulu!");
    return;
  }

  const html = generatePrintDocument();
  const printWindow = window.open("", "_blank", "width=800,height=600");
  printWindow.document.write(`
    <html>
      <head>
        <title>Cetak Dokumen</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .doc-header { text-align: center; border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 20px; }
          .doc-header h1 { font-size: 24px; margin: 0; }
          .doc-header h2 { font-size: 16px; margin: 5px 0; font-weight: normal; }
          .doc-title { text-align: center; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 20px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          th { background: #f0f0f0; }
          .sign-line { border-top: 1px solid #000; width: 200px; display: inline-block; margin-top: 60px; padding-top: 5px; }
          .doc-signature { margin-top: 40px; text-align: right; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};

// Generate dokumen HTML
function generatePrintDocument() {
  const clinicName = "Klinik Sehat";
  const clinicAddress = "Jl. Contoh No. 123, Kota";
  const clinicPhone = "(021) 1234567";
  const doctorName = currentUser?.name || "Dr. ___";

  if (currentPrintType === "resep") {
    return generateResep(
      currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
      doctorName,
    );
  } else if (currentPrintType === "sakit") {
    return generateSuratSakit(
      currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
      doctorName,
    );
  } else if (currentPrintType === "sehat") {
    return generateSuratSehat(
      currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
      doctorName,
    );
  } else if (currentPrintType === "laik") {
    return generateSuratLaik(
      currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
      doctorName,
    );
  } else if (currentPrintType === "invoice") {
    return generateInvoice(
      currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
    );
  }

  return "<p>Dokumen tidak dikenali</p>";
}

function generateResep(
  data,
  clinicName,
  clinicAddress,
  clinicPhone,
  doctorName,
) {
  const patient = data.patients;
  const prescription = data.prescriptions?.[0];
  const items = prescription?.items || [];

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1>
      <h2>${clinicAddress}</h2>
      <p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">RESEP OBAT</div>
    <table style="border:none;">
      <tr style="border:none;"><td style="border:none;width:120px;"><strong>Nama Pasien</strong></td><td style="border:none;">: ${patient?.full_name || "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;"><strong>Tanggal Lahir</strong></td><td style="border:none;">: ${patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("id-ID") : "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;"><strong>Tanggal Resep</strong></td><td style="border:none;">: ${formatDateShort(data.created_at)}</td></tr>
    </table>
    <table>
      <thead><tr><th>No</th><th>Nama Obat</th><th>Dosis</th><th>Jumlah</th></tr></thead>
      <tbody>
        ${items.map((item, idx) => `<tr><td>${idx + 1}</td><td>${item.drug_name}</td><td>${item.dose}</td><td>${item.qty}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="doc-signature">
      <p>Dokter Penanggung Jawab,</p>
      <div class="sign-line"><strong>${doctorName}</strong></div>
    </div>
  `;
}

function generateSuratSakit(
  data,
  clinicName,
  clinicAddress,
  clinicPhone,
  doctorName,
) {
  const patient = data.patients;
  const sickDays = document.getElementById("print-sick-days")?.value || 3;
  const sickStart =
    document.getElementById("print-sick-start")?.value ||
    new Date().toISOString().split("T")[0];
  const recommendation =
    document.getElementById("print-sick-recommendation")?.value || "";
  const sickEnd = new Date(
    new Date(sickStart).getTime() + sickDays * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .split("T")[0];

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1>
      <h2>${clinicAddress}</h2>
      <p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">SURAT KETERANGAN SAKIT</div>
    <p style="text-align:center;">Nomor: ___/SKS/${new Date().getFullYear()}</p>
    <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
    <table style="border:none;">
      <tr style="border:none;"><td style="border:none;width:150px;">Nama</td><td style="border:none;">: <strong>${patient?.full_name || "-"}</strong></td></tr>
      <tr style="border:none;"><td style="border:none;">Tanggal Lahir</td><td style="border:none;">: ${patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("id-ID") : "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;">Alamat</td><td style="border:none;">: ${patient?.address || "-"}</td></tr>
    </table>
    <p>Telah diperiksa di ${clinicName} pada tanggal <strong>${formatDateShort(data.created_at)}</strong> dengan diagnosa:</p>
    <p style="background:#f0f0f0;padding:10px;border-left:3px solid #000;"><strong>${data.medical_records?.[0]?.soap_assessment || "Belum ada diagnosa"}</strong></p>
    <p>Dengan ini diberikan surat keterangan sakit untuk:</p>
    <ul>
      <li>Istirahat selama <strong>${sickDays} hari</strong></li>
      <li>Terhitung <strong>${new Date(sickStart).toLocaleDateString("id-ID")}</strong> s/d <strong>${new Date(sickEnd).toLocaleDateString("id-ID")}</strong></li>
      <li>Rekomendasi: ${recommendation}</li>
    </ul>
    <p>Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
    <div class="doc-signature">
      <p>${formatDateID(data.created_at)}</p>
      <p>Dokter Pemeriksa,</p>
      <div class="sign-line"><strong>${doctorName}</strong></div>
    </div>
  `;
}

function generateSuratSehat(
  data,
  clinicName,
  clinicAddress,
  clinicPhone,
  doctorName,
) {
  const patient = data.patients;
  const purpose =
    document.getElementById("print-healthy-purpose")?.value || "Administrasi";
  const conclusion =
    document.getElementById("print-healthy-conclusion")?.value || "";

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1>
      <h2>${clinicAddress}</h2>
      <p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">SURAT KETERANGAN SEHAT</div>
    <p style="text-align:center;">Nomor: ___/SKSEHAT/${new Date().getFullYear()}</p>
    <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
    <table style="border:none;">
      <tr style="border:none;"><td style="border:none;width:150px;">Nama</td><td style="border:none;">: <strong>${patient?.full_name || "-"}</strong></td></tr>
      <tr style="border:none;"><td style="border:none;">Tanggal Lahir</td><td style="border:none;">: ${patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("id-ID") : "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;">Jenis Kelamin</td><td style="border:none;">: ${patient?.gender === "L" ? "Laki-laki" : "Perempuan"}</td></tr>
    </table>
    <p>Telah dilakukan pemeriksaan kesehatan di ${clinicName} pada tanggal <strong>${formatDateShort(data.created_at)}</strong>.</p>
    <p><strong>Kesimpulan:</strong></p>
    <p style="background:#f0f0f0;padding:10px;border-left:3px solid #000;">${conclusion}</p>
    <p>Surat keterangan ini diberikan untuk keperluan: <strong>${purpose}</strong>.</p>
    <div class="doc-signature">
      <p>${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p>Dokter Penanggung Jawab,</p>
      <div class="sign-line"><strong>${doctorName}</strong></div>
    </div>
  `;
}

function generateSuratLaik(
  data,
  clinicName,
  clinicAddress,
  clinicPhone,
  doctorName,
) {
  const patient = data.patients;
  const purpose = document.getElementById("print-fit-purpose")?.value || "";
  const result = document.getElementById("print-fit-result")?.value || "";

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1>
      <h2>${clinicAddress}</h2>
      <p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">SURAT KETERANGAN LAIK KERJA</div>
    <p style="text-align:center;">Nomor: ___/SKLW/${new Date().getFullYear()}</p>
    <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
    <table style="border:none;">
      <tr style="border:none;"><td style="border:none;width:150px;">Nama</td><td style="border:none;">: <strong>${patient?.full_name || "-"}</strong></td></tr>
      <tr style="border:none;"><td style="border:none;">Tanggal Lahir</td><td style="border:none;">: ${patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("id-ID") : "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;">Jenis Kelamin</td><td style="border:none;">: ${patient?.gender === "L" ? "Laki-laki" : "Perempuan"}</td></tr>
    </table>
    <p>Telah dilakukan pemeriksaan kesehatan di ${clinicName} pada tanggal <strong>${formatDateShort(data.created_at)}</strong>.</p>
    <p><strong>Hasil Pemeriksaan:</strong></p>
    <p style="background:#f0f0f0;padding:10px;border-left:3px solid #000;">${result}</p>
    <p>Dengan demikian, yang bersangkutan dinyatakan <strong>LAIK</strong> untuk bekerja sebagai: <strong>${purpose}</strong>.</p>
    <div class="doc-signature">
      <p>${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p>Dokter Penanggung Jawab,</p>
      <div class="sign-line"><strong>${doctorName}</strong></div>
    </div>
  `;
}

function generateInvoice(data, clinicName, clinicAddress, clinicPhone) {
  const patient = data.patients;
  const consultFee = parseInt(
    document.getElementById("print-consult-fee")?.value || 0,
  );
  const actionFee = parseInt(
    document.getElementById("print-action-fee")?.value || 0,
  );
  const prescription = data.prescriptions?.[0];
  const items = prescription?.items || [];

  let totalMedication = 0;
  const medicationRows = items
    .map((item, idx) => {
      const price = 0;
      const subtotal = price * parseInt(item.qty);
      totalMedication += subtotal;
      return `<tr><td>${idx + 1}</td><td>${item.drug_name}</td><td>${item.qty}</td><td>Rp ${price.toLocaleString("id-ID")}</td><td>Rp ${subtotal.toLocaleString("id-ID")}</td></tr>`;
    })
    .join("");

  const grandTotal = consultFee + actionFee + totalMedication;

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1>
      <h2>${clinicAddress}</h2>
      <p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">INVOICE / STRUK PEMBAYARAN</div>
    <p style="text-align:right;">No: INV/${Date.now()}</p>
    <table style="border:none;">
      <tr style="border:none;"><td style="border:none;width:120px;">Nama Pasien</td><td style="border:none;">: ${patient?.full_name || "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;">Tanggal</td><td style="border:none;">: ${formatDateShort(data.created_at)}</td></tr>
    </table>
    <table>
      <thead><tr><th>No</th><th>Uraian</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Biaya Konsultasi</td><td>1</td><td>Rp ${consultFee.toLocaleString("id-ID")}</td><td>Rp ${consultFee.toLocaleString("id-ID")}</td></tr>
        ${actionFee > 0 ? `<tr><td>2</td><td>Biaya Tindakan</td><td>1</td><td>Rp ${actionFee.toLocaleString("id-ID")}</td><td>Rp ${actionFee.toLocaleString("id-ID")}</td></tr>` : ""}
        ${medicationRows}
      </tbody>
      <tfoot><tr><th colspan="4" style="text-align:right;">TOTAL</th><th>Rp ${grandTotal.toLocaleString("id-ID")}</th></tr></tfoot>
    </table>
    <div class="doc-signature">
      <p>Kasir,</p>
      <div class="sign-line"><strong>_______________</strong></div>
    </div>
  `;
}

// Fungsi untuk reload data dan buka modal cetak
async function loadPrintDataAndOpenModal() {
  console.log("🔄 Memuat data untuk cetak...");

  try {
    const { data: reg, error: fetchError } = await supabaseClient
      .from("registrations")
      .select(
        `
        *, 
        patients(*), 
        medical_records(*), 
        prescriptions(*)
      `,
      )
      .eq("id", currentRegistrationId)
      .single();

    if (fetchError) throw fetchError;

    console.log("✅ Data reloaded:", reg);
    console.log("📋 Medical records:", reg.medical_records);

    currentPrintData = reg;
    window.openPrintModal();
  } catch (err) {
    console.error("❌ Error:", err);
    alert("Gagal memuat data: " + err.message);
  }
}

window.handlePrintClick = async function () {
  console.log("🖨️ Tombol cetak diklik");

  // Cek apakah SOAP sudah tersimpan
  const { data: existingSOAP } = await supabaseClient
    .from("medical_records")
    .select("id")
    .eq("registration_id", currentRegistrationId)
    .maybeSingle();

  if (!existingSOAP) {
    // SOAP belum tersimpan, simpan dulu
    alert("Simpan data SOAP terlebih dahulu!");
    return;
  }

  // Reload data terbaru
  await loadPrintDataAndOpenModal();
};

checkAuth();
