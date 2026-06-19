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

// ==========================================
// STATE LOKAL DOKTER
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

// State Resep Obat (Hybrid)
let currentMedicationMode = "database";
window.selectedMedications = window.selectedMedications || [];
let selectedMedications = window.selectedMedications;

// State Keranjang Diagnosa (Global agar mudah diakses)
window.currentDiagnoses = { primary: null, secondary: [] };

// ==========================================
// 1. ANTREAN DOKTER
// ==========================================
export async function loadDoctorQueue(currentUser) {
  localCurrentUser = currentUser;
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

  try {
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
      mainContent.innerHTML = getEmptyState(
        "Belum ada pasien menunggu Dokter.",
      );
      return;
    }

    mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">${regs
      .map(
        (r) => `
      <div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-md transition" onclick='window.navigateTo("input-soap", ${JSON.stringify(r)})'>
        <div class="flex justify-between items-start mb-2">
          <span class="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">${r.queue_number}</span>
          <span class="text-xs text-gray-500">${formatTimeID(r.created_at)}</span>
        </div>
        <h4 class="font-bold text-gray-900 dark:text-gray-100">${r.patients.full_name}</h4>
        <p class="text-sm text-gray-500 line-clamp-2">${r.complaint}</p>
        <button class="mt-3 text-xs font-semibold text-primary">Periksa (SOAP) &rarr;</button>
      </div>`,
      )
      .join("")}</div>`;
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 text-center py-4">Error: ${err.message}</div>`;
  }
}

