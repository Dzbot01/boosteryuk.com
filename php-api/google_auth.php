<?php
/** Google OAuth redirect terpusat + endpoint ID-token legacy.
 * Redirect URI tunggal: https://boosteryuk.com/api/google_auth.php?action=callback
 * Lihat docs/google-central-login.md. Secret hanya di .env server.
 */

ob_start();
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

function out($d, $s = 200) {
    while (ob_get_level()) ob_end_clean();
    if (!headers_sent()) { http_response_code($s); header('Content-Type: application/json; charset=utf-8'); }
    echo json_encode($d, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
set_exception_handler(function ($e) {
    if (!empty($GLOBALS['oauthExchange']) && isset($GLOBALS['sdb'])) oauth_rollback($GLOBALS['sdb']);
    out(['ok'=>false,'message'=>'Login tidak dapat diproses. Coba ulang atau hubungi admin.'],500);
});
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        while (ob_get_level()) ob_end_clean();
        if (!headers_sent()) { http_response_code(200); header('Content-Type: application/json; charset=utf-8'); }
        echo json_encode(['ok' => false, 'message' => 'Terjadi kesalahan server saat login. Silakan coba lagi.']);
    }
});

/* ===================== .env loader (tanpa dependency) ===================== */
function load_env_file($file) {
    $vars = [];
    if (!is_file($file) || !is_readable($file)) return $vars;
    $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) return $vars;
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (stripos($line, 'export ') === 0) $line = trim(substr($line, 7));
        $eq = strpos($line, '=');
        if ($eq === false) continue;
        $k = trim(substr($line, 0, $eq));
        $v = trim(substr($line, $eq + 1));
        if (strlen($v) >= 2) {
            $first = $v[0]; $last = substr($v, -1);
            if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) $v = substr($v, 1, -1);
        }
        if ($k !== '') $vars[$k] = $v;
    }
    return $vars;
}
function env_val($key) {
    static $cache = null;
    if ($cache === null) {
        $cache = array_merge(
            load_env_file(dirname(__DIR__) . '/.env'), // root repo (lokal)
            load_env_file(__DIR__ . '/.env')           // folder api/ (hosting)
        );
    }
    if (isset($cache[$key]) && trim((string)$cache[$key]) !== '') return trim((string)$cache[$key]);
    $v = getenv($key);
    return (is_string($v) && trim($v) !== '') ? trim($v) : null;
}

$GOOGLE_CLIENT_ID     = env_val('GOOGLE_CLIENT_ID');
$GOOGLE_CLIENT_SECRET = env_val('GOOGLE_CLIENT_SECRET'); // wajib untuk redirect flow server-side

/* ===================== GET ?action=client_id (publik) ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'client_id') {
    if (!$GOOGLE_CLIENT_ID) out(['ok' => false, 'message' => 'GOOGLE_CLIENT_ID belum di-set di .env server.']);
    out(['ok' => true, 'clientId' => $GOOGLE_CLIENT_ID]);
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) $in = [];

// Capture routing before configdb.php: included legacy config files must not overwrite it.
define('GOOGLE_OAUTH_REQUEST_ACTION', (string)($_GET['action'] ?? ($in['action'] ?? '')));
$oauthFile = __DIR__ . '/google_oauth_flow.php';
if (GOOGLE_OAUTH_REQUEST_ACTION === 'oauth_status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $ready = is_file($oauthFile) && (bool)$GOOGLE_CLIENT_ID && (bool)$GOOGLE_CLIENT_SECRET;
    out(['ok'=>true, 'protocol'=>1, 'redirect_ready'=>$ready,
        'message'=>$ready ? 'Login redirect tersedia.' : 'Upload google_auth.php dan google_oauth_flow.php terbaru, lalu isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di server.']);
}
if (in_array(GOOGLE_OAUTH_REQUEST_ACTION, ['start','callback','exchange'], true) && !is_file($oauthFile)) {
    out(['ok'=>false,'message'=>'File OAuth server belum lengkap. Upload google_auth.php dan google_oauth_flow.php dari versi yang sama.'],503);
}

/* ===================== Koneksi DB (pakai configdb.php, pola sama spt site_settings.php) ===================== */
if (!is_file(__DIR__ . '/configdb.php')) out(['ok' => false, 'message' => 'configdb.php tidak ditemukan di folder api.']);
require_once __DIR__ . '/configdb.php';

