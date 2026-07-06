// js/components.js

/**
 * Komponen UI untuk Aplikasi Klinik
 * @module components
 * @description Berisi komponen-komponen UI yang dapat digunakan kembali
 */

// ==========================================
// KONSTANTA DAN KONFIGURASI
// ==========================================

/**
 * Konfigurasi menu sidebar
 * Mendefinisikan struktur menu dan permission-nya
 */
const MENU_CONFIG = {
  // Menu yang selalu tampil
  permanent: [],

  // Menu berdasarkan role
  roleBased: [
    // Menu yang selalu ada (FREE & PRO)
    {
      view: "registration",
      label: "Pendaftaran",
      icon: "registration",
      roles: ["admin", "owner", "receptionist"],
      activeViews: ["registration"],
      divider: false,
      proOnly: false,
    },
    {
      view: "triage",
      label: "Antrian TTV (Perawat)",
      icon: "nurse",
      roles: ["nurse", "admin", "owner"],
      activeViews: ["triage", "input-ttv"],
      condition: (settings) => settings.use_nurse_triage,
      divider: true,
      proOnly: false,
    },
    {
      view: "doctor-queue",
      label: "Pemeriksaan Dokter (SOAP)",
      icon: "doctor",
      roles: ["doctor", "admin", "owner"],
      activeViews: ["doctor-queue", "input-soap"],
      divider: true,
      proOnly: false,
    },

    // Menu PRO ONLY
    {
      view: "pharmacy",
      label: "Farmasi & Resep",
      icon: "pharmacy",
      roles: ["pharmacist", "admin", "owner"],
      activeViews: ["pharmacy", "process-prescription"],
      condition: (settings) => settings.has_internal_pharmacy,
      divider: true,
      proOnly: true, // 🆕 HANYA PRO
    },
    {
      view: "medications",
      label: "Manajemen Obat",
      icon: "medications",
      roles: ["pharmacist", "admin", "owner"],
      activeViews: ["medications"],
      divider: false,
      proOnly: true, // 🆕 HANYA PRO
    },
    {
      view: "billing",
      label: "Kasir / Billing",
      icon: "billing",
      roles: ["cashier", "admin", "owner"],
      activeViews: ["billing", "billing-detail"],
      divider: true,
      proOnly: true, // 🆕 HANYA PRO
    },
    {
      view: "manage-users",
      label: "👥 Manajemen User",
      icon: "users",
      roles: ["admin", "owner"],
      activeViews: ["manage-users"],
      divider: true,
      proOnly: true, // 🆕 HANYA PRO
    },
    {
      view: "dashboard-stats",
      label: "Dashboard Statistik",
      icon: "dashboard",
      roles: ["admin", "owner"],
      activeViews: ["dashboard-stats"],
      divider: false,
      proOnly: true, // 🆕 HANYA PRO
    },
    {
      view: "master-corporate",
      label: "Master Corporate",
      icon: "corporate",
      roles: ["admin", "owner"],
      activeViews: ["master-corporate"],
      divider: true,
      proOnly: true, // 🆕 HANYA PRO
    },
    {
      view: "pricing",
      label: "💰 Upgrade ke PRO",
      icon: "billing", // atau icon khusus
      roles: [
        "admin",
        "owner",
        "doctor",
        "nurse",
        "pharmacist",
        "cashier",
        "receptionist",
      ],
      activeViews: ["pricing"],
      divider: true,
      proOnly: false, // semua bisa lihat
    },
  ],
};

/**
 * Icon SVG map untuk konsistensi
 */
