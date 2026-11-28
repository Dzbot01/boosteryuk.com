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
 *  - Aksi `transaksi`, `cek_status`, dan `pending_sync` wajib token login website yang
 *    valid (pending_sync juga menerima secret server untuk cron).
 *  - Balasan penyedia dibersihkan dari field rahasia sebelum diteruskan ke browser.
 *
 * Endpoint proxy ini:
 *  GET  ?action=status                 → {ok, configured, member_code tersamar, member?}
 *  GET  ?action=pricelist&game=Nama    → {ok, source: override|provider|scrape|kosong, items[]}
 *  GET  ?action=cek_akun&game=&user_id= → {ok, valid, username, reason, message, raw}
 *  GET  ?action=cek_status&ref_id=...  → {ok, sumber: webhook|provider, status, trx_id, sn, message}
 *  GET  ?action=pending_sync&token=... → cek berkala pesanan PENDING user (maks 1x / 10 menit)
 *  GET  ?action=pending_sync&secret=...→ mode cron: cek pesanan PENDING semua user
 *  POST/GET ?action=webhook            → simpan status akhir transaksi dari penyedia (200)
 *  POST {token, action:"transaksi", player_id, server_id?, kode_produk}
 *       → {ok, ref_id, status: pending|sukses|gagal, trx_id, sn, message, provider}
 *
 * Aturan status transaksi (dokumentasi resmi penyedia):
 *  - SEMUA HTTP error (4xx/5xx) dari /v1/transaksi HARUS diset sebagai transaksi PENDING;
 *  - NETWORK TIMEOUT / gagal jaringan HARUS diset sebagai transaksi PENDING;
 *  - status final menunggu CALLBACK penyedia, atau dicek berkala tiap 10 menit
 *    (?action=pending_sync — dipanggil otomatis setelah riwayat_pesanan.php membalas);
 *  - pesanan PENDING TIDAK dibatalkan dan saldonya TIDAK dikembalikan; refund hanya
 *    terjadi bila penyedia menegaskan status gagal (lewat callback / cek berkala).
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
 *  ORDER (top up game & PPOB): markup, saldo, riwayat, refund           *
 * ------------------------------------------------------------------ */

/**
 * Markup sistem untuk top up game (%) — HARUS sama dengan TOPUP_MARKUP_PCT di
 * src/data/topupGames.ts supaya harga yang dilihat user = harga yang ditagih server.
 * Harga jual = modal + markup, TANPA pembulatan ratusan (dibulatkan ke rupiah penuh).
 */
const TV_MARKUP_TOPUP_PCT = 2;

/** Persen markup berlaku: child panel yang sudah membeli akses memakai setelannya. */
function tv_markup_pct($tenant, $jenis) {
    if (is_array($tenant)) {
        if ($jenis === 'ppob' && (int)($tenant['access_ppob_markup'] ?? 0) === 1) {
            return max(0, min(CP_MAX_MARKUP, (float)($tenant['markup_ppob_pct'] ?? 0)));
        }
        if ($jenis === 'topup' && (int)($tenant['access_topup_markup'] ?? 0) === 1) {
            return max(0, min(CP_MAX_MARKUP, (float)($tenant['markup_topup_pct'] ?? 0)));
        }
    }
    return $jenis === 'ppob' ? 0.0 : (float)TV_MARKUP_TOPUP_PCT;
}

/** Format Rupiah untuk pesan ke user. */
function tv_rupiah($n) { return 'Rp' . number_format((float)$n, 0, ',', '.'); }

/**
 * Cari produk berdasar kode di katalog penyedia (game lalu layanan PPOB).
 * @return array{0: array|null, 1: string, 2: bool} [item, 'topup'|'ppob'|'', katalogTersedia]
 */
function tv_find_produk($kode) {
    $k = strtoupper(trim((string)$kode));
    if ($k === '') return [null, '', false];
    // Override manual server (file tidak di-commit) ikut diakui.
    foreach (tv_pricelist_override() as $name => $rows) {
        foreach ((is_array($rows) ? $rows : []) as $r) {
            if (strtoupper((string)($r['kode'] ?? '')) !== $k) continue;
            return [['kode' => $k, 'nama' => (string)($r['nama'] ?? $k), 'harga' => (int)($r['harga'] ?? 0),
                     'game' => (string)$name, 'jenis' => (string)($r['jenis'] ?? ''), 'kategori' => 'Topup Game'], 'topup', true];
        }
    }
    $adaKatalog = false;
    $game = tv_provider_products();
    if (is_array($game)) {
        $adaKatalog = true;
        foreach ($game as $it) {
            if (strtoupper((string)($it['kode'] ?? '')) === $k) return [$it, 'topup', true];
        }
    }
    $layanan = tv_provider_layanan();
    if (is_array($layanan)) {
        $adaKatalog = true;
        foreach ($layanan as $it) {
            if (strtoupper((string)($it['kode'] ?? '')) === $k) return [$it, 'ppob', true];
        }
    }
    return [null, '', $adaKatalog];
}

/** Judul pesanan untuk riwayat (dipakai juga halaman Riwayat Pesanan mengenali jenisnya). */
function tv_judul_pesanan($jenis, $item) {
    if ($jenis === 'ppob') {
        $layanan = (string)($item['layanan'] ?? '');
        $kat = (string)($item['kategori'] ?? '');
        $dep = $layanan !== '' ? $layanan : ($kat !== '' ? $kat : 'Layanan');
        return mb_substr('PPOB: ' . $dep . ' — ' . (string)($item['nama'] ?? ''), 0, 255);
    }
    $game = (string)($item['game'] ?? '');
    return mb_substr('Topup Game: ' . ($game !== '' ? $game . ' — ' : '') . (string)($item['nama'] ?? ''), 0, 255);
}

/**
 * Potong saldo user + tulis riwayat_pesanan dalam satu transaksi DB.
 * Gagal (saldo kurang / DB error) = pesanan tidak dibuat dan saldo utuh.
 */
/** Jeda minimum pemeriksaan berkala transaksi PENDING (detik) — aturan penyedia: 10 menit. */
if (!defined('TV_PENDING_SYNC_INTERVAL')) define('TV_PENDING_SYNC_INTERVAL', 600);

/**
 * Alasan sebuah balasan penyedia HARUS diperlakukan sebagai PENDING, bukan gagal.
 * Mengikuti aturan API TokoVoucher:
 *   - SEMUA HTTP error (4xx/5xx)          -> transaksi PENDING;
 *   - NETWORK TIMEOUT / gagal jaringan    -> transaksi PENDING;
 *   - balasan non-JSON / format tak dikenal -> PENDING (nasib transaksi belum pasti);
 *   - status menunggu (pending/processing/unknown) -> PENDING;
 *   - penolakan yang belum pasti (saldo/limit/gangguan sistem di sisi penyedia)
 *     -> PENDING, karena transaksi bisa saja tetap diproses penyedia.
 * Status final menunggu callback penyedia ATAU pemeriksaan berkala `action=pending_sync`
 * (tiap 10 menit). Penolakan PASTI (status "gagal"/"error" dengan alasan jelas:
 * produk tidak ada, IP tidak diizinkan, signature salah, tujuan salah) tetap
 * dibatalkan + saldo dikembalikan. String kosong = bukan PENDING.
 */
