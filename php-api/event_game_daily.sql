-- Jatah bermain global per user per hari WIB. Aman dijalankan ulang.
CREATE TABLE IF NOT EXISTS event_game_daily (
  user_id INT NOT NULL, play_date DATE NOT NULL, plays TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,play_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
