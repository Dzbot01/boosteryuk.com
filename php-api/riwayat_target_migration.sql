-- riwayat_target_migration.sql — kolom `target` di tabel `riwayat_pesanan`.
-- Target pesanan SMM = link/URL yang diinput user (bisa panjang), dipakai juga
-- untuk nomor WhatsApp Agen AI & hostname VPS (pesanan non-SMM).
--
-- CATATAN: biasanya TIDAK perlu dijalankan manual — order.php memanggil
-- riwayat_ensure_columns() yang otomatis MENAMBAH kolom target (bila belum ada) dan
-- MEMPERLEBAR VARCHAR(100) lama menjadi VARCHAR(2048). Skrip ini disediakan bila
-- hosting tidak mengizinkan ALTER otomatis, atau Anda ingin menyamakan skema manual.
--
-- Cara pakai: jalankan di phpMyAdmin (menu SQL) / MySQL client pada database yang
-- dipakai configdb.php. Jalankan perintah yang sesuai dengan kondisi tabel:
--
-- 1) Bila kolom `target` BELUM ADA (pesanan SMM selama ini tidak menyimpan target):
ALTER TABLE riwayat_pesanan
  ADD COLUMN target VARCHAR(2048) NULL COMMENT 'target/link pesanan (SMM), nomor WA agen, hostname VPS';

-- 2) Bila kolom `target` SUDAH ADA tapi masih VARCHAR(100)
--    (dari riwayat_pesanan_migration.sql lama — terlalu pendek untuk URL), perlebar:
-- ALTER TABLE riwayat_pesanan MODIFY COLUMN target VARCHAR(2048) NULL COMMENT 'target/link pesanan (SMM), nomor WA agen, hostname VPS';
--
-- Catatan:
-- * Perintah 1 gagal dengan pesan "Duplicate column" bila kolom sudah ada — itu tandanya Anda perlu perintah 2.
-- * Data lama SMM TIDAK punya target historis (belum pernah disimpan) — kolom kosong
--   untuk pesanan lama; pesanan baru (setelah deploy order.php) otomatis terisi.
