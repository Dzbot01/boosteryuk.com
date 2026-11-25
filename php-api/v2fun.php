<?php
/**
 * v2fun.php — Proxy V2Fun (api.v2fun.ai) untuk menu Playground "Generate 3D Model".
 *
 * Upload ke: https://boosteryuk.com/api/v2fun.php
 * API key TIDAK boleh berada di browser. Set di server (jangan di-commit):
 *   - Env var:  V2FUN_API_KEY=...   (disarankan), atau
 *   - file api/v2fun_config.php berisi:  <?php return ['key' => 'vf_xxxx'];
 *
 * Aksi (?action= atau body JSON {action}):
 *   - generate : POST JSON {prompt?, image_data?, image_mime?, input_images?:{front?,left?,right?},
 *                           with_texture?, hd_texture?, pbr_texture?}
 *                → POST https://api.v2fun.ai/api/v1/3d_models/meshes (Bearer key)
 *                → { ok, task:{task_uuid,status,queue_position,...} }
 *                Gambar yang di-upload (data URI) disimpan sebentar di api/v2fun_uploads/
 *                lalu dikirim sebagai `input_image`/`input_images` berupa URL publik
 *                (kontrak API V2Fun menerima URL, bukan blob).
 *   - task     : {task_uuid} → GET /api/v1/3d_models/meshes/{task_uuid}
 *                → { ok, task:{status,result,metadata:{downloads:[{download_url,...}]}}}
 *   - debug    : { ok, php, curl, key_source }
 *
 * File upload sementara dibersihkan otomatis bila berusia > 24 jam.
 */

ob_start();
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function out($data, $status = 200) {
    while (ob_get_level()) ob_end_clean();
    if (!headers_sent()) { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); }
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
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
set_exception_handler(function ($ex) { out(['ok' => false, 'message' => 'Exception: ' . $ex->getMessage()]); });

/* ---------- API key (server-side) ---------- */
function v2fun_key() {
    $env = getenv('V2FUN_API_KEY');
    if (is_string($env) && $env !== '') return [$env, 'env'];
    $cfg = __DIR__ . '/v2fun_config.php';
    if (is_file($cfg)) {
        $c = include $cfg;
        if (is_array($c) && !empty($c['key'])) return [(string)$c['key'], 'v2fun_config.php'];
    }
    return ['', ''];
}

const V2FUN_BASE = 'https://api.v2fun.ai/api/v1';
const V2FUN_MAX_BYTES = 20971520; // 20 MB sesuai batas dokumen API