const ICONS = {
  registration: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`,

  dashboard: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`,

  nurse: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>`,

  doctor: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>`,

  pharmacy: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>`,

  medications: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>`,

  corporate: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>`,

  billing: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>`,

  "super-admin": `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,

  empty: `<svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>`,
};

/**
 * CSS classes untuk state button
 */
const BUTTON_CLASSES = {
  active:
    "bg-orange-50 text-primary dark:bg-orange-900/20 dark:text-orange-400 font-semibold",
  inactive:
    "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium",
  base: "sidebar-btn w-full flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-all duration-200",
};

// ==========================================
// FUNGSI UTAMA
// ==========================================

/**
 * Render sidebar menu dengan permission handling
 * @param {string} currentView - View yang sedang aktif
 * @param {string} userRole - Role user (admin, owner, doctor, nurse, pharmacist)
 * @param {Object} clinicSettings - Pengaturan klinik
 * @param {Object} options - Opsi tambahan
 * @returns {void}
 */
export function renderSidebar(
  currentView,
  userRole,
  clinicSettings = {},
  options = {},
) {
  const menu = document.getElementById("sidebar-menu");

  // Validasi element
  if (!menu) {
    console.error("❌ Element #sidebar-menu tidak ditemukan");
    return;
  }

  // Validasi role
  const validRoles = [
    "admin",
    "owner",
    "doctor",
    "nurse",
    "pharmacist",
    "super_admin",
  ];
  if (!validRoles.includes(userRole)) {
    console.warn(`⚠️ Role tidak valid: ${userRole}. Menggunakan role default.`);
    userRole = "doctor"; // Default role
  }

  try {
    // Build menu HTML
    const menuHTML = buildMenuHTML(currentView, userRole, clinicSettings);

    // Render ke DOM
    menu.innerHTML = menuHTML;

    // Attach event listeners
    attachMenuEvents(menu);

    // Highlight menu yang aktif
    highlightActiveMenu(menu, currentView);

    // Tambahkan badge notifikasi jika ada
    if (options.badges) {
      addNotificationBadges(menu, options.badges);
    }
  } catch (error) {
    console.error("❌ Gagal render sidebar:", error);
    menu.innerHTML = `
      <div class="p-4 text-center text-red-500">
        <p class="text-sm">⚠️ Gagal memuat menu</p>
        <button onclick="location.reload()" class="text-xs text-primary hover:underline mt-2">
          Muat Ulang
        </button>
      </div>`;
  }
}

/**
 * Build HTML untuk menu sidebar
 * @private
 */
function buildMenuHTML(currentView, userRole, clinicSettings) {
  const sections = [];

  // ✅ Ambil plan SEKALI di atas
  const clinicPlan =
    clinicSettings?.plan || localStorage.getItem("clinic_plan") || "free";

  // Section: Menu Utama (selalu tampil)
  sections.push(`
    <div class="mb-4">
      <h3 class="px-4 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        Menu Utama
      </h3>
      ${MENU_CONFIG.permanent
        .map(
          (menu) =>
            buildMenuItem(
              menu,
              currentView,
              userRole,
              clinicSettings,
              clinicPlan,
            ), // ✅ kirim clinicPlan
        )
        .join("")}
    </div>
  `);

  // Section: Menu Berdasarkan Role
  const roleMenus = MENU_CONFIG.roleBased.filter((menu) => {
    if (userRole === "super_admin") return true;
    if (!menu.roles.includes(userRole)) return false;

    if (menu.condition && !menu.condition(clinicSettings)) return false;
    return true;
  });

  if (roleMenus.length > 0) {
    let currentGroup = [];
    const groups = [];

    roleMenus.forEach((menu, index) => {
      currentGroup.push(menu);
      if (menu.divider || index === roleMenus.length - 1) {
        groups.push([...currentGroup]);
        currentGroup = [];
      }
    });

    groups.forEach((group, groupIndex) => {
      const sectionTitle = getSectionTitle(group[0].view);
      sections.push(`
        <div class="mb-4">
          <h3 class="px-4 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            ${sectionTitle}
          </h3>
          ${group
            .map(
              (menu) =>
                buildMenuItem(
                  menu,
                  currentView,
                  userRole,
                  clinicSettings,
                  clinicPlan,
                ), // ✅ kirim clinicPlan
            )
            .join("")}
        </div>
      `);
    });
  }

  // ✅ Footer (pakai clinicPlan yang sama)
  const planBadge =
    clinicPlan === "pro"
      ? '<span class="text-xs bg-gradient-to-r from-primary to-orange-500 text-white px-2 py-0.5 rounded-full font-bold">PRO</span>'
      : '<span class="text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded-full">FREE</span>';

  sections.push(`
    <div class="mt-6 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-gray-400">Paket</span>
        ${planBadge}
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-400">
        <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span>v1.0.0</span>
      </div>
    </div>
  `);

  return sections.join("");
}

/**
 * Build HTML untuk satu item menu
 * @private
 */
function buildMenuItem(
  menu,
  currentView,
  userRole,
  clinicSettings,
  clinicPlan = "free",
) {
  const isActive = menu.activeViews.includes(currentView);
  const stateClass = isActive ? BUTTON_CLASSES.active : BUTTON_CLASSES.inactive;
  const icon = ICONS[menu.icon] || ICONS.registration;

  // 🆕 Cek apakah menu ini PRO only & user pakai FREE
  const isProOnly = menu.proOnly && clinicPlan === "free";
  const disabledAttr = isProOnly ? "disabled" : "";
  const disabledClass = isProOnly
    ? "opacity-50 pointer-events-none" // ← pointer-events-none
    : "cursor-pointer";
  const onClick = isProOnly
    ? "" // tidak bisa diklik
    : `window.navigateTo('${menu.view}')`;

  return `
    <button 
      data-view="${menu.view}" 
      class="${BUTTON_CLASSES.base} ${stateClass} ${disabledClass}"
      role="menuitem"
      ${disabledAttr}
      onclick="${onClick}"
      title="${isProOnly ? "Fitur ini hanya tersedia di paket PRO" : menu.label}"
    >
      <span class="flex-shrink-0">${icon}</span>
      <span class="flex-1 text-left">${menu.label}</span>
      ${isProOnly ? '<span class="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full ml-2 font-bold">PRO</span>' : ""}
      ${isActive ? `<span class="flex-shrink-0"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></span>` : ""}
    </button>
  `;
}

/**
 * Get section title berdasarkan view
 * @private
 */
function getSectionTitle(view) {
  const titles = {
    triage: "Perawat",
    "doctor-queue": "Dokter",
    pharmacy: "Farmasi",
    medications: "Inventaris",
    billing: "Keuangan",
    "master-corporate": "Administrasi",
    "dashboard-stats": "Manajemen",
    "super-admin": "Super Admin",
    pricing: "Akun",
  };
  return titles[view] || "Lainnya";
}

/**
 * Attach click events ke menu items
 * @private
 */
function attachMenuEvents(menu) {
  menu.querySelectorAll(".sidebar-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const view = btn.dataset.view;

      if (btn.disabled) return;
      // Prevent double navigation
      if (btn.classList.contains("navigating")) return;

      // Add loading state
      btn.classList.add("navigating", "opacity-70");

      // Navigate
      try {
        if (typeof window.navigateTo === "function") {
          window.navigateTo(view);
        } else {
          console.error("❌ window.navigateTo tidak tersedia");
        }
      } catch (error) {
        console.error("❌ Gagal navigasi:", error);
      } finally {
        // Remove loading state after short delay
        setTimeout(() => {
          btn.classList.remove("navigating", "opacity-70");
        }, 500);
      }
    });

    // Add hover effect
    btn.addEventListener("mouseenter", () => {
      if (!btn.classList.contains("bg-orange-50")) {
        btn.classList.add("hover:bg-gray-100", "dark:hover:bg-gray-800");
      }
    });
  });
}

/**
 * Highlight menu yang sedang aktif
 * @private
 */
function highlightActiveMenu(menu, currentView) {
  const activeButton = menu.querySelector(`[data-view="${currentView}"]`);

  if (activeButton) {
    // Scroll ke menu yang aktif
    setTimeout(() => {
      activeButton.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 300);
  }
}

/**
 * Tambahkan badge notifikasi ke menu
 * @private
 */
function addNotificationBadges(menu, badges = {}) {
  Object.entries(badges).forEach(([view, count]) => {
    if (count > 0) {
      const button = menu.querySelector(`[data-view="${view}"]`);
      if (button) {
        const badge = document.createElement("span");
        badge.className =
          "ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center";
        badge.textContent = count > 99 ? "99+" : count;
        button.appendChild(badge);
      }
    }
  });
}

// ==========================================
// EMPTY STATE COMPONENT
// ==========================================

/**
 * Generate empty state UI
 * @param {string} message - Pesan yang ditampilkan
 * @param {Object} options - Opsi konfigurasi
 * @param {string} options.icon - Icon kustom (SVG string)
 * @param {string} options.title - Judul kustom
 * @param {string} options.actionLabel - Label tombol aksi
 * @param {Function} options.onAction - Handler tombol aksi
 * @param {string} options.type - Tipe empty state (info, warning, error, success)
 * @returns {string} HTML string
 */
export function getEmptyState(message, options = {}) {
  const {
    icon = ICONS.empty,
    title = "Tidak Ada Data",
    actionLabel = null,
    onAction = null,
    type = "info",
  } = options;

  // Color schemes berdasarkan tipe
  const colorSchemes = {
    info: {
      bg: "bg-white dark:bg-darkCard",
      border: "border-gray-200 dark:border-gray-800",
      title: "text-gray-700 dark:text-gray-300",
      message: "text-gray-500 dark:text-gray-400",
      icon: "text-gray-400",
      button: "bg-primary hover:bg-primaryHover text-white",
    },
    warning: {
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
      border: "border-yellow-200 dark:border-yellow-800",
      title: "text-yellow-800 dark:text-yellow-300",
      message: "text-yellow-600 dark:text-yellow-400",
      icon: "text-yellow-400",
      button: "bg-yellow-600 hover:bg-yellow-700 text-white",
    },
    error: {
      bg: "bg-red-50 dark:bg-red-900/20",
      border: "border-red-200 dark:border-red-800",
      title: "text-red-800 dark:text-red-300",
      message: "text-red-600 dark:text-red-400",
      icon: "text-red-400",
      button: "bg-red-600 hover:bg-red-700 text-white",
    },
    success: {
      bg: "bg-green-50 dark:bg-green-900/20",
      border: "border-green-200 dark:border-green-800",
      title: "text-green-800 dark:text-green-300",
      message: "text-green-600 dark:text-green-400",
      icon: "text-green-400",
      button: "bg-green-600 hover:bg-green-700 text-white",
    },
  };

  const scheme = colorSchemes[type] || colorSchemes.info;

  const actionHTML =
    actionLabel && onAction
      ? `
    <button 
      onclick="${onAction}" 
      class="mt-4 px-6 py-2 ${scheme.button} rounded-lg font-semibold transition-colors shadow-sm hover:shadow-md"
    >
      ${actionLabel}
    </button>
  `
      : "";

  return `
    <div class="${scheme.bg} p-10 rounded-xl shadow-sm border ${scheme.border} text-center fade-in">
      <div class="${scheme.icon} mx-auto mb-4">
        ${icon}
      </div>
      <h3 class="text-lg font-semibold ${scheme.title} mb-2">
        ${title}
      </h3>
      <p class="${scheme.message}">
        ${message}
      </p>
      ${actionHTML}
    </div>
  `;
}

// ==========================================
// LOADING STATE COMPONENT
// ==========================================

/**
 * Generate loading state UI
 * @param {string} message - Pesan loading
 * @returns {string} HTML string
 */
export function getLoadingState(message = "Memuat data...") {
  return `
    <div class="flex flex-col items-center justify-center py-16 fade-in">
      <div class="relative">
        <div class="animate-spin h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="h-6 w-6 bg-primary/20 rounded-full animate-ping"></div>
        </div>
      </div>
      <p class="text-gray-500 dark:text-gray-400 mt-4 font-medium">${message}</p>
      <p class="text-gray-400 dark:text-gray-500 text-xs mt-1">Mohon tunggu sebentar...</p>
    </div>
  `;
}

// ==========================================
// ERROR STATE COMPONENT
// ==========================================

/**
 * Generate error state UI
 * @param {string} message - Pesan error
 * @param {Function} retryCallback - Fungsi retry
 * @returns {string} HTML string
 */
export function getErrorState(message, retryCallback = null) {
  const retryHTML = retryCallback
    ? `
    <button 
      onclick="${retryCallback}" 
      class="mt-4 px-6 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
    >
      🔄 Coba Lagi
    </button>
  `
    : "";

  return `
    <div class="bg-red-50 dark:bg-red-900/20 p-10 rounded-xl shadow-sm border border-red-200 dark:border-red-800 text-center fade-in">
      <div class="text-5xl mb-4">⚠️</div>
      <h3 class="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">
        Terjadi Kesalahan
      </h3>
      <p class="text-red-600 dark:text-red-400">
        ${message}
      </p>
      ${retryHTML}
    </div>
  `;
}

// ==========================================
// CONFIRMATION DIALOG COMPONENT
// ==========================================

/**
 * Generate confirmation dialog HTML (modal)
 * @param {Object} options
 * @returns {string} HTML string
 */
export function getConfirmationDialog(options = {}) {
  const {
    title = "Konfirmasi",
    message = "Apakah Anda yakin?",
    confirmLabel = "Ya, Lanjutkan",
    cancelLabel = "Batal",
    confirmClass = "bg-red-600 hover:bg-red-700",
    onConfirm = "window.closeConfirmDialog()",
    onCancel = "window.closeConfirmDialog()",
  } = options;

  return `
    <div id="confirm-dialog" class="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl p-6 animate-fade-in-up">
        <div class="text-center mb-6">
          <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">${title}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">${message}</p>
        </div>
        
        <div class="flex gap-3">
          <button onclick="${onCancel}" 
                  class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium">
            ${cancelLabel}
          </button>
          <button onclick="${onConfirm}" 
                  class="flex-1 px-4 py-2.5 ${confirmClass} text-white rounded-lg transition-colors font-medium">
            ${confirmLabel}
          </button>
        </div>
      </div>
    </div>
  `;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Validasi permission user untuk menu tertentu
 * @param {string} userRole
 * @param {Array} allowedRoles
 * @returns {boolean}
 */
export function hasPermission(userRole, allowedRoles) {
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(userRole);
}

/**
 * Get role label dalam Bahasa Indonesia
 * @param {string} role
 * @returns {string}
 */
export function getRoleLabel(role) {
  const labels = {
    admin: "Administrator",
    owner: "Pemilik Klinik",
    doctor: "Dokter",
    nurse: "Perawat",
    pharmacist: "Apoteker",
    super_admin: "Super Admin",
  };
  return labels[role] || role;
}

// ==========================================
// EXPORT DEFAULT (untuk kemudahan import)
// ==========================================
export default {
  renderSidebar,
  getEmptyState,
  getLoadingState,
  getErrorState,
  getConfirmationDialog,
  hasPermission,
  getRoleLabel,
  ICONS,
};
