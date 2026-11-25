<?php
/**
 * data_retention_lib.php — pembersihan rutin data riwayat user TANPA cron.
 *
 * Jadwal (dicek otomatis setiap kali admin membuka halaman data; masing-masing maksimal
 * sekali per periode karena dicatat di `data_retention_log`):
 *  - TAHUNAN  : hapus SEMUA riwayat order & deposit yang lebih tua dari 1 tahun.
 *  - BULANAN  : hapus data order/deposit yang GAGAL (pesanan batal, OTP batal/gagal,
 *               deposit tidak terbayar, invoice gateway terminal) yang lebih tua dari 1 bulan.
 *
 * Tabel yang dibersihkan: riwayat_pesanan, otp_orders, deposits, deposit_invoices.
 * TIDAK disentuh (data uang/pendapatan yang masih dipakai fitur lain):
 * child_panel_orders, child_panel_income_adjustments, smm_order_profit, admin_balance_log,
 * user_daily_streaks, daily_streak_receipts, users.
 *
 * Dipakai oleh: data_retention.php (endpoint admin) dan admin_data.php (pemicu otomatis).
 * Membutuhkan: configdb.php ($conn mysqli).
 */

/** Interval simpan data: riwayat umum 1 tahun, data gagal 1 bulan. */
function dr_interval($kind) {
    return $kind === 'yearly' ? 'INTERVAL 1 YEAR' : 'INTERVAL 1 MONTH';
}

/** Periode jadwal dalam WIB: 'yearly' → 2026, 'monthly' → 2026-11. */
function dr_period_key($kind, $now = null) {
    $d = (new DateTimeImmutable('@' . ($now ?? time())))->setTimezone(new DateTimeZone('Asia/Jakarta'));
    return $kind === 'yearly' ? $d->format('Y') : $d->format('Y-m');
}

/** Awal periode berikutnya (WIB) → perkiraan pembersihan otomatis berikutnya. */
function dr_next_run($kind, $now = null) {
    $d = (new DateTimeImmutable('@' . ($now ?? time())))->setTimezone(new DateTimeZone('Asia/Jakarta'));
    $next = $kind === 'yearly'
        ? $d->setDate((int)$d->format('Y') + 1, 1, 1)->setTime(0, 0)
        : $d->modify('first day of next month')->setTime(0, 0);
    return $next->getTimestamp();
}

