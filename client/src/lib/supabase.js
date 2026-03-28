import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.group("🔥 [CRITICAL] IDENTITY FAULT")
  console.error("Missing SUPABASE IDENTITY: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY")
  console.error("Ensure these are defined in your .env or CI/CD Environment Variables.")
  console.groupEnd()
}

// Global Production Error Tracking
if (import.meta.env.PROD) {
  window.onerror = function (msg, url, line, col, error) {
    console.error(`[GLOBAL_ERROR] ${msg} | AT: ${url}:${line}:${col}`, error);
  };
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})
