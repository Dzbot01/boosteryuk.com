-- Backup dahulu; jalankan saat maintenance. Tidak ada payment gateway untuk reward.
-- users harus InnoDB agar kredit reward dan receipt berada dalam satu transaksi.
ALTER TABLE users ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_daily_streaks (
 user_id INT NOT NULL PRIMARY KEY,
 last_checkin DATE NULL,
 streak_day TINYINT NOT NULL DEFAULT 0,
 cycle_no INT NOT NULL DEFAULT 1,
 reset_count INT NOT NULL DEFAULT 0,
 reset_seen INT NOT NULL DEFAULT 0,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS daily_streak_receipts (
 user_id INT NOT NULL,
 checkin_date DATE NOT NULL,
 cycle_no INT NOT NULL,
 streak_day TINYINT NOT NULL,
 balance_reward INT NOT NULL DEFAULT 0,
 trial_until DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,checkin_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS user_plus_trials (
 user_id INT NOT NULL PRIMARY KEY,
 started_at DATETIME NOT NULL,
 expires_at DATETIME NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS user_event_titles (
 user_id INT NOT NULL,
 title_code VARCHAR(40) NOT NULL,
 earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,title_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- site_events sudah dibuat oleh events.php. Hanya ubah placeholder bawaan, bukan event custom admin.
UPDATE site_events SET title='Daily Streak',description='Check-in 7 hari berturut-turut. Hari 1–6 mendapat Rp10 hingga Rp60 sesuai hari, hari ke-7 PLUS TRIAL 24 jam.',kind='streak',status='ongoing',starts_at=NULL,ends_at=NULL
 WHERE id=2 AND kind='standard' AND title='' AND status='upcoming';
INSERT IGNORE INTO site_events (id,title,description,kind,status) VALUES (3,'','','standard','upcoming');
