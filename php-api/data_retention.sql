-- data_retention.sql — log pembersihan rutin data riwayat user (lihat data_retention_lib.php).
-- Backup database terlebih dahulu. Tabel dibuat otomatis oleh API (lazy DDL); file ini
-- disediakan bila admin ingin membuatnya langsung di MySQL.
--
-- Jadwal:
--   yearly  → hapus SEMUA riwayat order & deposit yang lebih tua dari 1 tahun (riwayat_pesanan,
--             otp_orders, deposits, deposit_invoices).
--   monthly → hapus data order/deposit GAGAL yang lebih tua dari 1 bulan (pesanan batal,
--             OTP batal/gagal, deposit tidak terbayar, invoice gateway CANCELLED/FAILED/EXPIRED/REFUND).
-- Satu baris per (kind, period_key) sehingga tiap periode hanya dibersihkan sekali walau tanpa cron.
CREATE TABLE IF NOT EXISTS data_retention_log (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    kind           VARCHAR(10) NOT NULL COMMENT 'yearly|monthly',
    period_key     VARCHAR(24) NOT NULL COMMENT 'periode jadwal (2026 / 2026-11) atau penanda jalan manual',
    tables_json    TEXT NULL COMMENT 'jumlah baris terhapus per tabel',
    deleted_total  INT NOT NULL DEFAULT 0,
    triggered_by   VARCHAR(10) NOT NULL DEFAULT 'auto' COMMENT 'auto|admin',
    ran_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_period (kind, period_key),
    KEY idx_kind (kind, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE data_retention_log ENGINE=InnoDB;

-- Indeks pendukung supaya penghapusan baris lama tidak memindai seluruh tabel.
-- Jalankan hanya bila indeksnya belum ada (lewati bila MySQL menolak karena nama indeks kembar).
ALTER TABLE riwayat_pesanan ADD INDEX idx_created (created_at);
ALTER TABLE otp_orders ADD INDEX idx_created (created_at);
ALTER TABLE deposit_invoices ADD INDEX idx_created (created_at);
ALTER TABLE deposits ADD INDEX idx_created (created_at);
