<?php
/**
 * riwayat_pesanan.php — riwayat SEMUA pesanan user (SMM, Sewa Agen AI, NexSpace, Nomor OTP, Upgrade).
 * Versi aman dari file lama (nama, cara panggil, dan format respons GET tetap sama):
 *   GET ?token=<token login>  → { ok, orders: [ { id, order_id, service_name, quantity, price, status, created_at (ms) } ] }
 *
 * Perubahan dibanding versi lama:
 *  1. Sesi kedaluwarsa ditolak (validasi lewat getUserIdByToken di configdb.php).
 *  2. Mode POST (menulis riwayat dari browser) DIMATIKAN: siapa pun yang login bisa memasukkan pesanan palsu
 *     dengan harga berapa pun. Riwayat sekarang ditulis server: order.php, agent_order.php, nexspace.php,
 *     otp.php, plan_upgrade.php. POST dibalas ok:true tanpa menyimpan agar versi web lama tidak error.
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
error_reporting(0);
require 'configdb.php';
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

$input = json_decode(file_get_contents("php://input"), true);
$token = trim((string)($input['token'] ?? $_GET['token'] ?? ''));
if ($token === '') { echo json_encode(["ok" => false, "message" => "Token kosong", "orders" => []]); exit; }

if (function_exists('getUserIdByToken')) {
    $user_id = getUserIdByToken($token);
} else {
    $stmt = $conn->prepare("SELECT user_id FROM sessions WHERE token = ? LIMIT 1");
    $stmt->bind_param("s", $token);
    $stmt->execute();
    $user_id = $stmt->get_result()->fetch_assoc()['user_id'] ?? null;
    $stmt->close();
}
if (!$user_id) { http_response_code(401); echo json_encode(["ok" => false, "message" => "Token tidak valid", "orders" => []]); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(["ok" => true, "message" => "Riwayat dicatat otomatis oleh server."]);
    exit;
}

try {
    // order_type ikut dikirim supaya klien mengenali pesanan top up game & PPOB
    // (bukan hanya dari awalan order_id). Kolomnya dibuat otomatis bila belum ada.
    if (is_file(__DIR__ . '/riwayat_schema.php')) require_once __DIR__ . '/riwayat_schema.php';
    $pakaiType = function_exists('riwayat_ensure_columns') && riwayat_ensure_columns($conn);
    $kolom = $pakaiType
        ? "id, order_id, service_name, quantity, price, status, order_type, UNIX_TIMESTAMP(created_at)*1000 AS created_at"
        : "id, order_id, service_name, quantity, price, status, UNIX_TIMESTAMP(created_at)*1000 AS created_at";
    $stmt = $conn->prepare("SELECT $kolom FROM riwayat_pesanan WHERE user_id = ? ORDER BY id DESC LIMIT 1000");
    $stmt->bind_param("i", $user_id);
    $stmt->execute();
    $orders = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    if (!$pakaiType) {
        try {
            $stmt = $conn->prepare("SELECT id, order_id, service_name, quantity, price, status, order_type, UNIX_TIMESTAMP(created_at)*1000 AS created_at
                                    FROM riwayat_pesanan WHERE user_id = ? ORDER BY id DESC LIMIT 1000");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $orders = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            $stmt->close();
        } catch (Throwable $e) { /* instalasi lama tanpa kolom order_type: pakai hasil di atas */ }
    }
    // user_id peminta ikut dibalas: klien (banner pesanan selesai) memakai ini untuk
    // memverifikasi cakupan — respons tanpa user_id yang cocok dianggap tidak terpercaya.
    $out = json_encode(["ok" => true, "user_id" => (int)$user_id, "orders" => $orders], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    $out = json_encode(["ok" => false, "message" => "Gagal memuat riwayat", "orders" => []]);
}
// Balas dulu, baru pengecekan status otomatis 1 jam sekali (tanpa cron) — user tidak menunggu provider.
header('Content-Length: ' . strlen($out));
header('Connection: close');
echo $out;
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request(); else { @ob_flush(); flush(); }
if (is_file(__DIR__ . '/order_status_lib.php')) require_once __DIR__ . '/order_status_lib.php';
if (function_exists('osx_sync_user_orders')) osx_sync_user_orders($conn, $user_id); // status user ini segar saat reload berikut
if (function_exists('osx_maybe_run')) osx_maybe_run($conn);
