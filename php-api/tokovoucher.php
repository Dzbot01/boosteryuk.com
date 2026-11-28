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
function tv_api_get_authed($path, array $extra = []) {
    $c = tv_cfg();
    if ($c['member_code'] === '' || $c['secret'] === '') return ['res' => null, 'json' => null];
    $base = array_merge(['member_code' => $c['member_code'], 'secret' => $c['secret']], $extra);
    $try = function (array $q) use ($path) {
        $r = tv_api_get($path, $q, 15);
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
    if (isset($cache['__full__']['data'], $cache['__full__']['ts']) && ($now - (int)$cache['__full__']['ts']) < 21600) {
        return $cache['__full__']['data'];
    }
    $c = tv_cfg();
    if ($c['member_code'] === '' || $c['secret'] === '') return null;
    $a = tv_api_get_authed('/member/produk/full');
    $j = $a['json'];
    $d = is_array($j) ? ($j['data'] ?? null) : null;
    if (!is_array($d) || !is_array($d['produk'] ?? null) || !$d['produk']) {
        tv_log('katalog /member/produk/full http=' . ($a['res'] !== null ? $a['res']['code'] : 0) . ' -> kosong/invalid, fallback /produk/code');
        return null;
    }
    $cache['__full__'] = ['ts' => $now, 'data' => $d];
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
        if (!tv_label_wilayah_ok($jenisNama)) continue;
        if (!tv_kode_katalog_ok($kode)) continue;
        $form = $jn ? (string)($jn['format_form'] ?? '') : '';
        $items[] = [
            'kode' => $kode,
            'nama' => trim((string)($p['nama'] ?? $kode)),
            'harga' => $harga,
            'game' => trim((string)($op['nama'] ?? '')),
            'jenis' => $jenisNama,
            'logo' => (string)($op['logo'] ?? ''),
            'butuh_server' => $form !== '' && strpos($form, 'server_id') !== false,
        ];
    }
    return $items;
}

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
    // Sumber utama: /member/produk/full (nama asli, kategori, operator, jenis, status).
    $full = tv_provider_full();
    if (is_array($full)) {
        $itemsFull = tv_items_from_full($full);
        if ($itemsFull) {
            $cache['__all__'] = ['ts' => $now, 'items' => $itemsFull];
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
    $cache['__all__'] = ['ts' => $now, 'items' => $items];
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
function tv_kode_katalog_ok($kode) {
    $k = strtoupper((string)$kode);
    if ($k === '' || strpos($k, 'CEK') !== false) return false;
    if (preg_match('/(RU|SG|MY|BR|PH|LATAM|GLOBAL)([0-9]|$)/', $k)) return false;
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

    if ($action === 'katalog') {
        // Grup game untuk grid "TopUp All Game": hanya kategori Topup game yang
        // dikenali aliasnya DAN lolos filter wilayah (ID Indonesia, tanpa Promo).
        $all = tv_provider_products();
        if (is_array($all)) $all = array_values(array_filter($all, function ($p) { return tv_label_wilayah_ok($p['game'] ?? '') && tv_kode_katalog_ok($p['kode']); }));
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
            if ($key === '') continue;
            if (!isset($groups[$key])) {
                $disp = tv_game_display($key);
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
        tv_out(['ok' => true, 'source' => (is_array($all) && $all) ? 'provider' : 'kosong', 'groups' => $out, 'labels_dilihat' => $labelsDilihat, 'updated_at' => date('Y-m-d H:i')]);
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
        // Buang kategori Promo & server luar di sumbernya: hanya ID (Indonesia);
        // buang juga produk tes & kategori voucher game (respons penyedia datar).
        if (is_array($all)) $all = array_values(array_filter($all, function ($p) { return tv_label_wilayah_ok($p['game'] ?? '') && tv_kode_katalog_ok($p['kode']); }));
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
                $rows[] = ['kode' => $p['kode'], 'nama' => $p['nama'], 'harga' => $p['harga'], 'butuh_server' => !empty($p['butuh_server'])];
            }
            // (b) nama produk menyebut game tsb ("MOBILE LEGENDS 86 Diamond", "MLBB 86", dst);
            if (!$rows) foreach ($all as $p) if ($hitAlias($p['nama'])) {
                $rows[] = ['kode' => $p['kode'], 'nama' => $p['nama'], 'harga' => $p['harga'], 'butuh_server' => !empty($p['butuh_server'])];
            }
            // (c) prefiks kode produk (MFF…=Free Fire, ML…/AMLBB…=Mobile Legends, dst).
            if (!$rows) foreach ($all as $p) {
                $g = tv_code_prefix_game($p['kode']);
                if ($g !== '' && in_array($gN, array_map($norm, tv_game_aliases($g)), true)) {
                    $rows[] = ['kode' => $p['kode'], 'nama' => $p['nama'], 'harga' => $p['harga'], 'butuh_server' => !empty($p['butuh_server'])];
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
        $c = tv_cfg();
        if ($c['member_code'] === '' || $c['secret'] === '') tv_out(['ok' => false, 'message' => 'Integrasi top up belum dikonfigurasi di server.'], 503);
        $a = tv_api_get_authed('/v1/transaksi/status', ['ref_id' => $ref]);
        $r = $a['res'];
        if ($r === null || $r['body'] === null || $r['code'] === 0) {
            tv_out(['ok' => false, 'message' => 'Tidak dapat menghubungi server penyedia (' . ($r !== null && $r['error'] !== '' ? $r['error'] : 'timeout') . ').'], 502);
        }
        $j = $a['json'];
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
