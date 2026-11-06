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
