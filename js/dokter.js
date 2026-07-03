import { satusehatBridge } from "./satusehat-bridge.js";
// js/dokter.js
import { supabaseClient } from "./config.js";
import { getEmptyState } from "./components.js";

// --- FUNGSI BANTU WAKTU (WIB) ---
function convertToWIB(utcDate) {
  if (!utcDate) return new Date();
  const date = new Date(utcDate);
  return new Date(date.getTime() + 7 * 60 * 60 * 1000);
}

function formatTimeID(date) {
  const wibDate = convertToWIB(date);
  return wibDate.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateID(date) {
  const wibDate = convertToWIB(date);
  return wibDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ==========================================
// STATE LOKAL DOKTER (Immutability aware)
// ==========================================
let localCurrentUser = null;
export let doctorCurrentRegistrationId = null;

// State Odontogram
let currentSelectedTooth = null;
let currentOdontogramRegId = null;
let odontogramData = {};

const ICD10_MAP = {
  healthy: null,
  caries: "K02.9",
  calculus: "K11.5",
  filled: "Z98.818",
  missing: "K08.1",
  pulpitis: "K04.0",
};

const SNOMED_MAP = {
  healthy: null,
  caries: "245627001",
  calculus: "399230001",
  filled: "399230001",
  missing: "278046003",
  pulpitis: "399230001",
};

const PRIORITY_MAP = {
  caries: 5,
  pulpitis: 4,
  calculus: 3,
  filled: 2,
  missing: 1,
  healthy: 0,
};

const CONDITION_LABELS = {
  healthy: "Sehat",
  caries: "Karies",
  calculus: "Karang Gigi",
  filled: "Tambalan",
  missing: "Hilang",
  pulpitis: "Pulpitis",
};

// State Resep Obat (Hybrid) - Gunakan closure untuk enkapsulasi
const medicationState = {
  mode: "database",
  items: [],
};

// State Keranjang Diagnosa
const diagnosisState = {
  primary: null,
  secondary: [],
};

// Helper untuk deep clone sederhana
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// ==========================================
// 1. ANTREAN DOKTER
// ==========================================
export async function loadDoctorQueue(currentUser) {
  localCurrentUser = currentUser;
  const mainContent = document.getElementById("main-content");
  showLoading(mainContent);

  try {
    const { data: profileData, error: profileError } = await supabaseClient
      .from("profiles")
      .select("clinic_id, specialization") // ← TAMBAH specialization
      .eq("id", currentUser.id)
      .single();

    if (profileError) throw new Error("Gagal memuat data profil dokter");

    const doctorPoli = profileData?.specialization; // ← AMBIL POLI DOKTER

    let query = supabaseClient // ← GANTI const JADI let
      .from("registrations")
      .select(
        "id, queue_number, complaint, target_poly, created_at, patients(full_name)",
      )
      .eq("clinic_id", profileData.clinic_id)
      .eq("status", "waiting_doctor")
      .order("created_at", { ascending: true });

    // ← FILTER BY POLI
    if (doctorPoli) {
      query = query.eq("target_poly", doctorPoli);
    }

    const { data: regs, error } = await query; // ← PAKAI query

    if (error) throw error;

    if (!regs || regs.length === 0) {
      mainContent.innerHTML = getEmptyState(
        `Belum ada pasien di ${doctorPoli || "antrian"}.`,
      );
      return;
    }

    mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto fade-in">
        <h2 class="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
          Daftar Antrean ${doctorPoli || "Semua Poli"}  <!-- JUDUL SESUAI POLI -->
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${regs
            .map(
              (r) => `
            <div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all duration-200 transform hover:-translate-y-1" 
                 onclick='window.navigateTo("input-soap", ${JSON.stringify(r).replace(/'/g, "&#39;")})'>
              <div class="flex justify-between items-start mb-3">
                <span class="px-3 py-1.5 text-xs font-bold bg-primary/10 text-primary rounded-full">${r.queue_number}</span>
                <span class="text-xs text-gray-500">${formatTimeID(r.created_at)}</span>
              </div>
              <h4 class="font-bold text-gray-900 dark:text-gray-100 text-lg mb-2">${r.patients.full_name}</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">${r.complaint || "Tidak ada keluhan"}</p>
              <div class="flex justify-between items-center">
                <span class="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300">${r.target_poly}</span>
                <span class="text-xs font-semibold text-primary flex items-center gap-1">Periksa (SOAP) <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg></span>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>`;
  } catch (err) {
    showError(mainContent, err.message);
  }
}

// ==========================================
// 2. PEMERIKSAAN SOAP & UI UTAMA DOKTER
// ==========================================
export async function loadSOAPData(regId, currentUser) {
  localCurrentUser = currentUser;
  doctorCurrentRegistrationId = regId;
  window.currentRegistrationId = regId;

  // Reset State
  resetDiagnosisState();
  resetMedicationState();

  const mainContent = document.getElementById("main-content");
  showLoading(mainContent);

  try {
    const { data: reg, error: regError } = await supabaseClient
      .from("registrations")
      .select("*, patients(full_name, medical_history)")
      .eq("id", regId)
      .single();

    if (regError) throw new Error("Gagal memuat data pendaftaran");

    const { data: ttv } = await supabaseClient
      .from("vital_signs")
      .select("*")
      .eq("registration_id", regId)
      .single();

    // Render UI
    mainContent.innerHTML = buildSOAPHTML(reg, ttv);

    // Initialize components setelah render
    await initializeSOAPComponents(reg);
  } catch (err) {
    showError(mainContent, err.message);
  }
}

function buildSOAPHTML(reg, ttv) {
  const ttvHTML = buildTTVHTML(ttv);
  const alertHTML = buildMedicalAlertHTML(reg);

  return `
    <div class="max-w-5xl mx-auto fade-in">
      <!-- Header Navigasi - Hanya tombol kembali -->
      <div class="flex justify-between items-center mb-4">
        <button onclick="window.navigateTo('doctor-queue')" 
                class="text-sm text-gray-500 hover:text-primary flex items-center gap-1 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
          </svg>
          Kembali ke Antrian
        </button>
      </div>
      
      <!-- Kartu Pasien -->
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4 shadow-sm">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              ${reg.patients.full_name}
            </h3>
            <p class="text-sm text-gray-500 mt-1">
              No. Antrian: <span class="font-bold text-primary">${reg.queue_number}</span> 
              | Poli: <span class="font-semibold">${reg.target_poly}</span>
            </p>
          </div>
          <button onclick="window.openHistoryModal('${reg.patient_id}', '${reg.patients.full_name.replace(/'/g, "\\'")}')" 
                  class="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-200 dark:border-blue-800">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            Riwayat Medis
          </button>
        </div>
        <span class="inline-block mt-3 px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">
          Menunggu Pemeriksaan Dokter
        </span>
      </div>

      ${alertHTML}
      
      <!-- Keluhan Utama -->
      <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-700">
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
          </svg>
          Keluhan Utama (Dari Pendaftaran):
        </p>
        <p class="text-gray-900 dark:text-gray-100 font-medium">
          ${reg.complaint || "Tidak ada keluhan"}
        </p>
      </div>
      
      <!-- TTV -->
      <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        <svg class="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
        Tanda-Tanda Vital (TTV)
      </h4>
      ${ttvHTML}

      <!-- Odontogram Container (hanya untuk Poli Gigi) -->
      <div id="odontogram-container"></div>

      <!-- Form SOAP -->
      <div id="soap-section" data-patient-name="${reg.patients.full_name}">
        <h4 class="font-semibold text-lg mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-100">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Catatan Medis (SOAP) & Diagnosa ICD-10
        </h4>
        
        <div class="space-y-4">
          <!-- Subjective -->
          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              S - Subjective (Keluhan Tambahan / Riwayat)
            </label>
            <textarea id="soap-s" rows="3" 
                      class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                      placeholder="Tulis keluhan tambahan atau anamnesa dari pasien..."></textarea>
          </div>
          
          <!-- Objective -->
          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              O - Objective (Hasil Pemeriksaan Fisik)
            </label>
            <textarea id="soap-o" rows="3" 
                      class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                      placeholder="Tulis hasil pemeriksaan fisik, tanda vital abnormal, dll..."></textarea>
          </div>
          
          <!-- Assessment / Diagnosa -->
          <div class="relative bg-blue-50/50 dark:bg-blue-900/10 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
            <label class="block text-sm font-semibold mb-3 text-blue-800 dark:text-blue-300">
              A - Assessment & Diagnosa (ICD-10)
            </label>
            
            <div class="relative mb-4">
              <div class="relative">
                <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                </svg>
                <input type="text" id="icd10-input" 
                       placeholder="Cari kode ICD-10 atau nama penyakit (min. 2 karakter)..."
                       class="w-full p-3 pl-10 border border-blue-300 dark:border-blue-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary transition">
              </div>
              <div id="icd10-list" class="hidden absolute z-20 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl max-h-60 overflow-y-auto mt-1"></div>
            </div>

            <div id="diagnoses-cart" class="space-y-2">
              <p class="text-sm text-gray-500 italic p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
                🔍 Belum ada diagnosa dipilih. Gunakan pencarian di atas.
              </p>
            </div>
            
            <!-- Checkbox Insiden -->
            <div class="mt-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm font-bold text-red-800 dark:text-red-400 mb-3 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                Tandai Jika Terkait Insiden (Opsional)
              </p>
              <div class="flex gap-6">
                <label class="flex items-center gap-3 text-sm cursor-pointer"><input type="checkbox" id="soap-kk" class="w-4 h-4 text-red-600 rounded" onchange="window.toggleKKModal()"> Kecelakaan Kerja</label>
                <label class="flex items-center gap-3 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-red-600 transition">
                  <input type="checkbox" id="soap-kll" class="w-4 h-4 text-red-600 rounded focus:ring-red-500">
                  Kecelakaan Lalu Lintas (KLL)
                </label>
              </div>
            </div>
          </div>
          
          <!-- Plan -->
          <div>
            <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
              P - Plan (Rencana Tindakan & Terapi)
            </label>
            <textarea id="soap-p" rows="3" 
                      class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                      placeholder="Contoh: Rawat jalan, kontrol 1 minggu, rujuk spesialis..."></textarea>
          </div>
        </div>
      </div>

      <!-- Resep Obat -->
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
        <div class="flex justify-between items-center mb-4">
          <h4 class="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
            </svg>
            Resep Obat
          </h4>
          <div class="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button onclick="window.toggleMedicationMode('database')" id="btn-mode-db" 
                    class="px-4 py-2 text-xs rounded-md bg-primary text-white font-medium transition-all shadow-sm">
              📦 Database
            </button>
            <button onclick="window.toggleMedicationMode('manual')" id="btn-mode-manual" 
                    class="px-4 py-2 text-xs rounded-md text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
              ✏️ Manual
            </button>
          </div>
        </div>
        
        <div id="medication-mode-info" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
          💡 <strong>Mode Database:</strong> Obat diambil dari stok klinik, stok akan otomatis berkurang saat disimpan.
        </div>

        <!-- Mode Database -->
        <div id="medication-database-mode" class="mb-4">
          <div class="relative mb-3">
            <input type="text" id="medication-search" 
                   class="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary transition"
                   placeholder="Cari obat berdasarkan nama, kode, atau nama generik...">
            <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <div id="medication-search-results" class="max-h-60 overflow-y-auto space-y-2 mb-3"></div>
        </div>

        <!-- Mode Manual -->
        <div id="medication-manual-mode" class="hidden mb-4">
          <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg mb-3 text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
            ⚠️ <strong>Perhatian:</strong> Obat manual tidak akan mengurangi stok database.
          </div>
          <div class="grid grid-cols-12 gap-3 items-end">
            <div class="col-span-5">
              <label class="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">Nama Obat</label>
              <input type="text" id="manual-med-name" 
                     class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                     placeholder="Paracetamol 500mg">
            </div>
            <div class="col-span-3">
              <label class="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">Dosis</label>
              <input type="text" id="manual-med-dose" 
                     class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                     placeholder="3x1">
            </div>
            <div class="col-span-2">
              <label class="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">Qty</label>
              <input type="number" id="manual-med-qty" min="1"
                     class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                     placeholder="10">
            </div>
            <div class="col-span-2">
              <button onclick="window.addManualMedication()" 
                      class="w-full px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primaryHover transition-colors font-semibold">
                + Tambah
              </button>
            </div>
          </div>
        </div>

        <!-- Daftar Obat yang Sudah Ditambahkan -->
        <div id="rx-items" class="space-y-3 mb-4"></div>
      </div>

      <!-- 🔥 TOMBOL AKSI DI BAWAH (STICKY) -->
      <div class="sticky bottom-0 z-40 bg-gradient-to-t from-gray-50 dark:from-gray-900 via-gray-50 dark:via-gray-900 to-transparent pt-4 pb-6 -mx-2 px-2">
        <div class="bg-white dark:bg-darkCard p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl">
          <div class="flex gap-3 items-center">
            <button id="btn-save-soap" 
                    class="flex-1 bg-primary hover:bg-primaryHover text-white font-semibold py-4 rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg">
              💾 Simpan & Kirim ke Farmasi
            </button>
            <button onclick="window.handlePrintClick()" 
                    class="px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-lg flex items-center gap-2 text-lg">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
              </svg>
              🖨️ Cetak Dokumen
            </button>
          </div>
          <p id="soap-msg" class="text-sm hidden mt-3 p-3 rounded-lg"></p>
        </div>
      </div>
    </div>`;
}

function buildTTVHTML(ttv) {
  if (!ttv) {
    return `
      <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-4 border border-yellow-200 dark:border-yellow-800">
        <p class="text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
          Belum ada data TTV dari perawat. Silakan minta perawat untuk input terlebih dahulu.
        </p>
      </div>`;
  }

  return `
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
      <div class="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-800">
        <p class="text-xs text-gray-500 dark:text-gray-400">Tensi</p>
        <p class="font-bold text-lg">${ttv.systolic_bp || "-"}/${ttv.diastolic_bp || "-"} 
          <span class="text-xs font-normal text-gray-500">mmHg</span>
        </p>
      </div>
      <div class="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
        <p class="text-xs text-gray-500 dark:text-gray-400">Nadi</p>
        <p class="font-bold text-lg">${ttv.heart_rate || "-"} 
          <span class="text-xs font-normal text-gray-500">x/mnt</span>
        </p>
      </div>
      <div class="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-100 dark:border-green-800">
        <p class="text-xs text-gray-500 dark:text-gray-400">Suhu</p>
        <p class="font-bold text-lg">${ttv.temperature || "-"} 
          <span class="text-xs font-normal text-gray-500">°C</span>
        </p>
      </div>
      <div class="bg-purple-50 dark:bg-purple-900/10 p-3 rounded-lg border border-purple-100 dark:border-purple-800">
        <p class="text-xs text-gray-500 dark:text-gray-400">BB</p>
        <p class="font-bold text-lg">${ttv.weight || "-"} 
          <span class="text-xs font-normal text-gray-500">kg</span>
        </p>
      </div>
      <div class="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-lg border border-orange-100 dark:border-orange-800">
        <p class="text-xs text-gray-500 dark:text-gray-400">TB</p>
        <p class="font-bold text-lg">${ttv.height || "-"} 
          <span class="text-xs font-normal text-gray-500">cm</span>
        </p>
      </div>
    </div>
    ${
      ttv.notes
        ? `
    <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-4 border border-yellow-200 dark:border-yellow-800">
      <p class="text-xs font-semibold text-yellow-800 dark:text-yellow-400 mb-1">📝 Catatan Perawat:</p>
      <p class="text-sm text-yellow-900 dark:text-yellow-300">${ttv.notes}</p>
    </div>`
        : ""
    }`;
}

function buildMedicalAlertHTML(reg) {
  const historyText = reg.patients.medical_history;
  const hasHistory = historyText && historyText.trim() !== "";

  const colorClasses = hasHistory
    ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
    : "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-500";

  const iconColor = hasHistory
    ? "text-red-600 dark:text-red-400"
    : "text-yellow-600 dark:text-yellow-500";

  return `
    <div class="mb-4 p-4 rounded-xl border shadow-sm ${colorClasses}">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <p class="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${iconColor}">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            Peringatan Medis / Alergi
          </p>
          <p class="font-bold text-sm">
            ${hasHistory ? historyText : "Belum ada catatan riwayat alergi atau penyakit kronis."}
          </p>
          ${hasHistory ? '<p class="text-xs mt-1 opacity-75">⚠️ Harap perhatikan sebelum memberikan resep!</p>' : ""}
        </div>
        <button onclick="window.updatePatientHistory('${reg.patient_id}', '${(historyText || "").replace(/'/g, "\\'")}')" 
                class="ml-4 px-4 py-2 bg-white/80 hover:bg-white border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-200 transition shadow-sm whitespace-nowrap">
          ✏️ Update
        </button>
      </div>
    </div>`;
}

async function initializeSOAPComponents(reg) {
  // Setup ICD-10 Search
  setupICD10();

  // Setup Medication Search
  setupMedicationSearch();

  // Render empty medication list
  renderMedicationList();

  // Setup save button
  document
    .getElementById("btn-save-soap")
    .addEventListener("click", submitSOAPWithMedications);

  // Load Odontogram jika Poli Gigi
  if (reg.target_poly === "Poli Gigi") {
    await loadOdontogramForSOAP(reg.id);
  }
}

// ==========================================
// 3. PENCARIAN ICD-10 & KERANJANG DIAGNOSA - DIPERBAIKI
// ==========================================
function setupICD10() {
  const input = document.getElementById("icd10-input");
  const list = document.getElementById("icd10-list");
  let searchTimer;
  let selectedIndex = -1; // Untuk keyboard navigation

  if (!input || !list) return;

  input.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    selectedIndex = -1; // Reset selection

    if (query.length < 2) {
      list.classList.add("hidden");
      return;
    }

    searchTimer = setTimeout(async () => {
      try {
        // 🔥 PERBAIKAN: Sanitasi yang lebih baik
        // Hanya hapus karakter yang benar-benar berbahaya untuk SQL
        // Tapi pertahankan spasi, koma, titik, dan karakter umum lainnya
        const safeQuery = query
          .replace(/['"\\;]/g, "") // Hanya hapus karakter berbahaya untuk SQL
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim();

        if (safeQuery.length < 2) {
          list.classList.add("hidden");
          return;
        }

        // Tampilkan loading
        list.innerHTML = `
          <div class="p-4 text-center">
            <div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p class="text-sm text-gray-500">Mencari "${safeQuery}"...</p>
          </div>`;
        list.classList.remove("hidden");

        // 🔥 PERBAIKAN: Multiple search strategies
        let allResults = [];

        // Strategy 1: Exact code match (paling akurat)
        const { data: exactCode } = await supabaseClient
          .from("icd10_codes")
          .select("*")
          .eq("code", safeQuery.toUpperCase())
          .limit(5);

        if (exactCode) allResults = [...exactCode];

        // Strategy 2: Code starts with (untuk pencarian parsial seperti "J0")
        const { data: startsWithCode } = await supabaseClient
          .from("icd10_codes")
          .select("*")
          .ilike("code", `${safeQuery}%`)
          .limit(10);

        if (startsWithCode) {
          // Merge tanpa duplikasi
          startsWithCode.forEach((item) => {
            if (!allResults.find((r) => r.code === item.code)) {
              allResults.push(item);
            }
          });
        }

        // Strategy 3: Description contains (paling fleksibel)
        if (allResults.length < 10) {
          const { data: byDescription } = await supabaseClient
            .from("icd10_codes")
            .select("*")
            .or(
              `description.ilike.%${safeQuery}%,description.ilike.%${safeQuery.split(" ").join("%")}%`,
            )
            .limit(15);

          if (byDescription) {
            byDescription.forEach((item) => {
              if (!allResults.find((r) => r.code === item.code)) {
                allResults.push(item);
              }
            });
          }
        }

        // Strategy 4: Full text search untuk kata kunci (misal: "headache")
        if (allResults.length < 5) {
          // Pisah kata kunci dan cari satu per satu
          const keywords = safeQuery
            .split(/[\s,]+/)
            .filter((k) => k.length >= 2);

          for (const keyword of keywords) {
            const { data: keywordResults } = await supabaseClient
              .from("icd10_codes")
              .select("*")
              .ilike("description", `%${keyword}%`)
              .limit(5);

            if (keywordResults) {
              keywordResults.forEach((item) => {
                if (!allResults.find((r) => r.code === item.code)) {
                  allResults.push(item);
                }
              });
            }
          }
        }

        // Batasi hasil maksimal 15
        allResults = allResults.slice(0, 15);

        if (allResults.length > 0) {
          list.innerHTML = allResults
            .map(
              (item, index) => `
              <div class="p-3 cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${index === selectedIndex ? "bg-primary/10 border-l-4 border-l-primary" : ""}" 
                   onclick="window.addDiagnosisToCart('${item.code}', '${item.description.replace(/'/g, "\\'")}')"
                   onmouseenter="this.classList.add('bg-primary/5', 'dark:bg-primary/10')"
                   onmouseleave="this.classList.remove('bg-primary/5', 'dark:bg-primary/10')">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="font-bold text-primary text-sm bg-primary/10 px-2 py-0.5 rounded">${item.code}</span>
                      <span class="text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500">ICD-10</span>
                      ${item.code === safeQuery.toUpperCase() ? '<span class="text-[10px] bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">✓ Exact Match</span>' : ""}
                    </div>
                    <p class="text-sm text-gray-700 dark:text-gray-300">
                      ${highlightMatch(item.description, safeQuery)}
                    </p>
                  </div>
                  <button onclick="event.stopPropagation(); window.addDiagnosisToCart('${item.code}', '${item.description.replace(/'/g, "\\'")}')" 
                          class="ml-2 px-2 py-1 text-xs bg-primary text-white rounded hover:bg-primaryHover transition"
                          title="Pilih diagnosa ini">
                    + Pilih
                  </button>
                </div>
              </div>`,
            )
            .join("");

          // Tampilkan info jumlah hasil
          if (allResults.length >= 15) {
            list.innerHTML += `
              <div class="p-2 text-center text-xs text-gray-400 bg-gray-50 dark:bg-gray-900/50">
                Menampilkan 15 hasil teratas. Persempit pencarian untuk hasil lebih spesifik.
              </div>`;
          }
        } else {
          list.innerHTML = `
            <div class="p-6 text-center">
              <p class="text-2xl mb-2">🔍</p>
              <p class="text-gray-500 font-medium">Tidak ditemukan untuk "${query}"</p>
              <p class="text-xs text-gray-400 mt-2">Coba tips berikut:</p>
              <ul class="text-xs text-gray-400 mt-2 space-y-1">
                <li>• Gunakan kode ICD-10 (contoh: J00, K02)</li>
                <li>• Gunakan kata kunci penyakit (contoh: headache, diabetes)</li>
                <li>• Cek ejaan dan hindari singkatan</li>
              </ul>
            </div>`;
        }
      } catch (err) {
        console.error("Error pencarian ICD-10:", err);
        list.innerHTML = `
          <div class="p-4 text-center">
            <p class="text-red-500 text-sm">⚠️ Gagal mencari data ICD-10</p>
            <p class="text-xs text-red-400 mt-1">${err.message}</p>
            <button onclick="window.retryICD10Search()" class="mt-2 text-xs text-primary hover:underline">
              Coba Lagi
            </button>
          </div>`;
      }
    }, 400); // Debounce 400ms
  });

  // Keyboard navigation
  input.addEventListener("keydown", (e) => {
    const items = list.querySelectorAll("div[onclick]");

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateSelection(items);
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      items[selectedIndex]?.click();
    } else if (e.key === "Escape") {
      list.classList.add("hidden");
      input.blur();
      selectedIndex = -1;
    }
  });

  // Sembunyikan list saat klik di luar
  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.classList.add("hidden");
      selectedIndex = -1;
    }
  });

  // Focus kembali ke input setelah memilih
  window.afterDiagnosisSelected = function () {
    input.value = "";
    input.focus();
    list.classList.add("hidden");
    selectedIndex = -1;
  };
}

