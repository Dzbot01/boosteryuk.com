<?php
/**
 * tokovoucher.php — proxy server untuk API top up game TOKOVOUCHER (sistem baru).
 *
 * Penyedia (sesuai dokumentasi member):
 *   Base URL        : https://api.tokovoucher.net
 *   Member code     : M250727KGST5158OE (bisa dioverride di config / env TV_MEMBER_CODE)
 *   POST /v1/transaksi        {ref_id, produk, tujuan, server_id, member_code, signature}
 *   POST /v1/transaksi/status {ref_id, member_code, signature}
 *        signature = md5(MEMBER_CODE:SECRET:REF_ID)  ← rumus resmi docs
 *   GET  /member              ?member_code=&secret=
 *   GET  /produk/code         ?member_code=&secret=
 *   GET  /member/produk/full  ?member_code=&signature=
 *   GET  /v1/deposit          ?member_code=&secret=
 *   Webhook penyedia (POST/GET) membawa header X-TokoVoucher-Authorization:
 *        md5(MEMBER_CODE:SECRET:REF_ID); diterima Worker di /api/tokovoucher-webhook
 *        lalu diteruskan ke sini sebagai ?action=webhook.
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
 *  GET  ?action=cek_akun&game=&user_id= → {ok, valid, username, reason, message, raw}
 *  GET  ?action=cek_status&ref_id=...  → {ok, sumber: webhook|provider, status, trx_id, sn, message}
 *  POST/GET ?action=webhook            → simpan status akhir transaksi dari penyedia (200)
 *  POST {token, action:"transaksi", player_id, server_id?, kode_produk}
 *       → {ok, ref_id, status: pending|sukses|gagal, trx_id, sn, message, provider}
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
        // Kredensial cek akun apigames.id (merchant_id + secret_key): kosong = fitur dilewati senyap.
        'ag_merchant' => '',
        'ag_secret'   => '',
    ];
    if (getenv('TV_MEMBER_CODE')) $c['member_code'] = (string)getenv('TV_MEMBER_CODE');
    if (getenv('TV_SECRET')) $c['secret'] = (string)getenv('TV_SECRET');
    if (getenv('TOKOVOUCHER_SECRET')) $c['secret'] = (string)getenv('TOKOVOUCHER_SECRET');
    if (getenv('APIGAMES_MERCHANT_ID')) $c['ag_merchant'] = (string)getenv('APIGAMES_MERCHANT_ID');
    if (getenv('APIGAMES_SECRET_KEY')) $c['ag_secret'] = (string)getenv('APIGAMES_SECRET_KEY');
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

/** Kandidat rumus signature endpoint ber-signature (docs tidak menyebutkan rumusnya). */
function tv_sig_candidates($c) {
    $mc = (string)$c['member_code'];
    $sc = (string)$c['secret'];
    return [
        md5($mc . ':' . $sc),
        md5($mc . $sc),
        md5($sc . ':' . $mc),
        md5($sc . $mc),
        md5($mc . ':' . $sc . ':' . date('ymd')),
        md5(strtoupper($mc) . ':' . strtoupper($sc)),
    ];
}

function tv_sig_cache_read() {
    $f = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $j = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return is_array($j) && isset($j['__sig__']) ? (int)$j['__sig__'] : null;
}

function tv_sig_cache_write($i) {
    $f = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $j = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    if (!is_array($j)) $j = [];
    $j['__sig__'] = (int)$i;
    @file_put_contents($f, json_encode($j, JSON_UNESCAPED_UNICODE));
}

function tv_is_sig_error($j) {
    if (!is_array($j)) return false;
    foreach (['error_msg', 'message', 'msg', 'error'] as $k) {
        if (isset($j[$k]) && is_string($j[$k]) && stripos($j[$k], 'signature') !== false) return true;
    }
    return false;
}

/**
 * GET ke endpoint yang mungkin menuntut `signature`: coba dulu tanpa signature,
 * bila dibalas "signature not valid" coba kandidat rumus satu per satu dan
 * INGAT rumus yang berhasil (cache) supaya permintaan berikutnya langsung tepat.
 */
