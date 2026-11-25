<?php
/**
 * admin_data.php — data untuk Admin Panel utama (HANYA role admin; dicek di database).
 * POST JSON {token, action, ...}:
 *   orders        {q?, type?, status?, page?}      → pesanan semua user + nama/username/email
 *   order_status  {id, status}                     → ubah status pesanan (pending|proses|selesai|batal) — tanpa mengubah saldo
 *   users         {q?, page?}                      → semua user
 *   user_update   {id, name?, username?, email?, phone?, role?, plus?}
 *   user_balance  {id, amount, note}               → tambah (+) / kurangi (−) saldo, tercatat di admin_balance_log
 *   profit                                         → penghasilan (SMM + Agen AI + Upgrade), transaksi, deposit masuk
 *   deposits      {limit?}                         → deposit terbaru semua user (maks 10)
 * Setiap request admin juga memicu dr_maybe_run() (data_retention_lib.php): pembersihan rutin
 * riwayat order & deposit tanpa cron — tahunan (semua data > 1 tahun) dan bulanan (data gagal > 1 bulan).
 *
 * Penghasilan = markup SMM (harga web utama − harga asli provider, per order SMM; tabel smm_order_profit, diisi order.php)
 *             + sewa Agen AI (harga dasar paket; tanpa markup child panel — itu milik pemilik panel)
 *             + paket Upgrade Boosteryuk Plus & EXTRA (harga penuh — tanpa biaya provider).
 * Order lama yang belum tercatat diperkirakan dari markup tetap Rp4.425/1000 dan ditandai "estimasi". Pesanan batal tidak dihitung.
 * Deposit: tabel `deposits` (ditulis callback.php, riwayat lama diimpor dari tripay_log.txt) + top up manual admin.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
error_reporting(0);

require 'configdb.php';
require_once __DIR__ . '/child_panel_lib.php'; // cp_q, cp_require_admin, cp_str
require_once __DIR__ . '/data_retention_lib.php'; // dr_maybe_run: pembersihan rutin riwayat (tanpa cron)
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function ad_out($d, $c = 200) { http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
set_exception_handler(function ($e) { ad_out(['ok' => false, 'message' => 'Kesalahan server: ' . $e->getMessage()], 500); });

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) ad_out(['ok' => false, 'message' => 'Body JSON tidak valid.'], 400);
$adminId = cp_require_admin($conn, $in['token'] ?? '', function ($m, $c) { ad_out(['ok' => false, 'message' => $c === 403 ? 'Hanya admin yang boleh membuka halaman ini.' : $m], $c); });
$action = (string)($in['action'] ?? '');

/* Pembersihan rutin data riwayat (tanpa cron): tiap admin membuka halaman data, jadwal yang
   sudah jatuh tempo dijalankan — maksimal sekali per bulan (data gagal) dan sekali per tahun
   (semua riwayat > 1 tahun). Tidak pernah menggagalkan halaman walau tabelnya belum ada. */
dr_maybe_run($conn);
const AD_PAGE = 25;

/* ---------- util skema ---------- */
function ad_cols($conn, $table) {
    static $cache = [];
    if (isset($cache[$table])) return $cache[$table];
    $out = [];
    try {
        $r = $conn->query("SHOW COLUMNS FROM `$table`");
        while ($r && ($c = $r->fetch_assoc())) $out[strtolower($c['Field'])] = strtolower($c['Type']);
    } catch (Throwable $e) { /* tabel tidak ada */ }
    return $cache[$table] = $out;
}
function ad_pick($cols, $cands) { foreach ($cands as $c) if (isset($cols[$c])) return $c; return null; }
function ad_like($q) { return '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%'; }

