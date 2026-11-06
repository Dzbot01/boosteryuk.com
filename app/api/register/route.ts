import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { hashPassword, isValidEmail } from '@/lib/auth';

export const runtime = 'nodejs';

// Register — WAJIB email valid + OTP benar. Password di-hash bcrypt (kompatibel data lama).
export async function POST(req: NextRequest) {
  try {
    const { username, email, password, otp } = await req.json();
    if (!username || !String(username).trim()) return NextResponse.json({ ok: false, message: 'Username wajib diisi.' });
    if (!isValidEmail(email)) return NextResponse.json({ ok: false, message: 'Email tidak valid.' });
    if (!password || String(password).length < 6) return NextResponse.json({ ok: false, message: 'Password minimal 6 karakter.' });
    if (!otp || !String(otp).trim()) return NextResponse.json({ ok: false, message: 'Kode OTP wajib diisi.' });

    // Verifikasi OTP
    const { data: row } = await supabaseAdmin.from('otp_codes').select('*').ilike('email', String(email).trim()).maybeSingle();
    if (!row || String(row.code) !== String(otp).trim()) return NextResponse.json({ ok: false, message: 'Kode OTP salah.' });
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ ok: false, message: 'Kode OTP kedaluwarsa.' });

    // Email unik
    const { data: exists } = await supabaseAdmin.from('users').select('id').ilike('email', String(email).trim()).maybeSingle();
    if (exists) return NextResponse.json({ ok: false, message: 'Email sudah terdaftar.' });

    const hash = await hashPassword(String(password));
    const { error } = await supabaseAdmin.from('users').insert({
      name: String(username).trim(), username: String(username).trim(), email: String(email).trim(),
      password: hash, role: 'user', plus_active: 0, balance: 0,
    });
    if (error) return NextResponse.json({ ok: false, message: 'Gagal daftar. Coba lagi.' });
    await supabaseAdmin.from('otp_codes').delete().ilike('email', String(email).trim());
    return NextResponse.json({ ok: true, message: 'Daftar berhasil! Silakan login.' });
  } catch {
    return NextResponse.json({ ok: false, message: 'Gagal konek ke server' }, { status: 500 });
  }
}