function tv_alasan_pending($st, $pesan, $httpCode = 0, $curlErr = '') {
    $st = strtolower(trim((string)$st));
    $p = strtolower(trim((string)$pesan));
    $e = trim((string)$curlErr);
    if ($e !== '') return 'jaringan penyedia bermasalah (' . $e . ')';
    $hc = (int)$httpCode;
    if ($hc === 0) return 'penyedia tidak membalas sampai batas waktu (timeout)';
    if ($hc >= 400) return 'HTTP ' . $hc . ' dari penyedia';
    if (in_array($st, ['pending', 'processing', 'diproses', 'unknown', ''], true)) {
        return 'status menunggu dari penyedia' . ($p !== '' ? ': ' . trim((string)$pesan) : '');
    }
    foreach (['saldo', 'balance', 'limit', 'maint', 'gangguan', 'sibuk', 'busy', 'unavailable',
              'tidak tersedia', 'system', 'sistem', 'timeout', 'time out', 'coba lagi', 'try again',
              'try later', 'sedang diproses', 'stok'] as $kw) {
        if ($kw !== '' && strpos($p, $kw) !== false) return 'penyedia belum memastikan transaksi: ' . trim((string)$pesan);
    }
    return '';
}

/** Riwayat pesanan: 'proses' -> 'pending' + catatan alasan. Saldo TIDAK dikembalikan. */
function tv_tandai_pending_pesanan($conn, $uid, $ref, $alasan = '') {
    if (!($conn instanceof mysqli) || $ref === '') return false;
    $ket = trim((string)$alasan) !== '' ? mb_substr(trim((string)$alasan), 0, 250) : 'menunggu konfirmasi penyedia';
    try {
        $st = cp_q($conn, "UPDATE riwayat_pesanan SET status='pending', catatan=? WHERE order_id=? AND user_id=? AND status IN ('proses','pending')",
            'ssi', $ket, (string)$ref, (int)$uid);
        $ubah = $st->affected_rows;
        $st->close();
        return $ubah > 0;
    } catch (Throwable $e) {
        // Kolom catatan belum ada di instalasi lama: cukup statusnya.
        try {
            cp_q($conn, "UPDATE riwayat_pesanan SET status='pending' WHERE order_id=? AND user_id=? AND status IN ('proses','pending')",
                'si', (string)$ref, (int)$uid)->close();
            return true;
        } catch (Throwable $e2) {
            tv_log('pending ' . $ref . ' DB: ' . $e2->getMessage());
            return false;
        }
    }
}

/**
 * Satu jalur untuk SEMUA hasil transaksi yang belum pasti: pesanan disimpan sebagai
 * PENDING (saldo tetap terpotong, riwayat 'pending' + catatan alasan), lalu status
 * final menunggu callback penyedia atau `action=pending_sync` tiap 10 menit.
 * TIDAK ada refund dan TIDAK ada error ke pengguna di jalur ini.
 */
function tv_pesanan_pending($conn, $ref, array $ctx, $alasan, $norm = null) {
    $n = is_array($norm) ? $norm : ['status' => 'pending', 'message' => '', 'error_msg' => '', 'sn' => '',
        'trx_id' => '', 'ref_id' => (string)$ref, 'produk' => '', 'price' => 0, 'sisa_saldo' => 0];
    tv_trx_store_write($ref, $n + [
        'sumber'         => 'transaksi',
        'status'         => 'pending',
        'alasan_pending' => (string)$alasan,
        'user_id'        => (int)($ctx['user_id'] ?? 0),
        'produk_kode'    => (string)($ctx['produk'] ?? ''),
        'tujuan'         => (string)($ctx['tujuan'] ?? ''),
        'server_id'      => (string)($ctx['server'] ?? ''),
    ]);
    // Hanya pesanan yang saldonya benar-benar dipotong yang ditandai di riwayat.
    if (!empty($ctx['saldo_dipotong']) && (int)($ctx['user_id'] ?? 0) > 0) {
        tv_tandai_pending_pesanan($conn, (int)$ctx['user_id'], $ref, $alasan);
    }
    tv_log('PENDING ' . $ref . ' (user=' . (int)($ctx['user_id'] ?? 0) . ', produk=' . (string)($ctx['produk'] ?? '')
        . ', http=' . (int)($ctx['http'] ?? 0) . ', saldo_dipotong=' . (float)($ctx['saldo_dipotong'] ?? 0) . '): ' . $alasan);
    return [
        'ok'             => true,
        'status'         => 'pending',
        'pending'        => true,
        'ref_id'         => (string)$ref,
        'jenis'          => (string)($ctx['jenis'] ?? 'topup'),
        'produk_nama'    => (string)($ctx['judul'] ?? ''),
        'layanan'        => (string)($ctx['layanan'] ?? ''),
        'harga'          => (float)($ctx['harga_jual'] ?? 0),
        'harga_modal'    => (float)($ctx['harga_modal'] ?? 0),
        'markup_pct'     => (float)($ctx['markup_pct'] ?? 0),
        'saldo'          => $ctx['saldo'] ?? null,
        'saldo_dipotong' => (float)($ctx['saldo_dipotong'] ?? 0),
        'message'        => 'Pesanan berstatus PENDING (' . $alasan . '). Pesanan tidak dibatalkan dan saldo tidak dikembalikan: status final menunggu konfirmasi penyedia (callback) atau pemeriksaan berkala setiap 10 menit. Pantau ref ' . $ref . ' di Riwayat Pesanan.',
        'alasan_pending' => (string)$alasan,
        'trx_id'         => (string)($n['trx_id'] ?? ''),
        'sn'             => (string)($n['sn'] ?? ''),
        'error_msg'      => (string)($n['error_msg'] ?? ''),
        'metode'         => (string)($ctx['metode'] ?? ''),
        'provider'       => is_array($norm) ? tv_sanitize($norm) : null,
    ];
}

/** File state pemeriksaan berkala pesanan PENDING (per user, 10 menit). */
function tv_pending_state_file() {
    return __DIR__ . '/tokovoucher_pending_sync.json';
}

/**
 * Tarik status final transaksi PENDING/proses milik satu user (maks. $maks ref).
 * Dipakai `action=pending_sync`, hook di riwayat_pesanan.php, dan cron.
 * Dijalankan paling sering sekali per TV_PENDING_SYNC_INTERVAL (10 menit) per user.
 */