function ad_log_schema($conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS admin_balance_log (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        admin_id   INT NOT NULL,
        amount     DECIMAL(15,2) NOT NULL COMMENT '+ tambah, - kurangi',
        balance_after DECIMAL(15,2) NOT NULL,
        note       VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_user (user_id), KEY idx_time (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

/** Jenis pesanan dari awalan ID / nama (sama dengan halaman Riwayat). SQL CASE untuk filter. */
const AD_TYPE_SQL = "CASE
    WHEN r.order_id LIKE 'EVG%' OR r.service_name LIKE 'Event Merchant:%' THEN 'event'
    WHEN r.order_id LIKE 'NX%' OR r.service_name LIKE 'NexSpace%' THEN 'nexspace'
    WHEN r.order_id LIKE 'OTP%' OR r.service_name LIKE 'Nomor OTP%' THEN 'otp'
    WHEN r.order_id REGEXP '^AI[0-9]{6}' OR r.service_name LIKE '%Agen AI%' THEN 'agent_ai'
    WHEN r.order_id REGEXP '^UP[0-9]' OR r.service_name LIKE '%Boosteryuk Plus%' OR r.service_name LIKE '%Boosteryuk EXTRA%' THEN 'upgrade'
    ELSE 'smm' END";

function ad_user_select($conn) {
    $c = ad_cols($conn, 'users');
    return "u.name AS user_name, " . (isset($c['username']) ? 'u.username' : 'NULL') . " AS username, u.email AS user_email";
}

// Lightweight root-only feed, before any legacy deposit import or mutation.
if ($action === 'notifications') {
    if (!empty($_SERVER['HTTP_X_CHILD_PANEL'])) ad_out(['ok'=>false,'message'=>'Indikator admin hanya untuk domain utama.'],403);
    require_once __DIR__.'/admin_notifications_lib.php';
    ad_out(['ok'=>true,'markers'=>an_snapshot($conn)]);
}

if ($action === 'provider2_balance') {
    if (!empty($_SERVER['HTTP_X_CHILD_PANEL'])) ad_out(['ok'=>false,'message'=>'Hanya domain utama.'],403);
    require_once __DIR__.'/naizop_lib.php';
    try {
        $b=n2_call('balance');
        if(isset($b['error']) || !is_numeric($b['balance']??null) || !is_finite((float)$b['balance']) || (float)$b['balance']<0 || ($b['currency']??'')!=='USD')throw new RuntimeException('Saldo USD provider 2 tidak dapat diverifikasi.');
        $fx=n2_fx();ad_out(['ok'=>true,'balance'=>(float)$b['balance'],'currency'=>'USD','idr'=>round((float)$b['balance']*$fx['rate']),'fx'=>$fx]);
    } catch(Throwable $e){ad_out(['ok'=>false,'message'=>$e->getMessage()],503);}
}

// Saldo provider Server 3 (SMMGen) — hanya ditampilkan di halaman admin My Profit.
if ($action === 'smmgen_balance') {
    require_once __DIR__ . '/smmgen_lib.php';
    try {
        $b = smg_balance();
        ad_out(['ok' => true, 'balance' => isset($b['balance']) && is_numeric($b['balance']) ? (float)$b['balance'] : null, 'currency' => (string)($b['currency'] ?? 'USD')]);
    } catch (Throwable $e) {
        ad_out(['ok' => false, 'message' => $e->getMessage()], 503);
    }
}

// Saldo provider dibaca langsung di server, tidak mempercayai nominal dari browser.
if ($action === 'provider_health') {
    require __DIR__ . '/config.php';
    $ch = curl_init(rtrim($BASE_URL,'/') . '/balance');
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query(['api_id'=>(int)$API_ID,'api_key'=>$API_KEY]),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);
    $raw = curl_exec($ch); $http = curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    $j = json_decode((string)$raw,true);
    $value = $j['balance'] ?? $j['data']['balance'] ?? null;
    if ($http !== 200 || ($j['status'] ?? null) === false || !is_numeric($value) || !is_finite((float)$value) || (float)$value < 0) ad_out(['ok'=>false,'message'=>'Saldo provider tidak dapat diverifikasi.'],502);
    $balance = (float)$value;
    $total = (float)$conn->query('SELECT COALESCE(SUM(balance),0) total FROM users')->fetch_assoc()['total'];
    $sent = false;
    if ($balance < $total) {
        $conn->query("CREATE TABLE IF NOT EXISTS admin_alert_state (name VARCHAR(64) PRIMARY KEY, sent_at DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $lock = $conn->query("SELECT GET_LOCK('provider_balance_alert',0) acquired")->fetch_assoc();
        if ((int)$lock['acquired'] === 1) {
            try {
                $row = $conn->query("SELECT sent_at FROM admin_alert_state WHERE name='provider_balance'")->fetch_assoc();
                if (!$row || !$row['sent_at'] || strtotime($row['sent_at']) < time()-21600) {
                    $rp = function($n) { return 'Rp'.number_format($n,0,',','.'); };
                    $sent = cp_send_email('boosteryukid@gmail.com','ALERT: Saldo provider kurang — segera isi ulang', '<h2>Saldo provider tidak mencukupi</h2><p>Segera isi ulang saldo provider.</p><p>Saldo provider: '.$rp($balance).'<br>Total saldo semua user: '.$rp($total).'<br>Kekurangan: '.$rp($total-$balance).'</p><p>Waktu server: '.date('Y-m-d H:i:s').'</p>');
                    if ($sent) $conn->query("INSERT INTO admin_alert_state (name,sent_at) VALUES ('provider_balance',NOW()) ON DUPLICATE KEY UPDATE sent_at=NOW()");
                }
            } finally { $conn->query("SELECT RELEASE_LOCK('provider_balance_alert')"); }
        }
    }
    ad_out(['ok'=>true,'balance'=>$balance,'total_user_balance'=>$total,'shortfall'=>max(0,$total-$balance),'alert_sent'=>$sent]);
}

if ($action === 'order_id') {
    $id = (int)($in['id'] ?? 0); $new = trim((string)($in['order_id'] ?? ''));
    if (!preg_match('/^[0-9]{1,64}$/',$new)) ad_out(['ok'=>false,'message'=>'ID provider SMM harus angka (maksimal 64 digit).'],400);
    $conn->query("CREATE TABLE IF NOT EXISTS admin_order_id_log (id INT AUTO_INCREMENT PRIMARY KEY, history_id INT NOT NULL, admin_id INT NOT NULL, old_id VARCHAR(64) NOT NULL, new_id VARCHAR(64) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->begin_transaction();
    try {
        $st=cp_q($conn,'SELECT r.*, ('.AD_TYPE_SQL.') kind FROM riwayat_pesanan r WHERE r.id=? FOR UPDATE','i',$id);
        $o=$st->get_result()->fetch_assoc(); $st->close();
        if (!$o || $o['kind'] !== 'smm') { $conn->rollback(); ad_out(['ok'=>false,'message'=>'Penggantian ID provider hanya untuk pesanan SMM.'],400); }
        $st=cp_q($conn,'SELECT id FROM riwayat_pesanan WHERE order_id=? AND id<>? LIMIT 1','si',$new,$id);
        $duplicate=$st->get_result()->fetch_assoc(); $st->close();
        if ($duplicate) { $conn->rollback(); ad_out(['ok'=>false,'message'=>'ID sudah digunakan pesanan lain.'],409); }
        cp_q($conn,'UPDATE riwayat_pesanan SET order_id=? WHERE id=?','si',$new,$id)->close();
        foreach (['smm_order_profit','child_panel_orders'] as $table) {
            if (ad_cols($conn,$table)) {
                $kind = $table === 'child_panel_orders' ? " AND kind='smm'" : '';
                cp_q($conn,"UPDATE $table SET order_id=? WHERE order_id=? AND user_id=?$kind",'ssi',$new,$o['order_id'],(int)$o['user_id'])->close();
            }
        }
        cp_q($conn,'INSERT INTO admin_order_id_log (history_id,admin_id,old_id,new_id) VALUES (?,?,?,?)','iiss',$id,$adminId,$o['order_id'],$new)->close();
        $conn->commit();
        ad_out(['ok'=>true,'order_id'=>$new]);
    } catch (Throwable $e) { $conn->rollback(); ad_out(['ok'=>false,'message'=>'Gagal mengganti ID. Pastikan ID belum digunakan dan tabel mendukung transaksi.'],409); }
}

/* ===================== PESANAN ===================== */
if ($action === 'orders') {
    $where = ['1=1']; $types = ''; $args = [];
    $rc = ad_cols($conn, 'riwayat_pesanan');
    $targetSel = isset($rc['target']) ? 'r.target' : 'NULL';
    $q = trim((string)($in['q'] ?? ''));
    if ($q !== '') {
        $uc = ad_cols($conn, 'users');
        $un = isset($uc['username']) ? ' OR u.username LIKE ?' : '';
        $tg = isset($rc['target']) ? ' OR r.target LIKE ?' : '';
        $where[] = "(r.order_id LIKE ? OR r.service_name LIKE ? OR u.name LIKE ? OR u.email LIKE ?$un$tg)";
        $n = $un ? 5 : 4;
        $n += $tg ? 1 : 0;
        $types .= str_repeat('s', $n);
        for ($i = 0; $i < $n; $i++) $args[] = ad_like($q);
    }
    $status = (string)($in['status'] ?? '');
    if (in_array($status, ['pending', 'proses', 'selesai', 'batal'], true)) { $where[] = 'r.status = ?'; $types .= 's'; $args[] = $status; }
    $type = (string)($in['type'] ?? '');
    if (in_array($type, ['smm', 'agent_ai', 'nexspace', 'otp', 'upgrade', 'event'], true)) { $where[] = '(' . AD_TYPE_SQL . ') = ?'; $types .= 's'; $args[] = $type; }
    $w = implode(' AND ', $where);
    $page = max(1, (int)($in['page'] ?? 1));
    $off = ($page - 1) * AD_PAGE;

    $st = cp_q($conn, "SELECT COUNT(*) n, COALESCE(SUM(CASE WHEN r.status <> 'batal' THEN r.price END),0) omzet
                       FROM riwayat_pesanan r LEFT JOIN users u ON u.id = r.user_id WHERE $w", $types, ...$args);
    $tot = $st->get_result()->fetch_assoc(); $st->close();
    $hasProfit = (bool)ad_cols($conn, 'smm_order_profit');
    $st = cp_q($conn, "SELECT r.id, r.order_id, r.user_id, r.service_name, r.quantity, r.price, r.status, UNIX_TIMESTAMP(r.created_at)*1000 AS created_at,
                              (" . AD_TYPE_SQL . ") AS type, $targetSel AS target, " . ad_user_select($conn) . "
                       FROM riwayat_pesanan r LEFT JOIN users u ON u.id = r.user_id
                       WHERE $w ORDER BY r.id DESC LIMIT " . AD_PAGE . " OFFSET $off", $types, ...$args);
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC); $st->close();
    // markup per order (bila tercatat) — query terpisah agar aman dari beda collation
    $markups = [];
    if ($hasProfit && $rows) {
        $ids = array_values(array_unique(array_map(fn($r) => (int)$r['user_id'], $rows)));
        $res = $conn->query("SELECT order_id, user_id, cost, markup FROM smm_order_profit WHERE user_id IN (" . implode(',', $ids) . ") ORDER BY id DESC LIMIT 2000");
        while ($res && ($m = $res->fetch_assoc())) $markups[$m['user_id'] . '|' . $m['order_id']] = $m;
    }
    foreach ($rows as &$r) {
        $r['id'] = (int)$r['id']; $r['user_id'] = (int)$r['user_id']; $r['quantity'] = (int)$r['quantity'];
        $r['price'] = (float)$r['price']; $r['created_at'] = (int)$r['created_at'];
        $r['target'] = isset($r['target']) && $r['target'] !== null ? (string)$r['target'] : null;
        $m = $markups[$r['user_id'] . '|' . $r['order_id']] ?? null;
        $r['cost'] = $m ? (float)$m['cost'] : null; $r['markup'] = $m ? (float)$m['markup'] : null;
    }
    unset($r);
    ad_out(['ok' => true, 'orders' => $rows, 'total' => (int)$tot['n'], 'omzet' => (float)$tot['omzet'], 'page' => $page, 'per_page' => AD_PAGE]);
}

if ($action === 'order_status') {
    $status = (string)($in['status'] ?? '');
    if (!in_array($status, ['pending', 'proses', 'selesai', 'batal'], true)) ad_out(['ok' => false, 'message' => 'Status tidak valid.'], 400);
    $st = cp_q($conn, "UPDATE riwayat_pesanan SET status = ? WHERE id = ? AND order_id NOT LIKE 'EVG%' AND service_name NOT LIKE 'Event Merchant:%'", 'si', $status, (int)($in['id'] ?? 0));
    $st->close();
    ad_out(['ok' => true, 'message' => 'Status diperbarui bila pesanan dapat diubah (transaksi Event tetap final; saldo user tidak berubah).']);
}

/* ===================== USER ===================== */
function ad_user_row($conn, $u) {
    $c = ad_cols($conn, 'users');
    $plusCol = ad_pick($c, ['plus_active', 'is_plus']);
    $phoneCol = ad_pick($c, ['phone', 'whatsapp', 'no_hp', 'nomor']);
    return ['id' => (int)$u['id'], 'name' => $u['name'] ?? '', 'username' => $u['username'] ?? null, 'email' => $u['email'] ?? '',
        'phone' => $phoneCol ? ($u[$phoneCol] ?? null) : null, 'has_phone' => (bool)$phoneCol, 'has_username' => isset($c['username']),
        'role' => $u['role'] ?? 'user', 'balance' => (float)($u['balance'] ?? 0), 'plus' => $plusCol ? (bool)$u[$plusCol] : false, 'has_plus' => (bool)$plusCol,
        'created_at' => $u['created_at'] ?? null, 'orders' => isset($u['orders']) ? (int)$u['orders'] : null, 'spend' => isset($u['spend']) ? (float)$u['spend'] : null];
}

if ($action === 'users') {
    $c = ad_cols($conn, 'users');
    $where = '1=1'; $types = ''; $args = [];
    $q = trim((string)($in['q'] ?? ''));
    if ($q !== '') {
        $parts = ['u.name LIKE ?', 'u.email LIKE ?']; $n = 2;
        if (isset($c['username'])) { $parts[] = 'u.username LIKE ?'; $n++; }
        if (ctype_digit($q)) { $parts[] = 'u.id = ?'; }
        $where = '(' . implode(' OR ', $parts) . ')';
        $types = str_repeat('s', $n); for ($i = 0; $i < $n; $i++) $args[] = ad_like($q);
        if (ctype_digit($q)) { $types .= 'i'; $args[] = (int)$q; }
    }
    $page = max(1, (int)($in['page'] ?? 1)); $off = ($page - 1) * AD_PAGE;
    $st = cp_q($conn, "SELECT COUNT(*) n, COALESCE(SUM(u.balance),0) saldo FROM users u WHERE $where", $types, ...$args);
    $tot = $st->get_result()->fetch_assoc(); $st->close();
    $st = cp_q($conn, "SELECT u.*, (SELECT COUNT(*) FROM riwayat_pesanan r WHERE r.user_id = u.id) AS orders,
                              (SELECT COALESCE(SUM(r.price),0) FROM riwayat_pesanan r WHERE r.user_id = u.id AND r.status <> 'batal') AS spend
                       FROM users u WHERE $where ORDER BY u.id DESC LIMIT " . AD_PAGE . " OFFSET $off", $types, ...$args);
    $rows = array_map(fn($u) => ad_user_row($conn, $u), $st->get_result()->fetch_all(MYSQLI_ASSOC)); $st->close();
    ad_out(['ok' => true, 'users' => $rows, 'total' => (int)$tot['n'], 'total_balance' => (float)$tot['saldo'], 'page' => $page, 'per_page' => AD_PAGE]);
}

if ($action === 'user_update') {
    $id = (int)($in['id'] ?? 0);
    $st = cp_q($conn, "SELECT * FROM users WHERE id = ? LIMIT 1", 'i', $id);
    $u = $st->get_result()->fetch_assoc(); $st->close();
    if (!$u) ad_out(['ok' => false, 'message' => 'User tidak ditemukan.'], 404);
    $c = ad_cols($conn, 'users');
    $set = []; $types = ''; $args = [];
    if (isset($in['name'])) { $v = cp_str($in['name'], 80); if (mb_strlen($v) < 2) ad_out(['ok' => false, 'message' => 'Nama minimal 2 karakter.'], 400); $set[] = 'name = ?'; $types .= 's'; $args[] = $v; }
    if (isset($in['email'])) {
        $v = strtolower(trim((string)$in['email']));
        if (!filter_var($v, FILTER_VALIDATE_EMAIL)) ad_out(['ok' => false, 'message' => 'Email tidak valid.'], 400);
        $st = cp_q($conn, "SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1", 'si', $v, $id);
        if ($st->get_result()->fetch_assoc()) ad_out(['ok' => false, 'message' => 'Email sudah dipakai user lain.'], 409);
        $st->close(); $set[] = 'email = ?'; $types .= 's'; $args[] = $v;
    }
    if (isset($in['username']) && isset($c['username'])) {
        $v = trim((string)$in['username']);
        if (!preg_match('/^[A-Za-z0-9_. -]{2,40}$/', $v)) ad_out(['ok' => false, 'message' => 'Username 2–40 karakter (huruf, angka, titik, garis bawah).'], 400);
        $set[] = 'username = ?'; $types .= 's'; $args[] = $v;
    }
    $phoneCol = ad_pick($c, ['phone', 'whatsapp', 'no_hp', 'nomor']);
    if (isset($in['phone']) && $phoneCol) { $set[] = "`$phoneCol` = ?"; $types .= 's'; $args[] = mb_substr(preg_replace('/[^0-9+]/', '', (string)$in['phone']), 0, 20); }
    if (isset($in['role'])) {
        $v = $in['role'] === 'admin' ? 'admin' : 'user';
        if ($id === (int)$adminId && $v !== 'admin') ad_out(['ok' => false, 'message' => 'Tidak bisa mencabut role admin dari akun sendiri.'], 400);
        $set[] = 'role = ?'; $types .= 's'; $args[] = $v;
    }
    $plusCol = ad_pick($c, ['plus_active', 'is_plus']);
    if (isset($in['plus']) && $plusCol) { $set[] = "`$plusCol` = ?"; $types .= 'i'; $args[] = $in['plus'] ? 1 : 0; }
    if (!$set) ad_out(['ok' => false, 'message' => 'Tidak ada perubahan.'], 400);
    $types .= 'i'; $args[] = $id;
    cp_q($conn, "UPDATE users SET " . implode(', ', $set) . " WHERE id = ?", $types, ...$args)->close();
    $st = cp_q($conn, "SELECT * FROM users WHERE id = ? LIMIT 1", 'i', $id);
    ad_out(['ok' => true, 'user' => ad_user_row($conn, $st->get_result()->fetch_assoc()), 'message' => 'Data user tersimpan.']);
}

if ($action === 'user_balance') {
    $id = (int)($in['id'] ?? 0);
    $amount = round((float)($in['amount'] ?? 0));
    $note = cp_str($in['note'] ?? '', 255);
    if ($amount == 0 || abs($amount) > 100000000) ad_out(['ok' => false, 'message' => 'Nominal tidak valid (maks Rp100.000.000 per transaksi).'], 400);
    if (mb_strlen($note) < 3) ad_out(['ok' => false, 'message' => 'Isi catatan (alasan penambahan/pengurangan saldo).'], 400);
    ad_log_schema($conn);
    $conn->begin_transaction();
    try {
        // Pengurangan tidak boleh membuat saldo minus.
        $st = cp_q($conn, "UPDATE users SET balance = balance + ? WHERE id = ? AND balance + ? >= 0", 'did', $amount, $id, $amount);
        $ok = $st->affected_rows === 1; $st->close();
        if (!$ok) { $conn->rollback(); ad_out(['ok' => false, 'message' => 'User tidak ditemukan atau saldo tidak cukup untuk dikurangi.'], 400); }
        $bal = (float)cp_q($conn, "SELECT balance FROM users WHERE id = ?", 'i', $id)->get_result()->fetch_assoc()['balance'];
        cp_q($conn, "INSERT INTO admin_balance_log (user_id, admin_id, amount, balance_after, note) VALUES (?,?,?,?,?)", 'iidds', $id, (int)$adminId, $amount, $bal, $note)->close();
        $conn->commit();
    } catch (Throwable $e) { $conn->rollback(); ad_out(['ok' => false, 'message' => 'Gagal mengubah saldo.'], 500); }
    ad_out(['ok' => true, 'balance' => $bal, 'message' => ($amount > 0 ? 'Saldo ditambah ' : 'Saldo dikurangi ') . 'Rp' . number_format(abs($amount), 0, ',', '.') . '.']);
}

/* ===================== DEPOSIT (tabel deposits, diisi callback.php) ===================== */
require_once __DIR__ . '/deposit_lib.php';
const AD_PAID_SQL = "('paid')";
function ad_deposit_source($conn) {
    static $src = false;
    if ($src !== false) return $src;
    try { dep_schema($conn); dep_import_log($conn); } catch (Throwable $e) { return $src = null; }
    return $src = ['table' => 'deposits', 'amount' => 'amount', 'user_id' => 'user_id', 'email' => null, 'status' => 'status',
        'time' => 'paid_at', 'ref' => 'merchant_ref', 'method' => 'method', 'id' => 'id'];
}

function ad_deposit_stats($conn) {
    $s = ad_deposit_source($conn);
    $out = ['source' => $s ? $s['table'] : null, 'today' => 0.0, 'month' => 0.0, 'all' => 0.0, 'count_month' => 0];
    if ($s && $s['time']) {
        $paid = $s['status'] ? "LOWER(CAST(`{$s['status']}` AS CHAR)) IN " . AD_PAID_SQL : '1=1';
        $a = "`{$s['amount']}`"; $t = "`{$s['time']}`";
        $r = $conn->query("SELECT COALESCE(SUM(CASE WHEN $t >= CURDATE() THEN $a END),0) today,
                                  COALESCE(SUM(CASE WHEN $t >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN $a END),0) month,
                                  COALESCE(SUM($t >= DATE_FORMAT(NOW(),'%Y-%m-01')),0) cm, COALESCE(SUM($a),0) allsum
                           FROM `{$s['table']}` WHERE $paid")->fetch_assoc();
        $out = ['source' => $s['table'], 'today' => (float)$r['today'], 'month' => (float)$r['month'], 'all' => (float)$r['allsum'], 'count_month' => (int)$r['cm']];
    }
    // top up manual admin (hanya penambahan)
    if (ad_cols($conn, 'admin_balance_log')) {
        $r = $conn->query("SELECT COALESCE(SUM(CASE WHEN created_at >= CURDATE() THEN amount END),0) today,
                                  COALESCE(SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN amount END),0) month, COALESCE(SUM(amount),0) allsum
                           FROM admin_balance_log WHERE amount > 0")->fetch_assoc();
        $out['manual'] = ['today' => (float)$r['today'], 'month' => (float)$r['month'], 'all' => (float)$r['allsum']];
    }
    return $out;
}

if ($action === 'deposits') {
    $limit = max(1, min(10, (int)($in['limit'] ?? 10)));
    $rows = [];
    $s = ad_deposit_source($conn);
    $uc = ad_cols($conn, 'users'); $un = isset($uc['username']) ? 'u.username' : 'NULL';
    if ($s) {
        $join = "LEFT JOIN users u ON u.id = d.`user_id`";
        $sel = fn($k, $as) => $s[$k] ? "d.`{$s[$k]}` AS $as" : "NULL AS $as";
        $order = "d.`paid_at` DESC, d.`id`";
        try {
            $res = $conn->query("SELECT " . $sel('amount', 'amount') . ", " . $sel('status', 'status') . ", " . $sel('time', 'time') . ", " . $sel('ref', 'ref') . ", " . $sel('method', 'method') . ",
                                        u.name AS user_name, $un AS username, u.email AS user_email
                                 FROM `{$s['table']}` d $join ORDER BY $order DESC LIMIT $limit");
            while ($res && ($r = $res->fetch_assoc())) $rows[] = ['source' => 'gateway', 'amount' => (float)$r['amount'], 'status' => $r['status'], 'time' => $r['time'], 'ref' => $r['ref'],
                'method' => $r['method'], 'user_name' => $r['user_name'], 'username' => $r['username'], 'user_email' => $r['user_email'], 'note' => null];
        } catch (Throwable $e) { $s = null; }
    }
    if (ad_cols($conn, 'admin_balance_log')) {
        $res = $conn->query("SELECT l.amount, l.created_at, l.note, u.name AS user_name, $un AS username, u.email AS user_email
                             FROM admin_balance_log l LEFT JOIN users u ON u.id = l.user_id WHERE l.amount > 0 ORDER BY l.id DESC LIMIT $limit");
        while ($res && ($r = $res->fetch_assoc())) $rows[] = ['source' => 'manual', 'amount' => (float)$r['amount'], 'status' => 'paid', 'time' => $r['created_at'], 'ref' => null,
            'method' => 'Manual admin', 'user_name' => $r['user_name'], 'username' => $r['username'], 'user_email' => $r['user_email'], 'note' => $r['note']];
    }
    usort($rows, fn($a, $b) => strcmp((string)$b['time'], (string)$a['time']));
    ad_out(['ok' => true, 'deposits' => array_slice($rows, 0, $limit), 'source_table' => $s ? $s['table'] : null, 'stats' => ad_deposit_stats($conn), 'server_time' => date('Y-m-d H:i:s')]);
}

/* ===================== PROFIT ===================== */
if ($action === 'profit') {
    // 1) markup tercatat (pesanan batal tidak dihitung) — status dicek di PHP agar aman dari beda collation
    $rec = ['today' => 0.0, 'month' => 0.0, 'all' => 0.0, 'orders' => 0, 'cost' => 0.0];
    $recorded = [];
    if (ad_cols($conn, 'smm_order_profit')) {
        $batal = [];
        $res = $conn->query("SELECT user_id, order_id FROM riwayat_pesanan WHERE status = 'batal'");
        while ($res && ($r = $res->fetch_assoc())) $batal[$r['user_id'] . '|' . $r['order_id']] = true;
        $res = $conn->query("SELECT user_id, order_id, cost, markup, UNIX_TIMESTAMP(created_at) ts FROM smm_order_profit");
        $t0 = strtotime('today'); $m0 = strtotime(date('Y-m-01'));
        while ($res && ($r = $res->fetch_assoc())) {
            $k = $r['user_id'] . '|' . $r['order_id'];
            $recorded[$k] = true;
            if (isset($batal[$k])) continue;
            $mk = (float)$r['markup'];
            $rec['all'] += $mk; $rec['cost'] += (float)$r['cost']; $rec['orders']++;
            if ($r['ts'] >= $m0) $rec['month'] += $mk;
            if ($r['ts'] >= $t0) $rec['today'] += $mk;
        }
    }
    // 2) estimasi order SMM lama (belum tercatat): markup tetap Rp4.425 per 1000, maksimal sebesar harga
    $est = ['today' => 0.0, 'month' => 0.0, 'all' => 0.0, 'orders' => 0];
    // 3) penghasilan Agen AI & Upgrade (Plus & EXTRA): tanpa backfill (harga penuh = penghasilan;
    //    untuk pesanan via child panel, markup panel milik pemilik panel → dipakai harga dasar (harga_dasar) saja).
    $agent = ['today' => 0.0, 'month' => 0.0, 'all' => 0.0, 'orders' => 0];
    $upg   = ['today' => 0.0, 'month' => 0.0, 'all' => 0.0, 'orders' => 0];
    $trx = ['smm' => ['n' => 0, 'omzet' => 0.0], 'lain' => ['n' => 0, 'omzet' => 0.0], 'today' => ['n' => 0, 'omzet' => 0.0], 'month' => ['n' => 0, 'omzet' => 0.0], 'batal' => 0];
    $hasDetail = isset(ad_cols($conn, 'riwayat_pesanan')['detail']);
    $res = $conn->query("SELECT r.user_id, r.order_id, r.quantity, r.price, r.status, UNIX_TIMESTAMP(r.created_at) ts, (" . AD_TYPE_SQL . ") AS type" . ($hasDetail ? ", r.detail" : "") . " FROM riwayat_pesanan r");
    $t0 = strtotime('today'); $m0 = strtotime(date('Y-m-01'));
    while ($res && ($r = $res->fetch_assoc())) {
        if ($r['status'] === 'batal') { $trx['batal']++; continue; }
        $price = (float)$r['price'];
        $g = $r['type'] === 'smm' ? 'smm' : 'lain';
        $trx[$g]['n']++; $trx[$g]['omzet'] += $price;
        if ($r['ts'] >= $m0) { $trx['month']['n']++; $trx['month']['omzet'] += $price; }
        if ($r['ts'] >= $t0) { $trx['today']['n']++; $trx['today']['omzet'] += $price; }
        if ($r['type'] === 'smm' && !isset($recorded[$r['user_id'] . '|' . $r['order_id']])) {
            $mk = min($price, round((int)$r['quantity'] / 1000 * 4425));
            $est['all'] += $mk; $est['orders']++;
            if ($r['ts'] >= $m0) $est['month'] += $mk;
            if ($r['ts'] >= $t0) $est['today'] += $mk;
        } elseif ($r['type'] === 'agent_ai') {
            // Harga dasar agen (tanpa markup child panel) = penghasilan panel utama; fallback: harga dibayar user.
            $earn = $price;
            if ($hasDetail && !empty($r['detail'])) {
                $dj = json_decode((string)$r['detail'], true);
                if (is_array($dj) && isset($dj['harga_dasar']) && is_numeric($dj['harga_dasar']) && (float)$dj['harga_dasar'] > 0) {
                    $earn = (float)$dj['harga_dasar'];
                }
            }
            $agent['all'] += $earn; $agent['orders']++;
            if ($r['ts'] >= $m0) $agent['month'] += $earn;
            if ($r['ts'] >= $t0) $agent['today'] += $earn;
        } elseif ($r['type'] === 'upgrade') {
            $upg['all'] += $price; $upg['orders']++;
            if ($r['ts'] >= $m0) $upg['month'] += $price;
            if ($r['ts'] >= $t0) $upg['today'] += $price;
        }
    }
    $users = $conn->query("SELECT COUNT(*) n, COALESCE(SUM(balance),0) saldo FROM users")->fetch_assoc();
    // Penghasilan = markup SMM + sewa Agen AI + paket Upgrade (Plus & EXTRA). Pesanan batal tidak dihitung.
    $smm = ['today' => $rec['today'] + $est['today'], 'month' => $rec['month'] + $est['month'], 'all' => $rec['all'] + $est['all'], 'orders' => $rec['orders'] + $est['orders']];
    ad_out(['ok' => true, 'income' => ['recorded' => $rec, 'estimated' => $est, 'smm' => $smm,
            'agent_ai' => $agent, 'upgrade' => $upg,
            'today' => $smm['today'] + $agent['today'] + $upg['today'],
            'month' => $smm['month'] + $agent['month'] + $upg['month'],
            'all' => $smm['all'] + $agent['all'] + $upg['all']],
        'transactions' => $trx, 'deposits' => ad_deposit_stats($conn),
        'users' => ['total' => (int)$users['n'], 'balance' => (float)$users['saldo']], 'server_time' => date('Y-m-d H:i:s')]);
}

ad_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
