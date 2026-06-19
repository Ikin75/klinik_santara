// js/cetak.js
import { supabaseClient } from "./config.js";

let currentPrintType = null;

// 1. Fungsi Buka Modal Cetak
window.openPrintModal = function () {
  document.getElementById("print-modal").classList.remove("hidden");
  document.getElementById("print-form-container").classList.add("hidden");
  currentPrintType = null;
  document
    .querySelectorAll(".print-type-btn")
    .forEach((btn) => btn.classList.remove("ring-4", "ring-primary"));
};

// 2. Fungsi Tutup Modal
window.closePrintModal = function () {
  document.getElementById("print-modal").classList.add("hidden");
  currentPrintType = null;
};

// 3. Pilih Jenis Dokumen
window.selectPrintType = function (type) {
  currentPrintType = type;

  // Hapus highlight dari semua tombol
  document
    .querySelectorAll(".print-type-btn")
    .forEach((btn) => btn.classList.remove("ring-4", "ring-primary"));

  // 🛠️ PERBAIKAN: Safety Check agar tidak error kalau dipanggil otomatis dari sistem
  if (typeof event !== "undefined" && event && event.currentTarget) {
    event.currentTarget.classList.add("ring-4", "ring-primary");
  }

  document.getElementById("print-form-container").classList.remove("hidden");

  const titles = {
    resep: "📝 Detail Resep Obat",
    sakit: "🤒 Surat Keterangan Sakit",
    sehat: "✅ Surat Keterangan Sehat",
    laik: "💼 Surat Keterangan Laik Kerja",
    invoice: "💰 Invoice/Struk Pembayaran",
  };
  document.getElementById("print-form-title").textContent = titles[type];

  // Render Form Input
  const container = document.getElementById("print-form-fields");
  let html = "";

  if (type === "resep") {
    html = `<div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-400">ℹ️ Resep akan otomatis terisi dari data SOAP yang sudah disimpan.</div>`;
  } else if (type === "sakit") {
    html = `
      <div><label class="block text-sm font-medium mb-1">Lama Istirahat (hari)</label><input type="number" id="print-sick-days" value="3" min="1" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Tanggal Mulai</label><input type="date" id="print-sick-start" value="${new Date().toISOString().split("T")[0]}" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Rekomendasi</label><textarea id="print-sick-recommendation" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">Istirahat total di rumah</textarea></div>
      
      <div class="mt-3 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
        <label class="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input type="checkbox" id="print-show-diagnosis" checked class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary">
          Tampilkan Diagnosa di Surat (Hapus centang untuk privasi)
        </label>
      </div>
    `;
  } else if (type === "sehat") {
    html = `
      <div><label class="block text-sm font-medium mb-1">Keperluan</label><input type="text" id="print-healthy-purpose" value="Administrasi" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Kesimpulan</label><textarea id="print-healthy-conclusion" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">Berdasarkan hasil pemeriksaan, pasien dinyatakan sehat.</textarea></div>
    `;
  } else if (type === "laik") {
    html = `
      <div><label class="block text-sm font-medium mb-1">Jenis Pekerjaan</label><input type="text" id="print-fit-purpose" value="Pekerjaan Umum" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Hasil Pemeriksaan</label><textarea id="print-fit-result" rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">Secara fisik dan mental, pasien dinyatakan LAIK untuk bekerja.</textarea></div>
    `;
  } else if (type === "invoice") {
    html = `
      <div><label class="block text-sm font-medium mb-1">Biaya Konsultasi (Rp)</label><input type="number" id="print-consult-fee" value="150000" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div><label class="block text-sm font-medium mb-1">Biaya Tindakan Lain (Rp)</label><input type="number" id="print-action-fee" value="0" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"></div>
      <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">ℹ️ Biaya obat akan otomatis ditambahkan dari data resep.</div>
    `;
  }
  container.innerHTML = html;
};