function tv_pending_sync($conn, $uid, $maks = 3, $paksa = false) {
    $uid = (int)$uid;
    if (!($conn instanceof mysqli) || $uid <= 0) return ['ok' => false, 'diperiksa' => 0, 'message' => 'Konteks user tidak tersedia.'];
    $f = tv_pending_state_file();
    $state = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    if (!is_array($state)) $state = [];
    $now = time();
    $last = (int)($state['user:' . $uid] ?? 0);
    if (!$paksa && ($now - $last) < TV_PENDING_SYNC_INTERVAL) {
        $tunggu = TV_PENDING_SYNC_INTERVAL - ($now - $last);
        return ['ok' => true, 'diperiksa' => 0, 'menunggu' => $tunggu, 'interval_detik' => TV_PENDING_SYNC_INTERVAL,
                'message' => 'Pemeriksaan berkala berikutnya dalam ' . max(1, (int)ceil($tunggu / 60)) . ' menit.'];
    }
    $rows = [];
    try {
        $st = cp_q($conn, "SELECT order_id FROM riwayat_pesanan WHERE user_id=? AND status IN ('pending','proses') ORDER BY id DESC LIMIT 12", 'i', $uid);
        $res = $st->get_result();
        while ($r = $res->fetch_assoc()) $rows[] = (string)($r['order_id'] ?? '');
        $st->close();
    } catch (Throwable $e) {
        tv_log('pending_sync user=' . $uid . ' query: ' . $e->getMessage());
        return ['ok' => false, 'diperiksa' => 0, 'message' => 'Riwayat pesanan tidak dapat dibaca.'];
    }
    // Jeda dicatat lebih dulu walau tidak ada pesanan: pemeriksaan tetap 10 menit sekali.
    $state['user:' . $uid] = $now;
    $state['terakhir'] = date('Y-m-d H:i:s');
    if (count($state) > 400) $state = array_slice($state, -400, null, true);
    @file_put_contents($f, json_encode($state, JSON_UNESCAPED_UNICODE));
    $refs = array_values(array_filter($rows, function ($r) {
        // Hanya pesanan penyedia (TVG-/PPOB-); deposit & pesanan SMM punya jalur sendiri.
        return preg_match('/^(TVG-|PPOB-)/i', trim((string)$r)) === 1;
    }));
    if (!$refs) return ['ok' => true, 'diperiksa' => 0, 'interval_detik' => TV_PENDING_SYNC_INTERVAL, 'message' => 'Tidak ada pesanan menunggu.'];
    $diperiksa = 0; $selesai = 0; $hasil = [];
    foreach ($refs as $ref) {
        if ($diperiksa >= (int)$maks) break;
        $diperiksa++;
        $a = tv_api_trx('/v1/transaksi/status', ['ref_id' => $ref], 8);
        $norm = tv_trx_normalize($a['json']);
        $stt = is_array($norm) ? (string)$norm['status'] : '';
        $pesanCek = is_array($norm) ? ($norm['error_msg'] !== '' ? $norm['error_msg'] : $norm['message']) : '';
        $alasan = tv_alasan_pending($stt, $pesanCek, (int)($a['res']['code'] ?? 0), (string)($a['res']['error'] ?? ''));
        if ($alasan !== '') {
            // Masih belum pasti: TETAP pending, simpan alasan terbaru untuk UI/log.
            tv_tandai_pending_pesanan($conn, $uid, $ref, $alasan);
            if (is_array($norm)) tv_trx_store_write($ref, $norm + ['sumber' => 'pending_sync', 'status' => 'pending', 'alasan_pending' => $alasan, 'user_id' => $uid]);
            $hasil[] = ['ref_id' => $ref, 'status' => 'pending', 'alasan' => $alasan];
            continue;
        }
        if (tv_sync_pesanan($conn, $ref, $stt)) {
            $selesai++;
            if (is_array($norm)) tv_trx_store_write($ref, $norm + ['sumber' => 'pending_sync', 'user_id' => $uid]);
            $hasil[] = ['ref_id' => $ref, 'status' => $stt, 'sn' => is_array($norm) ? (string)$norm['sn'] : ''];
        } else {
            $hasil[] = ['ref_id' => $ref, 'status' => $stt !== '' ? $stt : 'tidak berubah'];
        }
    }
    tv_log('pending_sync user=' . $uid . ' diperiksa=' . $diperiksa . ' final=' . $selesai);
    return ['ok' => true, 'diperiksa' => $diperiksa, 'selesai' => $selesai, 'hasil' => $hasil,
            'interval_detik' => TV_PENDING_SYNC_INTERVAL,
            'message' => $selesai . ' dari ' . $diperiksa . ' pesanan mendapat status final.'];
}

function tv_buat_pesanan($conn, $uid, $ref, $jenis, $judul, $tujuan, $hargaJual, $hargaModal, $tenant) {
    if (!($conn instanceof mysqli)) {
        return ['ok' => false, 'code' => 503, 'message' => 'Koneksi database tidak tersedia di server — pesanan tidak diproses dan saldo tidak dipotong.'];
    }
    if (is_file(__DIR__ . '/riwayat_schema.php')) require_once __DIR__ . '/riwayat_schema.php';
    try {
        if (function_exists('riwayat_ensure_columns')) riwayat_ensure_columns($conn);
        $conn->begin_transaction();
        $st = cp_q($conn, 'SELECT balance FROM users WHERE id=? FOR UPDATE', 'i', (int)$uid);
        $saldo = (float)($st->get_result()->fetch_assoc()['balance'] ?? 0);
        $st->close();
        if ($saldo < $hargaJual) {
            $conn->rollback();
            return ['ok' => false, 'code' => 402, 'saldo' => $saldo,
                    'message' => 'Saldo tidak cukup (' . tv_rupiah($saldo) . ' dari ' . tv_rupiah($hargaJual) . '). Isi saldo terlebih dahulu.'];
        }
        cp_q($conn, 'UPDATE users SET balance=balance-? WHERE id=?', 'di', $hargaJual, (int)$uid)->close();
        cp_q($conn, "INSERT INTO riwayat_pesanan (user_id, order_id, service_name, quantity, price, status, order_type, target)
                     VALUES (?,?,?,1,?, 'proses', ?, ?)", 'issdss', (int)$uid, (string)$ref, $judul, $hargaJual, $jenis === 'ppob' ? 'ppob' : 'topup', mb_substr((string)$tujuan, 0, 255))->close();
        $conn->commit();
    } catch (Throwable $e) {
        try { $conn->rollback(); } catch (Throwable $e2) { /* abaikan */ }
        // Kolom order_type/target bisa belum ada di instalasi lama: coba format minimal.
        try {
            $conn->begin_transaction();
            $st = cp_q($conn, 'SELECT balance FROM users WHERE id=? FOR UPDATE', 'i', (int)$uid);
            $saldo = (float)($st->get_result()->fetch_assoc()['balance'] ?? 0);
            $st->close();
            if ($saldo < $hargaJual) {
                $conn->rollback();
                return ['ok' => false, 'code' => 402, 'saldo' => $saldo, 'message' => 'Saldo tidak cukup (' . tv_rupiah($saldo) . ' dari ' . tv_rupiah($hargaJual) . '). Isi saldo terlebih dahulu.'];
            }
            cp_q($conn, 'UPDATE users SET balance=balance-? WHERE id=?', 'di', $hargaJual, (int)$uid)->close();
            cp_q($conn, "INSERT INTO riwayat_pesanan (user_id, order_id, service_name, quantity, price, status) VALUES (?,?,?,1,?, 'proses')",
                'issd', (int)$uid, (string)$ref, $judul, $hargaJual)->close();
            $conn->commit();
        } catch (Throwable $e2) {
            try { $conn->rollback(); } catch (Throwable $e3) { /* abaikan */ }
            tv_log('order ' . $ref . ' GAGAL DB: ' . $e2->getMessage());
            return ['ok' => false, 'code' => 500, 'message' => 'Gagal membuat pesanan (database), saldo tidak dipotong.'];
        }
    }
    // Pendapatan child panel: selisih harga jual - harga modal (markup) tercatat.
    if (is_array($tenant) && (int)($tenant['id'] ?? 0) > 0) {
        try {
            cp_record_order($conn, (int)$tenant['id'], (int)$uid, (string)$ref, $jenis === 'ppob' ? 'ppob' : 'topup', $judul, 1, $hargaJual, $hargaModal);
        } catch (Throwable $e) { tv_log('child panel order ' . $ref . ' tidak tercatat: ' . $e->getMessage()); }
    }
    return ['ok' => true, 'saldo' => $saldo - $hargaJual];
}

/**
 * Batalkan pesanan: kembalikan saldo + tandai riwayat 'batal' (sekali saja).
 * UPDATE bersyarat membuat refund idempoten walau webhook & cek_status balapan.
 */
function tv_batalkan_pesanan($conn, $ref, $alasan = '') {
    if (!($conn instanceof mysqli) || $ref === '') return false;
    try {
        $st = cp_q($conn, "UPDATE riwayat_pesanan SET status='batal' WHERE order_id=? AND status IN ('proses','pending')", 's', (string)$ref);
        $ubah = $st->affected_rows;
        $st->close();
        if ($ubah < 1) return false;
        $st = cp_q($conn, 'SELECT user_id, price FROM riwayat_pesanan WHERE order_id=? ORDER BY id DESC LIMIT 1', 's', (string)$ref);
        $row = $st->get_result()->fetch_assoc();
        $st->close();
        if (!$row) return false;
        cp_q($conn, 'UPDATE users SET balance=balance+? WHERE id=?', 'di', (float)$row['price'], (int)$row['user_id'])->close();
        tv_log('refund ' . $ref . ' user=' . $row['user_id'] . ' nominal=' . $row['price'] . ($alasan !== '' ? ' alasan=' . $alasan : ''));
        return true;
    } catch (Throwable $e) {
        tv_log('refund ' . $ref . ' gagal: ' . $e->getMessage());
        return false;
    }
}

/** Tandai pesanan selesai (status penyedia sukses). */
function tv_selesaikan_pesanan($conn, $ref) {
    if (!($conn instanceof mysqli) || $ref === '') return false;
    try {
        $st = cp_q($conn, "UPDATE riwayat_pesanan SET status='selesai' WHERE order_id=? AND status IN ('proses','pending')", 's', (string)$ref);
        $ubah = $st->affected_rows;
        $st->close();
        return $ubah > 0;
    } catch (Throwable $e) {
        return false;
    }
}

/** Sinkron riwayat pesanan dengan status akhir penyedia (dipanggil webhook, cek_status, transaksi). */
function tv_sync_pesanan($conn, $ref, $status) {
    $s = strtolower(trim((string)$status));
    if (in_array($s, ['gagal', 'failed', 'error', 'ditolak', 'cancel', 'cancelled', 'batal'], true)) return tv_batalkan_pesanan($conn, $ref, 'status penyedia: ' . $s);
    if (in_array($s, ['sukses', 'success', 'berhasil', 'selesai', 'done'], true)) return tv_selesaikan_pesanan($conn, $ref);
    return false;
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
        // Penyedia punya DUA kanal kategori game: "Topup Game" (diamond/UC per operator
        // game) dan "Voucher Game" (voucher lintas publisher: Roblox, UniPin, Google
        // Play, ...). Sebelumnya hanya kategori ber-substring "topup" yang lolos, jadi
        // SEMUA produk Voucher Roblox terbuang di sini dan kartu Roblox tidak pernah
        // muncul di halaman top up game (pricelist membalas source:"kosong").
        // Kategori non-game (Pulsa, PLN, E-Money, Hiburan, ...) tetap disaring.
        if ($cat !== '' && stripos($cat, 'topup') === false && stripos($cat, 'voucher game') === false) continue;
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
            'kategori' => $cat,
        ];
    }
    return $items;
}

