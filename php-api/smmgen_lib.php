<?php
/**
 * smmgen_lib.php — klien API SMMGen (tampil sebagai "Server 3" di UI, internal server=4).
 *
 * Dokumen provider: POST form-encoded ke https://my.smmgen.com/api/v2 dengan param
 * `key` (API key) + `action` (services|add|status|refill|refill_status|cancel|balance)
 * dan param tambahan per aksi; respons JSON. Kesalahan eksplisit provider datang sebagai
 * {"error": "..."} dan dilempar sebagai SmgReject supaya pemanggil bisa refund/auto-deteksi.
 * Kredensial hanya dibaca dari smmgen_config.php di sisi server.
 */

class SmgReject extends RuntimeException {}

function smg_config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $SMG_BASE_URL = 'https://my.smmgen.com/api/v2';
    $SMG_API_KEY = '';
    $f = __DIR__ . '/smmgen_config.php';
    if (!is_file($f)) throw new RuntimeException('smmgen_config.php belum ada di /api. Upload config Server 3 (SMMGen).');
    require $f;
    $key = trim((string)$SMG_API_KEY);
    if ($key === '' || strpos($key, 'GANTI_') === 0) throw new RuntimeException('API key Server 3 (SMMGen) belum diisi di smmgen_config.php.');
    $cfg = [rtrim((string)$SMG_BASE_URL, '/'), $key];
    return $cfg;
}

function smg_http(array $post): string {
    list($base, $key) = smg_config();
    unset($key); // key dikirim lewat $post oleh smg_call
    $ch = curl_init($base);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($post),
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_USERAGENT => 'Boosteryuk-SMMGen/1.0',
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false || $raw === '') throw new RuntimeException('Server 3 (SMMGen) tidak dapat dihubungi: ' . ($err !== '' ? $err : 'respons kosong.'));
    return (string)$raw;
}

function smg_call(string $action, array $post = []): array {
    list(, $key) = smg_config();
    $raw = smg_http(array_merge(['key' => $key, 'action' => $action], $post));
    $parsed = json_decode($raw, true);
    if (!is_array($parsed)) throw new RuntimeException('Server 3 (SMMGen) membalas format tidak dikenal.');
    if (isset($parsed['error'])) throw new SmgReject((string)$parsed['error']);
    return $parsed;
}

/** Kurs USD→IDR harian (sumber sama dengan Server 2) untuk menormalkan tarif jadi IDR/1000. */
function smg_fx(): float {
    $cache = __DIR__ . '/smmgen_fx_cache.json';
    $j = is_file($cache) ? json_decode((string)file_get_contents($cache), true) : null;
    $valid = is_array($j) && isset($j['rate'], $j['ts']) && is_numeric($j['rate']) && (time() - (int)$j['ts']) < 86400;
    if (!$valid) {
        $ch = curl_init('https://open.er-api.com/v6/latest/USD');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 15]);
        $raw = curl_exec($ch);
        curl_close($ch);
        $parsed = is_string($raw) ? json_decode($raw, true) : null;
        $rate = (float)($parsed['rates']['IDR'] ?? 0);
        if (!is_array($parsed) || $rate <= 0) throw new RuntimeException('Kurs USD ke rupiah untuk Server 3 belum dapat diverifikasi.');
        $j = ['rate' => $rate, 'ts' => time()];
        @file_put_contents($cache, json_encode($j));
    }
    return (float)$j['rate'];
}

/** Katalog layanan (cache 600 dtk); tarif USD dikonversi ke IDR per 1000 agar setara server lain. */
function smg_catalogue(): array {
    $cache = __DIR__ . '/smmgen_services_cache.json';
    $j = is_file($cache) ? json_decode((string)file_get_contents($cache), true) : null;
    if (!is_array($j) || !isset($j['ts'], $j['services']) || (time() - (int)$j['ts']) > 600) {
        $list = smg_call('services');
        $services = array_values(array_filter($list, 'is_array'));
        if (!$services) throw new RuntimeException('Katalog Server 3 (SMMGen) kosong atau tidak valid.');
        $fx = smg_fx();
        foreach ($services as &$s) {
            $usd = (float)($s['rate'] ?? 0);
            $s['rate'] = (int)ceil($usd * $fx);
        }
        unset($s);
        $j = ['ts' => time(), 'services' => $services];
        @file_put_contents($cache, json_encode($j));
    }
    return $j['services'];
}

function smg_validate_service($id, $qty): array {
    foreach (smg_catalogue() as $s) {
        if ((string)($s['service'] ?? '') === (string)$id) {
            $min = (int)($s['min'] ?? 1);
            $max = (int)($s['max'] ?? 0);
            if ((int)$qty < $min || ($max > 0 && (int)$qty > $max)) throw new RuntimeException('Jumlah order di luar rentang layanan Server 3.');
            return $s;
        }
    }
    throw new RuntimeException('Layanan Server 3 (SMMGen) tidak ditemukan.');
}

/** Saldo akun provider (USD) — hanya dipakai halaman admin My Profit. */
function smg_balance(): array {
    return smg_call('balance');
}
