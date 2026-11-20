-- Tambahan saldo pendapatan oleh admin (debug), terpisah dari omzet pesanan.
CREATE TABLE IF NOT EXISTS child_panel_income_adjustments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        child_panel_id INT NOT NULL,
        admin_id INT NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        note VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_panel (child_panel_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
