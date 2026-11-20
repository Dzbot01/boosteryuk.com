<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(204);exit;}
function ega_out($data,$code=200){http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE);exit;}
set_exception_handler(function($e){if(isset($GLOBALS['conn']))try{$GLOBALS['conn']->rollback();}catch(Throwable $ignore){}error_log('event_game_admin: '.$e->getMessage());ega_out(['ok'=>false,'message'=>'Data event belum dapat diproses.'],500);});
if($_SERVER['REQUEST_METHOD']!=='POST')ega_out(['ok'=>false,'message'=>'Gunakan POST.'],405);
require __DIR__.'/configdb.php';require_once __DIR__.'/child_panel_lib.php';require_once __DIR__.'/event_game_lib.php';
$conn->set_charset('utf8mb4');
$in=json_decode(file_get_contents('php://input'),true);
if(!is_array($in))ega_out(['ok'=>false,'message'=>'Data tidak valid.'],400);
if(!empty($_SERVER['HTTP_X_CHILD_PANEL']))ega_out(['ok'=>false,'message'=>'Kelola dari domain utama.'],403);
$admin=cp_require_admin($conn,$in['token']??'',function($m,$c){ega_out(['ok'=>false,'message'=>$m],$c);});
$eid=(int)($in['event_id']??0);$action=$in['action']??'';
if(!in_array($action,['list','update','delete'],true))ega_out(['ok'=>false,'message'=>'Aksi tidak valid.'],400);
$st=cp_q($conn,'SELECT id,title FROM site_events WHERE id=?','i',$eid);$event=$st->get_result()->fetch_assoc();$st->close();
if(!$event)ega_out(['ok'=>false,'message'=>'Event tidak ditemukan.'],404);
eg_schema($conn);
if($action==='update'||$action==='delete'){
 $st=cp_q($conn,"SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='event_game_players'");
 $engine=$st->get_result()->fetch_assoc()['ENGINE']??'';$st->close();
 if(strtoupper($engine)!=='INNODB')ega_out(['ok'=>false,'message'=>'Tabel peserta harus InnoDB sebelum data dapat diubah.'],503);
 $uid=(int)($in['user_id']??0);
 $conn->begin_transaction();
 $st=cp_q($conn,'SELECT state_json,revision FROM event_game_players WHERE event_id=? AND user_id=? FOR UPDATE','ii',$eid,$uid);$row=$st->get_result()->fetch_assoc();$st->close();
 if(!$row||!$row['state_json']){$conn->rollback();ega_out(['ok'=>false,'message'=>'Peserta tidak ditemukan.'],404);}
 if((int)($in['revision']??-1)!==(int)$row['revision']){$conn->rollback();ega_out(['ok'=>false,'message'=>'Data peserta berubah. Muat ulang sebelum mengubah atau menghapus.'],409);}
 if($action==='delete'){
  // Only participation is deleted. Keep website account, real-money receipts/history and daily quota.
  cp_q($conn,'DELETE FROM event_game_players WHERE event_id=? AND user_id=?','ii',$eid,$uid)->close();
 }else{
  $s=json_decode($row['state_json'],true);
  foreach(['score','followers','likes','views','comments'] as $k){$v=$in[$k]??null;if(!is_int($v)||$v<0||$v>($k==='score'?100000000:10000000)){$conn->rollback();ega_out(['ok'=>false,'message'=>'Statistik harus bilangan bulat 0–100.000.000.'],400);}$s[$k]=$v;}
  $s['score_adjustment']=$s['score']-max(0,$s['posts']*10+$s['views']+$s['likes']*2+$s['comments']*5+($s['followers']-20)*20);
  cp_q($conn,'UPDATE event_game_players SET state_json=?,score=?,revision=revision+1 WHERE event_id=? AND user_id=?','siii',json_encode($s,JSON_UNESCAPED_UNICODE),$s['score'],$eid,$uid)->close();
 }
 $conn->commit();ega_out(['ok'=>true]);
}
$page=max(1,(int)($in['page']??1));$offset=($page-1)*50;
$st=cp_q($conn,'SELECT COUNT(*) AS total FROM event_game_players WHERE event_id=? AND state_json IS NOT NULL','i',$eid);$total=(int)$st->get_result()->fetch_assoc()['total'];$st->close();
$st=cp_q($conn,'SELECT user_id,state_json,bonus,score,revision FROM event_game_players WHERE event_id=? AND state_json IS NOT NULL ORDER BY score DESC,user_id ASC LIMIT 50 OFFSET ?','ii',$eid,$offset);$res=$st->get_result();$rows=[];
while($r=$res->fetch_assoc()){
 $s=json_decode($r['state_json'],true);$bonus=json_decode($r['bonus'],true);
 $rows[]=['user_id'=>(int)$r['user_id'],'username'=>$s['user'],'score'=>(int)$r['score'],'followers'=>(int)$s['followers'],'likes'=>(int)$s['likes'],'views'=>(int)$s['views'],'comments'=>(int)$s['comments'],'bonus'=>$bonus,'revision'=>(int)$r['revision']];
}
$st->close();ega_out(['ok'=>true,'event'=>$event,'total'=>$total,'rows'=>$rows,'page'=>$page,'per_page'=>50]);
