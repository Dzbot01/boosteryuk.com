<?php
const EG_PRODUCTS = [
 'f100'=>['name'=>'Followers +100','price'=>2500,'kind'=>'f','amount'=>100],
 'f500'=>['name'=>'Followers +500','price'=>9000,'kind'=>'f','amount'=>500],
 'l250'=>['name'=>'Like +250','price'=>1500,'kind'=>'l','amount'=>250],
 'v1k'=>['name'=>'Views +1.000','price'=>2000,'kind'=>'v','amount'=>1000],
 'c25'=>['name'=>'Komentar +25','price'=>1500,'kind'=>'c','amount'=>25],
];
function eg_schema($conn) {
 $conn->query("CREATE TABLE IF NOT EXISTS event_game_players (
  event_id INT NOT NULL, user_id INT NOT NULL, state_json MEDIUMTEXT NULL,
  inventory TEXT NOT NULL, bonus TEXT NOT NULL, score BIGINT NOT NULL DEFAULT 0,
  revision INT NOT NULL DEFAULT 0, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,user_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $conn->query("CREATE TABLE IF NOT EXISTS event_game_receipts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY, event_id INT NOT NULL, user_id INT NOT NULL,
  request_id VARCHAR(64) NOT NULL, request_hash CHAR(64) NOT NULL, action VARCHAR(8) NOT NULL,
  order_id VARCHAR(64) NULL, amount DECIMAL(15,2) NOT NULL DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_request(event_id,user_id,request_id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $conn->query("CREATE TABLE IF NOT EXISTS event_game_daily (
  user_id INT NOT NULL, play_date DATE NOT NULL, plays TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id,play_date)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

}
function eg_cart($cart) {
 if(!is_array($cart) || !$cart || count($cart)>5)throw new Exception('Keranjang tidak valid.');
 $clean=[];$total=0;
 foreach($cart as $id=>$qty){
  if(!isset(EG_PRODUCTS[$id]) || !is_int($qty) || $qty<1 || $qty>100)throw new Exception('Item atau jumlah tidak valid (1–100).');
  $clean[$id]=$qty;$total+=EG_PRODUCTS[$id]['price']*$qty;
 }
 ksort($clean);return [$clean,$total];
}
function eg_payload($row,$balance) {
 return ['state'=>$row['state_json']?json_decode($row['state_json'],true):null,'wallet'=>['bal'=>(float)$balance,'inv'=>(object)json_decode($row['inventory'],true),'bonus'=>(object)json_decode($row['bonus'],true)],'revision'=>(int)$row['revision']];
}
function eg_normalize($raw) {
 if(!is_array($raw))throw new Exception('Progres tidak valid.');
 $s=['user'=>preg_replace('/[^A-Za-z0-9._]/','',substr((string)($raw['user']??'pemain'),0,30)),'platform'=>'instagram','used'=>0];
 foreach(['posts','views','likes','comments','followers'] as $k){$v=$raw[$k]??0;if(!is_numeric($v)||!is_finite((float)$v)||$v<0||$v>10000000)throw new Exception('Statistik game tidak valid.');$s[$k]=(int)$v;}
 $s['score']=max(0,$s['posts']*10+$s['views']+$s['likes']*2+$s['comments']*5+($s['followers']-20)*20);
 $s['stage']=max(0,min(4,(int)($raw['stage']??0)));$s['cur']=[];
 foreach(['v','l','c'] as $k)$s['cur'][$k]=max(0,min(10000000,(int)($raw['cur'][$k]??0)));
 $s['end']=max(0,min((time()+3600)*1000,(float)($raw['end']??0)));$s['done']=!empty($raw['done']);$s['tiles']=[];
 foreach(array_slice(is_array($raw['tiles']??null)?$raw['tiles']:[],0,9) as $t){if(!is_array($t))continue;$s['tiles'][]=['e'=>implode('',array_slice(preg_split('//u',(string)($t['e']??'📸'),-1,PREG_SPLIT_NO_EMPTY) ?: [],0,8)),'c'=>preg_replace('/[^#a-fA-F0-9, ]/','',substr((string)($t['c']??'#555,#888'),0,40))];}
 return $s;
}

// Global per website user across events, resetting at midnight Asia/Jakarta.
function eg_daily($conn,$uid) {
 $date=(new DateTimeImmutable('now',new DateTimeZone('Asia/Jakarta')))->format('Y-m-d');
 $st=cp_q($conn,'SELECT plays FROM event_game_daily WHERE user_id=? AND play_date=?','is',(int)$uid,$date);
 $used=(int)($st->get_result()->fetch_assoc()['plays']??0);$st->close();
 return ['date'=>$date,'timezone'=>'Asia/Jakarta','limit'=>5,'used'=>$used,'remaining'=>max(0,5-$used)];
}
