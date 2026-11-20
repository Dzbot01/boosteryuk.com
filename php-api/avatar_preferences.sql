-- Pilihan tampilan avatar per akun (bukan data gender pribadi). Tidak mengubah tabel users.
CREATE TABLE IF NOT EXISTS user_avatar_preferences (
 user_id INT PRIMARY KEY,
 avatar_variant VARCHAR(8) NOT NULL DEFAULT 'male',
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