// 4. Eksekusi Cetak & Simpan Surat Sakit
window.doPrintDocument = async function () {
  if (!currentPrintType) {
    alert("Pilih jenis dokumen terlebih dahulu!");
    return;
  }

  // Simpan data surat sakit ke Database
  if (currentPrintType === "sakit") {
    try {
      const sickDays = document.getElementById("print-sick-days").value;
      const sickStart = document.getElementById("print-sick-start").value;
      const recommendation = document.getElementById(
        "print-sick-recommendation",
      ).value;

      await supabaseClient.from("sick_leaves").insert([
        {
          registration_id: window.currentPrintData.id,
          patient_id: window.currentPrintData.patient_id,
          start_date: sickStart,
          duration_days: sickDays,
          notes: recommendation,
        },
      ]);
    } catch (err) {
      console.error("Gagal menyimpan riwayat surat sakit:", err);
    }
  }

  const html = generatePrintDocument();
  const printWindow = window.open("", "_blank", "width=800,height=600");
  printWindow.document.write(`
    <html><head><title>Cetak Dokumen</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
      .doc-header { text-align: center; border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 20px; }
      .doc-header h1 { font-size: 24px; margin: 0; }
      .doc-header h2 { font-size: 16px; margin: 5px 0; font-weight: normal; }
      .doc-title { text-align: center; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 20px 0; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; }
      th, td { border: 1px solid #000; padding: 8px; text-align: left; }
      th { background: #f0f0f0; }
      .sign-line { border-top: 1px solid #000; width: 200px; display: inline-block; margin-top: 60px; padding-top: 5px; }
      .doc-signature { margin-top: 40px; text-align: right; }
      @media print { body { padding: 20px; } }
    </style>
    </head><body>${html}</body></html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};

window.previewPrintDocument = function () {
  if (!currentPrintType) {
    alert("Pilih jenis dokumen terlebih dahulu!");
    return;
  }
  const html = generatePrintDocument();
  const previewWindow = window.open("", "_blank", "width=800,height=600");
  previewWindow.document.write(
    `<html><head><title>Preview Dokumen</title><style>body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; } .doc-header { text-align: center; border-bottom: 3px double #000; padding-bottom: 15px; margin-bottom: 20px; } .doc-header h1 { font-size: 24px; margin: 0; } .doc-title { text-align: center; font-size: 18px; font-weight: bold; text-decoration: underline; margin: 20px 0; } table { width: 100%; border-collapse: collapse; margin: 15px 0; } th, td { border: 1px solid #000; padding: 8px; text-align: left; } th { background: #f0f0f0; } .sign-line { border-top: 1px solid #000; width: 200px; display: inline-block; margin-top: 60px; padding-top: 5px; } .doc-signature { margin-top: 40px; text-align: right; }</style></head><body>${html}</body></html>`,
  );
  previewWindow.document.close();
};

// 5. Rute Template Dokumen HTML
function generatePrintDocument() {
  const clinicName = "Klinik Santara Medical";
  const clinicAddress = "Pusat Kesehatan Terpadu, Jl. Contoh No. 123";
  const clinicPhone = "(021) 1234567";
  const doctorName = "Dokter Penanggung Jawab"; // Nanti bisa disesuaikan dengan data login dokter

  if (currentPrintType === "resep") {
    return generateResep(
      window.currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
      doctorName,
    );
  } else if (currentPrintType === "sakit") {
    return generateSuratSakit(
      window.currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
      doctorName,
    );
  } else if (currentPrintType === "sehat") {
    return generateSuratSehat(
      window.currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
      doctorName,
    );
  } else if (currentPrintType === "laik") {
    return generateSuratLaik(
      window.currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
      doctorName,
    );
  } else if (currentPrintType === "invoice") {
    return generateInvoice(
      window.currentPrintData,
      clinicName,
      clinicAddress,
      clinicPhone,
    );
  }

  return "<p>Dokumen tidak dikenali</p>";
}

// --- KUMPULAN TEMPLATE SURAT LENGKAP ---

