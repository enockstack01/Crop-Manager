// ============================================================
// SUPABASE CONFIGURATION
// Replace these values with your actual Supabase project credentials
// Get them from: https://supabase.com/dashboard → Settings → API
// ============================================================

const SUPABASE_CONFIG = {
    url: 'https://tgzdtvlwisremkprwpqx.supabase.co',
    anonKey: 'sb_publishable_n5KqFc7zZuUf3bjLDRKNAA_CIph6eaF'
};

// Validate config on load
(function validateConfig() {
    if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL_HERE' ||
        SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
        console.warn(
            '%c⚠ CropManager: Supabase not configured.',
            'color: #F9A825; font-size: 14px; font-weight: bold;'
        );
        console.warn(
            '%cOpen js/config.js and replace the placeholder values with your Supabase URL and Anon Key.',
            'color: #546E7A; font-size: 12px;'
        );
    }
})();