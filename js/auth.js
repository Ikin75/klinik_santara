// js/auth.js
// 1. IMPORT koneksi database dari laci config
import { supabaseClient } from "./config.js";

// 2. Fungsi Login
export async function handleLogin(email, password) {
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password,
  });
  return error;
}

// 3. Fungsi Logout
export async function handleLogout() {
  await supabaseClient.auth.signOut({ scope: "local" });
}

// 4. Cek siapa yang sedang login
export async function checkSession() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session;
}
