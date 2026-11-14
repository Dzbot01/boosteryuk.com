<?php
/**
 * order_price.php — hitung HARGA ORDER SMM di server (dipakai order.php).
 *
 * Sebelumnya order.php memotong saldo sebesar `price` kiriman browser → siapa pun bisa mengirim
 * price=1. Sekarang: tarif layanan diambil dari provider (sama dengan services.php), lalu
 *   harga per 1000 = tarif + markup web (Rp4.425, atau Rp1.000 untuk member Plus)
 *   child panel   : × (1 + markup SMM panel %), dibulatkan ke atas   (sama dengan servicesApi.ts)
 *   total         = round(qty / 1000 × harga per 1000)
 * Daftar layanan di-cache 10 menit (file services_cache.json di folder ini).
 *
 * Cek dari browser (admin): /api/order_price.php?check=<id layanan>&qty=1000
 */

if (!function_exists('array_is_list')) {
    function array_is_list(array $a) { return $a === [] || array_keys($a) === range(0, count($a) - 1); }
}

const BK_MARKUP_PER_1000      = 4425;
const BK_MARKUP_PLUS_PER_1000 = 1000;
const BK_SERVICES_CACHE_TTL   = 600;

function bk_num($v) {
    if ($v === null || $v === '') return null;
    $n = (float)str_replace(',', '.', preg_replace('/[^\d.,-]/', '', (string)$v));
    return is_finite($n) ? $n : null;
}

/** Ambil array layanan dari bentuk balasan apa pun (sama dengan extractList di servicesApi.ts). */
function bk_extract_services($data) {
    if (!is_array($data)) return null;
    if (array_is_list($data)) return $data;
    if (($data['status'] ?? null) === false) return null;
    foreach (['services', 'data', 'result', 'list'] as $k) if (isset($data[$k]) && is_array($data[$k]) && array_is_list($data[$k])) return $data[$k];
    $vals = array_values(array_filter($data, fn($v) => is_array($v) && isset($v['name'])));
    return $vals ?: null;
}

/** Peta id layanan → tarif provider (Rp per 1000). null bila tidak bisa dimuat. */
function bk_service_rates($apiId, $apiKey, $baseUrl) {
    $cache = __DIR__ . '/services_cache.json';
    if (is_file($cache) && time() - filemtime($cache) < BK_SERVICES_CACHE_TTL) {
        $c = json_decode((string)@file_get_contents($cache), true);
        if (is_array($c) && $c) return $c;
    }
    $ch = curl_init(rtrim((string)$baseUrl, '/') . '/services');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query(['api_id' => (int)$apiId, 'api_key' => $apiKey]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $res = curl_exec($ch);
    curl_close($ch);
    $list = bk_extract_services(json_decode((string)$res, true));
    if (!$list) return null;
    $rates = [];
    foreach ($list as $s) {
        if (!is_array($s)) continue;
        $id = (string)($s['service'] ?? $s['id'] ?? $s['service_id'] ?? '');
        $rate = bk_num($s['rate'] ?? $s['price'] ?? $s['harga'] ?? null);
        if ($id !== '' && $rate !== null) $rates[$id] = $rate;
    }
    if (!$rates) return null;
    @file_put_contents($cache, json_encode($rates));
    return $rates;
}

/**
 * Harga order (Rp) yang dihitung server.
 * @return array ['price'=>float|null, 'base'=>float|null (tanpa markup child panel), 'tenant'=>array|null]
 *         price null + unknown=false → daftar layanan provider tidak bisa dimuat (cadangan: harga kiriman);
 *         price null + unknown=true  → ID layanan tidak ada di daftar → order ditolak.
 */
function bk_order_price($conn, $userId, $serviceId, $qty, $apiId, $apiKey, $baseUrl) {
    $tenant = null;
    if (is_file(__DIR__ . '/child_panel_lib.php')) {
        require_once __DIR__ . '/child_panel_lib.php';
        try { $tenant = cp_resolve($conn); } catch (Throwable $e) { $tenant = null; }
    }
    $rates = bk_service_rates($apiId, $apiKey, $baseUrl);
    if (!$rates) return ['price' => null, 'base' => null, 'tenant' => $tenant, 'unknown' => false];
    if (!isset($rates[(string)$serviceId])) return ['price' => null, 'base' => null, 'tenant' => $tenant, 'unknown' => true];

    $plus = false;
    try {
        $st = $conn->prepare("SELECT plus_active FROM users WHERE id = ? LIMIT 1");
        $st->bind_param('i', $userId);
        $st->execute();
        $plus = !empty($st->get_result()->fetch_assoc()['plus_active']);
        $st->close();
    } catch (Throwable $e) { $plus = false; } // kolom belum ada → harga normal

    $perK = $rates[(string)$serviceId] + ($plus ? BK_MARKUP_PLUS_PER_1000 : BK_MARKUP_PER_1000);
    $base = round(($qty / 1000) * $perK);
    $perKPanel = $tenant ? cp_apply_markup($perK, $tenant, 'smm') : $perK;
    $price = round(($qty / 1000) * $perKPanel);
    return ['price' => (float)$price, 'base' => (float)min($base, $price), 'tenant' => $tenant, 'unknown' => false];
}

/* ---- cek manual: /api/order_price.php?check=123&qty=1000 (tanpa login; hanya menampilkan tarif) ---- */
if (realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '') && isset($_GET['check'])) {
    header('Content-Type: application/json; charset=utf-8');
    require 'config.php';
    $rates = bk_service_rates($API_ID ?? '', $API_KEY ?? '', $BASE_URL ?? '');
    $id = (string)$_GET['check'];
    $qty = max(1, (int)($_GET['qty'] ?? 1000));
    if (!$rates) { echo json_encode(['ok' => false, 'message' => 'Daftar layanan provider tidak bisa dimuat — harga dari browser masih dipakai sebagai cadangan.']); exit; }
    $r = $rates[$id] ?? null;
    echo json_encode(['ok' => $r !== null, 'services_loaded' => count($rates), 'service' => $id, 'rate_per_1000' => $r,
        'harga_normal' => $r === null ? null : round($qty / 1000 * ($r + BK_MARKUP_PER_1000)),
        'harga_plus' => $r === null ? null : round($qty / 1000 * ($r + BK_MARKUP_PLUS_PER_1000))]);
    exit;
}
