<?php
/**
 * tokovoucher.php — proxy server untuk API top up game TOKOVOUCHER (sistem baru).
 *
 * Penyedia (sesuai dokumentasi member):
 *   Base URL        : https://api.tokovoucher.net
 *   Member code     : M250727KGST5158OE (bisa dioverride di config / env TV_MEMBER_CODE)
 *   GET /v1/transaksi         ?ref_id=&produk=&tujuan=&server_id=&member_code=&secret=
 *   GET /v1/transaksi/status  ?ref_id=&member_code=&secret=
 *   GET /member               ?member_code=&secret=
 *   GET /produk/code          ?member_code=&secret=
 *   GET /v1/deposit           ?member_code=&secret=
 *
 * Keamanan:
 *  - SECRET KEY TIDAK pernah dikirim ke browser: disimpan di php-api/tokovoucher_config.php
 *    (tidak di-commit; lihat tokovoucher_config.example.php) atau env TV_SECRET.
 *    Secret hanya dipakai server-side sebagai parameter query ke penyedia (sesuai contoh docs).
 *  - Aksi `transaksi` & `cek_status` pesanan wajib token login website yang valid.
 *  - Balasan penyedia dibersihkan dari field rahasia sebelum diteruskan ke browser.
 *
 * Endpoint proxy ini:
 *  GET  ?action=status                 → {ok, configured, member_code tersamar, member?}
 *  GET  ?action=pricelist&game=Nama    → {ok, source: override|provider|scrape|kosong, items[]}
 *  GET  ?action=cek_status&ref_id=...  → {ok, provider} (status transaksi per ref_id)
 *  POST {token, action:"transaksi", player_id, server_id?, kode_produk}
 *       → {ok, ref_id, message, provider}
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
        'member_code' => 'M250727KGST5158OE',
        'secret'      => '',
        'base_url'    => 'https://api.tokovoucher.net',
        'timeout'     => 20,
    ];
    if (getenv('TV_MEMBER_CODE')) $c['member_code'] = (string)getenv('TV_MEMBER_CODE');
    if (getenv('TV_SECRET')) $c['secret'] = (string)getenv('TV_SECRET');
    if (getenv('TOKOVOUCHER_SECRET')) $c['secret'] = (string)getenv('TOKOVOUCHER_SECRET');
    return $c;
}

/** member_code tersamarkan untuk tampilan: M250***58OE */
function tv_mask_code($code) {
    $code = (string)$code;
    $n = mb_strlen($code);
    if ($n <= 8) return $code === '' ? '' : str_repeat('*', $n);
    return mb_substr($code, 0, 4) . '***' . mb_substr($code, -4);
}

function tv_log($txt) {
    @file_put_contents(__DIR__ . '/tokovoucher_log.txt', date('Y-m-d H:i:s') . ' ' . $txt . "\n", FILE_APPEND);
}

/** GET ke penyedia (JSON) — semua endpoint docs memakai method GET. */
function tv_api_get($path, array $query, $timeout = 20) {
    $c = tv_cfg();
    $url = rtrim($c['base_url'], '/') . $path . '?' . http_build_query($query);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => (int)$timeout,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => is_string($body) ? $body : null, 'error' => $err];
}

/** Buang field rahasia dari balasan penyedia sebelum diteruskan ke browser. */
function tv_sanitize($j) {
    if (!is_array($j)) return null;
    foreach ($j as $k => $v) {
        $lk = strtolower((string)$k);
        if (strpos($lk, 'secret') !== false || strpos($lk, 'api_key') !== false || strpos($lk, 'apikey') !== false || strpos($lk, 'signature') !== false) {
            unset($j[$k]);
        } elseif (is_array($v)) {
            $j[$k] = tv_sanitize($v);
        }
    }
    return $j;
}

/* ------------------------------------------------------------------ *
 *  KATALOG PRODUK (pricelist)                                          *
 * ------------------------------------------------------------------ */

/** Override manual di server (TIDAK di-commit): ['Mobile Legends' => [['kode'=>…,'nama'=>…,'harga'=>…,'butuh_server'=>true], …]]. */
function tv_pricelist_override() {
    $f = __DIR__ . '/tokovoucher_pricelist.php';
    if (!is_file($f)) return [];
    $d = include $f;
    return is_array($d) ? $d : [];
}

