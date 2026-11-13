<?php
/**
 * site_settings.php — Simpan/ambil pengaturan website ke MySQL.
 * Upload ke: https://boosteryuk.com/api/site_settings.php  (satu folder dengan configdb.php)
 *
 * GET                     -> { ok, settings:{...}, updated_at }      (publik, untuk semua pengunjung)
 * POST {token, settings}  -> simpan (HANYA admin; token dicek di tabel sessions + users.role = 'admin')
 *
 * Kunci yang disimpan: infoItems (Berita), faviconUrl, overviewTitle, overviewSubtitle,
 * overviewMessage, brandName, brandSuffix, footerText,
 * + Tema: brandAccent, headerTint, menuActive (hex #rrggbb atau ''), headerOrnament (id set),
 *   heroImage (data URL JPEG/PNG/WebP, maks ~2 MB) -> disimpan TERPISAH di baris 'asset_hero'
 *   lalu settings.heroImageUrl = 'asset:hero:<versi>'.
 * GET ?asset=hero          -> file gambar hero (cache 1 tahun; URL berversi)
 * Tabel: site_settings (lihat site_settings.sql) — dibuat otomatis bila belum ada.
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
register_shutdown_function(function () {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        while (ob_get_level()) ob_end_clean();
        if (!headers_sent()) { http_response_code(200); header('Content-Type: application/json; charset=utf-8'); }
        echo json_encode(['ok' => false, 'message' => 'PHP error: ' . $e['message']]);
    }
});

/* ===================== Koneksi DB (pakai configdb.php) ===================== */
if (!is_file(__DIR__ . '/configdb.php')) out(['ok' => false, 'message' => 'configdb.php tidak ditemukan di folder api.']);
require_once __DIR__ . '/configdb.php';

/**
 * Deteksi koneksi dari configdb.php apa pun bentuknya:
 *  - objek mysqli: $conn / $koneksi / $db / $mysqli / $con / $link
 *  - objek PDO   : $pdo / $conn / $db
 *  - kredensial  : konstanta DB_HOST/DB_USER/DB_PASS(WORD)/DB_NAME atau variabel $host/$user/$pass/$dbname
 */
function site_db() {
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
    $st->execute();
    return $st;
}

function q_row($db, $sql, $params = []) {
    $st = q_exec($db, $sql, $params);
    if ($db instanceof PDO) return $st->fetch(PDO::FETCH_ASSOC) ?: null;
    $res = $st->get_result();
    return $res ? ($res->fetch_assoc() ?: null) : null;
}

$sdb = site_db();
if (!$sdb) out(['ok' => false, 'message' => 'Koneksi database dari configdb.php tidak terbaca.']);
if ($sdb instanceof mysqli) $sdb->set_charset('utf8mb4');
if ($sdb instanceof PDO) $sdb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

try {
    q_exec($sdb, "CREATE TABLE IF NOT EXISTS `site_settings` (
        `setting_key` VARCHAR(64) NOT NULL,
        `setting_value` LONGTEXT NOT NULL,
        `updated_by` VARCHAR(191) NULL,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`setting_key`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    out(['ok' => false, 'message' => 'Gagal membuat tabel: ' . $e->getMessage()]);
}

function load_site($db) {
    $row = q_row($db, "SELECT setting_value, updated_at FROM site_settings WHERE setting_key = 'site'");
    $val = $row ? json_decode($row['setting_value'], true) : [];
    return [is_array($val) ? $val : [], $row['updated_at'] ?? null];
}

/* ===================== GET ?asset=hero (gambar hero, publik) ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['asset'] ?? '') === 'hero') {
    $row = q_row($sdb, "SELECT setting_value FROM site_settings WHERE setting_key = 'asset_hero'");
    if (!$row || !preg_match('#^data:(image/(?:jpeg|png|webp));base64,(.+)$#s', $row['setting_value'], $m)) {
        while (ob_get_level()) ob_end_clean();
        http_response_code(404);
        exit;
    }
    $bin = base64_decode($m[2]);
    while (ob_get_level()) ob_end_clean();
    header_remove('Cache-Control');
    header('Content-Type: ' . $m[1]);
    header('Cache-Control: public, max-age=31536000, immutable'); // URL berversi (?v=)
    header('Content-Length: ' . strlen($bin));
    echo $bin;
    exit;
}

/* ===================== GET (publik) ===================== */
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        list($settings, $updated) = load_site($sdb);
        out(['ok' => true, 'settings' => (object)$settings, 'updated_at' => $updated]);
    } catch (Throwable $e) {
        out(['ok' => false, 'message' => $e->getMessage()]);
    }
}

/* ===================== POST (admin) ===================== */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(['ok' => false, 'message' => 'Metode tidak didukung.'], 405);

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) out(['ok' => false, 'message' => 'Body JSON tidak valid.'], 400);

/**
 * Verifikasi admin LANGSUNG di database (tanpa memanggil me.php lewat HTTP, karena
 * hosting gratis sering memblokir request server-ke-server dengan halaman anti-bot).
 * Memakai getUserIdByToken() dari configdb.php (tabel sessions), lalu cek users.role.
 */