// ==========================================
// 2. PEMERIKSAAN SOAP & UI UTAMA DOKTER
// ==========================================
export async function loadSOAPData(regId, currentUser) {
  localCurrentUser = currentUser;
  doctorCurrentRegistrationId = regId;
  window.currentRegistrationId = regId;

  // Reset Keranjang Diagnosa untuk pasien baru
  window.currentDiagnoses = { primary: null, secondary: [] };

  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-primary mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';

  try {
    const { data: reg } = await supabaseClient
      .from("registrations")
      .select("*, patients(full_name, medical_history)")
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

    mainContent.innerHTML = `
      <div class="max-w-4xl mx-auto fade-in">
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
          <span class="inline-block mt-2 px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full">Menunggu Dokter</span>
        </div>

        <!-- 🛠️ TAMBAHAN FITUR ALERT RIWAYAT MEDIS -->
      ${(() => {
        const historyText = reg.patients.medical_history;
        const isDanger = historyText && historyText.trim() !== "";
        return `
        <div class="mb-4 p-4 rounded-xl border flex justify-between items-center shadow-sm ${isDanger ? "bg-red-50 border-red-300 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300" : "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-500"}">
          <div>
            <p class="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1 ${isDanger ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-500"}">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Perhatian Medis / Alergi
            </p>
            <p class="font-bold text-sm">${isDanger ? historyText : "Belum ada catatan alergi atau penyakit kronis."}</p>
          </div>
          <button onclick="window.updatePatientHistory('${reg.patient_id}', '${(historyText || "").replace(/'/g, "\\'")}')" class="px-3 py-1.5 bg-white/60 hover:bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 transition shadow-sm">
            ✏️ Update
          </button>
        </div>
        `;
      })()}
      <!-- 🛠️ AKHIR TAMBAHAN ALERT -->
      
        <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-800">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keluhan Utama (Dari Pendaftaran):</p>
          <p class="text-gray-900 dark:text-gray-100">${reg.complaint}</p>
        </div>
        
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Data TTV (Tanda-Tanda Vital)</h4>
        ${ttvHTML}

        <div id="odontogram-container"></div>

        <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
          <h4 class="font-semibold mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Catatan Medis (SOAP) & ICD-10
          </h4>
          <div class="space-y-4">
            <div><label class="block text-sm mb-1">Subjective (Keluhan tambahan / Riwayat)</label><textarea id="soap-s" rows="2" class="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder="Keluhan tambahan dari pasien..."></textarea></div>
            <div><label class="block text-sm mb-1">Objective (Hasil Pemeriksaan Fisik)</label><textarea id="soap-o" rows="2" class="w-full p-2 border rounded dark:bg-gray-900 dark:border-gray-700" placeholder="Hasil pemeriksaan fisik dokter..."></textarea></div>
            
            <div class="relative bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <label class="block text-sm font-semibold mb-2 text-blue-800 dark:text-blue-300">Assessment & Diagnosa (ICD-10)</label>
              
              <div class="relative mb-3">
                <input type="text" id="icd10-input" placeholder="Ketik kode atau nama penyakit (misal: J00 atau Headache)..." class="w-full p-2.5 border border-blue-300 rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
                <div id="icd10-list" class="hidden absolute z-20 w-full bg-white dark:bg-gray-800 border rounded-lg shadow-xl max-h-60 overflow-y-auto mt-1"></div>
              </div>

              <div id="diagnoses-cart" class="space-y-2">
                <p class="text-sm text-gray-500 italic p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">Belum ada diagnosa dipilih. Cari di atas.</p>
              </div>
            </div>
            
            <div class="mt-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm font-bold text-red-800 dark:text-red-400 mb-2">Tandai Jika Terkait Insiden (Opsional):</p>
              <div class="flex gap-6">
                <label class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" id="soap-kk" class="w-4 h-4 text-red-600 rounded focus:ring-red-500">
                  Kecelakaan Kerja (KK)
                </label>
                <label class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" id="soap-kll" class="w-4 h-4 text-red-600 rounded focus:ring-red-500">
                  Kecelakaan Lalu Lintas (KLL)
                </label>
              </div>
            </div>
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
          
          <div id="medication-mode-info" class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-400">
            💡 Mode Database: Pilih obat dari stok klinik (stok otomatis berkurang)
          </div>

          <div id="medication-database-mode" class="mb-4">
            <div class="relative mb-3">
              <input type="text" id="medication-search" class="w-full px-4 py-2 pl-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary" placeholder="Cari obat (ketik nama atau kode)...">
              <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <div id="medication-search-results" class="max-h-60 overflow-y-auto space-y-2 mb-3"></div>
          </div>

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

          <div id="rx-items" class="space-y-3 mb-4"></div>
          
          <div class="flex gap-2 mt-4">
            <button id="btn-save-soap" class="flex-1 bg-primary hover:bg-primaryHover text-white font-semibold py-3 rounded-lg transition">
              Simpan & Kirim Farmasi
            </button>
            <button onclick="window.handlePrintClick()" class="px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              Cetak
            </button>
          </div>
          <p id="soap-msg" class="text-sm hidden mt-2"></p>
        </div>
      </div>`;

    // Initialize all components
    window.selectedMedications = [];
    selectedMedications = window.selectedMedications;

    setupICD10();
    setupMedicationSearch();
    renderMedicationList();

    document
      .getElementById("btn-save-soap")
      .addEventListener("click", submitSOAPWithMedications);

    if (reg.target_poly === "Poli Gigi") {
      loadOdontogramForSOAP(regId, reg.target_poly);
    }
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 text-center py-4">Error: ${err.message}</div>`;
  }
}

