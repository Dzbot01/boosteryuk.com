<?php
/**
 * otp.php — Order Nomor (OTP) realtime, dibayar dengan SALDO akun.
 * Alur & harga mengikuti bot Paimon (lib/otp.js + lib/order.js):
 *   layanan → negara → daftar tier harga (stok realtime) → beli nomor → tunggu kode (maks 15 menit)
 *   → selesai | batal/timeout = aktivasi dibatalkan + saldo dikembalikan di DATABASE.
 * Harga jual = ceil((usd × kurs + max(usd × kurs × markup%, markupMin)) / pembulatan) × pembulatan
 * Child panel: × (1 + markup_otp_pct%) dibulatkan ke atas; selisihnya = pendapatan panel.
 * Nama provider TIDAK pernah dikirim ke browser.
 *
 * GET  ?action=services                          → [{code,name}]
 * GET  ?action=countries                         → [{id,name}]
 * GET  ?action=prices&service=wa&country=6       → {tiers:[{harga,stok}]}
 * POST {token, action:'buy', service, country, harga}
 * POST {token, action:'status', order_id}       (dipanggil berkala oleh halaman; juga memproses timeout)
 * POST {token, action:'cancel', order_id}
 * POST {token, action:'list'}                    → order OTP terbaru user
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
error_reporting(0);

require 'configdb.php';
require_once __DIR__ . '/child_panel_lib.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

if (!function_exists('array_is_list')) {
    function array_is_list(array $a) { return $a === [] || array_keys($a) === range(0, count($a) - 1); }
}

function otp_out($d, $code = 200) { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }

function otp_cfg() {
    static $c = null;
    if ($c !== null) return $c;
    $f = is_file(__DIR__ . '/otp_config.php') ? (include __DIR__ . '/otp_config.php') : [];
    $c = (is_array($f) ? $f : []) + ['api_key' => '', 'base_url' => 'https://smsbower.page/stubs/handler_api.php', 'timeout' => 15,
        'kurs' => 17000, 'markup_persen' => 20, 'markup_min' => 1000, 'pembulatan' => 100, 'sms_maks_menit' => 15, 'maks_aktif' => 3];
    if (getenv('OTP_API_KEY')) $c['api_key'] = getenv('OTP_API_KEY');
    if (getenv('OTP_BASE_URL')) $c['base_url'] = getenv('OTP_BASE_URL'); // uji lokal
    return $c;
}

/* ===================== klien API provider ===================== */
class OtpErr extends Exception { public $kode; public function __construct($kode, $msg = '') { parent::__construct($msg ?: $kode); $this->kode = $kode; } }

function otp_call($action, $params = []) {
    $cfg = otp_cfg();
    if (!$cfg['api_key']) throw new OtpErr('NO_KEY', 'Layanan OTP belum diaktifkan admin.');
    $q = ['api_key' => $cfg['api_key'], 'action' => $action];
    foreach ($params as $k => $v) if ($v !== null && $v !== '') $q[$k] = $v;
    $ch = curl_init($cfg['base_url'] . '?' . http_build_query($q));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => (int)$cfg['timeout']]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($body === false || $code >= 400) throw new OtpErr('NETWORK', 'Server OTP tidak merespons.');
    $t = trim((string)$body);
    if (preg_match('/^(BAD_KEY|BAD_ACTION|BAD_SERVICE|NO_BALANCE|BANNED|ERROR_SQL)/i', $t, $m)) throw new OtpErr(strtoupper($m[1]));
    return $t;
}

function otp_json($t) { $j = json_decode($t, true); if (!is_array($j)) throw new OtpErr('BAD_JSON'); return $j; }

/** Cache file sederhana (folder ini). */
function otp_cache($key, $ttl, callable $fn) {
    $f = __DIR__ . '/otp_cache_' . preg_replace('/[^a-z0-9_]/i', '_', $key) . '.json';
    if (is_file($f) && time() - filemtime($f) < $ttl) {
        $v = json_decode((string)@file_get_contents($f), true);
        if (is_array($v)) return $v;
    }
    $v = $fn();
    @file_put_contents($f, json_encode($v));
    return $v;
}

