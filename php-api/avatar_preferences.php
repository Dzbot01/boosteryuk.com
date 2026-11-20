<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
function av_out($data,$status=200){http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE);exit;}
set_exception_handler(function($e){av_out(['ok'=>false,'message'=>'Preferensi avatar belum dapat diproses. Coba lagi nanti.'],500);});
if ($_SERVER['REQUEST_METHOD'] !== 'POST') av_out(['ok'=>false,'message'=>'Gunakan POST.'],405);
require __DIR__.'/configdb.php';
require_once __DIR__.'/child_panel_lib.php';
$in=json_decode(file_get_contents('php://input'),true);
if(!is_array($in))av_out(['ok'=>false,'message'=>'Data tidak valid.'],400);
$uid=cp_user_id($conn,$in['token']??'');
if(!$uid)av_out(['ok'=>false,'message'=>'Silakan login ulang.'],401);
$conn->query("CREATE TABLE IF NOT EXISTS user_avatar_preferences (user_id INT PRIMARY KEY, avatar_variant VARCHAR(8) NOT NULL DEFAULT 'male', updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$action=$in['action']??'get';
if($action==='save'){
 $variant=$in['avatar_variant']??'';
 if(!in_array($variant,['male','female'],true))av_out(['ok'=>false,'message'=>'Pilihan avatar tidak valid.'],400);
 cp_q($conn,'INSERT INTO user_avatar_preferences (user_id,avatar_variant) VALUES (?,?) ON DUPLICATE KEY UPDATE avatar_variant=VALUES(avatar_variant)','is',(int)$uid,$variant)->close();
}elseif($action!=='get')av_out(['ok'=>false,'message'=>'Aksi tidak valid.'],400);
$st=cp_q($conn,'SELECT avatar_variant FROM user_avatar_preferences WHERE user_id=?','i',(int)$uid);
$row=$st->get_result()->fetch_assoc();$st->close();
av_out(['ok'=>true,'avatar_variant'=>$row['avatar_variant']??'male']);
