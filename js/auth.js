// js/auth.js

import { supabaseClient } from "./config.js";

export async function handleLogin(email, password) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) return error;
    return null; // Sukses
  } catch (err) {
    return err;
  }
}

export async function handleLogout() {
  try {
    // Clear semua localStorage
    localStorage.clear();

    // Sign out dari Supabase (abaikan error)
    await supabaseClient.auth.signOut().catch(() => {});

    // Reload halaman
    window.location.href = "/";
  } catch (err) {
    // Force reload
    window.location.href = "/";
  }
}

export async function checkSession() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    return session;
  } catch (err) {
    return null;
  }
}