/** Baca cache tanpa memanggil API (untuk nama layanan/negara saat membeli). */
function otp_cache_peek($key) {
    $f = __DIR__ . '/otp_cache_' . preg_replace('/[^a-z0-9_]/i', '_', $key) . '.json';
    $v = is_file($f) ? json_decode((string)@file_get_contents($f), true) : null;
    return is_array($v) ? $v : [];
}

/** Pesan untuk user — tanpa nama provider. Detail asli dicatat di log server. */
function otp_friendly($kode) {
    $map = [
        'NO_NUMBERS' => 'Stok nomor sedang habis. Coba harga atau negara lain.',
        'WRONG_MAX_PRICE' => 'Harga stok berubah. Muat ulang daftar harga lalu pilih lagi.',
        'NO_BALANCE' => 'Layanan OTP sedang gangguan. Coba lagi nanti.',
        'NO_KEY' => 'Layanan OTP belum diaktifkan admin.',
        'BANNED' => 'Layanan OTP sedang gangguan. Coba lagi nanti.',
        'NETWORK' => 'Server OTP tidak merespons. Coba lagi sebentar.',
    ];
    return $map[$kode] ?? 'Layanan OTP sedang sibuk. Coba lagi sebentar.';
}

function otp_log($msg) { @file_put_contents(__DIR__ . '/otp_log.txt', date('Y-m-d H:i:s') . ' ' . $msg . "\n", FILE_APPEND); }

/* ===================== harga ===================== */
function otp_harga_jual($usd) {
    $c = otp_cfg();
    $dasar = (float)$usd * $c['kurs'];
    $margin = max($dasar * $c['markup_persen'] / 100, $c['markup_min']);
    $b = max(1, (int)$c['pembulatan']);
    return ceil(($dasar + $margin) / $b) * $b;
}

/** Harga di child panel (markup OTP panel, dibulatkan ke atas ke Rp100). */
function otp_harga_panel($harga, $tenant) {
    if (!$tenant) return $harga;
    $pct = max(0, min(CP_MAX_MARKUP, (float)($tenant['markup_otp_pct'] ?? 0)));
    return $pct > 0 ? ceil($harga * (1 + $pct / 100) / 100) * 100 : $harga;
}

/** Semua tier satu layanan+negara: [{usd, harga (web utama), stok}] urut termurah, harga sama digabung. */
function otp_tiers($service, $country) {
    $data = otp_json(otp_call('getPricesV2', ['service' => $service, 'country' => $country]));
    $node = $data[(string)$country] ?? (count($data) === 1 ? reset($data) : null);
    $per = is_array($node) ? ($node[$service] ?? null) : null;
    if (!is_array($per)) return [];
    $peta = [];
    foreach ($per as $p => $v) {
        $usd = (float)$p;
        $stok = is_array($v) ? (int)($v['count'] ?? 0) : (int)$v;
        if ($usd <= 0 || $stok <= 0) continue;
        $h = otp_harga_jual($usd);
        if (!isset($peta[$h])) $peta[$h] = ['harga' => $h, 'usd' => 0, 'stok' => 0];
        $peta[$h]['usd'] = max($peta[$h]['usd'], $usd); // batas beli = harga tertinggi grup
        $peta[$h]['stok'] += $stok;
    }
    ksort($peta);
    return array_values($peta);
}

