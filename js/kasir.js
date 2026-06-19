// js/kasir.js
import { supabaseClient } from "./config.js";
import { getEmptyState } from "./components.js";

// State sementara untuk item tagihan
window.billingItems = [];

// --- 1. LOAD ANTREAN KASIR ---
export async function loadBillingQueue(currentUser) {
  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10">Memuat antrean kasir...</div>';

  try {
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", currentUser.id)
      .single();

    const { data: regs, error } = await supabaseClient
      .from("registrations")
      .select(
        "id, queue_number, status, created_at, patients(full_name), prescriptions(id, items)",
      )
      .eq("clinic_id", profileData.clinic_id)
      .eq("status", "waiting_payment")
      .order("created_at", { ascending: true });

    if (error || !regs || regs.length === 0) {
      mainContent.innerHTML = getEmptyState(
        "Tidak ada pasien menunggu pembayaran.",
      );
      return;
    }

    // Simpan data registrasi di window untuk akses mudah
    window.billingQueueData = regs;

    // Render cards dengan ID unik
    let cardsHTML =
      '<div class="grid grid-cols-1 md:grid-cols-3 gap-4 fade-in">';
    regs.forEach((r, index) => {
      cardsHTML += `
        <div id="billing-card-${index}" class="bg-white dark:bg-darkCard p-5 rounded-xl border border-gray-200 dark:border-gray-800 cursor-pointer hover:shadow-md transition">
          <div class="flex justify-between items-start mb-2">
            <span class="px-2 py-1 text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">${r.queue_number}</span>
          </div>
          <h4 class="font-bold text-lg">${r.patients.full_name}</h4>
          <p class="text-sm text-gray-500 mt-1">${r.prescriptions?.[0]?.items?.length || 0} item obat</p>
          <button class="mt-3 text-xs font-semibold text-primary">Buat Tagihan &rarr;</button>
        </div>`;
    });
    cardsHTML += "</div>";

    mainContent.innerHTML = cardsHTML;

    // Tambahkan event listener untuk klik card
    setTimeout(() => {
      regs.forEach((r, index) => {
        const card = document.getElementById(`billing-card-${index}`);
        if (card) {
          card.addEventListener("click", () => {
            if (window.billingQueueData && window.billingQueueData[index]) {
              window.navigateTo(
                "billing-detail",
                window.billingQueueData[index],
              );
            }
          });
        }
      });
    }, 100);
  } catch (err) {
    mainContent.innerHTML = `<div class="text-red-500 text-center py-4">Error: ${err.message}</div>`;
  }
}

// --- 2. LOAD DETAIL BILLING ---
// --- 2. LOAD DETAIL BILLING ---
export async function loadBillingDetail(registration) {
  window.currentBillingReg = registration;
  window.billingItems = [];

  const mainContent = document.getElementById("main-content");
  mainContent.innerHTML =
    '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-primary mx-auto" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-gray-500">Menghitung harga obat...</p></div>';

  if (
    registration &&
    registration.prescriptions &&
    Array.isArray(registration.prescriptions) &&
    registration.prescriptions.length > 0
  ) {
    const firstPresc = registration.prescriptions[0];
    if (firstPresc.items && Array.isArray(firstPresc.items)) {
      // 1. Kumpulkan ID Obat dari resep untuk dicari harganya
      const medIds = firstPresc.items
        .map((i) => i.medication_id)
        .filter((id) => id);
      let medPrices = {};

      // 2. Tarik data harga jual (price_sell) dari tabel medications
      if (medIds.length > 0) {
        try {
          const { data: medsData } = await supabaseClient
            .from("medications")
            .select("id, price_sell")
            .in("id", medIds);

          if (medsData) {
            medsData.forEach((m) => {
              medPrices[m.id] = m.price_sell || 0;
            });
          }
        } catch (err) {
          console.error("Gagal menarik harga obat:", err);
        }
      }

      // 3. Masukkan ke daftar tagihan dengan harga asli
      firstPresc.items.forEach((item) => {
        // Jika obat dari database, pakai harga database. Jika manual, set 0.
        const hargaAsli = item.medication_id
          ? medPrices[item.medication_id] || 0
          : 0;

        window.billingItems.push({
          name: `Obat: ${item.drug_name} (${item.dose})`,
          price: hargaAsli,
          qty: item.qty,
        });
      });
    }
  }

  // Render form kasir setelah harga selesai dihitung
  renderBillingForm(registration);
}
// --- 3. RENDER FORM & FUNGSI KASIR ---
function renderBillingForm(registration) {
  const mainContent = document.getElementById("main-content");
  const total = window.billingItems.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );

  let itemsHTML = "";
  if (window.billingItems.length === 0) {
    itemsHTML = '<p class="text-gray-500 text-sm">Belum ada item tagihan</p>';
  } else {
    window.billingItems.forEach((item, idx) => {
      itemsHTML += `
        <div id="billing-item-row-${idx}" class="grid grid-cols-12 gap-2 items-center bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
          <input type="text" id="item-name-${idx}" value="${item.name.replace(/"/g, "&quot;")}" class="col-span-5 p-2 border rounded dark:bg-gray-800">
          <input type="number" id="item-price-${idx}" value="${item.price}" class="col-span-3 p-2 border rounded dark:bg-gray-800" placeholder="Harga">
          <input type="number" id="item-qty-${idx}" value="${item.qty}" class="col-span-2 p-2 border rounded dark:bg-gray-800">
          <button id="item-delete-${idx}" class="col-span-2 text-red-500 flex justify-center">Hapus</button>
        </div>`;
    });
  }

  mainContent.innerHTML = `
    <div class="max-w-4xl mx-auto fade-in">
      <button id="btn-back" class="mb-4 text-sm text-gray-500 hover:text-primary">&larr; Kembali</button>
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
        <h3 class="text-xl font-bold">${registration.patients.full_name}</h3>
      </div>
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-4">
        <h4 class="font-semibold mb-4">Item Tagihan</h4>
        <div id="billing-items-container" class="space-y-3 mb-4">
          ${itemsHTML}
        </div>
        <div class="flex gap-2 mb-4">
          <select id="add-service-type" class="flex-grow p-2 border rounded dark:bg-gray-900">
            <option value="Konsultasi">Konsultasi</option>
            <option value="Tindakan">Tindakan</option>
          </select>
          <button id="btn-add-service" class="bg-primary text-white px-4 py-2 rounded">+ Tambah</button>
        </div>
        <div class="text-right text-2xl font-bold text-primary">Total: Rp ${total.toLocaleString("id-ID")}</div>
      </div>
      <button id="btn-process-payment" class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg">Proses Pembayaran</button>
    </div>`;

  // Setup event listeners dengan ID unik
  setTimeout(() => {
    // Button Kembali
    const btnBack = document.getElementById("btn-back");
    if (btnBack) {
      btnBack.onclick = () => {
        window.navigateTo("billing");
      };
    }

    // Event untuk setiap item billing
    if (window.billingItems) {
      window.billingItems.forEach((item, idx) => {
        const inputName = document.getElementById(`item-name-${idx}`);
        const inputPrice = document.getElementById(`item-price-${idx}`);
        const inputQty = document.getElementById(`item-qty-${idx}`);
        const btnDelete = document.getElementById(`item-delete-${idx}`);

        if (inputName) {
          inputName.onchange = () => {
            window.updateBillingItem(idx, "name", inputName.value);
          };
        }

        if (inputPrice) {
          inputPrice.onchange = () => {
            window.updateBillingItem(idx, "price", Number(inputPrice.value));
          };
        }

        if (inputQty) {
          inputQty.onchange = () => {
            window.updateBillingItem(idx, "qty", Number(inputQty.value));
          };
        }

        if (btnDelete) {
          btnDelete.onclick = () => {
            window.removeBillingItem(idx);
          };
        }
      });
    }

    // Button Tambah Service
    const btnAddService = document.getElementById("btn-add-service");
    if (btnAddService) {
      btnAddService.onclick = () => {
        window.addBillingService();
      };
    }

    // Button Proses Pembayaran
    const btnProcessPayment = document.getElementById("btn-process-payment");
    if (btnProcessPayment) {
      btnProcessPayment.onclick = () => {
        window.processPayment();
      };
    }
  }, 100);
}

