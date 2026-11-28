<?php
/**
 * riwayat_schema.php — kolom tambahan tabel riwayat_pesanan untuk pesanan NON-SMM
 * (Sewa Agen AI, VPS, dst). Pesanan SMM lama tetap jalan: semua kolom baru boleh NULL
 * dan order_type default 'smm', jadi order.php / riwayat_pesanan.php TIDAK perlu diubah.
 *
 * Dipakai oleh agent_order.php & order_stats.php: riwayat_ensure_columns($conn) menambah
 * kolom yang belum ada (sekali saja). Bisa juga dijalankan manual: riwayat_pesanan_migration.sql
 */
const RIWAYAT_EXTRA_COLUMNS = [
    'order_type'   => "VARCHAR(20) NOT NULL DEFAULT 'smm' COMMENT 'smm | agent_ai | vps'",
    'paket'        => "VARCHAR(50) NULL COMMENT 'Starter / Medium / Bisnis / paket VPS'",
    'durasi_bulan' => "TINYINT UNSIGNED NULL COMMENT 'lama sewa (bulan)'",
    'jatuh_tempo'  => "DATETIME NULL COMMENT 'akhir masa aktif layanan sewa'",
    'target'       => "VARCHAR(2048) NULL COMMENT 'target/link pesanan (SMM), nomor WhatsApp agen, hostname VPS'",
    'detail'       => "TEXT NULL COMMENT 'JSON info tambahan (nama AI, platform, dll)'",
    'catatan'      => "VARCHAR(255) NULL COMMENT 'catatan status pesanan (mis. alasan PENDING dari penyedia top up / PPOB)'",
    'updated_at'   => "TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP",
];

/** @return bool true bila semua kolom tambahan tersedia. */
function riwayat_ensure_columns($conn) {
    static $ready = null;
    if ($ready !== null) return $ready;
    // PHP 8.1+: mysqli melempar exception (operator @ tidak meredamnya) -> pakai try/catch.
    $have = [];
    try {
        $res = $conn->query("SHOW COLUMNS FROM riwayat_pesanan");
        if (!$res) return $ready = false;
        while ($r = $res->fetch_assoc()) $have[strtolower($r['Field'])] = true;
    } catch (\Throwable $e) {
        return $ready = false;
    }
    $ok = true;
    foreach (RIWAYAT_EXTRA_COLUMNS as $col => $def) {
        if (isset($have[$col])) continue;
        try {
            if (!$conn->query("ALTER TABLE riwayat_pesanan ADD COLUMN `$col` $def")) $ok = false;
        } catch (\Throwable $e) {
            $ok = false; // hosting tidak mengizinkan ALTER -> pakai format kolom lama
        }
    }
    if ($ok && !isset($have['order_type'])) {
        // index untuk hitung layanan aktif per user
        try { $conn->query("ALTER TABLE riwayat_pesanan ADD INDEX idx_user_type_due (user_id, order_type, jatuh_tempo)"); } catch (\Throwable $e) { /* opsional */ }
    }
    // Perlebar kolom target (masih VARCHAR(100) di instalasi lama) agar muat URL pesanan SMM.
    // Sekali saja per request; bila hosting melarang ALTER MODIFY, tetap VARCHAR(100) dan link dipotong saat INSERT.
    try {
        $res = $conn->query("SHOW COLUMNS FROM riwayat_pesanan LIKE 'target'");
        $r = $res ? $res->fetch_assoc() : null;
        if ($r && preg_match('/^(?:var)?char\((\d+)\)/i', (string)$r['Type'], $m) && (int)$m[1] < 2048) {
            $conn->query("ALTER TABLE riwayat_pesanan MODIFY COLUMN `target` VARCHAR(2048) NULL COMMENT 'target/link pesanan (SMM), nomor WhatsApp agen, hostname VPS'");
        }
    } catch (\Throwable $e) { /* abaikan — target tetap VARCHAR(100), link dipotong saat INSERT */ }
    return $ready = $ok;
}

/**
 * Lebar (maks.) kolom `target`. Dipakai saat INSERT pesanan SMM agar link panjang tidak
 * menggagalkan query di hosting yang kolomnya masih VARCHAR(100) (instalasi lama).
 * @return int lebar kolom, atau 0 bila kolom tidak ada.
 */
function riwayat_target_width($conn) {
    static $w = null;
    if ($w !== null) return $w;
    $w = 0;
    try {
        $res = $conn->query("SHOW COLUMNS FROM riwayat_pesanan LIKE 'target'");
        $r = $res ? $res->fetch_assoc() : null;
        if (!$r) return $w;
        $w = 2048; // tipe non-varchar (mis. TEXT) tidak punya (n) → anggap longgar
        if (preg_match('/\((\d+)\)/', (string)$r['Type'], $m)) $w = max(1, (int)$m[1]);
    } catch (\Throwable $e) { $w = 0; }
    return $w;
}

/** Tebak jenis pesanan untuk baris lama yang belum punya order_type. */
function riwayat_guess_type($serviceName) {
    $n = strtolower((string)$serviceName);
    if (strpos($n, 'event merchant:') === 0) return 'event';
    if (strpos($n, 'agen ai') !== false || strpos($n, 'ai agent') !== false) return 'agent_ai';
    if (preg_match('/\bvps\b|server vps/', $n)) return 'vps';
    return 'smm';
}

/** Baris lama: ambil jatuh tempo dari nama, mis. "... - Jatuh tempo 12 Jan 2027". */
function riwayat_due_from_name($serviceName) {
    if (!preg_match('/jatuh tempo\s+(\d{1,2})\s+([a-z]{3})[a-z]*\s+(\d{4})/i', (string)$serviceName, $m)) return null;
    $map = ['jan'=>1,'feb'=>2,'mar'=>3,'apr'=>4,'mei'=>5,'may'=>5,'jun'=>6,'jul'=>7,'agu'=>8,'aug'=>8,'sep'=>9,'okt'=>10,'oct'=>10,'nov'=>11,'des'=>12,'dec'=>12];
    $mon = $map[strtolower($m[2])] ?? null;
    return $mon ? mktime(23, 59, 59, $mon, (int)$m[1], (int)$m[3]) : null;
}
