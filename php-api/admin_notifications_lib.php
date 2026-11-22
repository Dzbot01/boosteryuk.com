<?php
/** Read-only markers for root-admin navigation. Never create/import financial rows. */
function an_max($conn,$table,$column='id',$time=false,$where='') {
    // Every identifier / predicate is a hard-coded caller value, never request input.
    $cols=ad_cols($conn,$table);
    if(!$cols || !isset($cols[$column]))return 0;
    $expr=$time?"UNIX_TIMESTAMP(`$column`)":"`$column`";
    $r=$conn->query("SELECT COALESCE(MAX($expr),0) AS marker FROM `$table`".($where?" WHERE $where":''));
    return (float)$r->fetch_assoc()['marker'];
}
function an_snapshot($conn) {
    $orders=an_max($conn,'riwayat_pesanan');
    $users=an_max($conn,'users');
    $deposits=an_max($conn,'deposits');
    $manual=an_max($conn,'admin_balance_log','id',false,'amount>0');
    $profit=an_max($conn,'smm_order_profit');
    $events=['events'=>an_max($conn,'site_events'),'updated'=>an_max($conn,'site_events','updated_at',true),'entries'=>an_max($conn,'event_game_receipts')];
    $settings=['updated'=>an_max($conn,'site_settings','updated_at',true)];
    $nxcols=ad_cols($conn,'nexspace_orders');
    $markers = [
        '/admin/orders'=>['orders'=>$orders],
        '/admin/users'=>['users'=>$users],
        '/admin/deposit'=>['deposits'=>$deposits,'manual'=>$manual],
        '/admin/profit'=>['orders'=>$orders,'deposits'=>$deposits,'manual'=>$manual,'profit'=>$profit],
        '/admin/child-panel'=>['panels'=>an_max($conn,'child_panels'),'domains'=>an_max($conn,'child_panel_domains')],
        '/admin/withdraw'=>['requests'=>an_max($conn,'child_panel_withdrawals')],
        '/admin/nexspace'=>['orders'=>isset($nxcols['tier'])?an_max($conn,'nexspace_orders','id',false,"tier='pro'"):0],
        '/admin/events'=>$events,
        '/event'=>$events,
        '/admin/website'=>$settings,
    ];
    if(ad_cols($conn,'event_game_receipts')) {
        $rows=$conn->query('SELECT event_id,MAX(id) AS marker FROM event_game_receipts GROUP BY event_id');
        while($row=$rows->fetch_assoc())$markers['/admin/events/'.(int)$row['event_id'].'/data']=['entries'=>(float)$row['marker']];
    }
    return $markers;
}
