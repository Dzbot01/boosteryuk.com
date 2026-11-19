# Pengaturan Website & Request Withdraw Child Panel

## Deploy

1. Build dan deploy frontend (`npm ci` lalu `npm run build`).
2. Upload **php-api/child_panel.php** ke folder `/api` server, bersama `child_panel_lib.php` versi repo terbaru (dan konfigurasi server yang sudah ada). Jangan mengganti configdb/config berisi kredensial dengan file kosong.
3. Tidak perlu mengubah Worker, DNS, atau subdomain. Worker child panel tetap meneruskan header `X-Child-Panel`.
4. Tidak ada kolom baru: tabel `child_panel_withdrawals` sudah tersedia dan dibuat otomatis oleh `cp_ensure_schema()`. Bila membutuhkan command MySQL manual, gunakan bagian `CREATE TABLE IF NOT EXISTS child_panel_withdrawals` di **php-api/child_panel.sql**. Tidak ada DROP/TRUNCATE/migrasi destruktif.

## Perilaku

- Menu Upgrade disembunyikan dari side menu child panel, tetap ada di domain utama.
- Di `/panel-admin`, tombol **Pengaturan Website** memuat editor yang sama dengan paket EXTRA: nama, logo, brand/header/footer, tema/warna/ornamen, hero/slider, video, suara/musik, dan markup.
- Mode owner mengunci subdomain serta tidak menampilkan status/email pemilik. Endpoint `my_save` hanya menyimpan nama, markup, dan config; subdomain, status, dan pemilik tidak diambil dari input browser.
- Di subdomain, seluruh aksi `my_*` memilih panel pada host tersebut, bukan panel pertama milik akun. Host tidak aktif/tidak dikenal ditolak. Akun selain pemilik atau admin utama ditolak; tidak dialihkan diam-diam ke panel lain.
- Setelah simpan, ringkasan dimuat ulang dan tersedia tombol muat ulang untuk menerapkan brand/tema yang dicache selama sesi halaman.
- Pengajuan withdraw memakai pendapatan markup dan validasi saldo di server yang sudah ada (minimum, biaya admin, pesanan batal, masa tahan, satu request pending, transaksi/row lock).
- Request masuk ke tabel bersama di database PHP/MySQL. Admin utama membuka **Request Withdraw Child Panel** pada `/admin/withdraw`. Tabel berisi subdomain, email pemilik/pengaju, nominal bersih dan nominal awal, tanggal pembuatan server, tujuan pencairan, serta status/detail.
- Daftar otomatis diperbarui setiap 30 detik ketika halaman terlihat, dan dapat dimuat ulang manual. Modal detail mempertahankan fungsi tandai dibayar/tolak serta catatan.

## Checklist integrasi pada staging

Pengujian ini membutuhkan PHP + MySQL, akun login, dan Worker subdomain. Tidak cukup hanya dengan preview frontend.

1. Buka root domain sebagai user: Upgrade tetap tampil. Buka child panel: Upgrade tidak tampil, termasuk menu mobile/desktop.
2. Login pemilik pada child panel A, buka `/panel-admin` → Pengaturan Website. Ubah logo/tema/footer/slider dan simpan; muat ulang untuk melihat hasil. Pastikan alamat subdomain tidak berubah.
3. Coba POST `my_save` dengan subdomain/status/owner_user_id buatan: kolom tersebut harus tidak berubah.
4. Akun yang punya lebih dari satu panel: buka panel B, simpan pengaturan/unggah logo dan ajukan withdraw. Hanya panel B yang berubah/tercatat. Coba token bukan pemilik: respons 403. Host tidak aktif: 404.
5. Ajukan withdraw melebihi saldo / di bawah minimum: ditolak. Ajukan dua kali bersamaan: hanya satu pending tersimpan. Pengajuan valid mengurangi saldo tersedia dan tampil di riwayat pemilik.
6. Login admin utama di root domain → Request Withdraw Child Panel. Dalam 30 detik atau klik muat ulang, cek hostname, email, nominal, tanggal, metode/rekening dan atas nama sama dengan pengajuan.
7. Buka Detail: tandai dibayar hanya setelah transfer manual; atau tolak dengan alasan. Riwayat/status/saldo mengikuti. Token non-admin harus ditolak untuk `wd_list`, `wd_detail`, dan `wd_update`.

## Pemeriksaan lokal

- `npm run build`.
- `tsc --noEmit`: dua error baseline di DepositInvoicePage (unused method) dan PlaygroundPage (deklarasi ScrollExpand.jsx), tidak terkait perubahan ini.
- Sintaks child_panel.php dan child_panel_lib.php diparse dengan php-parser; runtime PHP/MySQL belum diuji di sandbox.