// ==========================================
// 3. PENCARIAN ICD-10 & KERANJANG DIAGNOSA
// ==========================================
function setupICD10() {
  const input = document.getElementById("icd10-input");
  const list = document.getElementById("icd10-list");
  let timer;

  if (!input || !list) return;

  input.addEventListener("input", (e) => {
    clearTimeout(timer);
    const query = e.target.value.trim();

    if (query.length < 2) {
      list.classList.add("hidden");
      return;
    }

    timer = setTimeout(async () => {
      // FIX ERROR 400: Bersihkan koma & tanda kurung
      const safeQuery = query.replace(/[^\w\s-]/g, "");

      const { data, error } = await supabaseClient
        .from("icd10_codes")
        .select("*")
        .or(`code.ilike.%${safeQuery}%,description.ilike.%${safeQuery}%`)
        .limit(5);

      if (error) {
        console.error("Error pencarian ICD-10:", error);
        return;
      }

      if (data && data.length) {
        list.innerHTML = data
          .map(
            (i) =>
              `<div class="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-sm" onclick="window.tambahDiagnosaKeKeranjang('${i.code}', '${i.description.replace(/'/g, "\\'")}')"><b>${i.code}</b> - ${i.description}</div>`,
          )
          .join("");
        list.classList.remove("hidden");
      } else {
        list.innerHTML =
          '<div class="p-2 text-sm text-gray-500">Tidak ditemukan</div>';
        list.classList.remove("hidden");
      }
    }, 300);
  });
}

window.tambahDiagnosaKeKeranjang = function (code, name) {
  if (!window.currentDiagnoses) {
    window.currentDiagnoses = { primary: null, secondary: [] };
  }

  if (!window.currentDiagnoses.primary) {
    window.currentDiagnoses.primary = { code, name };
  } else {
    // Cek agar tidak ada diagnosa dobel
    const isDuplicate =
      window.currentDiagnoses.secondary.find((d) => d.code === code) ||
      window.currentDiagnoses.primary.code === code;
    if (!isDuplicate) {
      window.currentDiagnoses.secondary.push({ code, name });
    }
  }

  window.renderDiagnosesCart();

  // Kosongkan inputan
  const input = document.getElementById("icd10-input");
  if (input) input.value = "";
  const list = document.getElementById("icd10-list");
  if (list) list.classList.add("hidden");
};

window.removeDiagnosis = function (type, index) {
  if (type === "primary") {
    window.currentDiagnoses.primary = null;
    if (window.currentDiagnoses.secondary.length > 0) {
      // Jika Utama dihapus, jadikan Sekunder pertama sebagai Utama
      window.currentDiagnoses.primary =
        window.currentDiagnoses.secondary.shift();
    }
  } else {
    window.currentDiagnoses.secondary.splice(index, 1);
  }
  window.renderDiagnosesCart();
};

window.renderDiagnosesCart = function () {
  const cart = document.getElementById("diagnoses-cart");
  if (!cart) return;

  let html = "";
  const diag = window.currentDiagnoses || { primary: null, secondary: [] };

  if (!diag.primary && diag.secondary.length === 0) {
    cart.innerHTML =
      '<p class="text-sm text-gray-500 italic p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">Belum ada diagnosa dipilih. Cari di atas.</p>';
    return;
  }

  if (diag.primary) {
    html += `
    <div class="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-2.5 rounded border border-green-200 dark:border-green-800">
      <div><span class="text-xs font-bold bg-green-200 text-green-800 px-2 py-1 rounded mr-2">UTAMA</span><span class="font-bold text-sm">${diag.primary.code}</span> - <span class="text-sm">${diag.primary.name}</span></div>
      <button onclick="window.removeDiagnosis('primary')" class="text-red-500 hover:text-red-700 font-bold text-lg" title="Hapus">×</button>
    </div>`;
  }

  diag.secondary.forEach((d, idx) => {
    html += `
    <div class="flex justify-between items-center bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700 mt-1.5">
      <div><span class="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded mr-2">PENYERTA</span><span class="font-bold text-sm">${d.code}</span> - <span class="text-sm">${d.name}</span></div>
      <button onclick="window.removeDiagnosis('secondary', ${idx})" class="text-red-400 hover:text-red-600 font-bold text-lg" title="Hapus">×</button>
    </div>`;
  });

  cart.innerHTML = html;
};

