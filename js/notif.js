// js/notif.js

/**
 * Tampilkan notifikasi toast (kanan atas)
 * @param {string} type - success, error, warning, info
 * @param {string} title - Judul
 * @param {string} message - Pesan
 * @param {number} duration - Durasi (ms), default 3000
 */
window.showToast = function (
  type = "info",
  title = "",
  message = "",
  duration = 3000,
) {
  const notif = document.getElementById("global-notif");
  const icon = document.getElementById("global-notif-icon");
  const titleEl = document.getElementById("global-notif-title");
  const msgEl = document.getElementById("global-notif-message");

  const config = {
    success: {
      icon: "✅",
      title: title || "Berhasil!",
      bg: "border-green-400",
    },
    error: { icon: "❌", title: title || "Gagal!", bg: "border-red-400" },
    warning: {
      icon: "⚠️",
      title: title || "Perhatian!",
      bg: "border-yellow-400",
    },
    info: { icon: "ℹ️", title: title || "Info", bg: "border-blue-400" },
  };

  const cfg = config[type] || config.info;

  icon.textContent = cfg.icon;
  titleEl.textContent = cfg.title;
  msgEl.textContent = message;
  notif.querySelector(".bg-white").className =
    notif.querySelector(".bg-white").className.replace(/border-\w+-\d+/g, "") +
    " " +
    cfg.bg;

  notif.classList.remove("hidden", "animate-slide-out");
  notif.classList.add("animate-slide-in");

  clearTimeout(window._toastTimer);
  if (duration > 0) {
    window._toastTimer = setTimeout(() => window.closeGlobalNotif(), duration);
  }
};

window.closeGlobalNotif = function () {
  const notif = document.getElementById("global-notif");
  notif.classList.add("animate-slide-out");
  setTimeout(() => notif.classList.add("hidden"), 250);
};

/**
 * Tampilkan dialog konfirmasi
 * @returns {Promise<boolean>} true jika OK, false jika Batal
 */
window.showConfirm = function (
  title = "Konfirmasi",
  message = "Apakah Anda yakin?",
  type = "warning",
) {
  return new Promise((resolve) => {
    const modal = document.getElementById("global-confirm");
    const icon = document.getElementById("confirm-icon");
    const titleEl = document.getElementById("confirm-title");
    const msgEl = document.getElementById("confirm-message");
    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancel-btn");

    const config = {
      success: { icon: "✅", okClass: "bg-green-600 hover:bg-green-700" },
      error: { icon: "❌", okClass: "bg-red-600 hover:bg-red-700" },
      warning: { icon: "⚠️", okClass: "bg-primary hover:bg-primaryHover" },
      info: { icon: "ℹ️", okClass: "bg-blue-600 hover:bg-blue-700" },
    };

    const cfg = config[type] || config.warning;
    icon.textContent = cfg.icon;
    titleEl.textContent = title;
    msgEl.textContent = message;
    okBtn.className = `flex-1 px-4 py-2.5 ${cfg.okClass} text-white rounded-lg font-medium`;

    modal.classList.remove("hidden");

    okBtn.onclick = () => {
      modal.classList.add("hidden");
      resolve(true);
    };
    cancelBtn.onclick = () => {
      modal.classList.add("hidden");
      resolve(false);
    };
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
        resolve(false);
      }
    };
  });
};

/**
 * Shortcut functions
 */
window.showSuccess = (msg, title) => window.showToast("success", title, msg);
window.showError = (msg, title) => window.showToast("error", title, msg);
window.showWarning = (msg, title) => window.showToast("warning", title, msg);
window.showInfo = (msg, title) => window.showToast("info", title, msg);
