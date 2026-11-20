<?php
/** Persist website deposit lifecycle; existing Worker handles ALL Tripay operations and keys. */
require_once __DIR__.'/child_panel_lib.php';
require_once __DIR__.'/deposit_lib.php';
function di_ready($conn) {
    dep_schema($conn);
    foreach (['users','deposits','deposit_invoices'] as $table) {
        $st=cp_q($conn,'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?','s',$table);
        $row=$st->get_result()->fetch_assoc();$st->close();
        if (!$row || strtoupper($row['ENGINE'])!=='INNODB') throw new Exception('Database deposit belum siap. Admin perlu menjalankan deposit_invoices.sql setelah backup.');
    }
}
class DiRejected extends Exception {}
function di_gateway($path,$body=null) {
    if (!function_exists('curl_init')) throw new Exception('Ekstensi cURL server diperlukan.');
    $ch=curl_init('https://api.boosteryuk.com/api/tripay'.$path);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>35,
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','Accept: application/json'],CURLOPT_FOLLOWLOCATION=>false]);
    if ($body!==null) curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body)]);
    $raw=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    $r=json_decode((string)$raw,true);
    if (in_array($code,[200,400,422],true) && is_array($r) && isset($r['success']) && $r['success']===false) throw new DiRejected('Transaksi ditolak gateway. Periksa nominal/batas channel atau pilih metode lain.');
    // A timeout is ambiguous: do NOT release reservation or retry creation automatically.
    if ($code!==200 || !is_array($r) || empty($r['success']) || !isset($r['data'])) throw new Exception('Gateway belum mengonfirmasi transaksi. Coba cek status lagi; jangan membayar invoice lain.');
    return $r['data'];
}
function di_row($conn,$ref,$uid=null,$lock=false) {
    $sql='SELECT *, UNIX_TIMESTAMP(created_at) AS created_epoch FROM deposit_invoices WHERE merchant_ref=?';
    $st=$uid===null ? cp_q($conn,$sql.($lock?' FOR UPDATE':''),'s',$ref) : cp_q($conn,$sql.' AND user_id=?'.($lock?' FOR UPDATE':''),'si',$ref,$uid);
    $r=$st->get_result()->fetch_assoc();$st->close();return $r;
}
function di_view($r) {
    $data=json_decode($r['invoice_json']??'',true) ?: [];
    $status=$r['status'];
    return ['merchant_ref'=>$r['merchant_ref'],'reference'=>$r['reference'],'nominal'=>$r['nominal']===null?null:(int)$r['nominal'],
        'bonus'=>$r['bonus']===null?null:(int)$r['bonus'],'credit'=>$r['nominal']===null?(float)$r['legacy_credit']:(int)$r['nominal']+(int)$r['bonus'],'method'=>$r['method'],
        'status'=>$status,'created_time'=>(int)$r['created_epoch'],'cancel_after'=>$r['nominal']===null?0:(int)$r['created_epoch']+600,
        'cancelled_at'=>$r['cancelled_at'],'paid_at'=>$r['paid_at'],
        'transaction'=>$data ? array_merge($data,['merchant_ref'=>$r['merchant_ref'],'status'=>$status,
            'deposit_amount'=>(int)$r['nominal'],'saldo_masuk'=>(int)$r['nominal']+(int)$r['bonus'],
            'total_due'=>(int)$data['amount'],'created_time'=>(int)$r['created_epoch']]) : null];
}
/** Verify immutable invoice identity and nominal against gateway (not net received). */
function di_validate($r,$data) {
    if (!is_array($data) || ($data['merchant_ref']??'')!==$r['merchant_ref'] || empty($data['reference']) ||
        (!empty($r['reference']) && $data['reference']!==$r['reference']) ||
        strtoupper($data['payment_method']??'')!==strtoupper($r['method']) ||
        (int)($data['amount']??0)-(int)($data['fee_customer']??0)!==(int)$r['nominal'] ||
        !in_array($data['status']??'', ['UNPAID','PAID','FAILED','EXPIRED','REFUND'],true)) {
        throw new Exception('Data gateway tidak cocok dengan invoice tersimpan. Hubungi admin.');
    }
}
/** Terminal snapshots never resurrect an active slot; late verified PAID still wins. */
function di_next_status($stored,$live) {
    if ($stored==='PAID' || $live==='PAID') return 'PAID';
    return in_array($stored,['CANCELLED','FAILED','EXPIRED','REFUND'],true)?$stored:$live;
}
function di_apply($conn,$ref,$data) {
    $before=di_row($conn,$ref);if(!$before)throw new Exception('Invoice tidak ditemukan.');
    di_validate($before,$data);
    $conn->begin_transaction();
    try {
        // Same lock order in create/apply/cancel. Unique ledger protects duplicate callbacks.
        cp_q($conn,'SELECT id FROM users WHERE id=? FOR UPDATE','i',(int)$before['user_id'])->close();
        $r=di_row($conn,$ref,null,true);di_validate($r,$data);
        $status=di_next_status($r['status'],$data['status']);
        if ($status==='PAID') {
            $uid=(int)$r['user_id'];$credit=(int)$r['nominal']+(int)$r['bonus'];$reference=$data['reference'];$method=$r['method'];
            $st=cp_q($conn,"INSERT IGNORE INTO deposits (merchant_ref,reference,user_id,amount,method,status,source,paid_at) VALUES (?,?,?,?,?,'paid','tripay',NOW())",'ssids',$ref,$reference,$uid,$credit,$method);
            $new=$st->affected_rows===1;$st->close();
            if($new) {
                $st=cp_q($conn,'UPDATE users SET balance=balance+? WHERE id=?','ii',$credit,$uid);
                if($st->affected_rows!==1)throw new Exception('Akun penerima tidak ditemukan.');$st->close();
            }
        }
        $active=in_array($status,['UNPAID','PENDING','CREATING'],true)?(int)$r['user_id']:null;
        $json=json_encode($data,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
        cp_q($conn,"UPDATE deposit_invoices SET reference=?,invoice_json=?,status=?,active_user_id=?,paid_at=IF(?='PAID',COALESCE(paid_at,NOW()),paid_at) WHERE merchant_ref=?",'sssiss',$data['reference'],$json,$status,$active,$status,$ref)->close();
        $conn->commit();return di_row($conn,$ref);
    } catch(Throwable $e){$conn->rollback();throw $e;}
}
function di_sync($conn,$r,$gatewayRef=null) {
    $reference=$r['reference'] ?: $gatewayRef;
    if(!$reference)throw new Exception('Invoice masih menunggu konfirmasi gateway. Jika berlanjut, hubungi admin dengan ID '.$r['merchant_ref'].'. Jangan buat ulang transaksi.');
    return di_apply($conn,$r['merchant_ref'],di_gateway('/status?reference='.rawurlencode($reference)));
}
