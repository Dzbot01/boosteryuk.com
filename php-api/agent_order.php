<?php
/**
 * agent_order.php — Order "Sewa Agen AI" dengan pemotongan saldo REAL di database.
 * Upload ke: https://boosteryuk.com/api/agent_order.php (satu folder dengan configdb.php,
 * agent_config.php). Format mengikuti order.php: token -> users, cek saldo, potong saldo,
 * simpan ke riwayat_pesanan. order.php TIDAK diubah.
 *
 * POST JSON: { token, tier: 'starter'|'medium'|'bisnis', months: 1..12, phone, nama, ewallet, toko, platform? }
 *   phone = nomor pemilik / nomor WhatsApp bot, nama = nama AI, ewallet & toko = fitur Store.
 * Resp     : { ok, orderId, status, new_balance, serviceName, price, dueDate }
 *
 * Alur:
 *  1. Validasi token (tabel sessions, belum kedaluwarsa) -> ambil user dari tabel users.
 *  2. Hitung harga DI SERVER dari paket x durasi (harga dari client diabaikan).
 *  3. Potong saldo secara atomik (UPDATE ... WHERE balance >= harga) -> anti saldo minus/double klik.
 *  4. Simpan riwayat_pesanan status 'pending'.
 *  5. Minta VPS (tunnel wa-origin) membuat sesi agen + kirim kode pairing ke email user.
 *     Gagal -> saldo DIKEMBALIKAN otomatis & riwayat diubah jadi 'batal'.
 *     Berhasil -> riwayat jadi 'proses'.
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

error_reporting(0);
require 'configdb.php'; // menyediakan $conn (mysqli) + getUserIdByToken()
require_once __DIR__ . '/riwayat_schema.php'; // kolom order_type, paket, durasi_bulan, jatuh_tempo, ...
require_once __DIR__ . '/agent_reminder.php';
require_once __DIR__ . '/child_panel_lib.php'; // markup harga child panel (subdomain) // jadwal email pengingat jatuh tempo (H-7/H-3/H-1/H)
if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

function reply($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(["ok" => false, "message" => "Gunakan POST"], 405);

$data   = json_decode(file_get_contents("php://input"), true) ?: [];
$token  = trim($data['token'] ?? '');
$tierId = strtolower(trim($data['tier'] ?? ''));
$months = (int)($data['months'] ?? 1);
$phone  = preg_replace('/\D/', '', $data['phone'] ?? '');
$nama   = mb_substr(trim($data['nama'] ?? ''), 0, 60);
$platform = strtolower(trim($data['platform'] ?? 'whatsapp'));
$ewallet = mb_substr(preg_replace('/[^\d+\- ]/', '', $data['ewallet'] ?? ''), 0, 30);
$toko    = mb_substr(trim(strip_tags($data['toko'] ?? '')), 0, 80);

/* ===== Harga paket (sumber kebenaran ada di server) ===== */
$TIERS = [
    'starter' => ['name' => 'Starter', 'price' => 10000, 'pg' => false],
    'medium'  => ['name' => 'Medium',  'price' => 35000, 'pg' => false],
    'bisnis'  => ['name' => 'Bisnis',  'price' => 75000, 'pg' => true],
];
if ($platform !== 'whatsapp') reply(["ok" => false, "message" => "Saat ini hanya Agen AI WhatsApp yang tersedia."], 400);
if (!isset($TIERS[$tierId])) reply(["ok" => false, "message" => "Paket tidak valid."], 400);
if ($months < 1 || $months > 12) reply(["ok" => false, "message" => "Durasi sewa 1–12 bulan."], 400);
if ($token === '' || strlen($phone) < 9) reply(["ok" => false, "message" => "Data wajib diisi (token & nomor WhatsApp)."], 400);
if ($nama === '') reply(["ok" => false, "message" => "Nama AI wajib diisi."], 400);

$tier  = $TIERS[$tierId];
$basePrice = (float)($tier['price'] * $months);
// Child panel: harga = harga dasar + markup panel (dihitung di server, tidak pernah di bawah harga dasar).
$tenant = null;
try { $tenant = cp_resolve($conn); } catch (Throwable $e) { $tenant = null; }
$price = cp_apply_markup($basePrice, $tenant, 'agent');

