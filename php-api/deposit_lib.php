<?php
/**
 * deposit_lib.php — tabel `deposits` (riwayat deposit Tripay yang sudah dibayar) + impor riwayat lama.
 * Dipakai callback.php (menulis) dan admin_data.php (membaca halaman Data Deposit & My Profit).
 *
 * merchant_ref UNIK → satu pembayaran hanya bisa menambah saldo SEKALI walau callback datang berkali-kali/bersamaan.
 */
function dep_schema($conn) {
    static $done = false;
    if ($done) return;
    $done = true;
    $conn->query("CREATE TABLE IF NOT EXISTS deposits (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

/**
 * Impor baris lama tripay_log.txt ("Y-m-d H:i:s REF UID +AMOUNT PAID") ke tabel deposits.
 * HANYA mencatat (saldo TIDAK ditambah lagi). Aman dijalankan berulang (INSERT IGNORE + penanda ukuran file).
 */
function dep_import_log($conn) {
    $f = __DIR__ . '/tripay_log.txt';
    if (!is_file($f)) return 0;
    $mark = __DIR__ . '/tripay_log.imported';
    $size = filesize($f);
    if (is_file($mark) && (int)@file_get_contents($mark) === $size) return 0;
    dep_schema($conn);
    $n = 0;
    $st = $conn->prepare("INSERT IGNORE INTO deposits (merchant_ref, user_id, amount, status, source, paid_at) VALUES (?,?,?, 'paid', 'log', ?)");
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (!preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(\S+)\s+(\d+)\s+\+(\d+(?:\.\d+)?)/', $line, $m)) continue;
        $uid = (int)$m[3]; $amt = (float)$m[4];
        $st->bind_param('sids', $m[2], $uid, $amt, $m[1]);
        $st->execute();
        $n += $st->affected_rows > 0 ? 1 : 0;
    }
    $st->close();
    @file_put_contents($mark, (string)$size);
    return $n;
}