/** Normalisasi satu baris produk dari JSON penyedia (nama field bisa bervariasi). */
function tv_norm_product($r) {
    if (!is_array($r)) return null;
    $pick = function (array $keys) use ($r) {
        foreach ($keys as $k) if (isset($r[$k]) && $r[$k] !== '') return $r[$k];
        return null;
    };
    $kode = $pick(['kode', 'code', 'produk', 'product_code', 'sku', 'id_produk']);
    $nama = $pick(['nama', 'name', 'produk_name', 'product', 'product_name', 'title', 'keterangan']);
    $harga = $pick(['harga', 'price', 'harga_modal', 'cost', 'harga_member']);
    $game = $pick(['game', 'kategori', 'category', 'game_name', 'type', 'jenis']);
    if ($kode === null || $harga === null) return null;
    $h = (int)preg_replace('/[^0-9]/', '', (string)$harga);
    if ($h <= 0) return null;
    return [
        'kode' => strtoupper(trim((string)$kode)),
        'nama' => trim((string)($nama ?? $kode)),
        'harga' => $h,
        'game' => $game !== null ? trim((string)$game) : '',
    ];
}

/** Ambil daftar produk dari endpoint penyedia /produk/code (cache file 6 jam). */
function tv_provider_products() {
    $cacheFile = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $cache = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
    if (!is_array($cache)) $cache = [];
    $now = time();
    if (isset($cache['__all__']['items'], $cache['__all__']['ts']) && ($now - (int)$cache['__all__']['ts']) < 21600) {
        return $cache['__all__']['items'];
    }
    $c = tv_cfg();
    if ($c['member_code'] === '' || $c['secret'] === '') return null;
    $r = tv_api_get('/produk/code', ['member_code' => $c['member_code'], 'secret' => $c['secret']], 15);
    $j = $r['body'] !== null ? json_decode($r['body'], true) : null;
    if (!is_array($j)) return null;
    $list = null;
    foreach (['data', 'list', 'produk', 'products', 'results', 'items'] as $key) {
        if (isset($j[$key]) && is_array($j[$key])) { $list = $j[$key]; break; }
    }
    if ($list === null && array_is_list($j)) $list = $j;
    if ($list === null) return null;
    $items = [];
    foreach ($list as $row) {
        $p = tv_norm_product($row);
        if ($p && !isset($items[$p['kode']])) $items[$p['kode']] = $p;
    }
    $items = array_values($items);
    if (!$items) return null;
    $cache['__all__'] = ['ts' => $now, 'items' => $items];
    @file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE));
    return $items;
}

/** Baris produk dari tabel pricelist render server (fallback scraping halaman publik). */
function tv_parse_pricelist_html($html) {
    $re = '/<td[^>]*>\s*([A-Za-z]{1,4}[A-Za-z0-9]{1,16})\s*<br[^>]*>\s*([^<|]+?)\s*<\/td>\s*<td[^>]*>\s*Rp\s*([0-9][0-9.,]*)/i';
    if (!preg_match_all($re, $html, $m, PREG_SET_ORDER)) return [];
    $out = [];
    foreach ($m as $r) {
        $kode = strtoupper(trim($r[1]));
        $nama = trim(html_entity_decode($r[2], ENT_QUOTES, 'UTF-8'));
        $harga = (int)str_replace(['.', ','], '', $r[3]);
        if ($kode === '' || $nama === '' || $harga <= 0 || isset($out[$kode])) continue;
        $out[$kode] = ['kode' => $kode, 'nama' => $nama, 'harga' => $harga, 'game' => ''];
    }
    return array_values($out);
}

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

/** Nama game dari breadcrumb kategori pricelist, mis. "Topup / Free Fire / …". */
function tv_detect_category($html) {
    if (preg_match('/Topup\s*\/\s*([A-Za-z0-9 :&-]{2,40}?)(?:\s*\/|\s*<)/i', $html, $m)) {
        return trim(html_entity_decode($m[1], ENT_QUOTES, 'UTF-8'));
    }
    return null;
}

