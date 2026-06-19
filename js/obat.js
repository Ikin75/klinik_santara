// js/obat.js
import { supabaseClient } from "./config.js";

// --- 1. LOAD DATA OBAT ---
export async function loadMedicationManagement(currentUser) {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10">Memuat data obat...</div>';

  try {
    // Ambil ID Klinik dari user yang login
    const { data: profile, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();

    if (profileErr)
      throw new Error("Gagal memuat profil: " + profileErr.message);

    // Ambil data obat
    const { data: meds, error: medsErr } = await supabaseClient
      .from("medications")
      .select("*")
      .eq("clinic_id", profile.clinic_id)
      .order("name", { ascending: true });

    if (medsErr) throw new Error("Gagal memuat data obat: " + medsErr.message);

    // Render baris tabel
    let tableRows = meds
      .map((m, idx) => {
        // Cek apakah obat sudah kedaluwarsa atau stok menipis
        const isExpiring =
          m.expired_date && new Date(m.expired_date) < new Date();
        const isLowStock = m.stock <= (m.min_stock || 10);

        let statusBadge = `<span class="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">Aman</span>`;
        if (isExpiring)
          statusBadge = `<span class="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700">Kedaluwarsa</span>`;
        else if (isLowStock)
          statusBadge = `<span class="px-2 py-1 rounded text-xs font-bold bg-orange-100 text-orange-700">Stok Menipis</span>`;

        return `
      <tr class="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm">
        <td class="p-3">${idx + 1}</td>
        <td class="p-3 font-semibold">${m.name} <br><span class="text-xs text-gray-500">${m.strength || ""}</span></td>
        <td class="p-3">${m.category || "-"}</td>
        <td class="p-3 text-right">Rp ${m.price_sell ? m.price_sell.toLocaleString("id-ID") : 0}</td>
        <td class="p-3 text-center"><span class="font-bold">${m.stock}</span> <span class="text-xs text-gray-500">${m.unit || ""}</span></td>
        <td class="p-3 text-center">${statusBadge}</td>
        <td class="p-3 text-right">
          <button onclick='window.editMedication(${JSON.stringify(m).replace(/'/g, "&#39;")})' class="text-blue-500 hover:text-blue-700 font-semibold">Edit</button>
        </td>
      </tr>
    `;
      })
      .join("");

    mainContent.innerHTML = `
      <div class="fade-in max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Manajemen Gudang Obat</h2>
          <button onclick="window.showMedicationForm()" class="bg-primary text-white px-4 py-2 rounded-lg font-semibold hover:bg-primaryHover transition flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Tambah Obat
          </button>
        </div>
        
        <div id="med-form-container" class="hidden bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-6 shadow-sm">
          <h3 id="med-form-title" class="font-bold text-lg mb-4 text-primary border-b pb-2">Tambah Obat Baru</h3>
          <input type="hidden" id="med-id">
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="md:col-span-2">
              <label class="block text-sm font-medium mb-1">Nama Obat (Merek/Dagang) *</label>
              <input type="text" id="med-name" placeholder="Contoh: Panadol" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Nama Generik</label>
              <input type="text" id="med-generic" placeholder="Contoh: Paracetamol" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-1">Kategori</label>
              <input type="text" id="med-category" placeholder="Analgesik / Antibiotik" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Dosis / Kekuatan</label>
              <input type="text" id="med-strength" placeholder="Contoh: 500mg" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Satuan</label>
              <select id="med-unit" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
                <option value="tablet">Tablet</option>
                <option value="kapsul">Kapsul</option>
                <option value="botol">Botol</option>
                <option value="strip">Strip</option>
                <option value="pcs">Pcs</option>
                <option value="salep">Salep</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Harga Beli (Rp)</label>
              <input type="number" id="med-price-buy" placeholder="0" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Harga Jual (Rp) *</label>
              <input type="number" id="med-price-sell" placeholder="0" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Tgl Kedaluwarsa (Expired)</label>
              <input type="date" id="med-expired" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
            
            <div>
              <label class="block text-sm font-medium mb-1">Stok Saat Ini *</label>
              <input type="number" id="med-stock" value="0" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Batas Stok Minimal</label>
              <input type="number" id="med-min-stock" value="10" class="w-full p-2.5 border rounded-lg dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
            </div>
          </div>
          
          <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
            <button onclick="window.saveMedication()" class="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg font-semibold transition">💾 Simpan Data Obat</button>
            <button onclick="window.hideMedicationForm()" class="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition">Batal</button>
          </div>
        </div>

        <div class="bg-white dark:bg-darkCard rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto shadow-sm">
          <table class="w-full text-left">
            <thead class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300">
              <tr>
                <th class="p-4 font-semibold">No</th>
                <th class="p-4 font-semibold">Nama Obat</th>
                <th class="p-4 font-semibold">Kategori</th>
                <th class="p-4 font-semibold text-right">Harga Jual</th>
                <th class="p-4 font-semibold text-center">Stok</th>
                <th class="p-4 font-semibold text-center">Status</th>
                <th class="p-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>${tableRows || '<tr><td colspan="7" class="p-8 text-center text-gray-500">Belum ada data obat di gudang.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 p-4 font-bold bg-red-50 rounded-lg border border-red-200">❌ Error: ${err.message}</div>`;
  }
}

// --- 2. FUNGSI FORM ---
window.showMedicationForm = () => {
  document.getElementById("med-form-container").classList.remove("hidden");
  document.getElementById("med-form-title").textContent = "Tambah Obat Baru";

  // Kosongkan form
  document.getElementById("med-id").value = "";
  document.getElementById("med-name").value = "";
  document.getElementById("med-generic").value = "";
  document.getElementById("med-category").value = "";
  document.getElementById("med-strength").value = "";
  document.getElementById("med-unit").value = "tablet";
  document.getElementById("med-price-buy").value = "";
  document.getElementById("med-price-sell").value = "";
  document.getElementById("med-stock").value = "0";
  document.getElementById("med-min-stock").value = "10";
  document.getElementById("med-expired").value = "";

  // Scroll ke form
  document
    .getElementById("med-form-container")
    .scrollIntoView({ behavior: "smooth" });
};

window.hideMedicationForm = () => {
  document.getElementById("med-form-container").classList.add("hidden");
};

window.editMedication = (m) => {
  document.getElementById("med-form-container").classList.remove("hidden");
  document.getElementById("med-form-title").textContent = "✏️ Edit Data Obat";

  // Isi form dengan data yang ada
  document.getElementById("med-id").value = m.id;
  document.getElementById("med-name").value = m.name || "";
  document.getElementById("med-generic").value = m.generic_name || "";
  document.getElementById("med-category").value = m.category || "";
  document.getElementById("med-strength").value = m.strength || "";
  document.getElementById("med-unit").value = m.unit || "tablet";
  document.getElementById("med-price-buy").value = m.price_buy || 0;
  document.getElementById("med-price-sell").value = m.price_sell || 0;
  document.getElementById("med-stock").value = m.stock || 0;
  document.getElementById("med-min-stock").value = m.min_stock || 10;
  document.getElementById("med-expired").value = m.expired_date || "";

  document
    .getElementById("med-form-container")
    .scrollIntoView({ behavior: "smooth" });
};

window.saveMedication = async () => {
  const user = window.currentUser;
  const id = document.getElementById("med-id").value;

  // Ambil nilai dari input, konversi angka
  const data = {
    name: document.getElementById("med-name").value.trim(),
    generic_name: document.getElementById("med-generic").value.trim() || null,
    category: document.getElementById("med-category").value.trim() || null,
    strength: document.getElementById("med-strength").value.trim() || null,
    unit: document.getElementById("med-unit").value,
    price_buy: parseFloat(document.getElementById("med-price-buy").value) || 0,
    price_sell:
      parseFloat(document.getElementById("med-price-sell").value) || 0,
    stock: parseInt(document.getElementById("med-stock").value) || 0,
    min_stock: parseInt(document.getElementById("med-min-stock").value) || 10,
    expired_date: document.getElementById("med-expired").value || null,
    is_active: true,
  };

  if (!data.name) {
    alert("❌ Nama obat wajib diisi!");
    return;
  }
  if (data.price_sell <= 0) {
    alert("⚠️ Peringatan: Harga jual belum diatur atau Rp 0.");
  }

  try {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", user.id)
      .single();
    data.clinic_id = profile.clinic_id;

    if (id) {
      // Update data jika ID ada
      const { error } = await supabaseClient
        .from("medications")
        .update(data)
        .eq("id", id);
      if (error) throw error; // Lempar error jika gagal
    } else {
      // Insert data baru
      const { error } = await supabaseClient.from("medications").insert([data]);
      if (error) throw error; // Lempar error jika gagal
    }

    alert("✅ Data obat berhasil disimpan ke database!");
    // Muat ulang tampilan agar data baru muncul
    loadMedicationManagement(user);
  } catch (err) {
    console.error("Gagal menyimpan obat:", err);
    alert("❌ Gagal menyimpan data ke database:\n" + err.message);
  }
};

// Daftarkan fungsi ke window agar tidak error 'is not defined'
window.loadMedicationManagement = loadMedicationManagement;