/* ===== 1. Token -> user ===== */
$user_id = function_exists('getUserIdByToken') ? getUserIdByToken($token) : null;
if (!$user_id) {
    // cadangan: sama seperti order.php
    $st = $conn->prepare("SELECT user_id FROM sessions WHERE token = ? LIMIT 1");
    $st->bind_param("s", $token);
    $st->execute();
    $user_id = $st->get_result()->fetch_assoc()['user_id'] ?? null;
    $st->close();
}
if (!$user_id) reply(["ok" => false, "message" => "Token tidak valid", "orderId" => null], 401);

$st = $conn->prepare("SELECT id, balance, name, email FROM users WHERE id = ? LIMIT 1");
$st->bind_param("i", $user_id);
$st->execute();
$user = $st->get_result()->fetch_assoc();
$st->close();
if (!$user) reply(["ok" => false, "message" => "User tidak ditemukan"], 401);
if (empty($user['email'])) reply(["ok" => false, "message" => "Email akun kosong — kode pairing tidak bisa dikirim."], 400);

/* ===== 2-3. Potong saldo secara atomik ===== */
$st = $conn->prepare("UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?");
$st->bind_param("did", $price, $user_id, $price);
$st->execute();
$charged = $st->affected_rows === 1;
$st->close();
if (!$charged) {
    reply(["ok" => false, "message" => "Saldo tidak cukup. Butuh Rp " . number_format($price, 0, ',', '.') . ", saldo Rp " . number_format((float)$user['balance'], 0, ',', '.'), "orderId" => null], 400);
}

/* ===== 4. Simpan riwayat (pending) ===== */
$orderId = 'AI' . time() . mt_rand(100, 999);
$due     = strtotime("+$months month");
$bulan   = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
$dueStr  = date('j', $due) . ' ' . $bulan[(int)date('n', $due)] . ' ' . date('Y', $due);
$serviceName = "Agen AI WhatsApp {$tier['name']} - Jatuh tempo $dueStr";
$status  = 'pending';

