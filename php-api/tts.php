<?php
/**
 * tts.php — Proxy ElevenLabs untuk menu "Teks To Speech" Playground.
 *
 * Upload ke: https://boosteryuk.com/api/tts.php
 * API key TIDAK boleh di browser. Set di server (jangan di-commit):
 *   - Env var:  ELEVENLABS_API_KEY=...    (disarankan), atau
 *   - file api/tts_config.php berisi:  <?php return ['key' => 'sk_xxxx'];
 *
 * Aksi (?action=):
 *   - models  : daftar model TTS   -> { ok, models:[{model_id,name,languages:[...]}] }
 *   - voices  : daftar suara        -> { ok, voices:[{voice_id,name,labels,preview}] }
 *   - tts     : hasilkan audio mp3  -> audio/mpeg (binary)
 *               body JSON: { text, voice_id, model_id, language_code?,
 *                            stability?, similarity_boost?, style? }
 *   - debug   : cek lingkungan      -> { ok, php, curl, key_source }
 */

ob_start();
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

/** Keluarkan JSON lalu berhenti (buang output buffer dulu). */
function out($data, $status = 200) {
    while (ob_get_level()) ob_end_clean();
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($data);
    exit;
}

// Tangkap fatal/parse error -> kirim sebagai JSON agar bukan "blank 500".
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        while (ob_get_level()) ob_end_clean();
        if (!headers_sent()) {
            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['ok' => false, 'message' => 'PHP error: ' . $e['message']]);
    }
});
set_exception_handler(function ($ex) {
    out(['ok' => false, 'message' => 'Exception: ' . $ex->getMessage()]);
});

/** Request HTTP memakai curl bila ada, kalau tidak pakai file_get_contents. */
function http_req($url, $headers = [], $method = 'GET', $body = null) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_SSL_VERIFYPEER => false, // beberapa shared host tak punya CA bundle
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER     => $headers,
        ];
        if ($method === 'POST') { $opts[CURLOPT_POST] = true; $opts[CURLOPT_POSTFIELDS] = $body; }
        curl_setopt_array($ch, $opts);
        $resp  = curl_exec($ch);
        $code  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $ctype = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $err   = curl_error($ch);
        curl_close($ch);
        if ($resp === false) return [0, '', '', $err];
        return [$code, $resp, $ctype, ''];
    }
    // Fallback tanpa curl
    $opts = ['http' => [
        'method'        => $method,
        'header'        => implode("\r\n", $headers),
        'timeout'       => 60,
        'ignore_errors' => true,
    ], 'ssl' => ['verify_peer' => false, 'verify_peer_name' => false]];
    if ($body !== null) $opts['http']['content'] = $body;
    $ctx  = stream_context_create($opts);
    $resp = @file_get_contents($url, false, $ctx);
    $code = 0; $ctype = '';
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) $code = (int)$m[1];
            if (stripos($h, 'content-type:') === 0) $ctype = trim(substr($h, 13));
        }
    }
    if ($resp === false) return [0, '', '', 'file_get_contents gagal (allow_url_fopen off?)'];
    return [$code, $resp, $ctype, ''];
}

// ---- Ambil API key dari server (fleksibel: beberapa format didukung) ----
function read_api_key() {
    $dir = __DIR__;
    $env = getenv('ELEVENLABS_API_KEY');
    if ($env && trim($env) !== '') return [trim($env), 'env'];
    // Paling gampang: file teks berisi key saja -> tts_key.txt
    if (is_file("$dir/tts_key.txt")) {
        $t = trim((string)file_get_contents("$dir/tts_key.txt"));
        if ($t !== '') return [$t, 'tts_key.txt'];
    }
    // tts_config.php: return array / return string / define / $variabel
    if (is_file("$dir/tts_config.php")) {
        $cfg = include "$dir/tts_config.php";
        if (is_array($cfg)) {
            foreach (['key', 'api_key', 'apikey', 'ELEVENLABS_API_KEY'] as $f) {
                if (!empty($cfg[$f]) && trim($cfg[$f]) !== '') return [trim($cfg[$f]), 'tts_config.php'];
            }
        } elseif (is_string($cfg) && trim($cfg) !== '') {
            return [trim($cfg), 'tts_config.php(string)'];
        }
        if (defined('ELEVENLABS_API_KEY') && trim((string)ELEVENLABS_API_KEY) !== '') return [trim((string)ELEVENLABS_API_KEY), 'const'];
        foreach (['ELEVENLABS_API_KEY', 'key', 'apiKey', 'api_key'] as $v) {
            if (!empty($GLOBALS[$v]) && trim((string)$GLOBALS[$v]) !== '') return [trim((string)$GLOBALS[$v]), "\$$v"];
        }
    }
    return ['', 'none'];
}
list($API_KEY, $keySource) = read_api_key();

$action = isset($_GET['action']) ? $_GET['action'] : 'models';

