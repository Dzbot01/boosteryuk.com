<?php
/**
 * agent_reminder.php — email pengingat jatuh tempo Agen AI.
 *
 * Kapan email dikirim (sekali per tahap per order, dicatat di tabel agent_reminder_log):
 *   h7  : sisa  ≤ 7 hari  (dan > 3 hari)
 *   h3  : sisa  ≤ 3 hari  (dan > 1 hari)
 *   h1  : sisa  ≤ 1 hari  (belum lewat)
 *   exp : sudah lewat jatuh tempo (maks 3 hari setelahnya)
 *
 * Cara jalan (hosting gratis tidak punya cron & memblokir request server-ke-server):
 *   1. OTOMATIS  — order_stats.php (Overview) & my_agents.php memanggil
 *      agent_reminder_schedule($conn): dijalankan SETELAH respons terkirim ke browser,
 *      paling sering sekali per 30 menit untuk seluruh website (kunci di tabel cron_state).
 *   2. MANUAL / cron eksternal — buka:
 *      https://boosteryuk.com/api/agent_reminder.php?key=<cron_key atau token agen>
 *      (tambahkan &dry=1 untuk melihat siapa yang akan dikirimi tanpa mengirim email).
 *
 * Email dikirim lewat Cloudflare Worker Resend yang sama dengan OTP/kode pairing.
 */

const AGENT_REMINDER_WORKER = 'https://boosteryuk.boosteryukid.workers.dev/api/email/send';
const AGENT_REMINDER_FROM   = 'Boosteryuk <noreply@cekidku.my.id>';
const AGENT_REMINDER_EVERY  = 30;   // menit, jeda minimum antar-run otomatis
const AGENT_REMINDER_MAX    = 15;   // maksimum email per run

if (!function_exists('riwayat_ensure_columns')) require_once __DIR__ . '/riwayat_schema.php';

function agent_reminder_tables($conn) {
    @$conn->query("CREATE TABLE IF NOT EXISTS agent_reminder_log (
        order_id VARCHAR(64) NOT NULL,
        kind VARCHAR(8) NOT NULL,
        email VARCHAR(190) NULL,
        sent_at DATETIME NOT NULL,
        PRIMARY KEY (order_id, kind)
    ) DEFAULT CHARSET=utf8mb4");
    @$conn->query("CREATE TABLE IF NOT EXISTS cron_state (
        name VARCHAR(50) NOT NULL PRIMARY KEY,
        last_run DATETIME NOT NULL
    ) DEFAULT CHARSET=utf8mb4");
}

/** Ambil kunci run (atomik): true bila run terakhir sudah > AGENT_REMINDER_EVERY menit lalu. */
function agent_reminder_acquire($conn) {
    agent_reminder_tables($conn);
    @$conn->query("INSERT IGNORE INTO cron_state (name, last_run) VALUES ('agent_reminder', '2000-01-01 00:00:00')");
    $m = (int)AGENT_REMINDER_EVERY;
    @$conn->query("UPDATE cron_state SET last_run = NOW()
                   WHERE name = 'agent_reminder' AND last_run < NOW() - INTERVAL $m MINUTE");
    return $conn->affected_rows === 1;
}

/** Tahap pengingat untuk sisa waktu (detik); null = belum/tidak perlu. */
function agent_reminder_kind($secsLeft) {
    $d = 86400;
    if ($secsLeft < -3 * $d) return null;
    if ($secsLeft < 0) return 'exp';
    if ($secsLeft <= 1 * $d) return 'h1';
    if ($secsLeft <= 3 * $d) return 'h3';
    if ($secsLeft <= 7 * $d) return 'h7';
    return null;
}

/** Daftar agen yang perlu diingatkan sekarang (belum pernah dikirimi tahap tsb). */
function agent_reminder_due_list($conn) {
    agent_reminder_tables($conn);
    $ext = riwayat_ensure_columns($conn);
    $cols = $ext ? "r.order_type, r.paket, r.jatuh_tempo, r.detail" : "NULL AS order_type, NULL AS paket, NULL AS jatuh_tempo, NULL AS detail";
    $typeCond = $ext ? "(r.order_type = 'agent_ai' OR r.service_name LIKE 'Agen AI%')" : "r.service_name LIKE 'Agen AI%'";
    $sql = "SELECT r.order_id, r.service_name, r.status, $cols, u.email, u.name
            FROM riwayat_pesanan r JOIN users u ON u.id = r.user_id
            WHERE $typeCond AND r.status <> 'batal'";
    $res = @$conn->query($sql);
    if (!$res) return [];
    $sent = [];
    $lr = @$conn->query("SELECT order_id, kind FROM agent_reminder_log");
    if ($lr) while ($x = $lr->fetch_assoc()) $sent[$x['order_id'] . '|' . $x['kind']] = true;

    $now = time();
    $out = [];
    while ($r = $res->fetch_assoc()) {
        $due = !empty($r['jatuh_tempo']) ? strtotime($r['jatuh_tempo']) : riwayat_due_from_name($r['service_name']);
        if (!$due) continue;
        $kind = agent_reminder_kind($due - $now);
        if (!$kind || isset($sent[$r['order_id'] . '|' . $kind])) continue;
        if (empty($r['email']) || !filter_var($r['email'], FILTER_VALIDATE_EMAIL)) continue;
        $detail = $r['detail'] ? (json_decode($r['detail'], true) ?: []) : [];
        $out[] = [
            'order_id' => $r['order_id'],
            'kind'     => $kind,
            'email'    => $r['email'],
            'name'     => $r['name'] ?: 'Pelanggan',
            'paket'    => $r['paket'] ?: trim(preg_replace('/^Agen AI WhatsApp\s*|\s*-\s*Jatuh tempo.*$/i', '', $r['service_name'])),
            'nama_ai'  => $detail['nama_ai'] ?? '',
            'due'      => $due,
            'days'     => (int)ceil(($due - $now) / 86400),
        ];
    }
    // yang paling mendesak dulu
    usort($out, fn($a, $b) => $a['due'] <=> $b['due']);
    return $out;
}

function agent_reminder_html($it) {
    $bulan = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    $tgl = date('j', $it['due']) . ' ' . $bulan[(int)date('n', $it['due'])] . ' ' . date('Y', $it['due']);
    $esc = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $judul = $it['kind'] === 'exp'
        ? 'Masa sewa Agen AI kamu sudah berakhir'
        : ($it['days'] <= 1 ? 'Agen AI kamu jatuh tempo besok' : "Agen AI kamu jatuh tempo dalam {$it['days']} hari");
    $nama = $it['nama_ai'] !== '' ? ' “' . $esc($it['nama_ai']) . '”' : '';
    return '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1e293b">'
        . '<h2 style="color:#0e7490;margin-bottom:4px">' . $esc($judul) . '</h2>'
        . '<p>Halo ' . $esc($it['name']) . ',</p>'
        . '<p>Agen AI WhatsApp' . $nama . ' paket <b>' . $esc($it['paket']) . '</b> (ID <code>' . $esc($it['order_id']) . '</code>) '
        . ($it['kind'] === 'exp' ? 'telah melewati jatuh tempo pada ' : 'akan jatuh tempo pada ') . '<b>' . $tgl . '</b>.</p>'
        . '<p>Setelah jatuh tempo, agen tidak lagi dihitung aktif. Sewa lagi agar bot tetap melayani pelanggan kamu.</p>'
        . '<p><a href="https://boosteryuk.com/agen-ai-saya" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Lihat Agen AI Saya</a></p>'
        . '<p style="font-size:13px;color:#64748b">Atau pesan langsung: <a href="https://boosteryuk.com/sewa-agen-ai">boosteryuk.com/sewa-agen-ai</a></p>'
        . '</div>';
}

function agent_reminder_send_email($it) {
    $subject = $it['kind'] === 'exp'
        ? 'Masa sewa Agen AI kamu sudah berakhir'
        : ($it['days'] <= 1 ? 'Pengingat: Agen AI jatuh tempo besok' : "Pengingat: Agen AI jatuh tempo dalam {$it['days']} hari");
    $payload = json_encode([
        'from'    => AGENT_REMINDER_FROM,
        'to'      => $it['email'],
        'subject' => $subject,
        'html'    => agent_reminder_html($it),
    ]);
    $ch = curl_init(getenv('AGENT_EMAIL_WORKER') ?: AGENT_REMINDER_WORKER); // env hanya untuk uji lokal
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    ]);
    curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}