// ==========================================
// 4. ODONTOGRAM (POLI GIGI)
// ==========================================
async function loadOdontogramForSOAP(registrationId, targetPoly) {
  currentOdontogramRegId = registrationId;
  odontogramData = {};

  const { data: records } = await supabaseClient
    .from("dental_records")
    .select("tooth_number, condition_type")
    .eq("registration_id", registrationId);

  if (records) {
    records.forEach((r) => {
      if (!odontogramData[r.tooth_number]) odontogramData[r.tooth_number] = [];
      if (!odontogramData[r.tooth_number].includes(r.condition_type)) {
        odontogramData[r.tooth_number].push(r.condition_type);
      }
    });
  }

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

  document.getElementById("odontogram-container").innerHTML = odontogramSection;
  setTimeout(
    () => renderOdontogramChart("odontogram-chart-preview", odontogramData),
    100,
  );
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

  const colorMap = {
    healthy: "bg-white border-gray-300 text-gray-800",
    caries: "bg-red-500 border-red-600 text-white",
    calculus: "bg-yellow-500 border-yellow-600 text-white",
    filled: "bg-blue-500 border-blue-600 text-white",
    missing: "bg-gray-800 border-gray-900 text-white",
    pulpitis: "bg-purple-500 border-purple-600 text-white",
  };

  let html = '<div class="space-y-4">';

  [quadrants.slice(0, 2), quadrants.slice(2, 4)].forEach((row) => {
    html += '<div class="grid grid-cols-2 gap-4">';
    row.forEach((q) => {
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

        const clickAttr = `onclick="window.openToothModal('${tooth}')"`;
        const multiIndicator =
          conditions.length > 1
            ? `<span class="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center font-bold">${conditions.length}</span>`
            : "";

        html += `<div class="relative ${colorMap[displayCondition]} cursor-pointer hover:scale-110 transition-transform border-2 rounded-md aspect-square flex items-center justify-center text-xs font-bold" ${clickAttr}>${tooth}${multiIndicator}</div>`;
      });
      html += `</div></div>`;
    });
    html += "</div>";
  });

  html += `</div>
    <div class="mt-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
      <div class="flex flex-wrap gap-3 text-xs">
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-white border-2 border-gray-300 rounded"></div>Sehat</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-red-500 rounded"></div>Karies</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-yellow-500 rounded"></div>Karang Gigi</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-blue-500 rounded"></div>Tambalan</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-gray-800 rounded"></div>Hilang</div>
        <div class="flex items-center gap-1"><div class="w-4 h-4 bg-purple-500 rounded"></div>Pulpitis</div>
      </div>
    </div>`;
  container.innerHTML = html;
}

window.openToothModal = async function (toothNumber) {
  currentSelectedTooth = toothNumber;
  const { data: conditions } = await supabaseClient
    .from("dental_records")
    .select("condition_type, notes")
    .eq("registration_id", currentOdontogramRegId)
    .eq("tooth_number", toothNumber);
  const activeConditions = conditions?.map((c) => c.condition_type) || [];

  document.getElementById("odontogram-tooth-title").textContent =
    `Gigi Nomor: ${toothNumber}`;

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

  document.getElementById("tooth-notes").value = conditions?.[0]?.notes || "";
  document.getElementById("odontogram-modal").classList.remove("hidden");
};

window.closeOdontogramModal = function () {
  document.getElementById("odontogram-modal").classList.add("hidden");
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
    const { data: existing } = await supabaseClient
      .from("dental_records")
      .select("id")
      .eq("registration_id", currentOdontogramRegId)
      .eq("tooth_number", currentSelectedTooth)
      .eq("condition_type", condition)
      .maybeSingle();

    if (existing) {
      await supabaseClient
        .from("dental_records")
        .delete()
        .eq("id", existing.id);
    } else {
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

    // Reload
    const { data: records } = await supabaseClient
      .from("dental_records")
      .select("tooth_number, condition_type")
      .eq("registration_id", currentOdontogramRegId);
    odontogramData = {};
    if (records) {
      records.forEach((r) => {
        if (!odontogramData[r.tooth_number])
          odontogramData[r.tooth_number] = [];
        if (!odontogramData[r.tooth_number].includes(r.condition_type))
          odontogramData[r.tooth_number].push(r.condition_type);
      });
    }
    renderOdontogramChart("odontogram-chart-preview", odontogramData);
    await window.openToothModal(currentSelectedTooth);
  } catch (err) {
    alert("Gagal menyimpan kondisi gigi: " + err.message);
  }
};

