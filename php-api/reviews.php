<?php
/**
 * reviews.php — penilaian & ulasan layanan oleh user (banner "Pesanan sudah selesai").
 *
 * POST JSON:
 *   {token, action:'pending'}              → {ok, orders:[{order_id, service_name}]} pesanan SELESAI
 *                                            milik user yang belum dinilai (untuk banner notifikasi).
 *   {token, action:'submit', order_id, stars(1-5), review} → simpan penilaian; nama layanan dicatat
 *                                            langsung dari riwayat (papan penilaian tidak perlu
 *                                            memuat API layanan berulang kali).
 *   {action:'list'}                        → {ok, reviews:[{username, stars, service_name, service_key,
 *                                            review, created_at}]} 100 terbaru untuk Papan Penilaian.
 *
 * Satu penilaian per pesanan (UNIQUE order_id). Nama layanan disimpan di tabel sehingga halaman
 * Papan Penilaian tidak memanggil API provider — sama seperti logika layanan Google Maps Review
 * di dashboard yang menyimpan nama layanannya.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
error_reporting(0);
require 'configdb.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');
require_once __DIR__ . '/child_panel_lib.php'; // cp_q (prepared helper)

/** Klasifikasi tipe pesanan SAMAA dengan admin_data.php (AD_TYPE_SQL): hanya 'smm' yang boleh dinilai. */
const RV_TYPE_SQL = "CASE
    WHEN r.order_id LIKE 'EVG%' OR r.service_name LIKE 'Event Merchant:%' THEN 'event'
    WHEN r.order_id LIKE 'NX%' OR r.service_name LIKE 'NexSpace%' THEN 'nexspace'
    WHEN r.order_id LIKE 'OTP%' OR r.service_name LIKE 'Nomor OTP%' THEN 'otp'
    WHEN r.order_id REGEXP '^AI[0-9]{6}' OR r.service_name LIKE '%Agen AI%' THEN 'agent_ai'
    WHEN r.order_id REGEXP '^UP[0-9]' OR r.service_name LIKE '%Boosteryuk Plus%' OR r.service_name LIKE '%Boosteryuk EXTRA%' THEN 'upgrade'
    ELSE 'smm' END";

function rv_out($d, $code = 200) { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }

function rv_log($text) {
    @file_put_contents(__DIR__ . '/reviews_log.txt', date('Y-m-d H:i:s') . ' ' . $text . "\n", FILE_APPEND);
}

