<?php
/**
 * medanpedia_refill.php — refill & cek status refill Server 3 (publik, key di server).
 * Upload ke: /api/medanpedia_refill.php.
 *
 * POST {action:"refill"|"refill_status", id:"S3-123"} ->
 *   { status:true, msg, refill?, refill_status? }  (bentuk sama dengan reffil.php Server 1)
 * Menerima ID S3- dan ID angka polos (alur auto-deteksi coba satu persatu).
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
require_once __DIR__ . '/medanpedia_lib.php';

$in = json_decode(file_get_contents('php://input'), true);
$action = (string)($in['action'] ?? 'refill');
if (!in_array($action, ['refill', 'refill_status'], true)) { http_response_code(400); echo json_encode(['status' => false, 'msg' => 'Action tidak valid.']); exit; }
$id = trim((string)($in['id'] ?? ''));
$num = preg_match('/^S3-([0-9]+)$/', $id, $m) ? $m[1] : (preg_match('/^[0-9]+$/', $id) ? $id : '');
if ($num === '') { echo json_encode(['status' => false, 'msg' => 'Gunakan ID pesanan Server 3.']); exit; }

try {
    $path = $action === 'refill' ? 'refill' : 'refill_status';
    $parsed = mp_call($path, ['order' => $num], true);
    if (($parsed['status'] ?? null) === false) {
        echo json_encode(['status' => false, 'msg' => (string)($parsed['msg'] ?? ($action === 'refill' ? 'Refill belum tersedia.' : 'Refill tidak ditemukan.'))]);
        exit;
    }
    $data = is_array($parsed['data'] ?? null) ? $parsed['data'] : $parsed;
    echo json_encode([
        'status' => true,
        'msg' => (string)($parsed['msg'] ?? ($action === 'refill' ? 'Permintaan refill berhasil dibuat.' : 'Refill ditemukan.')),
        'refill' => $data['refill'] ?? $data['refill_id'] ?? null,
        'refill_status' => is_string($data['refill_status'] ?? null) ? $data['refill_status'] : null,
    ]);
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['status' => false, 'msg' => 'Server 3 belum dapat dihubungi untuk refill.']);
}
