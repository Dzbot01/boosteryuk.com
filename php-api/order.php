<?php
/**
 * order.php — order layanan SMM (versi aman). Alur & respons SAMA dengan versi lama, ditambah:
 *  1. Harga dihitung SERVER (order_price.php): tarif provider + markup web/Plus + markup child panel.
 *     Harga kiriman browser hanya dipakai bila daftar layanan provider tidak bisa dimuat.
 *  2. Saldo dipotong ATOMIK (UPDATE ... WHERE balance >= harga) → tidak bisa minus / order ganda.
 *  3. Order lewat child panel langsung dicatat sebagai pendapatan panel di server.
 *  4. API key Resend TIDAK lagi ditulis di file ini → isi 'resend_key' di agent_config.php
 *     (atau env RESEND_API_KEY). Tanpa key, email dikirim lewat Worker email.
 * Membutuhkan: config.php ($API_ID, $API_KEY, $BASE_URL), configdb.php, order_price.php,
 * child_panel_lib.php (opsional, untuk child panel).
 */
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

error_reporting(0);

require 'config.php';
require 'configdb.php';
require_once __DIR__ . '/order_price.php';

$data = json_decode(file_get_contents("php://input"), true);

$token    = trim($data['token'] ?? '');
$service  = trim($data['serviceId'] ?? $data['service'] ?? '');
$link     = trim($data['target'] ?? $data['link'] ?? '');
$quantity = (int)($data['quantity'] ?? 0);
$comments = trim($data['comments'] ?? '');
$clientPrice = floatval($data['price'] ?? 0);
$serviceName = mb_substr(strip_tags(trim($data['serviceName'] ?? $service)), 0, 255);

if($token === '' || $service === '' || $link === '' || $quantity <= 0){
    http_response_code(400);
    echo json_encode(["ok" => false, "message" => "Data wajib diisi", "orderId" => null]);
    exit;
}

// 1. CEK TOKEN + AMBIL NAMA EMAIL (sesi harus belum kedaluwarsa bila kolom expires_at ada)
$stmt = $conn->prepare("SELECT u.id, u.balance, u.name, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? LIMIT 1");
$stmt->bind_param("s", $token);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();
if(!$user || (function_exists('getUserIdByToken') && !getUserIdByToken($token))){
    http_response_code(401);
    echo json_encode(["ok" => false, "message" => "Token tidak valid", "orderId" => null]);
    exit;
}
$user_id = (int)$user['id'];

// 2. HARGA DARI SERVER
$calc = bk_order_price($conn, $user_id, $service, $quantity, $API_ID, $API_KEY, $BASE_URL);
$price = $calc['price'];
if ($price === null && !empty($calc['unknown'])) {
    http_response_code(400);
    echo json_encode(["ok" => false, "message" => "Layanan tidak tersedia. Muat ulang halaman lalu pilih layanan lagi.", "orderId" => null]);
    exit;
}
if ($price === null) {
    // Tarif tidak bisa diverifikasi (provider tidak membalas daftar layanan) → cadangan: harga kiriman.
    $price = $clientPrice;
    @file_put_contents(__DIR__ . '/order_price_log.txt', date('Y-m-d H:i:s') . " UNVERIFIED service=$service qty=$quantity price=$clientPrice user=$user_id\n", FILE_APPEND);
} elseif ($clientPrice > 0 && $price > $clientPrice + 1) {
    // Harga naik sejak halaman dibuka → jangan potong lebih dari yang dilihat user.
    http_response_code(409);
    echo json_encode(["ok" => false, "message" => "Harga layanan berubah menjadi Rp " . number_format($price, 0, ',', '.') . ". Muat ulang halaman lalu pesan lagi.", "orderId" => null]);
    exit;
}
if ($price <= 0) {
    http_response_code(400);
    echo json_encode(["ok" => false, "message" => "Harga tidak valid", "orderId" => null]);
    exit;
}

