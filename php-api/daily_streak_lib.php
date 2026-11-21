<?php
require_once __DIR__.'/child_panel_lib.php';
require_once __DIR__.'/plus_trial_lib.php';
function sr_ready($conn) {
 foreach(['users','user_daily_streaks','daily_streak_receipts','user_plus_trials','user_event_titles'] as $table){
  $st=cp_q($conn,'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?','s',$table);$r=$st->get_result()->fetch_assoc();$st->close();
  if(!$r || strtoupper($r['ENGINE'])!=='INNODB')throw new DomainException('Reward belum siap. Admin perlu backup dan menjalankan daily_streak.sql.');
 }
}
function sr_calendar($now=null) {
 $d=(new DateTimeImmutable('@'.($now??time())))->setTimezone(new DateTimeZone('Asia/Jakarta'));
 return [$d->format('Y-m-d'),$d->modify('-1 day')->format('Y-m-d'),$d->modify('+1 day')->setTime(0,0)->getTimestamp()];
}
function sr_should_reset($last,$day,$today,$yesterday) {
 return $last && $last!==$today && $last!==$yesterday && $day>0 && $day<7;
}
function sr_event_active($conn) {
 $st=cp_q($conn,"SELECT id FROM site_events WHERE id=2 AND kind='streak' AND status<>'finished' AND (starts_at IS NULL AND status='ongoing' OR starts_at<=UTC_TIMESTAMP()) AND (ends_at IS NULL OR ends_at>UTC_TIMESTAMP())");
 $r=$st->get_result()->fetch_assoc();$st->close();return (bool)$r;
}
function sr_title($conn,$uid,$code) {
 cp_q($conn,'INSERT IGNORE INTO user_event_titles (user_id,title_code) VALUES (?,?)','is',$uid,$code)->close();
}
/** Badge is participation/completion, not a claim about unverified client scores. */
function sr_newyear_title($conn,$uid) {
 $st=cp_q($conn,"SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('event_game_players','event_game_receipts','user_event_titles')");$n=(int)$st->get_result()->fetch_assoc()['n'];$st->close();if($n!==3)return;
 $st=cp_q($conn,'SELECT state_json FROM event_game_players WHERE event_id=1 AND user_id=?','i',$uid);$row=$st->get_result()->fetch_assoc();$st->close();
 $s=json_decode($row['state_json']??'',true);if(!$s || empty($s['done']) || empty($s['run_id']))return;
 // Immutable start receipt, not end/time/score supplied by browser.
 $st=cp_q($conn,"SELECT id FROM event_game_receipts WHERE event_id=1 AND user_id=? AND request_id=? AND action='start' AND created_at<=DATE_SUB(NOW(),INTERVAL 180 SECOND)",'is',$uid,$s['run_id']);
 $done=$st->get_result()->fetch_assoc();$st->close();if($done)sr_title($conn,$uid,'newyear-2027');
}
function sr_completed($conn,$uid) {
 $st=cp_q($conn,"SELECT title_code FROM user_event_titles WHERE user_id=? AND title_code='daily-streak-7'",'i',$uid);$r=$st->get_result()->fetch_assoc();$st->close();
 if($r)return true;
 $st=cp_q($conn,'SELECT user_id FROM daily_streak_receipts WHERE user_id=? AND streak_day=7 LIMIT 1','i',$uid);$r=$st->get_result()->fetch_assoc();$st->close();return (bool)$r;
}
function sr_state($conn,$uid,$row,$today,$next,$balance,$active) {
 $claimed=$row['last_checkin']===$today;
 $day=(int)$row['streak_day'];
 $completed=sr_completed($conn,$uid);
 $blockedMessage=$completed?'Event sudah kamu selesaikan.':'';
 if(!$active && !$completed){
  $st=cp_q($conn,'SELECT status,starts_at,ends_at FROM site_events WHERE id=2');$event=$st->get_result()->fetch_assoc();$st->close();
  $ended=!$event || $event['status']==='finished' || (!empty($event['ends_at']) && strtotime($event['ends_at'].' UTC')<=time());
  $blockedMessage=$ended?'Event telah berakhir.':'Event belum dimulai.';
 }

 $visible=$completed?7:$day;
 $st=cp_q($conn,'SELECT title_code,UNIX_TIMESTAMP(earned_at) AS earned_epoch FROM user_event_titles WHERE user_id=? ORDER BY earned_at DESC','i',$uid);
 $titles=[];$result=$st->get_result();while($r=$result->fetch_assoc())$titles[]=['code'=>$r['title_code'],'earned_at'=>gmdate('Y-m-d\TH:i:s\Z',(int)$r['earned_epoch'])];$st->close();
 return ['day'=>$visible,'last_checkin'=>$row['last_checkin'],'claimed_today'=>$claimed,'can_claim'=>$active&&!$claimed&&!$completed,'completed'=>$completed,'blocked_message'=>$blockedMessage,
  'today'=>$today,'next_day_at'=>$next,'server_time'=>time(),'cycle'=>(int)$row['cycle_no'],
  'reset_notice'=>!$completed && (int)$row['reset_count']>(int)$row['reset_seen'],'reset_version'=>(int)$row['reset_count'],
  'trial_until'=>pt_trial_until($conn,$uid),'balance'=>(float)$balance,'titles'=>$titles,'event_active'=>$active];
}