window.updateBillingItem = (idx, field, val) => {
  if (window.billingItems && window.billingItems[idx]) {
    window.billingItems[idx][field] = val;
    renderBillingForm(window.currentBillingReg);
  }
};

window.removeBillingItem = (idx) => {
  if (window.billingItems) {
    window.billingItems.splice(idx, 1);
    renderBillingForm(window.currentBillingReg);
  }
};

window.addBillingService = () => {
  const select = document.getElementById("add-service-type");
  if (select && window.billingItems) {
    const type = select.value;
    window.billingItems.push({ name: type, price: 0, qty: 1 });
    renderBillingForm(window.currentBillingReg);
  }
};

window.processPayment = async function () {
  // Pastikan window.billingItems benar-benar ada
  const items = window.billingItems || [];

  if (items.length === 0) {
    alert("Tagihan kosong!");
    return;
  }

  // Gunakan variabel 'items' yang sudah aman
  const total = items.reduce(
    (sum, item) => sum + Number(item.price) * Number(item.qty),
    0,
  );

  if (total === 0) {
    alert("Total tagihan tidak boleh Rp 0!");
    return;
  }

  const reg = window.currentBillingReg;
  const user = window.currentUser;

  if (!user) {
    alert("Error: Data user tidak ditemukan. Silakan login kembali.");
    return;
  }

  if (!reg || !reg.id) {
    alert("Error: Data registrasi tidak valid.");
    return;
  }

  try {
    const { data: profileData, error: profileError } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      throw new Error("Data profil klinik tidak ditemukan");
    }

    // Insert invoice
    const { error: invoiceError } = await supabaseClient
      .from("invoices")
      .insert([
        {
          clinic_id: profileData.clinic_id,
          registration_id: reg.id,
          items: window.billingItems,
          total_amount: total,
          status: "paid",
        },
      ]);

    if (invoiceError) {
      console.error("Invoice error:", invoiceError);
      throw new Error("Gagal menyimpan invoice: " + invoiceError.message);
    }

    // Update status registrasi
    const { error: updateError } = await supabaseClient
      .from("registrations")
      .update({ status: "completed" })
      .eq("id", reg.id);

    if (updateError) {
      throw new Error("Gagal update status: " + updateError.message);
    }

    // Proses cetak STRUK KASIR LANGSUNG
    const printData = {
      ...reg,
      total_amount: total,
      items: window.billingItems,
    };

    // Langsung tembak ke fungsi cetak struk tanpa lewat modal
    if (window.printDirectInvoice) {
      window.printDirectInvoice(printData);
    } else {
      console.warn("Fungsi cetak langsung tidak ditemukan.");
    }

    setTimeout(() => window.navigateTo("billing"), 1000);
  } catch (err) {
    console.error("Payment error:", err);
    alert("Gagal memproses pembayaran: " + err.message);
  }
};
