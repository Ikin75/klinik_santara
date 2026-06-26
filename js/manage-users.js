// js/manage-users.js

import { supabaseClient } from "./config.js";

let currentClinicId = null;

export async function renderManageUsers() {
  const mainContent = document.getElementById("main-content");

  // Ambil clinic_id
  try {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("clinic_id")
      .eq("id", window.currentUser?.id)
      .single();
    currentClinicId = profile?.clinic_id;
  } catch (err) {
    console.error("Gagal ambil clinic:", err);
  }

  if (!currentClinicId) {
    mainContent.innerHTML = `<div class="max-w-4xl mx-auto fade-in"><div class="bg-red-50 p-10 rounded-xl border border-red-200 text-center"><p class="text-5xl mb-4">❌</p><h3 class="text-lg font-semibold text-red-700">Data Klinik Tidak Ditemukan</h3><p class="text-red-500 mt-2">Hubungi Super Admin.</p></div></div>`;
    return;
  }

  mainContent.innerHTML = `
    <div class="max-w-4xl mx-auto fade-in">
      <div class="bg-white dark:bg-darkCard p-6 rounded-xl border border-gray-200 dark:border-gray-800 mb-6">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold">👥 Manajemen User Klinik</h2>
            <p class="text-sm text-gray-500 mt-1">Tambah dokter, perawat, apoteker, kasir</p>
          </div>
          <button onclick="window.showAddUserForm()" class="px-6 py-3 bg-primary hover:bg-primaryHover text-white font-semibold rounded-xl transition shadow-lg">+ Tambah User</button>
        </div>
      </div>
      <div id="users-list" class="space-y-3">
        <div class="text-center py-10"><div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3"></div><p class="text-gray-500">Memuat data user...</p></div>
      </div>
    </div>
    <div id="user-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">👤 Tambah User</h3>
          <button onclick="window.closeUserModal()" class="text-gray-400 hover:text-red-500 text-2xl">&times;</button>
        </div>
        <form id="user-form" class="space-y-4">
          <div><label class="block text-sm font-medium mb-1">Nama Lengkap *</label><input type="text" id="user-name" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none" placeholder="Dr. Budi Santoso"></div>
          <div><label class="block text-sm font-medium mb-1">Email *</label><input type="email" id="user-email" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none" placeholder="budi@klinik.com"></div>
          <div><label class="block text-sm font-medium mb-1">Password *</label><input type="password" id="user-password" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none" placeholder="Min 6 karakter"></div>
          <div>
  <label class="block text-sm font-medium mb-1">Role *</label>
  <select id="user-role" required class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none">
    <option value="">-- Pilih Role --</option>
    <option value="doctor">👨‍⚕️ Dokter</option>
    <option value="nurse">👩‍⚕️ Perawat</option>
    <option value="pharmacist">💊 Apoteker</option>
    <option value="cashier">💰 Kasir</option>
    <option value="receptionist">📋 Staff Pendaftaran</option>
    <option value="admin">🔧 Admin</option>
  </select>
</div>

<!-- 🆕 FIELD POLI (hanya muncul kalau role = doctor) -->
<div id="doctor-poli-field" style="display:none;">
  <label class="block text-sm font-medium mb-1">Poli *</label>
  <select id="doctor-poli" class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none">
    <option value="">-- Pilih Poli --</option>
    <option value="Poli Umum">Poli Umum</option>
    <option value="Poli Gigi">Poli Gigi</option>
    <option value="Poli Anak">Poli Anak</option>
    <option value="Poli Spesialis A">Poli Spesialis A</option>
    <option value="Poli Spesialis B">Poli Spesialis B</option>
  </select>
</div>
          <button type="submit" id="btn-save-user" class="w-full bg-primary hover:bg-primaryHover text-white font-semibold py-3 rounded-lg transition">💾 Simpan User</button>
          <p id="user-msg" class="text-sm hidden mt-2"></p>
        </form>
      </div>
    </div>
  `;

  loadUserList();
  setupUserForm();
}

