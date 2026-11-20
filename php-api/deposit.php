<?php
ob_start();ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Access-Control-Allow-Headers: Content-Type');
function di_out($data,$code=200){while(ob_get_level())ob_end_clean();http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
if($_SERVER['REQUEST_METHOD']==='OPTIONS')exit;
if($_SERVER['REQUEST_METHOD']!=='POST')di_out(['ok'=>false,'message'=>'Gunakan POST.'],405);
set_exception_handler(function($e){error_log('deposit: '.$e->getMessage());di_out(['ok'=>false,'message'=>'Layanan deposit belum siap. Hubungi admin.'],500);});
require __DIR__.'/configdb.php';require_once __DIR__.'/deposit_invoice_lib.php';
$raw=file_get_contents('php://input');$in=json_decode($raw,true);
if(!is_array($in)||strlen($raw)>10000)di_out(['ok'=>false,'message'=>'Data tidak valid.'],400);
$uid=(int)cp_user_id($conn,$in['token']??'');if(!$uid)di_out(['ok'=>false,'message'=>'Silakan login ulang.'],401);
try {
 di_ready($conn);dep_import_log($conn);
 $action=$in['action']??'';
 if($action==='list') {
    $page=max(1,(int)($in['page']??1));$offset=($page-1)*25;
    $st=cp_q($conn,"SELECT * FROM (
        SELECT merchant_ref,reference,nominal,bonus,method,status,invoice_json,UNIX_TIMESTAMP(created_at) AS created_epoch,cancelled_at,paid_at,0 AS legacy_credit FROM deposit_invoices WHERE user_id=?
        UNION ALL
        SELECT d.merchant_ref,d.reference,NULL,NULL,d.method,'PAID',NULL,UNIX_TIMESTAMP(d.paid_at),NULL,d.paid_at,d.amount FROM deposits d LEFT JOIN deposit_invoices i ON i.merchant_ref=d.merchant_ref WHERE d.user_id=? AND i.id IS NULL
    ) history ORDER BY created_epoch DESC,merchant_ref DESC LIMIT 26 OFFSET ?",'iii',$uid,$uid,$offset);
    $rows=[];$result=$st->get_result();while($r=$result->fetch_assoc())$rows[]=di_view($r);$st->close();
    $more=count($rows)>25;di_out(['ok'=>true,'rows'=>array_slice($rows,0,25),'has_more'=>$more]);
 }
 if($action==='active') {
    $st=cp_q($conn,'SELECT *,UNIX_TIMESTAMP(created_at) AS created_epoch FROM deposit_invoices WHERE active_user_id=? LIMIT 1','i',$uid);
    $r=$st->get_result()->fetch_assoc();$st->close();di_out(['ok'=>true,'invoice'=>$r?di_view($r):null,'server_time'=>time()]);
 }
 if($action==='create') {
    if(!function_exists('curl_init'))throw new Exception('Ekstensi cURL server diperlukan.');
    $nominal=filter_var($in['amount']??null,FILTER_VALIDATE_INT);
    $method=strtoupper(trim((string)($in['method']??'')));
    if($method==='QRIS2')$method='QRIS'; // Same alias as the existing Worker.
    if(!$nominal||$nominal<1000||$nominal>10000000||!preg_match('/^[A-Z0-9_]{2,60}$/D',$method))throw new Exception('Nominal atau metode tidak valid.');
    // Reserve BEFORE making any gateway call. The unique active_user_id also covers parallel tabs.
    $conn->begin_transaction();
    try {
        $st=cp_q($conn,'SELECT id,name,email FROM users WHERE id=? FOR UPDATE','i',$uid);$user=$st->get_result()->fetch_assoc();$st->close();
        if(!$user)throw new Exception('Akun tidak ditemukan.');
        $st=cp_q($conn,'SELECT merchant_ref FROM deposit_invoices WHERE active_user_id=?','i',$uid);$existing=$st->get_result()->fetch_assoc();$st->close();
        if($existing){$conn->rollback();di_out(['ok'=>false,'message'=>'Masih ada deposit menunggu pembayaran. Selesaikan atau batalkan invoice tersebut.','invoice'=>di_view(di_row($conn,$existing['merchant_ref']))],409);}
        $ref='BY-'.$uid.'-'.bin2hex(random_bytes(12));$bonus=intdiv($nominal*3,100);
        cp_q($conn,'INSERT INTO deposit_invoices (merchant_ref,user_id,active_user_id,nominal,bonus,method) VALUES (?,?,?,?,?,?)','siiiis',$ref,$uid,$uid,$nominal,$bonus,$method)->close();
        $conn->commit();
    }catch(Throwable $e){$conn->rollback();throw $e;}
    // Channel constraints checked by Tripay. Only nominal (NOT nominal + bonus) goes to gateway.
    try { $data=di_gateway('/create',[
        'method'=>$method,'merchant_ref'=>$ref,'amount'=>$nominal,
        'customer_name'=>$user['name'],'customer_email'=>$user['email']
    ]); } catch(DiRejected $e) {
        cp_q($conn,"UPDATE deposit_invoices SET status='FAILED',active_user_id=NULL WHERE merchant_ref=? AND status='CREATING' AND reference IS NULL",'s',$ref)->close();
        throw $e;
    }
    $r=di_apply($conn,$ref,$data);di_out(['ok'=>true,'invoice'=>di_view($r),'server_time'=>time()]);
 }
 if(!in_array($action,['detail','status','cancel'],true))throw new Exception('Aksi tidak valid.');
 $r=di_row($conn,(string)($in['merchant_ref']??''),$uid);
 if(!$r)di_out(['ok'=>false,'message'=>'Invoice tidak ditemukan.'],404);
 if($action==='detail')di_out(['ok'=>true,'invoice'=>di_view($r),'server_time'=>time()]);
 if($action==='cancel' && time()<(int)$r['created_epoch']+600)throw new Exception('Deposit baru dapat dibatalkan setelah 10 menit.');
 // Fail closed: never cancel if live payment status cannot be verified.
 $r=di_sync($conn,$r);
 if($action==='cancel' && in_array($r['status'],['UNPAID','PENDING'],true)) {
    $conn->begin_transaction();
    try {
        cp_q($conn,'SELECT id FROM users WHERE id=? FOR UPDATE','i',$uid)->close();
        $r=di_row($conn,$r['merchant_ref'],$uid,true);
        if(time()<(int)$r['created_epoch']+600)throw new Exception('Tunggu 10 menit sebelum membatalkan.');
        if(in_array($r['status'],['UNPAID','PENDING'],true))cp_q($conn,"UPDATE deposit_invoices SET status='CANCELLED',active_user_id=NULL,cancelled_at=NOW() WHERE merchant_ref=?",'s',$r['merchant_ref'])->close();
        $conn->commit();$r=di_row($conn,$r['merchant_ref'],$uid);
    }catch(Throwable $e){$conn->rollback();throw $e;}
 }
 di_out(['ok'=>true,'invoice'=>di_view($r),'server_time'=>time()]);
}catch(Throwable $e){
 error_log('deposit lifecycle: '.$e->getMessage());
 // Domain errors are intentionally actionable; SQL/transport internals never reach the browser.
 $message=$e instanceof mysqli_sql_exception?'Layanan deposit belum siap. Hubungi admin.':$e->getMessage();
 di_out(['ok'=>false,'message'=>$message],409);
}
