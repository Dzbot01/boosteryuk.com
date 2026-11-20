-- Opsional: endpoint admin membuat tabel ini otomatis. Tidak mengubah data lama.
CREATE TABLE IF NOT EXISTS admin_alert_state (
 name VARCHAR(64) PRIMARY KEY, sent_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS admin_order_id_log (
 id INT AUTO_INCREMENT PRIMARY KEY, history_id INT NOT NULL, admin_id INT NOT NULL,
 old_id VARCHAR(64) NOT NULL, new_id VARCHAR(64) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
