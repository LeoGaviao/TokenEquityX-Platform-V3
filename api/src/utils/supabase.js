const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error('FATAL: SUPABASE_URL environment variable is not set.');
}

const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.warn('[SUPABASE] No key configured — file uploads will fail');
}

const supabase = createClient(supabaseUrl, supabaseKey || 'missing-key');

module.exports = supabase;

// Also export a factory for creating clients with custom credentials
module.exports.createSupabaseClient = (url, key) => {
  return createClient(url, key);
};
