# Event global dan ikon mengambang

## Deploy

1. Build/deploy frontend terbaru.
2. Upload `php-api/events.php` ke `/api`, bersama `configdb.php` server dan `child_panel_lib.php` terbaru yang sudah ada. Jangan mengganti kredensial server.
3. Jalankan `php-api/events.sql` bila ingin menyiapkan tabel manual. Endpoint juga membuat tabel otomatis bila akun database punya izin CREATE. SQL memakai CREATE IF NOT EXISTS dan INSERT IGNORE, tidak menimpa event yang sudah diubah.
4. Child panel memakai API melalui proxy existing. GET publik tersedia untuk semua pengunjung; POST daftar admin/simpan membutuhkan token role admin dari DB, dan ditolak jika ada header X-Child-Panel. Form admin juga dibatasi pada root domain.

## Perilaku

- Halaman publik `/event`: Berlangsung, Akan hadir / Coming soon, Selesai. Event berlangsung/selesai dapat dibuka dalam modal. Card coming soon hanya abu-abu + ikon tanda tanya di tengah, tanpa judul/deskripsi dan tanpa interaksi klik. API publik ikut menyembunyikan judul/deskripsi kategori tersebut.
- Seed: Hitung mundur tahun baru, akhir **1 Januari 2027, 00.00 WIB** (`2026-12-31 17:00:00` UTC), serta satu card coming soon kosong. Tidak ada data event fiktif di frontend saat API gagal.
- Admin root `/admin/events` melalui menu Kelola Event pada sidebar/dashboard: tambah/ubah judul, deskripsi, jenis (informasi/hitung mundur), status, waktu mulai dan batas akhir. Tidak ada penghapusan event pada versi ini; riwayat dapat dipertahankan sebagai Selesai.
- Form waktu WIB (UTC+7), request ISO UTC, database UTC. Hitung mundur wajib punya batas akhir; akhir harus setelah mulai. Status Selesai diprioritaskan. Selain itu, batas akhir terlewat -> Selesai; waktu mulai di masa depan -> Akan hadir, waktu mulai terlewat -> Berlangsung. Tanpa jadwal, status sepenuhnya manual. Untuk membuka kembali event selesai, ubah status dan batas akhir yang telah lewat.
- Halaman publik memuat ulang data setiap 30 detik ketika tab terlihat. Hitung mundur dan perpindahan kategori dihitung setiap detik, dengan offset waktu server untuk mengurangi pengaruh jam browser yang tidak tepat. Tidak memerlukan cron.
- Ikon Event muncul di bagian bawah layar secara default pada semua halaman dalam Layout (root, child, dan admin). **Halaman transport OAuth `/auth/*` sengaja tidak ditambahi widget/konten**, agar handoff token tetap minimal.
- Ikon dapat diseret lewat mouse/touch ke atas, bawah, kiri, kanan. Batas viewport dijaga saat drag/resize; posisi disimpan pada localStorage per origin/browser. Tombol panah keyboard juga dapat memindahkan ikon saat fokus.
- Silang kecil di atas ikon menyembunyikannya selama sesi tab (sessionStorage), termasuk saat berpindah halaman. Menu Event di sidebar tetap tersedia. Tombol Tampilkan ikon mengambang di halaman Event memunculkannya lagi.

## Verifikasi lokal

- `node scripts/test-events.mjs`: countdown, batas expired, perpindahan jadwal, override manual, clamp posisi, GET publik, payload token admin, respons ditolak, jaringan gagal.
- `npm run build`, pemeriksaan TypeScript (dua error baseline DepositInvoicePage/PlaygroundPage), parser sintaks PHP, dan diff check.
- Belum menguji runtime PHP/MySQL dan drag visual di perangkat live. Tidak ada perubahan database/deploy produksi yang dijalankan.

## Checklist staging

1. Root/child: buka halaman berbeda, ikon tetap ada. Drag mouse/touch ke keempat sisi, pastikan tidak membuka halaman setelah drag; klik singkat membuka `/event`.
2. Resize/rotasi layar: ikon tidak hilang keluar viewport. Tutup silang, navigasi: tetap tersembunyi; buka menu Event dan tampilkan lagi. Cek tidak mengganggu bottom navbar/calculator/modal.
3. Card coming soon tidak bisa diklik/tab sebagai tombol, tanpa judul; respons GET juga tidak membocorkan judul/deskripsi coming soon. Berlangsung/selesai membuka modal, Escape/klik luar/silang menutup dan mengembalikan fokus.
4. Login admin root: ubah event/jadwal, simpan dan reload; data bertahan dan halaman publik mengikuti maksimal sekitar 30 detik. Token non-admin/guest dan POST dari child ditolak.
5. Set batas akhir beberapa menit ke depan: countdown ke nol, otomatis pindah Selesai tanpa nilai negatif. Set waktu mulai ke depan: muncul card coming soon. Status Selesai manual tetap Selesai sebelum deadline.
6. Simulasikan API gagal: error + coba lagi, bukan event contoh yang mengesankan tersimpan.
