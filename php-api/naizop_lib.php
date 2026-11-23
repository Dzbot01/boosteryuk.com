<?php
/** Naizop adapter: all credentials, USD conversion and price validation stay in PHP. */
function n2_http($url, $post=null) {
    $ch=curl_init($url);
    $options=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_FOLLOWLOCATION=>false];
    if($post!==null){$options[CURLOPT_POST]=true;$options[CURLOPT_POSTFIELDS]=http_build_query($post);}
    curl_setopt_array($ch,$options);$raw=curl_exec($ch);$code=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    $j=json_decode((string)$raw,true);
    if($code!==200 || !is_array($j))throw new RuntimeException('Provider 2 tidak dapat dihubungi.');
    return $j;
}
function n2_key() {
    $config=is_file(__DIR__.'/naizop_config.php')?require __DIR__.'/naizop_config.php':[];
    $key=is_array($config)?trim($config['api_key']??''):'';
    if(!$key)throw new RuntimeException('Server 2 belum dikonfigurasi oleh admin.');
    return $key;
}
function n2_call($action,$data=[]) {
    return n2_http('https://naizop.com/api/v2',array_merge($data,['key'=>n2_key(),'action'=>$action]));
}
function n2_cache_read($name,$ttl) {
    $path=__DIR__.'/naizop_'.$name.'_cache.json';
    if(!is_file($path) || time()-filemtime($path)>$ttl)return null;
    $j=json_decode((string)@file_get_contents($path),true);return is_array($j)?$j:null;
}
function n2_cache_write($name,$data){@file_put_contents(__DIR__.'/naizop_'.$name.'_cache.json',json_encode($data),LOCK_EX);}
function n2_fx_valid($j) {
    return is_array($j) && ($j['result']??'')==='success' && ($j['base_code']??'')==='USD'
        && is_numeric($j['rates']['IDR']??null) && is_finite((float)$j['rates']['IDR']) && (float)$j['rates']['IDR']>0
        && is_numeric($j['time_last_update_unix']??null) && (int)$j['time_last_update_unix']<=time()+300
        && time()-(int)$j['time_last_update_unix']<=172800;
}
function n2_fx() {
    $j=n2_cache_read('fx',3600);
    if(!n2_fx_valid($j)) {
        // Published daily reference rate; never accept a rate supplied by a browser.
        $j=n2_http('https://open.er-api.com/v6/latest/USD');
        if(!n2_fx_valid($j))throw new RuntimeException('Kurs USD ke rupiah terbaru belum dapat diverifikasi.');
        n2_cache_write('fx',$j);
    }
    return ['rate'=>(float)$j['rates']['IDR'],'updated_at'=>(int)$j['time_last_update_unix']];
}
/** Clean presentation fields only: upstream IDs, prices and targets remain untouched. */
function n2_label($value) {
    $text=(string)$value;
    for($i=0;$i<3;$i++)$text=html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace("/\\bnaizop(?:\\s*['’‘`´]\\s*s|s)?\\b/iu", 'Boosteryuk', $text));
}
function n2_catalogue() {
    // Config and account currency must be verified before any debit, even with cached services.
    $fingerprint=hash('sha256',n2_key());
    $cached=n2_cache_read('services',600);
    $list=($cached['account']??'')===$fingerprint ? ($cached['services']??null) : null;
    if(!$list){
        $account=n2_call('balance');
        if(($account['currency']??'')!=='USD')throw new RuntimeException('Mata uang akun Server 2 harus USD.');
        $list=n2_call('services');
        if(isset($list['error']) || !$list || !isset($list[0]['service']))throw new RuntimeException('Layanan Server 2 tidak tersedia.');
        n2_cache_write('services',['account'=>$fingerprint,'services'=>$list]);
    }
    $fx=n2_fx();$out=[];
    foreach($list as $s){
        // Existing default order UI can fulfill Default services; do not sell unsupported required fields.
        if(strtolower(trim($s['type']??''))!=='default' || !is_numeric($s['rate']??null) || !is_finite((float)$s['rate']) || (float)$s['rate']<0 || !preg_match('/^\d+$/',(string)($s['service']??'')))continue;
        $s['name']=n2_label($s['name']??'');
        $s['category']=n2_label($s['category']??'');
        $s['rate']=round((float)$s['rate']*$fx['rate'],6);
        $s['refill']=false;$s['cancel']=false; // Server 2 post-order actions are not exposed yet.
        $out[]=$s;
    }
    if(!$out)throw new RuntimeException('Belum ada layanan Default pada Server 2.');
    return ['services'=>$out,'fx'=>$fx];
}
function n2_validate_service($service,$qty) {
    $catalogue=n2_catalogue();
    foreach($catalogue['services'] as $s)if((string)$s['service']===(string)$service){
        if($qty<(int)$s['min'] || $qty>(int)$s['max'])throw new RuntimeException('Jumlah di luar batas layanan Server 2.');
        return $s;
    }
    throw new RuntimeException('Layanan Server 2 tidak tersedia atau membutuhkan parameter khusus.');
}
