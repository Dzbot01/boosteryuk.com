<?php
/**
 * ai.php — Proxy AI (siputzx) untuk fitur Hook Generator & Auto Caption Playground.
 *
 * Upload ke: https://boosteryuk.com/api/ai.php
 * Dipakai agar panggilan AI tidak kena CORS dari browser.
 *
 * GET  ?q=<prompt terurl-encode>
 * Resp JSON: { ok: bool, data: <jawaban string>, raw?: ... , message?: string }
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
if ($q === '') {
    echo json_encode(['ok' => false, 'message' => 'Parameter q wajib diisi.']);
    exit;
}

$url = 'https://api.siputzx.my.id/api/ai/gita?q=' . rawurlencode($q);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 45,
    CURLOPT_HTTPHEADER     => ['Accept: application/json'],
    CURLOPT_SSL_VERIFYPEER => true,
]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($body === false) {
    echo json_encode(['ok' => false, 'message' => 'Gagal menghubungi AI: ' . $err]);
    exit;
}

$json = json_decode($body, true);
// siputzx umumnya mengembalikan { status: true, data: "..." }
$answer = '';
if (is_array($json)) {
    if (isset($json['data']) && is_string($json['data'])) {
        $answer = $json['data'];
    } elseif (isset($json['result']) && is_string($json['result'])) {
        $answer = $json['result'];
    } elseif (isset($json['message']) && is_string($json['message'])) {
        $answer = $json['message'];
    }
} else {
    $answer = (string)$body;
}

echo json_encode([
    'ok'   => $code >= 200 && $code < 300 && $answer !== '',
    'data' => $answer,
    'code' => $code,
]);