function verify_admin($sdb, $token) {
    $token = trim((string)$token);
    if ($token === '') return [false, null, 'Token kosong. Silakan login sebagai admin.'];

    if (function_exists('getUserIdByToken')) {
        $uid = getUserIdByToken($token);
    } else {
        $r = q_row($sdb, "SELECT user_id FROM sessions WHERE token = ? AND expires_at > NOW() LIMIT 1", [$token]);
        $uid = $r['user_id'] ?? null;
    }
    if (!$uid) return [false, null, 'Sesi tidak valid / kedaluwarsa. Login ulang sebagai admin.'];

    $u = q_row($sdb, "SELECT * FROM users WHERE id = ? LIMIT 1", [(string)$uid]);
    if (!$u) return [false, null, 'User tidak ditemukan.'];
    if (strtolower((string)($u['role'] ?? '')) !== 'admin') return [false, null, 'Hanya admin yang boleh mengubah pengaturan.'];
    $who = $u['username'] ?? ($u['email'] ?? ('admin#' . $uid));
    return [true, $who, null];
}

list($isAdmin, $who, $err) = verify_admin($sdb, $in['token'] ?? '');
if (!$isAdmin) out(['ok' => false, 'message' => $err], 403);

$patch = is_array($in['settings'] ?? null) ? $in['settings'] : [];

/** Sanitasi + whitelist field. */
function clean_str($v, $max) { return mb_substr(trim((string)$v), 0, $max); }
$clean = [];
foreach (['brandName' => 40, 'brandSuffix' => 40, 'footerText' => 200, 'overviewTitle' => 160, 'overviewSubtitle' => 240, 'overviewMessage' => 4000] as $k => $max) {
    if (array_key_exists($k, $patch)) $clean[$k] = clean_str($patch[$k], $max);
}
if (array_key_exists('faviconUrl', $patch)) {
    $f = trim((string)$patch['faviconUrl']);
    $isData = preg_match('#^data:image/(png|x-icon|vnd\.microsoft\.icon|svg\+xml|webp|jpeg);base64,#i', $f);
    $isUrl = preg_match('#^(https?://|/)[^\s"\'<>]+$#i', $f);
    if (($isData && strlen($f) <= 450000) || $isUrl) $clean['faviconUrl'] = $f;
    else out(['ok' => false, 'message' => 'Favicon tidak valid atau terlalu besar (maks ~300 KB).'], 400);
}
if (array_key_exists('infoItems', $patch) && is_array($patch['infoItems'])) {
    $items = [];
    foreach (array_slice($patch['infoItems'], 0, 50) as $i => $it) {
        if (!is_array($it)) continue;
        $img = isset($it['image']) ? trim((string)$it['image']) : '';
        // blob: URL hanya hidup di browser admin -> jangan disimpan
        if ($img !== '' && (stripos($img, 'blob:') === 0 || strlen($img) > 450000)) $img = '';
        $row = [
            'id'    => is_numeric($it['id'] ?? null) ? (int)$it['id'] : $i,
            'tag'   => clean_str($it['tag'] ?? '', 40),
            'title' => clean_str($it['title'] ?? '', 200),
            'desc'  => clean_str($it['desc'] ?? '', 5000),
            'time'  => clean_str($it['time'] ?? '', 60),
        ];
        if ($img !== '') $row['image'] = $img;
        $items[] = $row;
    }
    $clean['infoItems'] = $items;
}
/* ----- Tema ----- */
foreach (['brandAccent', 'headerTint', 'menuActive'] as $k) {
    if (!array_key_exists($k, $patch)) continue;
    $v = trim((string)$patch[$k]);
    if ($v !== '' && !preg_match('/^#[0-9a-f]{6}$/i', $v)) out(['ok' => false, 'message' => "Warna $k tidak valid (format #rrggbb)."], 400);
    $clean[$k] = strtolower($v);
}
if (array_key_exists('headerOrnament', $patch)) {
    $v = trim((string)$patch['headerOrnament']);
    if ($v !== '' && !preg_match('/^[a-z0-9-]{1,40}$/', $v)) out(['ok' => false, 'message' => 'Aksesoris header tidak valid.'], 400);
    $clean['headerOrnament'] = $v;
}
if (array_key_exists('heroImage', $patch)) {
    $img = trim((string)$patch['heroImage']);
    if ($img === '') {
        q_exec($sdb, "DELETE FROM site_settings WHERE setting_key = 'asset_hero'");
        $clean['heroImageUrl'] = '';
    } else {
        if (!preg_match('#^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$#', $img)) out(['ok' => false, 'message' => 'Gambar hero harus JPG, PNG, atau WebP.'], 400);
        if (strlen($img) > 2800000) out(['ok' => false, 'message' => 'Gambar hero terlalu besar (maks ~2 MB).'], 400);
        q_exec($sdb,
            "INSERT INTO site_settings (setting_key, setting_value, updated_by) VALUES ('asset_hero', ?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)",
            [$img, (string)$who]);
        $clean['heroImageUrl'] = 'asset:hero:' . substr(md5($img), 0, 12);
    }
}

if (!$clean) out(['ok' => false, 'message' => 'Tidak ada pengaturan yang dikirim.'], 400);

try {
    list($current) = load_site($sdb);
    $merged = array_merge($current, $clean);
    $json = json_encode($merged, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    q_exec($sdb,
        "INSERT INTO site_settings (setting_key, setting_value, updated_by) VALUES ('site', ?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)",
        [$json, (string)$who]
    );
    out(['ok' => true, 'settings' => (object)$merged]);
} catch (Throwable $e) {
    out(['ok' => false, 'message' => 'Gagal menyimpan: ' . $e->getMessage()]);
}
