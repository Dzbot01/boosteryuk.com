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
 *   - create  POST {phone,email,nama?,paket?,orderId?} -> mulai sesi + kirim kode pairing ke email
 *   - resend  POST {orderId}                           -> kirim kode pairing baru
 *   - status  GET  ?id=<orderId>                       -> { status, hasCode }
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

if ($action === 'create') {
    $in = json_decode(file_get_contents('php://input'), true);
    if (!is_array($in)) $in = [];
    $phone = preg_replace('/\D/', '', $in['phone'] ?? '');
    $email = trim($in['email'] ?? '');
    if (!$phone || !$email) out(['ok' => false, 'message' => 'phone & email wajib.'], 400);
    $payload = [
        'orderId' => preg_replace('/[^a-zA-Z0-9_-]/', '', $in['orderId'] ?? ('AI' . time())),
        'phone' => $phone, 'email' => $email,
        'nama' => $in['nama'] ?? '', 'paket' => $in['paket'] ?? '',
    ];
    list($code, $body, $err) = vps('POST', "$ORIGIN/session", $TOKEN, $payload);
    if ($code === 0) out(['ok' => false, 'message' => 'Tidak bisa menghubungi VPS: ' . $err]);
    out(json_decode($body, true) ?: ['ok' => false, 'message' => "VPS HTTP $code"]);
}

if ($action === 'resend') {
    $in = json_decode(file_get_contents('php://input'), true);
    $orderId = preg_replace('/[^a-zA-Z0-9_-]/', '', $in['orderId'] ?? '');
    if (!$orderId) out(['ok' => false, 'message' => 'orderId wajib.'], 400);
    list($code, $body, $err) = vps('POST', "$ORIGIN/session/$orderId/resend", $TOKEN, []);
    if ($code === 0) out(['ok' => false, 'message' => 'Tidak bisa menghubungi VPS: ' . $err]);
    out(json_decode($body, true) ?: ['ok' => false, 'message' => "VPS HTTP $code"]);
}

if ($action === 'status') {
    $orderId = preg_replace('/[^a-zA-Z0-9_-]/', '', $_GET['id'] ?? '');
    if (!$orderId) out(['ok' => false, 'message' => 'id wajib.'], 400);
    list($code, $body, $err) = vps('GET', "$ORIGIN/session/$orderId", $TOKEN);
    if ($code === 0) out(['ok' => false, 'message' => 'Tidak bisa menghubungi VPS: ' . $err]);
    out(json_decode($body, true) ?: ['ok' => false, 'message' => "VPS HTTP $code"]);
}

out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
