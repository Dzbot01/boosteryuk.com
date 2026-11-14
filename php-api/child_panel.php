<?php
/**
 * child_panel.php — API Child Panel. Upload ke /api (satu folder dengan configdb.php).
 *
 * Publik:
 *   GET  ?host=toko1.boosteryuk.com          → { ok, tenant: {...} | null }   (atau header X-Child-Panel dari Worker)
 *   GET  ?asset=<panelId>-<slot>&v=<versi>   → file gambar (logo/hero/slideN), cache 1 tahun
 * Child panel (POST, host = subdomain panel; user login):
 *   ping                                       → catat kunjungan, balas is_owner (admin ke-2?)
 *   record_order {order_id}                    → catat pesanan SMM (harga dari riwayat_pesanan milik user)
 * Admin ke-2 / pemilik panel (owner_user_id) atau admin utama:
 *   owner_summary | owner_orders | owner_users | owner_set_markup {markup_smm_pct, markup_agent_pct, markup_otp_pct}
 * Pemilik panel (paket EXTRA) dari web utama: my_panel | my_save {panel:{name, config, markup_*}} |
 *   my_upload {slot, data} | my_video_sign {ext, size}   — hanya panel miliknya; subdomain/status tetap.
 * Pencairan pendapatan (pemilik panel, dari web utama ATAU subdomain): my_wd_info | my_withdraw {withdraw:{method,
 *   bank_name?, account_number, account_name, amount}} → email Resend ke admin utama.
 * Admin utama — Withdraw Request: wd_list {status} | wd_detail {id} | wd_update {id, status:'paid'|'rejected', note}
 * Admin utama (POST JSON {token, action, ...}):
 *   list                                       → semua child panel + hostname
 *   check   {subdomain}                        → apakah nama tersedia
 *   save    {panel:{id?, name, subdomain, status, markup_smm_pct, markup_agent_pct, config}}
 *   upload  {id, slot, data}                   → simpan gambar, balas ref 'cpasset:<slot>:<versi>'
 *   video_sign {id, ext, size}                 → signed upload URL Supabase (browser upload langsung)
 *   delete  {id}
 * Subdomain cukup didaftarkan di sini — DNS wildcard *.boosteryuk.com + Worker sudah mengarahkannya.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

error_reporting(0);
require 'configdb.php';
require_once __DIR__ . '/child_panel_lib.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

// Error tak terduga → tetap balas JSON berisi pesan (bukan HTTP 500 kosong) agar mudah didiagnosis.
set_exception_handler(function ($e) {
    if (!headers_sent()) { http_response_code(500); header('Content-Type: application/json; charset=utf-8'); }
    echo json_encode(['ok' => false, 'message' => 'Kesalahan server: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
});
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true) && !headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => false, 'message' => 'Kesalahan server: ' . $e['message'] . ' (cek apakah child_panel_lib.php terbaru sudah diupload)'], JSON_UNESCAPED_UNICODE);
    }
});

function cp_out($d, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    cp_ensure_schema($conn);
} catch (Throwable $e) {
    cp_out(['ok' => false, 'message' => 'Gagal menyiapkan tabel child panel: ' . $e->getMessage()], 500);
}

/* ===================== GET: aset gambar ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['asset'])) {
    if (!preg_match('/^(\d+)-([a-z0-9]+)$/', (string)$_GET['asset'], $m) || !in_array($m[2], CP_SLOTS, true)) { http_response_code(404); exit; }
    $st = cp_q($conn, "SELECT data FROM child_panel_assets WHERE child_panel_id = ? AND slot = ?", 'is', (int)$m[1], $m[2]);
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    if (!$row || !preg_match('#^data:(image/(?:jpeg|png|webp|svg\+xml|x-icon));base64,(.+)$#s', $row['data'], $d)) { http_response_code(404); exit; }
    $bin = base64_decode($d[2]);
    header('Content-Type: ' . $d[1]);
    header('Cache-Control: public, max-age=31536000, immutable');
    header('Content-Length: ' . strlen($bin));
    echo $bin;
    exit;
}

/* ===================== GET: konfigurasi tenant (publik) ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $t = cp_resolve($conn);
        if ($t) unset($t['_owner_user_id']);
        cp_out(['ok' => true, 'tenant' => $t]);
    } catch (Throwable $e) {
        cp_out(['ok' => false, 'message' => $e->getMessage()], 500);
    }
}

/* ===================== POST: admin ===================== */
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) cp_out(['ok' => false, 'message' => 'Body JSON tidak valid.'], 400);
$action = (string)($in['action'] ?? '');

