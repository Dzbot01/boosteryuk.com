<?php
/**
 * tts.php — Proxy ElevenLabs untuk menu "Teks To Speech" Playground.
 *
 * Upload ke: https://boosteryuk.com/api/tts.php
 * API key TIDAK boleh di browser. Set di server (jangan di-commit):
 *   - Env var:  ELEVENLABS_API_KEY=...    (disarankan)
 *   - atau buat file api/tts_config.php berisi: <?php return ['key' => 'xi-...'];
 *
 * Aksi (query ?action=):
 *   - models  : GET daftar model TTS         -> { ok, models:[{model_id,name,languages:[...] }] }
 *   - voices  : GET daftar suara user         -> { ok, voices:[{voice_id,name,labels}] }
 *   - tts     : POST hasilkan audio (mp3)     -> audio/mpeg (binary)
 *               body JSON: { text, voice_id, model_id, language_code?,
 *                            stability?, similarity_boost?, style? }
 */

function send_json($data, $status = 200) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code($status);
    echo json_encode($data);
    exit;
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- Ambil API key dari server (bukan dari client) ----
$API_KEY = getenv('ELEVENLABS_API_KEY');
if (!$API_KEY && is_file(__DIR__ . '/tts_config.php')) {
    $cfg = include __DIR__ . '/tts_config.php';
    if (is_array($cfg) && !empty($cfg['key'])) $API_KEY = $cfg['key'];
}
if (!$API_KEY) {
    send_json(['ok' => false, 'message' => 'ELEVENLABS_API_KEY belum diset di server.'], 500);
}

$BASE = 'https://api.elevenlabs.io/v1';
$action = isset($_GET['action']) ? $_GET['action'] : 'models';

/** Panggil ElevenLabs. Mengembalikan [httpCode, body, contentType]. */
function el_call($url, $apiKey, $method = 'GET', $jsonBody = null) {
    $ch = curl_init($url);
    $headers = ['xi-api-key: ' . $apiKey, 'Accept: application/json'];
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_SSL_VERIFYPEER => true,
    ];
    if ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = json_encode($jsonBody);
        $headers[] = 'Content-Type: application/json';
        $headers[] = 'Accept: audio/mpeg';
    }
    $opts[CURLOPT_HTTPHEADER] = $headers;
    curl_setopt_array($ch, $opts);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $ctype = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    return [$code, $body, $ctype];
}

if ($action === 'models') {
    list($code, $body) = el_call("$BASE/models", $API_KEY);
    $json = json_decode($body, true);
    $models = [];
    if (is_array($json)) {
        foreach ($json as $m) {
            if (empty($m['model_id'])) continue;
            // hanya model yang bisa text-to-speech
            if (isset($m['can_do_text_to_speech']) && !$m['can_do_text_to_speech']) continue;
            $langs = [];
            if (!empty($m['languages']) && is_array($m['languages'])) {
                foreach ($m['languages'] as $l) {
                    $langs[] = ['id' => $l['language_id'] ?? '', 'name' => $l['name'] ?? ''];
                }
            }
            $models[] = [
                'model_id'  => $m['model_id'],
                'name'      => $m['name'] ?? $m['model_id'],
                'languages' => $langs,
            ];
        }
    }
    send_json(['ok' => $code >= 200 && $code < 300, 'models' => $models, 'code' => $code]);
}

if ($action === 'voices') {
    list($code, $body) = el_call("$BASE/voices", $API_KEY);
    $json = json_decode($body, true);
    $voices = [];
    if (!empty($json['voices']) && is_array($json['voices'])) {
        foreach ($json['voices'] as $v) {
            $voices[] = [
                'voice_id' => $v['voice_id'] ?? '',
                'name'     => $v['name'] ?? '',
                'labels'   => $v['labels'] ?? new stdClass(),
                'preview'  => $v['preview_url'] ?? '',
            ];
        }
    }
    send_json(['ok' => $code >= 200 && $code < 300, 'voices' => $voices, 'code' => $code]);
}

if ($action === 'tts') {
    $raw = file_get_contents('php://input');
    $in = json_decode($raw, true);
    if (!is_array($in)) $in = [];
    $text = isset($in['text']) ? trim((string)$in['text']) : '';
    $voiceId = isset($in['voice_id']) ? (string)$in['voice_id'] : '';
    $modelId = isset($in['model_id']) ? (string)$in['model_id'] : 'eleven_multilingual_v2';
    if ($text === '' || $voiceId === '') {
        send_json(['ok' => false, 'message' => 'text & voice_id wajib diisi.'], 400);
    }
    // batasi panjang agar hemat kuota
    if (mb_strlen($text) > 1200) $text = mb_substr($text, 0, 1200);

    $voiceSettings = [
        'stability'         => isset($in['stability']) ? (float)$in['stability'] : 0.5,
        'similarity_boost'  => isset($in['similarity_boost']) ? (float)$in['similarity_boost'] : 0.75,
        'style'             => isset($in['style']) ? (float)$in['style'] : 0.0,
        'use_speaker_boost' => true,
    ];
    $payload = [
        'text'           => $text,
        'model_id'       => $modelId,
        'voice_settings' => $voiceSettings,
    ];
    if (!empty($in['language_code'])) $payload['language_code'] = (string)$in['language_code'];

    $url = "$BASE/text-to-speech/" . rawurlencode($voiceId) . '?output_format=mp3_44100_128';
    list($code, $body, $ctype) = el_call($url, $API_KEY, 'POST', $payload);

    if ($code >= 200 && $code < 300 && $body !== false && strpos((string)$ctype, 'audio') !== false) {
        header('Content-Type: audio/mpeg');
        header('Content-Length: ' . strlen($body));
        header('Cache-Control: no-store');
        echo $body;
        exit;
    }
    // error -> teruskan pesan
    $msg = 'Gagal membuat audio.';
    $j = json_decode((string)$body, true);
    if (isset($j['detail']['message'])) $msg = $j['detail']['message'];
    elseif (isset($j['detail']) && is_string($j['detail'])) $msg = $j['detail'];
    send_json(['ok' => false, 'message' => $msg, 'code' => $code], 400);
}

send_json(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
