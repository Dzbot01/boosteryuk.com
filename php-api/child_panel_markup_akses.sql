-- Migrasi: markup Top Up Game & PPOB untuk child panel + akses beli terpisah (Rp35.000 masing-masing).
-- OPSIONAL: cp_ensure_schema() di php-api/child_panel_lib.php sudah membuat kolom ini
-- otomatis saat ada request. Jalankan manual hanya bila ingin memastikan lebih dulu.
ALTER TABLE child_panels ADD COLUMN markup_topup_pct DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER markup_agent_pct;
ALTER TABLE child_panels ADD COLUMN markup_ppob_pct DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER markup_topup_pct;
ALTER TABLE child_panels ADD COLUMN access_topup_markup TINYINT(1) NOT NULL DEFAULT 0 AFTER markup_ppob_pct;
ALTER TABLE child_panels ADD COLUMN access_ppob_markup TINYINT(1) NOT NULL DEFAULT 0 AFTER access_topup_markup;