function tv_api_get_authed($path, array $extra = [], $timeout = 15) {
    $c = tv_cfg();
    if ($c['member_code'] === '' || $c['secret'] === '') return ['res' => null, 'json' => null];
    $base = array_merge(['member_code' => $c['member_code'], 'secret' => $c['secret']], $extra);
    $try = function (array $q) use ($path) {
        $r = tv_api_get($path, $q, $timeout);
        $j = $r['body'] !== null ? json_decode((string)$r['body'], true) : null;
        return [$r, $j];
    };
    list($r, $j) = $try($base);
    if (!tv_is_sig_error($j)) return ['res' => $r, 'json' => $j];
    $cands = tv_sig_candidates($c);
    $saved = tv_sig_cache_read();
    $order = array_values(array_unique(array_merge($saved !== null ? [$saved] : [], array_keys($cands))));
    foreach ($order as $i) {
        if (!isset($cands[$i])) continue;
        list($r2, $j2) = $try(array_merge($base, ['signature' => $cands[$i]]));
        if (!tv_is_sig_error($j2)) {
            tv_sig_cache_write($i);
            tv_log('signature endpoint ' . $path . ' cocok rumus #' . $i);
            return ['res' => $r2, 'json' => $j2];
        }
    }
    return ['res' => $r, 'json' => $j];
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

/* ------------------------------------------------------------------ *
 *  TRANSAKSI (POST + signature) & PENYIMPANAN STATUS                    *
 * ------------------------------------------------------------------ */

/** Signature resmi transaksi/cek status/webhook: md5(MEMBER_CODE:SECRET:REF_ID). */
function tv_tx_signature($c, $ref) {
    return md5((string)$c['member_code'] . ':' . (string)$c['secret'] . ':' . (string)$ref);
}

/** POST JSON ke penyedia — docs transaksi memakai method POST dengan body JSON. */
function tv_api_post_json($path, array $payload, $timeout = 25) {
    $c = tv_cfg();
    $ch = curl_init(rtrim($c['base_url'], '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => (int)$timeout,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    ]);
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => is_string($body) ? $body : null, 'error' => $err];
}

/**
 * Panggil endpoint transaksi sesuai docs: POST JSON + signature md5(mc:secret:ref).
 * Bila varian itu ditolak (Signature Invalid / Ip Not Allow / HTTP 4xx-5xx / non-JSON)
 * otomatis dicoba varian lama GET + secret di query, supaya pesanan tidak macet.
 * Balasan yang lebih meyakinkan (JSON dengan status != 0) yang dipakai.
 */
function tv_api_trx($path, array $payload, $timeout = 25) {
    $c = tv_cfg();
    $ref = (string)($payload['ref_id'] ?? '');
    $body = array_merge($payload, [
        'member_code' => $c['member_code'],
        'signature'   => tv_tx_signature($c, $ref),
    ]);
    $r = tv_api_post_json($path, $body, $timeout);
    $j = $r['body'] !== null ? json_decode((string)$r['body'], true) : null;
    $baik = is_array($j) && (int)($j['status'] ?? 0) !== 0 && $r['code'] > 0 && $r['code'] < 400;
    if ($baik) return ['res' => $r, 'json' => $j, 'metode' => 'POST+signature'];

    tv_log('trx ' . $path . ' POST+signature kurang meyakinkan (http=' . $r['code'] . ') -> coba GET: '
        . substr(preg_replace('/\s+/', ' ', (string)$r['body']), 0, 200));
    $r2 = tv_api_get($path, array_merge($payload, [
        'member_code' => $c['member_code'],
        'secret'      => $c['secret'],
    ]), $timeout);
    $j2 = $r2['body'] !== null ? json_decode((string)$r2['body'], true) : null;
    $baik2 = is_array($j2) && (int)($j2['status'] ?? 0) !== 0;
    if ($baik2 || !is_array($j)) return ['res' => $r2, 'json' => $j2, 'metode' => 'GET+secret'];
    return ['res' => $r, 'json' => $j, 'metode' => 'POST+signature'];
}

/**
 * Normalisasi balasan transaksi / cek status / webhook:
 * status = pending | sukses | gagal | error (status:0 + error_msg) | unknown.
 */
function tv_trx_normalize($j) {
    if (!is_array($j)) return null;
    $err = trim((string)($j['error_msg'] ?? ''));
    $st = is_string($j['status'] ?? null) ? strtolower(trim((string)$j['status'])) : '';
    if ($err !== '' || (isset($j['status']) && !is_string($j['status']) && (int)$j['status'] === 0)) $st = 'error';
    if ($st === '') $st = 'unknown';
    return [
        'status'     => $st,
        'message'    => trim((string)($j['message'] ?? '')),
        'error_msg'  => $err,
        'sn'         => trim((string)($j['sn'] ?? '')),
        'trx_id'     => trim((string)($j['trx_id'] ?? '')),
        'ref_id'     => trim((string)($j['ref_id'] ?? '')),
        'produk'     => trim((string)($j['produk'] ?? '')),
        'price'      => isset($j['price']) ? (int)$j['price'] : 0,
        'sisa_saldo' => isset($j['sisa_saldo']) ? (int)$j['sisa_saldo'] : 0,
    ];
}

function tv_trx_file() { return __DIR__ . '/tokovoucher_trx_cache.json'; }

/** Status terakhir transaksi per ref_id (dari webhook / hasil transaksi / cek status). */
function tv_trx_store_read($ref) {
    $j = is_file(tv_trx_file()) ? json_decode((string)file_get_contents(tv_trx_file()), true) : null;
    if (!is_array($j)) return null;
    $e = $j['ref:' . $ref] ?? null;
    return is_array($e) ? $e : null;
}

/**
 * Simpan status transaksi. IDEMPOTEN: trx_id + status yang sama tidak ditulis ulang
 * (webhook penyedia bisa dikirim berkali-kali). Return true bila ada entri baru.
 */
function tv_trx_store_write($ref, array $data) {
    $f = tv_trx_file();
    $j = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    if (!is_array($j)) $j = [];
    $key = 'ref:' . $ref;
    $lama = $j[$key] ?? null;
    if (is_array($lama)
        && ($lama['trx_id'] ?? '') !== '' && ($lama['trx_id'] ?? '') === ($data['trx_id'] ?? '')
        && strtolower((string)($lama['status'] ?? '')) === strtolower((string)($data['status'] ?? ''))) {
        return false;
    }
    $j[$key] = $data + ['disimpan' => date('Y-m-d H:i:s')];
    if (count($j) > 400) $j = array_slice($j, -400, null, true);
    @file_put_contents($f, json_encode($j, JSON_UNESCAPED_UNICODE));
    return true;
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

/** Normalisasi satu baris produk dari JSON penyedia (nama field & bentuk bisa bervariasi). */
function tv_norm_product($r, $keyHint = '') {
    if (!is_array($r)) return null;
    $pick = function (array $keys) use ($r) {
        foreach ($keys as $k) if (isset($r[$k]) && $r[$k] !== '') return $r[$k];
        return null;
    };
    $kode = $pick(['kode', 'code', 'produk', 'product_code', 'sku', 'id_produk', 'product_id']);
    // Bentuk map {"ML86": {...}}: kode produk = kunci mapnya.
    if ($kode === null && $keyHint !== '' && preg_match('/^[A-Za-z0-9]{2,15}$/', $keyHint) && !preg_match('/\s/', $keyHint)) $kode = $keyHint;
    $nama = $pick(['nama', 'name', 'produk_name', 'product', 'product_name', 'title', 'keterangan', 'desc', 'description']);
    $harga = $pick(['harga', 'price', 'harga_modal', 'cost', 'harga_member', 'harga_member_code', 'modal']);
    $game = $pick(['game', 'kategori', 'category', 'game_name', 'type', 'jenis', 'kategori_game']);
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

/**
 * Telusuri JSON penyedia sedalam apa pun dan kumpulkan SEMUA produk — tahan terhadap
 * variasi bentuk: list datar, map ber-kunci kode, grup per game {"Mobile Legends": […]},
 * maupun bungkus {status, data}. Kunci map yang berisi spasi dianggap nama game/kategori
 * dan diwariskan sebagai konteks produk di dalamnya.
 */
function tv_walk_products($node, $game, array &$out) {
    if (!is_array($node)) return;
    $hasHarga = false;
    foreach (['harga', 'price', 'harga_modal', 'cost', 'harga_member', 'modal'] as $f) if (isset($node[$f])) { $hasHarga = true; break; }
    if ($hasHarga) {
        // Node ini sendiri produk (mis. respons satu objek)?
        $p = tv_norm_product($node, '');
        if ($p) {
            if ($p['game'] === '') $p['game'] = $game;
            if (!isset($out[$p['kode']])) $out[$p['kode']] = $p;
            return;
        }
    }
    foreach ($node as $k => $v) {
        if (!is_array($v)) continue;
        $g = $game;
        if (is_string($k) && preg_match('/\s|[a-z]{2,}/', $k) && !preg_match('/^(data|list|items|results|produk|products)$/i', $k)) {
            // Kunci ber-spasi / ber-kata ("Mobile Legends", "Free Fire ID") = konteks game.
            if (preg_match('/\s/', $k) || preg_match('/^(free|mobile|pubg|genshin|honkai|zenless|hago|point|call|blood|farlight|moonlight|magic|garena|honor)/i', $k)) $g = $k;
        }
        // Map ber-kunci kode produk: {"ML86": {nama, harga}}
        $p = tv_norm_product($v, is_string($k) ? $k : '');
        if ($p && !is_array(reset($v))) {
            if ($p['game'] === '') $p['game'] = $g;
            if (!isset($out[$p['kode']])) $out[$p['kode']] = $p;
            continue;
        }
        tv_walk_products($v, $g, $out);
    }
}

/** Ambil daftar produk dari endpoint penyedia /produk/code (cache file 6 jam). */
/**
 * Katalog LENGKAP dari endpoint resmi /member/produk/full: berisi kategori
 * ("Topup Game" dst.), operator (game + logo), jenis (varian wilayah/promo +
 * format_form transaksi), dan produk dengan NAMA ASLI + status aktif.
 * Ini sumber utama katalog; /produk/code tetap fallback bila endpoint ini gagal.
 */
function tv_provider_full() {
    $cacheFile = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $cache = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
    if (!is_array($cache)) $cache = [];
    $now = time();
    if (isset($cache['__full_v2__']['data'], $cache['__full_v2__']['ts']) && ($now - (int)$cache['__full_v2__']['ts']) < 21600) {
        return $cache['__full_v2__']['data'];
    }
    $c = tv_cfg();
    if ($c['member_code'] === '' || $c['secret'] === '') {
        $GLOBALS['tv_full_error'] = 'config kosong';
        return null;
    }
    $a = tv_api_get_authed('/member/produk/full', [], 45); // katalog besar: timeout lebih panjang
    $j = $a['json'];
    $d = is_array($j) ? ($j['data'] ?? null) : null;
    if (!is_array($d) || !is_array($d['produk'] ?? null) || !$d['produk']) {
        $GLOBALS['tv_full_error'] = 'http=' . ($a['res'] !== null ? $a['res']['code'] : 0) . ' ' . substr((string)($a['res'] !== null ? ($a['res']['body'] ?? '') : ''), 0, 120);
        tv_log('katalog /member/produk/full ' . $GLOBALS['tv_full_error'] . ' -> fallback /produk/code');
        return null;
    }
    $cache['__full_v2__'] = ['ts' => $now, 'data' => $d];
    @file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE));
    return $d;
}

/**
 * Normalisasi data /member/produk/full jadi daftar produk siap pakai:
 * hanya kategori "Topup…", operator/jenis/produk aktif, jenis lolos filter
 * wilayah (tanpa Promo & server luar), plus nama asli, logo game, dan
 * butuh_server dari format_form transaksi (ada field server_id atau tidak).
 */
function tv_items_from_full($d) {
    $cats = [];
    foreach ((array)($d['category'] ?? []) as $c) $cats[(int)($c['id'] ?? -1)] = (string)($c['nama'] ?? '');
    $ops = [];
    foreach ((array)($d['operator'] ?? []) as $o) $ops[(int)($o['id'] ?? -1)] = $o;
    $jns = [];
    foreach ((array)($d['jenis'] ?? []) as $j) $jns[(int)($j['id'] ?? -1)] = $j;
    $items = [];
    foreach ((array)($d['produk'] ?? []) as $p) {
        if ((int)($p['status'] ?? 1) !== 1) continue;
        $kode = strtoupper(trim((string)($p['kode_produk'] ?? '')));
        $harga = (int)($p['price'] ?? 0);
        if ($kode === '' || $harga <= 0) continue;
        $op = is_array($ops[(int)($p['operator_id'] ?? -1)] ?? null) ? $ops[(int)$p['operator_id']] : null;
        $jn = is_array($jns[(int)($p['jenis_id'] ?? -1)] ?? null) ? $jns[(int)$p['jenis_id']] : null;
        if (!$op || (int)($op['status'] ?? 1) !== 1) continue;
        if ($jn && (int)($jn['status'] ?? 1) !== 1) continue;
        $cat = $cats[(int)($p['kategori_id'] ?? -1)] ?? '';
        if ($cat !== '' && stripos($cat, 'topup') === false) continue;
        $jenisNama = $jn ? (string)($jn['nama'] ?? '') : '';
        // Wilayah luar/Promo TIDAK dibuang lagi: semuanya ikut sebagai pilihan chip
        // wilayah di halaman detail (pricelist menyesuaikan pilihan). Hanya kode
        // sampah (CEK…, voucher "V…") yang dibuang; untuk item non-ID token wilayah
        // di kode diizinkan.
        $wilayahOk = tv_label_wilayah_ok($jenisNama);
        if (!tv_kode_katalog_ok($kode, !$wilayahOk)) continue;
        // Server ID HANYA berlaku untuk produk Mobile Legends. Game lain (termasuk
        // Free Fire) mengirim field server_id di format_form dengan label kosong =
        // tidak dipakai, jadi kolomnya tidak boleh muncul.
        $opNama = trim((string)($op['nama'] ?? ''));
        $butuhServer = preg_match('/mobile\s*legends?\b/i', $opNama) === 1;
        $items[] = [
            'kode' => $kode,
            'nama' => trim((string)($p['nama'] ?? $kode)),
            'harga' => $harga,
            'game' => trim((string)($op['nama'] ?? '')),
            'jenis' => $jenisNama,
            'wilayah_ok' => $wilayahOk,
            'logo' => (string)($op['logo'] ?? ''),
            'butuh_server' => $butuhServer,
        ];
    }
    return $items;
}

function tv_provider_products() {
    $cacheFile = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $cache = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
    if (!is_array($cache)) $cache = [];
    $now = time();
    if (isset($cache['__all_v3__']['items'], $cache['__all_v3__']['ts']) && ($now - (int)$cache['__all_v3__']['ts']) < 21600) {
        $GLOBALS['tv_sumber_katalog'] = (string)($cache['__all_v3__']['sumber'] ?? 'cache');
        return $cache['__all_v3__']['items'];
    }
    $c = tv_cfg();
    if ($c['member_code'] === '' || $c['secret'] === '') return null;
    // Sumber utama: /member/produk/full (nama asli, kategori, operator, jenis, status).
    $full = tv_provider_full();
    if (is_array($full)) {
        $itemsFull = tv_items_from_full($full);
        if ($itemsFull) {
            $GLOBALS['tv_sumber_katalog'] = 'full';
            $cache['__all_v3__'] = ['ts' => $now, 'items' => $itemsFull, 'sumber' => 'full'];
            @file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE));
            return $itemsFull;
        }
    }
    $a = tv_api_get_authed('/produk/code');
    $r = $a['res'];
    $j = $a['json'];
    $items = [];
    if (is_array($j)) {
        $found = [];
        tv_walk_products($j, '', $found);
        $items = array_values($found);
    }
    if (!$items) {
        $rawLog = 'http=' . ($r !== null ? $r['code'] : 0) . ' PARSE_KOSONG raw=' . substr((string)($r !== null ? $r['body'] : ''), 0, 200);
        tv_log('pricelist /produk/code ' . str_replace($c['secret'], '***', $rawLog));
        return null;
    }
    $GLOBALS['tv_sumber_katalog'] = 'produk/code';
    $cache['__all_v3__'] = ['ts' => $now, 'items' => $items, 'sumber' => 'produk/code'];
    @file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE));
    return $items;
}

