-- Jalankan events.sql dan riwayat_pesanan_migration.sql terlebih dahulu.
-- Tabel users dan riwayat_pesanan wajib InnoDB; backup sebelum konversi engine.
CREATE TABLE IF NOT EXISTS event_game_players (
  event_id INT NOT NULL, user_id INT NOT NULL, state_json MEDIUMTEXT NULL,
  inventory TEXT NOT NULL, bonus TEXT NOT NULL, score BIGINT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 0, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,user_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_game_receipts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, event_id INT NOT NULL, user_id INT NOT NULL,
  request_id VARCHAR(64) NOT NULL, request_hash CHAR(64) NOT NULL, action VARCHAR(8) NOT NULL,
  order_id VARCHAR(64) NULL, amount DECIMAL(15,2) NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_request(event_id,user_id,request_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS event_game_daily (
  user_id INT NOT NULL, play_date DATE NOT NULL, plays TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,play_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