function generateResep(
  data,
  clinicName,
  clinicAddress,
  clinicPhone,
  doctorName,
) {
  const patient = data.patients;
  const prescription = data.prescriptions?.[0];
  const items = prescription?.items || [];
  const dateStr = new Date(data.created_at).toLocaleDateString("id-ID");
  const dobStr = patient?.date_of_birth
    ? new Date(patient.date_of_birth).toLocaleDateString("id-ID")
    : "-";

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1><h2>${clinicAddress}</h2><p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">RESEP OBAT</div>
    <table style="border:none; margin-bottom: 20px;">
      <tr style="border:none;"><td style="border:none;width:120px;"><strong>Nama Pasien</strong></td><td style="border:none;">: ${patient?.full_name || "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;"><strong>Tanggal Lahir</strong></td><td style="border:none;">: ${dobStr}</td></tr>
      <tr style="border:none;"><td style="border:none;"><strong>Tanggal Resep</strong></td><td style="border:none;">: ${dateStr}</td></tr>
    </table>
    <table>
      <thead><tr><th>No</th><th>Nama Obat</th><th>Dosis</th><th>Jumlah</th></tr></thead>
      <tbody>
        ${items.map((item, idx) => `<tr><td>${idx + 1}</td><td>${item.drug_name}</td><td>${item.dose}</td><td>${item.qty}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="doc-signature">
      <p>Dokter Penanggung Jawab,</p><div class="sign-line"><strong>${doctorName}</strong></div>
    </div>
  `;
}

function generateSuratSakit(
  data,
  clinicName,
  clinicAddress,
  clinicPhone,
  doctorName,
) {
  const patient = data.patients;
  const sickDays = document.getElementById("print-sick-days")?.value || 3;
  const sickStart =
    document.getElementById("print-sick-start")?.value ||
    new Date().toISOString().split("T")[0];
  const recommendation =
    document.getElementById("print-sick-recommendation")?.value || "";

  const startDateObj = new Date(sickStart);
  const endDateObj = new Date(
    startDateObj.getTime() + (sickDays - 1) * 24 * 60 * 60 * 1000,
  );

  const record = Array.isArray(data.medical_records)
    ? data.medical_records[0]
    : data.medical_records;
  const rawDiagnosis = record?.soap_assessment || "Belum ada diagnosa";
  const showDiagnosis = document.getElementById(
    "print-show-diagnosis",
  )?.checked;
  const diagnosisText = showDiagnosis
    ? ` dengan diagnosa: <strong>${rawDiagnosis}</strong>`
    : "";

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1><h2>${clinicAddress}</h2><p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">SURAT KETERANGAN SAKIT</div>
    <p style="text-align:center; margin-top: -15px; margin-bottom: 30px;">Nomor: ___/SKS/${new Date().getFullYear()}</p>
    <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
    <table style="border:none; margin-left: 20px; margin-bottom: 20px;">
      <tr style="border:none;"><td style="border:none;width:150px;padding:5px 0;">Nama</td><td style="border:none;padding:5px 0;">: <strong>${patient?.full_name || "-"}</strong></td></tr>
      <tr style="border:none;"><td style="border:none;padding:5px 0;">Tanggal Lahir</td><td style="border:none;padding:5px 0;">: ${patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("id-ID") : "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;padding:5px 0;">Jenis Kelamin</td><td style="border:none;padding:5px 0;">: ${patient?.gender === "L" ? "Laki-laki" : patient?.gender === "P" ? "Perempuan" : "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;padding:5px 0;">Alamat</td><td style="border:none;padding:5px 0;">: ${patient?.address || "-"}</td></tr>
    </table>
    <p>Telah diperiksa di ${clinicName} pada tanggal <strong>${new Date(data.created_at).toLocaleDateString("id-ID")}</strong>${diagnosisText}.</p>
    <p>Dengan ini diberikan surat keterangan sakit untuk:</p>
    <ul>
      <li>Istirahat selama <strong>${sickDays} hari</strong></li>
      <li>Terhitung mulai tanggal <strong>${startDateObj.toLocaleDateString("id-ID")}</strong> s/d <strong>${endDateObj.toLocaleDateString("id-ID")}</strong></li>
      ${recommendation ? `<li>Rekomendasi: ${recommendation}</li>` : ""}
    </ul>
    <p style="margin-top: 30px;">Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.</p>
    <div class="doc-signature">
      <p>${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p>Dokter Pemeriksa,</p><div class="sign-line"><strong>${doctorName}</strong></div>
    </div>
  `;
}

function generateSuratSehat(
  data,
  clinicName,
  clinicAddress,
  clinicPhone,
  doctorName,
) {
  const patient = data.patients;
  const purpose =
    document.getElementById("print-healthy-purpose")?.value || "Administrasi";
  const conclusion =
    document.getElementById("print-healthy-conclusion")?.value || "Sehat";

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1><h2>${clinicAddress}</h2><p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">SURAT KETERANGAN SEHAT</div>
    <p style="text-align:center; margin-top: -15px; margin-bottom: 30px;">Nomor: ___/SKSEHAT/${new Date().getFullYear()}</p>
    <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
    <table style="border:none; margin-left: 20px; margin-bottom: 20px;">
      <tr style="border:none;"><td style="border:none;width:150px;padding:5px 0;">Nama</td><td style="border:none;padding:5px 0;">: <strong>${patient?.full_name || "-"}</strong></td></tr>
      <tr style="border:none;"><td style="border:none;padding:5px 0;">Tanggal Lahir</td><td style="border:none;padding:5px 0;">: ${patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("id-ID") : "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;padding:5px 0;">Jenis Kelamin</td><td style="border:none;padding:5px 0;">: ${patient?.gender === "L" ? "Laki-laki" : "Perempuan"}</td></tr>
    </table>
    <p>Telah dilakukan pemeriksaan kesehatan di ${clinicName} pada tanggal <strong>${new Date(data.created_at).toLocaleDateString("id-ID")}</strong>.</p>
    <p><strong>Kesimpulan Pemeriksaan:</strong></p>
    <p style="background:#f0f0f0;padding:10px;border-left:3px solid #000; margin-bottom: 20px;">${conclusion}</p>
    <p>Surat keterangan ini diberikan untuk keperluan: <strong>${purpose}</strong>.</p>
    <div class="doc-signature">
      <p>${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p>Dokter Penanggung Jawab,</p><div class="sign-line"><strong>${doctorName}</strong></div>
    </div>
  `;
}

function generateSuratLaik(
  data,
  clinicName,
  clinicAddress,
  clinicPhone,
  doctorName,
) {
  const patient = data.patients;
  const purpose =
    document.getElementById("print-fit-purpose")?.value || "Bekerja";
  const result =
    document.getElementById("print-fit-result")?.value || "Laik Kerja";

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1><h2>${clinicAddress}</h2><p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">SURAT KETERANGAN LAIK KERJA</div>
    <p style="text-align:center; margin-top: -15px; margin-bottom: 30px;">Nomor: ___/SKLW/${new Date().getFullYear()}</p>
    <p>Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
    <table style="border:none; margin-left: 20px; margin-bottom: 20px;">
      <tr style="border:none;"><td style="border:none;width:150px;padding:5px 0;">Nama</td><td style="border:none;padding:5px 0;">: <strong>${patient?.full_name || "-"}</strong></td></tr>
      <tr style="border:none;"><td style="border:none;padding:5px 0;">Tanggal Lahir</td><td style="border:none;padding:5px 0;">: ${patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString("id-ID") : "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;padding:5px 0;">Jenis Kelamin</td><td style="border:none;padding:5px 0;">: ${patient?.gender === "L" ? "Laki-laki" : "Perempuan"}</td></tr>
    </table>
    <p>Telah dilakukan pemeriksaan kesehatan di ${clinicName} pada tanggal <strong>${new Date(data.created_at).toLocaleDateString("id-ID")}</strong>.</p>
    <p><strong>Hasil Pemeriksaan:</strong></p>
    <p style="background:#f0f0f0;padding:10px;border-left:3px solid #000; margin-bottom: 20px;">${result}</p>
    <p>Dengan demikian, yang bersangkutan dinyatakan <strong>LAIK</strong> untuk bekerja/bertugas sebagai: <strong>${purpose}</strong>.</p>
    <div class="doc-signature">
      <p>${new Date().toLocaleDateString("id-ID", { year: "numeric", month: "long", day: "numeric" })}</p>
      <p>Dokter Penanggung Jawab,</p><div class="sign-line"><strong>${doctorName}</strong></div>
    </div>
  `;
}

function generateInvoice(data, clinicName, clinicAddress, clinicPhone) {
  const patient = data.patients;
  const consultFee = parseInt(
    document.getElementById("print-consult-fee")?.value || 0,
  );
  const actionFee = parseInt(
    document.getElementById("print-action-fee")?.value || 0,
  );
  const prescription = data.prescriptions?.[0];
  const items = prescription?.items || [];

  let totalMedication = 0;
  const medicationRows = items
    .map((item, idx) => {
      const price = 0; // Harga obat saat ini di-set 0 dari form kasir, nanti bisa dihubungkan
      const subtotal = price * parseInt(item.qty);
      totalMedication += subtotal;
      return `<tr><td>${idx + 1}</td><td>${item.drug_name}</td><td>${item.qty}</td><td>Rp ${price.toLocaleString("id-ID")}</td><td>Rp ${subtotal.toLocaleString("id-ID")}</td></tr>`;
    })
    .join("");

  const grandTotal = consultFee + actionFee + totalMedication;

  return `
    <div class="doc-header">
      <h1>${clinicName}</h1><h2>${clinicAddress}</h2><p>Telp: ${clinicPhone}</p>
    </div>
    <div class="doc-title">INVOICE / STRUK PEMBAYARAN</div>
    <p style="text-align:right;">No: INV/${Date.now().toString().slice(-6)}</p>
    <table style="border:none; margin-bottom: 20px;">
      <tr style="border:none;"><td style="border:none;width:120px;">Nama Pasien</td><td style="border:none;">: ${patient?.full_name || "-"}</td></tr>
      <tr style="border:none;"><td style="border:none;">Tanggal</td><td style="border:none;">: ${new Date(data.created_at).toLocaleDateString("id-ID")}</td></tr>
    </table>
    <table>
      <thead><tr><th>No</th><th>Uraian</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Biaya Konsultasi</td><td>1</td><td>Rp ${consultFee.toLocaleString("id-ID")}</td><td>Rp ${consultFee.toLocaleString("id-ID")}</td></tr>
        ${actionFee > 0 ? `<tr><td>2</td><td>Biaya Tindakan Lain</td><td>1</td><td>Rp ${actionFee.toLocaleString("id-ID")}</td><td>Rp ${actionFee.toLocaleString("id-ID")}</td></tr>` : ""}
        ${medicationRows}
      </tbody>
      <tfoot><tr><th colspan="4" style="text-align:right;">TOTAL TAGIHAN</th><th>Rp ${grandTotal.toLocaleString("id-ID")}</th></tr></tfoot>
    </table>
    <div class="doc-signature">
      <p>Kasir Klinik,</p><div class="sign-line"><strong>_______________</strong></div>
    </div>
  `;
}

// js/cetak.js (Bagian Paling Bawah)

window.printDirectInvoice = function (data) {
  const clinicName = "Klinik Santara";
  const clinicAddress = "Jl. Sehat Selalu No. 123";
  const clinicPhone = "021-1234567";
  const patient = data.patients;
  const items = data.items || [];
  const totalAmount = data.total_amount || 0;

  // Render item dengan gaya bertumpuk agar muat di kertas 58mm
  const itemRows = items
    .map((item) => {
      const subtotal = item.price * item.qty;
      return `
      <tr><td colspan="2" style="text-align:left; font-weight:bold; padding-top:4px;">${item.name}</td></tr>
      <tr>
        <td style="text-align:left; padding-bottom:4px;">${item.qty} x ${item.price.toLocaleString("id-ID")}</td>
        <td style="text-align:right; padding-bottom:4px;">${subtotal.toLocaleString("id-ID")}</td>
      </tr>
    `;
    })
    .join("");

  const html = `
    <div class="ticket">
      <div class="header">
        <h2>${clinicName}</h2>
        <p>${clinicAddress}</p>
        <p>${clinicPhone}</p>
      </div>
      <div class="divider">--------------------------------</div>
      <p>No : INV/${Date.now().toString().slice(-6)}</p>
      <p>Tgl: ${new Date().toLocaleString("id-ID")}</p>
      <p>Psn: ${patient?.full_name || "-"}</p>
      <div class="divider">--------------------------------</div>
      <table class="items">
        ${itemRows}
      </table>
      <div class="divider">--------------------------------</div>
      <table class="total">
        <tr>
          <td style="text-align:left; font-weight:bold;">TOTAL</td>
          <td style="text-align:right; font-weight:bold;">Rp ${totalAmount.toLocaleString("id-ID")}</td>
        </tr>
      </table>
      <div class="divider">--------------------------------</div>
      <div class="footer">
        <p>Terima Kasih</p>
        <p>Semoga Lekas Sembuh</p>
      </div>
    </div>
  `;

  // Ukuran window diperkecil menyesuaikan thermal
  const printWindow = window.open("", "_blank", "width=300,height=500");
  printWindow.document.write(`
    <html><head><title>Struk POS</title>
    <style>
      @page { margin: 0; }
      body { 
        font-family: 'Courier New', Courier, monospace; 
        width: 58mm; /* Lebar standar POS-58 */
        margin: 0; 
        padding: 5px; 
        font-size: 12px; 
        color: #000; 
        background: #fff; 
      }
      .ticket { width: 100%; max-width: 58mm; }
      .header { text-align: center; }
      .header h2 { font-size: 14px; margin: 0 0 5px 0; }
      .header p { margin: 0; font-size: 10px; }
      p { margin: 2px 0; }
      .divider { text-align: center; font-size: 12px; margin: 5px 0; overflow: hidden; white-space: nowrap; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      td { padding: 2px 0; vertical-align: top; }
      .total { font-size: 12px; margin-top: 5px; }
      .footer { text-align: center; font-size: 10px; margin-top: 10px; }
    </style>
    </head><body>${html}</body></html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};

// --- FUNGSI PERSIAPAN DATA CETAK DARI HALAMAN DOKTER ---
// Paste ini di paling bawah js/cetak.js
window.loadPrintDataAndOpenModal = async function (regId) {
  if (!regId) return alert("ID Kunjungan tidak ditemukan!");
  try {
    const { data, error } = await supabaseClient
      .from("registrations")
      .select("*, patients(*), medical_records(*), prescriptions(id, items)")
      .eq("id", regId)
      .single();
    if (error) throw error;

    window.currentPrintData = data;
    if (window.openPrintModal) window.openPrintModal();
  } catch (err) {
    alert("Gagal memuat data cetak: " + err.message);
  }
};
