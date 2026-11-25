# Sync status pesanan otomatis + penilaian & ulasan (banner, Beri Penilaian, Papan Penilaian)

## 1. Status pesanan tidak lagi menunggu admin

- **Seketika setelah order tersimpan** (`order.php` langkah 6z): `osx_sync_order()` memanggil
  provider pemilik ID (`angka` = Server 1, `S2-` Naizop, `S3-` Medanpedia, `S4-` SMMGen) dan
  menggeser status riwayat `pending` → `proses` / `selesai` / `batal` sesuai keadaan asli.
  Respons order kini menyertakan `status` terbaru.
- **Pengecekan otomatis 1 jam sekali** tanpa cron: `osx_maybe_run()` (pola sama dengan
  `data_retention_lib` / `agent_reminder`) dipicu sesudah respons `order.php` dan
  `riwayat_pesanan.php` (`fastcgi_finish_request`/flush dulu agar user tidak menunggu).
  Sweep menyinkronkan maksimal 50 pesanan `pending`/`proses` terbaru, sekali per jam lewat
  tabel `order_status_sweep_log`.
- Pemetaan status provider: `completed/…` → `selesai`; `canceled/cancelled/refunded/…` →
  `batal`; `pending/processing/in progress/partial/…` → `proses`. Respons tak dikenal atau
  provider diam = status dibiarkan, dicoba lagi jam berikutnya.

## 2. Order gagal karena saldo provider = tetap profesional

- Bila pengiriman ke Server 1 tidak pasti (termasuk **saldo provider kurang**), user melihat
  order **sukses**: `Order berhasil masuk antrian. Status akan diperbarui otomatis.` dengan
  status `pending` dan ID unik berslug `PENDING-` (`time-user-rand`). Tidak ada pesan saldo
  provider ke user; alasan asli hanya masuk `order_pending_log.txt` (server).
- ID slug `PENDING-` (juga `S2/S3/S4-PENDING-`)**tidak pernah dicek ke provider**:
  `osx_provider_of()` = null dan query sweep memakai `NOT LIKE '%PENDING-%'` — rekonsiliasi
  tetap manual oleh admin seperti sebelumnya.

## 3. Banner "Pesanan #… sudah selesai"

- `OrderReviewBanner` dipasang di `Layout` (semua halaman). Sumber data: `reviews.php`
  action `pending` = pesanan `selesai` milik user yang belum dinilai.
- Posisi: **mobile** di bawah header (`top-[76px]`), **desktop** di layar bagian atas
  (`md:top-4`). Teks: *Pesanan #<id> sudah selesai. Bagaimana pendapatmu? Beri penilaian
  **disini*** — "disini" bergaris bawah menuju `/beri-penilaian?order=<id>`.
- Banner tetap muncul sampai user menutupnya lewat tombol silang kecil pojok kanan atas;
  penutupan disimpan per ID di `localStorage['by-review-banner-dismissed']`. Dicek ulang
  tiap 60 detik mengikuti sync status otomatis.

## 4. Halaman Beri Penilaian (`/beri-penilaian`, login)

Kartu modal: bintang 1–5 → komentar cepat sesuai ekspresi bintang:

| bintang | komentar cepat |
| --- | --- |
| 1–2 | Pengiriman Lama, Drop |
| 3 | Pengiriman Lama, Non Drop |
| 4–5 | Pengiriman Cepat, Non Drop, Rekomendasi |

Chip mengisi kolom ulasan (bisa ditambah teks bebas, maks 500 karakter). Submit menyimpan ke
`service_reviews` (satu penilaian per pesanan) lalu user **otomatis diarahkan ke `/overview`**.

## 5. Papan Penilaian (`/papan-penilaian`, menu SideMenu)

Tabel kartu modal: **Username, Bintang, Layanan, Ulasan** + kolom **Aksi** berisi ikon
keranjang emerald yang sama seperti di Overview (`/layanan?service=<service_key>`).
`service_name` dicatat server saat penilaian dibuat sehingga papan **tidak memanggil API
provider berulang kali** (logika sama dengan layanan Google Maps Review di dashboard);
`service_key` diambil dari `smm_order_profit` bila ada.

## File baru / berubah

- Baru: `php-api/order_status_lib.php`, `php-api/reviews.php`, `php-api/reviews.sql`,
  `src/services/reviewsApi.ts`, `src/components/OrderReviewBanner.tsx`,
  `src/pages/ReviewSubmitPage.tsx`, `src/pages/ReviewBoardPage.tsx`.
- Berubah: `php-api/order.php` (sync seketika, pesan profesional, sweep),
  `php-api/riwayat_pesanan.php` (sweep setelah respons), `src/components/Layout.tsx`
  (banner), `src/App.tsx` (route), `src/components/SideMenu.tsx` (menu Papan Penilaian).

## Upload

- `/api`: `order.php`, `riwayat_pesanan.php`, `order_status_lib.php`, `reviews.php`
  (+ opsional jalankan `reviews.sql`).
- Frontend: `npm run build` lalu upload `dist/`.