/** Simpan data URI ke api/v2fun_uploads/ dan kembalikan URL publiknya (kontrak API: URL). */
function v2fun_store_data_uri($dataUri, &$err) {
    if (!is_string($dataUri) || !preg_match('~^data:([a-z0-9.+-]+);base64,(.*)$~is', $dataUri, $m)) {
        $err = 'Format gambar tidak dikenali (harus data URI base64).';
        return null;
    }
    $mime = strtolower($m[1]);
    $ext = ['image/jpeg' => 'jpg', 'image/jpg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
    if ($ext === null) { $err = 'Tipe gambar tidak didukung: ' . $mime . ' (.jpg, .jpeg, .png, .webp saja).'; return null; }
    $bin = base64_decode($m[2], true);
    if ($bin === false || $bin === '') { $err = 'Isi base64 gambar tidak valid.'; return null; }
    if (strlen($bin) > V2FUN_MAX_BYTES) { $err = 'Ukuran gambar melebihi 20MB.'; return null; }
    $dir = __DIR__ . '/v2fun_uploads';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    v2fun_purge($dir);
    $name = 'v2f-' . bin2hex(random_bytes(8)) . '.' . $ext;
    if (@file_put_contents($dir . '/' . $name, $bin) === false) {
        $err = 'Gagal menyimpan gambar sementara di server (periksa izin tulis folder api/v2fun_uploads).';
        return null;
    }
    return v2fun_public_url('v2fun_uploads/' . $name);
}

/** URL publik file di folder api (dipakai V2Fun untuk menarik gambar). */
function v2fun_public_url($rel) {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
    $host = $_SERVER['HTTP_HOST'] ?? 'boosteryuk.com';
    $base = ($https ? 'https://' : 'http://') . $host;
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api/v2fun.php')), '/');
    return $base . $path . '/' . $rel;
}

/** Bersihkan file upload sementara yang berusia > 24 jam. */
function v2fun_purge($dir) {
    $now = time();
    foreach (glob($dir . '/v2f-*') ?: [] as $f) {
        if (is_file($f) && $now - (int)filemtime($f) > 86400) @unlink($f);
    }
}

/** Kirim request ke V2Fun dengan Bearer token; balasan JSON diteruskan apa adanya. */
function v2fun_call($method, $path, $key, $body = null) {
    $ch = curl_init(V2FUN_BASE . $path);
    $heads = ['Authorization: Bearer ' . $key, 'Content-Type: application/json', 'Accept: application/json'];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $heads,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    $raw = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $cerr = curl_error($ch);
    curl_close($ch);
    if ($raw === false || $raw === '') return [$code ?: 502, ['ok' => false, 'message' => 'Gagal menghubungi api.v2fun.ai: ' . ($cerr !== '' ? $cerr : 'respons kosong')]];
    $j = json_decode($raw, true);
    if (!is_array($j)) $j = ['ok' => false, 'message' => 'Respons V2Fun bukan JSON: ' . substr($raw, 0, 300)];
    return [$code, $j];
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
$action = (string)($in['action'] ?? ($_GET['action'] ?? ''));

if ($action === 'debug') {
    [$key, $src] = v2fun_key();
    out(['ok' => true, 'php' => PHP_VERSION, 'curl' => function_exists('curl_init'), 'key_source' => $src !== '' ? $src : 'belum diset', 'key_set' => $key !== '']);
}

[$KEY, $SRC] = v2fun_key();
if ($KEY === '') {
    out(['ok' => false, 'message' => 'API key V2Fun belum diset di server. Set env V2FUN_API_KEY atau buat file api/v2fun_config.php berisi <?php return [\'key\' => \'...\'];'], 500);
}

/* ---------- generate: Text-to-3D / Image-to-3D / Multi-view ---------- */
if ($action === 'generate') {
    $payload = [];
    $prompt = trim((string)($in['prompt'] ?? ''));
    if ($prompt !== '') $payload['prompt'] = mb_substr($prompt, 0, 2000);

    if (!empty($in['image_data'])) {
        $url = v2fun_store_data_uri((string)$in['image_data'], $err);
        if ($url === null) out(['ok' => false, 'message' => $err], 422);
        $payload['input_image'] = $url;
    }
    if (!empty($in['input_images']) && is_array($in['input_images'])) {
        $maps = [];
        foreach (['front', 'left', 'right'] as $side) {
            if (empty($in['input_images'][$side])) continue;
            $url = v2fun_store_data_uri((string)$in['input_images'][$side], $err);
            if ($url === null) out(['ok' => false, 'message' => 'Gambar ' . $side . ': ' . $err], 422);
            $maps[$side] = $url;
        }
        if ($maps) $payload['input_images'] = $maps;
    }
    if ($prompt === '' && empty($payload['input_image']) && empty($payload['input_images'])) {
        out(['ok' => false, 'message' => 'Isi prompt teks atau unggah gambar referensi dulu.'], 400);
    }
    // Opsi keluaran sesuai dokumen: white mesh / textured / PBR / 8K HD.
    $payload['with_texture'] = (bool)($in['with_texture'] ?? true);
    if ($payload['with_texture']) {
        if (!empty($in['hd_texture'])) $payload['hd_texture'] = true;
        if (!empty($in['pbr_texture'])) $payload['pbr_texture'] = true;
    }

    [$code, $j] = v2fun_call('POST', '/3d_models/meshes', $KEY, $payload);
    if ($code < 200 || $code >= 300 || empty($j['task_uuid'])) {
        $msg = is_array($j) ? (string)($j['message'] ?? $j['error'] ?? json_encode($j)) : 'respons tidak dikenali';
        out(['ok' => false, 'status' => $code, 'message' => 'V2Fun menolak request (HTTP ' . $code . '): ' . $msg], $code >= 400 ? $code : 502);
    }
    out(['ok' => true, 'task' => $j]);
}

/* ---------- task: polling status & hasil ---------- */
if ($action === 'task') {
    $uuid = trim((string)($in['task_uuid'] ?? ($_GET['task_uuid'] ?? '')));
    if (!preg_match('/^[0-9a-f-]{8,64}$/i', $uuid)) out(['ok' => false, 'message' => 'task_uuid tidak valid.'], 400);
    [$code, $j] = v2fun_call('GET', '/3d_models/meshes/' . rawurlencode($uuid), $KEY);
    if ($code < 200 || $code >= 300) {
        $msg = is_array($j) ? (string)($j['message'] ?? $j['error'] ?? json_encode($j)) : 'respons tidak dikenali';
        out(['ok' => false, 'status' => $code, 'message' => 'Gagal membaca status task (HTTP ' . $code . '): ' . $msg], $code);
    }
    out(['ok' => true, 'task' => $j]);
}

out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