// Helper function untuk highlight teks yang match
function highlightMatch(text, query) {
  if (!query || query.length < 2) return text;

  try {
    const words = query.split(/[\s,]+/).filter((w) => w.length >= 2);
    let highlighted = text;

    words.forEach((word) => {
      const regex = new RegExp(
        `(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );
      highlighted = highlighted.replace(
        regex,
        '<mark class="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">$1</mark>',
      );
    });

    return highlighted;
  } catch (e) {
    return text;
  }
}

function updateSelection(items) {
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add("bg-primary/10", "border-l-4", "border-l-primary");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("bg-primary/10", "border-l-4", "border-l-primary");
    }
  });
}

// Retry function
window.retryICD10Search = function () {
  const input = document.getElementById("icd10-input");
  if (input && input.value.trim().length >= 2) {
    // Trigger input event untuk memulai ulang pencarian
    input.dispatchEvent(new Event("input"));
  }
};

// Update addDiagnosisToCart untuk clear input setelah pilih
const originalAddDiagnosis = window.addDiagnosisToCart;
window.addDiagnosisToCart = function (code, name) {
  originalAddDiagnosis(code, name);

  // Clear input setelah memilih
  const input = document.getElementById("icd10-input");
  const list = document.getElementById("icd10-list");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (list) {
    list.classList.add("hidden");
  }
};

window.addDiagnosisToCart = function (code, name) {
  if (!diagnosisState.primary) {
    diagnosisState.primary = { code, name };
  } else {
    // Cek duplikasi
    const isDuplicate =
      diagnosisState.primary.code === code ||
      diagnosisState.secondary.some((d) => d.code === code);

    if (isDuplicate) {
      alert("⚠️ Diagnosa ini sudah ada dalam daftar!");
      return;
    }

    diagnosisState.secondary.push({ code, name });
  }

  renderDiagnosesCart();

  // Clear input
  const input = document.getElementById("icd10-input");
  if (input) {
    input.value = "";
    input.focus();
  }
  document.getElementById("icd10-list")?.classList.add("hidden");
};

window.removeDiagnosis = function (type, index) {
  if (type === "primary") {
    diagnosisState.primary = null;
    // Promote secondary pertama menjadi primary
    if (diagnosisState.secondary.length > 0) {
      diagnosisState.primary = diagnosisState.secondary.shift();
    }
  } else {
    diagnosisState.secondary.splice(index, 1);
  }
  renderDiagnosesCart();
};

function renderDiagnosesCart() {
  const cart = document.getElementById("diagnoses-cart");
  if (!cart) return;

  if (!diagnosisState.primary && diagnosisState.secondary.length === 0) {
    cart.innerHTML = `
      <p class="text-sm text-gray-500 italic p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 text-center">
        🔍 Belum ada diagnosa dipilih. Gunakan pencarian di atas.
      </p>`;
    return;
  }

  let html = "";

  if (diagnosisState.primary) {
    html += `
      <div class="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
            UTAMA
          </span>
          <div>
            <span class="font-bold text-sm text-gray-900 dark:text-gray-100">${diagnosisState.primary.code}</span>
            <span class="text-sm text-gray-600 dark:text-gray-400"> - ${diagnosisState.primary.name}</span>
          </div>
        </div>
        <button onclick="window.removeDiagnosis('primary')" 
                class="text-red-500 hover:text-red-700 font-bold text-lg p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                title="Hapus diagnosa utama">
          ×
        </button>
      </div>`;
  }

  diagnosisState.secondary.forEach((d, idx) => {
    html += `
      <div class="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-3">
          <span class="text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
            PENYERTA
          </span>
          <div>
            <span class="font-bold text-sm text-gray-900 dark:text-gray-100">${d.code}</span>
            <span class="text-sm text-gray-600 dark:text-gray-400"> - ${d.name}</span>
          </div>
        </div>
        <button onclick="window.removeDiagnosis('secondary', ${idx})" 
                class="text-red-400 hover:text-red-600 font-bold text-lg p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                title="Hapus diagnosa penyerta">
          ×
        </button>
      </div>`;
  });

  cart.innerHTML = html;
}

function resetDiagnosisState() {
  diagnosisState.primary = null;
  diagnosisState.secondary = [];
}

// ==========================================
// 4. ODONTOGRAM (POLI GIGI) - DIPERBAIKI
// ==========================================
async function loadOdontogramForSOAP(registrationId) {
  currentOdontogramRegId = registrationId;
  odontogramData = {};

  try {
    const { data: records, error } = await supabaseClient
      .from("dental_records")
      .select("tooth_number, condition_type")
      .eq("registration_id", registrationId);

    if (error) throw error;

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

    const odontogramHTML = buildOdontogramSection();
    const container = document.getElementById("odontogram-container");
    if (container) {
      container.innerHTML = odontogramHTML;
      setTimeout(
        () => renderOdontogramChart("odontogram-chart-preview", odontogramData),
        100,
      );
    }
  } catch (err) {
    console.error("Error loading odontogram:", err);
  }
}

function buildOdontogramSection() {
  return `
    <div id="odontogram-section" 
         class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4 shadow-sm fade-in">
      <div class="flex justify-between items-center mb-4">
        <h4 class="font-semibold text-lg flex items-center gap-2 text-gray-800 dark:text-gray-100">
          <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Odontogram
        </h4>
        <span class="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-full font-medium">
          🦷 Klik gigi untuk ubah kondisi
        </span>
      </div>
      <div id="odontogram-chart-preview"></div>
    </div>`;
}

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

  let html = '<div class="space-y-6">';

  // Render quadrants dalam 2 baris
  [quadrants.slice(0, 2), quadrants.slice(2, 4)].forEach((row) => {
    html += '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    row.forEach((q) => {
      html += `
        <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
          <p class="text-xs text-center text-gray-500 dark:text-gray-400 mb-3 font-semibold uppercase tracking-wider">
            ${q.label}
          </p>
          <div class="grid grid-cols-8 gap-1.5">`;

      q.teeth.forEach((tooth) => {
        const conditions = data[tooth] || [];

        // Tentukan kondisi utama untuk warna
        let primaryCondition = "healthy";
        let maxPriority = 0;
        conditions.forEach((cond) => {
          if ((PRIORITY_MAP[cond] || 0) > maxPriority) {
            maxPriority = PRIORITY_MAP[cond];
            primaryCondition = cond;
          }
        });

        const toothNumber = parseInt(tooth);
        const isPermanent = toothNumber >= 11;

        // Generate label kondisi
        let conditionLabels = [];
        conditions.forEach((cond) => {
          if (CONDITION_LABELS[cond]) {
            conditionLabels.push(CONDITION_LABELS[cond]);
          }
        });

        const tooltipText =
          conditions.length > 0 ? conditionLabels.join(", ") : "Sehat";

        html += `
          <div class="relative group" onclick="window.openToothModal('${tooth}')">
            <div class="tooth-cell ${getToothColorClass(primaryCondition)} cursor-pointer hover:scale-110 transition-all duration-200 border-2 rounded-lg aspect-square flex flex-col items-center justify-center text-xs font-bold shadow-sm hover:shadow-md"
                 title="${tooth} - ${tooltipText}">
              <span class="text-[10px]">${tooth}</span>
              ${
                conditions.length > 1
                  ? `<span class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center font-bold shadow-sm">
                  ${conditions.length}
                </span>`
                  : ""
              }
            </div>
            <div class="opacity-0 group-hover:opacity-100 absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded whitespace-nowrap transition-opacity pointer-events-none z-10">
              ${tooltipText}
            </div>
          </div>`;
      });

      html += `</div></div>`;
    });
    html += "</div>";
  });

  // Legend
  html += `
    <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
      <p class="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">Keterangan Warna:</p>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 bg-white border-2 border-gray-300 rounded-md"></div>
          <span>Sehat</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 bg-red-500 border-2 border-red-600 rounded-md"></div>
          <span>Karies</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 bg-yellow-500 border-2 border-yellow-600 rounded-md"></div>
          <span>Karang Gigi</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 bg-blue-500 border-2 border-blue-600 rounded-md"></div>
          <span>Tambalan</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 bg-gray-800 border-2 border-gray-900 rounded-md"></div>
          <span>Hilang</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 bg-purple-500 border-2 border-purple-600 rounded-md"></div>
          <span>Pulpitis</span>
        </div>
      </div>
      <p class="text-[10px] text-gray-400 mt-2">💡 Satu gigi bisa memiliki beberapa kondisi (angka menunjukkan jumlah kondisi)</p>
    </div>`;

  container.innerHTML = html;
}

function getToothColorClass(condition) {
  const colorMap = {
    healthy: "bg-white border-gray-300 text-gray-800 hover:border-gray-400",
    caries: "bg-red-500 border-red-600 text-white hover:bg-red-600",
    calculus: "bg-yellow-500 border-yellow-600 text-white hover:bg-yellow-600",
    filled: "bg-blue-500 border-blue-600 text-white hover:bg-blue-600",
    missing: "bg-gray-800 border-gray-900 text-white hover:bg-gray-900",
    pulpitis: "bg-purple-500 border-purple-600 text-white hover:bg-purple-600",
  };
  return colorMap[condition] || colorMap.healthy;
}

window.openToothModal = async function (toothNumber) {
  currentSelectedTooth = toothNumber;

  // Cek apakah modal sudah ada
  let modal = document.getElementById("odontogram-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "odontogram-modal";
    modal.className =
      "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 hidden backdrop-blur-sm";
    modal.innerHTML = buildToothModalHTML();
    document.body.appendChild(modal);
  }

  try {
    // Load existing conditions
    const { data: conditions } = await supabaseClient
      .from("dental_records")
      .select("condition_type, notes")
      .eq("registration_id", currentOdontogramRegId)
      .eq("tooth_number", toothNumber);

    const activeConditions = conditions?.map((c) => c.condition_type) || [];

    // Update modal title
    document.getElementById("odontogram-tooth-title").textContent =
      `Gigi Nomor: ${toothNumber}`;

    // Update condition buttons
    document.querySelectorAll(".condition-btn").forEach((btn) => {
      const condition = btn.getAttribute("data-condition");
      const isActive = activeConditions.includes(condition);

      btn.classList.toggle("ring-4", isActive);
      btn.classList.toggle("ring-primary", isActive);
      btn.classList.toggle("bg-primary/10", isActive);

      const statusEl = btn.querySelector(".condition-status");
      if (statusEl) {
        statusEl.textContent = isActive ? "✓ Aktif" : "";
        statusEl.className = `condition-status text-xs mt-1 font-semibold ${isActive ? "text-primary" : ""}`;
      }
    });

    // Set notes
    document.getElementById("tooth-notes").value = conditions?.[0]?.notes || "";

    // Show modal
    modal.classList.remove("hidden");
  } catch (err) {
    alert("❌ Gagal memuat data gigi: " + err.message);
  }
};

function buildToothModalHTML() {
  return `
    <div class="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
      <div class="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
        <h3 class="font-bold text-xl" id="odontogram-tooth-title">Gigi Nomor: -</h3>
        <button onclick="window.closeOdontogramModal()" class="text-gray-400 hover:text-red-500 transition p-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      
      <div class="p-6">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Pilih satu atau lebih kondisi gigi:</p>
        
        <div class="grid grid-cols-2 gap-3 mb-6">
          ${Object.entries(CONDITION_LABELS)
            .map(
              ([key, label]) => `
            <button class="condition-btn p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-primary transition-all text-left" 
                    data-condition="${key}" 
                    onclick="window.toggleToothCondition('${key}')">
              <div class="font-semibold text-sm">${label}</div>
              <div class="condition-status text-xs mt-1"></div>
            </button>
          `,
            )
            .join("")}
        </div>
        
        <div>
          <label class="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
            Catatan Khusus Gigi:
          </label>
          <textarea id="tooth-notes" rows="3" 
                    class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Contoh: Karies profunda, perlu rontgen..."></textarea>
        </div>
        
        <div class="flex gap-3 mt-6">
          <button onclick="window.saveToothNotes()" 
                  class="flex-1 bg-primary hover:bg-primaryHover text-white font-semibold py-2.5 rounded-lg transition-colors">
            💾 Simpan Catatan
          </button>
          <button onclick="window.closeOdontogramModal()" 
                  class="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors">
            Tutup
          </button>
        </div>
      </div>
    </div>`;
}

window.closeOdontogramModal = function () {
  const modal = document.getElementById("odontogram-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  currentSelectedTooth = null;
};

window.toggleToothCondition = async function (condition) {
  if (!currentSelectedTooth || !currentOdontogramRegId) return;

  try {
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", localCurrentUser.id)
      .single();

    if (!profileData?.clinic_id) throw new Error("Data klinik tidak ditemukan");

    // Check existing condition
    const { data: existing } = await supabaseClient
      .from("dental_records")
      .select("id")
      .eq("registration_id", currentOdontogramRegId)
      .eq("tooth_number", currentSelectedTooth)
      .eq("condition_type", condition)
      .maybeSingle();

    if (existing) {
      // Remove condition
      await supabaseClient
        .from("dental_records")
        .delete()
        .eq("id", existing.id);
    } else {
      // Add condition
      await supabaseClient.from("dental_records").insert([
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
    }

    // Reload odontogram data
    await reloadOdontogramData();

    // Refresh modal
    await window.openToothModal(currentSelectedTooth);
  } catch (err) {
    window.showError("Gagal menyimpan kondisi gigi: " + err.message);
  }
};

window.saveToothNotes = async function () {
  if (!currentSelectedTooth || !currentOdontogramRegId) return;

  const notes = document.getElementById("tooth-notes")?.value || "";

  try {
    // Update notes untuk semua records gigi ini
    const { error } = await supabaseClient
      .from("dental_records")
      .update({ notes: notes })
      .eq("registration_id", currentOdontogramRegId)
      .eq("tooth_number", currentSelectedTooth);

    if (error) throw error;

    alert("✅ Catatan berhasil disimpan!");

    // Reload data
    await reloadOdontogramData();
  } catch (err) {
    alert("❌ Gagal menyimpan catatan: " + err.message);
  }
};

async function reloadOdontogramData() {
  const { data: records } = await supabaseClient
    .from("dental_records")
    .select("tooth_number, condition_type")
    .eq("registration_id", currentOdontogramRegId);

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

// ==========================================
// 5. RESEP OBAT (HYBRID MEDICATION) - DIPERBAIKI
// ==========================================
window.toggleMedicationMode = function (mode) {
  medicationState.mode = mode;

  const btnDb = document.getElementById("btn-mode-db");
  const btnManual = document.getElementById("btn-mode-manual");
  const sectionDb = document.getElementById("medication-database-mode");
  const sectionManual = document.getElementById("medication-manual-mode");
  const infoBox = document.getElementById("medication-mode-info");

  if (mode === "database") {
    btnDb.className =
      "px-4 py-2 text-xs rounded-md bg-primary text-white font-medium transition-all shadow-sm";
    btnManual.className =
      "px-4 py-2 text-xs rounded-md text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all";
    sectionDb?.classList.remove("hidden");
    sectionManual?.classList.add("hidden");
    if (infoBox) {
      infoBox.innerHTML =
        "💡 <strong>Mode Database:</strong> Obat diambil dari stok klinik, stok akan otomatis berkurang saat disimpan.";
      infoBox.className =
        "mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800";
    }
  } else {
    btnManual.className =
      "px-4 py-2 text-xs rounded-md bg-primary text-white font-medium transition-all shadow-sm";
    btnDb.className =
      "px-4 py-2 text-xs rounded-md text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all";
    sectionManual?.classList.remove("hidden");
    sectionDb?.classList.add("hidden");
    if (infoBox) {
      infoBox.innerHTML =
        "📝 <strong>Mode Manual:</strong> Input bebas untuk resep eksternal, stok tidak akan berkurang.";
      infoBox.className =
        "mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800";
    }
  }
};

function setupMedicationSearch() {
  const input = document.getElementById("medication-search");
  if (!input) return;

  let searchTimer;

  input.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();

    if (query.length < 2) {
      const resultsDiv = document.getElementById("medication-search-results");
      if (resultsDiv) resultsDiv.innerHTML = "";
      return;
    }

    searchTimer = setTimeout(async () => {
      const resultsDiv = document.getElementById("medication-search-results");
      if (!resultsDiv) return;

      resultsDiv.innerHTML = `
        <div class="text-center py-6">
          <div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p class="text-sm text-gray-500">Mencari obat...</p>
        </div>`;

      try {
        const { data: profileData } = await supabaseClient
          .from("profiles")
          .select("clinic_id")
          .eq("id", localCurrentUser.id)
          .single();

        if (!profileData?.clinic_id)
          throw new Error("Data klinik tidak ditemukan");

        const { data: medications, error } = await supabaseClient
          .from("medications")
          .select("*")
          .eq("clinic_id", profileData.clinic_id)
          .or(
            `name.ilike.%${query}%,code.ilike.%${query}%,generic_name.ilike.%${query}%`,
          )
          .eq("is_active", true)
          .order("expired_date", { ascending: true, nullsFirst: false })
          .limit(10);

        if (error) throw error;

        if (!medications || medications.length === 0) {
          resultsDiv.innerHTML = `
            <div class="text-center py-6 text-gray-500">
              <p class="text-lg mb-2">🔍</p>
              <p class="text-sm">Tidak ada obat ditemukan</p>
              <p class="text-xs mt-1">Coba gunakan kata kunci lain</p>
            </div>`;
          return;
        }

        resultsDiv.innerHTML = medications
          .map((med) => {
            const stockStatus =
              med.stock <= 0
                ? '<span class="text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">Stok Habis</span>'
                : `<span class="text-xs text-green-600 font-semibold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">Stok: ${med.stock}</span>`;

            let expBadge = "";
            if (med.expired_date) {
              const today = new Date();
              const expDate = new Date(med.expired_date);
              const diffTime = expDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const formattedExp = expDate.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              if (diffDays < 0) {
                expBadge = `<span class="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">⛔ KADALUARSA</span>`;
              } else if (diffDays <= 90) {
                expBadge = `<span class="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded font-bold">⚠️ Exp: ${formattedExp}</span>`;
              } else if (diffDays <= 180) {
                expBadge = `<span class="text-[10px] bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded font-bold">⏳ Exp: ${formattedExp}</span>`;
              } else {
                expBadge = `<span class="text-[10px] text-gray-500">Exp: ${formattedExp}</span>`;
              }
            }

            return `
            <div class="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary cursor-pointer transition-all ${med.stock <= 0 ? "opacity-60 cursor-not-allowed" : ""}" 
                 onclick="${med.stock > 0 ? `window.addMedicationFromDatabase('${med.id}', '${med.name.replace(/'/g, "\\'")}', '${med.strength || ""}', ${med.stock})` : ""}">
              <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                  <p class="font-semibold text-gray-900 dark:text-gray-100">${med.name}</p>
                  ${med.generic_name ? `<p class="text-xs text-primary font-medium italic">${med.generic_name}</p>` : ""}
                </div>
                ${stockStatus}
              </div>
              <div class="flex justify-between items-center mt-2">
                <p class="text-xs text-gray-500">${med.unit} • ${med.strength || "N/A"}</p>
                ${expBadge}
              </div>
            </div>`;
          })
          .join("");
      } catch (err) {
        console.error("Error searching medications:", err);
        resultsDiv.innerHTML = `
          <div class="text-center py-6 text-red-500">
            <p>❌ Gagal mencari obat</p>
            <p class="text-xs mt-1">${err.message}</p>
          </div>`;
      }
    }, 400);
  });
}

