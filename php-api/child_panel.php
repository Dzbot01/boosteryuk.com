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
 *   owner_summary | owner_orders | owner_users | owner_set_markup {markup_smm_pct, markup_agent_pct}
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
            $st = cp_q($conn, "SELECT COUNT(*) n, COALESCE(SUM(price),0) omzet, COALESCE(SUM(profit),0) profit FROM child_panel_orders WHERE child_panel_id = ? $where", 'i', $pid);
            $r = $st->get_result()->fetch_assoc();
            $st->close();
            return ['orders' => (int)$r['n'], 'omzet' => (float)$r['omzet'], 'profit' => (float)$r['profit']];
        };
        $st = cp_q($conn, "SELECT COUNT(*) n, SUM(last_seen >= NOW() - INTERVAL 7 DAY) aktif FROM child_panel_activity WHERE child_panel_id = ?", 'i', $pid);
        $u = $st->get_result()->fetch_assoc();
        $st->close();
        cp_out(['ok' => true, 'panel' => ['name' => $tenant['name'], 'hostname' => $tenant['hostname'],
            'markup_smm_pct' => $tenant['markup_smm_pct'], 'markup_agent_pct' => $tenant['markup_agent_pct']],
            'all' => $q(''), 'month' => $q("AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')"), 'today' => $q("AND created_at >= CURDATE()"),
            'users' => ['total' => (int)$u['n'], 'active7d' => (int)$u['aktif']]]);
    }

    if ($action === 'owner_orders') {
        $limit = max(1, min(200, (int)($in['limit'] ?? 50)));
        $st = cp_q($conn, "SELECT o.order_id, o.kind, o.service_name, o.quantity, o.price, o.base_price, o.profit, o.created_at,
                                  u.name, u.email, r.status
                           FROM child_panel_orders o
                           LEFT JOIN users u ON u.id = o.user_id
                           LEFT JOIN riwayat_pesanan r ON r.order_id = o.order_id AND r.user_id = o.user_id
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
        cp_q($conn, "UPDATE child_panels SET markup_smm_pct = ?, markup_agent_pct = ? WHERE id = ?", 'ddi', $mSmm, $mAgent, $pid)->close();
        cp_out(['ok' => true, 'markup_smm_pct' => $mSmm, 'markup_agent_pct' => $mAgent]);
    }
}

/* ---------- Aksi admin utama ---------- */
cp_require_admin($conn, $in['token'] ?? '', function ($msg, $code) { cp_out(['ok' => false, 'message' => $msg], $code); });

function cp_host_of($sub) { return $sub . '.' . CP_ROOT_DOMAIN; }

function cp_hex($v) {
    $v = strtolower(trim((string)$v));
    return ($v === '' || preg_match('/^#[0-9a-f]{6}$/', $v)) ? $v : '';
}
function cp_img_ref($v) {
    $v = trim((string)$v);
    if ($v === '' || preg_match('/^cpasset:[a-z0-9]+:[a-f0-9]{6,16}$/', $v)) return $v;
    return preg_match('#^https://[^\s"\'<>]{4,400}$#i', $v) ? $v : '';
}
function cp_str($v, $max) { return mb_substr(trim(strip_tags((string)$v)), 0, $max); }

/** Whitelist konfigurasi tampilan child panel. */
function cp_clean_config($c) {
    $c = is_array($c) ? $c : [];
    $out = [
        'brandName'      => cp_str($c['brandName'] ?? '', 40),
        'brandSuffix'    => cp_str($c['brandSuffix'] ?? '', 40),
        'headerTagline'  => cp_str($c['headerTagline'] ?? '', 30),
        'footerText'     => cp_str($c['footerText'] ?? '', 200),
        'themePreset'    => preg_match('/^[a-z0-9-]{1,30}$/', (string)($c['themePreset'] ?? '')) ? $c['themePreset'] : '',
        'brandAccent'    => cp_hex($c['brandAccent'] ?? ''),
        'headerTint'     => cp_hex($c['headerTint'] ?? ''),
        'menuActive'     => cp_hex($c['menuActive'] ?? ''),
        'headerOrnament' => preg_match('/^[a-z0-9-]{0,40}$/', (string)($c['headerOrnament'] ?? '')) ? (string)($c['headerOrnament'] ?? '') : '',
        'logo'           => cp_img_ref($c['logo'] ?? ''),
        'hero'           => cp_img_ref($c['hero'] ?? ''),
        // Video player dashboard: kosong = tidak tampil. URL https (Supabase Storage / mp4 / webm).
        'videoUrl'       => preg_match('#^https://[^\s"\'<>]{4,500}$#i', trim((string)($c['videoUrl'] ?? ''))) ? trim((string)$c['videoUrl']) : '',
        'videoPoster'    => cp_img_ref($c['videoPoster'] ?? ''),
        // Tombol musik di bottom navbar child panel: bawaan TIDAK tampil.
        'showMusic'      => !empty($c['showMusic']),
        'voice'          => in_array($c['voice'] ?? 'welcome', ['full', 'welcome', 'off'], true) ? ($c['voice'] ?? 'welcome') : 'welcome',
        'slides'         => [],
    ];
    foreach (array_slice(is_array($c['slides'] ?? null) ? $c['slides'] : [], 0, 6) as $s) {
        if (!is_array($s)) continue;
        $img = cp_img_ref($s['image'] ?? '');
        if ($img === '') continue;
        $out['slides'][] = ['image' => $img, 'title' => cp_str($s['title'] ?? '', 80), 'subtitle' => cp_str($s['subtitle'] ?? '', 140)];
    }
    return $out;
}

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
            cp_q($conn, "UPDATE child_panels SET name=?, status=?, markup_smm_pct=?, markup_agent_pct=?, config=?, owner_user_id=? WHERE id=?",
                'ssddsii', $name, $status, $mSmm, $mAgent, $config, $owner, $id)->close();
            cp_q($conn, "DELETE FROM child_panel_domains WHERE child_panel_id = ? AND is_primary = 1", 'i', $id)->close();
        } else {
            cp_q($conn, "INSERT INTO child_panels (name, status, markup_smm_pct, markup_agent_pct, config, owner_user_id) VALUES (?,?,?,?,?,?)",
                'ssddsi', $name, $status, $mSmm, $mAgent, $config, $owner)->close();
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
