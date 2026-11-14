<?php
/**
 * nexspace.php — NexSpace (pengganti menu VPS).
 *
 * Started (otomatis): saldo dicek & dipotong ATOMIK → VPS membuat akun Linux (lib/nexspace.js lewat tunnel
 *   wa-origin) → login: <username>@185.205.222.202 -p 10892 (password dari user). Gagal = saldo dikembalikan.
 * Pro (manual): saldo dipotong → kode unik dikirim ke email → user memasukkan kode di Portal Server → halaman tunggu
 *   (status di DB, tetap sama walau di-refresh/ditutup) → admin mengisi data login di "NexSpace Pro Request"
 *   → data login tampil di portal user + email pemberitahuan. Ditolak admin = saldo dikembalikan.
 *
 * GET  ?action=plans                                   (publik)
 * POST {token, action, ...}:
 *   order {plan_id, months, username, password?}  | mine | banner | claim {code} | portal | portal_ack {order_id}
 *   admin_list {status} | admin_deliver {id, host, port, login_user, password, note} | admin_reject {id, reason}
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
error_reporting(0);

require 'configdb.php';
require_once __DIR__ . '/child_panel_lib.php'; // cp_q, cp_user_id, cp_send_email, cp_after_response
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function nx_out($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
set_exception_handler(function ($e) { nx_out(['ok' => false, 'message' => 'Kesalahan server: ' . $e->getMessage()], 500); });

function nx_cfg() {
    static $c = null;
    if ($c === null) { $c = include __DIR__ . '/nexspace_config.php'; if (!is_array($c)) $c = ['plans' => []]; }
    return $c;
}
function nx_plan($id) { foreach (nx_cfg()['plans'] as $p) if ($p['id'] === $id) return $p; return null; }
function nx_rp($n) { return 'Rp' . number_format((float)$n, 0, ',', '.'); }

/* ---------- skema ---------- */
function nx_schema($conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS nexspace_orders (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        order_id       VARCHAR(32) NOT NULL,
        user_id        INT NOT NULL,
        tier           VARCHAR(10) NOT NULL COMMENT 'started|pro',
        plan_id        VARCHAR(20) NOT NULL,
        plan_name      VARCHAR(80) NOT NULL,
        months         INT NOT NULL,
        price          DECIMAL(15,2) NOT NULL,
        username       VARCHAR(32) NOT NULL COMMENT 'username SSH / nama server',
        status         VARCHAR(12) NOT NULL COMMENT 'provisioning|active|failed|pending|ready|rejected',
        code           VARCHAR(20) NULL COMMENT 'kode unik Pro (dikirim via email)',
        claimed_at     DATETIME NULL,
        viewed_at      DATETIME NULL,
        login_host     VARCHAR(120) NULL,
        login_port     INT NULL,
        login_user     VARCHAR(64) NULL,
        login_pass_enc TEXT NULL COMMENT 'password Pro terenkripsi AES-256-GCM',
        note           VARCHAR(255) NULL,
        refunded       TINYINT(1) NOT NULL DEFAULT 0,
        expires_at     DATE NULL,
        delivered_at   DATETIME NULL,
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_order (order_id),
        UNIQUE KEY uniq_code (code),
        KEY idx_user (user_id, status),
        KEY idx_status (tier, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

/* ---------- enkripsi password Pro (kunci dibuat otomatis, tidak di-commit) ---------- */
function nx_key() {
    $f = __DIR__ . '/nexspace_secret.php';
    if (!is_file($f)) {
        $k = bin2hex(random_bytes(32));
        if (@file_put_contents($f, "<?php return '$k'; // kunci enkripsi data login NexSpace — JANGAN dihapus/diubah\n") === false) {
            throw new Exception('Tidak bisa membuat nexspace_secret.php (folder api tidak bisa ditulisi).');
        }
    }
    return hex2bin(include $f);
}
function nx_enc($plain) {
    $iv = random_bytes(12);
    $ct = openssl_encrypt($plain, 'aes-256-gcm', nx_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . $ct);
}
function nx_dec($b64) {
    $raw = base64_decode((string)$b64, true);
    if ($raw === false || strlen($raw) < 29) return null;
    $p = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', nx_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $p === false ? null : $p;
}

/* ---------- VPS (tunnel wa-origin, token sama dengan Agen AI) ---------- */
function nx_vps($method, $path, $body = null) {
    $token = getenv('AGENT_TOKEN') ?: ''; $origin = getenv('AGENT_ORIGIN') ?: '';
    if ((!$token || !$origin) && is_file(__DIR__ . '/agent_config.php')) {
        $c = include __DIR__ . '/agent_config.php';
        if (is_array($c)) { $token = $token ?: ($c['token'] ?? ''); $origin = $origin ?: ($c['origin'] ?? ''); }
    }
    if (!$token) return [0, ['ok' => false, 'message' => 'Token VPS belum diisi di agent_config.php.']];
    $ch = curl_init(rtrim($origin ?: 'https://wa-origin.boosteryuk.com', '/') . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 40, CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => ['x-agent-token: ' . $token, 'Content-Type: application/json', 'Accept: application/json']]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = $resp ? json_decode($resp, true) : null;
    return [$code, is_array($j) ? $j : ['ok' => false, 'message' => 'Server NexSpace tidak merespons.']];
}

/* ---------- util ---------- */
function nx_balance($conn, $uid) { return (float)cp_q($conn, "SELECT balance FROM users WHERE id = ?", 'i', $uid)->get_result()->fetch_assoc()['balance']; }
function nx_user($conn, $uid) { return cp_q($conn, "SELECT id, name, email FROM users WHERE id = ?", 'i', $uid)->get_result()->fetch_assoc(); }
function nx_get($conn, $where, $types, ...$p) {
    $st = cp_q($conn, "SELECT * FROM nexspace_orders WHERE $where LIMIT 1", $types, ...$p);
    $r = $st->get_result()->fetch_assoc(); $st->close(); return $r;
}
function nx_refund($conn, $o, $status, $note) {
    $conn->begin_transaction();
    try {
        $st = cp_q($conn, "UPDATE nexspace_orders SET status = ?, note = ?, refunded = 1 WHERE id = ? AND refunded = 0", 'ssi', $status, $note, (int)$o['id']);
        $ok = $st->affected_rows === 1; $st->close();
        if ($ok) {
            cp_q($conn, "UPDATE users SET balance = balance + ? WHERE id = ?", 'di', (float)$o['price'], (int)$o['user_id'])->close();
            cp_q($conn, "UPDATE riwayat_pesanan SET status = 'batal' WHERE order_id = ? AND user_id = ?", 'si', $o['order_id'], (int)$o['user_id'])->close();
        }
        $conn->commit();
        return $ok;
    } catch (Throwable $e) { $conn->rollback(); return false; }
}
/** Data untuk browser — password Pro hanya dikirim ke pemiliknya saat status ready. */
function nx_pub($o, $withSecret = false) {
    $c = nx_cfg();
    $isStarted = $o['tier'] === 'started';
    $ready = ($isStarted && $o['status'] === 'active') || (!$isStarted && $o['status'] === 'ready');
    $host = $o['login_host'] ?: $c['ssh_host']; $port = (int)($o['login_port'] ?: $c['ssh_port']); $u = $o['login_user'] ?: $o['username'];
    $r = ['order_id' => $o['order_id'], 'tier' => $o['tier'], 'plan_id' => $o['plan_id'], 'plan_name' => $o['plan_name'], 'months' => (int)$o['months'],
        'price' => (float)$o['price'], 'username' => $o['username'], 'status' => $o['status'], 'note' => $o['note'],
        'claimed' => !empty($o['claimed_at']), 'viewed' => !empty($o['viewed_at']), 'expires_at' => $o['expires_at'], 'created_at' => $o['created_at'],
        'delivered_at' => $o['delivered_at'], 'refunded' => (bool)$o['refunded']];
    if ($ready) $r['login'] = ['host' => $host, 'port' => $port, 'user' => $u, 'ssh' => "ssh $u@$host -p $port"]
        + ($withSecret && !$isStarted ? ['password' => nx_dec($o['login_pass_enc'])] : []);
    return $r;
}
function nx_mail_html($title, $intro, $rows, $btnHref = null, $btnText = null) {
    $h = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $tr = '';
    foreach ($rows as $k => $v) $tr .= '<tr><td style="padding:6px 14px 6px 0;color:#64748b">' . $h($k) . '</td><td style="padding:6px 0;font-weight:600">' . $v . '</td></tr>';
    $btn = $btnHref ? '<p style="margin:20px 0 0"><a href="' . $h($btnHref) . '" style="background:#0e7490;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:bold">' . $h($btnText) . '</a></p>' : '';
    return '<div style="font-family:Arial,sans-serif;color:#0f172a;max-width:560px"><h2 style="margin:0 0 8px">' . $h($title) . '</h2><p style="margin:0 0 14px;color:#475569">' . $intro . '</p><table style="border-collapse:collapse;font-size:14px">' . $tr . '</table>' . $btn . '</div>';
}

/* ===================== GET publik ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (($_GET['action'] ?? '') === 'plans') {
        $c = nx_cfg();
        $plans = array_map(fn($p) => array_diff_key($p, array_flip(['cpu_pct', 'tasks'])), $c['plans']);
        nx_out(['ok' => true, 'plans' => $plans, 'months' => $c['months'], 'rules' => $c['rules'], 'ssh_host' => $c['ssh_host'], 'ssh_port' => $c['ssh_port']]);
    }
    nx_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
}

/* ===================== POST ===================== */
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) nx_out(['ok' => false, 'message' => 'Body JSON tidak valid.'], 400);
$action = (string)($in['action'] ?? '');
$uid = cp_user_id($conn, $in['token'] ?? '');
if (!$uid) nx_out(['ok' => false, 'message' => 'Sesi tidak valid. Silakan login ulang.'], 401);
$uid = (int)$uid;
nx_schema($conn);

/* ---------- pesan ---------- */
if ($action === 'order') {
    $plan = nx_plan((string)($in['plan_id'] ?? ''));
    $months = (int)($in['months'] ?? 1);
    if (!$plan) nx_out(['ok' => false, 'message' => 'Paket tidak ditemukan.'], 400);
    if (!in_array($months, nx_cfg()['months'], true)) nx_out(['ok' => false, 'message' => 'Durasi tidak valid.'], 400);
    $username = strtolower(trim((string)($in['username'] ?? '')));
    if (!preg_match('/^[a-z][a-z0-9_]{2,15}$/', $username)) nx_out(['ok' => false, 'message' => 'Username 3–16 karakter: huruf kecil, angka, garis bawah; diawali huruf.'], 400);
    $password = (string)($in['password'] ?? '');
    if ($plan['tier'] === 'started' && (strlen($password) < 8 || strlen($password) > 64 || preg_match('/[:\r\n]/', $password)))
        nx_out(['ok' => false, 'message' => 'Password 8–64 karakter (tanpa titik dua).'], 400);
    if ($plan['tier'] === 'started' && nx_get($conn, "username = ? AND tier = 'started' AND status IN ('provisioning','active')", 's', $username))
        nx_out(['ok' => false, 'message' => 'Username sudah dipakai. Pilih nama lain.'], 409);

    $price = (float)$plan['price'] * $months;
    $orderId = 'NX' . strtoupper(base_convert((string)time(), 10, 36)) . strtoupper(bin2hex(random_bytes(3)));
    $expires = date('Y-m-d', strtotime("+$months month"));
    $code = $plan['tier'] === 'pro' ? 'NXP-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 4) . '-' . substr(bin2hex(random_bytes(4)), 0, 4)) : null;
    $svc = $plan['name'] . " ($months bulan) — $username";

    // 1) cek & potong saldo ATOMIK + catat order & riwayat
    $conn->begin_transaction();
    try {
        $st = cp_q($conn, "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?", 'did', $price, $uid, $price);
        $paid = $st->affected_rows === 1; $st->close();
        if (!$paid) { $conn->rollback(); nx_out(['ok' => false, 'message' => 'Saldo tidak cukup. Butuh ' . nx_rp($price) . ' — silakan deposit dulu.'], 400); }
        cp_q($conn, "INSERT INTO nexspace_orders (order_id, user_id, tier, plan_id, plan_name, months, price, username, status, code, expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            'sisssidssss', $orderId, $uid, $plan['tier'], $plan['id'], $plan['name'], $months, $price, $username,
            $plan['tier'] === 'started' ? 'provisioning' : 'pending', $code, $expires)->close();
        cp_q($conn, "INSERT INTO riwayat_pesanan (user_id, order_id, service_name, quantity, price, status) VALUES (?,?,?,?,?, 'proses')",
            'issid', $uid, $orderId, mb_substr("NexSpace: $svc", 0, 255), $months, $price)->close();
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        nx_out(['ok' => false, 'message' => 'Gagal membuat pesanan, saldo tidak dipotong.'], 500);
    }
    $o = nx_get($conn, 'order_id = ?', 's', $orderId);
    $user = nx_user($conn, $uid);

    // 2a) STARTED → buat akun Linux di VPS sekarang
    if ($plan['tier'] === 'started') {
        [$code2, $r] = nx_vps('POST', '/nexspace/create', ['orderId' => $orderId, 'username' => $username, 'password' => $password,
            'ramMb' => $plan['ram_mb'], 'cpuPct' => $plan['cpu_pct'], 'tasks' => $plan['tasks'], 'diskGb' => $plan['disk_gb'], 'expiresAt' => $expires]);
        if ($code2 !== 200 || empty($r['ok'])) {
            if ($code2 === 0 || $code2 >= 500) nx_vps('POST', '/nexspace/cancel', ['orderId' => $orderId]); // bersihkan bila sempat dibuat
            nx_refund($conn, $o, 'failed', mb_substr((string)($r['message'] ?? 'Server tidak merespons'), 0, 250));
            nx_out(['ok' => false, 'message' => ($r['message'] ?? 'Server NexSpace tidak merespons.') . ' Saldo dikembalikan.', 'balance' => nx_balance($conn, $uid)], $code2 === 409 ? 409 : 502);
        }
        cp_q($conn, "UPDATE nexspace_orders SET status = 'active', delivered_at = NOW() WHERE id = ?", 'i', (int)$o['id'])->close();
        cp_q($conn, "UPDATE riwayat_pesanan SET status = 'selesai' WHERE order_id = ? AND user_id = ?", 'si', $orderId, $uid)->close();
        $o = nx_get($conn, 'order_id = ?', 's', $orderId);
        $pub = nx_pub($o);
        if (!empty($user['email'])) {
            $mail = nx_mail_html('Server NexSpace kamu sudah aktif', 'Akun SSH sudah dibuat. Gunakan password yang kamu buat saat memesan.',
                ['Paket' => htmlspecialchars($plan['name']), 'Login' => '<code>' . htmlspecialchars($pub['login']['ssh']) . '</code>', 'Aktif sampai' => $expires]);
            $to = $user['email'];
            cp_after_response(fn() => cp_send_email($to, 'NexSpace aktif — ' . $username, $mail));
        }
        nx_out(['ok' => true, 'order' => $pub, 'balance' => nx_balance($conn, $uid), 'message' => 'Server NexSpace aktif!']);
    }

    // 2b) PRO → kirim kode unik ke email user + beri tahu admin
    $portal = 'https://' . CP_ROOT_DOMAIN . '/nexspace/portal';
    $cfg = nx_cfg();
    $mailUser = nx_mail_html('Kode unik NexSpace Pro kamu', 'Pembayaran berhasil. Masukkan kode berikut di Portal Server untuk memantau pembuatan servermu.',
        ['Kode unik' => '<span style="font-size:20px;letter-spacing:2px">' . $code . '</span>', 'Paket' => htmlspecialchars($plan['name'] . " · $months bulan"), 'Nama server' => htmlspecialchars($username)],
        $portal, 'Buka Portal Server');
    $mailAdmin = nx_mail_html('NexSpace Pro Request baru', 'Ada pesanan NexSpace Pro yang menunggu data login.',
        ['Order' => $orderId, 'Paket' => htmlspecialchars($plan['name'] . " · $months bulan"), 'Nama server' => htmlspecialchars($username),
         'Pemesan' => htmlspecialchars(($user['name'] ?? '') . ' — ' . ($user['email'] ?? '')), 'Dibayar' => nx_rp($price)],
        'https://' . CP_ROOT_DOMAIN . '/admin/nexspace', 'Buka NexSpace Pro Request');
    $to = $user['email'] ?? '';
    cp_after_response(function () use ($to, $code, $mailUser, $mailAdmin, $cfg, $username) {
        if ($to) cp_send_email($to, "Kode unik NexSpace Pro: $code", $mailUser);
        cp_send_email($cfg['admin_email'], "NexSpace Pro Request — $username", $mailAdmin);
    });
    nx_out(['ok' => true, 'order' => nx_pub($o), 'balance' => nx_balance($conn, $uid), 'email' => $to,
        'message' => 'Pembayaran berhasil. Kode unik dikirim ke email ' . $to . '. Masukkan kode itu di Portal Server.']);
}

if ($action === 'mine') {
    $st = cp_q($conn, "SELECT * FROM nexspace_orders WHERE user_id = ? ORDER BY id DESC LIMIT 30", 'i', $uid);
    $rows = array_map(fn($o) => nx_pub($o), $st->get_result()->fetch_all(MYSQLI_ASSOC));
    nx_out(['ok' => true, 'orders' => $rows]);
}

/** Banner di bawah header: pesanan Pro yang belum selesai diambil datanya. */
if ($action === 'banner') {
    $o = nx_get($conn, "user_id = ? AND tier = 'pro' AND ((status = 'pending') OR (status = 'ready' AND viewed_at IS NULL)) ORDER BY id DESC", 'i', $uid);
    if (!$o) nx_out(['ok' => true, 'banner' => null]);
    $state = $o['status'] === 'ready' ? 'ready' : (!empty($o['claimed_at']) ? 'waiting' : 'unclaimed');
    nx_out(['ok' => true, 'banner' => ['state' => $state, 'username' => $o['username'], 'order_id' => $o['order_id'], 'plan_name' => $o['plan_name']]]);
}

if ($action === 'claim') {
    $code = strtoupper(preg_replace('/\s+/', '', (string)($in['code'] ?? '')));
    if (!preg_match('/^NXP-[0-9A-F]{4}-[0-9A-F]{4}$/', $code)) nx_out(['ok' => false, 'message' => 'Format kode: NXP-XXXX-XXXX.'], 400);
    $o = nx_get($conn, "code = ? AND user_id = ? AND tier = 'pro'", 'si', $code, $uid);
    if (!$o) nx_out(['ok' => false, 'message' => 'Kode tidak ditemukan untuk akun ini. Pastikan login dengan akun yang memesan.'], 404);
    if ($o['status'] === 'rejected') nx_out(['ok' => false, 'message' => 'Pesanan ini dibatalkan admin: ' . ($o['note'] ?: '-') . ' Saldo sudah dikembalikan.'], 410);
    if (empty($o['claimed_at'])) cp_q($conn, "UPDATE nexspace_orders SET claimed_at = NOW() WHERE id = ?", 'i', (int)$o['id'])->close();
    nx_out(['ok' => true, 'order_id' => $o['order_id']]);
}

/** Portal: pesanan Pro yang sudah diklaim (halaman tunggu / data login). Status dari DB → sama walau refresh. */
if ($action === 'portal') {
    $oid = (string)($in['order_id'] ?? '');
    $o = $oid !== ''
        ? nx_get($conn, "order_id = ? AND user_id = ? AND tier = 'pro' AND claimed_at IS NOT NULL", 'si', $oid, $uid)
        : nx_get($conn, "user_id = ? AND tier = 'pro' AND claimed_at IS NOT NULL AND (status = 'pending' OR (status = 'ready' AND viewed_at IS NULL)) ORDER BY id DESC", 'i', $uid);
    $unclaimed = nx_get($conn, "user_id = ? AND tier = 'pro' AND status = 'pending' AND claimed_at IS NULL", 'i', $uid);
    nx_out(['ok' => true, 'order' => $o ? nx_pub($o, true) : null, 'has_unclaimed' => (bool)$unclaimed]);
}

/** User sudah menyimpan data login → banner berhenti tampil. */
if ($action === 'portal_ack') {
    cp_q($conn, "UPDATE nexspace_orders SET viewed_at = NOW() WHERE order_id = ? AND user_id = ? AND status = 'ready' AND viewed_at IS NULL", 'si', (string)($in['order_id'] ?? ''), $uid)->close();
    nx_out(['ok' => true]);
}

/* ===================== ADMIN: NexSpace Pro Request ===================== */
cp_require_admin($conn, $in['token'] ?? '', function ($m, $c) { nx_out(['ok' => false, 'message' => $m], $c); });

if ($action === 'admin_list') {
    $status = (string)($in['status'] ?? 'pending');
    $where = in_array($status, ['pending', 'ready', 'rejected'], true) ? "AND o.status = '$status'" : '';
    $res = $conn->query("SELECT o.*, u.name AS buyer_name, u.email AS buyer_email FROM nexspace_orders o LEFT JOIN users u ON u.id = o.user_id
                         WHERE o.tier = 'pro' $where ORDER BY (o.status = 'pending') DESC, o.id DESC LIMIT 300");
    $rows = [];
    while ($res && ($o = $res->fetch_assoc())) $rows[] = nx_pub($o, true) + ['id' => (int)$o['id'], 'buyer_name' => $o['buyer_name'], 'buyer_email' => $o['buyer_email'], 'code' => $o['code']];
    $c = $conn->query("SELECT status, COUNT(*) n FROM nexspace_orders WHERE tier = 'pro' GROUP BY status");
    $counts = ['pending' => 0, 'ready' => 0, 'rejected' => 0];
    while ($c && ($r = $c->fetch_assoc())) $counts[$r['status']] = (int)$r['n'];
    nx_out(['ok' => true, 'requests' => $rows, 'counts' => $counts, 'default_host' => nx_cfg()['ssh_host'], 'default_port' => nx_cfg()['ssh_port']]);
}

if ($action === 'admin_deliver') {
    $o = nx_get($conn, "id = ? AND tier = 'pro'", 'i', (int)($in['id'] ?? 0));
    if (!$o) nx_out(['ok' => false, 'message' => 'Pesanan tidak ditemukan.'], 404);
    if ($o['status'] !== 'pending') nx_out(['ok' => false, 'message' => 'Pesanan ini sudah diproses.'], 409);
    $host = trim((string)($in['host'] ?? '')); $port = (int)($in['port'] ?? 22); $lu = trim((string)($in['login_user'] ?? '')); $pw = (string)($in['password'] ?? '');
    if (!preg_match('/^[A-Za-z0-9.-]{3,120}$/', $host) || $port < 1 || $port > 65535 || !preg_match('/^[a-z_][a-z0-9_-]{0,31}$/', $lu) || strlen($pw) < 6)
        nx_out(['ok' => false, 'message' => 'Lengkapi host, port, username, dan password (min 6 karakter).'], 400);
    $note = cp_str($in['note'] ?? '', 255);
    $st = cp_q($conn, "UPDATE nexspace_orders SET status = 'ready', login_host = ?, login_port = ?, login_user = ?, login_pass_enc = ?, note = ?, delivered_at = NOW() WHERE id = ? AND status = 'pending'",
        'sisssi', $host, $port, $lu, nx_enc($pw), $note ?: null, (int)$o['id']);
    if ($st->affected_rows !== 1) nx_out(['ok' => false, 'message' => 'Pesanan ini sudah diproses.'], 409);
    $st->close();
    cp_q($conn, "UPDATE riwayat_pesanan SET status = 'selesai' WHERE order_id = ? AND user_id = ?", 'si', $o['order_id'], (int)$o['user_id'])->close();
    $buyer = nx_user($conn, (int)$o['user_id']);
    if (!empty($buyer['email'])) {
        $mail = nx_mail_html('Server NexSpace Pro kamu sudah siap', 'Data login sudah tersedia. Kembali ke Boosteryuk untuk mengambilnya — demi keamanan, password tidak dikirim lewat email.',
            ['Nama server' => htmlspecialchars($o['username']), 'Paket' => htmlspecialchars($o['plan_name'])], 'https://' . CP_ROOT_DOMAIN . '/nexspace/portal', 'Ambil data login');
        $to = $buyer['email']; $un = $o['username'];
        cp_after_response(fn() => cp_send_email($to, "Server NexSpace Pro $un sudah siap", $mail));
    }
    nx_out(['ok' => true, 'message' => 'Data login terkirim. User sudah diberi tahu lewat email.']);
}

if ($action === 'admin_reject') {
    $o = nx_get($conn, "id = ? AND tier = 'pro'", 'i', (int)($in['id'] ?? 0));
    if (!$o || $o['status'] !== 'pending') nx_out(['ok' => false, 'message' => 'Pesanan tidak bisa ditolak.'], 409);
    $reason = cp_str($in['reason'] ?? '', 255);
    if (mb_strlen($reason) < 3) nx_out(['ok' => false, 'message' => 'Tulis alasan penolakan.'], 400);
    nx_refund($conn, $o, 'rejected', $reason);
    $buyer = nx_user($conn, (int)$o['user_id']);
    if (!empty($buyer['email'])) {
        $mail = nx_mail_html('Pesanan NexSpace Pro dibatalkan', 'Maaf, pesanan kamu tidak dapat diproses. Saldo ' . nx_rp($o['price']) . ' sudah dikembalikan ke akunmu.',
            ['Nama server' => htmlspecialchars($o['username']), 'Alasan' => htmlspecialchars($reason)]);
        $to = $buyer['email'];
        cp_after_response(fn() => cp_send_email($to, 'Pesanan NexSpace Pro dibatalkan', $mail));
    }
    nx_out(['ok' => true, 'message' => 'Pesanan ditolak dan saldo dikembalikan.']);
}

nx_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
