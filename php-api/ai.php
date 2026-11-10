<?php
/**
 * ai.php — Proxy AI (siputzx) untuk Hook Generator & Auto Caption Playground.
 * Upload ke: https://boosteryuk.com/api/ai.php
 * GET ?q=<prompt> -> { ok, data }
 */

ob_start();
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function out($data, $status = 200) {
    while (ob_get_level()) ob_end_clean();
    if (!headers_sent()) { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); }
    echo json_encode($data);
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

function http_get($url, $headers = []) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 45,
            CURLOPT_SSL_VERIFYPEER => false, CURLOPT_FOLLOWLOCATION => true, CURLOPT_HTTPHEADER => $headers]);
        $resp = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        return [$resp === false ? 0 : $code, $resp === false ? '' : $resp, $err];
    }
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => implode("\r\n", $headers),
        'timeout' => 45, 'ignore_errors' => true], 'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);
    $resp = @file_get_contents($url, false, $ctx);
    $code = 0;
    if (isset($http_response_header)) foreach ($http_response_header as $h) if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $code = (int)$m[1];
    return [$resp === false ? 0 : $code, $resp === false ? '' : $resp, $resp === false ? 'file_get_contents gagal' : ''];
}

$q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
if ($q === '') out(['ok' => false, 'message' => 'Parameter q wajib diisi.']);

$url = 'https://api.siputzx.my.id/api/ai/gita?q=' . rawurlencode($q);
list($code, $body, $err) = http_get($url, ['Accept: application/json']);
if ($code === 0) out(['ok' => false, 'message' => 'Gagal menghubungi AI: ' . $err]);

$json = json_decode($body, true);
$answer = '';
if (is_array($json)) {
    if (isset($json['data']) && is_string($json['data'])) $answer = $json['data'];
    elseif (isset($json['result']) && is_string($json['result'])) $answer = $json['result'];
    elseif (isset($json['message']) && is_string($json['message'])) $answer = $json['message'];
} else {
    $answer = (string)$body;
}

out(['ok' => $code >= 200 && $code < 300 && $answer !== '', 'data' => $answer, 'code' => $code]);
