import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { userFromToken, hashPassword, isValidEmail } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const user = await userFromToken(token);
    if (!user) return NextResponse.json({ ok: false, message: 'Belum login' }, { status: 401 });
    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (body.name) update.name = String(body.name).trim();
    if (body.username) update.username = String(body.username).trim();
    if (body.email) {
      if (!isValidEmail(body.email)) return NextResponse.json({ ok: false, message: 'Email tidak valid.' });
      update.email = String(body.email).trim();
    }
    if (body.password) {
      if (String(body.password).length < 6) return NextResponse.json({ ok: false, message: 'Password minimal 6 karakter.' });
      update.password = await hashPassword(String(body.password));
    }
    if (Object.keys(update).length === 0) return NextResponse.json({ ok: false, message: 'Tidak ada perubahan.' });
    const { error } = await supabaseAdmin.from('users').update(update).eq('id', user.id);
    if (error) return NextResponse.json({ ok: false, message: 'Gagal menyimpan.' });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: 'Gagal konek ke server' }, { status: 500 });
  }
}
