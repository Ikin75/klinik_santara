// js/farmasi.js
import { supabaseClient } from "./config.js";
import { getEmptyState } from "./components.js";

// Format waktu Indonesia
function formatTimeID(date) {
  const wibDate = new Date(new Date(date).getTime() + 7 * 60 * 60 * 1000);
  return wibDate.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- 1. LOAD ANTREAN FARMASI ---
export async function loadPharmacyQueue(currentUser) {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10">Memuat antrean...</div>';

  try {
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();

    const { data: regs, error } = await supabaseClient
      .from("registrations")
      .select(
        `
        id, queue_number, status, created_at, 
        patients(full_name), 
        prescriptions!inner(id, items, status)
      `,
      )
      .eq("clinic_id", profileData.clinic_id)
      .eq("status", "waiting_pharmacy")
      .order("created_at", { ascending: true });

    if (error || !regs || regs.length === 0) {
      mainContent.innerHTML = getEmptyState("Tidak ada resep yang menunggu.");
      return;
    }

    mainContent.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">${regs
      .map((r) => {
        const prescription = r.prescriptions?.[0];
        const itemCount = prescription?.items?.length || 0;
        return `
        <div class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-md transition" onclick='window.navigateTo("process-prescription", ${JSON.stringify(r)})'>
          <div class="flex justify-between items-start mb-2">
            <span class="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">${formatTimeID(r.created_at)}</span>
          </div>
          <h4 class="font-bold text-lg">${r.patients.full_name}</h4>
          <p class="text-sm text-gray-500 mt-1">${itemCount} item obat</p>
          <button class="mt-3 text-xs font-semibold text-primary">Proses &rarr;</button>
        </div>`;
      })
      .join("")}</div>`;
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 text-center py-4">Error: ${err.message}</div>`;
  }
}

// --- 2. LOAD DETAIL RESEP ---
export function loadPrescriptionDetail(registration) {
  const mainContent = document.getElementById("main-content");
  const prescription = registration.prescriptions?.[0];

  if (!prescription || !prescription.items) {
    mainContent.innerHTML = `<div class="text-red-500 text-center">Data resep tidak ditemukan.</div>`;
    return;
  }

  const itemsHTML = prescription.items
    .map(
      (item) => `
    <div class="flex justify-between py-3 border-b dark:border-gray-700">
      <div><p class="font-semibold">${item.drug_name}</p><p class="text-sm text-gray-500">${item.dose}</p></div>
      <span class="font-bold">x${item.qty}</span>
    </div>
  `,
    )
    .join("");

  mainContent.innerHTML = `
    <div class="max-w-2xl mx-auto fade-in">
      <button onclick="window.navigateTo('pharmacy')" class="mb-4 text-sm text-gray-500 hover:text-primary">&larr; Kembali</button>
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
        <h3 class="text-xl font-bold">${registration.patients.full_name}</h3>
        <p class="text-sm text-gray-500">Antrian: ${registration.queue_number}</p>
      </div>
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
        <h4 class="font-semibold mb-4">Daftar Obat</h4>
        <div class="divide-y dark:divide-gray-700">${itemsHTML}</div>
      </div>
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
        <button onclick="window.updateRxStatus('${prescription.id}', 'preparing', '${registration.id}')" class="w-full bg-yellow-500 text-white py-2 rounded font-semibold hover:bg-yellow-600">Sedang Disiapkan</button>
        <button onclick="window.updateRxStatus('${prescription.id}', 'ready', '${registration.id}')" class="w-full bg-blue-500 text-white py-2 rounded font-semibold hover:bg-blue-600">Siap Diambil</button>
        <button onclick="window.updateRxStatus('${prescription.id}', 'handed_over', '${registration.id}')" class="w-full bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700">Sudah Diserahkan (Selesai)</button>
      </div>
    </div>`;
}

// --- 3. UPDATE STATUS ---
window.updateRxStatus = async function (rxId, status, regId) {
  try {
    await supabaseClient
      .from("prescriptions")
      .update({ status })
      .eq("id", rxId);

    if (status === "handed_over") {
      await supabaseClient
        .from("registrations")
        .update({ status: "waiting_payment" })
        .eq("id", regId);
      alert("✅ Resep selesai diserahkan. Pasien dialihkan ke Kasir.");
      window.navigateTo("pharmacy");
    } else {
      alert(`Status diperbarui menjadi: ${status}`);
    }
  } catch (err) {
    alert("Gagal update status: " + err.message);
  }
};