$dueSql = date('Y-m-d 23:59:59', $due);
$saved  = false;
if (riwayat_ensure_columns($conn)) {
    $type   = 'agent_ai';
    $paket  = $tier['name'];
    // Data form order (ditampilkan di halaman "Agen AI Saya")
    $detail = json_encode([
        'nama_ai'         => $nama,
        'nomor_pemilik'   => $phone,
        'ewallet'         => $ewallet,
        'nama_toko'       => $toko,
        'platform'        => $platform,
        'tier'            => $tierId,
        'payment_gateway' => $tier['pg'],
        'child_panel_id'  => $tenant['id'] ?? null,
        'harga_dasar'     => $basePrice,
    ], JSON_UNESCAPED_UNICODE);
    $st = $conn->prepare("INSERT INTO riwayat_pesanan
        (user_id, order_id, service_name, quantity, price, status, order_type, paket, durasi_bulan, jatuh_tempo, target, detail)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
    if ($st) {
        $st->bind_param("issidsssisss", $user_id, $orderId, $serviceName, $months, $price, $status,
            $type, $paket, $months, $dueSql, $phone, $detail);
        $saved = $st->execute();
        $st->close();
    }
}
if (!$saved) {
    // cadangan bila ALTER TABLE tidak diizinkan hosting: format kolom lama
    $st = $conn->prepare("INSERT INTO riwayat_pesanan (user_id, order_id, service_name, quantity, price, status) VALUES (?,?,?,?,?,?)");
    $st->bind_param("issids", $user_id, $orderId, $serviceName, $months, $price, $status);
    $saved = $st->execute();
    $st->close();
}
if (!$saved) {
    // riwayat gagal disimpan -> jangan biarkan saldo terpotong tanpa catatan
    $st = $conn->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
    $st->bind_param("di", $price, $user_id);
    $st->execute();
    $st->close();
    reply(["ok" => false, "message" => "Gagal menyimpan riwayat pesanan. Saldo dikembalikan.", "refunded" => true], 500);
}

function refund_and_fail($conn, $user_id, $price, $orderId, $msg) {
    $st = $conn->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
    $st->bind_param("di", $price, $user_id);
    $st->execute();
    $st->close();
    $batal = 'batal';
    $st = $conn->prepare("UPDATE riwayat_pesanan SET status = ? WHERE order_id = ? AND user_id = ?");
    $st->bind_param("ssi", $batal, $orderId, $user_id);
    $st->execute();
    $st->close();
    reply(["ok" => false, "message" => "$msg Saldo sudah dikembalikan.", "orderId" => $orderId, "refunded" => true], 502);
}

/* ===== 5. Minta VPS membuat sesi agen (via tunnel) ===== */
$AG_TOKEN  = getenv('AGENT_TOKEN') ?: '';
$AG_ORIGIN = getenv('AGENT_ORIGIN') ?: '';
if ((!$AG_TOKEN || !$AG_ORIGIN) && is_file(__DIR__ . '/agent_config.php')) {
    $cfg = include __DIR__ . '/agent_config.php';
    if (is_array($cfg)) {
        if (!$AG_TOKEN && !empty($cfg['token']))  $AG_TOKEN  = $cfg['token'];
        if (!$AG_ORIGIN && !empty($cfg['origin'])) $AG_ORIGIN = $cfg['origin'];
    }
}
if (!$AG_ORIGIN) $AG_ORIGIN = 'https://wa-origin.boosteryuk.com';
if (!$AG_TOKEN) refund_and_fail($conn, $user_id, $price, $orderId, "Server agen belum dikonfigurasi (agent_config.php).");

$payload = json_encode([
    'orderId' => $orderId,
    'phone'   => $phone,
    'email'   => $user['email'],
    'nama'    => $nama,
    'paket'   => "WhatsApp {$tier['name']}",
]);
$ch = curl_init(rtrim($AG_ORIGIN, '/') . '/session');
curl_setopt_array($ch, [
    CURLOPT_POST => 1,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 25,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-agent-token: ' . $AG_TOKEN],
]);
$resp = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$cerr = curl_error($ch);
curl_close($ch);
$vps = $resp ? json_decode($resp, true) : null;

if (!$vps || empty($vps['ok'])) {
    $why = $cerr ?: ($vps['message'] ?? "VPS HTTP $code");
    if ($code == 530) $why = 'Tunnel VPS belum aktif (Cloudflare 530).';
    refund_and_fail($conn, $user_id, $price, $orderId, "Gagal menyiapkan agen: $why.");
}

/* ===== Berhasil -> status proses ===== */
$proses = 'proses';
$st = $conn->prepare("UPDATE riwayat_pesanan SET status = ? WHERE order_id = ? AND user_id = ?");
$st->bind_param("ssi", $proses, $orderId, $user_id);
$st->execute();
$st->close();

// Child panel: pendapatan BELUM dicatat di sini. Dicatat setelah WhatsApp tertaut (riwayat 'selesai')
// oleh agent_lifecycle.php; bila waktu tautan habis, order 'batal' + saldo di-refund tanpa pendapatan.
if ($tenant) {
    try { cp_touch_activity($conn, $tenant['id'], $user_id, 'order'); } catch (Throwable $e) { /* abaikan */ }
}

$st = $conn->prepare("SELECT balance FROM users WHERE id = ? LIMIT 1");
$st->bind_param("i", $user_id);
$st->execute();
$new_balance = (float)($st->get_result()->fetch_assoc()['balance'] ?? 0);
$st->close();

// Jadwalkan email pengingat berdasarkan hitungan hari ke jatuh tempo (dijalankan setelah respons).
agent_reminder_after_response(fn() => agent_reminder_plan_order($conn, $orderId));

reply([
    "ok"          => true,
    "message"     => "Pesanan dibuat. Kode pairing dikirim ke email.",
    "orderId"     => $orderId,
    "status"      => $vps['status'] ?? 'starting',
    "new_balance" => $new_balance,
    "serviceName" => $serviceName,
    "price"       => $price,
    "dueDate"     => $dueStr,
    "jatuhTempo"  => $dueSql,
]);
