<?php
/**
 * riwayat.php — riwayat SEMUA pesanan user yang login (SMM, Sewa Agen AI, NexSpace, Nomor OTP, Upgrade).
 * GET ?token=<token login>
 * Resp: { ok, orders: [ { id, order_id, service_name, quantity, price, status, created_at (ms), type } ] }
 *   type: smm | agent_ai | nexspace | otp | upgrade   (dari awalan ID pesanan / nama layanan)
 * Semua jenis pesanan sudah dicatat ke tabel riwayat_pesanan oleh endpoint masing-masing
 * (order.php, agent_order.php, nexspace.php, otp.php, plan_upgrade.php) — file ini hanya membaca.
 */
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
error_reporting(0);
require 'configdb.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function rw_out($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

$token = trim($_GET['token'] ?? '');
if ($token === '') rw_out(['ok' => false, 'message' => 'Token kosong'], 401);
// Token divalidasi oleh getUserIdByToken (configdb.php) — termasuk masa berlaku sesi.
// Query langsung hanya dipakai bila fungsi itu tidak ada (instalasi lama).
if (function_exists('getUserIdByToken')) {
    $uid = getUserIdByToken($token);
} else {
    $st = $conn->prepare("SELECT user_id FROM sessions WHERE token = ? LIMIT 1");
    $st->bind_param('s', $token);
    $st->execute();
    $uid = $st->get_result()->fetch_assoc()['user_id'] ?? null;
    $st->close();
}
if (!$uid) rw_out(['ok' => false, 'message' => 'Token tidak valid'], 401);

function rw_type($orderId, $name) {
    $n = strtolower((string)$name);
    if (preg_match('/^NX[0-9A-Z]/', $orderId) || strpos($n, 'nexspace') === 0) return 'nexspace';
    if (preg_match('/^OTP\d/', $orderId) || strpos($n, 'nomor otp') === 0) return 'otp';
    if (preg_match('/^AI\d{6,}/', $orderId) || strpos($n, 'agen ai') !== false) return 'agent_ai';
    if (preg_match('/^UP\d/', $orderId) || strpos($n, 'boosteryuk plus') !== false || strpos($n, 'boosteryuk extra') !== false) return 'upgrade';
    return 'smm';
}

try {
    $st = $conn->prepare("SELECT id, order_id, service_name, quantity, price, status, UNIX_TIMESTAMP(created_at) AS ts
                          FROM riwayat_pesanan WHERE user_id = ? ORDER BY id DESC LIMIT 500");
    $st->bind_param('i', $uid);
    $st->execute();
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
    $st->close();
} catch (Throwable $e) {
    rw_out(['ok' => false, 'message' => 'Gagal memuat riwayat: ' . $e->getMessage()], 500);
}

$orders = [];
foreach ($rows as $r) {
    $orders[] = [
        'id'           => (int)$r['id'],
        'order_id'     => (string)$r['order_id'],
        'service_name' => (string)$r['service_name'],
        'quantity'     => (int)$r['quantity'],
        'price'        => (float)$r['price'],
        'status'       => strtolower((string)$r['status']),
        'created_at'   => (int)$r['ts'] * 1000,
        'type'         => rw_type((string)$r['order_id'], $r['service_name']),
    ];
}
rw_out(['ok' => true, 'orders' => $orders]);
