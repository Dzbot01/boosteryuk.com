# Detail child panel, saldo debug, alert provider & ID pesanan

## Deploy

- Build/deploy frontend terbaru.
- Upload `php-api/admin_data.php`, `php-api/child_panel.php`, **dan** `php-api/child_panel_lib.php` ke `/api`.
- Pertahankan `config.php` (API_ID, API_KEY, BASE_URL), configdb.php, serta konfigurasi Resend yang sudah ada. Jangan unggah kredensial ke Git.
- Tabel baru dibuat otomatis. Untuk instalasi manual gunakan `child_panel_income_adjustments.sql` dan `admin_audit_alerts.sql`. Tidak ada DROP/data reset.
- Resend memakai RESEND_API_KEY atau resend_key di agent_config.php, dengan mekanisme email existing. Tabel baru harus InnoDB agar transaksi/row lock bekerja.

## Perilaku penting

- Klik kartu child panel / Detail membuka email pemilik, tanggal dibuat, awal EXTRA, expired, markup SMM/AI/OTP, pendapatan pesanan, kredit debug, saldo tersedia, tertahan, pending, dan sudah dicairkan.
- Awal EXTRA dari `user_plans.extra_started` (upgrade pertama akun), expired dari `child_panels.expires_at` yang sudah mengikuti upgrade/perpanjangan. Tidak dihitung ulang dari tanggal membuka halaman. Panel admin dengan expires_at NULL ditampilkan tanpa batas waktu.
- Kredit debug positif maksimal Rp100 juta per request, memerlukan catatan, hanya role admin, dicatat di ledger bersama admin_id. Kredit langsung menjadi saldo tersedia dan **bisa dicairkan**; tidak membuat pesanan fiktif atau mengubah omzet.
- Side menu admin root sekarang memuat Request Withdraw Child Panel `/admin/withdraw` (halamannya sudah tersedia dari PR sebelumnya). Uji pada sidebar desktop dan mobile.
- My Profit memanggil `provider_health`: saldo diambil server langsung dari endpoint provider `/balance` sesuai config.php, total saldo user dihitung dari DB. Tidak menerima nilai saldo dari browser. Jika provider gagal, tidak menganggap saldo nol dan tidak mengirim alert palsu.
- Saat provider < total saldo user, email dikirim ke **boosteryukid@gmail.com**, berisi kedua saldo, kekurangan, waktu server, dan instruksi isi ulang. GET_LOCK mencegah kiriman bersamaan; email berhasil dibatasi 6 jam. Kegagalan tidak mencatat sukses sehingga bisa dicoba ulang pada refresh berikutnya.
- **Pemicu alert: membuka/muat ulang My Profit, bukan cron 24/7.** Untuk pemantauan tanpa membuka halaman diperlukan job server terjadwal terpisah. Tidak ada cron atau email produksi yang dijalankan dari sandbox.
- Pengubahan ID hanya untuk pesanan **SMM** (ID provider numerik). Jenis AI/OTP/NexSpace/Upgrade tidak diubah karena ID-nya terikat lifecycle lain. UI langsung memakai ID baru untuk cek status/refill; ID nonnumerik lama yang diklasifikasikan SMM dapat diperbaiki menjadi ID provider numerik.
- Server memperbarui riwayat_pesanan, smm_order_profit, dan child_panel_orders terkait dalam transaksi. ID duplikat ditolak; log admin_order_id_log menyimpan ID lama/baru dan admin. Tidak membuat pesanan baru atau mengubah saldo user. Cek status tetap read-only memakai fungsi existing.
- Target dapat disalin dengan tombol di samping target; link target masih bisa dibuka.

## Checklist staging (PHP/MySQL + provider/Resend diperlukan)

1. Non-admin tidak dapat mengakses admin_detail, admin_income_credit, provider_health, order_id.
2. Klik kartu panel: cocokkan email, markup, extra_started, expires_at dengan DB dan histori upgrade/perpanjangan. Panel admin tanpa expiry tidak diberi expiry buatan.
3. Tambah kredit Rp10.000 dengan catatan: tersedia/earned/debug_credit naik Rp10.000, held dan omzet pesanan tidak berubah; log memuat admin, catatan, tanggal. Nol/negatif/NaN/melebihi limit ditolak.
4. Pengajuan withdraw setelah kredit menggunakan saldo terbaru; kredit dan withdraw bersama memakai row lock panel. Setelah ditolak saldo kembali tersedia.
5. Sidebar root menampilkan Request Withdraw; buka tabel dan proses request seperti sebelumnya.
6. Provider cukup: tidak kirim email. Provider kurang: satu email, ulang buka dalam 6 jam tidak spam. Provider gagal/malformed: pesan gagal, bukan alert saldo nol. Simulasikan kegagalan Resend, lalu ulang refresh setelah konfigurasi benar.
7. Edit ID SMM, cek ID pada semua tiga tabel dan audit. Tombol cek memakai ID baru. ID duplikat/invalid/non-SMM ditolak. Rollback jika update relasi gagal.
8. Salin target URL/teks: clipboard berisi target lengkap, tanpa pemotongan.

## Verifikasi lokal

Build frontend, TypeScript dan parser sintaks PHP dijalankan. Runtime transaksi MySQL, provider dan pengiriman Resend belum dapat diverifikasi di sandbox ini; jangan anggap checklist staging di atas sudah dijalankan.