// ==========================================
// 5. RESEP OBAT (HYBRID MEDICATION)
// ==========================================
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
        '<div class="text-center py-4">Mencari obat...</div>';

      try {
        const { data: profileData } = await supabaseClient
          .from("profiles")
          .select("clinic_id")
          .eq("id", localCurrentUser.id)
          .single();

        const { data: medications } = await supabaseClient
          .from("medications")
          .select("*")
          .eq("clinic_id", profileData.clinic_id)
          .or(
            `name.ilike.%${query}%,code.ilike.%${query}%,generic_name.ilike.%${query}%`,
          )
          .eq("is_active", true)
          // 🛠️ URUTKAN BERDASARKAN EXPIRED TERDEKAT (FEFO)
          .order("expired_date", { ascending: true, nullsFirst: false })
          .limit(10);

        if (!medications || medications.length === 0) {
          resultsDiv.innerHTML =
            '<div class="text-center py-4 text-gray-500 text-sm">Tidak ada obat ditemukan</div>';
          return;
        }

        resultsDiv.innerHTML = medications
          .map((med) => {
            // Cek Stok
            const stockStatus =
              med.stock <= 0
                ? '<span class="text-xs text-red-600 font-semibold">Stok Habis</span>'
                : `<span class="text-xs text-green-600">Stok: ${med.stock}</span>`;

            // 🛠️ LOGIKA WARNA EXPIRED DATE
            let expBadge = "";
            if (med.expired_date) {
              const today = new Date();
              const expDate = new Date(med.expired_date);
              const diffTime = expDate - today;
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              const formattedExp = expDate.toLocaleDateString("id-ID", {
                month: "short",
                year: "numeric",
              });

              if (diffDays < 0) {
                expBadge = `<span class="inline-block mt-1.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold border border-red-200">⛔ KEDALUWARSA (${formattedExp})</span>`;
              } else if (diffDays <= 90) {
                // Kurang dari 3 bulan (Bahaya)
                expBadge = `<span class="inline-block mt-1.5 text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold border border-red-200">⚠️ Exp Dekat: ${formattedExp}</span>`;
              } else if (diffDays <= 180) {
                // Kurang dari 6 bulan (Peringatan)
                expBadge = `<span class="inline-block mt-1.5 text-[10px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded font-bold border border-yellow-200">⏳ Exp: ${formattedExp}</span>`;
              } else {
                // Masih aman
                expBadge = `<span class="inline-block mt-1.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">Exp: ${formattedExp}</span>`;
              }
            } else {
              expBadge = `<span class="inline-block mt-1.5 text-[10px] bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded border border-gray-100">Exp: Tidak ada data</span>`;
            }

            return `
            <div class="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 hover:border-primary cursor-pointer transition" onclick="window.selectMedicationFromDatabase('${med.id}', '${med.name.replace(/'/g, "\\'")}', '${med.strength || ""}', ${med.stock})">
              <div class="flex justify-between items-start">
                <div>
                  <p class="font-semibold text-gray-900 dark:text-gray-100">${med.name}</p>
                  ${med.generic_name ? `<p class="text-[11px] text-primary font-medium italic mb-1">(${med.generic_name})</p>` : ""}
                  <p class="text-xs text-gray-500">${med.unit} • ${med.strength || "-"}</p>
                  ${expBadge}
                </div>
                ${stockStatus}
              </div>
            </div>`;
          })
          .join("");
      } catch (err) {
        resultsDiv.innerHTML = `<div class="text-red-500 text-center py-4 text-sm">Error: ${err.message}</div>`;
      }
    }, 300);
  });
}