window.addMedicationFromDatabase = function (id, name, strength, stock) {
  if (stock <= 0) {
    window.showError("Stok obat habis!");
    return;
  }

  const existing = medicationState.items.find(
    (m) => m.medication_id === id && !m.is_manual,
  );

  if (existing) {
    if (existing.qty >= stock) {
      alert(`⚠️ Stok tidak mencukupi! Maksimal ${stock} unit.`);
      return;
    }
    existing.qty += 1;
  } else {
    medicationState.items.push({
      medication_id: id,
      drug_name: name + (strength ? ` ${strength}` : ""),
      dose: "3x1",
      qty: 1,
      is_manual: false,
      max_stock: stock,
    });
  }

  renderMedicationList();

  // Clear search
  const searchInput = document.getElementById("medication-search");
  const resultsDiv = document.getElementById("medication-search-results");
  if (searchInput) searchInput.value = "";
  if (resultsDiv) resultsDiv.innerHTML = "";
};

window.addManualMedication = function () {
  const name = document.getElementById("manual-med-name")?.value.trim();
  const dose = document.getElementById("manual-med-dose")?.value.trim();
  const qty = parseInt(document.getElementById("manual-med-qty")?.value) || 0;

  if (!name) {
    alert("⚠️ Nama obat harus diisi!");
    return;
  }

  if (qty <= 0) {
    alert("⚠️ Jumlah obat harus lebih dari 0!");
    return;
  }

  medicationState.items.push({
    medication_id: null,
    drug_name: name,
    dose: dose || "1x1",
    qty: qty,
    is_manual: true,
  });

  renderMedicationList();

  // Clear form
  document.getElementById("manual-med-name").value = "";
  document.getElementById("manual-med-dose").value = "";
  document.getElementById("manual-med-qty").value = "";
};

