<?php
/** Resolve only Google's public Maps shortlinks; never fetch arbitrary user-supplied hosts. */
header('Access-Control-Allow-Origin: *');header('Access-Control-Allow-Headers: Content-Type');header('Access-Control-Allow-Methods: POST, OPTIONS');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')==='OPTIONS'){http_response_code(204);exit;}
function mp_out($data,$code=200){http_response_code($code);echo json_encode($data,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
function mp_kind($url){
    $p=parse_url($url);if(!$p || ($p['scheme']??'')!=='https' || isset($p['user']) || isset($p['pass']) || isset($p['port']))return null;
    $h=strtolower($p['host']??'');$path=$p['path']??'/';
    if(($h==='maps.app.goo.gl' && strlen($path)>1) || ($h==='goo.gl' && strpos($path,'/maps/')===0))return 'short';
    if(preg_match('/^(?:(?:www|maps)\.)?google\.(?:com|co\.id|co\.uk|com\.au|co\.jp|co\.in|com\.sg|com\.my|ca|de|fr)$/',$h) && (strpos($h,'maps.')===0 || preg_match('~^/maps(?:/|$)~',$path)))return 'map';
    return null;
}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')mp_out(['ok'=>false],405);
$in=json_decode(file_get_contents('php://input'),true);$url=$in['url']??null;
if(!is_string($url) || strlen($url)>4096 || preg_match('/[\x00-\x20\x7f\\\\]/',$url) || mp_kind($url)!=='short')mp_out(['ok'=>false],400);
try{
    $started=microtime(true);
    for($i=0;$i<4;$i++){
        $kind=mp_kind($url);
        if($kind==='map')mp_out(['ok'=>true,'url'=>$url]);
        if($kind!=='short' || microtime(true)-$started>6)break;
        $location=null;$ch=curl_init($url);
        curl_setopt_array($ch,[CURLOPT_NOBODY=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>2,CURLOPT_TIMEOUT=>2,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERAGENT=>'Boosteryuk-Maps-Preview/1.0',CURLOPT_HEADERFUNCTION=>function($ch,$line)use(&$location){if(stripos($line,'Location:')===0)$location=trim(substr($line,9));return strlen($line);}]);
        curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
        if($status<300 || $status>=400 || !$location || strlen($location)>16384 || preg_match('/[\x00-\x20\x7f\\\\]/',$location))break;
        // Every redirect is validated before any subsequent network request. No arbitrary redirects.
        if(!mp_kind($location))break;
        $url=$location;
    }
}catch(Throwable $e){ /* Fail closed; frontend retains original Maps link. */ }
mp_out(['ok'=>false],422);