window.selectMedicationFromDatabase = function (id, name, strength, stock) {
  if (stock <= 0) {
    alert("Stok obat habis!");
    return;
  }
  const existing = window.selectedMedications.find(
    (m) => m.medication_id === id && !m.is_manual,
  );

  if (existing) existing.qty += 1;
  else
    window.selectedMedications.push({
      medication_id: id,
      drug_name: name + (strength ? ` ${strength}` : ""),
      dose: "3x1",
      qty: 1,
      is_manual: false,
    });

  selectedMedications = window.selectedMedications;
  renderMedicationList();
  document.getElementById("medication-search").value = "";
  document.getElementById("medication-search-results").innerHTML = "";
};

window.addManualMedication = function () {
  const name = document.getElementById("manual-med-name").value.trim();
  const dose = document.getElementById("manual-med-dose").value.trim();
  const qty = parseInt(document.getElementById("manual-med-qty").value) || 0;
  if (!name || qty <= 0) {
    alert("Nama obat dan qty harus diisi!");
    return;
  }

  window.selectedMedications.push({
    medication_id: null,
    drug_name: name,
    dose: dose,
    qty: qty,
    is_manual: true,
  });
  selectedMedications = window.selectedMedications;
  renderMedicationList();

  document.getElementById("manual-med-name").value = "";
  document.getElementById("manual-med-dose").value = "";
  document.getElementById("manual-med-qty").value = "";
};

