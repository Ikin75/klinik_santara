// js/super-admin.js

import { supabaseClient } from "./config.js";

// ============================================
// RENDER HALAMAN SUPER ADMIN
// ============================================
export function renderSuperAdminPage() {
  const mainContent = document.getElementById("main-content");

  mainContent.innerHTML = `
    <div class="max-w-6xl mx-auto fade-in">
      <!-- Header -->
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
              🏢 Manajemen Klinik / Client
            </h2>
            <p class="text-sm text-gray-500 mt-1">Daftarkan klinik atau praktek baru</p>
          </div>
          <button onclick="window.showAddClinicForm()" 
                  class="px-6 py-3 bg-primary hover:bg-primaryHover text-white font-semibold rounded-xl transition shadow-lg flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Tambah Klinik Baru
          </button>
        </div>
      </div>

      <!-- Daftar Klinik -->
      <div id="clinics-list" class="space-y-4">
        <div class="text-center py-10">
          <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p class="text-gray-500">Memuat data klinik...</p>
        </div>
      </div>
    </div>

    <!-- Modal Form Tambah Klinik -->
    <div id="clinic-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-gray-800 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-y-auto">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100" id="modal-title">
              🏢 Tambah Klinik Baru
            </h3>
            <button onclick="window.closeClinicModal()" 
                    class="text-gray-400 hover:text-red-500 transition p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <form id="clinic-form" class="p-6 space-y-6">
          <!-- Info Dasar -->
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
            <h4 class="font-semibold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
              </svg>
              Informasi Klinik
            </h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nama Klinik *</label>
                <input type="text" id="clinic-name" required 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="Contoh: Klinik Sehat Perusahaan">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tipe *</label>
                <select id="clinic-type" required 
                        class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
                  <option value="">-- Pilih Tipe --</option>
                  <option value="clinic">Klinik Umum</option>
                  <option value="dental">Praktek Dokter Gigi</option>
                  <option value="hospital">Rumah Sakit</option>
                  <option value="independent">Praktek Mandiri</option>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">No. Telepon</label>
                <input type="text" id="clinic-phone" 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="021-xxxxxx">
              </div>
            </div>
            
            <div class="mt-3">
              <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Alamat Lengkap</label>
              <textarea id="clinic-address" rows="2" 
                        class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Jl. Contoh No. 123, Jakarta"></textarea>
            </div>
          </div>

          <!-- Kustomisasi Tampilan -->
          <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
            <h4 class="font-semibold text-purple-800 dark:text-purple-300 mb-4 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path>
              </svg>
              Kustomisasi Tampilan
            </h4>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">URL Logo</label>
                <input type="url" id="clinic-logo" 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="https://example.com/logo.png">
                <p class="text-xs text-gray-400 mt-1">Biarkan kosong untuk logo default</p>
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Warna Utama</label>
                <div class="flex gap-2">
                  <input type="color" id="clinic-primary-color" value="#2196F3" 
                         class="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer">
                  <input type="text" id="clinic-primary-color-text" value="#2196F3"
                         class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none text-sm"
                         placeholder="#2196F3">
                </div>
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Warna Sekunder</label>
                <div class="flex gap-2">
                  <input type="color" id="clinic-secondary-color" value="#FF9800" 
                         class="w-12 h-10 rounded-lg border border-gray-300 cursor-pointer">
                  <input type="text" id="clinic-secondary-color-text" value="#FF9800"
                         class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none text-sm"
                         placeholder="#FF9800">
                </div>
              </div>
            </div>
          </div>

          <!-- Admin Account -->
          <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
            <h4 class="font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
              </svg>
              Akun Admin Klinik
            </h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nama Admin *</label>
                <input type="text" id="admin-name" required 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="Dr. Ahmad">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email Admin *</label>
                <input type="email" id="admin-email" required 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="admin@klinik.com">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password *</label>
                <input type="password" id="admin-password" required 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="Minimal 6 karakter">
              </div>
              
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Role</label>
                <select id="admin-role" 
                        class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
                  <option value="admin">Admin Klinik</option>
                  <option value="owner">Pemilik</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Tombol -->
          <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onclick="window.closeClinicModal()" 
                    class="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition">
              Batal
            </button>
            <button type="submit" id="btn-save-clinic"
                    class="flex-1 px-6 py-3 bg-primary hover:bg-primaryHover text-white font-semibold rounded-xl transition shadow-lg">
              💾 Simpan Klinik
            </button>
          </div>
          <p id="clinic-msg" class="text-sm hidden mt-2"></p>
        </form>
      </div>
    </div>
  `;

  // Setup listeners
  setupClinicFormListeners();
  setupColorSyncListeners();

  // Load daftar klinik
  loadClinicsList();
}