/* ---------- Pengaturan child panel MILIK SENDIRI (pemilik paket EXTRA), dari web utama ---------- */
if (in_array($action, ['my_panel', 'my_save', 'my_upload', 'my_video_sign', 'my_wd_info', 'my_withdraw'], true)) {
    $uid = cp_user_id($conn, $in['token'] ?? '');
    if (!$uid) cp_out(['ok' => false, 'message' => 'Sesi tidak valid. Silakan login ulang.'], 401);
    $st = cp_q($conn, "SELECT p.*, d.hostname FROM child_panels p
                       LEFT JOIN child_panel_domains d ON d.child_panel_id = p.id AND d.is_primary = 1
                       WHERE p.owner_user_id = ? ORDER BY p.id ASC LIMIT 1", 'i', (int)$uid);
    $mine = $st->get_result()->fetch_assoc();
    $st->close();
    if ($action === 'my_panel') {
        if (!$mine) cp_out(['ok' => true, 'panel' => null]);
        $pub = cp_public($mine, $mine['hostname']);
        $pub['subdomain'] = $mine['hostname'] ? substr($mine['hostname'], 0, -(strlen(CP_ROOT_DOMAIN) + 1)) : '';
        $pub['status'] = $mine['status'];
        $pub['expires_at'] = $mine['expires_at'] ?? null;
        cp_out(['ok' => true, 'panel' => $pub]);
    }
    if (!$mine) cp_out(['ok' => false, 'message' => 'Kamu belum punya child panel. Upgrade ke EXTRA dulu.'], 404);
    $pid = (int)$mine['id'];

    if ($action === 'my_save') {
        // Pemilik boleh mengubah tampilan, nama & markup — BUKAN subdomain, status, atau pemilik.
        $p = is_array($in['panel'] ?? null) ? $in['panel'] : [];
        $name = cp_str($p['name'] ?? $mine['name'], 80) ?: $mine['name'];
        $mSmm = max(0, min(CP_MAX_MARKUP, round((float)($p['markup_smm_pct'] ?? $mine['markup_smm_pct']), 2)));
        $mAgent = max(0, min(CP_MAX_MARKUP, round((float)($p['markup_agent_pct'] ?? $mine['markup_agent_pct']), 2)));
        $mOtp = max(0, min(CP_MAX_MARKUP, round((float)($p['markup_otp_pct'] ?? ($mine['markup_otp_pct'] ?? 0)), 2)));
        $config = json_encode(cp_clean_config($p['config'] ?? []), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        cp_q($conn, "UPDATE child_panels SET name = ?, markup_smm_pct = ?, markup_agent_pct = ?, markup_otp_pct = ?, config = ? WHERE id = ?", 'sdddsi', $name, $mSmm, $mAgent, $mOtp, $config, $pid)->close();
        cp_out(['ok' => true, 'id' => $pid, 'hostname' => $mine['hostname'], 'url' => 'https://' . $mine['hostname']]);
    }
    if ($action === 'my_upload') {
        $slot = (string)($in['slot'] ?? '');
        $data = trim((string)($in['data'] ?? ''));
        if (!in_array($slot, CP_SLOTS, true)) cp_out(['ok' => false, 'message' => 'Slot gambar tidak valid.'], 400);
        if (!preg_match('#^data:image/(jpeg|png|webp|svg\+xml|x-icon);base64,[A-Za-z0-9+/=]+$#', $data)) cp_out(['ok' => false, 'message' => 'Gambar harus JPG, PNG, WebP, SVG, atau ICO.'], 400);
        if (strlen($data) > 2800000) cp_out(['ok' => false, 'message' => 'Gambar terlalu besar (maks ~2 MB).'], 400);
        $ver = substr(md5($data), 0, 12);
        cp_q($conn, "INSERT INTO child_panel_assets (child_panel_id, slot, data, version) VALUES (?,?,?,?)
                     ON DUPLICATE KEY UPDATE data = VALUES(data), version = VALUES(version)", 'isss', $pid, $slot, $data, $ver)->close();
        cp_out(['ok' => true, 'ref' => "cpasset:$slot:$ver"]);
    }
    if ($action === 'my_wd_info') {
        // Saldo pendapatan + riwayat pencairan. Tetap bisa dibuka walau langganan EXTRA habis.
        $st = cp_q($conn, "SELECT method, bank_name, account_number, account_name FROM child_panel_withdrawals WHERE child_panel_id = ? ORDER BY id DESC LIMIT 1", 'i', $pid);
        $last = $st->get_result()->fetch_assoc() ?: null;
        $st->close();
        cp_out(['ok' => true, 'balance' => cp_wd_balance($conn, $pid), 'history' => cp_wd_history($conn, $pid), 'last' => $last] + cp_wd_methods_public());
    }
    if ($action === 'my_withdraw') {
        [$ok, $data, $code] = cp_wd_request($conn, $pid, $uid, is_array($in['withdraw'] ?? null) ? $in['withdraw'] : []);
        if (!$ok) cp_out(['ok' => false, 'message' => $data], $code);
        $wid = $data['id'];
        cp_after_response(function () use ($conn, $wid) { cp_wd_notify_admin($conn, $wid); });
        cp_out(['ok' => true, 'withdraw' => $data, 'balance' => cp_wd_balance($conn, $pid), 'history' => cp_wd_history($conn, $pid),
            'message' => 'Permintaan pencairan terkirim. Admin akan memproses dan mentransfer ke akunmu.']);
    }
    if ($action === 'my_video_sign') {
        $ext = strtolower((string)($in['ext'] ?? ''));
        $size = (int)($in['size'] ?? 0);
        if (!in_array($ext, ['mp4', 'webm'], true)) cp_out(['ok' => false, 'message' => 'Video harus MP4 atau WebM.'], 400);
        $max = cp_video_config()['max_mb'];
        if ($size <= 0 || $size > $max * 1024 * 1024) cp_out(['ok' => false, 'message' => "Ukuran video maksimal $max MB."], 400);
        [$ok, $data] = cp_video_sign($pid, $ext);
        cp_out($ok ? ['ok' => true] + $data : ['ok' => false, 'message' => $data], $ok ? 200 : 502);
    }
}

/* ---------- Aksi di child panel (user biasa & admin ke-2 / pemilik panel) ---------- */
if (in_array($action, ['ping', 'record_order', 'owner_summary', 'owner_orders', 'owner_users', 'owner_set_markup'], true)) {
    $tenant = cp_resolve($conn);
    if (!$tenant) cp_out(['ok' => false, 'message' => 'Child panel tidak ditemukan untuk host ini.'], 404);
    $uid = cp_user_id($conn, $in['token'] ?? '');
    if (!$uid) cp_out(['ok' => false, 'message' => 'Sesi tidak valid. Silakan login ulang.'], 401);
    $pid = (int)$tenant['id'];

    if ($action === 'ping') {
        cp_touch_activity($conn, $pid, $uid, 'visit');
        cp_out(['ok' => true, 'is_owner' => cp_is_owner($conn, $tenant, $uid)]);
    }

    if ($action === 'record_order') {
        // Pesanan SMM: harga diambil dari riwayat_pesanan milik user ini (bukan dari browser).
        $orderId = mb_substr(trim((string)($in['order_id'] ?? '')), 0, 64);
        if ($orderId === '') cp_out(['ok' => false, 'message' => 'order_id wajib.'], 400);
        $st = cp_q($conn, "SELECT service_name, quantity, price FROM riwayat_pesanan WHERE order_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1", 'si', $orderId, (int)$uid);
        $row = $st->get_result()->fetch_assoc();
        $st->close();
        if (!$row) cp_out(['ok' => false, 'message' => 'Pesanan tidak ditemukan di riwayat akun ini.'], 404);
        $base = cp_base_from_price($row['price'], $tenant['markup_smm_pct']);
        cp_record_order($conn, $pid, $uid, $orderId, 'smm', $row['service_name'], $row['quantity'], $row['price'], $base);
        cp_out(['ok' => true]);
    }

    // Selebihnya hanya untuk admin ke-2 (pemilik panel) atau admin utama.
    if (!cp_is_owner($conn, $tenant, $uid)) cp_out(['ok' => false, 'message' => 'Hanya admin panel ini yang boleh membuka halaman ini.'], 403);

    if ($action === 'owner_summary') {
        $q = function ($where) use ($conn, $pid) {
            // Pesanan yang dibatalkan (riwayat_pesanan.status = 'batal') tidak dihitung sebagai pendapatan.
            $st = cp_q($conn, "SELECT COUNT(*) n, COALESCE(SUM(o.price),0) omzet, COALESCE(SUM(o.profit),0) profit FROM child_panel_orders o
                               WHERE o.child_panel_id = ? $where AND COALESCE(" . cp_order_status_sql($conn) . ", '') <> 'batal'", 'i', $pid);
            $r = $st->get_result()->fetch_assoc();
            $st->close();
            return ['orders' => (int)$r['n'], 'omzet' => (float)$r['omzet'], 'profit' => (float)$r['profit']];
        };
        $st = cp_q($conn, "SELECT COUNT(*) n, SUM(last_seen >= NOW() - INTERVAL 7 DAY) aktif FROM child_panel_activity WHERE child_panel_id = ?", 'i', $pid);
        $u = $st->get_result()->fetch_assoc();
        $st->close();
        cp_out(['ok' => true, 'panel' => ['name' => $tenant['name'], 'hostname' => $tenant['hostname'],
            'markup_smm_pct' => $tenant['markup_smm_pct'], 'markup_agent_pct' => $tenant['markup_agent_pct'], 'markup_otp_pct' => $tenant['markup_otp_pct']],
            'all' => $q(''), 'month' => $q("AND o.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')"), 'today' => $q("AND o.created_at >= CURDATE()"),
            'balance' => cp_wd_balance($conn, $pid),
            'users' => ['total' => (int)$u['n'], 'active7d' => (int)$u['aktif']]]);
    }

    if ($action === 'owner_orders') {
        $limit = max(1, min(200, (int)($in['limit'] ?? 50)));
        $st = cp_q($conn, "SELECT o.order_id, o.kind, o.service_name, o.quantity, o.price, o.base_price, o.profit, o.created_at,
                                  u.name, u.email, " . cp_order_status_sql($conn) . " AS status
                           FROM child_panel_orders o
                           LEFT JOIN users u ON u.id = o.user_id
                           WHERE o.child_panel_id = ? ORDER BY o.id DESC LIMIT $limit", 'i', $pid);
        $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
        $st->close();
        foreach ($rows as &$r) { $r['email'] = cp_mask_email($r['email']); foreach (['price', 'base_price', 'profit'] as $k) $r[$k] = (float)$r[$k]; }
        cp_out(['ok' => true, 'orders' => $rows]);
    }

    if ($action === 'owner_users') {
        $st = cp_q($conn, "SELECT a.user_id, u.name, u.email, a.first_seen, a.last_seen, a.visits, a.last_action,
                                  COUNT(o.id) orders, COALESCE(SUM(o.price),0) spend, COALESCE(SUM(o.profit),0) profit
                           FROM child_panel_activity a
                           LEFT JOIN users u ON u.id = a.user_id
                           LEFT JOIN child_panel_orders o ON o.child_panel_id = a.child_panel_id AND o.user_id = a.user_id
                           WHERE a.child_panel_id = ?
                           GROUP BY a.user_id, u.name, u.email, a.first_seen, a.last_seen, a.visits, a.last_action
                           ORDER BY a.last_seen DESC LIMIT 200", 'i', $pid);
        $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
        $st->close();
        foreach ($rows as &$r) { $r['email'] = cp_mask_email($r['email']); unset($r['user_id']); foreach (['spend', 'profit'] as $k) $r[$k] = (float)$r[$k]; $r['orders'] = (int)$r['orders']; $r['visits'] = (int)$r['visits']; }
        cp_out(['ok' => true, 'users' => $rows]);
    }

    if ($action === 'owner_set_markup') {
        $mSmm = max(0, min(CP_MAX_MARKUP, round((float)($in['markup_smm_pct'] ?? 0), 2)));
        $mAgent = max(0, min(CP_MAX_MARKUP, round((float)($in['markup_agent_pct'] ?? 0), 2)));
        $mOtp = max(0, min(CP_MAX_MARKUP, round((float)($in['markup_otp_pct'] ?? ($tenant['markup_otp_pct'] ?? 0)), 2)));
        cp_q($conn, "UPDATE child_panels SET markup_smm_pct = ?, markup_agent_pct = ?, markup_otp_pct = ? WHERE id = ?", 'dddi', $mSmm, $mAgent, $mOtp, $pid)->close();
        cp_out(['ok' => true, 'markup_smm_pct' => $mSmm, 'markup_agent_pct' => $mAgent, 'markup_otp_pct' => $mOtp]);
    }
}

/* ---------- Aksi admin utama ---------- */
cp_require_admin($conn, $in['token'] ?? '', function ($msg, $code) { cp_out(['ok' => false, 'message' => $msg], $code); });

function cp_host_of($sub) { return $sub . '.' . CP_ROOT_DOMAIN; }


function cp_list($conn) {
    $res = $conn->query("SELECT p.*, d.hostname, u.email AS owner_email FROM child_panels p
                         LEFT JOIN child_panel_domains d ON d.child_panel_id = p.id AND d.is_primary = 1
                         LEFT JOIN users u ON u.id = p.owner_user_id
                         ORDER BY p.id DESC");
    $out = [];
    while ($res && ($r = $res->fetch_assoc())) {
        $pub = cp_public($r, $r['hostname']);
        $pub['status'] = $r['status'];
        $pub['subdomain'] = $r['hostname'] ? substr($r['hostname'], 0, -(strlen(CP_ROOT_DOMAIN) + 1)) : '';
        $pub['owner_email'] = $r['owner_email'];
        $pub['created_at'] = $r['created_at'];
        $out[] = $pub;
    }
    return $out;
}

function cp_sub_taken($conn, $sub, $exceptPanelId = 0) {
    $st = cp_q($conn, "SELECT child_panel_id FROM child_panel_domains WHERE hostname = ? LIMIT 1", 's', cp_host_of($sub));
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    return $row && (int)$row['child_panel_id'] !== (int)$exceptPanelId;
}

try {
    if ($action === 'list') cp_out(['ok' => true, 'panels' => cp_list($conn), 'root' => CP_ROOT_DOMAIN]);

    /* ----- Withdraw Request (pencairan pemilik child panel) ----- */
    if ($action === 'wd_list') {
        $status = (string)($in['status'] ?? 'pending');
        $where = in_array($status, ['pending', 'paid', 'rejected'], true) ? "WHERE w.status = '$status'" : '';
        $res = $conn->query("SELECT w.id, w.child_panel_id, w.method, w.bank_name, w.account_number, w.account_name, w.amount, w.fee, w.net_amount,
                                    w.status, w.admin_note, w.created_at, w.processed_at, w.email_sent, w.processed_by,
                                    p.name AS panel_name, d.hostname, u.name AS owner_name, u.email AS owner_email
                             FROM child_panel_withdrawals w
                             LEFT JOIN child_panels p ON p.id = w.child_panel_id
                             LEFT JOIN child_panel_domains d ON d.child_panel_id = w.child_panel_id AND d.is_primary = 1
                             LEFT JOIN users u ON u.id = w.user_id
                             $where ORDER BY (w.status = 'pending') DESC, w.id DESC LIMIT 300");
        $rows = [];
        while ($res && ($r = $res->fetch_assoc())) $rows[] = cp_wd_row_public($r);
        $c = $conn->query("SELECT status, COUNT(*) n, COALESCE(SUM(net_amount),0) total FROM child_panel_withdrawals GROUP BY status");
        $counts = ['pending' => 0, 'paid' => 0, 'rejected' => 0];
        $totals = ['pending' => 0, 'paid' => 0, 'rejected' => 0];
        while ($c && ($r = $c->fetch_assoc())) { $counts[$r['status']] = (int)$r['n']; $totals[$r['status']] = (float)$r['total']; }
        cp_out(['ok' => true, 'requests' => $rows, 'counts' => $counts, 'totals' => $totals]);
    }

    if ($action === 'wd_detail') {
        $w = cp_wd_get($conn, (int)($in['id'] ?? 0));
        if (!$w) cp_out(['ok' => false, 'message' => 'Permintaan tidak ditemukan.'], 404);
        $pid = $w['child_panel_id'];
        $st = cp_q($conn, "SELECT o.order_id, o.kind, o.service_name, o.price, o.base_price, o.profit, o.created_at, u.name, " . cp_order_status_sql($conn) . " AS status
                           FROM child_panel_orders o LEFT JOIN users u ON u.id = o.user_id
                           WHERE o.child_panel_id = ? ORDER BY o.id DESC LIMIT 15", 'i', $pid);
        $orders = $st->get_result()->fetch_all(MYSQLI_ASSOC);
        $st->close();
        foreach ($orders as &$o) foreach (['price', 'base_price', 'profit'] as $k) $o[$k] = (float)$o[$k];
        unset($o);
        cp_out(['ok' => true, 'request' => $w, 'balance' => cp_wd_balance($conn, $pid), 'history' => cp_wd_history($conn, $pid, 10), 'orders' => $orders]);
    }

    if ($action === 'wd_update') {
        $id = (int)($in['id'] ?? 0);
        $status = (string)($in['status'] ?? '');
        $note = cp_str($in['note'] ?? '', 255);
        if (!in_array($status, ['paid', 'rejected'], true)) cp_out(['ok' => false, 'message' => 'Status tidak valid.'], 400);
        if ($status === 'rejected' && mb_strlen($note) < 3) cp_out(['ok' => false, 'message' => 'Tulis alasan penolakan agar pemilik panel tahu.'], 400);
        $adminId = (int)cp_user_id($conn, $in['token'] ?? '');
        // Hanya permintaan yang masih "pending" yang bisa diproses (mencegah diproses dua kali).
        $st = cp_q($conn, "UPDATE child_panel_withdrawals SET status = ?, admin_note = ?, processed_at = NOW(), processed_by = ? WHERE id = ? AND status = 'pending'",
            'ssii', $status, $note ?: null, $adminId, $id);
        $changed = $st->affected_rows;
        $st->close();
        if ($changed !== 1) cp_out(['ok' => false, 'message' => 'Permintaan ini sudah diproses sebelumnya.'], 409);
        cp_after_response(function () use ($conn, $id) { cp_wd_notify_owner($conn, $id); });
        cp_out(['ok' => true, 'request' => cp_wd_get($conn, $id),
            'message' => $status === 'paid' ? 'Ditandai sudah dibayar. Pemilik panel dikabari lewat email.' : 'Permintaan ditolak, saldo pendapatan pemilik dikembalikan.']);
    }

    if ($action === 'check') {
        $sub = cp_clean_sub($in['subdomain'] ?? '');
        if (!$sub) cp_out(['ok' => true, 'available' => false, 'message' => 'Nama tidak valid atau dipakai sistem. Gunakan huruf kecil, angka, dan tanda minus (maks 32).']);
        $taken = cp_sub_taken($conn, $sub, (int)($in['id'] ?? 0));
        cp_out(['ok' => true, 'available' => !$taken, 'hostname' => cp_host_of($sub), 'message' => $taken ? 'Subdomain sudah dipakai.' : 'Subdomain tersedia.']);
    }

    if ($action === 'save') {
        $p = is_array($in['panel'] ?? null) ? $in['panel'] : [];
        $id = (int)($p['id'] ?? 0);
        $name = cp_str($p['name'] ?? '', 80);
        $sub = cp_clean_sub($p['subdomain'] ?? '');
        if ($name === '') cp_out(['ok' => false, 'message' => 'Nama child panel wajib diisi.'], 400);
        if (!$sub) cp_out(['ok' => false, 'message' => 'Subdomain tidak valid atau dipakai sistem (huruf kecil, angka, tanda minus; maks 32).'], 400);
        if (cp_sub_taken($conn, $sub, $id)) cp_out(['ok' => false, 'message' => 'Subdomain ' . cp_host_of($sub) . ' sudah dipakai.'], 409);
        $status = ($p['status'] ?? 'active') === 'suspended' ? 'suspended' : 'active';
        $mSmm = max(0, min(CP_MAX_MARKUP, round((float)($p['markup_smm_pct'] ?? 0), 2)));
        $mAgent = max(0, min(CP_MAX_MARKUP, round((float)($p['markup_agent_pct'] ?? 0), 2)));
        $mOtp = max(0, min(CP_MAX_MARKUP, round((float)($p['markup_otp_pct'] ?? 0), 2)));
        $config = json_encode(cp_clean_config($p['config'] ?? []), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $owner = null;
        $ownerEmail = trim((string)($p['owner_email'] ?? ''));
        if ($ownerEmail !== '') {
            $st = cp_q($conn, "SELECT id FROM users WHERE email = ? LIMIT 1", 's', $ownerEmail);
            $owner = $st->get_result()->fetch_assoc()['id'] ?? null;
            $st->close();
            if (!$owner) cp_out(['ok' => false, 'message' => "Email pemilik $ownerEmail tidak terdaftar."], 400);
        }

        $conn->begin_transaction();
        if ($id > 0) {
            cp_q($conn, "UPDATE child_panels SET name=?, status=?, markup_smm_pct=?, markup_agent_pct=?, markup_otp_pct=?, config=?, owner_user_id=? WHERE id=?",
                'ssdddsii', $name, $status, $mSmm, $mAgent, $mOtp, $config, $owner, $id)->close();
            cp_q($conn, "DELETE FROM child_panel_domains WHERE child_panel_id = ? AND is_primary = 1", 'i', $id)->close();
        } else {
            cp_q($conn, "INSERT INTO child_panels (name, status, markup_smm_pct, markup_agent_pct, markup_otp_pct, config, owner_user_id) VALUES (?,?,?,?,?,?,?)",
                'ssdddsi', $name, $status, $mSmm, $mAgent, $mOtp, $config, $owner)->close();
            $id = (int)$conn->insert_id;
        }
        cp_q($conn, "INSERT INTO child_panel_domains (child_panel_id, hostname, is_primary) VALUES (?,?,1)", 'is', $id, cp_host_of($sub))->close();
        $conn->commit();
        cp_out(['ok' => true, 'id' => $id, 'hostname' => cp_host_of($sub), 'url' => 'https://' . cp_host_of($sub), 'panels' => cp_list($conn)]);
    }

    if ($action === 'upload') {
        $id = (int)($in['id'] ?? 0);
        $slot = (string)($in['slot'] ?? '');
        $data = trim((string)($in['data'] ?? ''));
        if ($id <= 0 || !in_array($slot, CP_SLOTS, true)) cp_out(['ok' => false, 'message' => 'Panel/slot gambar tidak valid.'], 400);
        if (!preg_match('#^data:image/(jpeg|png|webp|svg\+xml|x-icon);base64,[A-Za-z0-9+/=]+$#', $data)) cp_out(['ok' => false, 'message' => 'Gambar harus JPG, PNG, WebP, SVG, atau ICO.'], 400);
        if (strlen($data) > 2800000) cp_out(['ok' => false, 'message' => 'Gambar terlalu besar (maks ~2 MB).'], 400);
        $ver = substr(md5($data), 0, 12);
        cp_q($conn, "INSERT INTO child_panel_assets (child_panel_id, slot, data, version) VALUES (?,?,?,?)
                     ON DUPLICATE KEY UPDATE data = VALUES(data), version = VALUES(version)", 'isss', $id, $slot, $data, $ver)->close();
        cp_out(['ok' => true, 'ref' => "cpasset:$slot:$ver"]);
    }

    if ($action === 'video_sign') {
        $id = (int)($in['id'] ?? 0);
        $ext = strtolower((string)($in['ext'] ?? ''));
        $size = (int)($in['size'] ?? 0);
        if ($id <= 0) cp_out(['ok' => false, 'message' => 'Simpan child panel dulu sebelum mengunggah video.'], 400);
        if (!in_array($ext, ['mp4', 'webm'], true)) cp_out(['ok' => false, 'message' => 'Video harus MP4 atau WebM.'], 400);
        $max = cp_video_config()['max_mb'];
        if ($size <= 0 || $size > $max * 1024 * 1024) cp_out(['ok' => false, 'message' => "Ukuran video maksimal $max MB."], 400);
        [$ok, $data] = cp_video_sign($id, $ext);
        cp_out($ok ? ['ok' => true] + $data : ['ok' => false, 'message' => $data], $ok ? 200 : 502);
    }

    if ($action === 'delete') {
        $id = (int)($in['id'] ?? 0);
        if ($id <= 0) cp_out(['ok' => false, 'message' => 'ID tidak valid.'], 400);
        $conn->begin_transaction();
        foreach (['child_panel_assets', 'child_panel_domains', 'child_panel_activity'] as $t) cp_q($conn, "DELETE FROM $t WHERE child_panel_id = ?", 'i', $id)->close();
        cp_q($conn, "DELETE FROM child_panels WHERE id = ?", 'i', $id)->close();
        $conn->commit();
        cp_out(['ok' => true, 'panels' => cp_list($conn)]);
    }

    cp_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
} catch (Throwable $e) {
    try { $conn->rollback(); } catch (Throwable $e2) { /* abaikan */ }
    cp_out(['ok' => false, 'message' => 'Gagal: ' . $e->getMessage()], 500);
}
