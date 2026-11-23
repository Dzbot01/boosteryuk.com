<?php
/**
 * medanpedia_services.php — endpoint PUBLIK Server 3 untuk dashboard & jalur keranjang.
 * Upload ke: /api/medanpedia_services.php (satu folder dengan configdb.php).
 *
 * POST/OPTIONS { } -> { ok:true, categories:[...], services:[...] }
 * Hanya kategori & layanan "Google Maps Review" yang dikembalikan; katalog penuh
 * Server 3 sengaja TIDAK dipublikasikan (sesuai permintaan: belum ditampilkan umum).
 * Key API tidak pernah keluar dari server.
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
require_once __DIR__ . '/medanpedia_lib.php';
try {
    $g = mp_gm_review();
    echo json_encode(['ok' => true, 'categories' => $g['categories'], 'services' => $g['services']]);
} catch (Throwable $e) {
    http_response_code(503);
    echo json_encode(['ok' => false, 'message' => $e->getMessage()]);
}
