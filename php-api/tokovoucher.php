<?php
/**
 * tokovoucher.php — proxy server untuk API transaksi TokoVoucher (halaman TopUp All Game).
 *
 * Keamanan:
 *  - SECRET KEY TIDAK pernah dikirim ke browser; disimpan di php-api/tokovoucher_config.php
 *    (tidak di-commit; lihat tokovoucher_config.example.php) atau env TOKOVOUCHER_SECRET.
 *  - Signature MD5(user_code:secret:ref_id) dihitung DI SERVER sesuai formula penyedia.
 *  - Aksi `transaksi` wajib memakai token login yang valid (sesi website).
 *
 * Endpoint:
 *  GET  ?action=status
 *        → {ok:true, configured:bool, user_code:"U261***568YV"}   (tanpa secret)
 *  POST {token, action:"transaksi", player_id, server_id?, kode_produk}
 *        → {ok, ref_id, message, provider:{...}} hasil dari api.tokovoucher.me/v1/transaksi
 */
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
error_reporting(0);

require 'configdb.php';
require_once __DIR__ . '/child_panel_lib.php'; // cp_user_id() — validasi token login
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function tv_out($d, $code = 200) { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }

function tv_cfg() {
    static $c = null;
    if ($c !== null) return $c;
    $f = is_file(__DIR__ . '/tokovoucher_config.php') ? (include __DIR__ . '/tokovoucher_config.php') : [];
    $c = (is_array($f) ? $f : []) + [
        'user_code' => '',
        'secret'    => '',
        'base_url'  => 'https://api.tokovoucher.me/v1',
        'timeout'   => 20,
    ];
    if (getenv('TOKOVOUCHER_USER_CODE')) $c['user_code'] = (string)getenv('TOKOVOUCHER_USER_CODE');
    if (getenv('TOKOVOUCHER_SECRET')) $c['secret'] = (string)getenv('TOKOVOUCHER_SECRET');
    return $c;
}

/** user_code tersamarkan untuk tampilan: U261***568YV */
function tv_mask_code($code) {
    $code = (string)$code;
    $n = mb_strlen($code);
    if ($n <= 8) return $code === '' ? '' : str_repeat('*', $n);
    return mb_substr($code, 0, 4) . '***' . mb_substr($code, -4);
}

/** HTTP GET HTML dengan header browser — membaca pricelist publik penyedia. */
function tv_http_get_html($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml'],
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return is_string($body) && $code === 200 ? $body : null;
}

/** Baris produk dari tabel pricelist render server: <td>KODE<br>NAMA</td><td>Rp harga</td>… */
function tv_parse_pricelist_html($html) {
    $re = '/<td[^>]*>\s*([A-Za-z]{1,4}[A-Za-z0-9]{1,16})\s*<br[^>]*>\s*([^<|]+?)\s*<\/td>\s*<td[^>]*>\s*Rp\s*([0-9][0-9.,]*)/i';
    if (!preg_match_all($re, $html, $m, PREG_SET_ORDER)) return [];
    $out = [];
    foreach ($m as $r) {
        $kode = strtoupper(trim($r[1]));
        $nama = trim(html_entity_decode($r[2], ENT_QUOTES, 'UTF-8'));
        $harga = (int)str_replace(['.', ','], '', $r[3]);
        if ($kode === '' || $nama === '' || $harga <= 0 || isset($out[$kode])) continue;
        $out[$kode] = ['kode' => $kode, 'nama' => $nama, 'harga' => $harga];
    }
    return array_values($out);
}

