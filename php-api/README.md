# Playground backend (PHP)

File proxy untuk fitur **Playground**. Upload ke server PHP yang melayani
`https://boosteryuk.com/api/` (lokasi yang sama dengan `register.php`).

| File      | URL produksi                          | Fungsi                                   |
|-----------|---------------------------------------|------------------------------------------|
| `ai.php`  | `https://boosteryuk.com/api/ai.php`   | Hook Generator & Auto Caption (siputzx)  |
| `tts.php` | `https://boosteryuk.com/api/tts.php`  | Teks To Speech (ElevenLabs)              |

## 1. ElevenLabs API key (WAJIB untuk Teks To Speech)

Key **tidak boleh** ada di kode frontend / browser. Set di server, salah satu:

- **Environment variable** (disarankan):
  ```
  ELEVENLABS_API_KEY=xi-xxxxxxxxxxxxxxxx
  ```
  (cPanel: Setup → Environment Variables; atau tambahkan `SetEnv ELEVENLABS_API_KEY ...`
  di `.htaccess` folder `api/`.)

- **atau** buat file `api/tts_config.php` (JANGAN di-commit):
  ```php
  <?php return ['key' => 'xi-xxxxxxxxxxxxxxxx'];
  ```

Uji: buka `https://boosteryuk.com/api/tts.php?action=models` → harus muncul daftar model.

## 2. Coba VPS (web-SSH)

Frontend memakai konstanta `WEBSSH_URL` di `src/services/playgroundApi.ts`.
Jalankan layanan web-SSH di VPS lalu isi URL-nya, contоh dengan **ttyd**:

```bash
# di VPS (auto login sebagai root)
ttyd -p 7681 -W bash        # atau: ttyd -p 7681 login
# amankan dengan reverse proxy HTTPS (nginx) -> https://vps.domain/terminal
```

Lalu set di frontend:
```ts
export const WEBSSH_URL = 'https://vps.domain/terminal';
```

> Catatan keamanan: batasi akses web-SSH (auth/token, IP allowlist) karena memberi
> shell root. Jangan taruh kredensial SSH di frontend.

## 3. Kuota download TTS

Dibatasi **7×/minggu per user** (hanya user terdaftar yang bisa download).
Saat ini dihitung di sisi klien (localStorage). Untuk anti-manipulasi, pindahkan
perhitungan kuota ke server (mis. tabel `tts_quota` di DB) pada iterasi berikutnya.

## Pengaturan website (Berita Overview, Favicon, teks Brand/Overview) — `site_settings.php`

Disimpan di MySQL agar sama untuk **semua pengunjung** (bukan lagi localStorage per-browser).

1. Upload `site_settings.php` ke folder `/api` (satu folder dengan `configdb.php`).
   Koneksi diambil otomatis dari `configdb.php` (`$conn`). Tidak perlu `me.php`.
2. Buat tabel: jalankan `site_settings.sql` di phpMyAdmin (opsional — tabel juga dibuat
   otomatis saat endpoint pertama kali diakses).
3. Tes: buka `https://boosteryuk.com/api/site_settings.php` → `{"ok":true,"settings":{...}}`.

Simpan (POST) hanya untuk **admin**: token dicek di tabel `sessions` (pakai
`getUserIdByToken()` dari configdb.php) lalu `users.role = 'admin'`.

## Order Sewa Agen AI — `agent_order.php`

Saldo user dipotong **di database** (bukan hanya di UI), pola sama seperti `order.php`.

1. Upload `agent_order.php` + `agent.php` (versi terbaru) ke `/api`. `order.php` tidak diubah.
2. Alur: token → `users` → harga dihitung server (`starter` 10.000, `medium` 35.000,
   `bisnis` 75.000 × bulan 1–12; harga dari klien diabaikan) →
   `UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?` (atomik) →
   insert `riwayat_pesanan` (`AI<timestamp>`, "Agen AI WhatsApp <Paket> - Jatuh tempo ...") →
   panggil VPS `/session`. Jika VPS gagal → saldo **dikembalikan** & riwayat `batal`.
3. Respon: `{ok, orderId, new_balance, ...}` — UI memakai `new_balance` dari server.
4. `agent.php?action=create` kini ditolak (410); `status`/`resend` wajib token pemilik order.

Kartu Overview "Server VPS Aktif" & "AI Agent Aktif" dihitung dari `riwayat_pesanan.php`
(status ≠ batal, agen yang lewat jatuh tempo tidak dihitung).

