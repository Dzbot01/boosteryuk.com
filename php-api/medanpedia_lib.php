<?php
/**
 * medanpedia_lib.php — helper Server 3 (https://api.medanpedia.co.id).
 *
 * - API key hanya hidup di medanpedia_config.php (sisi server, tidak di Git).
 * - Semua permintaan pakai cURL dengan validasi TLS dan timeout; tanpa follow redirect.
 * - Katalog layanan di-cache 10 menit (medanpedia_services_cache.json).
 * - Balasan provider {status:true,msg,data:[...]} dinormalisasi ke bentuk internal
 *   yang sama dengan servicesApi.ts: id,name,category,type,rate,min,max,refill,description.
 */

function mp_config() {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $file = __DIR__ . '/medanpedia_config.php';
    if (!is_file($file)) throw new RuntimeException('medanpedia_config.php belum ada di /api. Upload contoh konfigurasi lalu isi key Server 3.');
    $MP_BASE_URL = null; $MP_API_KEY = null;
    require $file;
    if (!is_string($MP_BASE_URL) || $MP_BASE_URL === '' || !is_string($MP_API_KEY) || $MP_API_KEY === '' || str_contains($MP_API_KEY, 'ISI_KEY')) {
        throw new RuntimeException('Konfigurasi Server 3 belum lengkap (base url / key).');
    }
    $cfg = [rtrim($MP_BASE_URL, '/'), $MP_API_KEY];
    return $cfg;
}

/** Penolakan eksplisit dari provider (status:false) — beda kelas agar order bisa refund aman. */
class MpReject extends RuntimeException {}

function mp_transport_cache_read() {
    $f = __DIR__ . '/medanpedia_transport_cache.json';
    if (is_file($f)) { $j = json_decode((string)@file_get_contents($f), true); if (is_array($j) && isset($j['t'])) return (int)$j['t']; }
    return null;
}
function mp_transport_cache_write($t) { @file_put_contents(__DIR__ . '/medanpedia_transport_cache.json', json_encode(['t' => $t]), LOCK_EX); }

/**
 * Satu percobaan transport: 0=POST form, 1=GET query, 2=POST JSON.
 * @return array{json: ?array, code: int, error: string}
 */
