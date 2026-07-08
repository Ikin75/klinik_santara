import { supabaseClient } from "./config.js";

export async function renderReportPage(currentUser, clinicSettings) {
  const mainContent = document.getElementById("main-content");
  const plan =
    clinicSettings?.plan || localStorage.getItem("clinic_plan") || "free";

  mainContent.innerHTML = `
    <div class="max-w-6xl mx-auto fade-in">
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border mb-6">
        <h2 class="text-2xl font-bold mb-4">📊 Laporan Kunjungan Klinik</h2>
        <div class="flex flex-wrap gap-4 items-end">
          <div>
            <label class="block text-sm font-medium mb-1">Bulan</label>
            <select id="report-month" class="px-4 py-2 border rounded-lg dark:bg-gray-900">
              ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${new Date().getMonth() === i ? "selected" : ""}>${new Date(0, i).toLocaleString("id", { month: "long" })}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Tahun</label>
            <input type="number" id="report-year" value="${new Date().getFullYear()}" class="px-4 py-2 border rounded-lg dark:bg-gray-900 w-24">
          </div>
          <button id="btn-load-report" class="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primaryHover">🔍 Tampilkan</button>
        </div>
      </div>

      <div id="report-content" class="bg-white dark:bg-darkCard p-6 rounded-xl border">
        <p class="text-gray-500 text-center">Silakan pilih periode dan klik Tampilkan.</p>
      </div>
    </div>
  `;

  document.getElementById("btn-load-report").onclick = () =>
    loadReport(currentUser, plan);
}

