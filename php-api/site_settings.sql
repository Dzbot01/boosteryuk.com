-- Tabel pengaturan website Boosteryuk (berita Overview, favicon, teks brand/overview).
-- Jalankan sekali di phpMyAdmin (database yang sama dengan configdb.php).
-- site_settings.php juga membuat tabel ini otomatis bila belum ada.

CREATE TABLE IF NOT EXISTS `site_settings` (
  `setting_key`   VARCHAR(64)  NOT NULL,
  `setting_value` LONGTEXT     NOT NULL,          -- JSON
  `updated_by`    VARCHAR(191) NULL,              -- username/email admin terakhir
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Baris utama (opsional; kosong = website memakai teks bawaan).
INSERT IGNORE INTO `site_settings` (`setting_key`, `setting_value`) VALUES ('site', '{}');
