# boosteryuk.com

Website Boosteryuk (SMM Panel) — **Next.js 15 (App Router) + Supabase**.
Hasil migrasi dari Vite/React SPA. Seluruh UI & logic dipertahankan; data auth/user dipindah
dari PHP ke Supabase lewat API route server-side (tidak mengubah logic auth).

## Menjalankan lokal
```bash
npm install
cp .env.example .env.local   # isi nilainya
npm run dev
```

## Variabel lingkungan (WAJIB di-set di Vercel)
| Env | Nilai | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dzvsjcjvnpasrwuuopeg.supabase.co` | PROJECT_URL (publik) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` | PUBLISHABLE_KEY (publik) |
| `SUPABASE_SERVICE_ROLE_KEY` | **(rahasia)** | SECRET_KEY — service role. WAJIB, hanya server. |
| `NEXT_PUBLIC_API_URL` | `https://boosteryuk.com/api` | Endpoint provider SMM lama (services/order/status/refill) |
| `OTP_WORKER_URL` | *(endpoint worker JobGmail)* | Dipakai API `/api/otp/request` untuk kirim email OTP |
| `NEXT_PUBLIC_SITE_URL` | `https://boosteryuk.com` | Untuk metadata Open Graph |

## Arsitektur
- `app/[[...slug]]/page.tsx` → merender `src/ClientApp.tsx` (React Router SPA, client-only).
- `app/layout.tsx` → metadata Open Graph (preview WhatsApp, server-rendered).
- `app/api/*` → route server-side Supabase: `login`, `register`, `me`, `update_user`,
  `otp/request`, `riwayat_pesanan`.
- `lib/auth.ts` → bcrypt (kompatibel hash `$2y$` lama) + token di tabel `sessions`.

## Catatan
- Endpoint provider SMM (services/order/status/refill) **tetap** memakai backend lama
  (bukan data DB). Hanya data DB (auth/user/history) yang dipindah ke Supabase.
- Tabel baru: `otp_codes` (verifikasi OTP register).
