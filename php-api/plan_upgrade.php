<?php
/**
 * plan_upgrade.php — paket Upgrade: Boosteryuk Plus & Boosteryuk EXTRA.
 * Upload ke /api (satu folder dengan configdb.php, child_panel_lib.php, riwayat_schema.php, plan_config.php).
 *
 * GET  ?token=…                         → status paket user + harga (publik bila tanpa token: hanya harga)
 * GET  ?check_sub=nama                   → apakah subdomain child panel tersedia
 * POST {token, plan:'plus'}             → Plus: sekali bayar, harga reseller selamanya
 * POST {token, plan:'extra', subdomain?, panel_name?, config?, markup_smm_pct?, markup_agent_pct?}
 *       → EXTRA bulanan: semua benefit Plus (selamanya) + Child Panel + Full Support.
 *         Bulan pertama harga promo hanya untuk user yang belum pernah berlangganan EXTRA.
 *         Pembelian pertama WAJIB subdomain → child panel dibuat otomatis (pemilik = user ini).
 *         Perpanjangan menambah 1 bulan dari masa aktif terakhir & ikut memperpanjang child panel.
 *
 * Keamanan: token dicek di tabel sessions, harga dihitung SERVER (plan_config.php), saldo dipotong
 * atomik (UPDATE … WHERE balance >= harga). Gagal di tengah jalan → saldo dikembalikan.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

error_reporting(0);
require 'configdb.php';
require_once __DIR__ . '/child_panel_lib.php';
require_once __DIR__ . '/riwayat_schema.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function pu_out($d, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$CFG = is_file(__DIR__ . '/plan_config.php') ? (include __DIR__ . '/plan_config.php') : [];
$PRICE_PLUS = (float)($CFG['plus']['price'] ?? 5000);
$PRICE_EXTRA = (float)($CFG['extra']['price'] ?? 20000);
$PRICE_EXTRA_FIRST = (float)($CFG['extra']['first_month_price'] ?? 10000);
$MARKUP_DEFAULT = (float)($CFG['extra']['markup_default'] ?? 10);

try {
    $conn->query("CREATE TABLE IF NOT EXISTS user_plans (
        user_id          INT NOT NULL PRIMARY KEY,
        plus_active      TINYINT(1) NOT NULL DEFAULT 0,
        plus_since       DATETIME NULL,
        extra_started    DATETIME NULL COMMENT 'pertama kali berlangganan EXTRA (promo bulan pertama terpakai)',
        extra_until      DATETIME NULL COMMENT 'masa aktif EXTRA',
        updated_at       TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    cp_ensure_schema($conn);
} catch (Throwable $e) {
    pu_out(['ok' => false, 'message' => 'Gagal menyiapkan tabel paket: ' . $e->getMessage()], 500);
}

/** Kolom "plus" milik tabel users (nama berbeda-beda) — diisi agar order.php/me.php ikut mengenali Plus. */
function pu_users_plus_column($conn) {
    static $col = false;
    if ($col !== false) return $col;
    $col = null;
    try {
        $res = $conn->query("SHOW COLUMNS FROM users");
        $have = [];
        while ($res && ($r = $res->fetch_assoc())) $have[strtolower($r['Field'])] = $r['Field'];
        foreach (['plus_active', 'is_plus', 'plusactive', 'plus', 'is_vip', 'vip'] as $c) {
            if (isset($have[$c])) { $col = $have[$c]; break; }
        }
    } catch (Throwable $e) { $col = null; }
    return $col;
}

function pu_plan_row($conn, $uid) {
    $st = cp_q($conn, "SELECT * FROM user_plans WHERE user_id = ? LIMIT 1", 'i', (int)$uid);
    $r = $st->get_result()->fetch_assoc();
    $st->close();
    return $r ?: null;
}

function pu_user_is_plus($conn, $uid, $plan) {
    if ($plan && (int)$plan['plus_active'] === 1) return true;
    $col = pu_users_plus_column($conn);
    if (!$col) return false;
    $st = cp_q($conn, "SELECT `$col` AS p FROM users WHERE id = ? LIMIT 1", 'i', (int)$uid);
    $r = $st->get_result()->fetch_assoc();
    $st->close();
    return !empty($r['p']) && $r['p'] !== '0';
}

