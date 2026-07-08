// Di bagian paling atas file pendaftaran.js, tambahkan:
import { satusehatBridge } from "./satusehat-bridge.js";
import { supabaseClient } from "./config.js";

// 1. Fungsi untuk merender tampilan Pendaftaran
export function getRegistrationHTML() {
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

        <!-- Form Kunjungan -->
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
        <!-- Modal Edit Pasien -->
<div id="edit-patient-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
  <div class="bg-white dark:bg-gray-800 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl p-6">
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-xl font-bold">✏️ Edit Data Pasien</h3>
      <button onclick="window.closeEditPatientModal()" class="text-gray-400 hover:text-red-500 text-2xl">&times;</button>
    </div>
    <form id="edit-patient-form" class="space-y-4">
      <input type="hidden" id="edit-patient-id">
      <div>
        <label class="block text-sm font-medium mb-1">Gelar</label>
        <select id="edit-title" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none">
          <option value="">-- Pilih --</option>
          <option value="Tn.">Tn.</option>
          <option value="Ny.">Ny.</option>
          <option value="Sdr.">Sdr.</option>
          <option value="Sdri.">Sdri.</option>
          <option value="An.">An.</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Nama Lengkap *</label>
        <input type="text" id="edit-name" required class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">NIK</label>
        <input type="text" id="edit-nik" maxlength="16" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Tanggal Lahir</label>
        <input type="date" id="edit-dob" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Jenis Kelamin</label>
        <select id="edit-gender" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none">
          <option value="">-- Pilih --</option>
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">No. Handphone</label>
        <input type="tel" id="edit-phone" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Alamat</label>
        <textarea id="edit-address" rows="2" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none"></textarea>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Kategori</label>
        <select id="edit-category" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none">
          <option value="Umum">Umum / Pribadi</option>
          <option value="Karyawan">Karyawan Perusahaan</option>
          <option value="Vendor">Vendor / Rekanan</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Nama PT / Perusahaan</label>
        <input type="text" id="edit-company" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none" placeholder="Nama PT">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">Departemen</label>
        <input type="text" id="edit-department" class="w-full px-4 py-2 rounded-lg border dark:bg-gray-900 outline-none" placeholder="Departemen">
      </div>
      <div class="flex gap-3 pt-4">
        <button type="button" onclick="window.closeEditPatientModal()" class="flex-1 px-4 py-2.5 bg-gray-200 rounded-lg font-medium">Batal</button>
        <button type="submit" class="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg font-medium">💾 Simpan Perubahan</button>
      </div>
    </form>
  </div>
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
            <!-- Titel -->
<div class="flex items-end gap-2">
  <!-- GELAR (Title) -->
<div>
  <label class="block text-sm font-medium mb-1">Gelar</label>
  <select id="new-title" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none">
    <option value="">-- Pilih --</option>
    <option value="Tn.">Tn.</option>
    <option value="Ny.">Ny.</option>
    <option value="Sdr.">Sdr.</option>
    <option value="Sdri.">Sdri.</option>
    <option value="An.">An.</option>
  </select>
</div>

<!-- Nama Lengkap (yang sudah ada) -->
  <div class="flex-1">
    <label class="block text-sm font-medium mb-1">Nama Lengkap *</label>
    <input type="text" id="new-name" required class="w-full px-4 py-2 rounded-lg border ...">
  </div>
</div>
            <div>
              <label class="block text-sm font-medium mb-1">NIK</label>
              <input type="text" id="new-nik" maxlength="16" class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 outline-none" placeholder="16 digit">
            </div>
          </div>
<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800">
  <div>
    <label class="block text-sm font-medium mb-1 text-blue-800 dark:text-blue-300">Kategori Pasien *</label>
    <select id="reg-category" onchange="window.toggleCorporateFields()" class="w-full p-2.5 border border-blue-200 rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
      <option value="Umum">Umum / Pribadi</option>
      <option value="Karyawan">Karyawan Perusahaan</option>
      <option value="Vendor">Vendor / Rekanan</option>
    </select>
  </div>
  
  <div id="div-company" class="hidden">
    <label class="block text-sm font-medium mb-1 text-blue-800 dark:text-blue-300">Nama PT / Perusahaan *</label>
    <!-- Untuk PRO: dropdown -->
    <select id="reg-company" class="w-full p-2.5 border border-blue-200 rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
      <option value="">-- Pilih Perusahaan --</option>
    </select>
    <!-- Untuk FREE: input teks (sembunyi dulu) -->
<input type="text" id="reg-company-free" class="... hidden" placeholder="Nama PT / Perusahaan">
<p id="hint-company-free" class="hidden text-xs text-primary/70 mt-1">
  💡 <em>Upgrade ke <strong>PRO</strong> untuk mengelola daftar perusahaan & vendor secara terpusat.</em>
</p>
  </div>
  
  <div id="div-department" class="hidden">
    <label class="block text-sm font-medium mb-1 text-blue-800 dark:text-blue-300">Departemen / Bagian</label>
    <select id="reg-department" class="w-full p-2.5 border border-blue-200 rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
      <option value="">-- Pilih Departemen --</option>
    </select>
    <input type="text" id="reg-department-free" class="w-full px-4 py-2.5 rounded-lg border border-blue-200 dark:bg-gray-900 outline-none hidden" placeholder="Departemen / Bagian">
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
      <!-- NOTIFIKASI POPUP -->
<div id="notif-popup" class="hidden fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-bounce-in">
    <div class="text-5xl mb-4">✅</div>
    <h3 id="notif-title" class="text-xl font-bold text-green-600 mb-2">Berhasil!</h3>
    <p id="notif-message" class="text-gray-600 dark:text-gray-300 mb-6"></p>
    <button onclick="window.closeNotif()" class="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primaryHover transition">
      OK
    </button>
  </div>
</div>
    </div>
  `;
}

// 2. Fungsi Generate Nomor Antrean
async function generateQueueNumber(poly, currentUser) {
  // PERBAIKAN: Gunakan format tanggal lokal.
  // toISOString() menggunakan UTC yang bisa membuat antrean reset jam 7 pagi WIB, bukan tengah malam.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  let prefix = "A";
  if (poly.includes("Gigi")) prefix = "B";
  if (poly.includes("Anak")) prefix = "C";

  const { data: profileData, error: pErr } = await supabaseClient
    .from("profiles")
    .select("clinic_id")
    .eq("id", currentUser.id)
    .single();

  if (pErr || !profileData)
    throw new Error("Data profil klinik tidak ditemukan.");

  const { count, error: cErr } = await supabaseClient
    .from("registrations")
    .select("*", { count: "exact", head: true })
    .eq("clinic_id", profileData.clinic_id)
    .eq("target_poly", poly)
    .gte("created_at", today);

  if (cErr) throw cErr;

  const number = String((count || 0) + 1).padStart(3, "0");
  return `${prefix}-${number}`;
}

// 3. Inisialisasi Logika Pendaftaran
export function initRegistration(currentUser, clinicSettings) {
  let selectedPatientForVisit = null;

  // Fungsi notifikasi popup
  window.showNotif = function (title, message) {
    document.getElementById("notif-title").textContent = title;
    document.getElementById("notif-message").innerHTML = message;
    document.getElementById("notif-popup").classList.remove("hidden");
  };

  window.closeNotif = function () {
    document.getElementById("notif-popup").classList.add("hidden");
  };

  // 🛠️ TAMBAHAN: Tarik opsi Master Corporate dari database secara realtime
  async function loadCorporateDropdownOptions() {
    try {
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("clinic_id")
        .eq("id", currentUser.id)
        .single();
      if (!profile) return;

      // Ambil data PT & Departemen sekaligus secara bersamaan
      const [compRes, deptRes] = await Promise.all([
        supabaseClient
          .from("companies")
          .select("name, type")
          .eq("clinic_id", profile.clinic_id)
          .order("name"),
        supabaseClient
          .from("departments")
          .select("name")
          .eq("clinic_id", profile.clinic_id)
          .order("name"),
      ]);

      // Simpan data perusahaan ke memori global untuk difilter nanti
      if (compRes.data) {
        window.allMasterCompanies = compRes.data;
      }

      // Isi Dropdown Departemen otomatis
      const deptSelect = document.getElementById("reg-department");
      if (deptSelect && deptRes.data) {
        deptSelect.innerHTML =
          '<option value="">-- Pilih Departemen --</option>' +
          deptRes.data
            .map((d) => `<option value="${d.name}">${d.name}</option>`)
            .join("");
      }
    } catch (err) {
      console.error("Gagal memuat opsi corporate ke pendaftaran:", err);
    }
  }

  // Jalankan fungsinya langsung
  loadCorporateDropdownOptions();

  // Cek paket pengguna
  const plan =
    clinicSettings?.plan || localStorage.getItem("clinic_plan") || "free";
  if (plan === "free") {
    document.getElementById("reg-company-free").classList.remove("hidden");
    document.getElementById("hint-company-free").classList.remove("hidden");
    document.getElementById("reg-company").classList.add("hidden");
    document.getElementById("reg-company-free").classList.remove("hidden");
    document.getElementById("reg-department").classList.add("hidden");
    document.getElementById("reg-department-free").classList.remove("hidden");
  }

  // ... (sisa kode fungsi initRegistration Anda yang lama seperti window.switchRegTab, dll) ...

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

  window.selectPatientForVisit = function (id, name, nik, dob, phone, title) {
    selectedPatientForVisit = { id, name, nik, dob, phone, title };
    document.getElementById("selected-patient-info").innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <p class="font-bold">${title ? title + " " : ""}${name}</p>
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

  function setupPatientSearch() {
    const input = document.getElementById("search-patient-input");
    const resultsDiv = document.getElementById("search-results");
    if (!input || !resultsDiv) return;

    // PERBAIKAN: Gunakan Event Delegation untuk klik hasil pencarian.
    // Ini mencegah bug jika nama pasien mengandung tanda kutip (') atau (")
    resultsDiv.addEventListener("click", (e) => {
      const card = e.target.closest(".patient-card");
      if (card) {
        window.selectPatientForVisit(
          card.dataset.id,
          card.dataset.name,
          card.dataset.nik,
          card.dataset.dob,
          card.dataset.phone,
          card.dataset.title,
        );
      }
    });

    let searchTimer;
    input.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      const query = e.target.value.trim();

      if (query.length < 2) {
        resultsDiv.innerHTML = `
          <div class="text-center py-8 text-gray-500">
            <p class="text-sm">Ketik minimal 2 karakter untuk mencari</p>
          </div>
        `;
        return;
      }

      searchTimer = setTimeout(async () => {
        resultsDiv.innerHTML = '<div class="text-center py-4">Mencari...</div>';

        try {
          const { data: profileData, error: pErr } = await supabaseClient
            .from("profiles")
            .select("clinic_id")
            .eq("id", currentUser.id)
            .single();

          if (pErr || !profileData) throw new Error("Profil tidak ditemukan");

          // PERBAIKAN: Hapus backslash ganda pada regex (\d bukan \\d)
          const isNik = /^\d{5,}$/.test(query);
          let queryBuilder = supabaseClient
            .from("patients")
            .select(
              "id, full_name, nik, date_of_birth, gender, phone, address, title",
            )
            .eq("clinic_id", profileData.clinic_id)
            .limit(10);

          // PERBAIKAN: Hapus backslash pada template literal (`%${query}%` bukan \`%\${query}%\`)
          if (isNik) {
            queryBuilder = queryBuilder.ilike("nik", `%${query}%`);
          } else {
            queryBuilder = queryBuilder.ilike("full_name", `%${query}%`);
          }

          const { data: patients, error } = await queryBuilder;
          if (error) throw error;

          if (!patients || patients.length === 0) {
            resultsDiv.innerHTML = `<div class="text-center py-8 text-gray-500">Tidak ada pasien ditemukan</div>`;
            return;
          }

          // PERBAIKAN: Gunakan data-* attributes agar aman dari injeksi karakter kutip
          resultsDiv.innerHTML = patients
            .map(
              (p) => `
  <div class="patient-card p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary cursor-pointer transition flex justify-between items-start" 
       data-id="${p.id}" 
       data-name="${(p.full_name || "").replace(/"/g, "&quot;")}" 
       data-nik="${(p.nik || "").replace(/"/g, "&quot;")}" 
       data-dob="${p.date_of_birth || ""}" 
       data-phone="${(p.phone || "").replace(/"/g, "&quot;")}"
       data-title="${(p.title || "").replace(/"/g, "&quot;")}">
    <div class="flex-1">
      <h4 class="font-bold text-gray-900 dark:text-gray-100">${p.title ? p.title + " " : ""}${p.full_name}</h4>
      <p class="text-xs text-gray-500">NIK: ${p.nik || "-"}</p>
      <span class="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">${p.gender === "L" ? "♂ Laki-laki" : p.gender === "P" ? "♀ Perempuan" : "-"}</span>
    </div>
    <button onclick="event.stopPropagation(); window.editPatient('${p.id}')" class="ml-3 text-xs text-blue-600 hover:underline whitespace-nowrap">✏️ Edit</button>
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

  function attachVisitFormListeners() {
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
        const { data: profileData, error: pErr } = await supabaseClient
          .from("profiles")
          .select("clinic_id")
          .eq("id", currentUser.id)
          .single();
        if (pErr || !profileData)
          throw new Error("Data profil tidak ditemukan");

        const queueNumber = await generateQueueNumber(poly, currentUser);

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
              queue_number: queueNumber,
            },
          ]);

        if (rErr) throw rErr;

        // ✅ Deklarasi patientName
        const patientName = selectedPatientForVisit?.name || "Pasien";

        // ✅ Tampilkan popup
        window.showNotif(
          "✅ Pendaftaran Berhasil",
          `<strong>${patientName}</strong> berhasil didaftarkan!<br><br>
           📋 Nomor Antrean: <strong>${queueNumber}</strong><br>
           🏥 Poli: ${poly}`,
        );

        // SATUSEHAT
        try {
          const { data: patientData } = await supabaseClient
            .from("patients")
            .select("satusehat_ihs")
            .eq("id", selectedPatientForVisit.id)
            .single();
          if (patientData?.satusehat_ihs) {
            await satusehatBridge.sendEncounter(
              patientData.satusehat_ihs,
              selectedPatientForVisit.name,
              poly,
              complaint,
            );
          }
        } catch (encounterError) {
          console.error("❌ Error SATUSEHAT:", encounterError.message);
        }

        // ✅ Clear form (HANYA 1 KALI!)
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
    const plan =
      clinicSettings?.plan || localStorage.getItem("clinic_plan") || "free";
    const form = document.getElementById("new-patient-form");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = document.getElementById("btn-submit-new");
      const msg = document.getElementById("new-message");

      btn.disabled = true;
      btn.textContent = "Menyimpan...";

      try {
        const { data: profileData, error: pErr } = await supabaseClient
          .from("profiles")
          .select("clinic_id")
          .eq("id", currentUser.id)
          .single();

        if (pErr || !profileData)
          throw new Error("Data profil tidak ditemukan");

        const poly = document.getElementById("new-poly").value;
        const queueNumber = await generateQueueNumber(poly, currentUser);

        const { data: newPatient, error: pInsertErr } = await supabaseClient
          .from("patients")
          .insert([
            {
              clinic_id: profileData.clinic_id,
              title: document.getElementById("new-title").value || null,
              full_name: document.getElementById("new-name").value.trim(),
              nik: document.getElementById("new-nik").value.trim() || null,
              date_of_birth: document.getElementById("new-dob").value || null,
              gender: document.getElementById("new-gender").value,
              phone: document.getElementById("new-phone").value.trim() || null,
              address:
                document.getElementById("new-address").value.trim() || null,

              // 🛠️ TAMBAHAN FASE 1: Simpan Kategori Corporate ke Database
              category: document.getElementById("reg-category").value,

              // Ambil nilai dari input teks jika paket FREE, jika tidak dari dropdown
              company_name:
                plan === "free"
                  ? document.getElementById("reg-company-free").value.trim()
                  : document.getElementById("reg-company").value.trim(),
              department:
                plan === "free"
                  ? document.getElementById("reg-department-free").value.trim()
                  : document.getElementById("reg-department").value.trim(),
            },
          ])
          .select()
          .single();

        if (pInsertErr) throw pInsertErr;

        // ============================================
        // 🚀 KIRIM KE SATUSEHAT
        // ============================================
        try {
          console.log("🚀 Mengirim data ke SATUSEHAT...");

          const isConnected = await satusehatBridge.testConnection();

          if (isConnected.connected) {
            const satusehatResult = await satusehatBridge.registerPatient({
              full_name: newPatient.full_name,
              nik: newPatient.nik,
              gender: newPatient.gender,
              birth_date: newPatient.date_of_birth,
              phone: newPatient.phone,
              email: newPatient.email || null,
              address: newPatient.address,
              city: null,
            });

            if (satusehatResult.success) {
              await supabaseClient
                .from("patients")
                .update({
                  satusehat_ihs: satusehatResult.ihsNumber,
                  satusehat_sync_at: new Date().toISOString(),
                })
                .eq("id", newPatient.id);

              console.log("✅ IHS tersimpan:", satusehatResult.ihsNumber);
            } else {
              console.warn("⚠️ Gagal SATUSEHAT:", satusehatResult.error);
            }
          } else {
            console.log("ℹ️ SATUSEHAT offline, simpan lokal saja");
          }
        } catch (e) {
          console.error("❌ Error SATUSEHAT:", e.message);
        }
        // ============================================

        const { error: rErr } = await supabaseClient
          .from("registrations")
          .insert([
            {
              clinic_id: profileData.clinic_id,
              patient_id: newPatient.id,
              registered_by: currentUser.id,
              status: clinicSettings.use_nurse_triage
                ? "waiting_triage"
                : "waiting_doctor",
              complaint: document.getElementById("new-complaint").value,
              target_poly: poly,
              queue_number: queueNumber,
            },
          ]);

        if (rErr) throw rErr;

        // Tampilkan popup
        window.showNotif(
          "✅ Pasien Baru Terdaftar",
          `<strong>${newPatient.full_name}</strong> berhasil didaftarkan!<br><br>
   📋 Nomor Antrean: <strong>${queueNumber}</strong><br>
   🏥 Poli: ${poly}`,
        );

        form.reset();

        // ============================================
        // 🚀 KIRIM KUNJUNGAN KE SATUSEHAT
        // ============================================
        try {
          const { data: patientData } = await supabaseClient
            .from("patients")
            .select("satusehat_ihs")
            .eq("id", newPatient.id) // ✅ UBAH KE newPatient
            .single();

          if (patientData?.satusehat_ihs) {
            console.log("🏥 Mengirim kunjungan ke SATUSEHAT...");

            const encounterResult = await satusehatBridge.sendEncounter(
              patientData.satusehat_ihs,
              newPatient.full_name, // ✅ UBAH KE newPatient
              poly,
              document.getElementById("new-complaint").value,
            );

            if (encounterResult.success) {
              console.log(
                "✅ Encounter terkirim:",
                encounterResult.encounterIHS,
              );
            } else {
              console.warn("⚠️ Gagal kirim encounter:", encounterResult.error);
            }
          } else {
            console.warn("⚠️ Pasien belum punya IHS, encounter tidak dikirim");
          }
        } catch (encounterError) {
          console.error("❌ Error kirim encounter:", encounterError.message);
        }
        // ============================================

        msg.innerHTML = `✅ <strong>${newPatient.full_name}</strong> berhasil didaftarkan!<br>📋 Nomor Antrean: <strong>${queueNumber}</strong> | 🏥 ${poly}`;
        msg.className =
          "text-sm text-green-600 mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800";
        msg.classList.remove("hidden");
        form.reset();

        // Notifikasi hilang setelah 3 detik
        setTimeout(() => {
          msg.classList.add("hidden");
        }, 3000);
      } catch (err) {
        msg.textContent = "❌ Gagal: " + err.message;
        msg.className = "text-sm text-red-600 mt-2";
        msg.classList.remove("hidden");
      } finally {
        btn.disabled = false;
        btn.textContent = "Simpan Pasien & Daftarkan Kunjungan";
      }
    }); // ← TUTUP form.addEventListener
  } // ← TUTUP fungsi attachNewPatientFormListeners

  // Buka modal edit
  window.editPatient = async function (patientId) {
    try {
      const { data: patient, error } = await supabaseClient
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();
      if (error) throw error;

      // Isi form
      document.getElementById("edit-patient-id").value = patient.id;
      document.getElementById("edit-title").value = patient.title || "";
      document.getElementById("edit-name").value = patient.full_name || "";
      document.getElementById("edit-nik").value = patient.nik || "";
      document.getElementById("edit-dob").value = patient.date_of_birth || "";
      document.getElementById("edit-gender").value = patient.gender || "";
      document.getElementById("edit-phone").value = patient.phone || "";
      document.getElementById("edit-address").value = patient.address || "";
      document.getElementById("edit-category").value =
        patient.category || "Umum";
      document.getElementById("edit-company").value =
        patient.company_name || "";
      document.getElementById("edit-department").value =
        patient.department || "";

      document.getElementById("edit-patient-modal").classList.remove("hidden");
    } catch (err) {
      window.showError("Gagal memuat data pasien: " + err.message);
    }
  };

  // Tutup modal
  window.closeEditPatientModal = function () {
    document.getElementById("edit-patient-modal").classList.add("hidden");
  };

  // Simpan edit
  document
    .getElementById("edit-patient-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("edit-patient-id").value;
      const data = {
        title: document.getElementById("edit-title").value,
        full_name: document.getElementById("edit-name").value.trim(),
        nik: document.getElementById("edit-nik").value.trim() || null,
        date_of_birth: document.getElementById("edit-dob").value || null,
        gender: document.getElementById("edit-gender").value,
        phone: document.getElementById("edit-phone").value.trim() || null,
        address: document.getElementById("edit-address").value.trim() || null,
        category: document.getElementById("edit-category").value,
        company_name:
          document.getElementById("edit-company").value.trim() || null,
        department:
          document.getElementById("edit-department").value.trim() || null,
      };

      try {
        const { error } = await supabaseClient
          .from("patients")
          .update(data)
          .eq("id", id);
        if (error) throw error;

        window.showSuccess("Data pasien berhasil diperbarui!");
        window.closeEditPatientModal();

        // Refresh hasil pencarian jika ada
        const input = document.getElementById("search-patient-input");
        if (input.value.trim().length >= 2) {
          input.dispatchEvent(new Event("input"));
        }
      } catch (err) {
        window.showError("Gagal memperbarui: " + err.message);
      }
    });
  // ============================================
  // INI HARUS DI LUAR! (Di dalam initRegistration)
  // ============================================
  setupPatientSearch();
  attachVisitFormListeners();
  attachNewPatientFormListeners();
}