/** Nama game dari breadcrumb kategori pricelist, mis. "Topup / Free Fire / …". */
function tv_detect_category($html) {
    if (preg_match('/Topup\s*\/\s*([A-Za-z0-9 :&-]{2,40}?)(?:\s*\/|\s*<)/i', $html, $m)) {
        return trim(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'));
    }
    return null;
}

/** Override manual di server (TIDAK di-commit): ['Mobile Legends' => [['kode'=>…,'nama'=>…,'harga'=>…,'butuh_server'=>true], …]]. */
function tv_pricelist_override() {
    $f = __DIR__ . '/tokovoucher_pricelist.php';
    if (!is_file($f)) return [];
    $d = include $f;
    return is_array($d) ? $d : [];
}

/** Pricelist live penyedia untuk satu game (cache file 6 jam). Null bila tidak tersedia. */
function tv_fetch_pricelist($game) {
    $game = (string)$game;
    $cacheFile = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $cache = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
    if (!is_array($cache)) $cache = [];
    $key = strtolower(trim($game));
    $now = time();
    if (isset($cache[$key]['items'], $cache[$key]['ts']) && ($now - (int)$cache[$key]['ts']) < 21600) {
        return ['items' => $cache[$key]['items'], 'updated_at' => date('Y-m-d H:i', (int)$cache[$key]['ts'])];
    }
    $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $game), '-'));
    $urls = ['https://tokovoucher.me/pricelist'];
    if ($slug !== '') {
        $urls[] = 'https://tokovoucher.me/pricelist?game=' . rawurlencode($slug);
        $urls[] = 'https://tokovoucher.me/pricelist?kategori=' . rawurlencode($slug);
        $urls[] = 'https://tokovoucher.me/pricelist?slug=' . rawurlencode($slug);
    }
    foreach ($urls as $u) {
        $html = tv_http_get_html($u);
        if ($html === null) continue;
        $items = tv_parse_pricelist_html($html);
        if (!$items) continue;
        if ($slug !== '') {
            $cat = tv_detect_category($html);
            if ($cat === null) continue;
            $catNorm = strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $cat));
            if ($catNorm !== $slug && strpos($catNorm, $slug) === false && strpos($slug, $catNorm) === false) continue;
        }
        $cache[$key] = ['ts' => $now, 'items' => $items];
        @file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE));
        return ['items' => $items, 'updated_at' => date('Y-m-d H:i', $now)];
    }
    return null;
}

$action = (string)($_GET['action'] ?? '');
$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
if ($action === '' && isset($in['action'])) $action = (string)$in['action'];

/* ===================== GET: status integrasi (aman, tanpa secret) ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($action === 'status') {
        $c = tv_cfg();
        tv_out(['ok' => true, 'configured' => ($c['user_code'] !== '' && $c['secret'] !== ''), 'user_code' => tv_mask_code($c['user_code'])]);
    }
    if ($action === 'pricelist') {
        $game = trim((string)($_GET['game'] ?? ''));
        // (1) Override manual server — sumber paling dipercaya (diisi admin dari dashboard penyedia).
        foreach (tv_pricelist_override() as $name => $rows) {
            if ($game !== '' && strcasecmp((string)$name, $game) !== 0) continue;
            $items = [];
            foreach ((is_array($rows) ? $rows : []) as $r) {
                $kode = strtoupper((string)($r['kode'] ?? ''));
                $harga = (int)($r['harga'] ?? 0);
                if ($kode === '' || $harga <= 0) continue;
                $items[] = ['kode' => $kode, 'nama' => (string)($r['nama'] ?? $kode), 'harga' => $harga, 'butuh_server' => !empty($r['butuh_server'])];
            }
            if ($items) tv_out(['ok' => true, 'source' => 'override', 'game' => $game, 'items' => $items, 'updated_at' => date('Y-m-d H:i')]);
        }
        // (2) Pricelist live penyedia (di-cache 6 jam per game).
        $live = tv_fetch_pricelist($game);
        if ($live) tv_out(['ok' => true, 'source' => 'provider', 'game' => $game, 'items' => $live['items'], 'updated_at' => $live['updated_at']]);
        // (3) Keduanya kosong: frontend memakai snapshot repo bila ada (tidak pernah kode karangan).
        tv_out(['ok' => true, 'source' => 'kosong', 'game' => $game, 'items' => []]);
    }
    tv_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
}

/* ===================== POST: transaksi ===================== */
if ($action !== 'transaksi') tv_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);

$c = tv_cfg();
if ($c['user_code'] === '' || $c['secret'] === '') {
    tv_out(['ok' => false, 'message' => 'Integrasi top up belum dikonfigurasi di server. Hubungi admin.'], 503);
}

