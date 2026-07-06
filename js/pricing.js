// js/pricing.js

export function renderPricingPage() {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML = `
    <div class="max-w-5xl mx-auto fade-in">
      <div class="text-center mb-10">
        <h2 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Pilih Paket yang Tepat</h2>
        <p class="text-gray-500 dark:text-gray-400 mt-2">Tingkatkan efisiensi klinik Anda dengan fitur lengkap KlinikHub</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <!-- FREE CARD -->
        <div class="bg-white dark:bg-darkCard rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
          <h3 class="text-2xl font-bold mb-2">🆓 FREE</h3>
          <p class="text-gray-500 mb-6">Untuk praktek mandiri yang baru memulai</p>
          <div class="text-4xl font-bold mb-6">Rp 0 <span class="text-lg font-normal text-gray-400">/bulan</span></div>
          <ul class="space-y-3 mb-8 text-sm">
            <li class="flex items-center gap-2">✅ Pendaftaran pasien</li>
            <li class="flex items-center gap-2">✅ TTV & SOAP</li>
            <li class="flex items-center gap-2">✅ Resep manual</li>
            <li class="flex items-center gap-2">✅ Cetak surat</li>
            <li class="flex items-center gap-2">❌ Farmasi & stok obat</li>
            <li class="flex items-center gap-2">❌ Multi‑user</li>
            <li class="flex items-center gap-2">❌ SATUSEHAT & BPJS</li>
            <li class="flex items-center gap-2">❌ Dashboard statistik</li>
          </ul>
          <button disabled class="w-full py-3 rounded-lg bg-gray-200 text-gray-500 font-semibold cursor-not-allowed">Paket Anda Saat Ini</button>
        </div>

        <!-- PRO CARD -->
        <div class="bg-gradient-to-br from-primary/10 to-orange-100 dark:from-primary/20 dark:to-orange-900/20 rounded-2xl border-2 border-primary p-8 shadow-lg relative">
          <span class="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">PALING POPULER</span>
          <h3 class="text-2xl font-bold mb-2">🚀 PRO</h3>
          <p class="text-gray-500 mb-6">Untuk klinik profesional yang ingin berkembang</p>
          <div class="text-4xl font-bold mb-6">Rp 199k <span class="text-lg font-normal text-gray-400">/bulan</span></div>
          <ul class="space-y-3 mb-8 text-sm">
            <li class="flex items-center gap-2">✅ Semua fitur FREE</li>
            <li class="flex items-center gap-2">✅ Farmasi & manajemen obat</li>
            <li class="flex items-center gap-2">✅ Multi‑user (dokter, perawat, apoteker)</li>
            <li class="flex items-center gap-2">✅ SATUSEHAT & BPJS</li>
            <li class="flex items-center gap-2">✅ Dashboard & laporan</li>
            <li class="flex items-center gap-2">✅ Master Corporate</li>
            <li class="flex items-center gap-2">✅ Support prioritas</li>
          </ul>
          <button onclick="window.openUpgradeLink()" class="w-full py-3 rounded-lg bg-primary hover:bg-primaryHover text-white font-semibold transition shadow-lg">🎯 Upgrade Sekarang</button>
          <p class="text-xs text-gray-400 text-center mt-2">Hubungi kami untuk penawaran khusus</p>
        </div>
      </div>
    </div>
  `;
}

window.openUpgradeLink = function () {
  // Ganti dengan nomor WhatsApp Anda
  const phone = "6281234567890"; // contoh
  const message = encodeURIComponent(
    "Halo, saya tertarik upgrade ke paket PRO KlinikHub.",
  );
  window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
};
