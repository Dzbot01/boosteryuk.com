import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { userFromToken } from '@/lib/auth';

export const runtime = 'nodejs';

// Riwayat pesanan user dari Supabase (tabel riwayat_pesanan).
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  const user = await userFromToken(token);
  if (!user) return NextResponse.json({ ok: false, data: [] }, { status: 401 });
  const { data } = await supabaseAdmin
    .from('riwayat_pesanan').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  return NextResponse.json({ ok: true, data: data || [] });
}