$uid = isset($conn) && $conn instanceof mysqli ? cp_user_id($conn, (string)($in['token'] ?? '')) : null;
if (!$uid) tv_out(['ok' => false, 'message' => 'Silakan login terlebih dahulu untuk memesan.'], 401);

$player = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['player_id'] ?? ''));
$server = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['server_id'] ?? ''));
$kode   = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['kode_produk'] ?? ''));
if (mb_strlen($player) < 3 || mb_strlen($player) > 40) tv_out(['ok' => false, 'message' => 'Player ID tidak valid.'], 400);
if (mb_strlen($server) > 20) tv_out(['ok' => false, 'message' => 'Server ID terlalu panjang.'], 400);
if ($kode === '' || mb_strlen($kode) > 40) tv_out(['ok' => false, 'message' => 'Kode produk tidak valid.'], 400);

// Ref ID unik per permintaan (dipakai juga sebagai bahan signature).
$ref = 'BY' . date('ymdHis') . random_int(1000, 9999);
$sig = md5($c['user_code'] . ':' . $c['secret'] . ':' . $ref); // formula penyedia: USER_CODE:SECRET_KEY:REF_ID

$body = [
    'user_code'   => $c['user_code'],
    'ref_id'      => $ref,
    'player_id'   => $player,
    'server_id'   => $server,           // kosong bila produk tidak memiliki Server ID
    'kode_produk' => $kode,
    'signature'   => $sig,
];

$ch = curl_init(rtrim($c['base_url'], '/') . '/transaksi');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($body),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => (int)$c['timeout'],
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
]);
$resp = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_error($ch);
curl_close($ch);

$tv_log = function ($txt) {
    @file_put_contents(__DIR__ . '/tokovoucher_log.txt', date('Y-m-d H:i:s') . ' ' . $txt . "\n", FILE_APPEND);
};

// Gagal koneksi/timeout ke penyedia = satu-satunya kasus 502 (gateway).
if ($resp === false || $code === 0) {
    $tv_log("user=$uid ref=$ref kode=$kode player=$player server=$server CURL_ERROR=" . ($err !== '' ? $err : 'timeout'));
    tv_out(['ok' => false, 'ref_id' => $ref, 'message' => 'Tidak dapat menghubungi server penyedia top up (' . ($err !== '' ? $err : 'timeout') . '). Coba lagi sebentar lagi.'], 502);
}

$j = json_decode((string)$resp, true);
if (!is_array($j)) {
    $tv_log("user=$uid ref=$ref kode=$kode http=$code NON_JSON raw=" . substr((string)$resp, 0, 300));
    tv_out(['ok' => false, 'ref_id' => $ref, 'message' => 'Penyedia top up membalas format tak dikenal (HTTP ' . $code . '). Simpan nomor ref ini untuk komplain: ' . $ref]);
}

// Penolakan bisnis (kode produk salah, saldo kurang, dll) = 200 + ok:false supaya UI
// bisa menampilkan pesan penyedia apa adanya — BUKAN 502 yang menakuti user.
$st = $j['status'] ?? $j['success'] ?? null;
$okProvider = $st !== null && filter_var($st, FILTER_VALIDATE_BOOLEAN);
$pesan = (string)($j['message'] ?? $j['msg'] ?? $j['error'] ?? '');

$tv_log("user=$uid ref=$ref kode=$kode player=$player server=$server http=$code ok=" . ($okProvider ? 1 : 0) . ' msg=' . json_encode($pesan, JSON_UNESCAPED_UNICODE) . ' raw=' . substr((string)$resp, 0, 300));

// Buang field sensitif bila penyedia ikut membalasnya.
unset($j['signature'], $j['secret'], $j['api_key'], $j['user_code']);

tv_out([
    'ok'       => $okProvider,
    'ref_id'   => $ref,
    'message'  => $pesan !== '' ? $pesan : ($okProvider ? 'Transaksi diterima penyedia.' : 'Transaksi ditolak penyedia — periksa kode produk / data akun tujuan.'),
    'provider' => $j,
], 200);