/** Fallback scraping pricelist publik per game (cache 6 jam per game). */
function tv_fetch_pricelist_scrape($game) {
    $game = (string)$game;
    $cacheFile = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $cache = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
    if (!is_array($cache)) $cache = [];
    $key = 'scrape:' . strtolower(trim($game));
    $now = time();
    if (isset($cache[$key]['items'], $cache[$key]['ts']) && ($now - (int)$cache[$key]['ts']) < 21600) {
        return $cache[$key]['items'];
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
        return $items;
    }
    return null;
}

$action = (string)($_GET['action'] ?? '');
$in = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
if ($action === '' && isset($in['action'])) $action = (string)$in['action'];

/* ===================== GET ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    if ($action === 'status') {
        $c = tv_cfg();
        $out = ['ok' => true, 'configured' => ($c['member_code'] !== '' && $c['secret'] !== ''), 'member_code' => tv_mask_code($c['member_code'])];
        // Info member (saldo dll) bila penyedia membalas — field rahasia dibuang.
        if ($c['member_code'] !== '' && $c['secret'] !== '') {
            $r = tv_api_get('/member', ['member_code' => $c['member_code'], 'secret' => $c['secret']], 10);
            $j = $r['body'] !== null ? json_decode($r['body'], true) : null;
            if (is_array($j)) $out['member'] = tv_sanitize($j);
        }
        tv_out($out);
    }

    if ($action === 'pricelist') {
        $game = trim((string)($_GET['game'] ?? ''));
        // (1) Override manual server — sumber paling dipercaya.
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
        // (2) Daftar produk live dari endpoint penyedia /produk/code.
        $all = tv_provider_products();
        if (is_array($all) && $all) {
            $hasCat = false;
            foreach ($all as $p) if ($p['game'] !== '') { $hasCat = true; break; }
            if ($game === '') {
                tv_out(['ok' => true, 'source' => 'provider', 'game' => '', 'items' => $all, 'updated_at' => date('Y-m-d H:i')]);
            }
            if ($hasCat) {
                $rows = [];
                foreach ($all as $p) if (strcasecmp($p['game'], $game) === 0) $rows[] = ['kode' => $p['kode'], 'nama' => $p['nama'], 'harga' => $p['harga']];
                if ($rows) tv_out(['ok' => true, 'source' => 'provider', 'game' => $game, 'items' => $rows, 'updated_at' => date('Y-m-d H:i')]);
            }
        }
        // (3) Fallback: scraping pricelist publik per game.
        $sc = $game !== '' ? tv_fetch_pricelist_scrape($game) : null;
        if (is_array($sc) && $sc) {
            $rows = array_map(fn($p) => ['kode' => $p['kode'], 'nama' => $p['nama'], 'harga' => $p['harga']], $sc);
            tv_out(['ok' => true, 'source' => 'scrape', 'game' => $game, 'items' => $rows, 'updated_at' => date('Y-m-d H:i')]);
        }
        // (4) Tidak ada sumber: frontend memakai snapshot repo bila ada (tidak pernah kode karangan).
        tv_out(['ok' => true, 'source' => 'kosong', 'game' => $game, 'items' => []]);
    }

    if ($action === 'cek_status') {
        $ref = trim((string)($_GET['ref_id'] ?? ''));
        if ($ref === '') tv_out(['ok' => false, 'message' => 'ref_id wajib diisi.'], 400);
        $c = tv_cfg();
        if ($c['member_code'] === '' || $c['secret'] === '') tv_out(['ok' => false, 'message' => 'Integrasi top up belum dikonfigurasi di server.'], 503);
        $r = tv_api_get('/v1/transaksi/status', ['ref_id' => $ref, 'member_code' => $c['member_code'], 'secret' => $c['secret']]);
        if ($r['body'] === null || $r['code'] === 0) {
            tv_out(['ok' => false, 'message' => 'Tidak dapat menghubungi server penyedia (' . ($r['error'] !== '' ? $r['error'] : 'timeout') . ').'], 502);
        }
        $j = json_decode((string)$r['body'], true);
        tv_out(['ok' => true, 'ref_id' => $ref, 'provider' => tv_sanitize(is_array($j) ? $j : ['raw' => substr((string)$r['body'], 0, 300)])]);
    }

    tv_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
}

/* ===================== POST: transaksi ===================== */
if ($action !== 'transaksi') tv_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);

