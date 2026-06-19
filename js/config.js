// js/config.js
// 1. Masukkan URL dan Key Supabase Anda di sini
const SUPABASE_URL = "https://weqjbnkihgjxzquwltro.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcWpibmtpaGdqeHpxdXdsdHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjQyMTksImV4cCI6MjA5NjQ0MDIxOX0.EV3ot5R3qWriGiZglo1gSAm3muZdV_hw_n2_zpPXjPQ";

// 2. Buat koneksinya
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. EXPORT agar bisa dipakai di file lain
export { supabaseClient };
