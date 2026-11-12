-- Kolom tambahan riwayat_pesanan untuk pesanan NON-SMM (Sewa Agen AI, VPS).
-- Aman untuk data lama: semua kolom NULL / default 'smm'. Jalankan sekali di phpMyAdmin
-- (opsional — agent_order.php & order_stats.php juga menambahkannya otomatis).
ALTER TABLE riwayat_pesanan
  ADD COLUMN order_type   VARCHAR(20) NOT NULL DEFAULT 'smm' COMMENT 'smm | agent_ai | vps',
  ADD COLUMN paket        VARCHAR(50) NULL COMMENT 'Starter / Medium / Bisnis / paket VPS',
  ADD COLUMN durasi_bulan TINYINT UNSIGNED NULL COMMENT 'lama sewa (bulan)',
  ADD COLUMN jatuh_tempo  DATETIME NULL COMMENT 'akhir masa aktif layanan sewa',
  ADD COLUMN target       VARCHAR(100) NULL COMMENT 'nomor WhatsApp agen / hostname VPS',
  ADD COLUMN detail       TEXT NULL COMMENT 'JSON info tambahan (nama AI, platform, dll)',
  ADD COLUMN updated_at   TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  ADD INDEX idx_user_type_due (user_id, order_type, jatuh_tempo);

-- Tandai pesanan agen AI lama (sebelum kolom ada) agar ikut terhitung:
UPDATE riwayat_pesanan SET order_type = 'agent_ai'
 WHERE order_type = 'smm' AND (service_name LIKE 'Agen AI%' OR order_id LIKE 'AI%');