/* ------------------------------------------------------------------ *
 *  LAYANAN PPOB (produk SELAIN top up game)                            *
 * ------------------------------------------------------------------ */

/**
 * Kata kunci layanan non-game di label penyedia: pulsa, paket data, e-money,
 * voucher, token listrik, tagihan, sampai operator telekomunikasi (AIS,
 * TrueMove H, DTAC, Telkomsel, …). Dipakai untuk memisahkan layanan PPOB dari
 * katalog top up game yang berasal dari endpoint /member/produk/full yang sama.
 */
function tv_layanan_label($teks) {
    $t = strtolower(trim((string)$teks));
    if ($t === '') return false;
    return preg_match('/(pulsa|paket\s*data|\bdata\b|credit|kredit|token|listrik|\bpln\b|wifi|internet|voucher|\bsim\b|e-?money|e-?wallet|dompet|\bovo\b|\bdana\b|gopay|go-?pay|shopee\s*pay|link\s*aja|bpjs|pascabayar|prabayar|prepaid|postpaid|tagihan|pdam|telecom|\bdtac\b|\bais\b|truemove|true\s*move|\bnt\b|celcom|\bdigi\b|maxis|u\s*mobile|touch\s*n\'?\s*go|t-?money|airtel|vodafone|\bstc\b|zain|ooredoo|\bjio\b|banglalink|robi|grameenphone|teletalk|ncell|dialog|mobitel|telkomsel|indosat|\bxl\b|axis|\btri\b|smartfren|by\.?u|netflix|spotify|youtube|google\s*play|unipin|streaming)/', $t) === 1;
}

/**
 * Benarkah baris produk ini LAYANAN (bukan top up game)?
 * Game yang dikenal tabel alias atau berlabel "game" selalu ditolak lebih dulu,
 * sisanya harus menyebut kata kunci layanan — label tak dikenal tidak diklaim.
 */
function tv_is_layanan($operatorNama, $jenisNama, $kategori) {
    // Kategori penyedia adalah penanda paling jujur: "Topup Game" & "Voucher Game"
    // = top up game (bukan layanan PPOB); kategori lain (Pulsa, Paket Data, PLN,
    // E-Money, TV, Masa Aktif, Pascabayar, E-Toll, Transfer Dana, Aktivasi Perdana,
    // Pulsa Transfer, Injek Voucher Kosong, eSIM, Hiburan & Voucher Digital,
    // Malaysia/Vietnam/Thailand/Singapore Topup) = layanan.
    $kat = trim((string)$kategori);
    if ($kat !== '') {
        if (preg_match('/\bgames?\b/i', $kat)) return false;
        if (tv_game_key_of_label($operatorNama) !== '') return false;
        if (preg_match('/\bgames?\b|voucher\s+game/i', $operatorNama)) return false;
        return true;
    }
    // Tanpa kategori (mis. dipanggil dari grid katalog game): andalkan kata kunci.
    if (tv_game_key_of_label($operatorNama) !== '') return false;
    if (preg_match('/top\s*-?\s*up\s*game|\bgames?\b/i', $operatorNama)) return false;
    return tv_layanan_label($operatorNama) || tv_layanan_label($jenisNama);
}

/**
 * Layanan PPOB dari /member/produk/full: semua produk aktif yang BUKAN top up
 * game (pulsa, paket data, e-money, voucher, token listrik, tagihan, operator
 * telekomunikasi). Bentuk data sama dengan tv_items_from_full sehingga
 * harga/kode yang tampil di halaman PPOB adalah data asli penyedia.
 */
function tv_layanan_from_full($d) {
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
        if ($kode === '' || $harga <= 0 || strpos($kode, 'CEK') !== false) continue;
        $op = is_array($ops[(int)($p['operator_id'] ?? -1)] ?? null) ? $ops[(int)$p['operator_id']] : null;
        $jn = is_array($jns[(int)($p['jenis_id'] ?? -1)] ?? null) ? $jns[(int)$p['jenis_id']] : null;
        if (!$op || (int)($op['status'] ?? 1) !== 1) continue;
        if ($jn && (int)($jn['status'] ?? 1) !== 1) continue;
        $opNama = trim((string)($op['nama'] ?? ''));
        $jenisNama = $jn ? trim((string)($jn['nama'] ?? '')) : '';
        $cat = trim((string)($cats[(int)($p['kategori_id'] ?? -1)] ?? ''));
        if (!tv_is_layanan($opNama, $jenisNama, $cat)) continue;
        $items[] = [
            'kode'     => $kode,
            'nama'     => trim((string)($p['nama'] ?? $kode)),
            'harga'    => $harga,
            'layanan'  => $opNama !== '' ? $opNama : ($jenisNama !== '' ? $jenisNama : ($cat !== '' ? $cat : $kode)),
            'kategori' => $cat,
            'jenis'    => $jenisNama,
            'logo'     => (string)($op['logo'] ?? ''),
        ];
    }
    return $items;
}

