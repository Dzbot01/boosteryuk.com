import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { verifyPassword, createSession, mapUser, type DbUser } from '@/lib/auth';

export const runtime = 'nodejs';

// Login — logika sama seperti login.php lama: cek email+password (bcrypt) lalu buat sesi/token.
export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ ok: false, message: 'Email dan password wajib diisi.' });
    const { data: user } = await supabaseAdmin
      .from('users').select('*').ilike('email', String(email).trim()).maybeSingle();
    if (!user) return NextResponse.json({ ok: false, message: 'Email atau password salah.' });
    const valid = await verifyPassword(String(password), (user as DbUser).password);
    if (!valid) return NextResponse.json({ ok: false, message: 'Email atau password salah.' });
    const token = await createSession((user as DbUser).id);
    return NextResponse.json({ ok: true, token, user: mapUser(user as DbUser) });
  } catch {
    return NextResponse.json({ ok: false, message: 'Gagal konek ke server' }, { status: 500 });
  }
}