async function loadUserList() {
  const container = document.getElementById("users-list");
  if (!container) return;

  try {
    const { data: userList, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("clinic_id", currentClinicId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!userList || userList.length === 0) {
      container.innerHTML =
        '<div class="text-center py-10 text-gray-500">Belum ada user lain</div>';
      return;
    }

    const roleIcons = {
      admin: "🔧",
      owner: "👑",
      doctor: "👨‍⚕️",
      nurse: "👩‍⚕️",
      pharmacist: "💊",
      cashier: "💰",
    };

    container.innerHTML = userList
      .map(
        (u) => `
      <div class="bg-white dark:bg-darkCard p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl">${roleIcons[u.role] || "👤"}</div>
          <div><p class="font-semibold">${u.full_name}</p><p class="text-xs text-gray-500 uppercase">${u.role}</p></div>
        </div>
        <button onclick="window.deleteUser('${u.id}', '${u.full_name}')" class="text-red-500 hover:text-red-700 text-sm">🗑️ Hapus</button>
      </div>
    `,
      )
      .join("");
  } catch (err) {
    container.innerHTML = `<div class="text-red-500 text-center py-4">❌ Error: ${err.message}</div>`;
  }
}

function setupUserForm() {
  const form = document.getElementById("user-form");
  if (!form) return;

  // Toggle poli field saat role dipilih
  document.getElementById("user-role").addEventListener("change", function () {
    const poliField = document.getElementById("doctor-poli-field");
    if (this.value === "doctor") {
      poliField.style.display = "block";
    } else {
      poliField.style.display = "none";
      document.getElementById("doctor-poli").value = "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-save-user");
    const msg = document.getElementById("user-msg");
    btn.disabled = true;
    btn.textContent = "⏳ Menyimpan...";

    try {
      const email = document.getElementById("user-email").value.trim();
      const password = document.getElementById("user-password").value;
      const fullName = document.getElementById("user-name").value.trim();
      const role = document.getElementById("user-role").value;
      const specialization = document.getElementById("doctor-poli").value;

      const { data: authData, error: authError } =
        await supabaseClient.auth.signUp({ email, password });
      if (authError) throw authError;

      if (authData.user) {
        const profileData = {
          id: authData.user.id,
          clinic_id: currentClinicId,
          role: role,
          full_name: fullName,
        };

        // Tambah specialization kalau role doctor
        if (role === "doctor" && specialization) {
          profileData.specialization = specialization;
        }

        const { error: profileError } = await supabaseClient
          .from("profiles")
          .insert([profileData]);
        if (profileError) throw profileError;
      }

      msg.textContent = `✅ User "${fullName}" berhasil ditambahkan!`;
      msg.className = "text-sm text-green-600 mt-2 p-3 bg-green-50 rounded-lg";
      msg.classList.remove("hidden");
      form.reset();
      loadUserList();
      setTimeout(() => window.closeUserModal(), 1500);
    } catch (err) {
      msg.textContent = "❌ Gagal: " + err.message;
      msg.className = "text-sm text-red-600 mt-2";
      msg.classList.remove("hidden");
    } finally {
      btn.disabled = false;
      btn.textContent = "💾 Simpan User";
    }
  });
}

window.showAddUserForm = () => {
  document.getElementById("user-form").reset();
  document.getElementById("user-modal").classList.remove("hidden");
};

window.closeUserModal = () => {
  document.getElementById("user-modal").classList.add("hidden");
};

window.deleteUser = async (userId, userName) => {
  const confirmed = await window.showConfirm(
    "Hapus User?",
    `Hapus user "${userName}"?`,
    "error",
  );
  if (!confirmed) return;
  try {
    await supabaseClient.from("profiles").delete().eq("id", userId);
    window.showSuccess("User dihapus!");
    loadUserList();
  } catch (err) {
    window.showError("Gagal: " + err.message);
  }
};