## Kolom tambahan `riwayat_pesanan` (pesanan non-SMM) — `riwayat_schema.php`

| Kolom | Tipe | Isi |
|---|---|---|
| `order_type` | VARCHAR(20) default `smm` | `smm` / `agent_ai` / `vps` |
| `paket` | VARCHAR(50) NULL | Starter / Medium / Bisnis / paket VPS |
| `durasi_bulan` | TINYINT NULL | lama sewa |
| `jatuh_tempo` | DATETIME NULL | akhir masa aktif |
| `target` | VARCHAR(100) NULL | nomor WhatsApp agen / hostname VPS |
| `detail` | TEXT NULL | JSON (nama AI, platform, tier) |
| `updated_at` | TIMESTAMP NULL | otomatis saat status berubah |

Pesanan SMM (order.php / riwayat_pesanan.php) **tidak berubah** — kolom baru boleh NULL.
Kolom ditambahkan otomatis saat `agent_order.php`/`order_stats.php` pertama dipanggil, atau
jalankan manual `riwayat_pesanan_migration.sql`. Saat WhatsApp agen tertaut, `agent.php?action=status`
mengubah status `proses` → `selesai`.

## Statistik Overview per user — `order_stats.php`

`GET /api/order_stats.php?token=...` → `{ok, bulan_ini, jumlah_bulan_ini, vps_aktif, agent_aktif, layanan[]}`.
Dihitung dari `riwayat_pesanan` milik user yang login (status ≠ batal; bulan berjalan; layanan aktif =
belum lewat `jatuh_tempo`). Overview tidak lagi memakai riwayat lokal browser.

## Halaman "Agen AI Saya" — `my_agents.php`

`GET /api/my_agents.php?token=...` → daftar Agen AI milik user: paket, status (`aktif` / `menunggu` /
`kedaluwarsa`), harga, durasi, tanggal beli, jatuh tempo, sisa hari, dan data form order
(nama AI, nomor pemilik/bot, nama toko, alamat e-wallet, payment gateway).
Data form disimpan `agent_order.php` di kolom `detail` (JSON). Pesanan lama yang dibuat
sebelum update ini tidak punya data form, jadi tampil "—".

## Email pengingat jatuh tempo — `agent_reminder.php` (tanpa cron job)

Tahap email dihitung dari **jumlah hari menuju jatuh tempo**: H-7, H-3, H-1, dan hari H,
dikirim pukul 09:00 WIB. Tidak ada cron job / proses yang standby.

1. **Saat order dibuat** (`agent_order.php`): tiap tahap yang waktunya ≤ 30 hari ke depan langsung
   **dijadwalkan di Resend** (`scheduled_at`) — Resend yang mengirim pada harinya.
2. Tahap yang masih > 30 hari lagi (sewa ≥ 2 bulan; batas jadwal Resend 30 hari) dijadwalkan saat
   **user itu sendiri** membuka Overview / Agen AI Saya (hanya agen milik user tsb yang dicek).
   Tahap yang waktunya sudah lewat & belum terkirim dikirim saat itu juga.

Wajib untuk penjadwalan: isi `'resend_key' => 're_...'` di `agent_config.php` di server
(API key Resend yang sama dengan di order.php — **jangan di-commit ke GitHub**).
Tanpa key, email hanya dikirim (lewat worker email) ketika harinya sudah tiba dan user membuka
Overview / Agen AI Saya. Setiap tahap tercatat sekali di tabel `agent_reminder_log` (dibuat otomatis).

## Tema website — `site_settings.php`

Admin → Pengaturan Website → **Tema Website**: gambar hero dashboard, warna aksen brand, warna kartu
header (tetap transparan + blur), warna tombol aktif side menu, dan aksesoris menggantung di bawah
header (ketupat, lentera, lampion, bendera, dll — aset di `public/ornaments/`).
Warna & aksesoris disimpan di baris `site`; gambar hero disimpan terpisah di baris `asset_hero` dan
disajikan lewat `site_settings.php?asset=hero&v=<versi>` (cache 1 tahun) agar JSON pengaturan tetap kecil.

## Child Panel (subdomain reseller) — `child_panel.php`, `child_panel_lib.php`

Alur: `toko1.boosteryuk.com` → Cloudflare Worker (repo Boosteryuk, route `*.boosteryuk.com/*`) →
`boosteryuk.com` + header `X-Child-Panel: toko1` → `cp_resolve()` mencari `child_panel_domains.hostname`
→ konfigurasi panel (`child_panels`). Subdomain **cukup didaftarkan di database** lewat Admin → Child Panel
(DNS wildcard sudah mengarahkan semua subdomain).

