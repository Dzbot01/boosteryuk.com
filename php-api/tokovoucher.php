<?php
/**
 * tokovoucher.php — proxy server untuk API transaksi TokoVoucher (halaman TopUp All Game).
 *
 * Keamanan:
 *  - SECRET KEY TIDAK pernah dikirim ke browser; disimpan di php-api/tokovoucher_config.php
 *    (tidak di-commit; lihat tokovoucher_config.example.php) atau env TOKOVOUCHER_SECRET.
 *  - Signature MD5(user_code:secret:ref_id) dihitung DI SERVER sesuai formula penyedia.
 *  - Aksi `transaksi` wajib memakai token login yang valid (sesi website).
 *
 * Endpoint:
 *  GET  ?action=status
 *        → {ok:true, configured:bool, user_code:"U261***568YV"}   (tanpa secret)
 *  POST {token, action:"transaksi", player_id, server_id?, kode_produk}
 *        → {ok, ref_id, message, provider:{...}} hasil dari api.tokovoucher.me/v1/transaksi
 */
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
error_reporting(0);

require 'configdb.php';
require_once __DIR__ . '/child_panel_lib.php'; // cp_user_id() — validasi token login
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function tv_out($d, $code = 200) { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }

function tv_cfg() {
    static $c = null;
    if ($c !== null) return $c;
    $f = is_file(__DIR__ . '/tokovoucher_config.php') ? (include __DIR__ . '/tokovoucher_config.php') : [];
    $c = (is_array($f) ? $f : []) + [
        'user_code' => '',
        'secret'    => '',
        'base_url'  => 'https://api.tokovoucher.me/v1',
        'timeout'   => 20,
    ];
    if (getenv('TOKOVOUCHER_USER_CODE')) $c['user_code'] = (string)getenv('TOKOVOUCHER_USER_CODE');
    if (getenv('TOKOVOUCHER_SECRET')) $c['secret'] = (string)getenv('TOKOVOUCHER_SECRET');
    return $c;
}

/** user_code tersamarkan untuk tampilan: U261***568YV */
function tv_mask_code($code) {
    $code = (string)$code;
    $n = mb_strlen($code);
    if ($n <= 8) return $code === '' ? '' : str_repeat('*', $n);
    return mb_substr($code, 0, 4) . '***' . mb_substr($code, -4);
}

$action = (string)($_GET['action'] ?? '');
$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
if ($action === '' && isset($in['action'])) $action = (string)$in['action'];

/* ===================== GET: status integrasi (aman, tanpa secret) ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'status') {
        $c = tv_cfg();
        tv_out(['ok' => true, 'configured' => ($c['user_code'] !== '' && $c['secret'] !== ''), 'user_code' => tv_mask_code($c['user_code'])]);
    }
    tv_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
}

/* ===================== POST: transaksi ===================== */
if ($action !== 'transaksi') tv_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);

$c = tv_cfg();
if ($c['user_code'] === '' || $c['secret'] === '') {
    tv_out(['ok' => false, 'message' => 'Integrasi top up belum dikonfigurasi di server. Hubungi admin.'], 503);
}

$uid = isset($conn) && $conn instanceof mysqli ? cp_user_id($conn, (string)($in['token'] ?? '')) : null;
if (!$uid) tv_out(['ok' => false, 'message' => 'Silakan login terlebih dahulu untuk memesan.'], 401);

$player = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['player_id'] ?? ''));
$server = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['server_id'] ?? ''));
$kode   = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['kode_produk'] ?? ''));
if (mb_strlen($player) < 3 || mb_strlen($player) > 40) tv_out(['ok' => false, 'message' => 'Player ID tidak valid.'], 400);
if (mb_strlen($server) > 20) tv_out(['ok' => false, 'message' => 'Server ID terlalu panjang.'], 400);
if ($kode === '' || mb_strlen($kode) > 40) tv_out(['ok' => false, 'message' => 'Kode produk tidak valid.'], 400);

// Ref ID unik per permintaan (dipakai juga sebagai bahan signature).
$ref = 'BY' . date('ymdHis') . random_int(1000, 9999);
$sig = md5($c['user_code'] . ':' . $c['secret'] . ':' . $ref); // formula penyedia: USER_CODE:SECRET_KEY:REF_ID

$body = [
    'user_code'   => $c['user_code'],
    'ref_id'      => $ref,
    'player_id'   => $player,
    'server_id'   => $server,           // kosong bila produk tidak memiliki Server ID
    'kode_produk' => $kode,
    'signature'   => $sig,
];

$ch = curl_init(rtrim($c['base_url'], '/') . '/transaksi');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($body),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => (int)$c['timeout'],
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
]);
$resp = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$j = is_string($resp) ? json_decode($resp, true) : null;
$okProvider = is_array($j) ? (bool)($j['status'] ?? $j['success'] ?? false) : false;
$pesan = is_array($j) ? (string)($j['message'] ?? $j['msg'] ?? '') : '';
if (!is_array($j)) $pesan = 'Penyedia top up tidak merespons (HTTP ' . $code . '). Coba lagi sebentar lagi.';

// Log server untuk pelacakan (tanpa secret & tanpa signature).
@file_put_contents(__DIR__ . '/tokovoucher_log.txt',
    date('Y-m-d H:i:s') . " user=$uid ref=$ref kode=$kode player=$player server=$server http=$code ok=" . ($okProvider ? 1 : 0) . ' msg=' . json_encode($pesan, JSON_UNESCAPED_UNICODE) . "\n",
    FILE_APPEND);

// Buang field sensitif bila penyedia ikut membalasnya.
if (is_array($j)) { unset($j['signature'], $j['secret'], $j['api_key'], $j['user_code']); }

tv_out([
    'ok'       => $okProvider,
    'ref_id'   => $ref,
    'message'  => $pesan !== '' ? $pesan : ($okProvider ? 'Transaksi diterima penyedia.' : 'Transaksi ditolak penyedia.'),
    'provider' => is_array($j) ? $j : null,
], $okProvider ? 200 : 502);
