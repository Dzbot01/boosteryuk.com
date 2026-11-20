<?php
header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Access-Control-Allow-Headers: Content-Type');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(204);exit;}
function eg_out($data,$code=200){http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
set_exception_handler(function($e){if(isset($GLOBALS['conn']))try{$GLOBALS['conn']->rollback();}catch(Throwable $ignore){}eg_out(['ok'=>false,'message'=>'Transaksi game belum dapat diproses. Periksa API/database lalu coba lagi.'],500);});
if($_SERVER['REQUEST_METHOD']!=='POST')eg_out(['ok'=>false,'message'=>'Gunakan POST.'],405);
require __DIR__.'/configdb.php';require_once __DIR__.'/child_panel_lib.php';require_once __DIR__.'/event_game_lib.php';require_once __DIR__.'/riwayat_schema.php';
$conn->set_charset('utf8mb4');
$raw=file_get_contents('php://input');$in=json_decode($raw,true);if(!is_array($in)||strlen($raw)>30000)eg_out(['ok'=>false,'message'=>'Data game tidak valid.'],400);
$uid=cp_user_id($conn,$in['token']??'');if(!$uid)eg_out(['ok'=>false,'message'=>'Silakan login ulang.'],401);
$eid=(int)($in['event_id']??0);$action=$in['action']??'';
if(!in_array($action,['get','save','buy','use','leaderboard'],true))eg_out(['ok'=>false,'message'=>'Aksi tidak valid.'],400);
// Existing event management remains authoritative; no event/price from the HTML is trusted.
$st=cp_q($conn,'SELECT * FROM site_events WHERE id=?','i',$eid);$event=$st->get_result()->fetch_assoc();$st->close();
if(!$event || $event['kind']!=='game')eg_out(['ok'=>false,'message'=>'Game event tidak ditemukan.'],404);
$active=$event['status']!=='finished' && (!$event['starts_at']||strtotime($event['starts_at'].' UTC')<=time()) && (!$event['ends_at']||strtotime($event['ends_at'].' UTC')>time()) && ($event['status']==='ongoing'||$event['starts_at']);
if(!$active)eg_out(['ok'=>false,'message'=>'Event belum dimulai atau sudah selesai.'],403);
eg_schema($conn);
if($action==='buy') {
 // Refuse non-transactional tables: a history failure must roll back real money as well.
 foreach(['users','riwayat_pesanan','event_game_players','event_game_receipts'] as $table){$st=cp_q($conn,'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?','s',$table);$engine=$st->get_result()->fetch_assoc()['ENGINE']??'';$st->close();if(strtoupper($engine)!=='INNODB')eg_out(['ok'=>false,'message'=>'Pembelian dinonaktifkan: tabel transaksi harus InnoDB.'],503);}
 if(!riwayat_ensure_columns($conn))eg_out(['ok'=>false,'message'=>'Skema riwayat perlu diperbarui sebelum pembelian game.'],503);
}
if($action==='leaderboard'){
 $st=cp_q($conn,'SELECT user_id, state_json FROM event_game_players WHERE event_id=? AND state_json IS NOT NULL ORDER BY score DESC,user_id ASC LIMIT 100','i',$eid);$result=$st->get_result();$rows=[];
 while($r=$result->fetch_assoc()){$s=json_decode($r['state_json'],true);$rows[]=['uid'=>(string)$r['user_id'],'user'=>$s['user'],'score'=>$s['score'],'platform'=>'instagram'];}$st->close();eg_out(['ok'=>true,'rows'=>$rows,'verified'=>false]);
}
$conn->begin_transaction();
try {
 $st=cp_q($conn,'SELECT balance FROM users WHERE id=? FOR UPDATE','i',(int)$uid);$u=$st->get_result()->fetch_assoc();$st->close();if(!$u)throw new Exception('Akun tidak ditemukan.');
 cp_q($conn,"INSERT IGNORE INTO event_game_players (event_id,user_id,inventory,bonus) VALUES (?,?,'{}','{\"f\":0,\"l\":0,\"v\":0,\"c\":0}')",'ii',$eid,(int)$uid)->close();
 $st=cp_q($conn,'SELECT * FROM event_game_players WHERE event_id=? AND user_id=? FOR UPDATE','ii',$eid,(int)$uid);$row=$st->get_result()->fetch_assoc();$st->close();
 $inv=json_decode($row['inventory'],true);$bonus=json_decode($row['bonus'],true);$order=null;
 if($action==='save'){
  if((int)($in['revision']??-1)!==(int)$row['revision']){ $conn->rollback();eg_out(['ok'=>false,'message'=>'Progres berubah di tab/perangkat lain. Muat ulang game.'],409); }
  $state=eg_normalize($in['state']??null);$previous=json_decode($row['state_json']??'null',true);
  if(!empty($previous['done'])){ $conn->commit();eg_out(['ok'=>true]+eg_payload($row,$u['balance'])); }
  cp_q($conn,'UPDATE event_game_players SET state_json=?,score=?,revision=revision+1 WHERE event_id=? AND user_id=?','siii',json_encode($state,JSON_UNESCAPED_UNICODE),$state['score'],$eid,(int)$uid)->close();
 }
 if($action==='buy'||$action==='use'){
  $request=(string)($in['request_id']??'');if(!preg_match('/^[a-f0-9-]{16,64}$/D',$request))throw new Exception('ID transaksi tidak valid.');
  $cart=[];$amount=0;$item='';
  if($action==='buy')[$cart,$amount]=eg_cart($in['cart']??null);
  else {$item=(string)($in['item_id']??'');if(!isset(EG_PRODUCTS[$item]))throw new Exception('Item tidak valid.');}
  $hash=hash('sha256',json_encode([$action,$cart,$item]));
  $st=cp_q($conn,'SELECT * FROM event_game_receipts WHERE event_id=? AND user_id=? AND request_id=?','iis',$eid,(int)$uid,$request);$receipt=$st->get_result()->fetch_assoc();$st->close();
  if($receipt){if(!hash_equals($receipt['request_hash'],$hash))throw new Exception('ID transaksi sudah dipakai untuk permintaan lain.');$order=$receipt['order_id'];}
  else {
   if($action==='buy'){
    if(($in['confirm_real_balance']??false)!==true)throw new Exception('Konfirmasi penggunaan saldo website diperlukan.');
    $st=cp_q($conn,'UPDATE users SET balance=balance-? WHERE id=? AND balance>=?','did',$amount,(int)$uid,$amount);$changed=$st->affected_rows;$st->close();if($changed!==1)throw new Exception('Saldo website tidak cukup.');
    $u['balance']-=$amount;$order='EVG'.strtoupper(bin2hex(random_bytes(12)));$names=[];$qty=0;
    foreach($cart as $id=>$n){$inv[$id]=($inv[$id]??0)+$n;$qty+=$n;$names[]=EG_PRODUCTS[$id]['name'].' x'.$n;}
    $service='Event Merchant: '.implode(', ',$names);$detail=json_encode(['event_id'=>$eid,'cart'=>$cart,'request_id'=>$request,'note'=>'Item virtual game; bukan followers/like akun sosial asli.']);
    cp_q($conn,"INSERT INTO riwayat_pesanan (user_id,order_id,service_name,quantity,price,status,order_type,detail) VALUES (?,?,?,?,?,'selesai','event',?)",'issids',(int)$uid,$order,$service,$qty,$amount,$detail)->close();
   }else{if(empty($inv[$item]))throw new Exception('Item tidak tersedia.');$inv[$item]--;$p=EG_PRODUCTS[$item];$bonus[$p['kind']]=($bonus[$p['kind']]??0)+$p['amount'];}
   cp_q($conn,'UPDATE event_game_players SET inventory=?,bonus=? WHERE event_id=? AND user_id=?','ssii',json_encode((object)$inv),json_encode((object)$bonus),$eid,(int)$uid)->close();
   cp_q($conn,'INSERT INTO event_game_receipts (event_id,user_id,request_id,request_hash,action,order_id,amount) VALUES (?,?,?,?,?,?,?)','iissssd',$eid,(int)$uid,$request,$hash,$action,$order,$amount)->close();
  }
 }
 $st=cp_q($conn,'SELECT * FROM event_game_players WHERE event_id=? AND user_id=?','ii',$eid,(int)$uid);$row=$st->get_result()->fetch_assoc();$st->close();$conn->commit();
 eg_out(['ok'=>true,'order_id'=>$order,'user_id'=>(string)$uid,'catalog'=>EG_PRODUCTS]+eg_payload($row,$u['balance']));
}catch(Throwable $e){$conn->rollback();eg_out(['ok'=>false,'message'=>$e instanceof mysqli_sql_exception?'Transaksi gagal; saldo dan item tidak diubah.':$e->getMessage()],400);}
