// js/statistik.js
import { supabaseClient } from "./config.js";

export async function loadStatisticsDashboard(currentUser) {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10 flex flex-col items-center"><div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-3"></div><p class="text-gray-500">Menganalisis data klinik...</p></div>';

  try {
    // 1. Ambil ID Klinik
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();

    const clinicId = profile.clinic_id;
    window.currentClinicId = clinicId; // Simpan untuk fungsi export

    // 2. Ambil tanggal hari ini (YYYY-MM-DD)
    const today = new Date().toISOString().split("T")[0];

    // 3. Hitung Pasien Hari Ini
    const { count: countToday, error: err1 } = await supabaseClient
      .from("registrations")
      .select("id", { count: "exact" })
      .eq("clinic_id", clinicId)
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    // 4. Hitung Pendapatan Hari Ini
    const { data: invoicesToday, error: err2 } = await supabaseClient
      .from("invoices")
      .select("total_amount")
      .eq("clinic_id", clinicId)
      .eq("status", "paid")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`);

    const revenueToday = invoicesToday
      ? invoicesToday.reduce((sum, inv) => sum + inv.total_amount, 0)
      : 0;

    // 5. Render Tampilan Dashboard
    mainContent.innerHTML = `
      <div class="fade-in max-w-6xl mx-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard Statistik & Laporan</h2>
          <button onclick="window.exportToCSV()" class="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Export Laporan (CSV)
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
            <div class="absolute right-0 top-0 opacity-10 text-primary p-4"><svg class="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"></path></svg></div>
            <p class="text-sm font-semibold text-gray-500 mb-1">Total Kunjungan Hari Ini</p>
            <h3 class="text-4xl font-bold text-primary">${countToday || 0} <span class="text-base font-normal text-gray-400">Pasien</span></h3>
          </div>
          
          <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
             <div class="absolute right-0 top-0 opacity-10 text-green-600 p-4"><svg class="w-16 h-16" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"></path></svg></div>
            <p class="text-sm font-semibold text-gray-500 mb-1">Pendapatan Hari Ini</p>
            <h3 class="text-3xl font-bold text-green-600">Rp ${revenueToday.toLocaleString("id-ID")}</h3>
          </div>
          
          <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
            <p class="text-sm font-semibold text-gray-500 mb-1">Status Sistem</p>
            <div class="flex items-center gap-2 mt-2">
              <span class="flex w-3 h-3 bg-green-500 rounded-full"></span>
              <h3 class="text-lg font-bold text-gray-700 dark:text-gray-300">Semua Modul Aktif</h3>
            </div>
            <p class="text-xs text-gray-400 mt-2">Database terhubung dengan baik.</p>
          </div>
        </div>

        <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <h4 class="font-bold text-lg mb-4 border-b dark:border-gray-700 pb-3">Ringkasan Aktivitas</h4>
          <div class="h-48 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-gray-500">
            <svg class="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            <p class="text-sm">Siap disambungkan dengan library Chart.js (Grafik Kunjungan)</p>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 p-4 font-bold bg-red-50 rounded-lg border border-red-200">❌ Error: ${err.message}</div>`;
  }
}

// --- FUNGSI EXPORT KE EXCEL/CSV ---
window.exportToCSV = async () => {
  try {
    // Ambil semua data invoice yang sudah lunas
    const { data: invoices, error } = await supabaseClient
      .from("invoices")
      .select("created_at, total_amount, registrations(patients(full_name))")
      .eq("clinic_id", window.currentClinicId)
      .eq("status", "paid")
      .order("created_at", { ascending: false });

    if (error || !invoices || invoices.length === 0) {
      alert("⚠️ Belum ada data transaksi untuk diekspor.");
      return;
    }

    // Buat Header CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tanggal,Waktu,Nama Pasien,Total Tagihan (Rp)\n";

    // Isi Baris CSV
    invoices.forEach((row) => {
      const date = new Date(row.created_at);
      const tgl = date.toLocaleDateString("id-ID");
      const wkt = date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Mencegah error jika data pasien terhapus
      let nama = "Tidak diketahui";
      if (row.registrations && row.registrations.patients) {
        nama = row.registrations.patients.full_name;
      }

      const total = row.total_amount;
      csvContent += `"${tgl}","${wkt}","${nama}",${total}\n`;
    });

    // Proses Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Laporan_Keuangan_Klinik_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    alert("❌ Gagal mengekspor data: " + err.message);
  }
};

window.loadStatisticsDashboard = loadStatisticsDashboard;
