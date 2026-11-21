<?php
// Shared events for root and child panels. Writes restricted to root-domain admins.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
function ev_out($data, $code = 200) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
set_exception_handler(function ($e) { ev_out(['ok'=>false,'message'=>'Event tidak dapat diproses. Periksa database dan file API server.'],500); });
require __DIR__ . '/configdb.php';
require_once __DIR__ . '/child_panel_lib.php';
$conn->set_charset('utf8mb4');
function ev_schema($conn) {
    $conn->query("CREATE TABLE IF NOT EXISTS site_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(120) NOT NULL,
        description TEXT NOT NULL,
        kind VARCHAR(16) NOT NULL DEFAULT 'standard',
        status VARCHAR(16) NOT NULL DEFAULT 'upcoming',
        starts_at DATETIME NULL,
        ends_at DATETIME NULL,
        updated_by INT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // Idempotent initial events. No delete endpoint: edits are not overwritten on reload.
    $conn->query("INSERT IGNORE INTO site_events (id,title,description,kind,status,ends_at) VALUES
        (1,'Hitung mundur tahun baru','Mainkan Naikkan Akunmu! pada event Hitung mundur tahun baru. Merchant memakai saldo website untuk item virtual game.','game','ongoing','2026-12-31 17:00:00'),
        (2,'','','standard','upcoming',NULL)");
    $conn->query("UPDATE site_events SET title='Daily Streak',description='Check-in 7 hari berturut-turut. Hari 1–6 mendapat Rp1 hingga Rp6 sesuai hari, hari ke-7 PLUS TRIAL 24 jam.',kind='streak',status='ongoing' WHERE id=2 AND title='' AND kind='standard' AND status='upcoming'");
    $conn->query("UPDATE site_events SET description='Check-in 7 hari berturut-turut. Hari 1–6 mendapat Rp1 hingga Rp6 sesuai hari, hari ke-7 PLUS TRIAL 24 jam.' WHERE id=2 AND kind='streak' AND description='Check-in 7 hari berturut-turut. Hari 1–6 Rp1, hari ke-7 PLUS TRIAL 24 jam.'");
    $conn->query("INSERT IGNORE INTO site_events (id,title,description,kind,status) VALUES (3,'','','standard','upcoming')");
    $conn->query("UPDATE site_events SET kind='game' WHERE id=1 AND kind='countdown' AND title='Hitung mundur tahun baru'");
}
function ev_list($conn, $admin = false) {
    $rows = [];
    $res = $conn->query('SELECT * FROM site_events ORDER BY id ASC');
    while ($r = $res->fetch_assoc()) {
        $r['id'] = (int)$r['id'];
        $status = $r['status']; $now = time();
        // UTC stored in MySQL. Manual finished wins; dates otherwise drive the lifecycle.
        if ($status !== 'finished') {
            if ($r['ends_at'] && strtotime($r['ends_at'].' UTC') <= $now) $status = 'finished';
            elseif ($r['starts_at']) $status = strtotime($r['starts_at'].' UTC') > $now ? 'upcoming' : 'ongoing';
        }
        $r['effective_status'] = $status;
        foreach (['starts_at','ends_at'] as $k) $r[$k] = $r[$k] ? str_replace(' ','T',$r[$k]).'Z' : null;
        unset($r['updated_by']);
        if (!$admin && $status === 'upcoming') { $r['title'] = ''; $r['description'] = ''; }
        $rows[] = $r;
    }
    return $rows;
}
function ev_date($s) {
    if ($s === null || $s === '') return null;
    if (!is_string($s) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/D',$s)) ev_out(['ok'=>false,'message'=>'Format tanggal harus UTC ISO.'],400);
    $t = strtotime($s);
    if ($t === false || gmdate('Y-m-d\TH:i:s', $t) !== substr($s,0,19)) ev_out(['ok'=>false,'message'=>'Tanggal tidak valid.'],400);
    return gmdate('Y-m-d H:i:s',$t);
}
$input = json_decode(file_get_contents('php://input'),true) ?: [];
$admin = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($admin) {
    if (!empty($_SERVER['HTTP_X_CHILD_PANEL'])) ev_out(['ok'=>false,'message'=>'Kelola event dari admin domain utama.'],403);
    $adminId = cp_require_admin($conn,$input['token'] ?? '',function($m,$c){ ev_out(['ok'=>false,'message'=>$m],$c); });
} elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') ev_out(['ok'=>false,'message'=>'Metode tidak didukung.'],405);
ev_schema($conn);
if ($admin && ($input['action'] ?? '') === 'save') {
    $e = $input['event'] ?? [];
    if (!is_array($e)) ev_out(['ok'=>false,'message'=>'Data event tidak valid.'],400);
    $title = cp_str($e['title'] ?? '',120); $description = cp_str($e['description'] ?? '',4000);
    $status = $e['status'] ?? ''; $kind = $e['kind'] ?? '';
    if (!in_array($status,['upcoming','ongoing','finished'],true) || !in_array($kind,['standard','countdown','game','streak'],true) || ($status !== 'upcoming' && $title === '')) ev_out(['ok'=>false,'message'=>'Isi judul, jenis dan status event yang valid.'],400);
    $start = ev_date($e['starts_at'] ?? null); $end = ev_date($e['ends_at'] ?? null);
    if (($start && $end && $end <= $start) || ($kind === 'countdown' && !$end)) ev_out(['ok'=>false,'message'=>'Batas akhir wajib untuk hitung mundur dan harus setelah waktu mulai.'],400);
    $id = (int)($e['id'] ?? 0);
    if ($kind==='streak' && $id!==2) ev_out(['ok'=>false,'message'=>'Daily Streak menggunakan kartu event #2. Ubah kartu tersebut.'],400);
    if ($id > 0) {
        $st = cp_q($conn,'SELECT id FROM site_events WHERE id=?','i',$id); $exists=$st->get_result()->fetch_assoc(); $st->close();
        if (!$exists) ev_out(['ok'=>false,'message'=>'Event tidak ditemukan.'],404);
        cp_q($conn,'UPDATE site_events SET title=?,description=?,kind=?,status=?,starts_at=?,ends_at=?,updated_by=? WHERE id=?','ssssssii',$title,$description,$kind,$status,$start,$end,$adminId,$id)->close();
    } else cp_q($conn,'INSERT INTO site_events (title,description,kind,status,starts_at,ends_at,updated_by) VALUES (?,?,?,?,?,?,?)','ssssssi',$title,$description,$kind,$status,$start,$end,$adminId)->close();
} elseif ($admin && ($input['action'] ?? '') !== 'list') ev_out(['ok'=>false,'message'=>'Aksi tidak valid.'],400);
ev_out(['ok'=>true,'events'=>ev_list($conn,$admin),'server_time'=>gmdate('c')]);