/* ===================== skema ===================== */
function otp_schema($conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS otp_orders (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        order_id       VARCHAR(40) NOT NULL,
        user_id        INT NOT NULL,
        child_panel_id INT NULL,
        service_code   VARCHAR(40) NOT NULL,
        service_name   VARCHAR(120) NOT NULL,
        country_id     VARCHAR(10) NOT NULL,
        country_name   VARCHAR(80) NOT NULL,
        max_usd        DECIMAL(10,4) NOT NULL,
        price          DECIMAL(15,2) NOT NULL COMMENT 'dibayar user',
        base_price     DECIMAL(15,2) NOT NULL COMMENT 'harga web utama (tanpa markup panel)',
        activation_id  VARCHAR(40) NULL,
        phone          VARCHAR(30) NULL,
        code           VARCHAR(255) NULL,
        status         VARCHAR(16) NOT NULL COMMENT 'membeli|menunggu|selesai|batal|gagal',
        refunded       TINYINT(1) NOT NULL DEFAULT 0,
        note           VARCHAR(255) NULL,
        sms_until      DATETIME NULL,
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_order (order_id),
        KEY idx_user_status (user_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function otp_pub($o) {
    $left = $o['status'] === 'menunggu' && $o['left_s'] !== null ? max(0, (int)$o['left_s']) : null;
    return ['order_id' => $o['order_id'], 'service' => $o['service_name'], 'country' => $o['country_name'],
        'price' => (float)$o['price'], 'phone' => $o['phone'], 'code' => $o['code'], 'status' => $o['status'],
        'refunded' => (bool)$o['refunded'], 'note' => $o['note'], 'seconds_left' => $left, 'created_at' => $o['created_at']];
}

function otp_get($conn, $orderId, $uid) {
    $st = cp_q($conn, "SELECT *, TIMESTAMPDIFF(SECOND, NOW(), sms_until) AS left_s FROM otp_orders WHERE order_id = ? AND user_id = ? LIMIT 1", 'si', (string)$orderId, (int)$uid);
    $o = $st->get_result()->fetch_assoc();
    $st->close();
    return $o;
}

/** Selesaikan order dengan refund (atomik, sekali saja). */
function otp_refund($conn, $o, $status, $note) {
    $conn->begin_transaction();
    try {
        $st = cp_q($conn, "UPDATE otp_orders SET status = ?, note = ?, refunded = 1 WHERE id = ? AND refunded = 0 AND status IN ('membeli','menunggu')", 'ssi', $status, $note, (int)$o['id']);
        $changed = $st->affected_rows;
        $st->close();
        if ($changed === 1) {
            cp_q($conn, "UPDATE users SET balance = balance + ? WHERE id = ?", 'di', (float)$o['price'], (int)$o['user_id'])->close();
            cp_q($conn, "UPDATE riwayat_pesanan SET status = 'batal' WHERE order_id = ? AND user_id = ?", 'si', $o['order_id'], (int)$o['user_id'])->close();
        }
        $conn->commit();
        return $changed === 1;
    } catch (Throwable $e) {
        $conn->rollback();
        otp_log("refund gagal {$o['order_id']}: " . $e->getMessage());
        return false;
    }
}

/** Cek kode / timeout satu order 'menunggu'. Mengembalikan baris terbaru. */
function otp_sync($conn, $o) {
    if ($o['status'] !== 'menunggu' || !$o['activation_id']) return $o;
    try {
        $t = otp_call('getStatus', ['id' => $o['activation_id']]);
    } catch (Throwable $e) {
        $t = '';
    }
    if (preg_match('/^STATUS_OK:?(.*)$/is', $t, $m)) {
        $code = mb_substr(trim($m[1]), 0, 255);
        $st = cp_q($conn, "UPDATE otp_orders SET status = 'selesai', code = ? WHERE id = ? AND status = 'menunggu'", 'si', $code, (int)$o['id']);
        $done = $st->affected_rows === 1;
        $st->close();
        if ($done) {
            cp_q($conn, "UPDATE riwayat_pesanan SET status = 'selesai' WHERE order_id = ? AND user_id = ?", 'si', $o['order_id'], (int)$o['user_id'])->close();
            try { otp_call('setStatus', ['id' => $o['activation_id'], 'status' => 6]); } catch (Throwable $e) { /* abaikan */ }
            if ($o['child_panel_id']) {
                try { cp_record_order($conn, (int)$o['child_panel_id'], (int)$o['user_id'], $o['order_id'], 'otp', 'OTP ' . $o['service_name'] . ' • ' . $o['country_name'], 1, $o['price'], $o['base_price']); } catch (Throwable $e) { /* abaikan */ }
            }
        }
    } elseif (preg_match('/^STATUS_CANCEL/i', $t)) {
        otp_refund($conn, $o, 'batal', 'Dibatalkan oleh server OTP');
    } elseif ($o['left_s'] !== null && (int)$o['left_s'] <= 0) {
        try { otp_call('setStatus', ['id' => $o['activation_id'], 'status' => 8]); } catch (Throwable $e) { /* sudah kedaluwarsa di provider */ }
        otp_refund($conn, $o, 'gagal', 'Kode OTP tidak masuk dalam batas waktu');
    }
    return otp_get($conn, $o['order_id'], $o['user_id']);
}

/* ===================== GET publik: katalog ===================== */
$action = (string)($_GET['action'] ?? '');
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        if ($action === 'services') {
            $list = otp_cache('services', 3600, function () {
                $d = otp_json(otp_call('getServicesList'));
                $arr = isset($d['services']) && is_array($d['services']) ? $d['services'] : (array_is_list($d) ? $d : []);
                $out = [];
                foreach ($arr as $s) if (!empty($s['code'])) $out[] = ['code' => (string)$s['code'], 'name' => (string)($s['name'] ?? $s['code'])];
                usort($out, fn($a, $b) => strcasecmp($a['name'], $b['name']));
                return $out;
            });
            otp_out(['ok' => true, 'services' => $list]);
        }
        if ($action === 'countries') {
            $list = otp_cache('countries', 3600, function () {
                $d = otp_json(otp_call('getCountries'));
                $arr = isset($d['countries']) && is_array($d['countries']) ? $d['countries'] : $d;
                $out = [];
                foreach ($arr as $k => $n) {
                    if (!is_array($n)) { $out[] = ['id' => (string)$k, 'name' => (string)$n]; continue; }
                    $name = $n['eng'] ?? $n['rus'] ?? $n['chn'] ?? '';
                    if ($name !== '') $out[] = ['id' => (string)($n['id'] ?? $k), 'name' => (string)$name];
                }
                usort($out, fn($a, $b) => strcasecmp($a['name'], $b['name']));
                return $out;
            });
            otp_out(['ok' => true, 'countries' => $list]);
        }
        if ($action === 'prices') {
            $svc = preg_replace('/[^a-z0-9_]/i', '', (string)($_GET['service'] ?? ''));
            $cty = preg_replace('/[^0-9]/', '', (string)($_GET['country'] ?? ''));
            if ($svc === '' || $cty === '') otp_out(['ok' => false, 'message' => 'Pilih layanan dan negara.'], 400);
            $tenant = cp_resolve($conn);
            $tiers = array_map(fn($t) => ['harga' => otp_harga_panel($t['harga'], $tenant), 'stok' => $t['stok']], otp_tiers($svc, $cty));
            otp_out(['ok' => true, 'tiers' => $tiers]);
        }
    } catch (OtpErr $e) {
        otp_log("GET $action: {$e->kode}");
        otp_out(['ok' => false, 'message' => otp_friendly($e->kode)], 502);
    }
    otp_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
}

/* ===================== POST: perlu login ===================== */
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) otp_out(['ok' => false, 'message' => 'Body JSON tidak valid.'], 400);
$action = (string)($in['action'] ?? '');
$uid = cp_user_id($conn, $in['token'] ?? '');
if (!$uid) otp_out(['ok' => false, 'message' => 'Sesi tidak valid. Silakan login ulang.'], 401);
$uid = (int)$uid;
try {
    cp_ensure_schema($conn);
    otp_schema($conn);
} catch (Throwable $e) {
    otp_out(['ok' => false, 'message' => 'Gagal menyiapkan tabel OTP.'], 500);
}