/** Kelompokkan layanan jadi kartu: satu kartu per layanan (operator) + kategori. */
function tv_layanan_kelompok($items) {
    $g = [];
    foreach ((array)$items as $it) {
        $nama = (string)$it['layanan'];
        $id = tv_slugify($it['kategori'] !== '' ? ($it['kategori'] . ' ' . $nama) : $nama);
        if ($id === '') $id = 'layanan';
        while (isset($g[$id]) && $g[$id]['layanan'] !== $nama) $id .= '-2';
        if (!isset($g[$id])) {
            $g[$id] = ['id' => $id, 'layanan' => $nama, 'kategori' => (string)$it['kategori'], 'logo' => (string)$it['logo'],
                       'jumlah' => 0, 'termurah' => 0, 'termahal' => 0, 'labels' => []];
        }
        $g[$id]['jumlah']++;
        if ($g[$id]['termurah'] === 0 || $it['harga'] < $g[$id]['termurah']) $g[$id]['termurah'] = (int)$it['harga'];
        if ($it['harga'] > $g[$id]['termahal']) $g[$id]['termahal'] = (int)$it['harga'];
        if ($g[$id]['logo'] === '' && !empty($it['logo'])) $g[$id]['logo'] = (string)$it['logo'];
        $lb = $it['jenis'] !== '' ? (string)$it['jenis'] : (string)$it['nama'];
        if ($lb !== '' && count($g[$id]['labels']) < 8 && !in_array($lb, $g[$id]['labels'], true)) $g[$id]['labels'][] = $lb;
    }
    $out = array_values($g);
    usort($out, function ($a, $b) { return strcmp($a['layanan'], $b['layanan']); });
    return $out;
}

/** Layanan PPOB siap pakai (cache file 6 jam, sumber sama dengan katalog game). */
function tv_provider_layanan() {
    $cacheFile = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $cache = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
    if (!is_array($cache)) $cache = [];
    $now = time();
    if (isset($cache['__layanan_v2__']['items'], $cache['__layanan_v2__']['ts']) && ($now - (int)$cache['__layanan_v2__']['ts']) < 21600) {
        $GLOBALS['tv_sumber_layanan'] = (string)($cache['__layanan_v2__']['sumber'] ?? 'cache');
        $GLOBALS['tv_layanan_diag'] = (array)($cache['__layanan_v2__']['diag'] ?? []);
        return $cache['__layanan_v2__']['items'];
    }
    $full = tv_provider_full();
    if (!is_array($full)) {
        $GLOBALS['tv_sumber_layanan'] = '';
        tv_log('layanan: /member/produk/full tidak tersedia (' . (string)($GLOBALS['tv_full_error'] ?? '') . ')');
        return null;
    }
    $items = tv_layanan_from_full($full);
    // Diagnostik: daftar kategori & operator ASLI penyedia (untuk menyetel filter).
    $diag = [
        'kategori' => array_values(array_slice(array_map(function ($c) { return (string)($c['nama'] ?? ''); }, (array)($full['category'] ?? [])), 0, 60)),
        'operator' => array_values(array_slice(array_map(function ($o) { return (string)($o['nama'] ?? ''); }, (array)($full['operator'] ?? [])), 0, 120)),
    ];
    $GLOBALS['tv_layanan_diag'] = $diag;
    $GLOBALS['tv_sumber_layanan'] = 'full';
    $cache['__layanan_v2__'] = ['ts' => $now, 'items' => $items, 'sumber' => 'full', 'diag' => $diag];
    @file_put_contents($cacheFile, json_encode($cache, JSON_UNESCAPED_UNICODE));
    return $items;
}

function tv_provider_products() {
    $cacheFile = __DIR__ . '/tokovoucher_pricelist_cache.json';
    $cache = is_file($cacheFile) ? json_decode((string)file_get_contents($cacheFile), true) : null;
    if (!is_array($cache)) $cache = [];
    $now = time();
    if (isset($cache['__all_v4__']['items'], $cache['__all_v4__']['ts']) && ($now - (int)$cache['__all_v4__']['ts']) < 21600) {
        $GLOBALS['tv_sumber_katalog'] = (string)($cache['__all_v4__']['sumber'] ?? 'cache');
        return $cache['__all_v4__']['items'];
    }
    $c = tv_cfg();
    if ($c['member_code'] === '' || $c['secret'] === '') return null;
    // Sumber utama: /member/produk/full (nama asli, kategori, operator, jenis, status).
    $full = tv_provider_full();
    if (is_array($full)) {
        $itemsFull = tv_items_from_full($full);
        if ($itemsFull) {
            $GLOBALS['tv_sumber_katalog'] = 'full';
            $cache['__all_v4__'] = ['ts' => $now, 'items' => $itemsFull, 'sumber' => 'full'];
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
    $cache['__all_v4__'] = ['ts' => $now, 'items' => $items, 'sumber' => 'produk/code'];
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
        // Kanal "Voucher Game": label penyedianya "Voucher Roblox" sehingga tanpa alias
        // ini produknya tidak pernah dikelompokkan jadi kartu Roblox.
        'roblox'           => ['roblox', 'rbx', 'robux'],
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
        'zenlesszonezero' => 'Zenless Zone Zero', 'roblox' => 'Roblox',
    ];
    return $map[$key] ?? ucfirst((string)$key);
}

/** Slug URL dari nama game ("Farlight 84" => farlight-84). */
function tv_slugify($t) {
    return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower((string)$t)), '-');
}

/**
 * Kode layak katalog/topup game: buang produk tes ("…CEK…"), kode server luar
 * (RU/SG/MY/BR/PH/LATAM/GLOBAL), dan duplikat kanal voucher untuk game yang punya
 * kanal Topup Game sendiri ("V"+prefiks game, mis. VPUBGGCOIN500) — respons
 * penyedia datar tanpa label kategori sehingga penyaringan harus lewat kode.
 * Game kanal voucher-only (Roblox) dikecualikan dari kedua aturan itu.
 */