function renderMedicationList() {
  const container = document.getElementById("rx-items");
  if (!container) return;

  if (medicationState.items.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
        <p class="text-gray-400 dark:text-gray-500 text-lg mb-2">💊</p>
        <p class="text-gray-500 dark:text-gray-400 text-sm">Belum ada obat ditambahkan</p>
        <p class="text-gray-400 dark:text-gray-500 text-xs mt-1">Gunakan mode Database atau Manual di atas</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-2 border border-gray-200 dark:border-gray-700">
      <div class="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
        <div class="col-span-5">Nama Obat</div>
        <div class="col-span-3">Dosis</div>
        <div class="col-span-3">Jumlah</div>
        <div class="col-span-1"></div>
      </div>
    </div>
    ${medicationState.items
      .map(
        (med, index) => `
      <div class="grid grid-cols-12 gap-2 items-center bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary/30 transition-all">
        <div class="col-span-5">
          <input type="text" value="${med.drug_name}" 
                 onchange="window.updateMedication(${index}, 'drug_name', this.value)" 
                 class="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                 placeholder="Nama obat">
          ${
            med.is_manual
              ? '<span class="text-[10px] bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded mt-1 inline-block">Manual</span>'
              : '<span class="text-[10px] bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded mt-1 inline-block">Database</span>'
          }
        </div>
        <div class="col-span-3">
          <input type="text" value="${med.dose}" 
                 onchange="window.updateMedication(${index}, 'dose', this.value)" 
                 class="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                 placeholder="3x1">
        </div>
        <div class="col-span-3">
          <input type="number" value="${med.qty}" min="1" max="${med.max_stock || 999}"
                 onchange="window.updateMedication(${index}, 'qty', this.value)" 
                 class="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                 placeholder="10">
          ${!med.is_manual && med.max_stock ? `<p class="text-[10px] text-gray-400 mt-1">Maks: ${med.max_stock}</p>` : ""}
        </div>
        <div class="col-span-1 flex justify-center">
          <button onclick="window.removeMedication(${index})" 
                  class="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                  title="Hapus obat">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>
    `,
      )
      .join("")}`;
}

window.updateMedication = function (index, field, value) {
  if (index < 0 || index >= medicationState.items.length) return;

  if (field === "qty") {
    const qty = parseInt(value) || 0;
    const med = medicationState.items[index];

    // Validate stock for database medications
    if (!med.is_manual && med.max_stock && qty > med.max_stock) {
      alert(`⚠️ Stok tidak mencukupi! Maksimal ${med.max_stock} unit.`);
      medicationState.items[index].qty = med.max_stock;
    } else {
      medicationState.items[index].qty = Math.max(0, qty);
    }
  } else {
    medicationState.items[index][field] = value;
  }

  renderMedicationList();
};

window.removeMedication = function (index) {
  if (confirm("Apakah Anda yakin ingin menghapus obat ini dari resep?")) {
    medicationState.items.splice(index, 1);
    renderMedicationList();
  }
};

function resetMedicationState() {
  medicationState.mode = "database";
  medicationState.items = [];
}

// ==========================================
// 6. SUBMIT SOAP & RESEP - TRANSAKSI AMAN
// ==========================================
async function submitSOAPWithMedications() {
  const btn = document.getElementById("btn-save-soap");
  const msg = document.getElementById("soap-msg");

  if (btn.disabled) return;

  // Validasi
  if (medicationState.items.length === 0) {
    showMessage(
      msg,
      "warning",
      "⚠️ Harap tambahkan minimal 1 obat sebelum menyimpan!",
    );
    return;
  }

  // Konfirmasi
  const confirmed = await window.showConfirm(
    "Simpan Pemeriksaan?",
    "Apakah Anda yakin ingin menyimpan data pemeriksaan dan mengirim resep ke farmasi?",
  );

  if (!confirmed) return;

  // Disable button
  btn.disabled = true;
  btn.innerHTML = `
    <span class="flex items-center justify-center gap-2">
      <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Menyimpan...
    </span>`;

  try {
    const { data: profileData, error: profileError } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", localCurrentUser.id)
      .single();

    if (profileError || !profileData?.clinic_id) {
      throw new Error("Data klinik tidak valid");
    }

    const clinicId = profileData.clinic_id;
    const medicationsToProcess = deepClone(medicationState.items);
    const prescriptionItems = [];

    // Proses setiap obat
    for (const med of medicationsToProcess) {
      try {
        if (!med.is_manual && med.medication_id) {
          // Validasi stok
          const { data: medData, error: medError } = await supabaseClient
            .from("medications")
            .select("stock, name")
            .eq("id", med.medication_id)
            .single();

          if (medError)
            throw new Error(`Obat tidak ditemukan: ${med.drug_name}`);
          if (!medData || medData.stock < med.qty) {
            throw new Error(
              `Stok tidak mencukupi untuk ${med.drug_name} (tersedia: ${medData?.stock || 0})`,
            );
          }

          // Kurangi stok
          const newStock = medData.stock - med.qty;
          const { error: updateError } = await supabaseClient
            .from("medications")
            .update({ stock: newStock })
            .eq("id", med.medication_id);

          if (updateError)
            throw new Error(`Gagal mengurangi stok ${med.drug_name}`);

          // Catat log stok
          await supabaseClient.from("medication_stock_logs").insert([
            {
              clinic_id: clinicId,
              medication_id: med.medication_id,
              type: "out",
              quantity: med.qty,
              previous_stock: medData.stock,
              new_stock: newStock,
              reference_type: "prescription",
              reference_id: doctorCurrentRegistrationId,
              created_by: localCurrentUser.id,
            },
          ]);

          prescriptionItems.push({
            drug_name: med.drug_name,
            dose: med.dose,
            qty: med.qty,
            medication_id: med.medication_id,
            is_manual: false,
          });
        } else {
          // Obat manual
          prescriptionItems.push({
            drug_name: med.drug_name,
            dose: med.dose,
            qty: med.qty,
            medication_id: null,
            is_manual: true,
          });
        }
      } catch (itemError) {
        // Rollback stok yang sudah terlanjur berkurang
        console.error(`Error processing ${med.drug_name}:`, itemError);
        await rollbackStock(prescriptionItems, clinicId);
        throw itemError;
      }
    }

    if (prescriptionItems.length === 0) {
      throw new Error("Tidak ada obat yang berhasil diproses");
    }

    // Simpan SOAP
    const soapData = {
      registration_id: doctorCurrentRegistrationId,
      doctor_id: localCurrentUser.id,
      clinic_id: clinicId,
      soap_subject: document.getElementById("soap-s")?.value?.trim() || "",
      soap_objective: document.getElementById("soap-o")?.value?.trim() || "",
      soap_plan: document.getElementById("soap-p")?.value?.trim() || "",
      // Assessment diambil dari keranjang diagnosa
      soap_assessment: diagnosisState.primary
        ? `${diagnosisState.primary.code} - ${diagnosisState.primary.name}`
        : "",
      icd10_code: diagnosisState.primary?.code || null,
      icd10_name: diagnosisState.primary?.name || null,
      secondary_diagnoses: JSON.stringify(diagnosisState.secondary),
      is_work_accident: document.getElementById("soap-kk")?.checked || false,
      is_traffic_accident:
        document.getElementById("soap-kll")?.checked || false,
    };

    const { error: soapError } = await supabaseClient
      .from("medical_records")
      .upsert([soapData], { onConflict: "registration_id" });

    if (soapError) {
      await rollbackStock(prescriptionItems, clinicId);
      throw new Error("Gagal menyimpan data SOAP");
    }

    // ============================================
    // 🚀 SIMPAN DATA KECELAKAAN KERJA (JIKA ADA)
    // ============================================
    if (document.getElementById("soap-kk")?.checked) {
      const patientName =
        document.getElementById("soap-section")?.dataset?.patientName || "";
      const kkData = {
        registration_id: doctorCurrentRegistrationId,
        clinic_id: clinicId,
        nama: patientName,
        lokasi: document.getElementById("kk-lokasi")?.value || "",
        jenis_insiden: document.getElementById("kk-jenis-insiden")?.value || "",
        kronologis: document.getElementById("kk-kronologis")?.value || "",
        tgl_kejadian: new Date().toISOString().split("T")[0],
        created_by: localCurrentUser.id,
      };

      const { error: kkError } = await supabaseClient
        .from("kk_reports")
        .upsert([kkData], { onConflict: "registration_id" });
      if (kkError) console.warn("⚠️ Gagal simpan data KK:", kkError.message);
      else console.log("✅ Data KK tersimpan");
    }
    // ============================================

    // Simpan Resep
    // Hapus resep lama jika ada
    await supabaseClient
      .from("prescriptions")
      .delete()
      .eq("registration_id", doctorCurrentRegistrationId);

    const { error: prescError } = await supabaseClient
      .from("prescriptions")
      .insert([
        {
          registration_id: doctorCurrentRegistrationId,
          prescribed_by: localCurrentUser.id,
          clinic_id: clinicId,
          items: prescriptionItems,
          status: "pending",
        },
      ]);

    if (prescError) {
      // Rollback stok
      await rollbackStock(prescriptionItems, clinicId);
      throw new Error("Gagal menyimpan resep");
    }

    // Update status pendaftaran
    const { error: updateRegError } = await supabaseClient
      .from("registrations")
      .update({ status: "waiting_pharmacy" })
      .eq("id", doctorCurrentRegistrationId);

    // ============================================
    // 🚀 KIRIM DIAGNOSA KE SATUSEHAT
    // ============================================
    try {
      console.log("🚀 Mengirim diagnosa ke SATUSEHAT...");

      // Ambil IHS pasien
      const { data: reg } = await supabaseClient
        .from("registrations")
        .select("patient_id, satusehat_encounter_ihs")
        .eq("id", doctorCurrentRegistrationId)
        .single();

      if (reg) {
        const { data: patient } = await supabaseClient
          .from("patients")
          .select("satusehat_ihs, full_name")
          .eq("id", reg.patient_id)
          .single();

        if (patient?.satusehat_ihs) {
          // Kirim diagnosa utama
          if (diagnosisState.primary) {
            console.log("🏷️ Mengirim diagnosa utama...");

            const conditionResult = await satusehatBridge.sendCondition(
              patient.satusehat_ihs,
              diagnosisState.primary.code,
              diagnosisState.primary.name,
              reg.satusehat_encounter_ihs,
            );

            if (conditionResult.success) {
              console.log(
                "✅ Diagnosa terkirim:",
                conditionResult.conditionIHS,
              );

              // Simpan IHS condition ke database
              await supabaseClient
                .from("medical_records")
                .update({
                  satusehat_condition_ihs: conditionResult.conditionIHS,
                  satusehat_sync_at: new Date().toISOString(),
                })
                .eq("registration_id", doctorCurrentRegistrationId);
            }
          }

          // Kirim diagnosa sekunder (jika ada)
          if (diagnosisState.secondary.length > 0) {
            for (const diag of diagnosisState.secondary) {
              console.log("🏷️ Mengirim diagnosa sekunder:", diag.code);

              const secResult = await satusehatBridge.sendCondition(
                patient.satusehat_ihs,
                diag.code,
                diag.name,
                reg.satusehat_encounter_ihs,
              );

              if (secResult.success) {
                console.log(
                  "✅ Diagnosa sekunder terkirim:",
                  secResult.conditionIHS,
                );
              }
            }
          }
          // ============================================
          // 💊 KIRIM RESEP KE SATUSEHAT
          // ============================================
          if (medicationState.items && medicationState.items.length > 0) {
            console.log("💊 Mengirim resep ke SATUSEHAT...");
            console.log("   Jumlah obat:", medicationState.items.length);

            try {
              const medicationResult =
                await satusehatBridge.sendMedicationRequest(
                  patient.satusehat_ihs,
                  reg.satusehat_encounter_ihs,
                  medicationState.items,
                );

              if (medicationResult.success) {
                console.log(
                  "✅ Resep terkirim:",
                  medicationResult.medicationIHS,
                );
              } else {
                console.warn("⚠️ Gagal kirim resep:", medicationResult.error);
              }
            } catch (medError) {
              console.error("❌ Error kirim resep:", medError.message);
            }
          } else {
            console.log("ℹ️ Tidak ada obat diresepkan, skip kirim resep");
          }
          // ============================================
        } else {
          console.warn("⚠️ Pasien belum punya IHS");
        }
      }
    } catch (conditionError) {
      console.error("❌ Error kirim diagnosa:", conditionError.message);
    }
    // ============================================

    if (updateRegError) {
      throw new Error("Gagal mengupdate status pasien");
    }

    // Sukses
    resetMedicationState();
    resetDiagnosisState();

    showMessage(
      msg,
      "success",
      `✅ Data berhasil disimpan dan dikirim ke farmasi!<br><br>
       <button onclick="window.navigateTo('doctor-queue')" 
               class="underline font-bold text-green-700 dark:text-green-300 hover:text-green-900">
         ← Kembali ke Antrean
       </button>`,
    );

    btn.textContent = "✓ Tersimpan";
    btn.classList.add("bg-green-600", "hover:bg-green-700");

    // Re-enable setelah 3 detik
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "💾 Simpan & Kirim ke Farmasi";
      btn.classList.remove("bg-green-600", "hover:bg-green-700");
    }, 3000);
  } catch (err) {
    console.error("Submit error:", err);
    showMessage(msg, "error", `❌ Gagal menyimpan: ${err.message}`);

    btn.disabled = false;
    btn.textContent = "💾 Simpan & Kirim ke Farmasi";
  }
}

// Fungsi rollback stok jika terjadi error
async function rollbackStock(items, clinicId) {
  console.warn("Rolling back stock...");

  for (const item of items) {
    if (!item.is_manual && item.medication_id) {
      try {
        // Kembalikan stok
        const { data: medData } = await supabaseClient
          .from("medications")
          .select("stock")
          .eq("id", item.medication_id)
          .single();

        if (medData) {
          const restoredStock = medData.stock + item.qty;
          await supabaseClient
            .from("medications")
            .update({ stock: restoredStock })
            .eq("id", item.medication_id);

          // Catat log rollback
          await supabaseClient.from("medication_stock_logs").insert([
            {
              clinic_id: clinicId,
              medication_id: item.medication_id,
              type: "in",
              quantity: item.qty,
              previous_stock: medData.stock,
              new_stock: restoredStock,
              reference_type: "rollback",
              reference_id: doctorCurrentRegistrationId,
              created_by: localCurrentUser.id,
              notes: "Rollback karena error sistem",
            },
          ]);
        }
      } catch (err) {
        console.error(`Failed to rollback stock for ${item.drug_name}:`, err);
      }
    }
  }
}

// ==========================================
// 7. UPDATE RIWAYAT MEDIS PASIEN
// ==========================================
window.updatePatientHistory = async function (patientId, currentHistory) {
  const newHistory = prompt(
    "✏️ Update Riwayat Alergi & Penyakit Kronis Pasien:\n\n" +
      "Contoh: Alergi Amoxicillin, Hipertensi, DM Tipe 2, Asma\n\n" +
      "Kosongkan jika tidak ada atau ingin menghapus riwayat.",
    currentHistory || "",
  );

  if (newHistory === null) return; // User cancel

  try {
    const { error } = await supabaseClient
      .from("patients")
      .update({ medical_history: newHistory.trim() })
      .eq("id", patientId);

    if (error) throw error;

    window.showSuccess("Riwayat medis berhasil diperbarui!");

    // Reload halaman SOAP untuk memperbarui tampilan
    if (window.currentRegistrationId && localCurrentUser) {
      await loadSOAPData(window.currentRegistrationId, localCurrentUser);
    }
  } catch (err) {
    alert("❌ Gagal mengupdate riwayat: " + err.message);
  }
};

// ==========================================
// 8. POP-UP RIWAYAT PEMERIKSAAN PASIEN - DIPERBAIKI
// ==========================================
window.openHistoryModal = async function (patientId, patientName) {
  // Buat modal jika belum ada
  let modal = document.getElementById("history-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "history-modal";
    modal.className =
      "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 hidden backdrop-blur-sm";
    document.body.appendChild(modal);
  }

  // Set loading state
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
      <div class="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
        <h3 class="font-bold text-xl text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
          Riwayat Medis: <span class="text-primary">${patientName}</span>
        </h3>
        <button onclick="window.closeHistoryModal()" class="text-gray-400 hover:text-red-500 transition p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="p-6 overflow-y-auto flex-1 bg-gray-50/50 dark:bg-gray-900/20" id="history-modal-content">
        <div class="text-center py-10">
          <div class="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p class="text-gray-500">Memuat riwayat medis...</p>
        </div>
      </div>
    </div>`;

  modal.classList.remove("hidden");

  try {
    const { data, error } = await supabaseClient
      .from("registrations")
      .select("created_at, complaint, target_poly, medical_records(*)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(20);

    const content = document.getElementById("history-modal-content");

    if (error) throw error;

    if (!data || data.length === 0) {
      content.innerHTML = `
        <div class="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <p class="text-5xl mb-4">📋</p>
          <p class="text-gray-500 font-medium text-lg">Belum ada riwayat pemeriksaan</p>
          <p class="text-gray-400 text-sm mt-2">Data pemeriksaan akan muncul di sini setelah pasien diperiksa</p>
        </div>`;
      return;
    }

    content.innerHTML = data
      .map((reg, index) => {
        const date = new Date(reg.created_at).toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const med = reg.medical_records?.[0];

        if (!med) {
          return `
          <div class="mb-4 p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 opacity-70">
            <div class="flex justify-between items-center">
              <p class="font-bold text-gray-600 dark:text-gray-300">
                <span class="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded mr-2">#${index + 1}</span>
                ${date}
              </p>
              <span class="text-xs bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full text-gray-600 dark:text-gray-300">
                ${reg.target_poly}
              </span>
            </div>
            <p class="text-sm text-gray-500 mt-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
              📝 Kunjungan tercatat, namun tidak ada data pemeriksaan SOAP.
            </p>
          </div>`;
        }

        const incidentBadges = [];
        if (med.is_work_accident) incidentBadges.push("⚠️ Kecelakaan Kerja");
        if (med.is_traffic_accident)
          incidentBadges.push("🚗 Kecelakaan Lalu Lintas");

        return `
        <div class="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          ${index === 0 ? '<div class="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">Terbaru</div>' : ""}
          
          <div class="bg-gray-50 dark:bg-gray-900/50 p-4 border-b border-gray-100 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <div>
                <p class="font-bold text-gray-800 dark:text-gray-100">📅 ${date}</p>
                <p class="text-xs text-gray-500 mt-1">No. Kunjungan: #${index + 1}</p>
              </div>
              <span class="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full font-semibold">
                ${reg.target_poly}
              </span>
            </div>
            ${
              incidentBadges.length > 0
                ? `
              <div class="mt-3 flex gap-2">
                ${incidentBadges
                  .map(
                    (badge) => `
                  <span class="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs px-2 py-1 rounded font-semibold border border-red-200 dark:border-red-800">
                    ${badge}
                  </span>
                `,
                  )
                  .join("")}
              </div>`
                : ""
            }
          </div>
          
          <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider block mb-2">
                📋 Subjective (Keluhan)
              </span> 
              <div class="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg text-sm">
                ${med.soap_subject || med.soap_subjective || reg.complaint || "-"}
              </div>
            </div>
            
            <div>
              <span class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider block mb-2">
                🔍 Objective (Pemeriksaan)
              </span> 
              <div class="bg-gray-50 dark:bg-gray-900/30 p-3 rounded-lg text-sm">
                ${med.soap_objective || "-"}
              </div>
            </div>
            
            <div>
              <span class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider block mb-2">
                🏥 Assessment (Diagnosa)
              </span> 
              <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                <div class="font-bold text-blue-900 dark:text-blue-300">
                  ${med.icd10_code ? `<span class="bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded text-sm mr-2">${med.icd10_code}</span>` : ""}
                  ${med.icd10_name || med.soap_assessment || "Tidak ada diagnosa"}
                </div>
                ${
                  med.secondary_diagnoses
                    ? (() => {
                        try {
                          const secondary =
                            typeof med.secondary_diagnoses === "string"
                              ? JSON.parse(med.secondary_diagnoses)
                              : med.secondary_diagnoses;

                          if (
                            Array.isArray(secondary) &&
                            secondary.length > 0
                          ) {
                            return `
                        <div class="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                          <p class="text-xs text-gray-500 mb-1">Diagnosa Sekunder:</p>
                          ${secondary
                            .map(
                              (d) => `
                            <span class="text-xs bg-white dark:bg-gray-800 px-2 py-0.5 rounded mr-1 mb-1 inline-block">
                              ${d.code} - ${d.name}
                            </span>
                          `,
                            )
                            .join("")}
                        </div>`;
                          }
                        } catch (e) {
                          return "";
                        }
                        return "";
                      })()
                    : ""
                }
                        // ... kode diagnosa sekunder ...

    } // ← Tutup if (reg)
  } catch (conditionError) {
    console.error('❌ Error kirim diagnosa:', conditionError.message);
  }
              </div>
            </div>
            
            <div>
              <span class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider block mb-2">
                💊 Plan (Tindakan)
              </span> 
              <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-100 dark:border-green-800 text-sm">
                ${med.soap_plan || "Tidak ada rencana tindakan"}
              </div>
            </div>
          </div>
        </div>`;
      })
      .join("");

    // Tambahkan total kunjungan
    const totalVisits = data.length;
    const footerDiv = document.createElement("div");
    footerDiv.className =
      "mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-center";
    footerDiv.innerHTML = `<p class="text-sm text-gray-500">Total: <strong>${totalVisits}</strong> kunjungan</p>`;
    content.appendChild(footerDiv);
  } catch (err) {
    const content = document.getElementById("history-modal-content");
    if (content) {
      content.innerHTML = `
        <div class="text-center py-10 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
          <p class="text-5xl mb-4">❌</p>
          <p class="text-red-600 dark:text-red-400 font-semibold">Gagal memuat riwayat</p>
          <p class="text-red-500 dark:text-red-300 text-sm mt-2">${err.message}</p>
        </div>`;
    }
  }
};

window.closeHistoryModal = function () {
  const modal = document.getElementById("history-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
};

// Tutup modal dengan tombol Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    window.closeHistoryModal();
    window.closeOdontogramModal();
  }
});