/** Proses order user yang masih menunggu (cek kode / timeout) — tanpa cron. */
function otp_sweep($conn, $uid) {
    $st = cp_q($conn, "SELECT *, TIMESTAMPDIFF(SECOND, NOW(), sms_until) AS left_s FROM otp_orders WHERE user_id = ? AND status = 'menunggu' ORDER BY id DESC LIMIT 5", 'i', $uid);
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
    $st->close();
    foreach ($rows as $o) otp_sync($conn, $o);
    // order yang macet di 'membeli' (> 2 menit, mis. koneksi putus saat membeli) → refund
    $st = cp_q($conn, "SELECT *, TIMESTAMPDIFF(SECOND, NOW(), sms_until) AS left_s FROM otp_orders WHERE user_id = ? AND status = 'membeli' AND created_at < NOW() - INTERVAL 2 MINUTE", 'i', $uid);
    foreach ($st->get_result()->fetch_all(MYSQLI_ASSOC) as $o) {
        otp_log("membeli macet {$o['order_id']} → refund (cek manual di dashboard provider)");
        otp_refund($conn, $o, 'gagal', 'Gagal memproses nomor');
    }
    $st->close();
}

if ($action === 'list') {
    otp_sweep($conn, $uid);
    $st = cp_q($conn, "SELECT *, TIMESTAMPDIFF(SECOND, NOW(), sms_until) AS left_s FROM otp_orders WHERE user_id = ? ORDER BY id DESC LIMIT 20", 'i', $uid);
    $rows = array_map('otp_pub', $st->get_result()->fetch_all(MYSQLI_ASSOC));
    $st->close();
    otp_out(['ok' => true, 'orders' => $rows]);
}

