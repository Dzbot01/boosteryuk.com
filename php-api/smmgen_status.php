<?php
/**
 * smmgen_status.php — cek status pesanan Server 3 (SMMGen); bentuk sama dengan
 * naizop_status.php/medanpedia_status.php supaya auto-deteksi Cek Status bekerja.
 * Upload ke: /api/smmgen_status.php.
 *
 * POST {id:"S4-123,456"} -> { status:true, orders:{ "S4-123": {order_status,start_count,remains,charge?,msg} } }
 * Menerima ID berprefix S4- (termasuk S4-PENDING-…) dan ID angka polos untuk alur
 * auto-deteksi "coba satu persatu". Bila pesanan tidak ada di Server 3, balasan
 * status:false agar pemanggil lanjut mencoba server lain.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
require_once __DIR__ . '/smmgen_lib.php';

$in = json_decode(file_get_contents('php://input'), true);
$ids = array_filter(array_map('trim', explode(',', (string)($in['id'] ?? ''))), 'strlen');
if (!$ids || count($ids) > 100) { http_response_code(400); echo json_encode(['status' => false, 'msg' => 'ID tidak valid.']); exit; }

$out = []; $numeric = [];
foreach ($ids as $id) {
    if (preg_match('/^S4-([0-9]+)$/', $id, $m)) $numeric[$id] = $m[1];
    elseif (preg_match('/^[0-9]+$/', $id)) $numeric[$id] = $id; // auto-deteksi: ID polos
    elseif (preg_match('/^S4-PENDING-[a-f0-9]{16}$/', $id)) $out[$id] = ['order_status' => 'pending', 'msg' => 'Menunggu pemeriksaan pengiriman oleh admin.'];
    else { http_response_code(400); echo json_encode(['status' => false, 'msg' => 'Format ID tidak dikenali Server 3.']); exit; }
}

try {
    if ($numeric) {
        $nums = array_values($numeric);
        $parsed = count($nums) === 1 ? smg_call('status', ['order' => $nums[0]]) : smg_call('status', ['orders' => implode(',', $nums)]);
        $entries = [];
        if (isset($parsed['order_status']) || (isset($parsed['status']) && is_string($parsed['status']))) $entries = [$nums[0] => $parsed];
        else foreach ($numeric as $id => $providerId) {
            $entry = $parsed[$providerId] ?? $parsed[(int)$providerId] ?? null;
            if (is_array($entry)) $entries[$providerId] = $entry;
        }
        foreach ($numeric as $id => $providerId) {
            $entry = $entries[$providerId] ?? null;
            if (is_array($entry) && (isset($entry['order_status']) || (isset($entry['status']) && is_string($entry['status'])))) {
                $row = [
                    'order_status' => strtolower((string)($entry['order_status'] ?? $entry['status'])),
                    'start_count' => $entry['start_count'] ?? null,
                    'remains' => $entry['remains'] ?? null,
                    'msg' => 'Status Server 3.',
                ];
                if (isset($entry['charge']) && is_numeric($entry['charge'])) $row['charge'] = (float)$entry['charge'];
                $out[$id] = $row;
            } else {
                $out[$id] = ['msg' => is_array($entry) ? (string)($entry['error'] ?? 'Pesanan tidak ditemukan di Server 3.') : 'Pesanan tidak ditemukan di Server 3.'];
            }
        }
    }
    echo json_encode(['status' => true, 'orders' => (object)$out]);
} catch (SmgReject $e) {
    // Penolakan eksplisit (mis. order tidak dikenal): biarkan auto-deteksi lanjut ke server lain.
    echo json_encode(['status' => false, 'msg' => $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['status' => false, 'msg' => 'Status Server 3 belum dapat dimuat.']);
}
