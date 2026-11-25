# Order Nomor OTP di root domain + pendapatan OTP di My Profit

## Yang diminta

- Menu & halaman **Order Nomor (OTP)** tampil di **root domain** (bukan hanya child panel),
  dengan UI yang sama.
- Pendapatan OTP tercatat di halaman **My Profit** admin.

## Menu & halaman

- `src/components/SideMenu.tsx` — item `nokos` ("Order Nomor", ikon Smartphone) kini disusun
  tanpa syarat child panel: tampil di root domain maupun child panel, tepat setelah grup
  Deposit/Payment dan sebelum Riwayat Pesanan. Sebelum login menu disembunyikan karena
  halamannya memang butuh login (`AUTH_REQUIRED`).
- Route `/otp-service` → `OrderOtpPage` sudah global (root + child); halaman tidak mengunci
  diri ke child panel (`CHILD_PANEL_SUB` hanya dipakai untuk menyebut domain panel pada teks).
- Halaman Order Nomor versi lama (`OrderNomorPage`/`OrderNomorGuidePage`) tetap disembunyikan.

## Pendapatan OTP di My Profit

`php-api/admin_data.php` (aksi `profit`) menambahkan komponen `income.otp`:

- sumber: tabel `otp_orders`, hanya `status='selesai' AND refunded=0`;
- margin per order = `base_price − max_usd × kurs` (harga jual web utama dikurangi batas biaya
  provider dalam USD × kurs dari `otp_config.php`, fallback 17000 sama dengan `otp.php`);
  dibulatkan ke bawah lewat `max(0, …)` agar tidak pernah negatif;
- **markup child panel** (`price − base_price`) tetap milik pemilik panel (sudah tercatat di
  `child_panel_orders`) → tidak dihitung sebagai penghasilan web utama;
- periode hari ini / bulan ini / total memakai `created_at` order, sama seperti komponen lain;
- total `income.today/month/all` kini menjumlah `otp` juga.

Frontend:

- `src/services/adminDataApi.ts` — `ProfitData.income.otp: Period & { orders }`.
- `src/pages/admin/AdminProfitPage.tsx` — kartu Penghasilan menambah baris
  "· dari Order OTP (bulan ini)" dan "Order OTP (total)" (`N order selesai · rupiah`),
  dengan fallback `0` bila server lama belum mengirim field tersebut.

Omzet OTP tetap muncul seperti sebelumnya di kartu "Data transaksi" (grup
"Agen AI, NexSpace, OTP, Upgrade") — yang baru adalah **margin**nya di kartu Penghasilan.

## Uji

`scripts/test-otp-root-profit.mjs`: sintaks PHP, regex backend/frontend, perilaku
`getUserMenuItems` (root login/belum login/child/admin), dan render jsdom kartu Penghasilan
dengan mock `income.otp` (baris + angka + total kartu menjumlah OTP).

## Upload

- `/api`: `admin_data.php`.
- Frontend: `npm run build` lalu upload `dist/`.