// ============================================
// LOAD DAFTAR KLINIK
// ============================================
async function loadClinicsList() {
  const container = document.getElementById("clinics-list");

  try {
    const { data: clinics, error } = await supabaseClient
      .from("clinics")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!clinics || clinics.length === 0) {
      container.innerHTML = `
        <div class="bg-white dark:bg-darkCard p-10 rounded-xl border border-gray-200 dark:border-gray-800 text-center">
          <p class="text-5xl mb-4">🏢</p>
          <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Belum Ada Klinik</h3>
          <p class="text-gray-500 mt-2">Klik tombol "Tambah Klinik Baru" untuk mendaftarkan client pertama Anda.</p>
        </div>`;
      return;
    }

    container.innerHTML = clinics
      .map(
        (clinic) => `
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-lg transition">
        <div class="flex justify-between items-start">
          <div class="flex items-start gap-4">
            <img src="${clinic.logo_url || "default-logo.png"}" 
                 class="w-16 h-16 rounded-xl object-cover border border-gray-200"
                 onerror="this.src='default-logo.png'">
            <div>
              <h3 class="font-bold text-lg text-gray-900 dark:text-gray-100">${clinic.name}</h3>
              <p class="text-sm text-gray-500">${
                clinic.type === "dental"
                  ? "🦷 Praktek Dokter Gigi"
                  : clinic.type === "hospital"
                    ? "🏥 Rumah Sakit"
                    : clinic.type === "independent"
                      ? "👨‍⚕️ Praktek Mandiri"
                      : "🏢 Klinik Umum"
              }</p>
              <p class="text-xs text-gray-400 mt-1">📍 ${clinic.address || "Alamat belum diisi"}</p>
              
              <div class="flex gap-2 mt-3">
                <span class="px-2 py-1 text-xs rounded-full font-medium" 
                      style="background:${clinic.primary_color}20; color:${clinic.primary_color}">
                  🎨 Warna Utama
                </span>
                <span class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">
                  ✅ Aktif
                </span>
              </div>
            </div>
          </div>
          
          <div class="flex gap-2">
            <button onclick="window.editClinic('${clinic.id}')" 
                    class="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium">
              ✏️ Edit
            </button>
            <button onclick="window.manageClinicUsers('${clinic.id}')" 
                    class="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition font-medium">
              👥 Users
            </button>
          </div>
        </div>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    container.innerHTML = `<div class="text-red-500 text-center py-4">❌ Error: ${err.message}</div>`;
  }
}

// ============================================
// FORM LISTENERS
// ============================================
function setupClinicFormListeners() {
  const form = document.getElementById("clinic-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("btn-save-clinic");
    const msg = document.getElementById("clinic-msg");

    btn.disabled = true;
    btn.innerHTML = "⏳ Menyimpan...";

    try {
      // 1. Buat clinic dulu
      const { data: clinic, error: clinicError } = await supabaseClient
        .from("clinics")
        .insert([
          {
            name: document.getElementById("clinic-name").value.trim(),
            type: document.getElementById("clinic-type").value,
            logo_url:
              document.getElementById("clinic-logo").value.trim() || null,
            primary_color: document.getElementById("clinic-primary-color-text")
              .value,
            secondary_color: document.getElementById(
              "clinic-secondary-color-text",
            ).value,
            address:
              document.getElementById("clinic-address").value.trim() || null,
            phone: document.getElementById("clinic-phone").value.trim() || null,
          },
        ])
        .select()
        .single();

      if (clinicError) throw clinicError;

      // 2. Buat user admin
      const adminEmail = document.getElementById("admin-email").value.trim();
      const adminPassword = document.getElementById("admin-password").value;

      const { data: authData, error: authError } =
        await supabaseClient.auth.signUp({
          email: adminEmail,
          password: adminPassword,
        });

      if (authError) throw authError;

      // 3. Insert profile dengan clinic_id
      if (authData.user) {
        await supabaseClient.from("profiles").insert([
          {
            id: authData.user.id,
            clinic_id: clinic.id,
            role: document.getElementById("admin-role").value,
            full_name: document.getElementById("admin-name").value.trim(),
          },
        ]);
      }

      msg.textContent = `✅ Klinik "${clinic.name}" berhasil didaftarkan! Admin: ${adminEmail}`;
      msg.className = "text-sm text-green-600 mt-2 p-3 bg-green-50 rounded-lg";
      msg.classList.remove("hidden");

      // Reset form
      form.reset();

      // Refresh list
      setTimeout(() => {
        loadClinicsList();
        window.closeClinicModal();
      }, 1500);
    } catch (err) {
      msg.textContent = "❌ Gagal: " + err.message;
      msg.className = "text-sm text-red-600 mt-2 p-3 bg-red-50 rounded-lg";
      msg.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.innerHTML = "💾 Simpan Klinik";
    }
  });
}

function setupColorSyncListeners() {
  const colorPicker = document.getElementById("clinic-primary-color");
  const colorText = document.getElementById("clinic-primary-color-text");
  const colorPicker2 = document.getElementById("clinic-secondary-color");
  const colorText2 = document.getElementById("clinic-secondary-color-text");

  if (colorPicker && colorText) {
    colorPicker.addEventListener(
      "input",
      () => (colorText.value = colorPicker.value),
    );
    colorText.addEventListener(
      "input",
      () => (colorPicker.value = colorText.value),
    );
  }

  if (colorPicker2 && colorText2) {
    colorPicker2.addEventListener(
      "input",
      () => (colorText2.value = colorPicker2.value),
    );
    colorText2.addEventListener(
      "input",
      () => (colorPicker2.value = colorText2.value),
    );
  }
}

// ============================================
// MODAL FUNCTIONS
// ============================================
window.showAddClinicForm = function () {
  document.getElementById("modal-title").textContent = "🏢 Tambah Klinik Baru";
  document.getElementById("clinic-form").reset();
  document.getElementById("clinic-modal").classList.remove("hidden");
};

window.closeClinicModal = function () {
  document.getElementById("clinic-modal").classList.add("hidden");
};

// ============================================
// INIT
// ============================================
export function initSuperAdmin() {
  renderSuperAdminPage();
}
