<?php
/**
 * agent.php — Proxy website -> VPS (Agen Sewa AI) lewat Cloudflare tunnel.
 * Upload ke: https://boosteryuk.com/api/agent.php
 *
 * Token & origin disimpan DI SERVER (bukan browser). Set salah satu:
 *   - env: AGENT_TOKEN, AGENT_ORIGIN
 *   - atau file api/agent_config.php :  <?php return ['token'=>'...','origin'=>'https://wa-origin.boosteryuk.com'];
 *
 * Aksi (?action=):
 *   - resend  POST {token, orderId}      -> kirim kode pairing baru (hanya pemilik order)
 *   - status  GET  ?id=<orderId>&token=  -> { status, hasCode, phone, log } (hanya pemilik order)
 *   (create dinonaktifkan — pemesanan + potong saldo lewat agent_order.php)
 */

ob_start();
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function out($d, $s = 200) {
    while (ob_get_level()) ob_end_clean();
    if (!headers_sent()) { http_response_code($s); header('Content-Type: application/json; charset=utf-8'); }
    echo json_encode($d);
    exit;
}
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        while (ob_get_level()) ob_end_clean();
        if (!headers_sent()) { http_response_code(200); header('Content-Type: application/json; charset=utf-8'); }
        echo json_encode(['ok' => false, 'message' => 'PHP error: ' . $e['message']]);
    }
});

$TOKEN = getenv('AGENT_TOKEN') ?: '';
$ORIGIN = getenv('AGENT_ORIGIN') ?: '';
if ((!$TOKEN || !$ORIGIN) && is_file(__DIR__ . '/agent_config.php')) {
    $cfg = include __DIR__ . '/agent_config.php';
    if (is_array($cfg)) {
        if (!$TOKEN && !empty($cfg['token'])) $TOKEN = $cfg['token'];
        if (!$ORIGIN && !empty($cfg['origin'])) $ORIGIN = $cfg['origin'];
    }
}
if (!$ORIGIN) $ORIGIN = 'https://wa-origin.boosteryuk.com';
if (!$TOKEN) out(['ok' => false, 'message' => 'AGENT_TOKEN belum diset di server (agent_config.php / env).']);

/** Ubah balasan VPS jadi JSON; beri petunjuk jelas untuk error Cloudflare/tunnel. */
function relay($code, $body) {
    $j = json_decode($body, true);
    if (is_array($j)) return $j;
    $hint = '';
    if ($code == 530 || $code == 1033) $hint = ' — Cloudflare 530: tunnel "wa-origin" belum aktif. Jalankan cloudflared di VPS & buat route DNS.';
    elseif ($code == 502 || $code == 504) $hint = ' — tunnel aktif tapi server.js (port 8080) tidak merespons. Cek pm2/status server agen.';
    elseif ($code >= 500) $hint = ' — origin/VPS tidak terjangkau.';
    return ['ok' => false, 'message' => "VPS HTTP $code$hint"];
}

function vps($method, $pathUrl, $token, $json = null) {
    $url = rtrim($pathUrl, '/');
    $headers = ['x-agent-token: ' . $token, 'Accept: application/json'];
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $o = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_HTTPHEADER => $headers];
        if ($method === 'POST') { $o[CURLOPT_POST] = true; $o[CURLOPT_POSTFIELDS] = $json !== null ? json_encode($json) : ''; $headers[] = 'Content-Type: application/json'; $o[CURLOPT_HTTPHEADER] = $headers; }
        curl_setopt_array($ch, $o);
        $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); $err = curl_error($ch); curl_close($ch);
        return [$body === false ? 0 : $code, $body === false ? '' : $body, $err];
    }
    $ctx = ['http' => ['method' => $method, 'header' => implode("\r\n", array_merge($headers, ['Content-Type: application/json'])), 'timeout' => 30, 'ignore_errors' => true], 'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]];
    if ($json !== null) $ctx['http']['content'] = json_encode($json);
    $body = @file_get_contents($url, false, stream_context_create($ctx));
    $code = 0; if (isset($http_response_header)) foreach ($http_response_header as $h) if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $code = (int)$m[1];
    return [$body === false ? 0 : $code, $body === false ? '' : $body, $body === false ? 'request gagal' : ''];
}

$action = $_GET['action'] ?? '';

/**
 * Pastikan order milik user yang login (token -> sessions -> riwayat_pesanan).
 * Mencegah orang lain melihat log / mengirim ulang kode pairing order milik user lain.
 */
function require_owner($token, $orderId) {
    if (!is_file(__DIR__ . '/configdb.php')) out(['ok' => false, 'message' => 'configdb.php tidak ditemukan.']);
    require_once __DIR__ . '/configdb.php';
    // configdb.php di-include dari dalam fungsi -> $conn masih lokal; jadikan global
    // agar getUserIdByToken() (yang memakai `global $conn`) bisa memakainya.
    if (isset($conn) && !isset($GLOBALS['conn'])) $GLOBALS['conn'] = $conn;
    $conn = $GLOBALS['conn'] ?? null;
    if (!$conn) out(['ok' => false, 'message' => 'Koneksi database tidak tersedia.']);
    $token = trim((string)$token);
    $uid = ($token !== '' && function_exists('getUserIdByToken')) ? getUserIdByToken($token) : null;
    if (!$uid) out(['ok' => false, 'message' => 'Sesi tidak valid. Silakan login ulang.'], 401);
    $st = $conn->prepare("SELECT id FROM riwayat_pesanan WHERE order_id = ? AND user_id = ? LIMIT 1");
    $st->bind_param("si", $orderId, $uid);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    if (!$row) out(['ok' => false, 'message' => 'Order tidak ditemukan untuk akun ini.'], 403);
}

if ($action === 'create') {
    // Dinonaktifkan: pembuatan agen WAJIB lewat agent_order.php (saldo dipotong di database dulu).
    out(['ok' => false, 'message' => 'Gunakan agent_order.php untuk memesan Agen AI.'], 410);
}

if ($action === 'resend') {
    $in = json_decode(file_get_contents('php://input'), true);
    $orderId = preg_replace('/[^a-zA-Z0-9_-]/', '', $in['orderId'] ?? '');
    if (!$orderId) out(['ok' => false, 'message' => 'orderId wajib.'], 400);
    require_owner($in['token'] ?? '', $orderId);
    list($code, $body, $err) = vps('POST', "$ORIGIN/session/$orderId/resend", $TOKEN, []);
    if ($code === 0) out(['ok' => false, 'message' => 'Tidak bisa menghubungi VPS: ' . $err]);
    out(relay($code, $body));
}

if ($action === 'status') {
    $orderId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['id'] ?? '');
    if (!$orderId) out(['ok' => false, 'message' => 'id wajib.'], 400);
    require_owner($_GET['token'] ?? '', $orderId);
    list($code, $body, $err) = vps('GET', "$ORIGIN/session/$orderId", $TOKEN);
    if ($code === 0) out(['ok' => false, 'message' => 'Tidak bisa menghubungi VPS: ' . $err]);
    out(relay($code, $body));
}

out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