function renderMedicationList() {
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
      <button onclick="window.removeMedication(${index})" class="col-span-2 text-red-500 hover:text-red-700 flex justify-center"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
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

// ==========================================
// 6. SUBMIT SOAP & RESEP KE FARMASI
// ==========================================
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
      .eq("id", localCurrentUser.id)
      .single();
    const clinicId = profileData.clinic_id;
    const medicationsToProcess = JSON.parse(
      JSON.stringify(window.selectedMedications || []),
    );

    if (medicationsToProcess.length === 0) {
      msg.textContent = "⚠️ Tambahkan minimal 1 obat!";
      msg.className = "text-sm text-yellow-600 mt-2";
      msg.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Simpan & Kirim Farmasi";
      return;
    }

    const prescriptionItems = [];

    // Proses Stok Obat
    for (let i = 0; i < medicationsToProcess.length; i++) {
      const med = medicationsToProcess[i];
      try {
        if (!med.is_manual && med.medication_id) {
          const { data: medData } = await supabaseClient
            .from("medications")
            .select("stock, name")
            .eq("id", med.medication_id)
            .single();
          if (medData.stock < med.qty)
            throw new Error(`Stok habis: ${med.drug_name}`);

          const newStock = medData.stock - med.qty;
          await supabaseClient
            .from("medications")
            .update({ stock: newStock })
            .eq("id", med.medication_id);
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
          prescriptionItems.push({
            drug_name: med.drug_name,
            dose: med.dose,
            qty: med.qty,
            medication_id: null,
            is_manual: true,
          });
        }
      } catch (itemError) {
        console.error(`❌ Error ${med.drug_name}:`, itemError);
      }
    }

    if (prescriptionItems.length === 0) {
      msg.textContent = "❌ Tidak ada obat yang berhasil disimpan!";
      msg.className = "text-sm text-red-600 mt-2";
      msg.classList.remove("hidden");
      btn.disabled = false;
      btn.textContent = "Simpan & Kirim Farmasi";
      return;
    }

    // Simpan SOAP
    const soapData = {
      registration_id: doctorCurrentRegistrationId,
      doctor_id: localCurrentUser.id,
      clinic_id: clinicId,
      soap_subject: document.getElementById("soap-s")?.value || "",
      soap_objective: document.getElementById("soap-o")?.value || "",
      soap_assessment: document.getElementById("soap-a")?.value || "",
      soap_plan: document.getElementById("soap-p")?.value || "",

      // 🛠️ TANGKAP STATUS CENTANG INSIDEN
      is_work_accident: document.getElementById("soap-kk")?.checked || false,
      is_traffic_accident:
        document.getElementById("soap-kll")?.checked || false,

      // 🛠️ TANGKAP DARI KERANJANG DIAGNOSA
      icd10_code: window.currentDiagnoses.primary?.code || null,
      icd10_name: window.currentDiagnoses.primary?.name || null,
      secondary_diagnoses: window.currentDiagnoses.secondary || [],
    };

    await supabaseClient
      .from("medical_records")
      .upsert([soapData], { onConflict: "registration_id" });

    // Hapus Resep Lama & Simpan Resep Baru
    const { data: existingPresc } = await supabaseClient
      .from("prescriptions")
      .select("id")
      .eq("registration_id", doctorCurrentRegistrationId)
      .maybeSingle();
    if (existingPresc)
      await supabaseClient
        .from("prescriptions")
        .delete()
        .eq("id", existingPresc.id);
    await supabaseClient.from("prescriptions").insert([
      {
        registration_id: doctorCurrentRegistrationId,
        prescribed_by: localCurrentUser.id,
        clinic_id: clinicId,
        items: prescriptionItems,
        status: "pending",
      },
    ]);

    // Update Status
    await supabaseClient
      .from("registrations")
      .update({ status: "waiting_pharmacy" })
      .eq("id", doctorCurrentRegistrationId);

    // Pesan sukses baru yang interaktif
    msg.innerHTML = `✅ Data berhasil disimpan! Silakan klik tombol <b>Cetak</b> di atas jika butuh mencetak surat/resep. Atau <button onclick="window.navigateTo('doctor-queue')" class="underline font-bold text-primary hover:text-primaryHover">Kembali ke Antrean &rarr;</button>`;
    msg.className =
      "text-sm text-green-600 mt-3 p-3 bg-green-50 border border-green-200 rounded-lg";
    msg.classList.remove("hidden");

    window.selectedMedications = [];
    selectedMedications = [];
  } catch (err) {
    msg.textContent = "❌ Gagal: " + err.message;
    msg.className = "text-sm text-red-600 mt-2";
    msg.classList.remove("hidden");
    btn.disabled = false;
    btn.textContent = "Simpan & Kirim Farmasi";
  }
}

// ==========================================
// 7. UPDATE RIWAYAT SEUMUR HIDUP PASIEN
// ==========================================
window.updatePatientHistory = async function (patientId, currentHistory) {
  const newHistory = prompt(
    "Masukkan Riwayat Alergi / Penyakit Kronis Pasien:\n(Contoh: Alergi Amoxicillin, Hipertensi, DM Tipe 2)\n\nKosongkan jika tidak ada/ingin dihapus.",
    currentHistory,
  );

  if (newHistory !== null) {
    try {
      const { error } = await supabaseClient
        .from("patients")
        .update({ medical_history: newHistory.trim() })
        .eq("id", patientId);

      if (error) throw error;

      // 🛠️ Tambahan: Beri tahu dokter kalau sukses!
      alert("✅ Data alergi / riwayat berhasil disimpan!");

      // Muat ulang halaman SOAP agar warna kotaknya langsung berubah
      if (window.currentRegistrationId && localCurrentUser) {
        loadSOAPData(window.currentRegistrationId, localCurrentUser);
      }
    } catch (err) {
      alert("❌ Gagal mengupdate riwayat pasien: " + err.message);
    }
  }
};