/** Kirim semua pengingat yang jatuh waktunya. @return array ringkasan */
function agent_reminder_run($conn, $dry = false) {
    $list = agent_reminder_due_list($conn);
    $sent = 0; $failed = 0; $items = [];
    foreach (array_slice($list, 0, AGENT_REMINDER_MAX) as $it) {
        $ok = $dry ? null : agent_reminder_send_email($it);
        if ($ok) {
            $st = $conn->prepare("INSERT IGNORE INTO agent_reminder_log (order_id, kind, email, sent_at) VALUES (?,?,?,NOW())");
            $st->bind_param("sss", $it['order_id'], $it['kind'], $it['email']);
            $st->execute();
            $st->close();
            $sent++;
        } elseif ($ok === false) {
            $failed++;
        }
        $items[] = ['order_id' => $it['order_id'], 'kind' => $it['kind'], 'days' => $it['days'], 'sent' => $ok];
    }
    return ['ok' => true, 'dry' => $dry, 'pending' => count($list), 'sent' => $sent, 'failed' => $failed, 'items' => $items];
}

/**
 * Jadwalkan run otomatis setelah respons endpoint selesai dikirim (tidak memperlambat user).
 * Aman dipanggil di setiap request: hanya benar-benar jalan maksimal sekali per 30 menit.
 */
function agent_reminder_schedule($conn) {
    register_shutdown_function(function () use ($conn) {
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
        ignore_user_abort(true);
        @set_time_limit(120);
        try {
            if (agent_reminder_acquire($conn)) agent_reminder_run($conn);
        } catch (\Throwable $e) { /* jangan ganggu respons utama */ }
    });
}

/* ===== Endpoint langsung (cron eksternal / cek manual) ===== */
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(__FILE__)) {
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    error_reporting(0);
    require __DIR__ . '/configdb.php';
    if (isset($conn) && $conn instanceof mysqli) $conn->set_charset('utf8mb4');

    $cfg = is_file(__DIR__ . '/agent_config.php') ? (include __DIR__ . '/agent_config.php') : [];
    $secret = (is_array($cfg) ? ($cfg['cron_key'] ?? '') : '') ?: (is_array($cfg) ? ($cfg['token'] ?? '') : '') ?: (getenv('AGENT_TOKEN') ?: '');
    $key = (string)($_GET['key'] ?? '');
    if ($secret === '' || !hash_equals($secret, $key)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'key tidak valid']);
        exit;
    }
    echo json_encode(agent_reminder_run($conn, !empty($_GET['dry'])));
    exit;
}
