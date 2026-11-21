<?php
// Keep warnings/HTML from included hosting files out of the JSON response.
ob_start();
ini_set('display_errors','0');
header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Access-Control-Allow-Headers: Content-Type');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
$egResponded=false;
function eg_out($data,$code=200){
 $GLOBALS['egResponded']=true;
 while(ob_get_level()>0)ob_end_clean();
 http_response_code($code);
 header('Content-Type: application/json; charset=utf-8');
 echo json_encode(['api_version'=>3]+$data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE);exit;
}
function eg_server_error(){
 if(isset($GLOBALS['conn']))try{$GLOBALS['conn']->rollback();}catch(Throwable $ignore){}
 eg_out(['ok'=>false,'message'=>'Game sedang ditutup, silakan cobalagi nanti.'],500);
}
set_exception_handler(function($e){error_log('event_game: '.$e->getMessage());eg_server_error();});
register_shutdown_function(function(){
 if(!empty($GLOBALS['egResponded']) || $_SERVER['REQUEST_METHOD']==='OPTIONS')return;
 $last=error_get_last();
 if($last)error_log('event_game shutdown: '.$last['message']);
 eg_server_error();
});
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(204);exit;}
if($_SERVER['REQUEST_METHOD']!=='POST')eg_out(['ok'=>false,'message'=>'Gunakan POST.'],405);
foreach(['configdb.php','child_panel_lib.php','event_game_lib.php','riwayat_schema.php'] as $file){
 if(!is_file(__DIR__.'/'.$file)){
  error_log('event_game missing dependency: '.$file);
  eg_out(['ok'=>false,'message'=>'File API game belum lengkap di server. Upload event_game.php, event_game_lib.php, child_panel_lib.php, riwayat_schema.php dan pastikan configdb.php tersedia di folder /api.'],503);
 }
}
require __DIR__.'/configdb.php';require_once __DIR__.'/child_panel_lib.php';require_once __DIR__.'/event_game_lib.php';require_once __DIR__.'/riwayat_schema.php';
if(!defined('EG_GAME_PROTOCOL_VERSION') || EG_GAME_PROTOCOL_VERSION!==3 || !defined('CP_EVENT_MERCHANT_VERSION') || CP_EVENT_MERCHANT_VERSION!==1 || !function_exists('eg_daily')){
 eg_out(['ok'=>false,'code'=>'GAME_API_VERSION_MISMATCH','message'=>'Versi file API game tidak cocok. Upload event_game.php, event_game_lib.php dan child_panel_lib.php terbaru secara bersamaan.'],409);
}
$conn->set_charset('utf8mb4');
$raw=file_get_contents('php://input');$in=json_decode($raw,true);if(!is_array($in)||strlen($raw)>30000)eg_out(['ok'=>false,'message'=>'Data game tidak valid.'],400);
$uid=cp_user_id($conn,$in['token']??'');if(!$uid)eg_out(['ok'=>false,'message'=>'Silakan login ulang.'],401);
$eid=(int)($in['event_id']??0);$action=$in['action']??'';
if(!in_array($action,['get','start','save','buy','use','leaderboard'],true))eg_out(['ok'=>false,'message'=>'Aksi tidak valid.'],400);
// Existing event management remains authoritative; no event/price from the HTML is trusted.
$st=cp_q($conn,'SELECT * FROM site_events WHERE id=?','i',$eid);$event=$st->get_result()->fetch_assoc();$st->close();
if(!$event || $event['kind']!=='game')eg_out(['ok'=>false,'message'=>'Game event tidak ditemukan.'],404);
$active=$event['status']!=='finished' && (!$event['starts_at']||strtotime($event['starts_at'].' UTC')<=time()) && (!$event['ends_at']||strtotime($event['ends_at'].' UTC')>time()) && ($event['status']==='ongoing'||$event['starts_at']);
if(!$active)eg_out(['ok'=>false,'message'=>'Event belum dimulai atau sudah selesai.'],403);
$tenant=cp_resolve($conn);
if(cp_request_host() && !$tenant)eg_out(['ok'=>false,'message'=>'Child panel tidak aktif.'],403);
$catalog=eg_catalog($tenant);
eg_schema($conn);
if(in_array($action,['buy','start','use'],true)) {
 // Refuse non-transactional tables: a history failure must roll back real money as well.
 $incompatible=[];
 $extraTables=$tenant && $action==='buy'?['child_panel_orders','child_panel_activity']:[];
 foreach(array_merge($extraTables,($action==='buy'?['users','riwayat_pesanan','event_game_players','event_game_receipts','event_game_daily']:['event_game_players','event_game_receipts','event_game_daily'])) as $table){
  $st=cp_q($conn,'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?','s',$table);
  $engine=$st->get_result()->fetch_assoc()['ENGINE']??'';$st->close();
  if(strtoupper($engine)!=='INNODB')$incompatible[]=$table.' ('.($engine ?: 'engine tidak terbaca').')';
 }
 if($incompatible)eg_out([
  'ok'=>false,'code'=>'GAME_ENGINE_NOT_READY','payment_started'=>false,
  'message'=>'Pembelian belum diproses; saldo tidak dipotong oleh permintaan ini. Tabel belum InnoDB: '.implode(', ',$incompatible).'. Admin perlu backup database lalu menjalankan event_game_innodb_migration.sql di database website.'
 ],503);
 if($action==='buy' && !riwayat_ensure_columns($conn))eg_out(['ok'=>false,'message'=>'Skema riwayat perlu diperbarui sebelum pembelian game.'],503);
}
if($action==='leaderboard'){
 $st=cp_q($conn,'SELECT user_id, state_json FROM event_game_players WHERE event_id=? AND state_json IS NOT NULL ORDER BY score DESC,user_id ASC LIMIT 100','i',$eid);$result=$st->get_result();$rows=[];
 while($r=$result->fetch_assoc()){$s=json_decode($r['state_json'],true);$rows[]=['uid'=>(string)$r['user_id'],'user'=>$s['user'],'score'=>$s['score'],'platform'=>'instagram'];}$st->close();eg_out(['ok'=>true,'rows'=>$rows,'verified'=>false]);
}
$conn->begin_transaction();
try {
 $st=cp_q($conn,'SELECT balance FROM users WHERE id=? FOR UPDATE','i',(int)$uid);$u=$st->get_result()->fetch_assoc();$st->close();if(!$u)throw new Exception('Akun tidak ditemukan.');
 if(in_array($action,['start','buy','use'],true))cp_q($conn,"INSERT IGNORE INTO event_game_players (event_id,user_id,inventory,bonus) VALUES (?,?,'{}','{\"f\":0,\"l\":0,\"v\":0,\"c\":0}')",'ii',$eid,(int)$uid)->close();
 $st=cp_q($conn,'SELECT * FROM event_game_players WHERE event_id=? AND user_id=? FOR UPDATE','ii',$eid,(int)$uid);$row=$st->get_result()->fetch_assoc();$st->close();
 if(!$row){
  if($action==='get'){ $conn->commit();eg_out(['ok'=>true,'state'=>null,'wallet'=>['bal'=>(float)$u['balance'],'inv'=>(object)[],'bonus'=>['f'=>0,'l'=>0,'v'=>0,'c'=>0]],'revision'=>-1,'user_id'=>(string)$uid,'catalog'=>$catalog,'daily'=>eg_daily($conn,$uid)]); }
  throw new Exception('Data game tidak tersedia. Muat ulang lalu mulai permainan baru.');
 }
 if($action==='get' && $row['state_json']){
  $legacy=json_decode($row['state_json'],true);
  if($legacy && empty($legacy['run_id']) && empty($legacy['done'])){
   $legacy['done']=true;$row['state_json']=json_encode($legacy,JSON_UNESCAPED_UNICODE);$row['revision']++;
   cp_q($conn,'UPDATE event_game_players SET state_json=?,revision=? WHERE event_id=? AND user_id=?','siii',$row['state_json'],(int)$row['revision'],$eid,(int)$uid)->close();
  }
 }
 $inv=json_decode($row['inventory'],true);$bonus=json_decode($row['bonus'],true);$order=null;
 if($action==='start'){
  $request=(string)($in['request_id']??'');
  if(!preg_match('/^[a-f0-9-]{16,64}$/D',$request))throw new Exception('ID permainan tidak valid.');
  $name=(string)($in['username']??'');
  if(!preg_match('/^[A-Za-z0-9._]{1,30}$/D',$name))throw new Exception('Username game tidak valid.');
  $hash=hash('sha256',json_encode(['start',$name]));
  $st=cp_q($conn,'SELECT request_hash FROM event_game_receipts WHERE event_id=? AND user_id=? AND request_id=?','iis',$eid,(int)$uid,$request);
  $receipt=$st->get_result()->fetch_assoc();$st->close();
  if($receipt){if(!hash_equals($receipt['request_hash'],$hash))throw new Exception('ID permainan sudah digunakan.');if(!$row['state_json'])throw new Exception('Permainan sebelumnya sudah dihapus. Muat ulang game.');}
  else{
   $previous=json_decode($row['state_json']??'null',true);
   if($previous && empty($previous['done']) && $previous['end']>time()*1000)throw new Exception('Masih ada permainan aktif. Muat ulang untuk melanjutkan.');
   $daily=eg_daily($conn,$uid);$day=$daily['date'];
   cp_q($conn,'INSERT IGNORE INTO event_game_daily (user_id,play_date,plays) VALUES (?,?,0)','is',(int)$uid,$day)->close();
   $st=cp_q($conn,'UPDATE event_game_daily SET plays=plays+1 WHERE user_id=? AND play_date=? AND plays<5','is',(int)$uid,$day);
   $changed=$st->affected_rows;$st->close();if($changed!==1)throw new Exception('Batas bermain 5 kali hari ini sudah habis. Coba lagi besok (WIB).');
   $state=eg_normalize(['user'=>$name,'posts'=>0,'views'=>0,'likes'=>0,'comments'=>0,'followers'=>20,'end'=>(time()+180)*1000]);
   $state['run_id']=$request;
   cp_q($conn,'UPDATE event_game_players SET state_json=?,score=0,revision=revision+1 WHERE event_id=? AND user_id=?','sii',json_encode($state,JSON_UNESCAPED_UNICODE),$eid,(int)$uid)->close();
   cp_q($conn,"INSERT INTO event_game_receipts (event_id,user_id,request_id,request_hash,action,amount) VALUES (?,?,?,?,'start',0)",'iiss',$eid,(int)$uid,$request,$hash)->close();
  }
 }
 if($action==='save'){
  if((int)($in['revision']??-1)!==(int)$row['revision']){ $conn->rollback();eg_out(['ok'=>false,'message'=>'Progres berubah di tab/perangkat lain. Muat ulang game.'],409); }
  $state=eg_normalize($in['state']??null);$previous=json_decode($row['state_json']??'null',true);
  if(!$previous || empty($previous['run_id']) || ($in['state']['run_id']??'')!==$previous['run_id'])throw new Exception('Sesi permainan tidak valid. Muat ulang lalu mulai game.');
  $state['run_id']=$previous['run_id'];
  $state['score_adjustment']=(int)($previous['score_adjustment']??0);
  $state['score']=max(0,$state['score']+$state['score_adjustment']);
  if(!empty($previous['done'])){ $conn->commit();eg_out(['ok'=>true,'daily'=>eg_daily($conn,$uid)]+eg_payload($row,$u['balance'])); }
  cp_q($conn,'UPDATE event_game_players SET state_json=?,score=?,revision=revision+1 WHERE event_id=? AND user_id=?','siii',json_encode($state,JSON_UNESCAPED_UNICODE),$state['score'],$eid,(int)$uid)->close();
  if($eid===1 && !empty($state['done']) && is_file(__DIR__.'/daily_streak_lib.php')) {
   try { require_once __DIR__.'/daily_streak_lib.php';sr_newyear_title($conn,(int)$uid); } catch(Throwable $badgeError) { error_log('newyear badge: '.$badgeError->getMessage()); }
  }
 }
 if($action==='buy'||$action==='use'){
  $request=(string)($in['request_id']??'');if(!preg_match('/^[a-f0-9-]{16,64}$/D',$request))throw new Exception('ID transaksi tidak valid.');
  $cart=[];$amount=0;$item='';
  if($action==='buy'){[$cart,$amount]=eg_cart($in['cart']??null,$catalog);[, $baseAmount]=eg_cart($in['cart']??null);}
  else {$item=(string)($in['item_id']??'');if(!isset(EG_PRODUCTS[$item]))throw new Exception('Item tidak valid.');}
  $hash=hash('sha256',json_encode([$action,$cart,$item,$tenant['id']??0]));
  $st=cp_q($conn,'SELECT * FROM event_game_receipts WHERE event_id=? AND user_id=? AND request_id=?','iis',$eid,(int)$uid,$request);$receipt=$st->get_result()->fetch_assoc();$st->close();
  if($receipt){if(!hash_equals($receipt['request_hash'],$hash) && !(!$tenant && hash_equals($receipt['request_hash'],hash('sha256',json_encode([$action,$cart,$item])))))throw new Exception('ID transaksi sudah dipakai untuk permintaan lain.');$order=$receipt['order_id'];}
  else {
   if($action==='buy'){
    if(!isset($in['expected_total']) || (float)$in['expected_total']!==(float)$amount)throw new Exception('Harga merchant berubah. Buka ulang merchant dan konfirmasi harga terbaru.');
    if(($in['confirm_real_balance']??false)!==true)throw new Exception('Konfirmasi penggunaan saldo website diperlukan.');
    $st=cp_q($conn,'UPDATE users SET balance=balance-? WHERE id=? AND balance>=?','did',$amount,(int)$uid,$amount);$changed=$st->affected_rows;$st->close();if($changed!==1)throw new Exception('Saldo website tidak cukup.');
    $u['balance']-=$amount;$order='EVG'.strtoupper(bin2hex(random_bytes(12)));$names=[];$qty=0;
    foreach($cart as $id=>$n){$inv[$id]=($inv[$id]??0)+$n;$qty+=$n;$names[]=EG_PRODUCTS[$id]['name'].' x'.$n;}
    $service='Event Merchant: '.implode(', ',$names);$detail=json_encode(['event_id'=>$eid,'child_panel_id'=>$tenant['id']??null,'harga_dasar'=>$baseAmount,'cart'=>$cart,'request_id'=>$request,'note'=>'Item virtual game; bukan followers/like akun sosial asli.']);
    cp_q($conn,"INSERT INTO riwayat_pesanan (user_id,order_id,service_name,quantity,price,status,order_type,detail) VALUES (?,?,?,?,?,'selesai','event',?)",'issids',(int)$uid,$order,$service,$qty,$amount,$detail)->close();
    if($tenant)cp_record_order($conn,$tenant['id'],(int)$uid,$order,'event',$service,$qty,$amount,$baseAmount);
   }else{if(empty($inv[$item]))throw new Exception('Item tidak tersedia.');$inv[$item]--;$p=EG_PRODUCTS[$item];$bonus[$p['kind']]=($bonus[$p['kind']]??0)+$p['amount'];}
   cp_q($conn,'UPDATE event_game_players SET inventory=?,bonus=? WHERE event_id=? AND user_id=?','ssii',json_encode((object)$inv),json_encode((object)$bonus),$eid,(int)$uid)->close();
   cp_q($conn,'INSERT INTO event_game_receipts (event_id,user_id,request_id,request_hash,action,order_id,amount) VALUES (?,?,?,?,?,?,?)','iissssd',$eid,(int)$uid,$request,$hash,$action,$order,$amount)->close();
  }
 }
 $st=cp_q($conn,'SELECT * FROM event_game_players WHERE event_id=? AND user_id=?','ii',$eid,(int)$uid);$row=$st->get_result()->fetch_assoc();$st->close();$conn->commit();
 eg_out(['ok'=>true,'order_id'=>$order,'user_id'=>(string)$uid,'catalog'=>$catalog,'daily'=>eg_daily($conn,$uid)]+eg_payload($row,$u['balance']));
}catch(Throwable $e){$conn->rollback();eg_out(['ok'=>false,'message'=>$e instanceof mysqli_sql_exception?'Transaksi gagal; saldo dan item tidak diubah.':$e->getMessage()],400);}
