<?php
/**
 * smmgen_refill.php — refill & cek status refill Server 3 (SMMGen); key di server.
 * Upload ke: /api/smmgen_refill.php.
 *
 * POST {action:"refill", id:"S4-123"}      -> { status:true, msg, refill }
 * POST {action:"refill_status", id:"<id>"} -> { status:true, msg, refill_status }
 * Menerima ID S4- dan ID angka polos (alur auto-deteksi coba satu persatu).
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
require_once __DIR__ . '/smmgen_lib.php';

$in = json_decode(file_get_contents('php://input'), true);
$action = (string)($in['action'] ?? 'refill');
if (!in_array($action, ['refill', 'refill_status'], true)) { http_response_code(400); echo json_encode(['status' => false, 'msg' => 'Action tidak valid.']); exit; }
$id = trim((string)($in['id'] ?? ''));
$num = preg_match('/^S4-([0-9]+)$/', $id, $m) ? $m[1] : (preg_match('/^[0-9]+$/', $id) ? $id : '');
if ($num === '') { echo json_encode(['status' => false, 'msg' => 'Gunakan ID pesanan/refill Server 3.']); exit; }

try {
    if ($action === 'refill') {
        $parsed = smg_call('refill', ['order' => $num]);
        echo json_encode([
            'status' => true,
            'msg' => 'Permintaan refill berhasil dibuat.',
            'refill' => $parsed['refill'] ?? null,
            'refill_status' => null,
        ]);
    } else {
        $parsed = smg_call('refill_status', ['refill' => $num]);
        echo json_encode([
            'status' => true,
            'msg' => 'Refill ditemukan.',
            'refill' => $parsed['refill'] ?? $num,
            'refill_status' => is_string($parsed['status'] ?? null) ? $parsed['status'] : null,
        ]);
    }
} catch (SmgReject $e) {
    echo json_encode(['status' => false, 'msg' => $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['status' => false, 'msg' => 'Server 3 belum dapat dihubungi untuk refill.']);
}
