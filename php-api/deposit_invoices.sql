-- Backup terlebih dahulu. Jalankan di database website sebelum upload API baru.
-- Atomic saldo + ledger memerlukan InnoDB; jalankan ALTER hanya saat maintenance.
ALTER TABLE users ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS deposits (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        merchant_ref VARCHAR(80) NOT NULL,
        reference    VARCHAR(80) NULL COMMENT 'reference Tripay',
        user_id      INT NOT NULL,
        amount       DECIMAL(15,2) NOT NULL COMMENT 'saldo yang ditambahkan',
        method       VARCHAR(60) NULL,
        status       VARCHAR(12) NOT NULL DEFAULT 'paid',
        source       VARCHAR(12) NOT NULL DEFAULT 'tripay' COMMENT 'tripay | log (impor tripay_log.txt)',
        paid_at      DATETIME NOT NULL,
        created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_ref (merchant_ref),
        KEY idx_user (user_id),
        KEY idx_paid (paid_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE deposits ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS deposit_invoices (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 merchant_ref VARCHAR(80) NOT NULL,
 reference VARCHAR(80) NULL,
 user_id INT NOT NULL,
 active_user_id INT NULL,
 nominal INT NOT NULL,
 bonus INT NOT NULL,
 method VARCHAR(60) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'CREATING',
 invoice_json MEDIUMTEXT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 cancelled_at DATETIME NULL,
 paid_at DATETIME NULL,
 UNIQUE KEY uq_invoice_ref (merchant_ref),
 UNIQUE KEY uq_gateway_ref (reference),
 UNIQUE KEY uq_active_user (active_user_id),
 KEY idx_user_created (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
