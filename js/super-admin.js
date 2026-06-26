// js/super-admin.js

import { supabaseClient } from "./config.js";

// ============================================
// RENDER HALAMAN SUPER ADMIN
// ============================================
export function renderSuperAdminPage() {
  const mainContent = document.getElementById("main-content");

  mainContent.innerHTML = `
    <div class="max-w-6xl mx-auto fade-in">
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

      <div id="clinics-list" class="space-y-4">
        <div class="text-center py-10">
          <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
          <p class="text-gray-500">Memuat data klinik...</p>
        </div>
      </div>
    </div>

    <!-- Modal Form -->
    <div id="clinic-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-gray-800 w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-y-auto">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div class="flex justify-between items-center">
            <h3 class="text-xl font-bold" id="modal-title">🏢 Tambah Klinik Baru</h3>
            <button onclick="window.closeClinicModal()" class="text-gray-400 hover:text-red-500 transition p-1 rounded-lg">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>
        
        <form id="clinic-form" class="p-6 space-y-6">
          <!-- Info Dasar -->
          <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
            <h4 class="font-semibold text-blue-800 dark:text-blue-300 mb-4">Informasi Klinik</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-1">Nama Klinik *</label>
                <input type="text" id="clinic-name" required 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="Contoh: Klinik Sehat Perusahaan">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Tipe *</label>
                <select id="clinic-type" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none">
                  <option value="">-- Pilih Tipe --</option>
                  <option value="clinic">Klinik Umum</option>
                  <option value="dental">Praktek Dokter Gigi</option>
                  <option value="independent">Praktek Mandiri</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">No. Telepon</label>
                <input type="text" id="clinic-phone" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none" placeholder="021-xxxxxx">
              </div>
            </div>
            <div class="mt-3">
              <label class="block text-sm font-medium mb-1">Alamat</label>
              <textarea id="clinic-address" rows="2" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none" placeholder="Jl. Contoh No. 123"></textarea>
            </div>
          </div>

          <!-- Kustomisasi -->
          <div class="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
            <h4 class="font-semibold text-purple-800 dark:text-purple-300 mb-4">Kustomisasi Tampilan</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- UPLOAD LOGO -->
              <div>
                <label class="block text-sm font-medium mb-1">Logo Klinik</label>
                <div class="mb-3 flex items-center gap-4">
                  <img id="logo-preview" src="" class="w-20 h-20 rounded-xl object-cover border-2 border-dashed border-gray-300" style="display:none;">
                  <div id="logo-placeholder" class="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl text-gray-400 border-2 border-dashed border-gray-300">🏢</div>
                </div>
                <input type="file" id="clinic-logo-file" accept="image/png,image/jpeg,image/jpg"
                       class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white file:cursor-pointer">
                <div class="mt-3">
                  <p class="text-xs text-gray-400 mb-1">Atau URL logo:</p>
                  <input type="url" id="clinic-logo-url" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none text-sm" placeholder="https://...">
                </div>
                <p class="text-xs text-gray-400 mt-2">PNG/JPG, max 2MB</p>
              </div>
              
              <!-- WARNA -->
              <div>
                <label class="block text-sm font-medium mb-1">Warna Utama</label>
                <div class="flex gap-2">
                  <input type="color" id="clinic-primary-color" value="#2196F3" class="w-12 h-10 rounded-lg border cursor-pointer">
                  <input type="text" id="clinic-primary-color-text" value="#2196F3" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none text-sm">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Warna Sekunder</label>
                <div class="flex gap-2">
                  <input type="color" id="clinic-secondary-color" value="#FF9800" class="w-12 h-10 rounded-lg border cursor-pointer">
                  <input type="text" id="clinic-secondary-color-text" value="#FF9800" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none text-sm">
                </div>
              </div>
            </div>

                      <!-- SATUSEHAT Settings -->
          <div class="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800">
            <h4 class="font-semibold text-orange-800 dark:text-orange-300 mb-4 flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0"></path>
              </svg>
              📡 Integrasi SATUSEHAT
            </h4>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Client ID</label>
                <input type="text" id="clinic-satusehat-id" 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Client Secret</label>
                <input type="password" id="clinic-satusehat-secret" 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="••••••••••••••••••••••••">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Organization ID</label>
                <input type="text" id="clinic-satusehat-org" 
                       class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary"
                       placeholder="100001">
              </div>
              <div class="flex items-end">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="clinic-satusehat-enabled" class="w-4 h-4 text-primary rounded focus:ring-primary">
                  <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Aktifkan SATUSEHAT</span>
                </label>
              </div>
            </div>
          </div>
          </div>

          <!-- Admin Account -->
          <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
            <h4 class="font-semibold text-green-800 dark:text-green-300 mb-4">Akun Admin Klinik</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">Nama Admin *</label>
                <input type="text" id="admin-name" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none" placeholder="Dr. Ahmad">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Email Admin *</label>
                <input type="email" id="admin-email" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none" placeholder="admin@klinik.com">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Password *</label>
                <input type="password" id="admin-password" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none" placeholder="Min 6 karakter">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Role</label>
                <select id="admin-role" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none">
                  <option value="admin">Admin Klinik</option>
                  <option value="owner">Pemilik</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Tombol -->
          <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button type="button" onclick="window.closeClinicModal()" class="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl transition">Batal</button>
            <button type="submit" id="btn-save-clinic" class="flex-1 px-6 py-3 bg-primary hover:bg-primaryHover text-white font-semibold rounded-xl transition shadow-lg">💾 Simpan Klinik</button>
          </div>
          <p id="clinic-msg" class="text-sm hidden mt-2"></p>
        </form>
      </div>
    </div>
  `;

  // Setup
  setupClinicFormListeners();
  setupColorSyncListeners();
  setupLogoUploadListener();
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
      container.innerHTML = `<div class="bg-white dark:bg-darkCard p-10 rounded-xl border border-gray-200 dark:border-gray-800 text-center"><p class="text-5xl mb-4">🏢</p><h3 class="text-lg font-semibold">Belum Ada Klinik</h3><p class="text-gray-500 mt-2">Klik tombol "Tambah Klinik Baru" untuk mendaftarkan client.</p></div>`;
      return;
    }

    container.innerHTML = clinics
      .map(
        (clinic) => `
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-lg transition">
        <div class="flex justify-between items-start">
          <div class="flex items-start gap-4">
            ${
              clinic.logo_url
                ? `<img src="${clinic.logo_url}" class="w-16 h-16 rounded-xl object-cover border border-gray-200" onerror="this.style.display='none'">`
                : `<div class="w-16 h-16 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl">🏢</div>`
            }
            <div>
              <h3 class="font-bold text-lg">${clinic.name}</h3>
              <p class="text-sm text-gray-500">${clinic.type === "dental" ? "🦷 Dokter Gigi" : clinic.type === "independent" ? "👨‍⚕️ Praktek Mandiri" : "🏢 Klinik Umum"}</p>
              <p class="text-xs text-gray-400 mt-1">📍 ${clinic.address || "-"}</p>
              <div class="flex gap-2 mt-3">
                <span class="px-2 py-1 text-xs rounded-full font-medium" style="background:${clinic.primary_color}20; color:${clinic.primary_color}">🎨 Warna</span>
                <span class="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full font-medium">✅ Aktif</span>
              </div>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="window.editClinic('${clinic.id}')" class="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium">✏️ Edit</button>
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
// UPLOAD LOGO
// ============================================
async function uploadLogoToStorage(file) {
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
  if (!allowedTypes.includes(file.type))
    throw new Error("Format harus PNG atau JPG!");
  if (file.size > 2 * 1024 * 1024) throw new Error("Ukuran maksimal 2MB!");

  const fileExt = file.name.split(".").pop();
  const fileName = `logo-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `logos/${fileName}`;

  const { error } = await supabaseClient.storage
    .from("clinic-logos")
    .upload(filePath, file, { cacheControl: "3600", upsert: true });
  if (error) throw error;

  const { data: urlData } = supabaseClient.storage
    .from("clinic-logos")
    .getPublicUrl(filePath);
  return urlData.publicUrl;
}

