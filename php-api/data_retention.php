<?php
/**
 * data_retention.php — Pengaturan Database: pembersihan rutin riwayat user (HANYA role admin).
 * Upload ke: https://boosteryuk.com/api/data_retention.php (satu folder dengan configdb.php)
 *
 * POST JSON {token, action, kind?}:
 *   status          → jadwal (tahunan/bulanan), pembersihan terakhir, baris yang akan dihapus
 *   run {kind}      → jalankan sekarang: 'yearly' (riwayat > 1 tahun) atau 'monthly' (data gagal > 1 bulan)
 *
 * Pembersihan juga berjalan OTOMATIS tanpa cron: admin_data.php memanggil dr_maybe_run()
 * setiap kali admin membuka halaman data (Data Pesanan / Data Deposit / My Profit), dan
 * tiap periode (tahun / bulan) hanya dieksekusi sekali — dicatat di data_retention_log.
 *
 * Membutuhkan: configdb.php ($conn), child_panel_lib.php (cp_require_admin), data_retention_lib.php.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
error_reporting(0);

require 'configdb.php';
require_once __DIR__ . '/child_panel_lib.php';   // cp_require_admin
require_once __DIR__ . '/data_retention_lib.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function dr_out($d, $c = 200) {
    http_response_code($c);
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
set_exception_handler(function ($e) { dr_out(['ok' => false, 'message' => 'Kesalahan server: ' . $e->getMessage()], 500); });

if ($_SERVER['REQUEST_METHOD'] !== 'POST') dr_out(['ok' => false, 'message' => 'Gunakan POST.'], 405);

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) dr_out(['ok' => false, 'message' => 'Body JSON tidak valid.'], 400);

cp_require_admin($conn, $in['token'] ?? '', function ($m, $c) {
    dr_out(['ok' => false, 'message' => $c === 403 ? 'Hanya admin yang boleh membuka pengaturan database.' : $m], $c);
});

$action = (string)($in['action'] ?? 'status');
if (!in_array($action, ['status', 'run'], true)) dr_out(['ok' => false, 'message' => 'Aksi tidak valid.'], 400);

try {
    if ($action === 'run') {
        $kind = (string)($in['kind'] ?? '');
        if (!in_array($kind, ['yearly', 'monthly'], true)) dr_out(['ok' => false, 'message' => 'Jadwal tidak valid (yearly/monthly).'], 400);
        $result = dr_run_now($conn, $kind);
        dr_out(['ok' => true, 'result' => $result, 'status' => dr_status($conn)]);
    }
    // Membuka halaman ini sekaligus menjalankan jadwal yang sudah jatuh tempo.
    $auto = dr_maybe_run($conn);
    dr_out(['ok' => true, 'auto' => $auto, 'status' => dr_status($conn)]);
} catch (Throwable $e) {
    error_log('data_retention: ' . $e->getMessage());
    dr_out(['ok' => false, 'message' => 'Pembersihan data gagal dijalankan: ' . $e->getMessage()], 500);
}
