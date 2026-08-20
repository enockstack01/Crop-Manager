// ============================================================
// SUPABASE CLIENT INITIALIZATION
// ============================================================

const supabaseClient = window.supabase.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
);

// Convenience alias
const db = supabaseClient;