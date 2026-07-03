// js/kecelakaan-kerja.js
import { supabaseClient } from "./config.js";

export function renderKKForm(data = null) {
  const mainContent = document.getElementById("main-content");
  const isEdit = data !== null;
  const reg = data?.registration || {};
  const patient = reg?.patients || {};

  mainContent.innerHTML = `
    <div class="max-w-4xl mx-auto fade-in">
      <button onclick="window.navigateTo('${data ? "input-soap" : "registration"}')" class="mb-4 text-sm text-gray-500 hover:text-primary flex items-center gap-1">
        ← Kembali
      </button>

      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-6 shadow-sm">
        <div class="text-center mb-6 pb-4 border-b-2 border-gray-300 dark:border-gray-700">
          <h2 class="text-xl font-bold uppercase tracking-wide">FORMULIR PELAPORAN KECELAKAAN KERJA</h2>
          <p class="clinic-name text-lg font-semibold text-primary mt-1"></p>
        </div>

        <form id="kk-form" class="space-y-6">
          <!-- I. DATA UMUM -->
          <div class="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-xl border border-blue-200">
            <h3 class="font-bold text-lg text-blue-800 dark:text-blue-300 mb-4">I. DATA UMUM</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">1. Nama *</label>
                <input type="text" id="kk-nama" value="${patient.full_name || ""}" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">2. Tempat & Tanggal Lahir</label>
                <input type="text" id="kk-ttl" value="${patient.date_of_birth || ""}" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary" placeholder="Kota, dd/mm/yyyy">
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label class="block text-sm font-medium mb-1">3. Jenis Kelamin</label>
                <div class="flex gap-6 mt-2">
                  <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="kk-gender" value="Laki-laki" class="w-4 h-4 text-primary"> Laki-laki</label>
                  <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="kk-gender" value="Perempuan" class="w-4 h-4 text-primary"> Perempuan</label>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">4. Lama Kerja</label>
                <input type="text" id="kk-lama-kerja" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary" placeholder="Contoh: 2 tahun">
              </div>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">5. Unit Kerja / Bagian</label>
              <input type="text" id="kk-unit-kerja" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none focus:ring-2 focus:ring-primary" placeholder="Contoh: IGD, Poli Umum">
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-2">6. Status Korban</label>
              <div class="space-y-3">
                <div>
                  <p class="text-xs font-semibold text-gray-500 mb-1">a. Karyawan Tetap</p>
                  <select id="kk-status-tetap" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                    <option value="">-- Pilih --</option>
                    <option>Dokter</option><option>Perawat</option><option>Bidan</option>
                    <option>Analis</option><option>Sanitarian</option><option>Teknisi</option>
                    <option>Lain-lain</option>
                  </select>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 mb-1">b. Karyawan Kontrak</p>
                  <select id="kk-status-kontrak" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                    <option value="">-- Pilih --</option>
                    <option>Dokter</option><option>Perawat</option><option>Bidan</option>
                    <option>Analis</option><option>Sanitarian</option><option>Teknisi</option>
                    <option>Lain-lain</option>
                  </select>
                </div>
                <div>
                  <p class="text-xs font-semibold text-gray-500 mb-1">c. Pelajar / Lainnya</p>
                  <select id="kk-status-lain" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                    <option value="">-- Pilih --</option>
                    <option>Mahasiswa</option><option>PKL</option>
                    <option>Pasien</option><option>Pendamping Pasien</option><option>Pengunjung</option>
                    <option>Kontraktor/Rekanan</option><option>Lain-lain</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">7. Pembiayaan</label>
              <div class="flex gap-6 mt-2">
                <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="kk-biaya" value="Asuransi" class="w-4 h-4 text-primary"> Asuransi</label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="kk-biaya" value="Pribadi" class="w-4 h-4 text-primary"> Pribadi</label>
              </div>
            </div>
          </div>

          <!-- II. RINCIAN KEJADIAN -->
          <div class="bg-red-50 dark:bg-red-900/20 p-5 rounded-xl border border-red-200">
            <h3 class="font-bold text-lg text-red-800 dark:text-red-300 mb-4">II. RINCIAN KEJADIAN KECELAKAAN</h3>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">1a. Tanggal & Waktu Lapor</label>
                <div class="flex gap-2">
                  <input type="date" id="kk-tgl-lapor" class="flex-1 px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                  <input type="time" id="kk-jam-lapor" class="w-32 px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">1b. Tanggal & Waktu Kejadian</label>
                <div class="flex gap-2">
                  <input type="date" id="kk-tgl-kejadian" class="flex-1 px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                  <input type="time" id="kk-jam-kejadian" class="w-32 px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                </div>
              </div>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">2. Lokasi Kejadian</label>
              <input type="text" id="kk-lokasi" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none" placeholder="Contoh: Ruang IGD, Parkiran">
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">3. Jenis Insiden/Kecelakaan</label>
              <input type="text" id="kk-jenis-insiden" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none" placeholder="Contoh: Tertusuk jarum, Terpeleset">
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">4. Jenis Pekerjaan yang Menyebabkan</label>
              <input type="text" id="kk-jenis-pekerjaan" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none" placeholder="Contoh: Menyuntik, mengangkat pasien">
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">5. Kronologis Insiden</label>
              <textarea id="kk-kronologis" rows="4" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none" placeholder="Ceritakan kronologis kejadian..."></textarea>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">6. Orang Pertama yang Melaporkan</label>
              <select id="kk-pelapor" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                <option value="">-- Pilih --</option>
                <option>Karyawan (Dokter/Perawat/Lainnya)</option>
                <option>Pasien</option>
                <option>Keluarga/Pendamping</option>
                <option>Pengunjung</option>
                <option>Lain-lain</option>
              </select>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-2">7. Akibat Insiden</label>
              <div class="space-y-2">
                <p class="text-xs font-semibold">a. Petugas:</p>
                <select id="kk-akibat" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none">
                  <option value="">-- Pilih --</option>
                  <option>Tidak ada cedera</option><option>Cedera ringan</option>
                  <option>Cedera sedang</option><option>Cedera berat</option><option>Kematian</option>
                </select>
                <p class="text-xs font-semibold mt-2">b. Kerusakan Asset:</p>
                <input type="text" id="kk-kerusakan" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none" placeholder="Jelaskan kerusakan...">
              </div>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">8. Tindakan Setelah Insiden</label>
              <textarea id="kk-tindakan" rows="3" class="w-full px-4 py-2.5 rounded-lg border dark:bg-gray-900 outline-none" placeholder="a. Pertolongan pertama:\nb. Hasil tindakan:\nc. Dilakukan oleh:"></textarea>
            </div>

            <div class="mt-4">
              <label class="block text-sm font-medium mb-1">9. Apakah insiden sama sering terjadi?</label>
              <div class="flex gap-6 mt-2">
                <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="kk-sering" value="Ya" class="w-4 h-4 text-primary"> Ya</label>
                <label class="flex items-center gap-2 cursor-pointer"><input type="radio" name="kk-sering" value="Tidak" class="w-4 h-4 text-primary"> Tidak</label>
              </div>
            </div>
          </div>

          <!-- TANDA TANGAN -->
          <div class="grid grid-cols-2 gap-6 mt-6 pt-6 border-t border-gray-200">
            <div class="text-center">
              <p class="font-semibold mb-12">Pembuat Laporan</p>
              <p class="border-t border-gray-400 pt-2">Tanda tangan & Nama</p>
              <p class="text-sm text-gray-500 mt-1">Tanggal: <span id="kk-tgl-buat"></span></p>
            </div>
            <div class="text-center">
              <p class="font-semibold mb-12">Penerima Laporan</p>
              <p class="border-t border-gray-400 pt-2">Tanda tangan & Nama</p>
              <p class="text-sm text-gray-500 mt-1">Tanggal Terima: ____________</p>
            </div>
          </div>

          <!-- TOMBOL -->
          <div class="flex gap-3 pt-4 border-t border-gray-200">
            <button type="button" onclick="window.printKKForm()" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition">
              🖨️ Cetak
            </button>
            <button type="submit" id="btn-save-kk" class="flex-1 bg-primary hover:bg-primaryHover text-white font-semibold py-3 rounded-lg transition">
              💾 Simpan
            </button>
          </div>
          <p id="kk-msg" class="text-sm hidden mt-2"></p>
        </form>
      </div>
    </div>
  `;

  // Set tanggal sekarang
  document.getElementById("kk-tgl-buat").textContent =
    new Date().toLocaleDateString("id-ID");

  // Set nama klinik
  const clinic = JSON.parse(localStorage.getItem("clinic_settings") || "{}");
  document.querySelector(".clinic-name").textContent = clinic?.name || "";

  // Load data jika edit
  if (data?.kkData) loadKKData(data.kkData);

  // Attach listener
  document.getElementById("kk-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveKKForm(data);
  });
}

function loadKKData(kkData) {
  document.getElementById("kk-nama").value = kkData.nama || "";
  // ... isi field lainnya ...
}

async function saveKKForm(data) {
  const btn = document.getElementById("btn-save-kk");
  const msg = document.getElementById("kk-msg");
  btn.disabled = true;
  btn.textContent = "⏳ Menyimpan...";

  try {
    const formData = {
      registration_id: data?.registration?.id || null,
      nama: document.getElementById("kk-nama").value,
      ttl: document.getElementById("kk-ttl").value,
      gender:
        document.querySelector('input[name="kk-gender"]:checked')?.value || "",
      lama_kerja: document.getElementById("kk-lama-kerja").value,
      unit_kerja: document.getElementById("kk-unit-kerja").value,
      kronologis: document.getElementById("kk-kronologis").value,
      // ... semua field ...
    };

    const { error } = await supabaseClient
      .from("kk_reports")
      .insert([formData]);
    if (error) throw error;

    window.showSuccess("Laporan kecelakaan kerja berhasil disimpan!");
    setTimeout(() => window.history.back(), 1000);
  } catch (err) {
    window.showError("Gagal: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "💾 Simpan";
  }
}

window.printKKForm = function () {
  window.print();
};
