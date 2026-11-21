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
/** Account-specific completion is read from server records, never client localStorage or scores. */
function ea_completed($conn,$uid,$event) {
 $id=(int)$event['id'];$kind=$event['kind'];
 $code=$id===2 && $kind==='streak'?'daily-streak-7':($id===1 && $kind==='game'?'newyear-2027':null);
 if($code && ea_table($conn,'user_event_titles')) {
  $st=cp_q($conn,'SELECT title_code FROM user_event_titles WHERE user_id=? AND title_code=?','is',$uid,$code);$r=$st->get_result()->fetch_assoc();$st->close();if($r)return true;
 }
 if($id===2 && $kind==='streak' && ea_table($conn,'daily_streak_receipts')){
  $st=cp_q($conn,'SELECT user_id FROM daily_streak_receipts WHERE user_id=? AND streak_day=7 LIMIT 1','i',$uid);$r=$st->get_result()->fetch_assoc();$st->close();if($r)return true;
 }
 if($kind==='game' && ea_table($conn,'event_game_players') && ea_table($conn,'event_game_receipts')){
  $st=cp_q($conn,'SELECT state_json FROM event_game_players WHERE event_id=? AND user_id=?','ii',$id,$uid);$r=$st->get_result()->fetch_assoc();$st->close();$s=json_decode($r['state_json']??'',true);
  if($s && !empty($s['done']) && !empty($s['run_id'])){
   $st=cp_q($conn,"SELECT id FROM event_game_receipts WHERE event_id=? AND user_id=? AND request_id=? AND action='start' AND created_at<=DATE_SUB(NOW(),INTERVAL 180 SECOND)",'iis',$id,$uid,$s['run_id']);$r=$st->get_result()->fetch_assoc();$st->close();if($r)return true;
  }
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
