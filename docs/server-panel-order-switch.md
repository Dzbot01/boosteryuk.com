# Server Panel — API yang benar-benar dipakai + tutup akses order per server

## Daftar API (halaman admin `Server Panel`)

Halaman ini sebelumnya menampilkan beberapa provider yang **tidak dipanggil berkas mana pun**.
Sekarang hanya API yang benar-benar dipakai yang ditampilkan, dipetakan dari `php-api/*_lib.php`
dan `src/supabase.ts`:

| server internal | provider | API | dipakai oleh | pilihan user |
| --- | --- | --- | --- | --- |
| 1 | Fayupedia | `https://fayupedia.id/api/services` (`$BASE_URL` di `config.php`) | `order.php`, `order_price.php`, `status.php`, `refill.php` | Server 1 — Ringkas & Stabil |
| 2 | Naizop | `https://naizop.com/api/v2` | `naizop_lib.php`, `naizop_services.php`, `naizop_status.php` | Server 2 — Baru · Layanan Lebih Lengkap |
| 3 | Medanpedia | `https://api.medanpedia.co.id` | `medanpedia_lib.php`, `medanpedia_services.php`, `order.php` (server 3) | layanan Google Maps Review yang digabung ke daftar Server 1 (id ber-prefix `M3:`) |
| 4 | SMMGen | `https://my.smmgen.com/api/v2` | `smmgen_lib.php`, `smmgen_services.php`, `smmgen_status.php`, `smmgen_refill.php` | Server 3 — Lengkap & Murah |

Dihapus dari daftar: `irvankedesmm.co.id`, `indosmm.id`, `djuragansosmed.com`.

Nama provider hanya muncul di halaman admin ini (dan di komentar kode/berkas `*_lib.php`). Label,
pesan, dan pilihan yang dilihat user tetap memakai nama "Server 1/2/3" tanpa menyebut provider.

## Tutup / buka akses order per server

Admin bisa menutup sementara pemesanan di satu server (misalnya provider sedang gangguan atau
saldo habis). Saat ditutup:

1. **Server menolak** — `order.php` memeriksa `closedServers` sebelum menghitung harga dan sebelum
   saldo dipotong, lalu membalas `403`:
   `Server yang Anda pilih sedang ditutup sementara oleh admin. Silakan pilih server lain.`
   Berlaku untuk semua jalur order (web utama maupun child panel) karena semuanya lewat `order.php`.
2. **Pilihan hilang dari form order** — `BuatPesananCard.tsx` menyaring `SERVER_CHOICES`, jadi
   server yang ditutup tidak muncul di dropdown. Bila server yang sedang terpilih baru ditutup,
   pesanan dialihkan otomatis ke server lain yang masih terbuka (dengan keterangan).
3. **Layanan ikut disembunyikan** — daftar layanan disaring per `source`, sehingga layanan
   `M3:` (Medanpedia) di dalam daftar Server 1 hilang saat server 3 internal ditutup.

Pesanan yang sudah masuk tidak terpengaruh: status, refill, dan riwayat tetap berjalan seperti biasa.

## Penyimpanan

Disimpan sebagai kunci bersama `closedServers` (array nomor server internal, maksimal 4) di
pengaturan website:

- `php-api/site_settings.php` — kunci masuk whitelist POST (hanya `'1'..'4'`, maksimal 4 nilai) dan
  digabung ke baris `site` di tabel `site_settings`. GET publik mengembalikannya ke semua pengunjung.
- `src/context/SiteSettingsContext.tsx` — `closedServers` ada di `SHARED_KEYS` + `DEFAULTS`
  (`[]` = semua server terbuka). Daftar kosong dari server tetap dipakai agar "buka kembali"
  langsung terlihat di semua perangkat.
- `src/pages/admin/AdminServerPage.tsx` — tombol **Tutup order** / **Buka order** per baris API
  (dengan konfirmasi), badge "Order ditutup", status ping, dan status penyimpanan.

Tidak ada tabel baru dan tidak perlu SQL.

## File yang perlu diupload ke `/api`

- `order.php` (diperbarui — penolakan server yang ditutup)
- `site_settings.php` (diperbarui — whitelist `closedServers`)

Frontend: `npm run build` lalu upload `dist/`.