/** Tabel log pembersihan (dibuat otomatis, gaya lazy-DDL seperti riwayat_schema.php). */
function dr_ready($conn) {
    static $done = false;
    if ($done) return;
    $conn->query("CREATE TABLE IF NOT EXISTS data_retention_log (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        kind           VARCHAR(10) NOT NULL COMMENT 'yearly|monthly',
        period_key     VARCHAR(24) NOT NULL COMMENT 'periode jadwal (2026 / 2026-11) atau penanda jalan manual',
        tables_json    TEXT NULL COMMENT 'jumlah baris terhapus per tabel',
        deleted_total  INT NOT NULL DEFAULT 0,
        triggered_by   VARCHAR(10) NOT NULL DEFAULT 'auto' COMMENT 'auto|admin',
        ran_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_period (kind, period_key),
        KEY idx_kind (kind, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $done = true;
}

function dr_table_exists($conn, $table) {
    static $cache = [];
    if (isset($cache[$table])) return $cache[$table];
    $st = $conn->prepare("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1");
    if (!$st) return $cache[$table] = false;
    $st->bind_param('s', $table);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    return $cache[$table] = (bool)$row;
}

function dr_column_exists($conn, $table, $column) {
    $st = $conn->prepare("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1");
    if (!$st) return false;
    $st->bind_param('ss', $table, $column);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    return (bool)$row;
}

/**
 * Target pembersihan: [tabel, kolom waktu, syarat tambahan].
 * Syarat tambahan hanya untuk pembersihan bulanan (data GAGAL).
 */
function dr_targets($kind) {
    $all = [
        ['riwayat_pesanan', 'created_at', ''],
        ['otp_orders', 'created_at', ''],
        ['deposits', 'created_at', ''],
        ['deposit_invoices', 'created_at', ''],
    ];
    if ($kind === 'yearly') return $all;
    return [
        ['riwayat_pesanan', 'created_at', "status = 'batal'"],
        ['otp_orders', 'created_at', "status IN ('batal','gagal')"],
        ['deposits', 'created_at', "LOWER(status) <> 'paid'"],
        ['deposit_invoices', 'created_at', "status IN ('CANCELLED','FAILED','EXPIRED','REFUND')"],
    ];
}

/** Nama tabel → label untuk admin. */
function dr_label($table) {
    $map = [
        'riwayat_pesanan' => 'Riwayat pesanan (SMM, Agen AI, VPS, OTP, NexSpace)',
        'otp_orders' => 'Riwayat order nomor OTP',
        'deposits' => 'Riwayat deposit masuk',
        'deposit_invoices' => 'Invoice deposit gateway',
    ];
    return $map[$table] ?? $table;
}

function dr_condition($kind, $timeCol, $where) {
    return "`$timeCol` < DATE_SUB(NOW(), " . dr_interval($kind) . ")" . ($where !== '' ? " AND ($where)" : '');
}

/**
 * Hapus baris lama secara bertahap (LIMIT per putaran) supaya tidak mengunci tabel lama
 * di hosting bersama. Mengembalikan jumlah baris terhapus, atau null bila tabel/kolom tidak ada.
 */
function dr_delete_older($conn, $table, $timeCol, $where, $kind, $chunk = 2000, $maxLoops = 500) {
    if (!dr_table_exists($conn, $table) || !dr_column_exists($conn, $table, $timeCol)) return null;
    $cond = dr_condition($kind, $timeCol, $where);
    $total = 0;
    for ($i = 0; $i < $maxLoops; $i++) {
        $conn->query("DELETE FROM `$table` WHERE $cond LIMIT $chunk");
        $n = (int)$conn->affected_rows;
        if ($n <= 0) break;
        $total += $n;
        if ($n < $chunk) break;
    }
    return $total;
}

/** Jumlah baris yang akan dihapus bila jadwal dijalankan sekarang (untuk ditampilkan ke admin). */
function dr_pending_count($conn, $table, $timeCol, $where, $kind) {
    if (!dr_table_exists($conn, $table) || !dr_column_exists($conn, $table, $timeCol)) return null;
    $cond = dr_condition($kind, $timeCol, $where);
    $row = $conn->query("SELECT COUNT(*) AS n FROM `$table` WHERE $cond")->fetch_assoc();
    return $row ? (int)$row['n'] : 0;
}

/** Periode ini sudah dibersihkan? */
function dr_done_for_period($conn, $kind, $periodKey = null) {
    $key = $periodKey ?? dr_period_key($kind);
    $st = $conn->prepare("SELECT id FROM data_retention_log WHERE kind = ? AND period_key = ? LIMIT 1");
    if (!$st) return false;
    $st->bind_param('ss', $kind, $key);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    return (bool)$row;
}

/** Hapus semua target satu jadwal; mengembalikan [perTabel, total]. */
function dr_delete_targets($conn, $kind) {
    $deleted = [];
    $total = 0;
    foreach (dr_targets($kind) as $t) {
        [$table, $timeCol, $where] = $t;
        $n = dr_delete_older($conn, $table, $timeCol, $where, $kind);
        if ($n === null) continue; // tabel/kolom tidak ada di database ini
        $deleted[$table] = $n;
        $total += $n;
    }
    return [$deleted, $total];
}

function dr_write_log($conn, $kind, $periodKey, $by, $deleted, $total) {
    $json = json_encode($deleted, JSON_UNESCAPED_UNICODE);
    $st = $conn->prepare("INSERT INTO data_retention_log (kind, period_key, tables_json, deleted_total, triggered_by) VALUES (?,?,?,?,?)");
    $st->bind_param('sssis', $kind, $periodKey, $json, $total, $by);
    $st->execute();
    $st->close();
}

/**
 * Jalankan satu jadwal (yearly|monthly). Aman dipanggil berulang: baris log UNIQUE
 * (kind, period_key) membuat hanya satu proses yang benar-benar menghapus.
 */
function dr_run($conn, $kind, $by = 'auto') {
    if (!in_array($kind, ['yearly', 'monthly'], true)) throw new DomainException('Jadwal tidak valid.');
    dr_ready($conn);
    $key = dr_period_key($kind);
    $st = $conn->prepare("INSERT IGNORE INTO data_retention_log (kind, period_key, triggered_by) VALUES (?,?,?)");
    $st->bind_param('sss', $kind, $key, $by);
    $st->execute();
    $st->close();
    if ($conn->affected_rows === 0) {
        return ['kind' => $kind, 'period_key' => $key, 'skipped' => true, 'deleted' => [], 'deleted_total' => 0];
    }
    $logId = (int)$conn->insert_id;
    [$deleted, $total] = dr_delete_targets($conn, $kind);
    $json = json_encode($deleted, JSON_UNESCAPED_UNICODE);
    $st = $conn->prepare("UPDATE data_retention_log SET tables_json = ?, deleted_total = ? WHERE id = ?");
    $st->bind_param('sii', $json, $total, $logId);
    $st->execute();
    $st->close();
    return ['kind' => $kind, 'period_key' => $key, 'skipped' => false, 'deleted' => $deleted, 'deleted_total' => $total, 'ran_at' => date('Y-m-d H:i:s')];
}

/**
 * Dijalankan admin dari tombol "Jalankan sekarang": langsung menghapus tanpa menunggu
 * pergantian periode, dan dicatat sebagai baris manual (tidak memakai slot periode).
 */
function dr_run_now($conn, $kind) {
    if (!in_array($kind, ['yearly', 'monthly'], true)) throw new DomainException('Jadwal tidak valid.');
    dr_ready($conn);
    [$deleted, $total] = dr_delete_targets($conn, $kind);
    $key = 'manual ' . date('Y-m-d H:i:s');
    dr_write_log($conn, $kind, $key, 'admin', $deleted, $total);
    return ['kind' => $kind, 'period_key' => $key, 'skipped' => false, 'manual' => true, 'deleted' => $deleted, 'deleted_total' => $total, 'ran_at' => date('Y-m-d H:i:s')];
}

/**
 * Pemicu otomatis (tanpa cron): jalankan jadwal yang belum dieksekusi pada periodenya.
 * Tidak pernah melempar error ke pemanggil — halaman admin harus tetap terbuka walau
 * tabelnya belum ada atau query gagal.
 */
function dr_maybe_run($conn) {
    $out = [];
    try {
        dr_ready($conn);
        foreach (['monthly', 'yearly'] as $kind) {
            if (!dr_done_for_period($conn, $kind)) $out[] = dr_run($conn, $kind, 'auto');
        }
    } catch (Throwable $e) {
        error_log('data_retention: ' . $e->getMessage());
    }
    return $out;
}

/** Ringkasan untuk halaman admin: jadwal, pembersihan terakhir, antrean baris yang akan dihapus. */
function dr_status($conn) {
    dr_ready($conn);
    $now = time();
    $schedules = [];
    foreach (['yearly', 'monthly'] as $kind) {
        $st = $conn->prepare("SELECT period_key, tables_json, deleted_total, triggered_by, ran_at FROM data_retention_log WHERE kind = ? ORDER BY id DESC LIMIT 1");
        $st->bind_param('s', $kind);
        $st->execute();
        $last = $st->get_result()->fetch_assoc();
        $st->close();
        $targets = [];
        foreach (dr_targets($kind) as $t) {
            [$table, $timeCol, $where] = $t;
            $targets[] = [
                'table' => $table,
                'label' => dr_label($table),
                'exists' => dr_table_exists($conn, $table),
                'pending' => dr_pending_count($conn, $table, $timeCol, $where, $kind),
            ];
        }
        $schedules[$kind] = [
            'label' => $kind === 'yearly' ? 'Setiap tahun' : 'Setiap bulan',
            'keeps' => $kind === 'yearly' ? 'Riwayat order & deposit lebih tua dari 1 tahun dihapus.' : 'Data order/deposit GAGAL lebih tua dari 1 bulan dihapus.',
            'period_key' => dr_period_key($kind, $now),
            'done_this_period' => dr_done_for_period($conn, $kind),
            'next_run_at' => dr_next_run($kind, $now),
            'last_run' => $last ? [
                'period_key' => $last['period_key'],
                'deleted_total' => (int)$last['deleted_total'],
                'deleted' => json_decode((string)$last['tables_json'], true) ?: [],
                'triggered_by' => $last['triggered_by'],
                'ran_at' => $last['ran_at'],
            ] : null,
            'targets' => $targets,
        ];
    }
    $history = [];
    $res = $conn->query("SELECT kind, period_key, tables_json, deleted_total, triggered_by, ran_at FROM data_retention_log ORDER BY id DESC LIMIT 12");
    while ($res && ($r = $res->fetch_assoc())) {
        $history[] = [
            'kind' => $r['kind'],
            'period_key' => $r['period_key'],
            'deleted_total' => (int)$r['deleted_total'],
            'deleted' => json_decode((string)$r['tables_json'], true) ?: [],
            'triggered_by' => $r['triggered_by'],
            'ran_at' => $r['ran_at'],
        ];
    }
    return ['schedules' => $schedules, 'history' => $history, 'server_time' => date('Y-m-d H:i:s')];
}
