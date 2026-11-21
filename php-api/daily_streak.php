<?php
ob_start();ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Access-Control-Allow-Headers: Content-Type');
function sr_out($r,$code=200){while(ob_get_level())ob_end_clean();http_response_code($code);echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
if($_SERVER['REQUEST_METHOD']==='OPTIONS')exit;
if($_SERVER['REQUEST_METHOD']!=='POST')sr_out(['ok'=>false,'message'=>'Gunakan POST.'],405);
set_exception_handler(function($e){error_log('daily_streak: '.$e->getMessage());sr_out(['ok'=>false,'message'=>'Reward belum dapat diproses. Coba lagi nanti.'],500);});
require __DIR__.'/configdb.php';require_once __DIR__.'/daily_streak_lib.php';
$raw=file_get_contents('php://input');$in=json_decode($raw,true);
if(!is_array($in)||strlen($raw)>4000)sr_out(['ok'=>false,'message'=>'Data tidak valid.'],400);
$uid=(int)cp_user_id($conn,$in['token']??'');if(!$uid)sr_out(['ok'=>false,'message'=>'Silakan login ulang.'],401);
$action=$in['action']??'';if(!in_array($action,['get','claim','ack_reset'],true))sr_out(['ok'=>false,'message'=>'Aksi tidak valid.'],400);
try {
 sr_ready($conn);
 $conn->begin_transaction();
 // Global per-user lock also serializes balance, trial extension and title changes across tabs.
 $st=cp_q($conn,'SELECT balance FROM users WHERE id=? FOR UPDATE','i',$uid);$u=$st->get_result()->fetch_assoc();$st->close();if(!$u)throw new DomainException('Akun tidak ditemukan.');
 cp_q($conn,'INSERT IGNORE INTO user_daily_streaks (user_id) VALUES (?)','i',$uid)->close();
 $st=cp_q($conn,'SELECT * FROM user_daily_streaks WHERE user_id=? FOR UPDATE','i',$uid);$row=$st->get_result()->fetch_assoc();$st->close();
 // Compute date AFTER acquiring lock, including requests crossing midnight WIB.
 [$today,$yesterday,$next]=sr_calendar();$active=sr_event_active($conn);
 if(sr_should_reset($row['last_checkin'],(int)$row['streak_day'],$today,$yesterday)){
  $row['streak_day']=0;$row['cycle_no']++;$row['reset_count']++;
  cp_q($conn,'UPDATE user_daily_streaks SET streak_day=0,cycle_no=?,reset_count=? WHERE user_id=?','iii',(int)$row['cycle_no'],(int)$row['reset_count'],$uid)->close();
 }
 if($action==='ack_reset') {
  // Only acknowledge the version actually displayed, not a newer reset in another tab.
  $seen=min((int)$row['reset_count'],max(0,(int)($in['version']??0)));
  cp_q($conn,'UPDATE user_daily_streaks SET reset_seen=GREATEST(reset_seen,?) WHERE user_id=?','ii',$seen,$uid)->close();$row['reset_seen']=max((int)$row['reset_seen'],$seen);
 }
 $reward=null;
 if($action==='claim'){
  if(!$active)throw new DomainException('Event Daily Streak sedang tidak aktif.');
  // Unique receipt is the final idempotency gate even if a request is retried after response loss.
  $st=cp_q($conn,'SELECT streak_day FROM daily_streak_receipts WHERE user_id=? AND checkin_date=?','is',$uid,$today);$existing=$st->get_result()->fetch_assoc();$st->close();
  if(!$existing){
   $day=(int)$row['streak_day']===7?1:(int)$row['streak_day']+1;
   if((int)$row['streak_day']===7)$row['cycle_no']++;
   $cash=$day<=6?$day:0;$until=null;
   if($day===7){
    $st=cp_q($conn,'SELECT expires_at FROM user_plus_trials WHERE user_id=? FOR UPDATE','i',$uid);$trial=$st->get_result()->fetch_assoc();$st->close();
    $base=$trial?max(time(),strtotime($trial['expires_at'].' UTC')):time();$until=gmdate('Y-m-d H:i:s',$base+86400);
    cp_q($conn,'INSERT INTO user_plus_trials (user_id,started_at,expires_at) VALUES (?,UTC_TIMESTAMP(),?) ON DUPLICATE KEY UPDATE started_at=UTC_TIMESTAMP(),expires_at=VALUES(expires_at)','is',$uid,$until)->close();
    sr_title($conn,$uid,'daily-streak-7');
   }
   cp_q($conn,'INSERT INTO daily_streak_receipts (user_id,checkin_date,cycle_no,streak_day,balance_reward,trial_until) VALUES (?,?,?,?,?,?)','isiiis',$uid,$today,(int)$row['cycle_no'],$day,$cash,$until)->close();
   if($cash){cp_q($conn,'UPDATE users SET balance=balance+? WHERE id=?','ii',$cash,$uid)->close();$u['balance']+=$cash;}
   cp_q($conn,'UPDATE user_daily_streaks SET last_checkin=?,streak_day=?,cycle_no=? WHERE user_id=?','siii',$today,$day,(int)$row['cycle_no'],$uid)->close();
   $row['last_checkin']=$today;$row['streak_day']=$day;
   $reward=['day'=>$day,'cash'=>$cash,'trial_until'=>$until?str_replace(' ','T',$until).'Z':null];
  }
 }
 sr_newyear_title($conn,$uid);
 $state=sr_state($conn,$uid,$row,$today,$next,$u['balance'],$active);
 $conn->commit();sr_out(['ok'=>true,'state'=>$state,'reward'=>$reward]);
}catch(Throwable $e){try{$conn->rollback();}catch(Throwable $ignored){}error_log('daily_streak: '.$e->getMessage());sr_out(['ok'=>false,'message'=>$e instanceof DomainException?$e->getMessage():'Reward belum siap. Admin perlu memeriksa migrasi database.'],409);}