// ==========================================
// FORM KECELAKAAN KERJA
// ==========================================
window.toggleKKForm = function () {
  const isChecked = document.getElementById("soap-kk").checked;
  let kkContainer = document.getElementById("kk-form-container");

  if (isChecked) {
    if (!kkContainer) {
      const soapSection = document.getElementById("soap-section");
      kkContainer = document.createElement("div");
      kkContainer.id = "kk-form-container";
      kkContainer.className =
        "mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-300 animate-fade-in";
      kkContainer.innerHTML = `
        <h4 class="font-bold text-orange-800 dark:text-orange-300 mb-3 flex items-center gap-2">⚠️ Form Kecelakaan Kerja</h4>
        <div class="space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium mb-1">Lokasi Kejadian *</label>
              <input type="text" id="kk-lokasi" placeholder="Contoh: Ruang IGD, Parkiran" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
            </div>
            <div>
              <label class="block text-xs font-medium mb-1">Jenis Insiden *</label>
              <input type="text" id="kk-jenis-insiden" placeholder="Contoh: Tertusuk jarum, Terpeleset" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium mb-1">Kronologis Singkat *</label>
            <textarea id="kk-kronologis" rows="3" placeholder="Ceritakan kronologis kejadian..." class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm"></textarea>
          </div>
          <p class="text-xs text-gray-400">💡 Form lengkap bisa dicetak dari menu Laporan Kecelakaan Kerja.</p>
        </div>
      `;
      soapSection.parentNode.insertBefore(kkContainer, soapSection.nextSibling);
    } else {
      kkContainer.classList.remove("hidden");
    }
    kkContainer.scrollIntoView({ behavior: "smooth", block: "center" });
  } else {
    if (kkContainer) kkContainer.classList.add("hidden");
  }
};

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function showLoading(container) {
  container.innerHTML = `
    <div class="text-center py-16">
      <div class="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-gray-500 dark:text-gray-400">Memuat data...</p>
    </div>`;
}

