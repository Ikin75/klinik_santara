// js/perawat.js
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

// --- 1. TAMPILKAN DAFTAR ANTREAN PERAWAT ---
export async function loadTriageQueue(currentUser) {
  const mainContent = document.getElementById("main-content");

  // Tampilkan loading spinner saat data sedang diambil
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
        // 🛠️ PERBAIKAN: Tambahkan medical_history di sini
        "id, queue_number, complaint, target_poly, patient_id, created_at, patients(full_name, medical_history)",
      )
      .eq("clinic_id", profileData.clinic_id)
      .eq("status", "waiting_triage")
      .order("created_at", { ascending: true });

    if (error || !regs || regs.length === 0) {
      mainContent.innerHTML = getEmptyState("Belum ada pasien menunggu TTV.");
      return;
    }

    mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">${regs
      .map(
        (r) => `
      <div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-md transition" onclick='window.navigateTo("input-ttv", ${JSON.stringify(r)})'>
        <div class="flex justify-between items-start mb-3">
          <span class="px-3 py-1 text-sm font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded">${r.queue_number}</span>
          <span class="text-xs text-gray-500">${formatTimeID(r.created_at)}</span>
        </div>
        <h4 class="font-bold text-lg text-gray-900 dark:text-gray-100">${r.patients.full_name}</h4>
        <p class="text-sm text-gray-500 mt-1 line-clamp-2">${r.complaint}</p>
        <button class="mt-4 text-sm font-semibold text-primary flex items-center gap-1">Input TTV <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg></button>
      </div>
    `,
      )
      .join("")}</div>`;
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 text-center py-4">Error: ${err.message}</div>`;
  }
}

// --- 2. TAMPILAN FORMULIR INPUT TTV ---
export function getInputTTVHTML(reg) {
  return `<div class="max-w-2xl mx-auto fade-in">
    <button onclick="window.navigateTo('triage')" class="mb-4 text-sm text-gray-500 flex items-center gap-1 hover:text-primary transition">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> Kembali ke Antrian
    </button>
    
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100">${reg.patients.full_name}</h3>
          <p class="text-sm text-gray-500 mt-1">No. Antrian: <span class="font-bold text-primary">${reg.queue_number}</span> | Poli: ${reg.target_poly}</p>
        </div>
        <span class="px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full border border-yellow-200 dark:border-yellow-800">Menunggu TTV</span>
      </div>
      <div class="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keluhan Utama (Dari Pendaftaran):</p>
        <p class="text-gray-900 dark:text-gray-100">${reg.complaint}</p>
      </div>
    </div>

    ${(() => {
      // PERHATIAN: Pastikan query di fungsi loadTriageQueue sudah mengambil patients(full_name, medical_history)
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
        <button onclick="window.updatePatientHistoryNurse('${reg.patient_id}', '${(historyText || "").replace(/'/g, "\\'")}', ${JSON.stringify(reg).replace(/"/g, "&quot;")})" class="px-3 py-1.5 bg-white/60 hover:bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 transition shadow-sm">
          ✏️ Update
        </button>
      </div>
      `;
    })()}
    
    <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800">
      <h4 class="font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center gap-2">
        <div class="p-2 bg-primary/10 rounded-lg text-primary">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        Input Tanda-Tanda Vital & Catatan
      </h4>
      <form id="ttv-form" class="space-y-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tensi Darah (mmHg)</label>
            <div class="flex items-center gap-2">
              <input type="number" id="sys-bp" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary outline-none transition" placeholder="Sistolik (cth: 120)">
              <span class="text-gray-400 font-medium">/</span>
              <input type="number" id="dia-bp" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary outline-none transition" placeholder="Diastolik (cth: 80)">
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nadi (x/menit)</label>
            <input type="number" id="heart-rate" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary outline-none transition" placeholder="Contoh: 80">
          </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Suhu (°C)</label>
            <input type="text" id="temperature" 
       class="w-full px-3 py-2 rounded-lg border ..."
       placeholder="36.5"
       maxlength="5"
       oninput="window.autoFormatTemperature(this)">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Berat Badan (kg)</label>
            <input type="number" step="0.1" id="weight" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary outline-none transition" placeholder="60">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tinggi Badan (cm)</label>
            <input type="number" id="height" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary outline-none transition" placeholder="170">
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan Tambahan Perawat</label>
          <textarea id="ttv-notes" rows="3" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-primary outline-none transition" placeholder="Tambahkan catatan jika ada..."></textarea>
        </div>

        <button type="submit" class="w-full bg-primary hover:bg-primaryHover text-white font-semibold py-3 px-6 rounded-lg transition shadow-md flex items-center justify-center gap-2">
          <span>Simpan & Kirim ke Dokter</span>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"></path></svg>
        </button>
      </form>
    </div>
  </div>`;
}

// --- 3. LOGIKA SIMPAN TTV ---
export function attachTTVListeners(regId, currentUser) {
  document.getElementById("ttv-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');

    // Simpan isi tombol awal agar bisa dikembalikan jika gagal
    const originalBtnContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML =
      '<svg class="animate-spin h-5 w-5 mr-2 inline" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Menyimpan...';

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

      // Kembali ke halaman antrean perawat secara otomatis
      window.navigateTo("triage");
    } catch (err) {
      window.showError("Gagal menyimpan data: " + err.message);
      btn.disabled = false;
      btn.innerHTML = originalBtnContent;
    }
  });
}

// ==========================================
// 4. UPDATE RIWAYAT SEUMUR HIDUP PASIEN (PERAWAT)
// ==========================================
window.updatePatientHistoryNurse = async function (
  patientId,
  currentHistory,
  regData,
) {
  // Ganti prompt dengan modal input sederhana
  const modal = document.createElement("div");
  modal.className =
    "fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-bounce-in">
      <h3 class="text-lg font-bold mb-2">✏️ Update Riwayat Medis</h3>
      <p class="text-sm text-gray-500 mb-4">Masukkan Riwayat Alergi / Penyakit Kronis Pasien:</p>
      <textarea id="history-input" rows="4" class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 outline-none text-sm">${currentHistory || ""}</textarea>
      <p class="text-xs text-gray-400 mt-2">Contoh: Alergi Amoxicillin, Hipertensi, DM Tipe 2. Kosongkan jika tidak ada.</p>
      <div class="flex gap-3 mt-4">
        <button id="cancel-history" class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg font-medium">Batal</button>
        <button id="save-history" class="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium">Simpan</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Handle save
  document.getElementById("save-history").onclick = async () => {
    const newHistory = document.getElementById("history-input").value.trim();
    modal.remove();

    try {
      await supabaseClient
        .from("patients")
        .update({ medical_history: newHistory })
        .eq("id", patientId);

      regData.patients.medical_history = newHistory;
      window.navigateTo("input-ttv", regData);
      window.showSuccess("Riwayat medis berhasil diupdate!");
    } catch (err) {
      window.showError("Gagal mengupdate riwayat pasien: " + err.message);
    }
  };

  // Handle cancel
  document.getElementById("cancel-history").onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
};

window.autoFormatTemperature = function (input) {
  // Hapus semua karakter selain angka
  let value = input.value.replace(/[^0-9]/g, "");

  // Batasi maksimal 4 digit (2 sebelum koma, 2 setelah)
  if (value.length > 4) value = value.slice(0, 4);

  // Format: tambah titik setelah 2 digit pertama
  if (value.length >= 3) {
    value = value.slice(0, 2) + "." + value.slice(2);
  } else if (value.length === 2) {
    value = value + ".";
  }

  input.value = value;
};