function rv_schema($conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS service_reviews (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      INT NOT NULL,
        order_id     VARCHAR(64) NOT NULL,
        service_name VARCHAR(255) NOT NULL COMMENT 'nama layanan saat dinilai — papan tidak perlu load API',
        service_key  VARCHAR(32) NULL COMMENT 'id layanan untuk tombol pesan ulang (bila ada)',
        stars        TINYINT NOT NULL,
        review       TEXT NULL,
        created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_order (order_id),
        KEY idx_time (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // mysqli::query TIDAK melempar exception bila CREATE gagal → wajib diverifikasi.
    $chk = $conn->query("SHOW TABLES LIKE 'service_reviews'");
    if (!$chk || $chk->num_rows === 0) return false;
    // Self-heal skema parsial (tabel dibuat manual dari reviews.sql versi awal):
    // lengkapi kolom yang kurang agar query penilaian tidak gagal lagi.
    $cols = [];
    $cr = $conn->query("SHOW COLUMNS FROM service_reviews");
    while ($cr && ($c = $cr->fetch_assoc())) $cols[] = $c['Field'];
    if (!in_array('service_key', $cols, true)) $conn->query("ALTER TABLE service_reviews ADD COLUMN service_key VARCHAR(32) NULL AFTER service_name");
    if (!in_array('review', $cols, true)) $conn->query("ALTER TABLE service_reviews ADD COLUMN review TEXT NULL");
    if (!in_array('stars', $cols, true)) $conn->query("ALTER TABLE service_reviews ADD COLUMN stars TINYINT NOT NULL DEFAULT 5");
    // Samakan collation dengan riwayat_pesanan (utf8mb4_unicode_ci) agar perbandingan
    // order_id tidak melempar "Illegal mix of collations" di hosting.
    $ts = $conn->query("SELECT TABLE_COLLATION c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'service_reviews'")->fetch_assoc()['c'] ?? '';
    if ($ts !== '' && $ts !== 'utf8mb4_unicode_ci') {
        $conn->query("ALTER TABLE service_reviews CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    }
    // Tabel penanda "banner sudah ditutup user" — disimpan server-side supaya penutupan
    // banner bertahan lintas refresh/perangkat dan pesanan tidak ditawarkan dua kali.
    $conn->query("CREATE TABLE IF NOT EXISTS service_reviews_dismissed (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        order_id   VARCHAR(64) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_order (user_id, order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    return true;
}

function rv_user_expr($conn) {
    static $expr = null;
    if ($expr !== null) return $expr;
    $has = false;
    try {
        $r = $conn->query("SHOW COLUMNS FROM users LIKE 'username'");
        $has = (bool)($r && $r->num_rows);
    } catch (Throwable $e) { $has = false; }
    return $expr = $has
        ? "CASE WHEN u.username IS NOT NULL AND u.username <> '' THEN u.username ELSE u.name END"
        : 'u.name';
}

function rv_user_id($conn, $token) {
    try {
        $st = cp_q($conn, 'SELECT user_id FROM sessions WHERE token = ? LIMIT 1', 's', (string)$token);
        $row = $st->get_result()->fetch_assoc();
        $st->close();
        return $row ? (int)$row['user_id'] : null;
    } catch (Throwable $e) { return null; }
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];
$action = (string)($in['action'] ?? '');

try {
    if (!rv_schema($conn)) {
        rv_log('schema gagal: tabel service_reviews tidak ada setelah CREATE');
        rv_out(['ok' => false, 'message' => 'Tabel service_reviews belum ada di database. Jalankan php-api/reviews.sql di MySQL (atau periksa izin CREATE akun database).'], 500);
    }
} catch (Throwable $e) {
    rv_log('schema exception: ' . $e->getMessage());
    rv_out(['ok' => false, 'message' => 'Tabel penilaian belum tersedia: ' . $e->getMessage()], 500);
}

/* ---------- daftar penilaian untuk Papan Penilaian (publik) ---------- */
if ($action === 'list') {
    $rows = [];
    try {
        $res = $conn->query("SELECT v.stars, v.review, v.service_name, v.service_key, UNIX_TIMESTAMP(v.created_at)*1000 AS created_at,
                                    COALESCE(" . rv_user_expr($conn) . ", CONCAT('User #', v.user_id)) AS username
                             FROM service_reviews v LEFT JOIN users u ON u.id = v.user_id
                             ORDER BY v.id DESC LIMIT 100");
        while ($res && ($r = $res->fetch_assoc())) {
            $rows[] = ['username' => (string)$r['username'], 'stars' => (int)$r['stars'], 'service_name' => (string)$r['service_name'],
                'service_key' => $r['service_key'] !== null && $r['service_key'] !== '' ? (string)$r['service_key'] : null,
                'review' => (string)($r['review'] ?? ''), 'created_at' => (int)$r['created_at']];
        }
    } catch (Throwable $e) { rv_log('list: ' . $e->getMessage()); rv_out(['ok' => false, 'message' => 'Gagal memuat penilaian: ' . $e->getMessage()], 500); }
    rv_out(['ok' => true, 'reviews' => $rows]);
}

/* ---------- aksi milik user login ---------- */
$uid = rv_user_id($conn, $in['token'] ?? '');
if (!$uid) rv_out(['ok' => false, 'message' => 'Login dulu untuk menilai pesanan.'], 401);

if ($action === 'pending') {
    $rows = [];
    try {
        $st = cp_q($conn, "SELECT r.order_id, r.service_name FROM riwayat_pesanan r
                           WHERE r.user_id = ? AND r.status = 'selesai'
                             AND (" . RV_TYPE_SQL . ") = 'smm'
                             AND NOT EXISTS (SELECT 1 FROM service_reviews v
                                    WHERE v.order_id COLLATE utf8mb4_unicode_ci = r.order_id COLLATE utf8mb4_unicode_ci)
                             AND NOT EXISTS (SELECT 1 FROM service_reviews_dismissed d
                                    WHERE d.user_id = r.user_id
                                      AND d.order_id COLLATE utf8mb4_unicode_ci = r.order_id COLLATE utf8mb4_unicode_ci)
                           ORDER BY r.id DESC LIMIT 10", 'i', $uid);
        $res = $st->get_result();
        while ($r = $res->fetch_assoc()) $rows[] = ['order_id' => (string)$r['order_id'], 'service_name' => (string)$r['service_name']];
        $st->close();
    } catch (Throwable $e) { rv_log('pending: ' . $e->getMessage()); rv_out(['ok' => false, 'message' => 'Gagal memuat pesanan selesai: ' . $e->getMessage()], 500); }
    rv_out(['ok' => true, 'orders' => $rows]);
}

/* ---------- tandai banner pesanan selesai sebagai ditutup (persisten per user) ---------- */
if ($action === 'dismiss') {
    $orderId = trim((string)($in['order_id'] ?? ''));
    if ($orderId === '' || mb_strlen($orderId) > 64) rv_out(['ok' => false, 'message' => 'Pesanan tidak valid.'], 400);
    try {
        cp_q($conn, 'INSERT IGNORE INTO service_reviews_dismissed (user_id, order_id) VALUES (?,?)', 'is', $uid, $orderId)->close();
    } catch (Throwable $e) {
        rv_log('dismiss: ' . $e->getMessage());
        rv_out(['ok' => false, 'message' => 'Gagal menyimpan penutupan banner: ' . $e->getMessage()], 500);
    }
    rv_out(['ok' => true]);
}

if ($action === 'submit') {
    $orderId = trim((string)($in['order_id'] ?? ''));
    $stars = (int)($in['stars'] ?? 0);
    $review = trim((string)($in['review'] ?? ''));
    if ($orderId === '' || mb_strlen($orderId) > 64) rv_out(['ok' => false, 'message' => 'Pesanan tidak valid.'], 400);
    if ($stars < 1 || $stars > 5) rv_out(['ok' => false, 'message' => 'Bintang harus 1 sampai 5.'], 400);
    if (mb_strlen($review) > 500) rv_out(['ok' => false, 'message' => 'Ulasan maksimal 500 karakter.'], 400);
    try {
        // Alias tabel WAJIB 'r': RV_TYPE_SQL merujuk r.order_id/r.service_name — tanpa alias
        // query melempar "Unknown column 'r.order_id'" lalu tertelan catch dan semua submit
        // balasya "Pesanan tidak ditemukan milik akun ini." padahal riwayatnya ada.
        $st = cp_q($conn, "SELECT r.order_id, r.service_name, r.status, (" . RV_TYPE_SQL . ") AS kind
                           FROM riwayat_pesanan r WHERE r.user_id = ? AND r.order_id = ? LIMIT 1", 'is', $uid, $orderId);
        $row = $st->get_result()->fetch_assoc();
        $st->close();
    } catch (Throwable $e) {
        rv_log('submit lookup: ' . $e->getMessage());
        rv_out(['ok' => false, 'message' => 'Gagal memeriksa pesanan: ' . $e->getMessage()], 500);
    }
    if (!$row) rv_out(['ok' => false, 'message' => 'Pesanan tidak ditemukan milik akun ini.'], 404);
    if ((string)$row['status'] !== 'selesai') rv_out(['ok' => false, 'message' => 'Penilaian dibuka setelah pesanan selesai.'], 409);
    if ((string)$row['kind'] !== 'smm') rv_out(['ok' => false, 'message' => 'Hanya pesanan layanan SMM (Server 1/2/3) yang dapat dinilai.'], 409);
    $key = null;
    try {
        $st = cp_q($conn, 'SELECT service_id FROM smm_order_profit WHERE order_id = ? AND user_id = ? LIMIT 1', 'si', $orderId, $uid);
        $k = $st->get_result()->fetch_assoc()['service_id'] ?? null;
        $st->close();
        if ($k !== null && $k !== '') $key = mb_substr((string)$k, 0, 32);
    } catch (Throwable $e) { /* tanpa kunci layanan: tombol pesan ulang membuka katalog */ }
    try {
        cp_q($conn, 'INSERT INTO service_reviews (user_id, order_id, service_name, service_key, stars, review) VALUES (?,?,?,?,?,?)',
            'isssis', $uid, $orderId, mb_substr((string)$row['service_name'], 0, 255), $key, $stars, $review === '' ? null : $review)->close();
    } catch (Throwable $e) {
        rv_out(['ok' => false, 'message' => 'Pesanan ini sudah pernah dinilai. Terima kasih!'], 409);
    }
    rv_out(['ok' => true, 'message' => 'Terima kasih! Penilaian Anda sudah tayang di Papan Penilaian.']);
}

rv_out(['ok' => false, 'message' => 'Aksi tidak dikenal.'], 400);
