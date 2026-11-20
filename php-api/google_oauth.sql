-- Token/state hanya disimpan sebagai hash; expiry di waktu server.
CREATE TABLE IF NOT EXISTS google_oauth_states (
        state_hash CHAR(64) PRIMARY KEY, browser_hash CHAR(64) NOT NULL,
        return_host VARCHAR(190) NOT NULL, challenge CHAR(43) NOT NULL,
        nonce CHAR(64) NOT NULL, verifier VARCHAR(128) NOT NULL,
        expires_at DATETIME NOT NULL, KEY idx_exp (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS google_oauth_grants (
        token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL,
        return_host VARCHAR(190) NOT NULL, challenge CHAR(43) NOT NULL,
        expires_at DATETIME NOT NULL, KEY idx_exp (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
