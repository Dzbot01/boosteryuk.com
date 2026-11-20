<?php
/**
 * callback.php — callback pembayaran Tripay (diteruskan Worker) → tambah saldo user.
 * Versi aman dari file lama (alur & respons sama):
 *  1. Secret dibaca dari callback_config.php (TIDAK di-commit) — tidak lagi ditulis di file ini.
 *  2. Anti dobel lewat tabel `deposits` (merchant_ref UNIK) dalam satu transaksi dengan penambahan saldo,
 *     bukan pencarian teks di file log → callback ganda/bersamaan tidak bisa menambah saldo dua kali.
 *  3. Setiap deposit tercatat di database → halaman Admin → Data Deposit & My Profit.
 *  tripay_raw.txt & tripay_log.txt tetap ditulis seperti sebelumnya (riwayat lama diimpor otomatis).
 * Format merchant_ref: BY-{ID_USER}-{RANDOM}, contoh BY-1-1712912345
 */
ini_set('display_errors', 0);
error_reporting(0);
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Callback-Secret, X-Callback-Signature");
header('Content-Type: application/json');
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') exit(0);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(["ok" => true, "msg" => "callback active - GET ok"]);
    exit;
}

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);
file_put_contents(__DIR__ . "/tripay_raw.txt", date("Y-m-d H:i:s") . " " . $raw . PHP_EOL, FILE_APPEND);

$cfg = is_file(__DIR__ . '/callback_config.php') ? (include __DIR__ . '/callback_config.php') : [];
$SECRET = (is_array($cfg) ? ($cfg['secret'] ?? '') : '') ?: (getenv('CALLBACK_SECRET') ?: '');
if ($SECRET === '') {
    http_response_code(500);
    echo json_encode(["ok" => false, "message" => "callback_config.php belum dibuat (secret kosong)"]);
    exit;
}
$headerSecret = $_SERVER['HTTP_X_CALLBACK_SECRET'] ?? '';
if (!hash_equals($SECRET, (string)$headerSecret)) {
    http_response_code(403);
    echo json_encode(["ok" => false, "message" => "Forbidden"]);
    exit;
}

$merchant_ref = mb_substr(trim((string)($data['merchant_ref'] ?? '')), 0, 80);
$status = strtoupper(trim((string)($data['status'] ?? '')));
$amount_callback = intval($data['amount_received'] ?? $data['amount'] ?? $data['total_amount'] ?? 0);

if ($merchant_ref === '' || $status !== 'PAID' || $amount_callback <= 0) {
    echo json_encode(["ok" => true, "message" => "ignore $status or invalid amount"]);
    exit;
}

$exp = explode("-", $merchant_ref);
$user_id = intval($exp[1] ?? 0);
if ($user_id <= 0) {
    echo json_encode(["ok" => false, "message" => "User ID not found in $merchant_ref"]);
    exit;
}

try {
    include __DIR__ . "/configdb.php";
} catch (Throwable $e) {
    echo json_encode(["ok" => false, "message" => "configdb error"]);
    exit;
}
if (!isset($conn) || $conn->connect_error) {
    echo json_encode(["ok" => false, "message" => "DB connect failed"]);
    exit;
}
require_once __DIR__ . '/deposit_lib.php';

try {
    dep_schema($conn);
    dep_import_log($conn); // riwayat lama dari tripay_log.txt → mencegah ref lama diproses ulang
    require_once __DIR__ . '/deposit_invoice_lib.php';
    di_ready($conn);
    $invoice = di_row($conn, $merchant_ref);
    if ($invoice) {
        // Secret authenticates the Worker; live Tripay detail verifies amount and identity.
        // Also accepts late PAID after local cancellation, exactly once via deposits ledger.
        $updated = di_sync($conn, $invoice, (string)($data['reference'] ?? ''));
        echo json_encode(['ok'=>true, 'message'=>'Invoice synchronized', 'status'=>$updated['status']]);
        exit;
    }

    $reference = mb_substr((string)($data['reference'] ?? ''), 0, 80);
    $method = mb_substr((string)($data['payment_method'] ?? $data['payment_method_code'] ?? ''), 0, 60) ?: null;

    $conn->begin_transaction();
    $st = $conn->prepare("INSERT IGNORE INTO deposits (merchant_ref, reference, user_id, amount, method, status, source, paid_at) VALUES (?,?,?,?,?, 'paid', 'tripay', NOW())");
    $amt = (float)$amount_callback;
    $st->bind_param("ssids", $merchant_ref, $reference, $user_id, $amt, $method);
    $st->execute();
    $isNew = $st->affected_rows === 1;
    $st->close();
    if (!$isNew) {
        $conn->rollback();
        echo json_encode(["ok" => true, "message" => "Already processed $merchant_ref"]);
        exit;
    }
    $st = $conn->prepare("UPDATE users SET balance = balance + ? WHERE id = ?");
    $st->bind_param("ii", $amount_callback, $user_id);
    $st->execute();
    $found = $st->affected_rows > 0;
    $st->close();
    if (!$found) {
        $conn->rollback();
        echo json_encode(["ok" => false, "message" => "User $user_id not found"]);
        exit;
    }
    $conn->commit();
} catch (Throwable $e) {
    try { $conn->rollback(); } catch (Throwable $e2) { /* abaikan */ }
    http_response_code(503);
    echo json_encode(["ok" => false, "message" => "Query fail; retry callback"]);
    exit;
}

file_put_contents(__DIR__ . "/tripay_log.txt", date("Y-m-d H:i:s") . " $merchant_ref $user_id +$amount_callback PAID\n", FILE_APPEND);
echo json_encode(["ok" => true, "message" => "Balance updated $user_id +$amount_callback", "balance_added" => $amount_callback]);
$conn->close();