| Tabel | Isi |
|---|---|
| `child_panels` | nama, status, pemilik (`owner_user_id` = admin ke-2), markup SMM/Agen AI %, `config` JSON (brand, warna, footer, slider, voice, video) |
| `child_panel_domains` | hostname → panel (UNIK) |
| `child_panel_assets` | logo, hero, thumbnail video, gambar slider (disajikan `?asset=<id>-<slot>`) |
| `child_panel_orders` | pesanan dari panel: harga dibayar, harga asli, **pendapatan (markup)** |
| `child_panel_activity` | aktivitas user per panel (kunjungan, terakhir aktif, aksi terakhir) |

Semua tabel dibuat otomatis (atau jalankan `child_panel.sql`).

- **Markup**: Agen AI dihitung di server (`agent_order.php`). SMM: harga tampil di panel sudah + markup;
  `order.php` perlu memakai `cp_apply_markup()` agar harga final juga dihitung server (lihat catatan di bawah).
- **Admin ke-2**: pemilik panel (email diisi admin utama) membuka **Menu → Admin Panel Toko** di subdomain
  (`/panel-admin`): ringkasan pendapatan, pesanan terbaru, aktivitas user, ubah markup. Role akun TIDAK
  diubah menjadi `admin` (tidak punya akses ke admin panel utama).
- **Video dashboard panel**: bawaan tidak ada. Upload langsung dari browser admin ke Supabase Storage
  (bucket `publik/childpanel/`) memakai signed upload URL. Isi `supabase_service_key` di
  `child_panel_config.php` di server (jangan di-commit).

Catatan `order.php` (belum diubah): agar markup SMM tidak bisa dilewati, harga yang dipotong di
`order.php` sebaiknya dihitung ulang di server: `require_once 'child_panel_lib.php';
$tenant = cp_resolve($conn); $price = cp_apply_markup($hargaDasar, $tenant, 'smm');` lalu catat
`cp_record_order(...)`. Kirim file order.php untuk dipasangkan.

## Batas tautan 10 menit + refund otomatis — `agent_lifecycle.php`

- VPS (`server.js` bot Paimon) menghentikan bot sewa bila nomor belum tertaut dalam 10 menit
  (`AGENT_PAIR_TIMEOUT_MIN`) → status `expired`, tidak ada kode pairing baru.
- PHP mengembalikan saldo **di database** (atomik, sekali per order): `riwayat_pesanan` → `batal`,
  `users.balance += harga`. Dipicu oleh `agent.php?action=status` (halaman pairing, membalas
  `refunded` + `new_balance`) serta `my_agents.php` / `order_stats.php` (bila halaman pairing sudah ditutup).
- Status lain / 404 (mis. agen lama) TIDAK pernah di-refund.
- Order agen dianggap sukses hanya setelah tertaut (`selesai`). Pendapatan child panel dicatat pada saat itu,
  bukan saat tombol pesan diklik. Kartu "AI Agent Aktif" hanya menghitung agen yang sudah tertaut.

## Paket Upgrade (Plus & EXTRA) — `plan_upgrade.php`, `plan_config.php`

Menggantikan `upgrade.php` lama (yang menerima `user_id` tanpa token — siapa pun bisa memotong saldo
akun lain; sebaiknya file itu dihapus dari server).

- **Plus**: sekali bayar (bawaan Rp 5.000) → harga reseller selamanya + badge reseller.
- **EXTRA**: Rp 20.000/bulan, bulan pertama Rp 10.000 untuk user yang belum pernah berlangganan EXTRA.
  Termasuk Plus selamanya + Child Panel (dibuat otomatis saat checkout dari subdomain yang diisi user,
  pemilik = user, masa aktif = masa EXTRA) + Full Support. Perpanjangan menambah 1 bulan dan ikut
  memperpanjang child panel. Panel buatan admin (tanpa masa aktif) tidak diberi batas waktu.
- Token dicek di `sessions`, harga dari `plan_config.php`, saldo dipotong atomik. Kolom `users.plus_active`
  ikut diisi agar `me.php`/`order.php` mengenali Plus. Tabel `user_plans` + kolom `child_panels.expires_at`
  dibuat otomatis. Transaksi tercatat di `riwayat_pesanan` (order_type `plan`).
