<?php
require_once __DIR__.'/child_panel_lib.php';
function ea_table($conn,$table) {
 static $tables=[];
 if(!array_key_exists($table,$tables)){
  $st=cp_q($conn,'SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?','s',$table);
  $tables[$table]=(bool)$st->get_result()->fetch_assoc();$st->close();
 }
 return $tables[$table];
}
/** Only short-mission events finish per account. A completed game run/title
 * is participation, not completion of a repeatable score competition. */
function ea_completed($conn,$uid,$event) {
 $id=(int)$event['id'];$kind=$event['kind'];
 if($kind!=='streak' || $id!==2)return false;
 $code='daily-streak-7';
 if($code && ea_table($conn,'user_event_titles')) {
  $st=cp_q($conn,'SELECT title_code FROM user_event_titles WHERE user_id=? AND title_code=?','is',$uid,$code);$r=$st->get_result()->fetch_assoc();$st->close();if($r)return true;
 }
 if($id===2 && $kind==='streak' && ea_table($conn,'daily_streak_receipts')){
  $st=cp_q($conn,'SELECT user_id FROM daily_streak_receipts WHERE user_id=? AND streak_day=7 LIMIT 1','i',$uid);$r=$st->get_result()->fetch_assoc();$st->close();if($r)return true;
 }

 return false;
}
function ea_access($conn,$uid,$event) {
 $completed=ea_completed($conn,$uid,$event);$now=time();
 if($completed)return ['allowed'=>false,'completed'=>true,'message'=>'Event sudah kamu selesaikan.'];
 if($event['status']==='finished' || (!empty($event['ends_at']) && strtotime($event['ends_at'].' UTC')<=$now))return ['allowed'=>false,'completed'=>false,'message'=>'Event telah berakhir.'];
 if((!empty($event['starts_at']) && strtotime($event['starts_at'].' UTC')>$now) || (empty($event['starts_at']) && $event['status']!=='ongoing'))return ['allowed'=>false,'completed'=>false,'message'=>'Event belum dimulai.'];
 return ['allowed'=>true,'completed'=>false,'message'=>''];
}