// ============================================
// PREVIEW LOGO
// ============================================
window.previewLogo = function (input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById("logo-preview").src = e.target.result;
    document.getElementById("logo-preview").style.display = "block";
    document.getElementById("logo-placeholder").style.display = "none";
  };
  reader.readAsDataURL(file);
};

function setupLogoUploadListener() {
  const fileInput = document.getElementById("clinic-logo-file");
  if (fileInput)
    fileInput.addEventListener("change", () => window.previewLogo(fileInput));
}

// ============================================
// COLOR SYNC
// ============================================
function setupColorSyncListeners() {
  const cp = document.getElementById("clinic-primary-color");
  const ct = document.getElementById("clinic-primary-color-text");
  const cp2 = document.getElementById("clinic-secondary-color");
  const ct2 = document.getElementById("clinic-secondary-color-text");
  if (cp && ct) {
    cp.addEventListener("input", () => (ct.value = cp.value));
    ct.addEventListener("input", () => (cp.value = ct.value));
  }
  if (cp2 && ct2) {
    cp2.addEventListener("input", () => (ct2.value = cp2.value));
    ct2.addEventListener("input", () => (cp2.value = ct2.value));
  }
}

// ============================================
// FORM SUBMIT
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
      // Upload logo dulu kalau ada file
      let logoUrl = null;
      const fileInput = document.getElementById("clinic-logo-file");
      const urlInput = document.getElementById("clinic-logo-url");

      if (fileInput && fileInput.files[0]) {
        btn.innerHTML = "📤 Upload logo...";
        logoUrl = await uploadLogoToStorage(fileInput.files[0]);
      } else if (urlInput && urlInput.value.trim()) {
        logoUrl = urlInput.value.trim();
      }

      // Simpan clinic (INSERT atau UPDATE)
      const editId = form.dataset.editId;
      let clinic;

      if (editId) {
        // UPDATE
        const { data: updated, error: updateError } = await supabaseClient
          .from("clinics")
          .update({
            name: document.getElementById("clinic-name").value.trim(),
            type: document.getElementById("clinic-type").value,
            logo_url: logoUrl,
            primary_color: document.getElementById("clinic-primary-color-text")
              .value,
            secondary_color: document.getElementById(
              "clinic-secondary-color-text",
            ).value,
            address:
              document.getElementById("clinic-address").value.trim() || null,
            phone: document.getElementById("clinic-phone").value.trim() || null,
            // 🆕 SATUSEHAT
            satusehat_client_id:
              document.getElementById("clinic-satusehat-id").value.trim() ||
              null,
            satusehat_client_secret:
              document.getElementById("clinic-satusehat-secret").value.trim() ||
              null,
            satusehat_org_id:
              document.getElementById("clinic-satusehat-org").value.trim() ||
              null,
            satusehat_enabled: document.getElementById(
              "clinic-satusehat-enabled",
            ).checked,
          })
          .eq("id", editId)
          .select()
          .single();

        if (updateError) throw updateError;
        clinic = updated;
      } else {
        // INSERT
        const { data: inserted, error: insertError } = await supabaseClient
          .from("clinics")
          .insert([
            {
              name: document.getElementById("clinic-name").value.trim(),
              type: document.getElementById("clinic-type").value,
              logo_url: logoUrl,
              primary_color: document.getElementById(
                "clinic-primary-color-text",
              ).value,
              secondary_color: document.getElementById(
                "clinic-secondary-color-text",
              ).value,
              address:
                document.getElementById("clinic-address").value.trim() || null,
              phone:
                document.getElementById("clinic-phone").value.trim() || null,
              // 🆕 SATUSEHAT
              satusehat_client_id:
                document.getElementById("clinic-satusehat-id").value.trim() ||
                null,
              satusehat_client_secret:
                document
                  .getElementById("clinic-satusehat-secret")
                  .value.trim() || null,
              satusehat_org_id:
                document.getElementById("clinic-satusehat-org").value.trim() ||
                null,
              satusehat_enabled: document.getElementById(
                "clinic-satusehat-enabled",
              ).checked,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        clinic = inserted;
      }

      // Buat user admin (HANYA untuk INSERT baru)
      if (!editId) {
        const { data: authData, error: authError } =
          await supabaseClient.auth.signUp({
            email: document.getElementById("admin-email").value.trim(),
            password: document.getElementById("admin-password").value,
          });
        if (authError) throw authError;

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
      }

      // ✅ SUKSES
      msg.textContent = editId
        ? `✅ Klinik "${clinic.name}" berhasil diupdate!`
        : `✅ Klinik "${clinic.name}" berhasil! Admin: ${document.getElementById("admin-email").value}`;
      msg.className = "text-sm text-green-600 mt-2 p-3 bg-green-50 rounded-lg";
      msg.classList.remove("hidden");

      form.reset();
      form.dataset.editId = "";
      document.getElementById("logo-preview").style.display = "none";
      document.getElementById("logo-placeholder").style.display = "flex";
      document.querySelector(".bg-green-50").style.display = "";

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

// ============================================
// MODAL
// ============================================
window.showAddClinicForm = function () {
  document.getElementById("modal-title").textContent = "🏢 Tambah Klinik Baru";
  document.getElementById("clinic-form").reset();
  document.getElementById("clinic-form").dataset.editId = "";
  document.getElementById("logo-preview").style.display = "none";
  document.getElementById("logo-placeholder").style.display = "flex";

  // Tampilkan admin fields & KEMBALIKAN required
  document.querySelector(".bg-green-50").style.display = "";
  document.getElementById("admin-name").setAttribute("required", "required");
  document.getElementById("admin-email").setAttribute("required", "required");
  document
    .getElementById("admin-password")
    .setAttribute("required", "required");

  document.getElementById("clinic-modal").classList.remove("hidden");
};

// ============================================
// EDIT CLINIC
// ============================================
window.editClinic = async function (clinicId) {
  try {
    // Ambil data klinik
    const { data: clinic, error } = await supabaseClient
      .from("clinics")
      .select("*")
      .eq("id", clinicId)
      .single();

    if (error) throw error;
    // Isi field SATUSEHAT
    document.getElementById("clinic-satusehat-id").value =
      clinic.satusehat_client_id || "";
    document.getElementById("clinic-satusehat-secret").value =
      clinic.satusehat_client_secret || "";
    document.getElementById("clinic-satusehat-org").value =
      clinic.satusehat_org_id || "";
    document.getElementById("clinic-satusehat-enabled").checked =
      clinic.satusehat_enabled || false;
    // Isi form dengan data klinik
    document.getElementById("modal-title").textContent = "✏️ Edit Klinik";
    document.getElementById("clinic-name").value = clinic.name || "";
    document.getElementById("clinic-type").value = clinic.type || "";
    document.getElementById("clinic-phone").value = clinic.phone || "";
    document.getElementById("clinic-address").value = clinic.address || "";
    document.getElementById("clinic-primary-color").value =
      clinic.primary_color || "#2196F3";
    document.getElementById("clinic-primary-color-text").value =
      clinic.primary_color || "#2196F3";
    document.getElementById("clinic-secondary-color").value =
      clinic.secondary_color || "#FF9800";
    document.getElementById("clinic-secondary-color-text").value =
      clinic.secondary_color || "#FF9800";
    document.getElementById("clinic-logo-url").value = clinic.logo_url || "";

    // Tampilkan logo jika ada
    if (clinic.logo_url) {
      document.getElementById("logo-preview").src = clinic.logo_url;
      document.getElementById("logo-preview").style.display = "block";
      document.getElementById("logo-placeholder").style.display = "none";
    } else {
      document.getElementById("logo-preview").style.display = "none";
      document.getElementById("logo-placeholder").style.display = "flex";
    }

    // Simpan clinic ID di form (untuk update)
    document.getElementById("clinic-form").dataset.editId = clinicId;

    // Sembunyikan field admin & HAPUS required
    const adminSection = document.querySelector(".bg-green-50");
    adminSection.style.display = "none";

    // Hapus atribut required dari field admin
    document.getElementById("admin-name").removeAttribute("required");
    document.getElementById("admin-email").removeAttribute("required");
    document.getElementById("admin-password").removeAttribute("required");

    // Tampilkan modal
    document.getElementById("clinic-modal").classList.remove("hidden");
  } catch (err) {
    alert("❌ Gagal load data klinik: " + err.message);
  }
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
