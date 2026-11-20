-- MIGRASI MANUAL ADMIN, BUKAN DIJALANKAN DARI ENDPOINT PEMBELIAN.
-- 1. Pilih database website yang sama dengan configdb.php di phpMyAdmin.
-- 2. Export/backup LENGKAP struktur + data, termasuk users dan riwayat_pesanan.
-- 3. Aktifkan maintenance: hentikan sementara SEMUA penulisan/transaksi website,
--    worker/cron terkait, bukan hanya merchant. ALTER dapat mengunci/membangun ulang tabel,
--    memerlukan ruang disk dan izin ALTER, serta melakukan implicit COMMIT.
-- 4. Pastikan events.sql, riwayat_pesanan_migration.sql (bila perlu), dan
--    event_game.sql sudah dijalankan. CREATE IF NOT EXISTS tidak mengubah engine tabel lama.
-- 5. Jalankan pemeriksaan di bawah dahulu. Jika InnoDB tidak didukung/izin ditolak,
--    hubungi hosting atau pindahkan DB. JANGAN hapus pemeriksaan keamanan di PHP.

SELECT DATABASE() AS database_website;
SHOW ENGINES;
SELECT TABLE_NAME, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('users', 'riwayat_pesanan', 'event_game_players', 'event_game_receipts')
ORDER BY TABLE_NAME;

-- Jalankan hanya ALTER untuk tabel yang belum InnoDB, satu per satu saat maintenance.
-- Sengaja dikomentari agar import file ini tidak langsung mengubah tabel produksi.
-- ALTER TABLE `users` ENGINE=InnoDB;
-- ALTER TABLE `riwayat_pesanan` ENGINE=InnoDB;
-- ALTER TABLE `event_game_players` ENGINE=InnoDB;
-- ALTER TABLE `event_game_receipts` ENGINE=InnoDB;

-- Sesudah ALTER: pastikan ada EMPAT baris dan semuanya InnoDB.
-- Verifikasi jumlah baris/data/saldo terhadap backup, lalu uji transaksi di staging.
-- Saldo turun tepat sekali, inventori dan riwayat tercatat bersama, rollback/retry ID sama aman.
SELECT TABLE_NAME, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('users', 'riwayat_pesanan', 'event_game_players', 'event_game_receipts')
ORDER BY TABLE_NAME;