function tv_kode_katalog_ok($kode, $izinkanWilayah = false) {
    $k = strtoupper((string)$kode);
    if ($k === '' || strpos($k, 'CEK') !== false) return false;
    // Game kanal voucher-only (Roblox) tidak punya padanan di kanal Topup Game:
    // kode "V…"/bertoken wilayah adalah produknya sendiri, bukan duplikat.
    $gKode = tv_code_prefix_game(strpos($k, 'V') === 0 ? substr($k, 1) : $k);
    $voucherOnly = $gKode !== '' && !in_array($gKode, tv_game_kanal_topup(), true);
    // Token wilayah di kode (FFSG…, MLBR…) hanya sampah untuk daftar ID; untuk chip
    // wilayah (server luar) token itu justru penanda produknya — boleh lewat.
    if (!$izinkanWilayah && !$voucherOnly && preg_match('/(RU|SG|MY|BR|PH|LATAM|GLOBAL)([0-9]|$)/', $k)) return false;
    if (strpos($k, 'V') === 0 && $gKode !== '' && !$voucherOnly) return false;
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
/**
 * Prefiks kode produk per kanal. Kanal "voucher" = game yang HANYA dijual sebagai
 * voucher (Roblox) sehingga kode berawalan V / bertoken wilayah tetap produk sah;
 * kanal "topup" = game yang punya kanal Topup Game sendiri sehingga kode "V…"
 * (VPUBGGCOIN500, VFF…) adalah duplikat grosir yang harus dibuang.
 */
function tv_code_prefix_prefiks() {
    return [
    'voucher' => [
        'ROBLOX' => 'roblox', 'RBLX' => 'roblox', 'RBX' => 'roblox', 'RBUX' => 'roblox', 'ROBUX' => 'roblox',
    ],
    'topup' => [
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
    ],
    ];
}

/** Daftar game ber-kanal Topup Game (nilai unik prefiks kanal topup). */
function tv_game_kanal_topup() {
    return array_values(array_unique(tv_code_prefix_prefiks()['topup']));
}

function tv_code_prefix_game($kode) {
    $k = strtoupper((string)$kode);
    foreach (tv_code_prefix_prefiks() as $grup) {
        foreach ((array)$grup as $pref => $g) if (strpos($k, $pref) === 0) return $g;
    }
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
    // Riwayat pesanan + refund (bila gagal) disinkron dari status akhir penyedia.
    $sync = tv_sync_pesanan($conn, $ref, $norm['status']);
    tv_log('webhook ref=' . $ref . ' status=' . $norm['status'] . ' trx=' . $norm['trx_id'] . ' sn=' . $norm['sn'] . ($baru ? ' (baru)' : ' (duplikat, dilewati)') . ($sync ? ' riwayat-disinkron' : ''));
    tv_out(['ok' => true, 'ref_id' => $ref, 'status' => $norm['status'], 'trx_id' => $norm['trx_id'], 'baru' => $baru, 'riwayat' => $sync]);
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
        // Kredensial kerap diselipi spasi/newline/kutipan saat disalin ke file config —
        // buang semuanya supaya signature md5(merchant+secret) tidak gagal "Unauthorized".
        $c['ag_merchant'] = trim((string)$c['ag_merchant'], " \t\r\n\0\x0B\"'");
        $c['ag_secret'] = trim((string)$c['ag_secret'], " \t\r\n\0\x0B\"'");
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
            $gagal('koneksi', $raw !== '' ? $raw : 'Penyedia tidak dapat dihubungi dari server: ' . ($err !== '' ? $err : 'timeout') . '.', ['http' => $code, 'raw' => $raw]);
        }
        if (!is_array($j)) {
            tv_log('cek_akun ' . $gc . ' user=' . $userId . ' http=' . $code . ' NON_JSON raw=' . $raw);
            $gagal('non_json', $raw !== '' ? $raw : 'Respons penyedia kosong (HTTP ' . $code . ').', ['http' => $code, 'raw' => $raw]);
        }
        if ((int)($j['status'] ?? 0) !== 1) {
            $msg = (string)($j['error_msg'] ?? $j['message'] ?? $j['error'] ?? '');
            tv_log('cek_akun ' . $gc . ' user=' . $userId . ' http=' . $code . ' DITOLAK raw=' . $raw);
            // UI menampilkan respons penyedia APA ADANYA tanpa teks tambahan.
            $gagal('ditolak', $raw !== '' ? $raw : ($msg !== '' ? $msg : 'status bukan 1'), ['http' => $code, 'raw' => $raw]);
        }
        if (!is_array($j['data'] ?? null)) {
            tv_log('cek_akun ' . $gc . ' user=' . $userId . ' http=' . $code . ' TANPA_DATA raw=' . $raw);
            $gagal('tanpa_data', $raw !== '' ? $raw : 'Respons penyedia tanpa field data (HTTP ' . $code . ').', ['http' => $code, 'raw' => $raw]);
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
                // tampil di grid dengan namanya sendiri; layanan non-game
                // (pulsa/data/e-money/voucher/operator telekom: AIS, TrueMove H,
                // DTAC, …) dibuang dari grid game — masuk halaman PPOB.
                if (tv_is_layanan((string)$p['game'], (string)($p['jenis'] ?? ''), (string)($p['kategori'] ?? ''))) continue;
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

    /* Layanan SELAIN top up game (bahan card Menu Service di halaman PPOB dan
     * grid "Lainnya"): pulsa, paket data, e-money, voucher, token listrik,
     * tagihan, operator telekomunikasi — semua dari /member/produk/full. */
    if ($action === 'layanan') {
        $items = tv_provider_layanan();
        if (!is_array($items)) {
            tv_out([
                'ok' => false,
                'message' => 'Daftar layanan belum dapat diambil dari server penyedia'
                    . ((string)($GLOBALS['tv_full_error'] ?? '') !== '' ? ' (' . (string)$GLOBALS['tv_full_error'] . ')' : '') . '.',
                'sumber' => '',
            ], 502);
        }
        $kelompok = tv_layanan_kelompok($items);
        $diag = (array)($GLOBALS['tv_layanan_diag'] ?? []);
        tv_out([
            'ok' => true,
            'source' => $kelompok ? 'provider' : 'kosong',
            'sumber' => (string)($GLOBALS['tv_sumber_layanan'] ?? ''),
            'total_produk' => count($items),
            'kelompok' => $kelompok,
            'kategori_penyedia' => (array)($diag['kategori'] ?? []),
            'operator_penyedia' => (array)($diag['operator'] ?? []),
            'updated_at' => date('Y-m-d H:i'),
        ]);
    }

    if ($action === 'layanan_produk') {
        $id = tv_slugify((string)($_GET['kelompok'] ?? ''));
        $items = tv_provider_layanan();
        if (!is_array($items)) {
            tv_out(['ok' => false, 'message' => 'Daftar layanan belum dapat diambil dari server penyedia.'], 502);
        }
        if ($id === '') tv_out(['ok' => false, 'message' => 'Parameter kelompok layanan wajib diisi.'], 400);
        $punya = [];
        foreach ($items as $it) {
            $gid = tv_slugify($it['kategori'] !== '' ? ($it['kategori'] . ' ' . $it['layanan']) : $it['layanan']);
            if ($gid === $id) $punya[] = $it;
        }
        if (!$punya) tv_out(['ok' => false, 'message' => 'Layanan tidak ditemukan di katalog penyedia.'], 404);
        usort($punya, function ($a, $b) { return $a['harga'] <=> $b['harga']; });
        $kelompok = tv_layanan_kelompok($punya);
        tv_out([
            'ok' => true,
            'kelompok' => $kelompok[0] ?? null,
            'items' => array_map(function ($it) {
                return ['kode' => $it['kode'], 'nama' => $it['nama'], 'harga' => (int)$it['harga'], 'jenis' => (string)$it['jenis']];
            }, array_slice($punya, 0, 300)),
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

    /* ============ CEK BERKALA PESANAN PENDING (tiap 10 menit) ============
     * Aturan API TokoVoucher: HTTP error & network timeout diset PENDING, lalu
     * status final menunggu callback penyedia ATAU dicek berkala tiap 10 menit.
     *   GET ?action=pending_sync&token=<token login>  -> pesanan user itu saja
     *   GET ?action=pending_sync&secret=<ag_secret>   -> semua user (untuk cron)
     * Dijalankan paling sering sekali per 10 menit per user (state file
     * tokovoucher_pending_sync.json), jadi aman dipanggil tiap halaman Riwayat dibuka.
     * Contoh cron:  *\/10 * * * * curl -s "https://app.boosteryuk.com/api/tokovoucher.php?action=pending_sync&secret=AG_SECRET"
     */
    if ($action === 'pending_sync') {
        $c = tv_cfg();
        $maks = max(1, min(8, (int)($_GET['maks'] ?? 3)));
        $paksa = trim((string)($_GET['paksa'] ?? $in['paksa'] ?? '')) === '1';
        $uid = isset($conn) && $conn instanceof mysqli
            ? cp_user_id($conn, trim((string)($_GET['token'] ?? $in['token'] ?? ''))) : null;
        if ($uid) {
            tv_out(tv_pending_sync($conn, (int)$uid, $maks, $paksa) + ['mode' => 'user', 'user_id' => (int)$uid]);
        }
        $kunci = trim((string)($_GET['secret'] ?? $in['secret'] ?? ''));
        if ((string)$c['secret'] === '' || $kunci === '' || !hash_equals((string)$c['secret'], $kunci)) {
            tv_out(['ok' => false, 'message' => 'Silakan login terlebih dahulu untuk memeriksa pesanan.'], 401);
        }
        // Mode cron (tanpa token): periksa pesanan menunggu milik semua user.
        $uids = [];
        try {
            $st = cp_q($conn, "SELECT DISTINCT user_id FROM riwayat_pesanan
                               WHERE status IN ('pending','proses') AND (order_id LIKE 'TVG-%' OR order_id LIKE 'PPOB-%') LIMIT 25");
            $res = $st->get_result();
            while ($r = $res->fetch_assoc()) $uids[] = (int)$r['user_id'];
            $st->close();
        } catch (Throwable $e) { tv_log('pending_sync cron query: ' . $e->getMessage()); }
        $ringkas = [];
        foreach ($uids as $u) {
            $h = tv_pending_sync($conn, $u, $maks, $paksa);
            if ((int)($h['diperiksa'] ?? 0) > 0) $ringkas['user:' . $u] = $h;
        }
        tv_out(['ok' => true, 'mode' => 'cron', 'user_diperiksa' => count($ringkas), 'user_menunggu' => count($uids),
                'interval_detik' => TV_PENDING_SYNC_INTERVAL, 'hasil' => $ringkas,
                'message' => $ringkas ? 'Pemeriksaan berkala pesanan PENDING selesai.' : 'Tidak ada pesanan menunggu yang jatuh tempo.']);
    }

    if ($action === 'cek_status') {
        $ref = trim((string)($_GET['ref_id'] ?? ''));
        if ($ref === '') tv_out(['ok' => false, 'message' => 'ref_id wajib diisi.'], 400);

        // Pertama: bila webhook penyedia sudah melaporkan status akhir, itu jawaban pasti —
        //    tidak perlu menembak API penyedia (hemat & tetap jalan walau IP diblokir).
        $simpan = tv_trx_store_read($ref);
        $stSimpan = is_array($simpan) ? strtolower((string)($simpan['status'] ?? '')) : '';
        if (in_array($stSimpan, ['sukses', 'gagal'], true)) {
            tv_sync_pesanan($conn, $ref, $stSimpan); // idempoten: riwayat & refund hanya sekali
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
        // Pemeriksaan status yang gagal (timeout / HTTP error / non-JSON) TIDAK mengubah
        // pesanan jadi gagal: status tetap PENDING sampai callback/cek berkala berhasil.
        if ($r === null || $r['body'] === null || $r['code'] === 0) {
            $alasanCek = tv_alasan_pending('', '', 0, is_array($r) ? (string)($r['error'] ?? '') : 'tidak ada balasan');
            tv_out(['ok' => true, 'ref_id' => $ref, 'sumber' => 'provider', 'status' => 'pending', 'pending' => true,
                    'alasan_pending' => $alasanCek, 'message' => 'Status belum dapat dipastikan (' . $alasanCek . '). Pesanan tetap PENDING dan akan diperiksa ulang otomatis setiap 10 menit.',
                    'raw' => is_array($r) ? substr((string)$r['body'], 0, 300) : '']);
        }
        $j = $a['json'];
        if (!is_array($j)) {
            $alasanCek = tv_alasan_pending('unknown', '', (int)$r['code'], '');
            tv_out(['ok' => true, 'ref_id' => $ref, 'sumber' => 'provider', 'status' => 'pending', 'pending' => true,
                    'alasan_pending' => $alasanCek, 'message' => 'Penyedia membalas format tak dikenal (HTTP ' . $r['code'] . '). Pesanan tetap PENDING dan akan diperiksa ulang otomatis setiap 10 menit.',
                    'raw' => substr(preg_replace('/\s+/', ' ', (string)$r['body']), 0, 300)]);
        }
        $norm = tv_trx_normalize($j);
        if ($norm !== null && in_array($norm['status'], ['sukses', 'gagal'], true)) {
            tv_trx_store_write($ref, $norm + ['sumber' => 'cek_status']);
            tv_sync_pesanan($conn, $ref, $norm['status']);
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

// Tujuan = Player ID (game) atau nomor HP / ID pelanggan / email akun (PPOB),
// jadi karakter @ dan + ikut diizinkan (voucher digital & nomor internasional).
$tujuan = preg_replace('/[^A-Za-z0-9._@+-]/', '', (string)($in['player_id'] ?? ''));
$server = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['server_id'] ?? ''));
$produk = preg_replace('/[^A-Za-z0-9._-]/', '', (string)($in['kode_produk'] ?? ''));
if (mb_strlen($tujuan) < 3 || mb_strlen($tujuan) > 64) tv_out(['ok' => false, 'message' => 'Player ID / nomor tujuan tidak valid.'], 400);
if (mb_strlen($server) > 20) tv_out(['ok' => false, 'message' => 'Server ID terlalu panjang.'], 400);
if ($produk === '' || mb_strlen($produk) > 40) tv_out(['ok' => false, 'message' => 'Kode produk tidak valid.'], 400);

/* Harga & nama produk diambil dari KATALOG PENYEDIA di server (bukan dari browser),
 * jadi user tidak bisa memesan kode asal atau mengubah harga. */
[$itemProduk, $jenisOrder, $katalogAda] = tv_find_produk($produk);
if (!$itemProduk) {
    tv_out(['ok' => false, 'message' => $katalogAda
        ? 'Kode produk tidak ditemukan di katalog penyedia. Muat ulang halaman lalu pilih ulang produknya.'
        : 'Katalog penyedia sedang tidak tersedia, pesanan belum bisa diproses. Coba beberapa saat lagi.'], $katalogAda ? 404 : 503);
}
$hargaModal = (int)($itemProduk['harga'] ?? 0);
if ($hargaModal <= 0) tv_out(['ok' => false, 'message' => 'Harga produk ini tidak tersedia di katalog penyedia.'], 503);

// Markup: child panel yang sudah membeli akses memakai persennya; web utama 2% (top up game).
$tenant = (isset($conn) && $conn instanceof mysqli) ? cp_resolve($conn) : null;
$markupPct = tv_markup_pct($tenant, $jenisOrder);
$hargaJual = (int)round($hargaModal * (1 + $markupPct / 100));

// Ref ID unik per permintaan (dipakai juga untuk cek status nanti); awalan menandai jenis pesanan.
$ref = ($jenisOrder === 'ppob' ? 'PPOB-' : 'TVG-') . date('ymdHis') . random_int(10, 99);

// Potong saldo + tulis riwayat_pesanan SEBELUM menembak penyedia.
$judulPesanan = tv_judul_pesanan($jenisOrder, $itemProduk);
$buat = tv_buat_pesanan($conn, $uid, $ref, $jenisOrder, $judulPesanan, $tujuan, $hargaJual, $hargaModal, $tenant);
if (empty($buat['ok'])) {
    $kodeBuat = (int)($buat['code'] ?? 500);
    // Database pesanan tidak tersedia: TIDAK ada saldo dipotong, tetapi pesanan tetap
    // dicatat PENDING (bukan error) supaya terlihat di Riwayat dan bisa diselesaikan.
    if ($kodeBuat === 500) {
        tv_out(tv_pesanan_pending($conn, $ref, [
            'user_id' => $uid, 'jenis' => $jenisOrder, 'judul' => $judulPesanan, 'produk' => $produk,
            'tujuan' => $tujuan, 'server' => $server, 'harga_jual' => $hargaJual, 'harga_modal' => $hargaModal,
            'markup_pct' => $markupPct, 'saldo' => $buat['saldo'] ?? null, 'saldo_dipotong' => 0, 'http' => 0,
            'layanan' => (string)($itemProduk['layanan'] ?? $itemProduk['game'] ?? ''),
        ], 'database pesanan sedang tidak tersedia'), 200);
    }
    // 402 = saldo USER tidak cukup, 503 = katalog/koneksi belum siap: keduanya pasti,
    // bukan transaksi menggantung -> tetap dibalas sebagai kesalahan yang jelas.
    tv_out(['ok' => false, 'ref_id' => $ref, 'status' => 'batal', 'jenis' => $jenisOrder, 'harga' => $hargaJual,
            'saldo' => $buat['saldo'] ?? null, 'message' => (string)($buat['message'] ?? 'Pesanan tidak dapat dibuat.')], $kodeBuat);
}
$saldoSetelah = $buat['saldo'] ?? null;
// Konteks pesanan dipakai setiap jalur PENDING di bawah (aturan API penyedia:
// HTTP error & network timeout = transaksi PENDING, bukan gagal).
$ctxPesanan = [
    'user_id' => $uid, 'jenis' => $jenisOrder, 'judul' => $judulPesanan, 'produk' => $produk,
    'tujuan' => $tujuan, 'server' => $server, 'harga_jual' => $hargaJual, 'harga_modal' => $hargaModal,
    'markup_pct' => $markupPct, 'saldo' => $saldoSetelah, 'saldo_dipotong' => $hargaJual,
    'layanan' => (string)($itemProduk['layanan'] ?? $itemProduk['game'] ?? ''),
];

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
    // NETWORK TIMEOUT / gagal jaringan: aturan API penyedia -> transaksi PENDING.
    // Pesanan TIDAK dibatalkan dan saldo TIDAK dikembalikan (transaksi bisa saja
    // sudah masuk di sisi penyedia); status final dari callback / pending_sync.
    $alasanNet = tv_alasan_pending('', '', 0, (string)($r['error'] ?? ''));
    tv_log("user=$uid ref=$ref produk=$produk tujuan=$tujuan server=$server metode=" . $a['metode']
        . ' CURL_ERROR=' . ((string)($r['error'] ?? '') !== '' ? (string)$r['error'] : 'timeout') . ' -> PENDING');
    tv_out(tv_pesanan_pending($conn, $ref, $ctxPesanan + ['metode' => $a['metode'], 'http' => 0], $alasanNet), 200);
}

$raw = substr(preg_replace('/\s+/', ' ', (string)$r['body']), 0, 400);
if (!is_array($j)) {
    // HTTP error ATAU balasan tak dikenal: keduanya PENDING (nasib transaksi belum
    // pasti). Catatan respons asli disimpan di log + trx store untuk rekonsiliasi.
    $alasanRaw = tv_alasan_pending('unknown', $raw, (int)$r['code'], '');
    tv_log("user=$uid ref=$ref produk=$produk http=" . $r['code'] . ' metode=' . $a['metode'] . ' PENDING_NON_JSON raw=' . $raw);
    tv_out(tv_pesanan_pending($conn, $ref, $ctxPesanan + ['metode' => $a['metode'], 'http' => (int)$r['code']],
        $alasanRaw, ['status' => 'pending', 'message' => $raw, 'error_msg' => '', 'sn' => '', 'trx_id' => '', 'ref_id' => $ref, 'produk' => $produk, 'price' => $hargaModal, 'sisa_saldo' => 0]), 200);
}

// Balasan docs: status = pending | sukses | gagal, atau {status:0, error_msg:"Ip Not Allow" / "Signature Invalid"}.
$norm = tv_trx_normalize($j);
$st = $norm['status'];
$okProvider = in_array($st, ['sukses', 'pending', 'processing', 'success', 'berhasil', 'diproses'], true);
$pesan = $norm['error_msg'] !== '' ? $norm['error_msg'] : $norm['message'];
if ($pesan === '' && $st === 'gagal' && $norm['sn'] !== '') $pesan = $norm['sn'];

tv_log("user=$uid ref=$ref produk=$produk tujuan=$tujuan server=$server metode=" . $a['metode'] . ' http=' . $r['code']
    . ' status=' . $st . ' trx=' . $norm['trx_id'] . ' msg=' . json_encode($pesan, JSON_UNESCAPED_UNICODE) . ' raw=' . $raw);

// Balasan yang belum pasti (HTTP error, status menunggu, penolakan bercirikan
// saldo/limit/gangguan sistem) -> PENDING: riwayat ditandai 'pending', saldo tetap,
// status final menunggu callback penyedia atau pending_sync tiap 10 menit.
$alasanPending = tv_alasan_pending($st, $pesan, (int)$r['code'], (string)($r['error'] ?? ''));
if ($alasanPending !== '') {
    tv_out(tv_pesanan_pending($conn, $ref, $ctxPesanan + ['metode' => $a['metode'], 'http' => (int)$r['code']], $alasanPending, $norm), 200);
}

// Status awal disimpan supaya cek_status/webhook bisa mencocokkan ref_id ini.
if ($st !== 'error' && $st !== 'unknown') {
    tv_trx_store_write($ref, $norm + ['sumber' => 'transaksi', 'user_id' => $uid, 'produk_kode' => $produk, 'tujuan' => $tujuan, 'server_id' => $server]);
}
// Riwayat pesanan ikut status penyedia: sukses → 'selesai', gagal → 'batal' + saldo kembali.
if (tv_sync_pesanan($conn, $ref, $st) && $st === 'gagal' && $saldoSetelah !== null) $saldoSetelah += $hargaJual;

tv_out([
    'ok'         => $okProvider,
    'ref_id'     => $ref,
    'status'     => $st,
    'jenis'      => $jenisOrder,
    'produk_nama' => (string)($itemProduk['nama'] ?? $produk),
    'layanan'    => (string)($itemProduk['layanan'] ?? $itemProduk['game'] ?? ''),
    'harga'      => $hargaJual,
    'harga_modal' => $hargaModal,
    'markup_pct' => $markupPct,
    'saldo'      => $saldoSetelah,
    'message'    => $pesan !== '' ? $pesan : ($okProvider ? 'Transaksi diterima penyedia.' : 'Transaksi ditolak penyedia — saldo dikembalikan. Periksa kode produk / data tujuan.'),
    'error_msg'  => $norm['error_msg'],
    'trx_id'     => $norm['trx_id'],
    'sn'         => $norm['sn'],
    'price'      => $norm['price'],
    'sisa_saldo' => $norm['sisa_saldo'],
    'metode'     => $a['metode'],
    'raw'        => $raw,
    'provider'   => tv_sanitize($j),
], 200);
