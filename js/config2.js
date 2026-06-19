// js/config.js
export const SUPABASE_URL = "https://weqjbnkihgjxzquwltro.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlcWpibmtpaGdqeHpxdXdsdHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjQyMTksImV4cCI6MjA5NjQ0MDIxOX0.EV3ot5R3qWriGiZglo1gSAm3muZdV_hw_n2_zpPXjPQ"; // <-- GANTI INI!

export const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);
