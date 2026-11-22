# Indikator data baru admin utama

- Kalkulator global (tombol, modal, CSS) dihapus.
- Satu provider untuk kartu dashboard, sidebar terbuka/rail, serta tombol data event.
- Feed POST `admin_data.php` action `notifications` memerlukan token dengan role admin yang diverifikasi dari DB. Respons hanya berisi watermark numerik, tanpa data pribadi. Request bertanda child-panel ditolak; frontend child-panel, user biasa, dan guest tidak melakukan polling.
- Poll saat mount, fokus, kembali ke tab, dan setiap 30 detik saat tab terlihat. Maksimum satu request aktif per provider. Gangguan jaringan mempertahankan snapshot terakhir.
- Pesanan, user, deposit dibayar/manual, profit, child panel/domain, withdraw, NexSpace Pro, event/aktivitas game, dan pengaturan website menggunakan marker DB masing-masing. Tabel pengaturan menggunakan koneksi `configdb.php` yang juga dipilih `site_db()` di site_settings.php. Tabel yang belum tersedia menghasilkan marker nol, tanpa membuat skema atau mengimpor log deposit.
- Klik hanya mengakui snapshot menu tersebut; kategori lain tidak dibersihkan. Penerimaan data yang lebih baru menyalakan dot lagi. Membiarkan halaman terbuka tidak mengakui data baru otomatis.
- Status baca disimpan per ID admin di localStorage dan disinkronkan antartab. Berbeda browser/perangkat memiliki status sendiri. Pada kunjungan pertama, data lama yang belum pernah diakui juga menyalakan dot. Penyimpanan browser yang diblokir berarti status hanya bertahan di memori.
- Badge jumlah withdraw/NexSpace menunggu tetap dipertahankan: status pending berbeda dari belum dibaca.
- Server Panel adalah monitor langsung, bukan antrean database. Broadcast menggunakan layanan eksternal, bukan database aplikasi; keduanya tidak diberi dot palsu. Cek Status adalah alat pencarian, bukan kategori data baru.
- Marker ID mendeteksi baris baru, bukan seluruh perubahan status/edit/hapus baris lama. Pengaturan dan jadwal event juga memakai updated_at. Feed tidak menyentuh Worker/konfigurasi Tripay.

## Upload sesudah PR disetujui

1. Upload `php-api/admin_data.php` dan **file baru** `php-api/admin_notifications_lib.php` ke folder `/api/` yang sama; jangan ganti configdb.php.
2. Jalankan `npm ci` lalu `npm run build`, upload hasil `dist/` sesuai alur frontend yang sudah digunakan.
3. Tidak ada SQL/migrasi yang diperlukan. Tidak ada deployment otomatis dari perubahan ini.
4. Cek dengan akun admin root: klik Pesanan → dot padam di kartu dan sidebar; buat pesanan dari user lain → dot kembali paling lambat 30 detik saat tab terlihat. Ulangi user/deposit/withdraw dan refresh untuk memastikan acknowledgement bertahan.

## Verifikasi

- `NODE_PATH=/tmp/admin-dot-tests/node_modules node scripts/test-admin-notifications.mjs` (jsdom test-only di luar repo): shared UI dot, klik, persist/remount, data baru, offline, storage antartab, isolasi akun/logout, tanpa polling guest/user/child, kontrak endpoint read-only dan penghapusan kalkulator.
- PHP syntax: php-parser test-only; tidak tersedia PHP CLI/MySQL lokal. Query belum diuji terhadap database produksi.
- `npm run build` lolos termasuk 24 halaman SEO.
- `tsc --noEmit` masih melaporkan dua masalah baseline: variabel `method` tidak terpakai di DepositInvoicePage dan deklarasi ScrollExpand di PlaygroundPage. Tidak ada error baru pada file fitur ini.
