// js/theme.js

/**
 * Terapkan tema klinik ke seluruh aplikasi
 */
export function applyClinicTheme(clinic) {
  if (!clinic) return;

  console.log("🎨 Applying theme:", clinic.name);

  // 1. Update logo
  updateLogo(clinic.logo_url);

  // 2. Update nama klinik
  updateClinicName(clinic.name);

  // 3. Update warna
  updateColors(clinic.primary_color, clinic.secondary_color);
}

/**
 * Update logo di semua tempat
 */
function updateLogo(logoUrl) {
  const logos = document.querySelectorAll(".clinic-logo");
  const fallbacks = document.querySelectorAll(".clinic-logo-fallback");

  if (logoUrl && logoUrl.trim() !== "") {
    // Ada logo → tampilkan gambar
    logos.forEach((img) => {
      img.src = logoUrl;
      img.style.display = "block";
      img.onerror = () => {
        img.style.display = "none";
        if (img.nextElementSibling) {
          img.nextElementSibling.style.display = "flex";
        }
      };
    });
    fallbacks.forEach((el) => (el.style.display = "none"));
  } else {
    // Tidak ada logo → tampilkan fallback
    logos.forEach((img) => (img.style.display = "none"));
    fallbacks.forEach((el) => (el.style.display = "flex"));
  }
}

/**
 * Update nama klinik di header/sidebar
 */
function updateClinicName(name) {
  if (!name) return;

  const nameElements = document.querySelectorAll(".clinic-name");
  nameElements.forEach((el) => {
    el.textContent = name;
  });

  // Update title browser
  document.title = `${name} - KlinikHub`;
}

/**
 * Update warna tema
 */
function updateColors(primaryColor, secondaryColor) {
  const root = document.documentElement;

  if (primaryColor) {
    root.style.setProperty("--color-primary", primaryColor);

    // Update fallback logo background
    document.querySelectorAll(".clinic-logo-fallback").forEach((el) => {
      el.style.backgroundColor = primaryColor;
    });
  }
}
