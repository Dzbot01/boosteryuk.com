<?php
header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Headers: Content-Type');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(204);exit;}
require_once __DIR__.'/naizop_lib.php';
try{$c=n2_catalogue();echo json_encode(['ok'=>true,'services'=>$c['services'],'fx'=>$c['fx']]);}
catch(Throwable $e){http_response_code(503);echo json_encode(['ok'=>false,'message'=>$e->getMessage()]);}