$c = tv_cfg();
if ($c['member_code'] === '' || $c['secret'] === '') {
    tv_out(['ok' => false, 'message' => 'Integrasi top up belum dikonfigurasi di server. Hubungi admin.'], 503);
}

$uid = isset($conn) && $conn instanceof mysqli ? cp_user_id($conn, (string)($in['token'] ?? '')) : null;
if (!$uid) tv_out(['ok' => false, 'message' => 'Silakan login terlebih dahulu untuk memesan.'], 401);

$tujuan = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['player_id'] ?? ''));
$server = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['server_id'] ?? ''));
$produk = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['kode_produk'] ?? ''));
if (mb_strlen($tujuan) < 3 || mb_strlen($tujuan) > 40) tv_out(['ok' => false, 'message' => 'Player ID / tujuan tidak valid.'], 400);
if (mb_strlen($server) > 20) tv_out(['ok' => false, 'message' => 'Server ID terlalu panjang.'], 400);
if ($produk === '' || mb_strlen($produk) > 40) tv_out(['ok' => false, 'message' => 'Kode produk tidak valid.'], 400);

// Ref ID unik per permintaan (dipakai juga untuk cek status nanti).
$ref = 'INV-' . date('ymdHis') . random_int(10, 99);

// Dokumen penyedia: method GET dengan seluruh parameter di query string.
$r = tv_api_get('/v1/transaksi', [
    'ref_id'      => $ref,
    'produk'      => $produk,
    'tujuan'      => $tujuan,
    'server_id'   => $server,          // kosong bila produk tidak memiliki Server ID
    'member_code' => $c['member_code'],
    'secret'      => $c['secret'],
]);

if ($r['body'] === null || $r['code'] === 0) {
    tv_log("user=$uid ref=$ref produk=$produk tujuan=$tujuan server=$server CURL_ERROR=" . ($r['error'] !== '' ? $r['error'] : 'timeout'));
    tv_out(['ok' => false, 'ref_id' => $ref, 'message' => 'Tidak dapat menghubungi server penyedia top up (' . ($r['error'] !== '' ? $r['error'] : 'timeout') . '). Coba lagi sebentar lagi.'], 502);
}

$j = json_decode((string)$r['body'], true);
if (!is_array($j)) {
    tv_log("user=$uid ref=$ref produk=$produk http=" . $r['code'] . ' NON_JSON raw=' . substr((string)$r['body'], 0, 300));
    tv_out(['ok' => false, 'ref_id' => $ref, 'message' => 'Penyedia top up membalas format tak dikenal (HTTP ' . $r['code'] . '). Simpan nomor ref ini untuk komplain: ' . $ref]);
}

// Penolakan bisnis (kode produk salah, saldo kurang, dll) = 200 + ok:false supaya UI
// bisa menampilkan pesan penyedia apa adanya — BUKAN 502 yang menakuti user.
$st = $j['status'] ?? $j['success'] ?? null;
$stLow = is_string($st) ? strtolower($st) : '';
$okProvider = ($st !== null && filter_var($st, FILTER_VALIDATE_BOOLEAN)) || in_array($stLow, ['success', 'pending', 'processing', 'berhasil', 'diproses'], true);
$pesan = (string)($j['message'] ?? $j['msg'] ?? $j['error'] ?? $j['keterangan'] ?? '');

tv_log("user=$uid ref=$ref produk=$produk tujuan=$tujuan server=$server http=" . $r['code'] . ' ok=' . ($okProvider ? 1 : 0) . ' msg=' . json_encode($pesan, JSON_UNESCAPED_UNICODE) . ' raw=' . substr((string)$r['body'], 0, 300));

tv_out([
    'ok'       => $okProvider,
    'ref_id'   => $ref,
    'message'  => $pesan !== '' ? $pesan : ($okProvider ? 'Transaksi diterima penyedia.' : 'Transaksi ditolak penyedia — periksa kode produk / data akun tujuan.'),
    'provider' => tv_sanitize($j),
], 200);