// ============================================
// FUNGSI toggleCorporateFields (DI LUAR)
// ============================================
window.toggleCorporateFields = function () {
  const cat = document.getElementById("reg-category").value;
  const divCompany = document.getElementById("div-company");
  const divDept = document.getElementById("div-department");
  const compSelect = document.getElementById("reg-company");

  // 🛠️ FILTER DATA PT SECARA DINAMIS
  if (compSelect) {
    compSelect.innerHTML = '<option value="">-- Pilih Perusahaan --</option>';
    if (window.allMasterCompanies) {
      // Hanya munculkan PT yang tipenya cocok (Karyawan / Vendor)
      const filteredCompanies = window.allMasterCompanies.filter(
        (c) => c.type === cat,
      );
      filteredCompanies.forEach((c) => {
        compSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
      });
    }
  }

  if (cat === "Karyawan") {
    divCompany.classList.remove("hidden");
    divDept.classList.remove("hidden");
  } else if (cat === "Vendor") {
    divCompany.classList.remove("hidden");
    divDept.classList.add("hidden");
    document.getElementById("reg-department").value = ""; // Kosongkan jika vendor
  } else {
    // Mode Umum
    divCompany.classList.add("hidden");
    divDept.classList.add("hidden");
    if (compSelect) compSelect.value = "";
    document.getElementById("reg-department").value = "";
  }
};