async function loadReport(currentUser, plan) {
  const month = parseInt(document.getElementById("report-month").value);
  const year = parseInt(document.getElementById("report-year").value);
  const container = document.getElementById("report-content");
  container.innerHTML = `<div class="text-center py-6">Memuat data...</div>`;

  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("clinic_id")
    .eq("id", currentUser.id)
    .single();
  if (!profile) return;

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  // 1. Ambil semua registrasi di periode
  const { data: regs, error: regError } = await supabaseClient
    .from("registrations")
    .select(
      "id, queue_number, created_at, complaint, target_poly, patient_id, patients(full_name, company_name, department, gender)",
    )
    .eq("clinic_id", profile.clinic_id)
    .gte("created_at", startDate)
    .lte("created_at", `${endDate}T23:59:59`)
    .order("created_at", { ascending: true });

  if (regError) {
    container.innerHTML = `<p class="text-red-500">Error: ${regError.message}</p>`;
    return;
  }

  if (!regs || regs.length === 0) {
    container.innerHTML = `<p class="text-gray-500 text-center">Tidak ada kunjungan di bulan ini.</p>`;
    return;
  }

  // 2. Ambil semua medical_records untuk registrasi ini (untuk diagnosa)
  const regIds = regs.map((r) => r.id);
  const { data: records, error: medError } = await supabaseClient
    .from("medical_records")
    .select("registration_id, icd10_name, soap_assessment")
    .in("registration_id", regIds);

  if (medError) {
    container.innerHTML = `<p class="text-red-500">Error: ${medError.message}</p>`;
    return;
  }

  // 3. Hitung frekuensi diagnosa
  const diagnosisCount = {};
  records?.forEach((rec) => {
    const diag = rec.icd10_name || rec.soap_assessment || "Tidak Ada Diagnosa";
    diagnosisCount[diag] = (diagnosisCount[diag] || 0) + 1;
  });

  // Urutkan dan ambil 10 teratas
  const topDiagnoses = Object.entries(diagnosisCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 4. Hitung frekuensi perusahaan/departemen
  const companyCount = {};
  regs.forEach((r) => {
    const comp =
      r.patients.company_name || r.patients.department || "Tidak Diketahui";
    companyCount[comp] = (companyCount[comp] || 0) + 1;
  });

  const topCompanies = Object.entries(companyCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // 5. Bangun HTML ringkasan + tabel detail
  const summaryHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <!-- 10 Penyakit Terbanyak -->
      <div>
        <h3 class="font-bold text-lg mb-3">10 Penyakit Terbanyak</h3>
        <table class="w-full text-sm border" id="top-diagnosis-table">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-900">
              <th class="p-2 border">No</th>
              <th class="p-2 border">Diagnosa</th>
              <th class="p-2 border">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${
              topDiagnoses.length === 0
                ? '<tr><td colspan="3" class="p-2 text-center">Belum ada data diagnosa</td></tr>'
                : topDiagnoses
                    .map(
                      ([name, count], i) => `
                <tr>
                  <td class="p-2 border">${i + 1}</td>
                  <td class="p-2 border">${name}</td>
                  <td class="p-2 border text-center">${count}</td>
                </tr>
              `,
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>

      <!-- Departemen Terbanyak -->
      <div>
        <h3 class="font-bold text-lg mb-3">Departemen/Perusahaan Terbanyak</h3>
        <table class="w-full text-sm border" id="top-company-table">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-900">
              <th class="p-2 border">No</th>
              <th class="p-2 border">Perusahaan/Departemen</th>
              <th class="p-2 border">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${
              topCompanies.length === 0
                ? '<tr><td colspan="3" class="p-2 text-center">Tidak ada data</td></tr>'
                : topCompanies
                    .map(
                      ([name, count], i) => `
                <tr>
                  <td class="p-2 border">${i + 1}</td>
                  <td class="p-2 border">${name}</td>
                  <td class="p-2 border text-center">${count}</td>
                </tr>
              `,
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Tabel detail kunjungan
  const detailHTML = `
    <h3 class="font-bold text-lg mb-3">Detail Kunjungan</h3>
    <div class="overflow-x-auto">
      <table class="w-full text-sm" id="report-table">
        <thead>
          <tr class="bg-gray-50 dark:bg-gray-900">
            <th class="p-2 border">No</th>
            <th class="p-2 border">Tgl</th>
            <th class="p-2 border">No Antrean</th>
            <th class="p-2 border">Nama</th>
            <th class="p-2 border">JK</th>
            <th class="p-2 border">Perusahaan</th>
            <th class="p-2 border">Poli</th>
            <th class="p-2 border">Keluhan</th>
          </tr>
        </thead>
        <tbody>
          ${regs
            .map(
              (r, i) => `
            <tr>
              <td class="p-2 border">${i + 1}</td>
              <td class="p-2 border">${new Date(r.created_at).toLocaleDateString("id-ID")}</td>
              <td class="p-2 border">${r.queue_number}</td>
              <td class="p-2 border">${r.patients.full_name}</td>
              <td class="p-2 border">${r.patients.gender === "L" ? "L" : "P"}</td>
              <td class="p-2 border">${r.patients.company_name || "-"}</td>
              <td class="p-2 border">${r.target_poly}</td>
              <td class="p-2 border">${r.complaint || "-"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML =
    summaryHTML +
    detailHTML +
    `
    <div class="flex gap-3 mt-6">
      <button onclick="window.exportExcel()" class="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold">📥 Export Excel</button>
      <button onclick="window.exportWord()" class="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold ${plan === "free" ? "opacity-50 pointer-events-none" : ""}" ${plan === "free" ? "disabled" : ""}>
        📄 Export Word ${plan === "free" ? "(PRO)" : ""}
      </button>
    </div>
  `;
}

// Export Excel (menggabungkan semua tabel dalam satu sheet)
window.exportExcel = function () {
  // Gabungkan tabel-tabel yang ada
  const tables = document.querySelectorAll("#report-content table");
  if (tables.length === 0) return;

  const wb = XLSX.utils.book_new();

  // Buat sheet untuk ringkasan (gabungan tabel atas)
  let summaryWS;
  // Cari tabel top-diagnosis dan top-company
  const diagnosisTable = document.getElementById("top-diagnosis-table");
  const companyTable = document.getElementById("top-company-table");
  const detailTable = document.getElementById("report-table");

  // Gabungkan diagnosis dan company menjadi satu sheet "Ringkasan"
  if (diagnosisTable || companyTable) {
    let html = "<table>";
    if (diagnosisTable)
      html += `<tr><td colspan="3"><strong>10 Penyakit Terbanyak</strong></td></tr>${diagnosisTable.querySelector("thead")?.outerHTML}${diagnosisTable.querySelector("tbody")?.outerHTML}`;
    if (companyTable)
      html += `<tr><td colspan="3"><strong>Departemen Terbanyak</strong></td></tr>${companyTable.querySelector("thead")?.outerHTML}${companyTable.querySelector("tbody")?.outerHTML}`;
    html += "</table>";
    const el = document.createElement("div");
    el.innerHTML = html;
    summaryWS = XLSX.utils.table_to_sheet(el.querySelector("table"));
    XLSX.utils.book_append_sheet(wb, summaryWS, "Ringkasan");
  }

  if (detailTable) {
    const detailWS = XLSX.utils.table_to_sheet(detailTable);
    XLSX.utils.book_append_sheet(wb, detailWS, "Detail Kunjungan");
  }

  XLSX.writeFile(
    wb,
    `laporan_kunjungan_${new Date().toISOString().split("T")[0]}.xlsx`,
  );
};

// Export Word (menggabungkan semua tabel)
window.exportWord = function () {
  const reportContent = document.getElementById("report-content");
  if (!reportContent) return;

  const styles = `
    <style>
      body { font-family: Arial, sans-serif; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
      th, td { border: 1px solid black; padding: 5px; text-align: left; }
      th { background-color: #f0f0f0; }
      h3 { margin-top: 30px; }
    </style>
  `;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${styles}</head><body>${reportContent.innerHTML}</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `laporan_lengkap_${new Date().toISOString().split("T")[0]}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};