function google_db() {
    foreach (['conn', 'koneksi', 'db', 'mysqli', 'con', 'link', 'pdo', 'connection'] as $v) {
        if (isset($GLOBALS[$v]) && ($GLOBALS[$v] instanceof mysqli || $GLOBALS[$v] instanceof PDO)) return $GLOBALS[$v];
    }
    $g = $GLOBALS;
    $host = defined('DB_HOST') ? DB_HOST : ($g['host'] ?? $g['db_host'] ?? $g['servername'] ?? $g['hostname'] ?? 'localhost');
    $user = defined('DB_USER') ? DB_USER : ($g['user'] ?? $g['username'] ?? $g['db_user'] ?? $g['dbuser'] ?? null);
    $pass = defined('DB_PASS') ? DB_PASS : (defined('DB_PASSWORD') ? DB_PASSWORD : ($g['pass'] ?? $g['password'] ?? $g['db_pass'] ?? $g['dbpass'] ?? ''));
    $name = defined('DB_NAME') ? DB_NAME : ($g['dbname'] ?? $g['db_name'] ?? $g['database'] ?? $g['dbName'] ?? (is_string($g['db'] ?? null) ? $g['db'] : null));
    if (!$user || !$name) return null;
    $m = @new mysqli($host, $user, $pass, $name);
    if ($m->connect_errno) return null;
    return $m;
}
function q_exec($db, $sql, $params = []) {
    if ($db instanceof PDO) {
        $st = $db->prepare($sql);
        $st->execute($params);
        return $st;
    }
    $st = $db->prepare($sql);
    if (!$st) throw new Exception('Query gagal: ' . $db->error);
    if ($params) $st->bind_param(str_repeat('s', count($params)), ...$params);
    if (!$st->execute()) throw new Exception('Query gagal.');
    return $st;
}
function q_row($db, $sql, $params = []) {
    $st = q_exec($db, $sql, $params);
    if ($db instanceof PDO) return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    $res = $st->get_result();
    return $res ? ($res->fetch_assoc() ?: null) : null;
}
function q_rows($db, $sql, $params = []) {
    $st = q_exec($db, $sql, $params);
    if ($db instanceof PDO) return $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
    $res = $st->get_result();
    return $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
}
function table_columns($db, $table) {
    static $cache = [];
    $key = (is_object($db) ? spl_object_id($db) : 'db') . ':' . $table;
    if (!isset($cache[$key])) {
        $rows = q_rows($db, "SHOW COLUMNS FROM `" . str_replace('`', '', $table) . "`");
        $cache[$key] = array_map(function ($r) { return strtolower($r['Field'] ?? array_values($r)[0]); }, $rows);
    }
    return $cache[$key];
}

$sdb = google_db();
if (!$sdb) out(['ok' => false, 'message' => 'Koneksi database dari configdb.php tidak terbaca.']);
if ($sdb instanceof mysqli) $sdb->set_charset('utf8mb4');
if ($sdb instanceof PDO) $sdb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

/* ===================== Ambil & verifikasi ID token ke Google ===================== */
function http_get_json($url, $timeout = 10) {
    $body = null;
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_FOLLOWLOCATION => true]);
        $body = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code < 200 || $code >= 300) return null;
    } else {
        $ctx = stream_context_create(['http' => ['timeout' => $timeout, 'ignore_errors' => true]]);
        $body = @file_get_contents($url, false, $ctx);
    }
    $json = $body ? json_decode($body, true) : null;
    return is_array($json) ? $json : null;
}