if ($action === 'status') {
    $o = otp_get($conn, $in['order_id'] ?? '', $uid);
    if (!$o) otp_out(['ok' => false, 'message' => 'Order tidak ditemukan.'], 404);
    $o = otp_sync($conn, $o);
    otp_out(['ok' => true, 'order' => otp_pub($o), 'balance' => (float)cp_q($conn, "SELECT balance FROM users WHERE id = ?", 'i', $uid)->get_result()->fetch_assoc()['balance']]);
}

if ($action === 'cancel') {
    $o = otp_get($conn, $in['order_id'] ?? '', $uid);
    if (!$o) otp_out(['ok' => false, 'message' => 'Order tidak ditemukan.'], 404);
    $o = otp_sync($conn, $o); // kode mungkin sudah masuk
    if ($o['status'] !== 'menunggu') otp_out(['ok' => true, 'order' => otp_pub($o), 'message' => 'Order sudah tidak aktif.']);
    try {
        $t = otp_call('setStatus', ['id' => $o['activation_id'], 'status' => 8]);
    } catch (OtpErr $e) {
        otp_out(['ok' => false, 'message' => otp_friendly($e->kode)], 502);
    }
    // Refund HANYA bila server OTP mengonfirmasi pembatalan (mis. tidak boleh batal di 2 menit pertama).
    if (!preg_match('/^ACCESS_CANCEL/i', $t)) {
        otp_log("cancel ditolak {$o['order_id']}: $t");
        $msg = stripos($t, 'EARLY_CANCEL') !== false ? 'Nomor baru bisa dibatalkan 2 menit setelah dibeli. Coba lagi sebentar.' : 'Order belum bisa dibatalkan. Coba lagi sebentar.';
        otp_out(['ok' => false, 'message' => $msg], 409);
    }
    otp_refund($conn, $o, 'batal', 'Dibatalkan pembeli');
    $o = otp_get($conn, $o['order_id'], $uid);
    otp_out(['ok' => true, 'order' => otp_pub($o), 'message' => 'Order dibatalkan, saldo dikembalikan.']);
}

