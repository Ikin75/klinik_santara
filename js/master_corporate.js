// js/master_corporate.js
import { supabaseClient } from "./config.js";

// --- 1. LOAD TAMPILAN MASTER DATA ---
export async function loadMasterCorporate(currentUser) {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10">Memuat Data Master Corporate...</div>';

  try {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();

    const clinicId = profile.clinic_id;
    window.currentClinicId = clinicId; // Simpan untuk fungsi tambah data

    // Tarik data Perusahaan & Departemen sekaligus
    const [compRes, deptRes] = await Promise.all([
      supabaseClient
        .from("companies")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("name"),
      supabaseClient
        .from("departments")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("name"),
    ]);

    if (compRes.error) throw compRes.error;
    if (deptRes.error) throw deptRes.error;

    const companies = compRes.data || [];
    const departments = deptRes.data || [];

    // Render Baris Tabel Perusahaan
    const compRows = companies
      .map(
        (c, idx) => `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
        <td class="p-2">${idx + 1}</td>
        <td class="p-2 font-semibold">${c.name}</td>
        <td class="p-2"><span class="px-2 py-1 rounded text-xs ${c.type === "Karyawan" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}">${c.type}</span></td>
        <td class="p-2 text-right"><button onclick="window.deleteMaster('companies', '${c.id}')" class="text-red-500 hover:text-red-700 text-xs">Hapus</button></td>
      </tr>
    `,
      )
      .join("");

    // Render Baris Tabel Departemen
    const deptRows = departments
      .map(
        (d, idx) => `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm">
        <td class="p-2">${idx + 1}</td>
        <td class="p-2 font-semibold">${d.name}</td>
        <td class="p-2 text-right"><button onclick="window.deleteMaster('departments', '${d.id}')" class="text-red-500 hover:text-red-700 text-xs">Hapus</button></td>
      </tr>
    `,
      )
      .join("");

    // Render Tampilan Utama
    mainContent.innerHTML = `
      <div class="fade-in max-w-6xl mx-auto">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">Master Data Corporate</h2>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
              Daftar PT / Vendor
            </h3>
            
            <div class="flex gap-2 mb-4">
              <input type="text" id="new-comp-name" placeholder="Nama PT / Rekanan" class="flex-grow p-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-900 outline-none">
              <select id="new-comp-type" class="p-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-900 outline-none">
                <option value="Karyawan">PT (Karyawan)</option>
                <option value="Vendor">Vendor</option>
              </select>
              <button onclick="window.addCompany()" class="bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-lg text-sm font-semibold transition">Tambah</button>
            </div>

            <div class="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table class="w-full text-left">
                <thead class="bg-gray-100 dark:bg-gray-900 sticky top-0">
                  <tr><th class="p-2">No</th><th class="p-2">Nama Perusahaan</th><th class="p-2">Tipe</th><th class="p-2 text-right">Aksi</th></tr>
                </thead>
                <tbody>${compRows || '<tr><td colspan="4" class="p-4 text-center text-gray-500">Belum ada data perusahaan</td></tr>'}</tbody>
              </table>
            </div>
          </div>

          <div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <h3 class="font-bold text-lg mb-4 flex justify-between items-center">
              Daftar Departemen
            </h3>
            
            <div class="flex gap-2 mb-4">
              <input type="text" id="new-dept-name" placeholder="Contoh: Produksi, HRD, dll" class="flex-grow p-2 text-sm border border-gray-300 rounded-lg dark:bg-gray-900 outline-none">
              <button onclick="window.addDepartment()" class="bg-primary hover:bg-primaryHover text-white px-4 py-2 rounded-lg text-sm font-semibold transition">Tambah</button>
            </div>

            <div class="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table class="w-full text-left">
                <thead class="bg-gray-100 dark:bg-gray-900 sticky top-0">
                  <tr><th class="p-2">No</th><th class="p-2">Nama Departemen</th><th class="p-2 text-right">Aksi</th></tr>
                </thead>
                <tbody>${deptRows || '<tr><td colspan="3" class="p-4 text-center text-gray-500">Belum ada data departemen</td></tr>'}</tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    `;
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 p-4">❌ Error: ${err.message}</div>`;
  }
}

// --- 2. FUNGSI TAMBAH & HAPUS DATA ---
window.addCompany = async () => {
  const name = document.getElementById("new-comp-name").value.trim();
  const type = document.getElementById("new-comp-type").value;
  if (!name) return alert("Nama PT tidak boleh kosong!");

  try {
    await supabaseClient
      .from("companies")
      .insert([{ clinic_id: window.currentClinicId, name, type }]);
    loadMasterCorporate(window.currentUser); // Reload tampilan
  } catch (err) {
    alert("Gagal menambah: " + err.message);
  }
};

window.addDepartment = async () => {
  const name = document.getElementById("new-dept-name").value.trim();
  if (!name) return alert("Nama Departemen tidak boleh kosong!");

  try {
    await supabaseClient
      .from("departments")
      .insert([{ clinic_id: window.currentClinicId, name }]);
    loadMasterCorporate(window.currentUser); // Reload tampilan
  } catch (err) {
    alert("Gagal menambah: " + err.message);
  }
};

window.deleteMaster = async (table, id) => {
  if (!confirm("Yakin ingin menghapus data ini?")) return;
  try {
    await supabaseClient.from(table).delete().eq("id", id);
    loadMasterCorporate(window.currentUser);
  } catch (err) {
    alert("Gagal menghapus: " + err.message);
  }
};

// Daftarkan ke window
window.loadMasterCorporate = loadMasterCorporate;