function mp_attempt($url, array $post, $transport) {
    $common = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => false,
    ];
    $ch = curl_init();
    if ($transport === 1) {
        curl_setopt_array($ch, $common + [CURLOPT_URL => $url . (str_contains($url, '?') ? '&' : '?') . http_build_query($post), CURLOPT_HTTPHEADER => ['Accept: application/json']]);
    } elseif ($transport === 2) {
        curl_setopt_array($ch, $common + [CURLOPT_URL => $url, CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($post), CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json']]);
    } else {
        curl_setopt_array($ch, $common + [CURLOPT_URL => $url, CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($post), CURLOPT_HTTPHEADER => ['Accept: application/json']]);
    }
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($raw === false) return ['json' => null, 'code' => $code, 'error' => 'Server 3 tidak dapat dihubungi: ' . ($err !== '' ? $err : 'timeout')];
    $j = json_decode((string)$raw, true);
    if (!is_array($j)) return ['json' => null, 'code' => $code, 'error' => 'Server 3 membalas format tidak dikenali (HTTP ' . $code . ').'];
    return ['json' => $j, 'code' => $code, 'error' => ''];
}

function mp_is_retryable_msg($msg) {
    return (bool)preg_match('/permintaan tidak valid|invalid request|bad request|method not allowed|tidak didukung|unsupported/i', (string)$msg);
}

/**
 * Panggil API Server 3 dengan transport adaptif: bentuk permintaan yang pernah berhasil
 * di-cache; bila provider menolak dengan "permintaan tidak valid" (bentuk salah), coba
 * bentuk lain untuk endpoint baca. Endpoint_mutating ($mutating=true: order/refill)
 * TIDAK pernah di-retry agar tidak mengirim ganda — pakai transport cache saja.
 * Pesan error asli provider selalu diteruskan lewat exception.
 */
function mp_http($path, array $post = [], $mutating = false) {
    list($base, $key) = mp_config();
    $post = array_merge(['key' => $key], $post);
    $url = $base . '/' . ltrim((string)$path, '/');
    $cached = mp_transport_cache_read();
    if ($cached !== null) $order = [$cached];
    else $order = $mutating ? [0] : [0, 1, 2];
    $lastMsg = '';
    foreach ($order as $t) {
        $r = mp_attempt($url, $post, $t);
        if ($r['json'] !== null) {
            if (($r['json']['status'] ?? null) !== false) {
                if ($cached !== $t) mp_transport_cache_write($t);
                return $r['json'];
            }
            $msg = (string)($r['json']['msg'] ?? 'Server 3 menolak permintaan.');
            if ($mutating || !mp_is_retryable_msg($msg)) throw new MpReject($msg); // error asli server
            $lastMsg = $msg;
            continue; // bentuk permintaan ditolak → coba transport berikut (endpoint baca)
        }
        if ($mutating || !in_array($r['code'], [400, 405, 415], true)) throw new RuntimeException($r['error']);
        $lastMsg = $r['error'];
    }
    throw new MpReject($lastMsg !== '' ? $lastMsg : 'Server 3 menolak permintaan.');
}

/** Panggil API Server 3; balasan status:true dikembalikan, status:false = MpReject. */
function mp_call($path, array $post = [], $mutating = false) {
    return mp_http($path, $post, $mutating);
}

function mp_cache_read($name, $ttl) {
    $f = __DIR__ . '/medanpedia_' . $name . '_cache.json';
    if (!is_file($f) || time() - filemtime($f) >= $ttl) return null;
    $j = json_decode((string)@file_get_contents($f), true);
    return is_array($j) ? $j : null;
}
function mp_cache_write($name, $data) { @file_put_contents(__DIR__ . '/medanpedia_' . $name . '_cache.json', json_encode($data), LOCK_EX); }

/** Katalog layanan Server 3 ternormalisasi (cache 10 menit). */
function mp_catalogue() {
    $c = mp_cache_read('services', 600);
    if ($c && !empty($c['services'])) return $c;
    $j = mp_call('services');
    $list = $j['data'] ?? null;
    if (!is_array($list) || !$list) throw new RuntimeException('Daftar layanan Server 3 kosong.');
    $services = [];
    foreach ($list as $s) {
        if (!is_array($s)) continue;
        $id = (string)($s['id'] ?? '');
        $name = trim((string)($s['name'] ?? ''));
        $price = $s['price'] ?? null;
        if ($id === '' || $name === '' || !is_numeric($price)) continue;
        $services[] = [
            'id' => $id,
            'name' => $name,
            'category' => trim((string)($s['category'] ?? '')) !== '' ? trim((string)$s['category']) : 'Lainnya',
            'type' => strtolower(trim((string)($s['type'] ?? 'default'))),
            'rate' => (float)$price, // Rp per 1000, format sama seperti Server 1
            'min' => (int)($s['min'] ?? 1),
            'max' => (int)($s['max'] ?? 0),
            'refill' => ((int)($s['refill'] ?? 0)) === 1,
            'cancel' => false,
            'description' => trim((string)($s['description'] ?? '')),
            'average_time' => trim((string)($s['average_time'] ?? '')),
        ];
    }
    if (!$services) throw new RuntimeException('Layanan Server 3 tidak valid.');
    $data = ['services' => $services];
    mp_cache_write('services', $data);
    return $data;
}

/** Validasi layanan + jumlah terhadap katalog Server 3; lempar exception bila tidak cocok. */
function mp_validate_service($serviceId, $qty) {
    $cat = mp_catalogue();
    foreach ($cat['services'] as $s) {
        if ($s['id'] !== (string)$serviceId) continue;
        $qty = (int)$qty;
        if ($qty < $s['min'] || ($s['max'] > 0 && $qty > $s['max'])) {
            throw new RuntimeException('Jumlah di luar batas layanan Server 3 (' . $s['min'] . '–' . ($s['max'] > 0 ? $s['max'] : '∞') . ').');
        }
        return $s;
    }
    throw new RuntimeException('Layanan Server 3 tidak ditemukan.');
}

/** Kategori Google Maps Review (varian penulisan) — satu-satunya yang tampil publik saat ini. */
function mp_is_gm_review($category) {
    $c = (string)$category;
    return (bool)preg_match('/google\s*(maps?)?\s*review/i', $c) || stripos($c, 'google map') !== false;
}

/** Subset publik: kategori + layanan Google Maps Review saja. */
function mp_gm_review() {
    $cat = mp_catalogue();
    $services = array_values(array_filter($cat['services'], fn($s) => mp_is_gm_review($s['category'])));
    $categories = array_values(array_unique(array_map(fn($s) => $s['category'], $services)));
    return ['categories' => $categories, 'services' => $services];
}
