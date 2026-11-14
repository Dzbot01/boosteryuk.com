-- Child Panel Boosteryuk (opsional — child_panel.php membuat tabel ini otomatis).
CREATE TABLE IF NOT EXISTS child_panels (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id    INT NULL COMMENT 'users.id reseller pemilik (opsional)',
  name             VARCHAR(80) NOT NULL,
  status           VARCHAR(12) NOT NULL DEFAULT 'active' COMMENT 'active | suspended',
  markup_smm_pct   DECIMAL(6,2) NOT NULL DEFAULT 0,
  markup_agent_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
  config           LONGTEXT NULL COMMENT 'JSON: brand, warna, footer, slider, voice',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS child_panel_domains (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  child_panel_id INT NOT NULL,
  hostname       VARCHAR(190) NOT NULL,
  is_primary     TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_hostname (hostname),
  KEY idx_panel (child_panel_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS child_panel_assets (
  child_panel_id INT NOT NULL,
  slot           VARCHAR(16) NOT NULL,
  data           LONGTEXT NOT NULL COMMENT 'data URL gambar',
  version        VARCHAR(16) NOT NULL,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (child_panel_id, slot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pencairan pendapatan markup pemilik child panel (Withdraw Request di admin utama)
CREATE TABLE IF NOT EXISTS child_panel_withdrawals (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  child_panel_id INT NOT NULL,
  user_id        INT NOT NULL,
  method         VARCHAR(20) NOT NULL,
  bank_name      VARCHAR(60) NULL,
  account_number VARCHAR(40) NOT NULL,
  account_name   VARCHAR(80) NOT NULL,
  amount         DECIMAL(15,2) NOT NULL,
  fee            DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_amount     DECIMAL(15,2) NOT NULL,
  status         VARCHAR(12) NOT NULL DEFAULT 'pending',
  admin_note     VARCHAR(255) NULL,
  email_sent     TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at   DATETIME NULL,
  processed_by   INT NULL,
  KEY idx_panel_status (child_panel_id, status),
  KEY idx_status_time (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