/** Tabel alias nama game (dipakai tv_game_aliases & pencocokan label kategori). */
function tv_game_alias_map() {
    return [
        'freefire'         => ['freefire', 'ff'],
        'mobilelegends'    => ['mobilelegends', 'mlbb', 'bangbang', 'ml'],
        'hago'             => ['hago'],
        'pubgmobile'       => ['pubgmobile', 'pubg', 'uc'],
        'honorofkings'     => ['honorofkings', 'hok'],
        'genshinimpact'    => ['genshinimpact', 'genshin'],
        'garenaundawn'     => ['garenaundawn', 'undawn'],
        'pointblank'       => ['pointblank', 'pb'],
        'callofdutymobile' => ['callofdutymobile', 'codm', 'cod'],
        'bloodstrike'      => ['bloodstrike', 'bs'],
        'honkaistarrail'   => ['honkaistarrail', 'honkai', 'hsr'],
        'metalslugawakening' => ['metalslugawakening', 'metalslug', 'msa'],
        'magicchessgogo'   => ['magicchessgogo', 'magicchess', 'mcgg'],
        'farlight84'       => ['farlight84', 'farlight', 'fl84'],
        'moonlightbladem'  => ['moonlightbladem', 'moonlightblade', 'moonlight'],
        'zenlesszonezero'  => ['zenlesszonezero', 'zenless', 'zzz'],
    ];
}