function showError(container, message) {
  container.innerHTML = `
    <div class="text-center py-10 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 max-w-lg mx-auto">
      <p class="text-5xl mb-4">⚠️</p>
      <p class="text-red-600 dark:text-red-400 font-semibold">Terjadi Kesalahan</p>
      <p class="text-red-500 dark:text-red-300 text-sm mt-2">${message}</p>
      <button onclick="window.navigateTo('doctor-queue')" 
              class="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition">
        Kembali ke Antrian
      </button>
    </div>`;
}

function showMessage(element, type, message) {
  if (!element) return;

  element.innerHTML = message;
  element.classList.remove(
    "hidden",
    "text-green-600",
    "text-red-600",
    "text-yellow-600",
    "bg-green-50",
    "bg-red-50",
    "bg-yellow-50",
    "border-green-200",
    "border-red-200",
    "border-yellow-200",
  );

  switch (type) {
    case "success":
      element.className +=
        " text-green-600 bg-green-50 border border-green-200 rounded-lg p-3";
      break;
    case "error":
      element.className +=
        " text-red-600 bg-red-50 border border-red-200 rounded-lg p-3";
      break;
    case "warning":
      element.className +=
        " text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg p-3";
      break;
  }
}

// Export untuk digunakan di modul lain
export { diagnosisState, medicationState };