// ==========================================
// 8. POP-UP RIWAYAT PEMERIKSAAN PASIEN
// ==========================================
window.openHistoryModal = async function (patientId, patientName) {
  let modal = document.getElementById("history-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "history-modal";
    modal.className =
      "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 hidden backdrop-blur-sm transition-opacity";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
          <div class="p-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <h3 class="font-bold text-xl text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <svg class="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Riwayat Medis: <span class="text-primary">${patientName}</span>
              </h3>
              <button onclick="document.getElementById('history-modal').classList.add('hidden')" class="text-gray-400 hover:text-red-500 transition p-1">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
          </div>
          <div class="p-6 overflow-y-auto flex-1 bg-gray-50/50 dark:bg-gray-900/20" id="history-modal-content">
              <div class="text-center py-10"><div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div><p class="text-gray-500">Mencari rekam medis...</p></div>
          </div>
      </div>
  `;

  modal.classList.remove("hidden");

  try {
    // 🛠️ FIX ERROR 400: Gunakan medical_records(*) agar tidak salah baca nama kolom
    const { data, error } = await supabaseClient
      .from("registrations")
      .select("created_at, complaint, target_poly, medical_records(*)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    const content = document.getElementById("history-modal-content");

    if (error) throw error;

    if (!data || data.length === 0) {
      content.innerHTML =
        '<div class="text-center py-10 bg-white rounded-xl border border-gray-200"><p class="text-gray-500 font-medium">Belum ada riwayat pemeriksaan sebelumnya.</p></div>';
      return;
    }

    content.innerHTML = data
      .map((reg, index) => {
        const date = new Date(reg.created_at).toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const med =
          reg.medical_records && reg.medical_records.length > 0
            ? reg.medical_records[0]
            : null;

        if (!med)
          return `
            <div class="mb-4 p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 opacity-70">
              <div class="flex justify-between items-center"><p class="font-bold text-gray-700">${date}</p><span class="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">${reg.target_poly}</span></div>
              <p class="text-sm text-gray-500 mt-2">Kunjungan tercatat, namun tidak ada data pemeriksaan SOAP dari dokter.</p>
            </div>`;

        const incidentBadge =
          med.is_work_accident || med.is_traffic_accident
            ? `<span class="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded font-bold border border-red-200 ml-2">⚠️ INSIDEN</span>`
            : "";

        return `
          <div class="mb-6 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden relative">
              ${index === 0 ? '<div class="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">Kunjungan Terakhir</div>' : ""}
              <div class="bg-gray-50 dark:bg-gray-900/50 p-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <p class="font-bold text-primary">${date}</p>
                <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-semibold">${reg.target_poly}</span>
              </div>
              <div class="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <span class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider block mb-1">Subjective (Keluhan)</span> 
                    <div class="bg-gray-50 dark:bg-gray-900/30 p-2 rounded">${med.soap_subject || med.soap_subjective || reg.complaint || "-"}</div>
                  </div>
                  <div>
                    <span class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider block mb-1">Objective (Pemeriksaan)</span> 
                    <div class="bg-gray-50 dark:bg-gray-900/30 p-2 rounded">${med.soap_objective || "-"}</div>
                  </div>
                  <div>
                    <span class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider block mb-1">Assessment (Diagnosa)</span> 
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-blue-900 dark:text-blue-300">
                      <span class="font-bold">${med.icd10_code || ""}</span> ${med.icd10_name || med.soap_assessment || "-"} ${incidentBadge}
                    </div>
                  </div>
                  <div>
                    <span class="font-bold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider block mb-1">Plan (Tindakan/Resep)</span> 
                    <div class="bg-green-50 dark:bg-green-900/20 p-2 rounded text-green-900 dark:text-green-300">${med.soap_plan || "-"}</div>
                  </div>
              </div>
          </div>
          `;
      })
      .join("");
  } catch (err) {
    document.getElementById("history-modal-content").innerHTML =
      `<div class="text-red-500 p-5 bg-red-50 rounded-xl border border-red-200">❌ Error memuat riwayat: ${err.message}</div>`;
  }
};