/** Alias nama game: label penyedia sering berbeda dari nama kartu di UI ("MLBB" vs "Mobile Legends"). */
function tv_game_aliases($game) {
    $norm = preg_replace('/[^a-z0-9]+/', '', strtolower((string)$game));
    $map = tv_game_alias_map();
    return $map[$norm] ?? [$norm];
}

/** Kunci game kanonik dari label kategori penyedia ("Free Fire ID (Indonesia)" => freefire). */
function tv_game_key_of_label($label) {
    $norm = preg_replace('/[^a-z0-9]+/', '', strtolower((string)$label));
    if ($norm === '') return '';
    foreach (tv_game_alias_map() as $key => $aliases) {
        // Alias pendek ("ff", "ml", "uc", …) dilewati agar kategori non-game
        // (mis. "Voucher Gameplay" mengandung "uc") tidak salah tercekok.
        foreach ($aliases as $a) if ($a !== '' && strlen($a) >= 3 && strpos($norm, $a) !== false) return $key;
    }
    return '';
}

/** Nama tampil game untuk kartu grid (mengikuti penamaan kartu UI yang sudah ada). */
function tv_game_display($key) {
    $map = [
        'freefire' => 'Free Fire', 'mobilelegends' => 'Mobile Legends', 'hago' => 'Hago',
        'pubgmobile' => 'PUBG Mobile', 'honorofkings' => 'Honor of Kings', 'genshinimpact' => 'Genshin Impact',
        'garenaundawn' => 'Garena Undawn', 'pointblank' => 'Point Blank', 'callofdutymobile' => 'Call of Duty Mobile',
        'bloodstrike' => 'Blood Strike', 'honkaistarrail' => 'Honkai Star Rail', 'metalslugawakening' => 'Metal Slug : Awakening',
        'magicchessgogo' => 'Magic Chess GO GO', 'farlight84' => 'Farlight 84', 'moonlightbladem' => 'Moonlight Blade M',
        'zenlesszonezero' => 'Zenless Zone Zero',
    ];
    return $map[$key] ?? ucfirst((string)$key);
}

/** Slug URL dari nama game ("Farlight 84" => farlight-84). */
function tv_slugify($t) {
    return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower((string)$t)), '-');
}

/**
 * Kode layak katalog/topup game: buang produk tes ("…CEK…"), kode server luar
 * (RU/SG/MY/BR/PH/LATAM/GLOBAL), dan kategori voucher game ("V"+prefiks game,
 * mis. VPUBGGCOIN500) — respons penyedia datar tanpa label kategori sehingga
 * penyaringan harus lewat kode.
 */
function tv_kode_katalog_ok($kode, $izinkanWilayah = false) {
    $k = strtoupper((string)$kode);
    if ($k === '' || strpos($k, 'CEK') !== false) return false;
    // Token wilayah di kode (FFSG…, MLBR…) hanya sampah untuk daftar ID; untuk chip
    // wilayah (server luar) token itu justru penanda produknya — boleh lewat.
    if (!$izinkanWilayah && preg_match('/(RU|SG|MY|BR|PH|LATAM|GLOBAL)([0-9]|$)/', $k)) return false;
    if (strpos($k, 'V') === 0 && tv_code_prefix_game(substr($k, 1)) !== '') return false;
    return true;
}

