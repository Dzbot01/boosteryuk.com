<?php
/**
 * smmgen_services.php — katalog Server 3 (SMMGen) untuk dropdown Buat Pesanan.
 * Upload ke: /api/smmgen_services.php. Key hanya di server; tarif sudah IDR/1000.
 */
header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Headers: Content-Type');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(204);exit;}
require_once __DIR__.'/smmgen_lib.php';
try{$services=smg_catalogue();echo json_encode(['ok'=>true,'services'=>$services]);}
catch(Throwable $e){http_response_code(503);echo json_encode(['ok'=>false,'message'=>$e->getMessage()]);}