if ($action === 'debug') {
    out(['ok' => true, 'php' => PHP_VERSION, 'curl' => function_exists('curl_init'),
         'allow_url_fopen' => (bool)ini_get('allow_url_fopen'),
         'has_tts_config' => is_file(__DIR__ . '/tts_config.php'),
         'has_tts_key_txt' => is_file(__DIR__ . '/tts_key.txt'),
         'key_source' => $keySource, 'key_len' => $API_KEY ? strlen($API_KEY) : 0]);
}

if (!$API_KEY) {
    out(['ok' => false, 'message' => 'API key belum terbaca (key_source=' . $keySource . '). Buka ?action=debug untuk detail. Cara paling gampang: buat file tts_key.txt di folder /api berisi KEY saja. Atau di tts_config.php: <?php return ["key"=>"sk_xxxx"]; (pastikan benar-benar terisi & tersimpan).']);
}

$BASE = 'https://api.elevenlabs.io/v1';
$jsonHeaders = ['xi-api-key: ' . $API_KEY, 'Accept: application/json'];

if ($action === 'models') {
    list($code, $body, , $err) = http_req("$BASE/models", $jsonHeaders);
    if ($code === 0) out(['ok' => false, 'message' => 'Gagal menghubungi ElevenLabs: ' . $err]);
    $json = json_decode($body, true);
    if ($code < 200 || $code >= 300) {
        $msg = is_array($json) && isset($json['detail']['message']) ? $json['detail']['message'] : "ElevenLabs HTTP $code";
        out(['ok' => false, 'message' => "Model gagal: $msg"]);
    }
    $models = [];
    if (is_array($json)) {
        foreach ($json as $m) {
            if (empty($m['model_id'])) continue;
            if (isset($m['can_do_text_to_speech']) && !$m['can_do_text_to_speech']) continue;
            $langs = [];
            if (!empty($m['languages']) && is_array($m['languages'])) {
                foreach ($m['languages'] as $l) $langs[] = ['id' => $l['language_id'] ?? '', 'name' => $l['name'] ?? ''];
            }
            $models[] = ['model_id' => $m['model_id'], 'name' => $m['name'] ?? $m['model_id'], 'languages' => $langs];
        }
    }
    out(['ok' => true, 'models' => $models]);
}

if ($action === 'voices') {
    list($code, $body) = http_req("$BASE/voices", $jsonHeaders);
    $json = json_decode($body, true);
    $voices = [];
    if (!empty($json['voices']) && is_array($json['voices'])) {
        foreach ($json['voices'] as $v) {
            $voices[] = ['voice_id' => $v['voice_id'] ?? '', 'name' => $v['name'] ?? '',
                         'labels' => $v['labels'] ?? (object)[], 'preview' => $v['preview_url'] ?? ''];
        }
    }
    out(['ok' => $code >= 200 && $code < 300, 'voices' => $voices]);
}

if ($action === 'tts') {
    $in = json_decode(file_get_contents('php://input'), true);
    if (!is_array($in)) $in = [];
    $text    = isset($in['text']) ? trim((string)$in['text']) : '';
    $voiceId = isset($in['voice_id']) ? (string)$in['voice_id'] : '';
    $modelId = isset($in['model_id']) ? (string)$in['model_id'] : 'eleven_multilingual_v2';
    if ($text === '' || $voiceId === '') out(['ok' => false, 'message' => 'text & voice_id wajib diisi.'], 400);
    if (function_exists('mb_strlen') && mb_strlen($text) > 1200) $text = mb_substr($text, 0, 1200);

    $payload = json_encode([
        'text'           => $text,
        'model_id'       => $modelId,
        'voice_settings' => [
            'stability'         => isset($in['stability']) ? (float)$in['stability'] : 0.5,
            'similarity_boost'  => isset($in['similarity_boost']) ? (float)$in['similarity_boost'] : 0.75,
            'style'             => isset($in['style']) ? (float)$in['style'] : 0.0,
            'use_speaker_boost' => true,
        ],
    ] + (!empty($in['language_code']) ? ['language_code' => (string)$in['language_code']] : []));

    $postHeaders = ['xi-api-key: ' . $API_KEY, 'Content-Type: application/json', 'Accept: audio/mpeg'];
    $url = "$BASE/text-to-speech/" . rawurlencode($voiceId) . '?output_format=mp3_44100_128';
    list($code, $body, $ctype, $err) = http_req($url, $postHeaders, 'POST', $payload);

    if ($code >= 200 && $code < 300 && $body !== '' && stripos((string)$ctype, 'audio') !== false) {
        while (ob_get_level()) ob_end_clean();
        header('Content-Type: audio/mpeg');
        header('Content-Length: ' . strlen($body));
        header('Cache-Control: no-store');
        echo $body;
        exit;
    }
    $j = json_decode((string)$body, true);
    $msg = $err ?: (isset($j['detail']['message']) ? $j['detail']['message'] : (isset($j['detail']) && is_string($j['detail']) ? $j['detail'] : "Gagal membuat audio (HTTP $code)."));
    out(['ok' => false, 'message' => $msg], 400);
}

out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