require_once __DIR__ . '/google_oauth_flow.php';
// Redirect actions must never fall through into the legacy ID-token POST handler.
if (in_array(GOOGLE_OAUTH_REQUEST_ACTION, ['start','callback'], true) && !$oauthCallback) {
    out(['ok'=>false,'message'=>'Handler redirect OAuth tidak cocok. Upload ulang kedua file PHP OAuth terbaru dan bersihkan OPcache hosting.'],503);
}
if (GOOGLE_OAUTH_REQUEST_ACTION === 'exchange' && !$oauthExchange) {
    out(['ok'=>false,'message'=>'Handler pertukaran OAuth tidak cocok. Upload ulang kedua file PHP OAuth terbaru.'],503);
}
if (!$oauthExchange) {
if (!$oauthCallback) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['ok'=>false,'message'=>'Metode tidak didukung.'],405);
    $credential = trim((string)($in['credential'] ?? ''));
    if (!$GOOGLE_CLIENT_ID || !$credential || strlen($credential)>8192) out(['ok'=>false,'message'=>'Credential Google tidak valid.'],400);
}
$tokenInfo = http_get_json('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential));
if (!$tokenInfo) out(['ok' => false, 'message' => 'Token Google tidak dapat diverifikasi. Coba login ulang.']);

$aud = (string)($tokenInfo['aud'] ?? '');
$iss = (string)($tokenInfo['iss'] ?? '');
$exp = (int)($tokenInfo['exp'] ?? 0);
$email = strtolower(trim((string)($tokenInfo['email'] ?? '')));
$emailVerified = $tokenInfo['email_verified'] ?? false;

if ($aud !== $GOOGLE_CLIENT_ID) out(['ok' => false, 'message' => 'Token Google bukan untuk aplikasi ini (aud tidak cocok).']);
if (!in_array($iss, ['accounts.google.com', 'https://accounts.google.com'], true)) out(['ok' => false, 'message' => 'Issuer token Google tidak valid.']);
if ($exp <= time()) out(['ok' => false, 'message' => 'Sesi Google kedaluwarsa. Coba lagi.']);
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) out(['ok' => false, 'message' => 'Akun Google tidak mengirim email yang valid.']);
if (!($emailVerified === true || $emailVerified === 1 || $emailVerified === '1' || $emailVerified === 'true')) {
    out(['ok' => false, 'message' => 'Email akun Google belum terverifikasi.']);
}
if ($oauthCallback && !hash_equals($oauthState['nonce'], (string)($tokenInfo['nonce'] ?? ''))) out(['ok'=>false,'message'=>'Nonce Google tidak cocok.'],400);
$googleSub = (string)($tokenInfo['sub'] ?? '');
$googleName = trim((string)($tokenInfo['name'] ?? $tokenInfo['given_name'] ?? ''));
$firstName = $googleName !== '' ? $googleName : explode('@', $email)[0];

/* ===================== Cari / buat user di tabel `users` ===================== */
$userCols = table_columns($sdb, 'users');
$has = function ($col) use ($userCols) { return in_array(strtolower($col), $userCols, true); };

$user = q_row($sdb, "SELECT * FROM `users` WHERE LOWER(email) = LOWER(?) LIMIT 1", [$email]);

if (!$user) {
    // Username unik dari prefix email (register.php mewajibkan username).
    $base = preg_replace('/[^a-z0-9_.-]+/', '', strtolower(explode('@', $email)[0]));
    if ($base === '') $base = 'user';
    $username = $base;
    $suffix = 0;
    while (true) {
        $exists = q_row($sdb, "SELECT id FROM `users` WHERE LOWER(username) = LOWER(?) LIMIT 1", [$username]);
        if (!$exists) break;
        $suffix++;
        $username = $base . ($suffix > 1 ? random_int(100, 9999) : $suffix);
        if ($suffix > 20) { $username = $base . random_int(10000, 999999); break; }
    }

    $cols = ['username', 'email'];
    $vals = [$username, $email];
    $literals = [];
    if ($has('password'))       { $cols[] = 'password';       $vals[] = password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT); }
    if ($has('name'))           { $cols[] = 'name';           $vals[] = mb_substr($firstName, 0, 100); }
    if ($has('fullname'))       { $cols[] = 'fullname';       $vals[] = mb_substr($firstName, 0, 100); }
    if ($has('nama'))           { $cols[] = 'nama';           $vals[] = mb_substr($firstName, 0, 100); }
    if ($has('balance'))        { $cols[] = 'balance';        $vals[] = '0'; }
    if ($has('role'))           { $cols[] = 'role';           $vals[] = 'user'; }
    if ($has('plus_active'))    { $cols[] = 'plus_active';    $vals[] = '0'; }
    if ($has('email_verified')) { $cols[] = 'email_verified'; $vals[] = '1'; }
    if ($has('email_verified_at')) { $literals['email_verified_at'] = 'NOW()'; }
    if ($has('created_at'))     { $literals['created_at'] = 'NOW()'; }
    if ($has('updated_at'))     { $literals['updated_at'] = 'NOW()'; }
    if ($has('google_sub'))     { $cols[] = 'google_sub';     $vals[] = $googleSub !== '' ? $googleSub : null; }

    $insertCols = $cols;
    $placeholders = array_fill(0, count($cols), '?');
    foreach ($literals as $col => $lit) { $insertCols[] = $col; $placeholders[] = $lit; }
    $sql = "INSERT INTO `users` (`" . implode('`,`', $insertCols) . "`) VALUES (" . implode(',', $placeholders) . ")";

    try {
        q_exec($sdb, $sql, $vals);
        $user = q_row($sdb, "SELECT * FROM `users` WHERE LOWER(email) = LOWER(?) LIMIT 1", [$email]);
    } catch (Throwable $e) {
        // Bisa kalah race (email kembar) → coba baca lagi.
        $user = q_row($sdb, "SELECT * FROM `users` WHERE LOWER(email) = LOWER(?) LIMIT 1", [$email]);
        if (!$user) out(['ok' => false, 'message' => 'Gagal membuat akun. Silakan coba lagi.']);
    }
}