// 3. POTONG SALDO ATOMIK (gagal bila saldo kurang — termasuk saat 2 order dikirim bersamaan)
$stmt = $conn->prepare("UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?");
$stmt->bind_param("did", $price, $user_id, $price);
$stmt->execute();
$paid = $stmt->affected_rows === 1;
$stmt->close();
if(!$paid){
    http_response_code(400);
    echo json_encode(["ok" => false, "message" => "Saldo profil tidak cukup. Saldo: Rp ".number_format((float)$user['balance'],0,',','.'), "orderId" => null]);
    exit;
}
$stmt = $conn->prepare("SELECT balance FROM users WHERE id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$new_balance = (float)$stmt->get_result()->fetch_assoc()['balance'];
$stmt->close();

$provider_order_id = null;
$final_status = 'pending';
$provider_msg = 'Order masuk antrian. Menunggu eksekusi provider.';

// 4. KIRIM KE PROVIDER
$postFields = [
    'api_id'   => (int)$API_ID,
    'api_key'  => $API_KEY,
    'service'  => (int)$service,
    'target'   => $link,
    'quantity' => (int)$quantity,
];
if($comments !== '') $postFields['comments'] = $comments;

$ch = curl_init($BASE_URL . 'order');
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postFields));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
$response = curl_exec($ch);
$curl_error = curl_error($ch);
curl_close($ch);
// LOG DEBUG (tanpa api_key)
$logReq = $postFields; unset($logReq['api_key']);
file_put_contents('fayu_log.txt', date('Y-m-d H:i:s')."\nREQ: ".json_encode($logReq)."\nRES: ".$response."\n\n", FILE_APPEND);
$parsed = json_decode($response, true);

// 5. HASIL PROVIDER
if(!$curl_error && is_array($parsed) && ($parsed['status'] ?? false) === true){
    $provider_order_id = isset($parsed['order']) ? (string)$parsed['order'] : null;
    $provider_msg = $parsed['msg'] ?? $parsed['message'] ?? 'Order berhasil ke provider';
} else {
    $provider_order_id = 'PENDING-' . time() . '-' . $user_id;
    $provider_msg = 'Saldo provider kosong. Order masuk antrian manual. ' . ($parsed['msg'] ?? $curl_error);
}
if (!$provider_order_id) $provider_order_id = 'ORD-' . time() . '-' . $user_id;

// 6. SIMPAN RIWAYAT
$stmt = $conn->prepare("INSERT INTO riwayat_pesanan (user_id, order_id, service_name, quantity, price, status) VALUES (?,?,?,?,?,?)");
$stmt->bind_param("issids", $user_id, $provider_order_id, $serviceName, $quantity, $price, $final_status);
$stmt->execute();
$stmt->close();

// 6b. CHILD PANEL: catat pendapatan panel (harga dibayar − harga web utama) di server.
if (!empty($calc['tenant']) && $calc['base'] !== null && function_exists('cp_record_order')) {
    try {
        cp_ensure_schema($conn);
        cp_record_order($conn, (int)$calc['tenant']['id'], $user_id, $provider_order_id, 'smm', $serviceName, $quantity, $price, $calc['base']);
    } catch (Throwable $e) { /* pencatatan gagal tidak membatalkan order */ }
}

// 7. EMAIL NOTIFIKASI
function orderResendKey(){
    $k = getenv('RESEND_API_KEY') ?: '';
    if (!$k && is_file(__DIR__ . '/agent_config.php')) {
        $cfg = include __DIR__ . '/agent_config.php';
        if (is_array($cfg) && !empty($cfg['resend_key'])) $k = $cfg['resend_key'];
    }
    return $k;
}
function sendResendEmail($to, $subject, $html){
    $FROM = "Boosteryuk <no-reply@cekidku.my.id>";
    $key = orderResendKey();
    if ($key) {
        $url = 'https://api.resend.com/emails';
        $payload = json_encode(["from" => $FROM, "to" => [$to], "subject" => $subject, "html" => $html]);
        $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $key];
    } else {
        $url = 'https://boosteryuk.boosteryukid.workers.dev/api/email/send';
        $payload = json_encode(["from" => $FROM, "to" => $to, "subject" => $subject, "html" => $html]);
        $headers = ['Content-Type: application/json'];
    }
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    @curl_exec($ch);
    curl_close($ch);
}

