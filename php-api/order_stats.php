<?php
/**
 * order_stats.php — statistik kartu Overview PER USER dari tabel riwayat_pesanan.
 * GET ?token=<token login>
 * Resp: { ok, bulan_ini, jumlah_bulan_ini, vps_aktif, agent_aktif, layanan: [...] }
 *  - bulan_ini   : total harga pesanan user di bulan berjalan (status selain 'batal')
 *  - vps_aktif   : pesanan VPS yang belum batal & belum lewat jatuh_tempo
 *  - agent_aktif : pesanan Agen AI yang belum batal & belum lewat jatuh_tempo
 *  - layanan     : daftar pesanan sewa (agen/VPS) user + jatuh temponya
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store");
error_reporting(0);
require 'configdb.php';
require __DIR__ . '/riwayat_schema.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function reply($d, $c = 200) { http_response_code($c); echo json_encode($d); exit; }

$token = trim($_GET['token'] ?? (json_decode(file_get_contents('php://input'), true)['token'] ?? ''));
if ($token === '') reply(['ok' => false, 'message' => 'Token kosong'], 401);

$uid = function_exists('getUserIdByToken') ? getUserIdByToken($token) : null;
if (!$uid) {
    $st = $conn->prepare("SELECT user_id FROM sessions WHERE token = ? LIMIT 1");
    $st->bind_param("s", $token);
    $st->execute();
    $uid = $st->get_result()->fetch_assoc()['user_id'] ?? null;
    $st->close();
}
if (!$uid) reply(['ok' => false, 'message' => 'Token tidak valid'], 401);

$extended = riwayat_ensure_columns($conn);

/* Total pesanan bulan berjalan — dihitung di DB (timezone server DB). */
$st = $conn->prepare("SELECT COALESCE(SUM(price),0) AS total, COUNT(*) AS jml FROM riwayat_pesanan
                      WHERE user_id = ? AND status <> 'batal'
                        AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')");
$st->bind_param("i", $uid);
$st->execute();
$m = $st->get_result()->fetch_assoc();
$st->close();

/* Layanan sewa (agen AI / VPS). */
$cols = $extended
    ? "order_id, service_name, price, status, created_at, order_type, paket, durasi_bulan, jatuh_tempo, target"
    : "order_id, service_name, price, status, created_at";
$st = $conn->prepare("SELECT $cols FROM riwayat_pesanan WHERE user_id = ? AND status <> 'batal' ORDER BY id DESC");
$st->bind_param("i", $uid);
$st->execute();
$rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
$st->close();

$now = time();
$vps = 0; $agent = 0; $layanan = [];
foreach ($rows as $r) {
    $type = ($extended && !empty($r['order_type']) && $r['order_type'] !== 'smm')
        ? $r['order_type'] : riwayat_guess_type($r['service_name']);
    if ($type === 'smm') continue;
    $due = !empty($r['jatuh_tempo']) ? strtotime($r['jatuh_tempo']) : riwayat_due_from_name($r['service_name']);
    $aktif = $due === null || $due >= $now;
    if ($aktif && $type === 'vps') $vps++;
    if ($aktif && $type === 'agent_ai') $agent++;
    $layanan[] = [
        'order_id'    => $r['order_id'],
        'type'        => $type,
        'nama'        => $r['service_name'],
        'paket'       => $r['paket'] ?? null,
        'jatuh_tempo' => $due ? date('c', $due) : null,
        'status'      => $r['status'],
        'aktif'       => $aktif,
    ];
}

reply([
    'ok'               => true,
    'bulan_ini'        => (float)$m['total'],
    'jumlah_bulan_ini' => (int)$m['jml'],
    'vps_aktif'        => $vps,
    'agent_aktif'      => $agent,
    'layanan'          => $layanan,
]);
