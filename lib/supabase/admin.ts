import { createClient } from '@supabase/supabase-js';

// Client Supabase SERVER-SIDE memakai service role (SECRET_KEY). Hanya dipakai di API routes,
// tidak pernah dikirim ke browser. Nilai kunci diambil dari env (set di Vercel).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzvsjcjvnpasrwuuopeg.supabase.co';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
