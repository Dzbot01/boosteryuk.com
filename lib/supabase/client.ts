import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dzvsjcjvnpasrwuuopeg.supabase.co';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_18Imj32yJhlzmuLKM7aYaQ_G_5HjeO_';

export const supabase = createClient(url, anon, { auth: { persistSession: false } });