function emailTemplate($type, $data){
    $e = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $formatRupiah = function($val){ return "Rp " . number_format($val,0,',','.'); };
    $waktu = date('d F Y H:i', strtotime('+7 hours'));
    if($type == 'admin'){ return '<div style="font-family: Arial, sans-serif; width: 100%; background: #f0f2f5; padding: 20px 0;"><table width="800" align="center" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden;"><tr><td style="background: linear-gradient(90deg, #dc2626, #ef4444); color: white; padding: 30px 40px;"><h1 style="margin: 0; font-size: 26px;">🚨 NOTIFIKASI ORDER BARU</h1><p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Boosteryuk.id System</p></td></tr><tr><td style="padding: 40px;"><p style="color: #333; font-size: 15px;">Halo Admin,</p><p style="color: #555; font-size: 15px;">Ada pesanan baru masuk. Detail:</p><table width="100%" cellpadding="12" style="border: 1px solid #e5e7eb; border-radius: 8px; margin: 25px 0; background: #fef2f2;"><tr style="background: #fee2e2;"><td colspan="2" style="font-weight: bold; color: #b91c1c;">DETAIL PESAN</td></tr><tr><td width="200"><b>ID Order</b></td><td>#'.$e($data['order_id']).'</td></tr><tr style="background: #fff;"><td><b>Nama User</b></td><td>'.$e($data['user_name']).'</td></tr><tr><td><b>Email User</b></td><td>'.$e($data['user_email']).'</td></tr><tr style="background: #fff;"><td><b>Layanan</b></td><td>'.$e($data['service_name']).'</td></tr><tr><td><b>Target</b></td><td>'.$e($data['target']).'</td></tr><tr style="background: #fff;"><td><b>Jumlah</b></td><td>'.number_format($data['quantity']).'</td></tr><tr><td><b>Total Harga</b></td><td style="font-weight: bold;">'.$formatRupiah($data['price']).'</td></tr><tr style="background: #fff;"><td><b>Status</b></td><td style="color: #dc2626; font-weight: bold;">'.strtoupper($data['status']).'</td></tr><tr><td><b>Waktu</b></td><td>'.$waktu.' WIB</td></tr></table><div style="text-align: center;"><a href="https://cekidku.my.id/admin" style="background: #dc2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Buka Panel Admin</a></div></td></tr></table></div>';
    } else { return '<div style="font-family: Arial, sans-serif; width: 100%; background: #f0f2f5; padding: 20px 0;"><table width="800" align="center" cellpadding="0" cellspacing="0" style="background: #ffffff; border-radius: 8px; overflow: hidden;"><tr><td style="background: linear-gradient(90deg, #48C6E5, #06b6d4); color: white; padding: 30px 40px;"><h1 style="margin: 0; font-size: 26px;">✅ PESANAN DITERIMA</h1><p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Boosteryuk.id</p></td></tr><tr><td style="padding: 40px;"><p style="color: #333; font-size: 15px;">Halo '.$e($data['user_name']).',</p><p style="color: #555; font-size: 15px;">Terima kasih telah melakukan pemesanan. Pesanan kamu sudah kami terima.</p><table width="100%" cellpadding="12" style="border: 1px solid #e5e7eb; border-radius: 8px; margin: 25px 0; background: #f0f9fd;"><tr style="background: #e0f2fe;"><td colspan="2" style="font-weight: bold; color: #0369a1;">RINCIAN PESANAN</td></tr><tr><td width="200"><b>ID Order</b></td><td>#'.$e($data['order_id']).'</td></tr><tr style="background: #fff;"><td><b>Layanan</b></td><td>'.$e($data['service_name']).'</td></tr><tr><td><b>Target</b></td><td>'.$e($data['target']).'</td></tr><tr style="background: #fff;"><td><b>Jumlah</b></td><td>'.number_format($data['quantity']).'</td></tr><tr><td><b>Total Bayar</b></td><td style="font-weight: bold;">'.$formatRupiah($data['price']).'</td></tr><tr style="background: #fff;"><td><b>Status</b></td><td style="color: #059669; font-weight: bold;">'.strtoupper($data['status']).'</td></tr></table><p style="color: #555; font-size: 15px;">Saldo kamu sudah dipotong. Jika status `PENDING`, berarti sedang antri ke provider.</p><div style="text-align: center;"><a href="https://cekidku.my.id/history" style="background: #48C6E5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">Cek Status Pesanan</a></div></td></tr><tr><td style="text-align: center; padding: 20px; color: #aaa; font-size: 12px; background: #f9fafb;">© 2026 Boosteryuk.id. cekidku.my.id</td></tr></table></div>';
    }
}

$emailData = [
    "order_id" => $provider_order_id, "user_name" => $user['name'], "user_email" => $user['email'],
    "service_name" => $serviceName, "target" => $link, "quantity" => $quantity, "price" => $price, "status" => $final_status
];

// 8. BALAS DULU, lalu kirim email (tombol order tidak menunggu email)
$out = json_encode(["ok" => true, "message" => $provider_msg, "orderId" => $provider_order_id, "new_balance" => $new_balance, "price" => $price]);
ignore_user_abort(true);
header('Content-Length: ' . strlen($out));
header('Connection: close');
echo $out;
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request(); else { @ob_flush(); flush(); }

sendResendEmail($user['email'], "✅ Pesanan #$provider_order_id Berhasil Dibuat", emailTemplate('user', $emailData));
sendResendEmail("boosteryukid@gmail.com", "🚨 Order Baru #$provider_order_id", emailTemplate('admin', $emailData));
$conn->close();