/**
 * Hanya kategori ID (Indonesia): label kategori penyedia berbentuk
 * "Free Fire ID (Indonesia)", "Free Fire ID (Promo)", "Mobile Legends RU (Rusia)", dst.
 * Kategori Promo dan server luar (SG/MY/BR/Latam/Global/RU) dibuang di sumbernya
 * supaya SEMUA game hanya menjual produk server Indonesia tanpa Promo.
 * Label kosong = diterima (penguncian kode di frontend tetap berlaku).
 */
function tv_label_wilayah_ok($label) {
    $l = strtolower((string)$label);
    if ($l === '') return true;
    if (strpos($l, 'promo') !== false) return false;
    if (preg_match('/singapur|malaysia|brazil|brasil|latam|global|rusia|russia|\(sg\)|\(my\)|\(br\)|\(ru\)/', $l)) return false;
    // Token region polos di akhir/terpisah spasi: "Free Fire SG", "ML MY", "Genshin KR", …
    if (preg_match('/\b(sg|my|br|th|vn|ph|tr|ru|kr|tw|bd|eur|mxn|cad|aud)\b/i', $l)) return false;
    return true;
}

/** Tebakan game dari prefiks kode produk (MFF…=Free Fire, ML…/AMLBB…=Mobile Legends, dst). */
function tv_code_prefix_game($kode) {
    $k = strtoupper((string)$kode);
    $prefs = [
        'MFF' => 'free fire', 'FF' => 'free fire',
        'MML' => 'mobile legends', 'AMLBB' => 'mobile legends', 'MLBB' => 'mobile legends', 'ML' => 'mobile legends',
        'MHG' => 'hago', 'HAGO' => 'hago',
        'MPUBG' => 'pubg mobile', 'PUBG' => 'pubg mobile', 'UC' => 'pubg mobile',
        'MHOK' => 'honor of kings', 'HOK' => 'honor of kings',
        'GENSHIN' => 'genshin impact', 'GI' => 'genshin impact',
        'UNDAWN' => 'garena undawn', 'UD' => 'garena undawn',
        'MPB' => 'point blank', 'PB' => 'point blank',
        'MCOD' => 'call of duty mobile', 'COD' => 'call of duty mobile',
        'MBS' => 'blood strike', 'BS' => 'blood strike',
        'HSR' => 'honkai star rail',
        'MSA' => 'metal slug : awakening', 'MS' => 'metal slug : awakening',
        'MCGG' => 'magic chess go go', 'MC' => 'magic chess go go',
        'FL84' => 'farlight 84', 'FL' => 'farlight 84',
        'MOON' => 'moonlight blade m', 'MB' => 'moonlight blade m',
        'ZZZ' => 'zenless zone zero',
    ];
    foreach ($prefs as $pref => $g) if (strpos($k, $pref) === 0) return $g;
    return '';
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

/* ============ WEBHOOK PENYEDIA (POST/GET) — ?action=webhook ============ *
 * Dipanggil Worker https://app.boosteryuk.com/api/tokovoucher-webhook bila
 * hosting memblokir webhook masuk. Validasi header
 * X-TokoVoucher-Authorization: md5(MEMBER_CODE:SECRET:REF_ID).
 * Status disimpan per ref_id (idempoten lewat trx_id) agar cek_status instan.
 */
if ($action === 'webhook') {
    $c = tv_cfg();
    $payload = (is_array($in) && $in) ? $in : $_GET;
    $ref = trim((string)($payload['ref_id'] ?? ''));
    $hdr = '';
    foreach ($_SERVER as $k => $v) {
        if (strcasecmp((string)$k, 'HTTP_X_TOKOVOUCHER_AUTHORIZATION') === 0) $hdr = strtolower(trim((string)$v));
    }
    if ($hdr === '') $hdr = strtolower(trim((string)($payload['signature'] ?? '')));
    $norm = tv_trx_normalize(is_array($payload) ? $payload : []);
    if ($ref === '' || $norm === null) {
        tv_log('webhook DITOLAK: payload tanpa ref_id — raw=' . substr((string)json_encode($payload, JSON_UNESCAPED_UNICODE), 0, 200));
        tv_out(['ok' => false, 'message' => 'ref_id wajib ada di body webhook.'], 400);
    }
    $harus = ($c['member_code'] !== '' && $c['secret'] !== '') ? strtolower(tv_tx_signature($c, $ref)) : '';
    if ($harus === '' || $hdr === '' || !hash_equals($harus, $hdr)) {
        tv_log('webhook ref=' . $ref . ' DITOLAK: header X-TokoVoucher-Authorization tidak cocok dengan signature md5 member_code:secret:ref_id');
        tv_out(['ok' => false, 'message' => 'Signature webhook tidak valid.'], 401);
    }
    $baru = tv_trx_store_write($ref, $norm + ['sumber' => 'webhook']);
    tv_log('webhook ref=' . $ref . ' status=' . $norm['status'] . ' trx=' . $norm['trx_id'] . ' sn=' . $norm['sn'] . ($baru ? ' (baru)' : ' (duplikat, dilewati)'));
    tv_out(['ok' => true, 'ref_id' => $ref, 'status' => $norm['status'], 'trx_id' => $norm['trx_id'], 'baru' => $baru]);
}

/* ===================== GET ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    if ($action === 'status') {
        $c = tv_cfg();
        $out = ['ok' => true, 'configured' => ($c['member_code'] !== '' && $c['secret'] !== ''), 'member_code' => tv_mask_code($c['member_code'])];
        // Info member (saldo dll) bila penyedia membalas — field rahasia dibuang.
        if ($c['member_code'] !== '' && $c['secret'] !== '') {
            $a = tv_api_get_authed('/member');
            if (is_array($a['json'])) $out['member'] = tv_sanitize($a['json']);
        }
        tv_out($out);
    }

    if ($action === 'cek_akun') {
        // Cek akun target (apigames.id) — Free Fire & Mobile Legends, GET dengan
        // signature = md5(merchant_id + secret_key).
        // Kegagalan teknis (belum dikonfigurasi, koneksi, signature/IP ditolak,
        // balasan bukan JSON) dikembalikan APA ADANYA + cuplikan respons asli
        // supaya mudah didiagnosis; "Data Not Found" ditandai reason:not_found.
        $gameSlug = strtolower(trim((string)($_GET['game'] ?? '')));
        $userId = trim((string)($_GET['user_id'] ?? ''));
        $codes = [
            'free-fire' => 'freefire', 'freefire' => 'freefire', 'ff' => 'freefire',
            'mobile-legends' => 'mobilelegend', 'mobilelegends' => 'mobilelegend', 'ml' => 'mobilelegend',
        ];
        $gc = $codes[$gameSlug] ?? '';
        $c = tv_cfg();
        $gagal = function ($reason, $msg, $extra = []) use (&$urlSamar) {
            tv_out(array_merge(['ok' => false, 'valid' => false, 'username' => '', 'reason' => $reason, 'message' => $msg], $extra, ['url' => $urlSamar ?? '']));
        };
        if ($gc === '') $gagal('unsupported', 'Cek akun hanya tersedia untuk Free Fire dan Mobile Legends (game_code apigames: freefire / mobilelegend).');
        if ($userId === '') $gagal('kosong', 'Isi Player ID / User ID terlebih dahulu.');
        if ($c['ag_merchant'] === '' || $c['ag_secret'] === '') {
            $gagal('unconfigured', 'Cek akun belum aktif di server: ag_merchant / ag_secret masih kosong pada php-api/tokovoucher_config.php (atau env APIGAMES_MERCHANT_ID / APIGAMES_SECRET_KEY).');
        }
        $sig = md5($c['ag_merchant'] . $c['ag_secret']);
        $url = 'https://v1.apigames.id/merchant/' . rawurlencode($c['ag_merchant']) . '/cek-username/' . $gc
            . '?user_id=' . rawurlencode($userId) . '&signature=' . $sig;
        // Versi tersamar untuk diagnostik (merchant & signature tidak bocor penuh).
        $urlSamar = 'https://v1.apigames.id/merchant/' . tv_mask_code($c['ag_merchant']) . '/cek-username/' . $gc
            . '?user_id=' . rawurlencode($userId) . '&signature=' . substr($sig, 0, 6) . '…';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        ]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        $errno = curl_errno($ch);
        curl_close($ch);
        $raw = is_string($body) ? substr(preg_replace('/\s+/', ' ', $body), 0, 400) : '';
        $j = is_string($body) ? json_decode($body, true) : null;

        if ($errno !== 0 || $code === 0) {
            tv_log('cek_akun ' . $gc . ' user=' . $userId . ' KONEKSI GAGAL errno=' . $errno . ' ' . $err);
            $gagal('koneksi', 'Apigames tidak dapat dihubungi dari server: ' . ($err !== '' ? $err : 'timeout') . '.', ['http' => $code, 'raw' => $raw]);
        }
        if (!is_array($j)) {
            tv_log('cek_akun ' . $gc . ' user=' . $userId . ' http=' . $code . ' NON_JSON raw=' . $raw);
            $gagal('non_json', 'Apigames membalas bukan JSON (HTTP ' . $code . '). Respons asli: ' . ($raw !== '' ? $raw : '(kosong)'), ['http' => $code, 'raw' => $raw]);
        }
        if ((int)($j['status'] ?? 0) !== 1) {
            $msg = (string)($j['error_msg'] ?? $j['message'] ?? $j['error'] ?? '');
            tv_log('cek_akun ' . $gc . ' user=' . $userId . ' http=' . $code . ' DITOLAK raw=' . $raw);
            $gagal('ditolak', 'Apigames menolak permintaan (HTTP ' . $code . '): ' . ($msg !== '' ? $msg : 'status bukan 1') . '. Respons asli: ' . $raw, ['http' => $code, 'raw' => $raw]);
        }
        if (!is_array($j['data'] ?? null)) {
            tv_log('cek_akun ' . $gc . ' user=' . $userId . ' http=' . $code . ' TANPA_DATA raw=' . $raw);
            $gagal('tanpa_data', 'Apigames membalas tanpa field data (HTTP ' . $code . '). Respons asli: ' . $raw, ['http' => $code, 'raw' => $raw]);
        }
        $valid = !empty($j['data']['is_valid']);
        $uname = trim((string)($j['data']['username'] ?? ''));
        $pesanApi = (string)($j['message'] ?? ($valid ? 'Data Found' : 'Data Not Found'));
        tv_log('cek_akun ' . $gc . ' user=' . $userId . ' http=' . $code . ' valid=' . ($valid ? 1 : 0) . ' username=' . $uname);
        if (!$valid || $uname === '') {
            $gagal('not_found', $pesanApi, ['http' => $code, 'raw' => $raw]);
        }
        tv_out(['ok' => true, 'valid' => true, 'username' => $uname, 'reason' => 'ok', 'message' => $pesanApi, 'url' => $urlSamar]);
    }

    if ($action === 'katalog') {
        // Grup game untuk grid "TopUp All Game": kartu game tetap ringkasan varian
        // Indonesia saja (flag wilayah_ok dari /member/produk/full); varian wilayah
        // luar/Promo tetap tersedia sebagai chip wilayah di halaman detail game.
        $all = tv_provider_products();
        if (is_array($all)) $all = array_values(array_filter($all, function ($p) {
            $okWilayah = array_key_exists('wilayah_ok', $p) ? (bool)$p['wilayah_ok'] : tv_label_wilayah_ok($p['jenis'] ?? '');
            return $okWilayah && tv_label_wilayah_ok($p['game'] ?? '');
        }));
        $groups = [];
        $labelsDilihat = [];
        foreach ((is_array($all) ? $all : []) as $p) {
            if ($p['game'] !== '' && count($labelsDilihat) < 25 && !in_array($p['game'], $labelsDilihat, true)) $labelsDilihat[] = $p['game'];
            // Respons penyedia datar (tanpa label kategori): kelompokkan lewat prefiks kode.
            $key = tv_game_key_of_label($p['game'] ?? '');
            if ($key === '') {
                $pg = tv_code_prefix_game($p['kode']);
                if ($pg !== '') $key = tv_game_key_of_label($pg);
            }
            $custom = false;
            if ($key === '' && $p['game'] !== '') {
                // Operator di luar tabel alias (Delta Force, Eggy Party, …) tetap
                // tampil di grid dengan namanya sendiri; operator non-game
                // (pulsa/wifi/operator luar) dibuang.
                if (preg_match('/\b(ais|truemove|nt|pulsa|paket data|token|listrik|wifi|internet|voucher|sim|data)\b/i', $p['game'])) continue;
                $key = 'label:' . preg_replace('/[^a-z0-9]+/', '', strtolower($p['game']));
                $custom = true;
            }
            if ($key === '') continue;
            if (!isset($groups[$key])) {
                $disp = $custom ? (string)$p['game'] : tv_game_display($key);
                $groups[$key] = ['game' => $disp, 'slug' => tv_slugify($disp), 'jumlah' => 0, 'termurah' => 0, 'labels' => [], 'logo' => ''];
            }
            $groups[$key]['jumlah']++;
            if ($groups[$key]['termurah'] === 0 || $p['harga'] < $groups[$key]['termurah']) $groups[$key]['termurah'] = $p['harga'];
            if ($groups[$key]['logo'] === '' && !empty($p['logo'])) $groups[$key]['logo'] = (string)$p['logo'];
            $lb = !empty($p['jenis']) ? (string)$p['jenis'] : (string)$p['game'];
            if ($lb !== '' && count($groups[$key]['labels']) < 12 && !in_array($lb, $groups[$key]['labels'], true)) $groups[$key]['labels'][] = $lb;
        }
        $out = array_values($groups);
        usort($out, function ($a, $b) { return strcmp($a['game'], $b['game']); });
        tv_out([
            'ok' => true,
            'source' => (is_array($all) && $all) ? 'provider' : 'kosong',
            'sumber_katalog' => (string)($GLOBALS['tv_sumber_katalog'] ?? ''),
            'full_error' => (string)($GLOBALS['tv_full_error'] ?? ''),
            'groups' => $out,
            'labels_dilihat' => $labelsDilihat,
            'updated_at' => date('Y-m-d H:i'),
        ]);
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
                $items[] = ['kode' => $kode, 'nama' => (string)($r['nama'] ?? $kode), 'harga' => $harga, 'butuh_server' => !empty($r['butuh_server']), 'jenis' => (string)($r['jenis'] ?? ''), 'wilayah_ok' => true];
            }
            if ($items) tv_out(['ok' => true, 'source' => 'override', 'game' => $game, 'items' => $items, 'updated_at' => date('Y-m-d H:i')]);
        }
        // (2) Daftar produk live dari endpoint penyedia.
        $all = tv_provider_products();
        // Sumber /member/produk/full membawa flag wilayah_ok: SEMUA wilayah disertakan
        // supaya halaman detail bisa menyajikan chip wilayah (ID, SG, MY, Promo, …)
        // dan pricelist menyesuaikan pilihan. Sumber datar /produk/code tidak membawa
        // info wilayah → tetap difilter ID-saja + buang kode sampah.
        if (is_array($all)) $all = array_values(array_filter($all, function ($p) {
            if (array_key_exists('wilayah_ok', $p)) return tv_label_wilayah_ok($p['game'] ?? '');
            return tv_label_wilayah_ok($p['game'] ?? '') && tv_kode_katalog_ok($p['kode']);
        }));
        if (is_array($all) && $all) {
            if ($game === '') {
                tv_out(['ok' => true, 'source' => 'provider', 'game' => '', 'items' => $all, 'updated_at' => date('Y-m-d H:i')]);
            }
            $norm = function ($t) { return preg_replace('/[^a-z0-9]+/', '', strtolower((string)$t)); };
            $gN = $norm($game);
            $aliases = tv_game_aliases($game);
            $hitAlias = function ($text) use ($norm, $aliases) {
                $t = $norm($text);
                if ($t === '') return false;
                // Alias <3 karakter ("uc", "ml", "ff") dilewati: mudah salah celok
                // (mis. "DIUC12" paket data dianggap UC PUBG).
                foreach ($aliases as $a) if ($a !== '' && strlen($a) >= 3 && strpos($t, $a) !== false) return true;
                return false;
            };
            $rows = [];
            // (a) field game/kategori penyedia (cocok langsung maupun lewat alias);
            foreach ($all as $p) if ($p['game'] !== '' && ($norm($p['game']) === $gN || strpos($norm($p['game']), $gN) === 0 || strpos($gN, $norm($p['game'])) === 0 || $hitAlias($p['game']))) {
                $rows[] = ['kode' => $p['kode'], 'nama' => $p['nama'], 'harga' => $p['harga'], 'butuh_server' => !empty($p['butuh_server']), 'jenis' => (string)($p['jenis'] ?? ''), 'wilayah_ok' => !empty($p['wilayah_ok'])];
            }
            // (b) nama produk menyebut game tsb ("MOBILE LEGENDS 86 Diamond", "MLBB 86", dst);
            if (!$rows) foreach ($all as $p) if ($hitAlias($p['nama'])) {
                $rows[] = ['kode' => $p['kode'], 'nama' => $p['nama'], 'harga' => $p['harga'], 'butuh_server' => !empty($p['butuh_server']), 'jenis' => (string)($p['jenis'] ?? ''), 'wilayah_ok' => !empty($p['wilayah_ok'])];
            }
            // (c) prefiks kode produk (MFF…=Free Fire, ML…/AMLBB…=Mobile Legends, dst).
            if (!$rows) foreach ($all as $p) {
                $g = tv_code_prefix_game($p['kode']);
                if ($g !== '' && in_array($gN, array_map($norm, tv_game_aliases($g)), true)) {
                    $rows[] = ['kode' => $p['kode'], 'nama' => $p['nama'], 'harga' => $p['harga'], 'butuh_server' => !empty($p['butuh_server']), 'jenis' => (string)($p['jenis'] ?? ''), 'wilayah_ok' => !empty($p['wilayah_ok'])];
                }
            }
            // (d) tetap kosong padahal daftar produk ada: catat label asli penyedia supaya
            //     pemetaan bisa dilengkapi tanpa menebak-nebak lagi.
            if (!$rows) {
                $games = [];
                foreach ($all as $p) if ($p['game'] !== '') $games[$p['game']] = true;
                $sampel = [];
                foreach (array_slice($all, 0, 8) as $p) $sampel[] = $p['kode'] . '=' . $p['nama'];
                tv_log('pricelist game="' . $game . '" TIDAK cocok | label penyedia: ' . implode(' | ', array_keys($games)) . ' | contoh: ' . implode(', ', $sampel));
            }
            if ($rows) tv_out(['ok' => true, 'source' => 'provider', 'game' => $game, 'items' => $rows, 'updated_at' => date('Y-m-d H:i')]);
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

        // Pertama: bila webhook penyedia sudah melaporkan status akhir, itu jawaban pasti —
        //    tidak perlu menembak API penyedia (hemat & tetap jalan walau IP diblokir).
        $simpan = tv_trx_store_read($ref);
        $stSimpan = is_array($simpan) ? strtolower((string)($simpan['status'] ?? '')) : '';
        if (in_array($stSimpan, ['sukses', 'gagal'], true)) {
            tv_out([
                'ok' => true, 'ref_id' => $ref, 'sumber' => 'webhook', 'status' => $stSimpan,
                'trx_id' => (string)($simpan['trx_id'] ?? ''), 'sn' => (string)($simpan['sn'] ?? ''),
                'message' => (string)($simpan['message'] ?? ''), 'price' => (int)($simpan['price'] ?? 0),
                'provider' => $simpan,
            ]);
        }

        $c = tv_cfg();
        if ($c['member_code'] === '' || $c['secret'] === '') tv_out(['ok' => false, 'message' => 'Integrasi top up belum dikonfigurasi di server.'], 503);

        // Kedua, docs: POST /v1/transaksi/status {ref_id, member_code, signature}.
        $a = tv_api_trx('/v1/transaksi/status', ['ref_id' => $ref]);
        $r = $a['res'];
        if ($r === null || $r['body'] === null || $r['code'] === 0) {
            tv_out(['ok' => false, 'message' => 'Tidak dapat menghubungi server penyedia (' . ($r !== null && $r['error'] !== '' ? $r['error'] : 'timeout') . ').', 'raw' => is_array($r) ? substr((string)$r['body'], 0, 300) : ''], 502);
        }
        $j = $a['json'];
        if (!is_array($j)) {
            tv_out(['ok' => false, 'message' => 'Penyedia membalas format tak dikenal (HTTP ' . $r['code'] . ').', 'raw' => substr(preg_replace('/\s+/', ' ', (string)$r['body']), 0, 300)], 502);
        }
        $norm = tv_trx_normalize($j);
        if ($norm !== null && in_array($norm['status'], ['sukses', 'gagal'], true)) {
            tv_trx_store_write($ref, $norm + ['sumber' => 'cek_status']);
        }
        tv_out([
            'ok' => true, 'ref_id' => $ref, 'sumber' => 'provider', 'metode' => $a['metode'],
            'status' => $norm['status'] ?? 'unknown', 'trx_id' => $norm['trx_id'] ?? '', 'sn' => $norm['sn'] ?? '',
            'message' => ($norm['error_msg'] ?? '') !== '' ? $norm['error_msg'] : ($norm['message'] ?? ''),
            'error_msg' => $norm['error_msg'] ?? '', 'price' => (int)($norm['price'] ?? 0),
            'raw' => substr(preg_replace('/\s+/', ' ', (string)$r['body']), 0, 300),
            'provider' => tv_sanitize($j),
        ]);
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

// Docs resmi: POST https://api.tokovoucher.net/v1/transaksi dengan body JSON
//   {ref_id, produk, tujuan, server_id, member_code, signature}
//   signature = md5(MEMBER_CODE:SECRET:REF_ID)  — dihitung di server, secret tidak keluar.
// server_id dikirim "" untuk semua game kecuali Mobile Legends. Bila POST ditolak,
// tv_api_trx otomatis mencoba varian lama (GET + secret) supaya pesanan tidak macet.
$a = tv_api_trx('/v1/transaksi', [
    'ref_id'    => $ref,
    'produk'    => $produk,
    'tujuan'    => $tujuan,
    'server_id' => $server,
]);
$r = $a['res'];
$j = $a['json'];

if ($r['body'] === null || $r['code'] === 0) {
    tv_log("user=$uid ref=$ref produk=$produk tujuan=$tujuan server=$server metode=" . $a['metode'] . ' CURL_ERROR=' . ($r['error'] !== '' ? $r['error'] : 'timeout'));
    tv_out(['ok' => false, 'ref_id' => $ref, 'status' => 'error', 'metode' => $a['metode'], 'message' => 'Tidak dapat menghubungi server penyedia top up (' . ($r['error'] !== '' ? $r['error'] : 'timeout') . '). Coba lagi sebentar lagi.'], 502);
}

$raw = substr(preg_replace('/\s+/', ' ', (string)$r['body']), 0, 400);
if (!is_array($j)) {
    tv_log("user=$uid ref=$ref produk=$produk http=" . $r['code'] . ' metode=' . $a['metode'] . ' NON_JSON raw=' . $raw);
    tv_out(['ok' => false, 'ref_id' => $ref, 'status' => 'error', 'metode' => $a['metode'], 'raw' => $raw,
        'message' => 'Penyedia top up membalas format tak dikenal (HTTP ' . $r['code'] . '). Respons asli: ' . $raw . ' — simpan ref ini untuk komplain: ' . $ref]);
}

// Balasan docs: status = pending | sukses | gagal, atau {status:0, error_msg:"Ip Not Allow" / "Signature Invalid"}.
$norm = tv_trx_normalize($j);
$st = $norm['status'];
$okProvider = in_array($st, ['sukses', 'pending', 'processing', 'success', 'berhasil', 'diproses'], true);
$pesan = $norm['error_msg'] !== '' ? $norm['error_msg'] : $norm['message'];
if ($pesan === '' && $st === 'gagal' && $norm['sn'] !== '') $pesan = $norm['sn'];

tv_log("user=$uid ref=$ref produk=$produk tujuan=$tujuan server=$server metode=" . $a['metode'] . ' http=' . $r['code']
    . ' status=' . $st . ' trx=' . $norm['trx_id'] . ' msg=' . json_encode($pesan, JSON_UNESCAPED_UNICODE) . ' raw=' . $raw);

// Status awal disimpan supaya cek_status/webhook bisa mencocokkan ref_id ini.
if ($st !== 'error' && $st !== 'unknown') {
    tv_trx_store_write($ref, $norm + ['sumber' => 'transaksi', 'user_id' => $uid, 'produk_kode' => $produk, 'tujuan' => $tujuan, 'server_id' => $server]);
}

tv_out([
    'ok'         => $okProvider,
    'ref_id'     => $ref,
    'status'     => $st,
    'message'    => $pesan !== '' ? $pesan : ($okProvider ? 'Transaksi diterima penyedia.' : 'Transaksi ditolak penyedia — periksa kode produk / data akun tujuan.'),
    'error_msg'  => $norm['error_msg'],
    'trx_id'     => $norm['trx_id'],
    'sn'         => $norm['sn'],
    'price'      => $norm['price'],
    'sisa_saldo' => $norm['sisa_saldo'],
    'metode'     => $a['metode'],
    'raw'        => $raw,
    'provider'   => tv_sanitize($j),
], 200);
