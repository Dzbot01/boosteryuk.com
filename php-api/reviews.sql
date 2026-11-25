-- Penilaian & ulasan layanan (php-api/reviews.php). Opsional: tabel juga dibuat otomatis oleh PHP.
CREATE TABLE IF NOT EXISTS service_reviews (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    order_id     VARCHAR(64) NOT NULL,
    service_name VARCHAR(255) NOT NULL COMMENT 'nama layanan saat dinilai — papan tidak perlu load API',
    service_key  VARCHAR(32) NULL COMMENT 'id layanan untuk tombol pesan ulang (bila ada)',
    stars        TINYINT NOT NULL,
    review       TEXT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_order (order_id),
    KEY idx_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Log pengecekan status otomatis 1 jam sekali (php-api/order_status_lib.php). Opsional.
CREATE TABLE IF NOT EXISTS order_status_sweep_log (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    ran_at  DATETIME NOT NULL,
    checked INT NOT NULL DEFAULT 0,
    changed INT NOT NULL DEFAULT 0,
    KEY idx_ran (ran_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