if (!$user) out(['ok' => false, 'message' => 'Gagal memuat data user.']);
} // end Google identity verification / account lookup (exchange already loaded the user)
$firstName = $firstName ?? (string)($user['name'] ?? $user['username'] ?? 'User');
$email = $email ?? (string)$user['email'];
$uid = $user['id'] ?? null;
if (!$uid) out(['ok' => false, 'message' => 'ID user tidak ditemukan.']);

if ($oauthCallback) {
    if (!oauth_host_allowed($sdb,$oauthState['return_host'])) out(['ok'=>false,'message'=>'Panel tujuan tidak aktif.'],400);
    $grant = bin2hex(random_bytes(32));
    q_exec($sdb, 'INSERT INTO google_oauth_grants (token_hash,user_id,return_host,challenge,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(), INTERVAL 1 MINUTE))', [hash('sha256',$grant),$uid,$oauthState['return_host'],$oauthState['challenge']]);
    oauth_redirect('https://'.$oauthState['return_host'].'/auth/finish?token='.rawurlencode($grant));
}

/* ===================== Buat sesi login (tabel `sessions`) ===================== */
$sessionCols = table_columns($sdb, 'sessions'); // token, user_id, expires_at
$token = bin2hex(random_bytes(32)); // 64 karakter hex
try {
    if (in_array('expires_at', $sessionCols, true)) {
        q_exec($sdb, "INSERT INTO `sessions` (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))", [$token, (string)$uid]);
    } else {
        q_exec($sdb, "INSERT INTO `sessions` (token, user_id) VALUES (?, ?)", [$token, (string)$uid]);
    }
    if ($oauthExchange) oauth_commit($sdb);
} catch (Throwable $e) {
    if ($oauthExchange) oauth_rollback($sdb);
    out(['ok' => false, 'message' => 'Gagal membuat sesi login. Coba lagi.']);
}

/* ===================== Response (format diharapkan frontend AuthContext) ===================== */
$name = '';
foreach (['name', 'fullname', 'nama'] as $cand) { if (!empty($user[$cand])) { $name = (string)$user[$cand]; break; } }
if ($name === '') $name = (string)($user['username'] ?? $firstName);
$username = (string)($user['username'] ?? explode('@', $email)[0]);
$role = strtolower((string)($user['role'] ?? 'user'));
$balance = (float)($user['balance'] ?? 0);
$plusActive = false;
if (array_key_exists('plus_active', $user)) $plusActive = ((int)$user['plus_active'] === 1 || $user['plus_active'] === '1' || $user['plus_active'] === true);
$initials = strtoupper(mb_substr(preg_replace('/[^\p{L}\p{N}]/u', '', $username) ?: $email, 0, 2));
$joined = '';
foreach (['created_at', 'joined_at', 'registered_at', 'created'] as $cand) {
    if (!empty($user[$cand]) && strtotime((string)$user[$cand])) { $joined = date('d M Y', strtotime((string)$user[$cand])); break; }
}
if ($joined === '') $joined = date('d M Y');

out([
    'ok' => true,
    'token' => $token,
    'user' => [
        'id' => is_numeric($uid) ? (int)$uid : $uid,
        'name' => $name,
        'username' => $username,
        'email' => (string)($user['email'] ?? $email),
        'initials' => $initials,
        'joined' => $joined,
        'phone' => (string)($user['phone'] ?? $user['no_hp'] ?? ''),
        'timezone' => (string)($user['timezone'] ?? ''),
        'balance' => $balance,
        'role' => $role,
        'plusActive' => $plusActive,
        'email_verified' => true,
    ],
]);