// ==========================================
// MODAL FORM KECELAKAAN KERJA LENGKAP
// ==========================================
window.toggleKKModal = function () {
  const isChecked = document.getElementById("soap-kk").checked;

  if (!isChecked) {
    // Tutup modal kalau ada
    const modal = document.getElementById("kk-modal");
    if (modal) modal.remove();
    return;
  }

  // Ambil data pasien
  const patientName =
    document.getElementById("soap-section")?.dataset?.patientName || "";

  // Buat modal
  const modal = document.createElement("div");
  modal.id = "kk-modal";
  modal.className =
    "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-y-auto">
      <div class="p-5 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10 flex justify-between items-center">
        <h3 class="text-xl font-bold text-red-800">⚠️ Form Kecelakaan Kerja</h3>
        <button onclick="document.getElementById('kk-modal').remove(); document.getElementById('soap-kk').checked = false;" class="text-gray-400 hover:text-red-500 text-2xl">&times;</button>
      </div>
      
      <form id="kk-form-full" class="p-6 space-y-4">
        <!-- I. DATA UMUM -->
        <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200">
          <h4 class="font-bold text-blue-800 mb-3">I. DATA UMUM</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">1. Nama *</label>
              <input type="text" id="kk-nama" value="${patientName}" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">2. Tempat & Tgl Lahir</label>
              <input type="text" id="kk-ttl" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm" placeholder="Kota, dd/mm/yyyy">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">3. Jenis Kelamin</label>
              <div class="flex gap-4 mt-2">
                <label class="flex items-center gap-1 cursor-pointer text-sm"><input type="radio" name="kk-gender" value="Laki-laki" class="w-4 h-4"> Laki-laki</label>
                <label class="flex items-center gap-1 cursor-pointer text-sm"><input type="radio" name="kk-gender" value="Perempuan" class="w-4 h-4"> Perempuan</label>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">4. Lama Kerja</label>
              <input type="text" id="kk-lama-kerja" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm" placeholder="Contoh: 2 tahun">
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div>
              <label class="block text-sm font-medium mb-1">5. Unit Kerja / Bagian</label>
              <input type="text" id="kk-unit-kerja" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">6. Status Korban</label>
              <select id="kk-status-korban" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
                <option value="">-- Pilih --</option>
                <option>Karyawan Tetap - Dokter</option><option>Karyawan Tetap - Perawat</option>
                <option>Karyawan Kontrak - Dokter</option><option>Karyawan Kontrak - Perawat</option>
                <option>Mahasiswa</option><option>PKL</option><option>Pasien</option>
                <option>Pengunjung</option><option>Lain-lain</option>
              </select>
            </div>
          </div>
          <div class="mt-3">
            <label class="block text-sm font-medium mb-1">7. Pembiayaan</label>
            <div class="flex gap-4 mt-2">
              <label class="flex items-center gap-1 cursor-pointer text-sm"><input type="radio" name="kk-biaya" value="Asuransi" class="w-4 h-4"> Asuransi</label>
              <label class="flex items-center gap-1 cursor-pointer text-sm"><input type="radio" name="kk-biaya" value="Pribadi" class="w-4 h-4"> Pribadi</label>
            </div>
          </div>
        </div>

        <!-- II. RINCIAN KEJADIAN -->
        <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200">
          <h4 class="font-bold text-red-800 mb-3">II. RINCIAN KEJADIAN</h4>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">1a. Tgl & Jam Lapor</label>
              <div class="flex gap-2">
                <input type="date" id="kk-tgl-lapor" class="flex-1 px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
                <input type="time" id="kk-jam-lapor" class="w-28 px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">1b. Tgl & Jam Kejadian</label>
              <div class="flex gap-2">
                <input type="date" id="kk-tgl-kejadian" class="flex-1 px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
                <input type="time" id="kk-jam-kejadian" class="w-28 px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
              </div>
            </div>
          </div>
          <div class="mt-3">
            <label class="block text-sm font-medium mb-1">2. Lokasi Kejadian</label>
            <input type="text" id="kk-lokasi" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm" placeholder="Contoh: Ruang IGD">
          </div>
          <div class="mt-3">
            <label class="block text-sm font-medium mb-1">3. Jenis Insiden</label>
            <input type="text" id="kk-jenis-insiden" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm" placeholder="Contoh: Tertusuk jarum">
          </div>
          <div class="mt-3">
            <label class="block text-sm font-medium mb-1">4. Jenis Pekerjaan yang Menyebabkan</label>
            <input type="text" id="kk-jenis-pekerjaan" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm" placeholder="Contoh: Menyuntik">
          </div>
          <div class="mt-3">
            <label class="block text-sm font-medium mb-1">5. Kronologis</label>
            <textarea id="kk-kronologis" rows="4" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm" placeholder="Ceritakan kronologis lengkap..."></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4 mt-3">
            <div>
              <label class="block text-sm font-medium mb-1">6. Pelapor Pertama</label>
              <select id="kk-pelapor" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
                <option value="">-- Pilih --</option>
                <option>Karyawan</option><option>Pasien</option><option>Keluarga</option><option>Pengunjung</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">7. Akibat</label>
              <select id="kk-akibat" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm">
                <option value="">-- Pilih --</option>
                <option>Tidak ada cedera</option><option>Cedera ringan</option><option>Cedera sedang</option><option>Cedera berat</option>
              </select>
            </div>
          </div>
          <div class="mt-3">
            <label class="block text-sm font-medium mb-1">8. Tindakan</label>
            <textarea id="kk-tindakan" rows="2" class="w-full px-3 py-2 rounded-lg border dark:bg-gray-900 outline-none text-sm" placeholder="Pertolongan & hasil tindakan..."></textarea>
          </div>
          <div class="mt-3">
            <label class="block text-sm font-medium mb-1">9. Sering terjadi?</label>
            <div class="flex gap-4 mt-2">
              <label class="flex items-center gap-1 cursor-pointer text-sm"><input type="radio" name="kk-sering" value="Ya" class="w-4 h-4"> Ya</label>
              <label class="flex items-center gap-1 cursor-pointer text-sm"><input type="radio" name="kk-sering" value="Tidak" class="w-4 h-4"> Tidak</label>
            </div>
          </div>
        </div>

        <!-- TOMBOL -->
        <div class="flex gap-3 pt-4 border-t">
          <button type="button" onclick="document.getElementById('kk-modal').remove(); document.getElementById('soap-kk').checked = false;" class="flex-1 px-4 py-2.5 bg-gray-200 rounded-lg font-medium">Batal</button>
          <button type="submit" class="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium">💾 Simpan Data KK</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // Set tanggal hari ini
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("kk-tgl-lapor").value = today;
  document.getElementById("kk-tgl-kejadian").value = today;

  // Submit form KK
  document
    .getElementById("kk-form-full")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await saveKKData();
    });

  // Tutup modal kalau klik luar
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
      document.getElementById("soap-kk").checked = false;
    }
  };
};