if ($action === 'buy') {
    $svc = preg_replace('/[^a-z0-9_]/i', '', (string)($in['service'] ?? ''));
    $cty = preg_replace('/[^0-9]/', '', (string)($in['country'] ?? ''));
    $want = (float)($in['harga'] ?? 0);
    if ($svc === '' || $cty === '' || $want <= 0) otp_out(['ok' => false, 'message' => 'Pilih layanan, negara, dan harga.'], 400);

    otp_sweep($conn, $uid);
    $st = cp_q($conn, "SELECT COUNT(*) n FROM otp_orders WHERE user_id = ? AND status IN ('membeli','menunggu')", 'i', $uid);
    $aktif = (int)$st->get_result()->fetch_assoc()['n'];
    $st->close();
    $maks = (int)otp_cfg()['maks_aktif'];
    if ($aktif >= $maks) otp_out(['ok' => false, 'message' => "Maksimal $maks order OTP berjalan bersamaan. Selesaikan atau batalkan yang lain dulu."], 409);

    $tenant = cp_resolve($conn);
    try {
        $tiers = otp_tiers($svc, $cty);
        $names = otp_cache_peek('services');
        $countries = otp_cache_peek('countries');
    } catch (OtpErr $e) {
        otp_out(['ok' => false, 'message' => otp_friendly($e->kode)], 502);
    }
    // Cocokkan tier dengan harga yang dilihat user (harga dihitung ulang di server).
    $tier = null;
    foreach ($tiers as $t) if (otp_harga_panel($t['harga'], $tenant) == $want) { $tier = $t; break; }
    if (!$tier) otp_out(['ok' => false, 'message' => 'Harga atau stok sudah berubah. Muat ulang daftar harga lalu pilih lagi.'], 409);
    $price = (float)otp_harga_panel($tier['harga'], $tenant);
    $base = (float)$tier['harga'];
    $svcName = $svc; foreach ($names as $n) if (($n['code'] ?? '') === $svc) { $svcName = $n['name']; break; }
    $ctyName = $cty; foreach ($countries as $n) if (($n['id'] ?? '') === $cty) { $ctyName = $n['name']; break; }

    // Potong saldo atomik + buat order (status 'membeli').
    $orderId = 'OTP' . substr(str_replace('.', '', (string)microtime(true)), 0, 13) . random_int(10, 99);
    $conn->begin_transaction();
    try {
        $st = cp_q($conn, "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?", 'did', $price, $uid, $price);
        $ok = $st->affected_rows === 1;
        $st->close();
        if (!$ok) { $conn->rollback(); otp_out(['ok' => false, 'message' => 'Saldo tidak cukup. Silakan deposit dulu.'], 400); }
        cp_q($conn, "INSERT INTO otp_orders (order_id, user_id, child_panel_id, service_code, service_name, country_id, country_name, max_usd, price, base_price, status)
                     VALUES (?,?,?,?,?,?,?,?,?,?, 'membeli')", 'siissssddd',
            $orderId, $uid, $tenant ? (int)$tenant['id'] : null, $svc, mb_substr($svcName, 0, 120), $cty, mb_substr($ctyName, 0, 80), $tier['usd'], $price, $base)->close();
        cp_q($conn, "INSERT INTO riwayat_pesanan (user_id, order_id, service_name, quantity, price, status) VALUES (?,?,?,1,?, 'proses')",
            'issd', $uid, $orderId, mb_substr("Nomor OTP $svcName • $ctyName", 0, 255), $price)->close();
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        otp_out(['ok' => false, 'message' => 'Gagal membuat order. Saldo tidak dipotong.'], 500);
    }
    $o = otp_get($conn, $orderId, $uid);

    // Beli nomor (coba ulang 3x bila stok sesaat habis — sama dengan bot).
    $r = null; $kode = 'UNKNOWN';
    for ($i = 0; $i < 3; $i++) {
        try {
            $t = otp_call('getNumber', ['service' => $svc, 'country' => $cty, 'maxPrice' => $tier['usd']]);
            if (preg_match('/^ACCESS_NUMBER:([^:]+):(\d+)/', $t, $m)) { $r = ['id' => $m[1], 'phone' => $m[2]]; break; }
            $kode = strtoupper(explode(':', $t)[0] ?: 'UNKNOWN');
        } catch (OtpErr $e) {
            $kode = $e->kode;
        }
        if ($kode !== 'NO_NUMBERS') break;
        usleep(1500000);
    }
    if (!$r) {
        otp_log("getNumber gagal $orderId service=$svc country=$cty max={$tier['usd']} kode=$kode");
        otp_refund($conn, $o, 'gagal', otp_friendly($kode));
        otp_out(['ok' => false, 'message' => otp_friendly($kode) . ' Saldo dikembalikan.', 'order' => otp_pub(otp_get($conn, $orderId, $uid))], 409);
    }
    $mins = (int)otp_cfg()['sms_maks_menit'];
    cp_q($conn, "UPDATE otp_orders SET activation_id = ?, phone = ?, status = 'menunggu', sms_until = NOW() + INTERVAL $mins MINUTE WHERE id = ?", 'ssi', $r['id'], $r['phone'], (int)$o['id'])->close();
    if ($tenant) cp_touch_activity($conn, (int)$tenant['id'], $uid, 'order');
    $bal = (float)cp_q($conn, "SELECT balance FROM users WHERE id = ?", 'i', $uid)->get_result()->fetch_assoc()['balance'];
    otp_out(['ok' => true, 'order' => otp_pub(otp_get($conn, $orderId, $uid)), 'balance' => $bal,
        'message' => "Nomor siap! Masukkan nomor di aplikasi lalu minta kode OTP (maks $mins menit)."]);
}

otp_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
