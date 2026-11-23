<?php
header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Headers: Content-Type');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if($_SERVER['REQUEST_METHOD']==='OPTIONS'){http_response_code(204);exit;}
require_once __DIR__.'/naizop_lib.php';
$in=json_decode(file_get_contents('php://input'),true);$ids=explode(',',(string)($in['id']??''));
if(!$ids || count($ids)>100){http_response_code(400);echo json_encode(['status'=>false,'msg'=>'ID tidak valid.']);exit;}
$out=[];$numeric=[];
foreach($ids as $id){
    if(preg_match('/^S2-([0-9]+)$/',$id,$m))$numeric[$id]=$m[1];
    elseif(preg_match('/^S2-PENDING-[a-f0-9]{16}$/',$id))$out[$id]=['order_status'=>'pending','msg'=>'Menunggu pemeriksaan pengiriman oleh admin.'];
    else {http_response_code(400);echo json_encode(['status'=>false,'msg'=>'Gunakan ID Server 2.']);exit;}
}
try{
    if($numeric){
        $result=n2_call('status',['orders'=>implode(',',array_values($numeric))]);
        foreach($numeric as $id=>$providerId){$r=$result[$providerId]??[];
            $out[$id]=isset($r['status'])?['order_status'=>strtolower($r['status']),'start_count'=>$r['start_count']??null,'remains'=>$r['remains']??null,'msg'=>'Status Server 2.']:['msg'=>'Status belum dapat dimuat.'];
        }
    }
    // charge is deliberately omitted: provider USD must not be displayed as rupiah.
    echo json_encode(['status'=>true,'orders'=>$out]);
}catch(Throwable $e){http_response_code(503);echo json_encode(['status'=>false,'msg'=>'Status Server 2 belum dapat dimuat.']);}