async function saveKKData() {
  try {
    const kkData = {
      registration_id: doctorCurrentRegistrationId,
      clinic_id: (
        await supabaseClient
          .from("profiles")
          .select("clinic_id")
          .eq("id", localCurrentUser.id)
          .single()
      ).data?.clinic_id,
      nama: document.getElementById("kk-nama").value,
      ttl: document.getElementById("kk-ttl").value,
      gender:
        document.querySelector('input[name="kk-gender"]:checked')?.value || "",
      lama_kerja: document.getElementById("kk-lama-kerja").value,
      unit_kerja: document.getElementById("kk-unit-kerja").value,
      status_korban: document.getElementById("kk-status-korban").value,
      pembiayaan:
        document.querySelector('input[name="kk-biaya"]:checked')?.value || "",
      tgl_lapor: document.getElementById("kk-tgl-lapor").value,
      jam_lapor: document.getElementById("kk-jam-lapor").value,
      tgl_kejadian: document.getElementById("kk-tgl-kejadian").value,
      jam_kejadian: document.getElementById("kk-jam-kejadian").value,
      lokasi: document.getElementById("kk-lokasi").value,
      jenis_insiden: document.getElementById("kk-jenis-insiden").value,
      jenis_pekerjaan: document.getElementById("kk-jenis-pekerjaan").value,
      kronologis: document.getElementById("kk-kronologis").value,
      pelapor: document.getElementById("kk-pelapor").value,
      akibat: document.getElementById("kk-akibat").value,
      tindakan: document.getElementById("kk-tindakan").value,
      sering_terjadi:
        document.querySelector('input[name="kk-sering"]:checked')?.value || "",
      created_by: localCurrentUser.id,
    };

    const { error } = await supabaseClient
      .from("kk_reports")
      .upsert([kkData], { onConflict: "registration_id" });
    if (error) throw error;

    window.showSuccess("Data Kecelakaan Kerja berhasil disimpan!");
    document.getElementById("kk-modal").remove();
  } catch (err) {
    window.showError("Gagal: " + err.message);
  }
}
