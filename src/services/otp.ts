// Pengiriman OTP email via Cloudflare Worker (Resend). Dipakai di register & verifikasi email.
const OTP_WORKER = 'https://boosteryuk.boosteryukid.workers.dev/api/email/send';

export function genOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

function otpHtml(code: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#0e7490">Kode OTP Boosteryuk</h2>
    <p>Gunakan kode berikut untuk verifikasi akun kamu:</p>
    <p style="font-size:30px;font-weight:bold;letter-spacing:6px;color:#111">${code}</p>
    <p style="color:#666">Kode berlaku 10 menit. Jangan bagikan ke siapa pun.</p>
  </div>`;
}

/** Kirim kode OTP ke email lewat worker. from default = noreply@cekidku.my.id (diset di worker). */
export async function sendOtpEmail(to: string, code: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(OTP_WORKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Boosteryuk <noreply@cekidku.my.id>',
        to,
        subject: 'Kode OTP Boosteryuk',
        html: otpHtml(code),
      }),
    });
    if (!res.ok) {
      let msg = 'Gagal mengirim OTP.';
      try { const j = await res.json(); msg = typeof j.error === 'string' ? j.error : msg; } catch { /* abaikan */ }
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Gagal terhubung ke server OTP.' };
  }
}

/* ---------------- Rate limit minta OTP (register) ----------------
   Aturan: 2 permintaan pertama diizinkan; setelah ke-2 cooldown 10 menit;
   setelah ke-3 cooldown 24 jam. Disimpan per-email di localStorage. */
type RL = { attempts: number; blockedUntil: number };
const RL_KEY = (email: string) => `by_otp_rl:${email.trim().toLowerCase()}`;

function readRL(email: string): RL {
  try {
    const r = JSON.parse(localStorage.getItem(RL_KEY(email)) || '');
    if (r && typeof r.attempts === 'number' && typeof r.blockedUntil === 'number') return r;
  } catch { /* abaikan */ }
  return { attempts: 0, blockedUntil: 0 };
}
function writeRL(email: string, rl: RL) {
  try { localStorage.setItem(RL_KEY(email), JSON.stringify(rl)); } catch { /* abaikan */ }
}
function fmtWait(ms: number): string {
  const menit = Math.ceil(ms / 60000);
  return menit >= 60 ? `${Math.ceil(menit / 60)} jam` : `${menit} menit`;
}

/** Cek apakah boleh minta OTP sekarang. */
export function otpRateCheck(email: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  let rl = readRL(email);
  if (rl.attempts >= 3 && now >= rl.blockedUntil) rl = { attempts: 0, blockedUntil: 0 }; // siklus 24 jam selesai
  if (now < rl.blockedUntil) {
    return { allowed: false, message: `Terlalu banyak permintaan OTP. Coba lagi dalam ${fmtWait(rl.blockedUntil - now)}.` };
  }
  return { allowed: true };
}

/** Catat 1 permintaan OTP sukses & terapkan cooldown sesuai aturan. */
export function otpRateRecord(email: string): void {
  const now = Date.now();
  let rl = readRL(email);
  if (rl.attempts >= 3 && now >= rl.blockedUntil) rl = { attempts: 0, blockedUntil: 0 };
  rl.attempts += 1;
  if (rl.attempts >= 3) rl.blockedUntil = now + 24 * 60 * 60 * 1000;      // ke-3: 24 jam
  else if (rl.attempts === 2) rl.blockedUntil = now + 10 * 60 * 1000;     // ke-2: 10 menit
  writeRL(email, rl);
}
