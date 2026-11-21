<?php
ob_start();ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Access-Control-Allow-Headers: Content-Type');
function ea_out($r,$code=200){while(ob_get_level())ob_end_clean();http_response_code($code);echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
if($_SERVER['REQUEST_METHOD']==='OPTIONS')exit;
if($_SERVER['REQUEST_METHOD']!=='POST')ea_out(['ok'=>false,'message'=>'Gunakan POST.'],405);
set_exception_handler(function($e){error_log('event_access: '.$e->getMessage());ea_out(['ok'=>false,'message'=>'Akses event belum dapat diperiksa. Coba lagi nanti.'],503);});
require __DIR__.'/configdb.php';require_once __DIR__.'/event_access_lib.php';
$raw=file_get_contents('php://input');$in=json_decode($raw,true);if(!is_array($in)||strlen($raw)>4000)ea_out(['ok'=>false,'message'=>'Data tidak valid.'],400);
$uid=(int)cp_user_id($conn,$in['token']??'');if(!$uid)ea_out(['ok'=>false,'message'=>'Silakan login ulang.'],401);
$eid=(int)($in['event_id']??0);
$st=$eid>0?cp_q($conn,'SELECT * FROM site_events WHERE id=?','i',$eid):cp_q($conn,'SELECT * FROM site_events ORDER BY id');
$result=$st->get_result();$events=[];while($e=$result->fetch_assoc())$events[(string)$e['id']]=ea_access($conn,$uid,$e);$st->close();
if($eid>0 && !isset($events[(string)$eid]))ea_out(['ok'=>false,'message'=>'Event tidak ditemukan.'],404);
ea_out(['ok'=>true,'access'=>(object)$events]);
