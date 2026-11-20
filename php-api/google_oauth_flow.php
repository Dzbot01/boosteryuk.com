<?php
// Included by google_auth.php after DB/helpers are initialized. No client secrets in URLs.
const OAUTH_CENTER = 'https://boosteryuk.com';
const OAUTH_CALLBACK = OAUTH_CENTER . '/api/google_auth.php?action=callback';
function oauth_redirect($url) {
    while (ob_get_level()) ob_end_clean();
    header('Referrer-Policy: no-referrer'); header('Location: ' . $url, true, 303); exit;
}
function oauth_host_allowed($db, $host) {
    if (in_array($host, ['boosteryuk.com','www.boosteryuk.com','app.boosteryuk.com'], true)) return true;
    if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?\.boosteryuk\.com$/D', $host)) return false;
    if (in_array(explode('.', $host)[0], ['www','api','app','wa-origin'], true)) return false;
    return (bool)q_row($db, "SELECT p.id FROM child_panel_domains d JOIN child_panels p ON p.id=d.child_panel_id WHERE d.hostname=? AND p.status='active' AND (p.expires_at IS NULL OR p.expires_at>NOW()) LIMIT 1", [$host]);
}
function oauth_begin($db) { if ($db instanceof PDO) $db->beginTransaction(); else $db->begin_transaction(); }
function oauth_commit($db) { $db->commit(); }
function oauth_rollback($db) { if ($db instanceof PDO) { if ($db->inTransaction()) $db->rollBack(); } else $db->rollback(); }
function oauth_schema($db) {
    q_exec($db, "CREATE TABLE IF NOT EXISTS google_oauth_states (
        state_hash CHAR(64) PRIMARY KEY, browser_hash CHAR(64) NOT NULL,
        return_host VARCHAR(190) NOT NULL, challenge CHAR(43) NOT NULL,
        nonce CHAR(64) NOT NULL, verifier VARCHAR(128) NOT NULL,
        expires_at DATETIME NOT NULL, KEY idx_exp (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    q_exec($db, "CREATE TABLE IF NOT EXISTS google_oauth_grants (
        token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL,
        return_host VARCHAR(190) NOT NULL, challenge CHAR(43) NOT NULL,
        expires_at DATETIME NOT NULL, KEY idx_exp (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    q_exec($db, 'DELETE FROM google_oauth_states WHERE expires_at<NOW()');
    q_exec($db, 'DELETE FROM google_oauth_grants WHERE expires_at<NOW()');
}
function oauth_challenge($verifier) { return rtrim(strtr(base64_encode(hash('sha256',$verifier,true)), '+/', '-_'), '='); }
$oauthAction = $_GET['action'] ?? ($in['action'] ?? '');
$oauthCallback = false; $oauthExchange = false;
if (in_array($oauthAction, ['start','callback','exchange'], true)) {
    oauth_schema($sdb);
    header('Referrer-Policy: no-referrer');
    if ($oauthAction === 'start') {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET' || !empty($_SERVER['HTTP_X_CHILD_PANEL'])) out(['ok'=>false,'message'=>'Mulai login dari domain pusat.'],400);
        $host = (string)($_GET['return'] ?? '');
        $challenge = (string)($_GET['challenge'] ?? '');
        if (!oauth_host_allowed($sdb,$host) || !preg_match('/^[A-Za-z0-9_-]{43}$/D',$challenge)) out(['ok'=>false,'message'=>'Tujuan login tidak valid atau panel sudah tidak aktif.'],400);
        if (!$GOOGLE_CLIENT_ID || !$GOOGLE_CLIENT_SECRET) out(['ok'=>false,'message'=>'OAuth server belum dikonfigurasi.'],503);
        $state=bin2hex(random_bytes(32)); $browser=bin2hex(random_bytes(32)); $nonce=bin2hex(random_bytes(32)); $verifier=bin2hex(random_bytes(32));
        setcookie('__Host-by_google', $browser, ['expires'=>time()+600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
        q_exec($sdb, 'INSERT INTO google_oauth_states (state_hash,browser_hash,return_host,challenge,nonce,verifier,expires_at) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(), INTERVAL 10 MINUTE))', [hash('sha256',$state),hash('sha256',$browser),$host,$challenge,$nonce,$verifier]);
        oauth_redirect('https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query(['client_id'=>$GOOGLE_CLIENT_ID,'redirect_uri'=>OAUTH_CALLBACK,'response_type'=>'code','scope'=>'openid email profile','state'=>$state,'nonce'=>$nonce,'code_challenge'=>oauth_challenge($verifier),'code_challenge_method'=>'S256','prompt'=>'select_account']));
    }
    if ($oauthAction === 'callback') {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET' || !empty($_SERVER['HTTP_X_CHILD_PANEL'])) out(['ok'=>false,'message'=>'Callback harus di domain pusat.'],400);
        $state=(string)($_GET['state'] ?? ''); $browser=(string)($_COOKIE['__Host-by_google'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/D',$state) || !preg_match('/^[a-f0-9]{64}$/D',$browser)) out(['ok'=>false,'message'=>'State login tidak valid. Mulai login ulang.'],400);
        oauth_begin($sdb);
        try {
            $oauthState=q_row($sdb,'SELECT * FROM google_oauth_states WHERE state_hash=? AND expires_at>NOW() FOR UPDATE',[hash('sha256',$state)]);
            if (!$oauthState || !hash_equals($oauthState['browser_hash'],hash('sha256',$browser))) { oauth_rollback($sdb); out(['ok'=>false,'message'=>'State login kedaluwarsa atau tidak cocok.'],400); }
            q_exec($sdb,'DELETE FROM google_oauth_states WHERE state_hash=?',[hash('sha256',$state)]); oauth_commit($sdb);
        } catch (Throwable $e) { oauth_rollback($sdb); out(['ok'=>false,'message'=>'Tidak dapat memverifikasi state.'],500); }
        setcookie('__Host-by_google','',['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
        if (!oauth_host_allowed($sdb,$oauthState['return_host'])) out(['ok'=>false,'message'=>'Panel tujuan tidak aktif.'],400);
        if (isset($_GET['error'])) oauth_redirect('https://'.$oauthState['return_host'].'/auth/finish?error=cancelled');
        $code=(string)($_GET['code'] ?? '');
        if (!$code || strlen($code)>4096) out(['ok'=>false,'message'=>'Kode Google tidak valid.'],400);
        $ch=curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query(['code'=>$code,'client_id'=>$GOOGLE_CLIENT_ID,'client_secret'=>$GOOGLE_CLIENT_SECRET,'redirect_uri'=>OAUTH_CALLBACK,'grant_type'=>'authorization_code','code_verifier'=>$oauthState['verifier']]),CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>15]);
        $body=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch); $j=json_decode((string)$body,true);
        if ($status!==200 || empty($j['id_token'])) out(['ok'=>false,'message'=>'Pertukaran kode Google gagal. Mulai login ulang.'],400);
        $credential=$j['id_token']; $oauthCallback=true;
    }
    if ($oauthAction === 'exchange') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['ok'=>false,'message'=>'Gunakan POST.'],405);
        $grant=(string)($in['token'] ?? ''); $proof=(string)($in['verifier'] ?? '');
        $origin=(string)($_SERVER['HTTP_ORIGIN'] ?? '');
        $host=parse_url($origin,PHP_URL_HOST);
        if (!$host || $origin !== 'https://'.$host || !oauth_host_allowed($sdb,$host) || !preg_match('/^[a-f0-9]{64}$/D',$grant) || !preg_match('/^[a-f0-9]{64}$/D',$proof)) out(['ok'=>false,'message'=>'Token atau origin login tidak valid.'],400);
        oauth_begin($sdb);
        try {
            $g=q_row($sdb,'SELECT * FROM google_oauth_grants WHERE token_hash=? AND expires_at>NOW() FOR UPDATE',[hash('sha256',$grant)]);
            if (!$g || $g['return_host']!==$host || !hash_equals($g['challenge'],oauth_challenge($proof))) { oauth_rollback($sdb); out(['ok'=>false,'message'=>'Token login telah digunakan, kedaluwarsa, atau browser tidak cocok.'],400); }
            q_exec($sdb,'DELETE FROM google_oauth_grants WHERE token_hash=?',[hash('sha256',$grant)]);
            $user=q_row($sdb,'SELECT * FROM users WHERE id=?',[$g['user_id']]);
            if (!$user) { oauth_rollback($sdb); out(['ok'=>false,'message'=>'Akun tidak ditemukan.'],400); }
            // Keep transaction open through session INSERT; commit in google_auth.php.
            $oauthExchange=true;
        } catch (Throwable $e) { oauth_rollback($sdb); out(['ok'=>false,'message'=>'Pertukaran token gagal.'],500); }
    }
}
