<?php
/**
 * my_agents.php — daftar Agen AI milik user yang login (halaman "Agen AI Saya").
 * GET ?token=<token login>
 * Resp: { ok, agents: [ { order_id, paket, status, state, harga, durasi_bulan, dibeli, jatuh_tempo,
 *                         sisa_hari, nomor_bot, nama_ai, nomor_pemilik, ewallet, nama_toko,
 *                         payment_gateway, platform } ] }
 *   state: 'aktif' (WA tertaut) | 'menunggu' (belum tertaut, sisa_tunggu = detik tersisa) | 'kedaluwarsa'
 *   Order yang menunggu tautan lebih dari 10 menit TIDAK ditampilkan (sudah/akan direfund).
 * Juga mengecek/menjadwalkan email pengingat jatuh tempo agen user ini (agent_reminder.php).
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store");
error_reporting(0);
require 'configdb.php';
require_once __DIR__ . '/riwayat_schema.php';
require_once __DIR__ . '/agent_reminder.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function reply($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

$token = trim($_GET['token'] ?? '');
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

// Batas waktu menautkan WhatsApp (sama dengan VPS: bot dihentikan bila 10 menit belum tertaut).
const AGENT_LINK_WAIT = 10 * 60;
const AGENT_LINK_GRACE = 60; // toleransi selisih jam server

// Sinkron dulu SEBELUM daftar dibuat: tertaut → 'selesai', waktu habis → 'batal' + saldo dikembalikan.
require_once __DIR__ . '/agent_lifecycle.php';
try { agent_sync_user($conn, (int)$uid); } catch (Throwable $e) { /* VPS tidak terjangkau: daftar tetap tampil */ }

$ext = riwayat_ensure_columns($conn);
$cols = $ext
    ? "order_id, service_name, quantity, price, status, UNIX_TIMESTAMP(created_at) AS ts, order_type, paket, durasi_bulan, jatuh_tempo, target, detail"
    : "order_id, service_name, quantity, price, status, UNIX_TIMESTAMP(created_at) AS ts";
$cond = $ext ? "(order_type = 'agent_ai' OR service_name LIKE 'Agen AI%')" : "service_name LIKE 'Agen AI%'";
$st = $conn->prepare("SELECT $cols FROM riwayat_pesanan WHERE user_id = ? AND $cond AND status <> 'batal' ORDER BY id DESC");
$st->bind_param("i", $uid);
$st->execute();
$rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
$st->close();

$now = time();
$agents = [];
foreach ($rows as $r) {
    $d = !empty($r['detail']) ? (json_decode($r['detail'], true) ?: []) : [];
    $due = !empty($r['jatuh_tempo']) ? strtotime($r['jatuh_tempo']) : riwayat_due_from_name($r['service_name']);
    $paket = $r['paket'] ?? null;
    if (!$paket && preg_match('/Agen AI WhatsApp\s+(\w+)/i', $r['service_name'], $m)) $paket = $m[1];
    $expired = $due && $due < $now;
    $waiting = !$expired && $r['status'] !== 'selesai';
    $waitLeft = $waiting ? ((int)$r['ts'] + AGENT_LINK_WAIT) - $now : null;
    // Menunggu tautan tapi waktu tunggu sudah habis → tidak ditampilkan (saldo dikembalikan oleh agent_lifecycle).
    if ($waiting && $waitLeft < -AGENT_LINK_GRACE) continue;
    $agents[] = [
        'order_id'        => $r['order_id'],
        'nama_layanan'    => $r['service_name'],
        'paket'           => $paket,
        'status'          => $r['status'],
        'state'           => $expired ? 'kedaluwarsa' : ($r['status'] === 'selesai' ? 'aktif' : 'menunggu'),
        'harga'           => (float)$r['price'],
        'durasi_bulan'    => (int)($r['durasi_bulan'] ?? $r['quantity']),
        'dibeli'          => (int)$r['ts'] * 1000,
        'jatuh_tempo'     => $due ? $due * 1000 : null,
        'sisa_hari'       => $due ? (int)ceil(($due - $now) / 86400) : null,
        'nomor_bot'       => $r['target'] ?? ($d['nomor_pemilik'] ?? null),
        'nama_ai'         => $d['nama_ai'] ?? null,
        'nomor_pemilik'   => $d['nomor_pemilik'] ?? ($r['target'] ?? null),
        'ewallet'         => $d['ewallet'] ?? null,
        'nama_toko'       => $d['nama_toko'] ?? null,
        'payment_gateway' => isset($d['payment_gateway']) ? (bool)$d['payment_gateway'] : (strtolower((string)$paket) === 'bisnis'),
        'platform'        => $d['platform'] ?? 'whatsapp',
        'sisa_tunggu'     => $waiting ? max(0, $waitLeft) : null, // detik tersisa untuk menautkan
    ];
}

// pengingat jatuh tempo agen milik user ini (tanpa cron) — dijalankan setelah respons terkirim
agent_reminder_after_response(function () use ($conn, $uid) {
    agent_reminder_check_user($conn, $uid);
});
reply(['ok' => true, 'agents' => $agents]);
