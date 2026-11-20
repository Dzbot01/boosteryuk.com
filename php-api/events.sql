-- Event global; DATETIME disimpan sebagai UTC. Aman dijalankan ulang.
CREATE TABLE IF NOT EXISTS site_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        description TEXT NOT NULL,
        kind VARCHAR(16) NOT NULL DEFAULT 'standard',
        status VARCHAR(16) NOT NULL DEFAULT 'upcoming',
        starts_at DATETIME NULL,
        ends_at DATETIME NULL,
        updated_by INT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO site_events (id,title,description,kind,status,ends_at) VALUES
        (1,'Hitung mundur tahun baru','Mainkan Naikkan Akunmu! Merchant memakai saldo website untuk item virtual game.','game','ongoing','2026-12-31 17:00:00'),
        (2,'','','standard','upcoming',NULL);

UPDATE site_events SET kind='game' WHERE id=1 AND kind='countdown' AND title='Hitung mundur tahun baru';