function pu_owner_panel($conn, $uid) {
    $st = cp_q($conn, "SELECT p.id, p.name, p.status, p.expires_at, d.hostname FROM child_panels p
                       LEFT JOIN child_panel_domains d ON d.child_panel_id = p.id AND d.is_primary = 1
                       WHERE p.owner_user_id = ? ORDER BY p.id ASC LIMIT 1", 'i', (int)$uid);
    $r = $st->get_result()->fetch_assoc();
    $st->close();
    return $r ?: null;
}

function pu_status($conn, $uid, $prices) {
    $plan = pu_plan_row($conn, $uid);
    $extraUntil = $plan['extra_until'] ?? null;
    $extraActive = $extraUntil && strtotime($extraUntil) > time();
    $panel = pu_owner_panel($conn, $uid);
    return [
        'plus'            => pu_user_is_plus($conn, $uid, $plan) || $extraActive,
        'extra_active'    => (bool)$extraActive,
        'extra_until'     => $extraUntil,
        'promo_available' => empty($plan['extra_started']),
        'child_panel'     => $panel ? ['name' => $panel['name'], 'hostname' => $panel['hostname'], 'expires_at' => $panel['expires_at']] : null,
    ] + $prices;
}

$prices = ['price_plus' => $PRICE_PLUS, 'price_extra' => $PRICE_EXTRA, 'price_extra_first' => $PRICE_EXTRA_FIRST];

/* ===================== GET ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Cek nama subdomain untuk form checkout EXTRA.
    if (isset($_GET['check_sub'])) {
        $sub = cp_clean_sub($_GET['check_sub']);
        if (!$sub) pu_out(['ok' => true, 'available' => false, 'message' => 'Gunakan huruf kecil, angka, dan tanda minus (maks 32). Beberapa nama dipakai sistem.']);
        $chk = cp_q($conn, "SELECT 1 FROM child_panel_domains WHERE hostname = ? LIMIT 1", 's', $sub . '.' . CP_ROOT_DOMAIN);
        $taken = (bool)$chk->get_result()->fetch_assoc();
        $chk->close();
        pu_out(['ok' => true, 'available' => !$taken, 'hostname' => $sub . '.' . CP_ROOT_DOMAIN, 'message' => $taken ? 'Subdomain sudah dipakai.' : 'Subdomain tersedia.']);
    }
    $uid = cp_user_id($conn, $_GET['token'] ?? '');
    if (!$uid) pu_out(['ok' => true, 'guest' => true] + $prices);
    pu_out(['ok' => true] + pu_status($conn, $uid, $prices));
}

/* ===================== POST ===================== */
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$uid = cp_user_id($conn, $in['token'] ?? '');
if (!$uid) pu_out(['ok' => false, 'message' => 'Sesi tidak valid. Silakan login ulang.', 'session_expired' => true], 401);
$plan = (string)($in['plan'] ?? '');
if (!in_array($plan, ['plus', 'extra'], true)) pu_out(['ok' => false, 'message' => 'Paket tidak dikenal.'], 400);

$row = pu_plan_row($conn, $uid);
$panel = pu_owner_panel($conn, $uid);

if ($plan === 'plus') {
    if (pu_user_is_plus($conn, $uid, $row)) pu_out(['ok' => false, 'message' => 'Akun kamu sudah Boosteryuk Plus.'], 409);
    $price = $PRICE_PLUS;
    $service = 'Upgrade Boosteryuk Plus (selamanya)';
    $months = 0;
} else {
    $isNew = empty($row['extra_started']);
    $price = $isNew ? $PRICE_EXTRA_FIRST : $PRICE_EXTRA;
    $months = 1;
    $sub = null;
    if (!$panel) {
        // Pembelian pertama: child panel dibuat otomatis → subdomain wajib & harus tersedia.
        $sub = cp_clean_sub($in['subdomain'] ?? '');
        if (!$sub) pu_out(['ok' => false, 'message' => 'Isi nama subdomain child panel (huruf kecil, angka, tanda minus; maks 32).'], 400);
        $chk = cp_q($conn, "SELECT 1 FROM child_panel_domains WHERE hostname = ? LIMIT 1", 's', $sub . '.' . CP_ROOT_DOMAIN);
        $taken = (bool)$chk->get_result()->fetch_assoc();
        $chk->close();
        if ($taken) pu_out(['ok' => false, 'message' => "Subdomain $sub." . CP_ROOT_DOMAIN . ' sudah dipakai. Pilih nama lain.'], 409);
    }
    $service = 'Boosteryuk EXTRA 1 bulan' . ($isNew ? ' (promo bulan pertama)' : ' (perpanjangan)');
}

/* ---- potong saldo atomik ---- */
$st = cp_q($conn, "UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?", 'did', $price, (int)$uid, $price);
$charged = $st->affected_rows === 1;
$st->close();
if (!$charged) pu_out(['ok' => false, 'message' => 'Saldo tidak cukup. Butuh Rp ' . number_format($price, 0, ',', '.') . '.'], 400);

$orderId = 'UP' . time() . mt_rand(100, 999);
$MARKUP_SMM = null; $MARKUP_AGENT = null; $newPanelId = null;
try {
    $conn->begin_transaction();
    // Plus selamanya (juga diberikan oleh EXTRA).
    cp_q($conn, "INSERT INTO user_plans (user_id, plus_active, plus_since) VALUES (?, 1, NOW())
                 ON DUPLICATE KEY UPDATE plus_active = 1, plus_since = COALESCE(plus_since, NOW())", 'i', (int)$uid)->close();
    if ($col = pu_users_plus_column($conn)) cp_q($conn, "UPDATE users SET `$col` = 1 WHERE id = ?", 'i', (int)$uid)->close();

    $until = null;
    if ($plan === 'extra') {
        $base = (!empty($row['extra_until']) && strtotime($row['extra_until']) > time()) ? $row['extra_until'] : date('Y-m-d H:i:s');
        $until = date('Y-m-d H:i:s', strtotime($base . ' +1 month'));
        cp_q($conn, "UPDATE user_plans SET extra_started = COALESCE(extra_started, NOW()), extra_until = ? WHERE user_id = ?", 'si', $until, (int)$uid)->close();
        if ($panel) {
            // Panel buatan admin (tanpa masa aktif) tetap tanpa batas; panel EXTRA ikut diperpanjang.
            if (!empty($panel['expires_at'])) {
                cp_q($conn, "UPDATE child_panels SET expires_at = ?, status = 'active' WHERE id = ?", 'si', $until, (int)$panel['id'])->close();
            }
        } else {
            $name = mb_substr(trim(strip_tags((string)($in['panel_name'] ?? ''))), 0, 80) ?: ucfirst($sub);
            // Pengaturan dari halaman setup child panel (logo/hero/slider diunggah setelah panel dibuat).
            $cfgIn = is_array($in['config'] ?? null) ? $in['config'] : [];
            $cfgIn += ['brandName' => $name, 'headerTagline' => 'SMM Panel', 'voice' => 'off'];
            $config = json_encode(cp_clean_config($cfgIn), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if (isset($in['markup_smm_pct'])) $MARKUP_SMM = max(0, min(CP_MAX_MARKUP, round((float)$in['markup_smm_pct'], 2)));
            if (isset($in['markup_agent_pct'])) $MARKUP_AGENT = max(0, min(CP_MAX_MARKUP, round((float)$in['markup_agent_pct'], 2)));
            cp_q($conn, "INSERT INTO child_panels (owner_user_id, name, status, markup_smm_pct, markup_agent_pct, config, expires_at) VALUES (?,?, 'active', ?, ?, ?, ?)",
                'isddss', (int)$uid, $name, $MARKUP_SMM ?? $MARKUP_DEFAULT, $MARKUP_AGENT ?? $MARKUP_DEFAULT, $config, $until)->close();
            $pid = (int)$conn->insert_id;
            $newPanelId = $pid;
            cp_q($conn, "INSERT INTO child_panel_domains (child_panel_id, hostname, is_primary) VALUES (?, ?, 1)", 'is', $pid, $sub . '.' . CP_ROOT_DOMAIN)->close();
        }
    }

    // Riwayat pesanan (tampil di halaman Riwayat Pesanan user).
    $status = 'selesai';
    if (riwayat_ensure_columns($conn)) {
        $type = 'plan';
        $paket = $plan === 'plus' ? 'Plus' : 'EXTRA';
        $q = max(1, $months);
        cp_q($conn, "INSERT INTO riwayat_pesanan (user_id, order_id, service_name, quantity, price, status, order_type, paket, durasi_bulan, jatuh_tempo)
                     VALUES (?,?,?,?,?,?,?,?,?,?)", 'issidsssis', (int)$uid, $orderId, $service, $q, $price, $status, $type, $paket, $months, $until)->close();
    } else {
        $q = max(1, $months);
        cp_q($conn, "INSERT INTO riwayat_pesanan (user_id, order_id, service_name, quantity, price, status) VALUES (?,?,?,?,?,?)",
            'issids', (int)$uid, $orderId, $service, $q, $price, $status)->close();
    }
    $conn->commit();
} catch (Throwable $e) {
    try { $conn->rollback(); } catch (Throwable $e2) { /* abaikan */ }
    cp_q($conn, "UPDATE users SET balance = balance + ? WHERE id = ?", 'di', $price, (int)$uid)->close();
    pu_out(['ok' => false, 'message' => 'Gagal memproses upgrade, saldo dikembalikan. (' . $e->getMessage() . ')', 'refunded' => true], 500);
}

$st = cp_q($conn, "SELECT balance FROM users WHERE id = ? LIMIT 1", 'i', (int)$uid);
$balance = (float)($st->get_result()->fetch_assoc()['balance'] ?? 0);
$st->close();
pu_out(['ok' => true, 'order_id' => $orderId, 'plan' => $plan, 'price' => $price, 'new_balance' => $balance, 'panel_id' => $newPanelId ?? null] + pu_status($conn, $uid, $prices));
