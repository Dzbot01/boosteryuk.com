import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isValidEmail } from '@/lib/auth';

export const runtime = 'nodejs';

// Minta OTP — simpan kode di Supabase lalu panggil worker JobGmail untuk mengirim email.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!isValidEmail(email)) return NextResponse.json({ ok: false, message: 'Email tidak valid.' });
    const clean = String(email).trim();
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 10 * 60_000).toISOString();
    const { error: upErr } = await supabaseAdmin.from('otp_codes').upsert({ email: clean, code, expires_at: expires }, { onConflict: 'email' });
    if (upErr) return NextResponse.json({ ok: false, message: 'Gagal membuat OTP (cek konfigurasi Supabase).' }, { status: 500 });

    const worker = process.env.OTP_WORKER_URL;
    let sent = false;
    if (worker) {
      try {
        const r = await fetch(worker, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // Field dibuat selengkap mungkin agar cocok dgn kontrak worker JobGmail.
          body: JSON.stringify({
            to: clean, email: clean, code, otp: code,
            subject: 'Kode OTP Boosteryuk',
            message: `Kode OTP pendaftaran Boosteryuk kamu: ${code}. Berlaku 10 menit.`,
          }),
        });
        sent = r.ok;
      } catch { sent = false; }
    }
    return NextResponse.json({ ok: true, sent, message: sent ? 'Kode OTP dikirim ke email.' : 'OTP dibuat; worker email belum dikonfigurasi (set OTP_WORKER_URL).' });
  } catch {
    return NextResponse.json({ ok: false, message: 'Gagal konek ke server' }, { status: 500 });
  }
}
