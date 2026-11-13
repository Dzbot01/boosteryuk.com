<?php
/**
 * agent_reminder.php — email pengingat jatuh tempo Agen AI, TANPA cron job.
 *
 * Cara kerja (dihitung dari jumlah hari menuju jatuh tempo):
 *   Tahap: h7 (7 hari sebelum), h3, h1, h0 (hari H), dikirim pukul 09:00 WIB.
 *
 *   1. Saat order dibuat (agent_order.php) → agent_reminder_plan_order():
 *      setiap tahap yang waktunya ≤ 30 hari ke depan langsung DIJADWALKAN di Resend
 *      (parameter scheduled_at — Resend sendiri yang mengirim pada harinya; tidak ada
 *      proses di server kita yang menunggu/standby).
 *   2. Tahap yang lebih dari 30 hari lagi (sewa ≥ 2 bulan; batas jadwal Resend 30 hari)
 *      dijadwalkan saat user itu sendiri membuka Overview / Agen AI Saya
 *      → agent_reminder_check_user(). Hanya agen milik user tsb yang dicek.
 *      Jika ada tahap yang waktunya SUDAH lewat & belum terkirim, email dikirim saat itu juga.
 *
 * Penjadwalan memakai API Resend langsung → isi 'resend_key' di agent_config.php
 * (API key yang sama dengan order.php). Tanpa key, email dikirim lewat worker email
 * HANYA ketika hari tahapnya sudah tiba (saat user membuka Overview / Agen AI Saya).
 *
 * Setiap tahap tercatat sekali di tabel agent_reminder_log (dibuat otomatis) → tidak dobel.
 */

const AGENT_REMINDER_WORKER = 'https://boosteryuk.boosteryukid.workers.dev/api/email/send';
const AGENT_REMINDER_FROM   = 'Boosteryuk <noreply@cekidku.my.id>';
const AGENT_REMINDER_TZ     = 'Asia/Jakarta';
const AGENT_REMINDER_HOUR   = 9;            // jam kirim (WIB)
const AGENT_REMINDER_STAGES = ['h7' => 7, 'h3' => 3, 'h1' => 1, 'h0' => 0];
const RESEND_MAX_AHEAD      = 29 * 86400;   // batas aman jadwal Resend (maks 30 hari)

if (!function_exists('riwayat_ensure_columns')) require_once __DIR__ . '/riwayat_schema.php';

function agent_reminder_table($conn) {
    static $done = false;
    if ($done) return;
    $done = true;
    try { $conn->query("CREATE TABLE IF NOT EXISTS agent_reminder_log (
        order_id  VARCHAR(64) NOT NULL,
        kind      VARCHAR(8)  NOT NULL,
        email     VARCHAR(190) NULL,
        mode      VARCHAR(12) NOT NULL DEFAULT 'sent' COMMENT 'scheduled | sent',
        send_at   DATETIME NULL COMMENT 'waktu kirim (zona waktu server)',
        resend_id VARCHAR(64) NULL,
        sent_at   DATETIME NOT NULL,
        PRIMARY KEY (order_id, kind)
    ) DEFAULT CHARSET=utf8mb4"); } catch (\Throwable $e) { return; }
    // tabel versi lama: tambahkan kolom yang belum ada
    $have = [];
    try {
        $res = $conn->query("SHOW COLUMNS FROM agent_reminder_log");
        while ($res && ($c = $res->fetch_assoc())) $have[strtolower($c['Field'])] = true;
    } catch (\Throwable $e) { return; }
    foreach (['mode' => "VARCHAR(12) NOT NULL DEFAULT 'sent'", 'send_at' => 'DATETIME NULL', 'resend_id' => 'VARCHAR(64) NULL'] as $col => $def) {
        if (isset($have[$col])) continue;
        try { $conn->query("ALTER TABLE agent_reminder_log ADD COLUMN $col $def"); } catch (\Throwable $e) { /* abaikan */ }
    }
}

function agent_reminder_resend_key() {
    $k = getenv('RESEND_API_KEY') ?: '';
    if (!$k && is_file(__DIR__ . '/agent_config.php')) {
        $cfg = include __DIR__ . '/agent_config.php';
        if (is_array($cfg) && !empty($cfg['resend_key'])) $k = $cfg['resend_key'];
    }
    return $k;
}

/** Tanggal jatuh tempo (Y-m-d) dari kolom jatuh_tempo atau nama layanan lama. */
function agent_reminder_due_date($row) {
    if (!empty($row['jatuh_tempo'])) return substr($row['jatuh_tempo'], 0, 10);
    $ts = riwayat_due_from_name($row['service_name'] ?? '');
    return $ts ? date('Y-m-d', $ts) : null;
}

/** Waktu kirim tiap tahap (timestamp) untuk tanggal jatuh tempo tertentu. */
function agent_reminder_stage_times($dueDate) {
    $tz = new DateTimeZone(AGENT_REMINDER_TZ);
    $base = new DateTimeImmutable($dueDate . sprintf(' %02d:00:00', AGENT_REMINDER_HOUR), $tz);
    $out = [];
    foreach (AGENT_REMINDER_STAGES as $kind => $days) {
        $out[$kind] = $base->modify("-$days days")->getTimestamp();
    }
    return $out;
}

function agent_reminder_logged($conn, $orderId) {
    $st = $conn->prepare("SELECT kind FROM agent_reminder_log WHERE order_id = ?");
    $st->bind_param("s", $orderId);
    $st->execute();
    $res = $st->get_result();
    $have = [];
    while ($r = $res->fetch_assoc()) $have[$r['kind']] = true;
    $st->close();
    return $have;
}

function agent_reminder_log($conn, $orderId, $kind, $email, $mode, $sendAt, $resendId) {
    $sendSql = date('Y-m-d H:i:s', $sendAt);
    $st = $conn->prepare("INSERT IGNORE INTO agent_reminder_log (order_id, kind, email, mode, send_at, resend_id, sent_at)
                          VALUES (?,?,?,?,?,?,NOW())");
    $st->bind_param("ssssss", $orderId, $kind, $email, $mode, $sendSql, $resendId);
    $st->execute();
    $st->close();
}

function agent_reminder_html($it) {
    $bulan = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    $d = DateTimeImmutable::createFromFormat('Y-m-d', $it['due_date']);
    $tgl = $d ? ($d->format('j') . ' ' . $bulan[(int)$d->format('n')] . ' ' . $d->format('Y')) : $it['due_date'];
    $esc = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $nama = $it['nama_ai'] !== '' ? ' “' . $esc($it['nama_ai']) . '”' : '';
    return '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1e293b">'
        . '<h2 style="color:#0e7490;margin-bottom:4px">' . $esc(agent_reminder_subject($it['days'])) . '</h2>'
        . '<p>Halo ' . $esc($it['name']) . ',</p>'
        . '<p>Agen AI WhatsApp' . $nama . ' paket <b>' . $esc($it['paket']) . '</b> (ID <code>' . $esc($it['order_id']) . '</code>) '
        . ($it['days'] < 0 ? 'telah jatuh tempo pada <b>' : 'jatuh tempo pada <b>') . $tgl . '</b>.</p>'
        . '<p>Setelah jatuh tempo, agen tidak lagi dihitung aktif. Sewa lagi agar bot tetap melayani pelanggan kamu.</p>'
        . '<p><a href="https://boosteryuk.com/agen-ai-saya" style="display:inline-block;background:#0891b2;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Lihat Agen AI Saya</a></p>'
        . '<p style="font-size:13px;color:#64748b">Atau pesan langsung: <a href="https://boosteryuk.com/sewa-agen-ai">boosteryuk.com/sewa-agen-ai</a></p>'
        . '</div>';
}

/** Sisa hari kalender (WIB) menuju tanggal jatuh tempo; negatif = sudah lewat. */
function agent_reminder_days_left($dueDate) {
    $tz = new DateTimeZone(AGENT_REMINDER_TZ);
    $today = new DateTimeImmutable('today', $tz);
    $due = new DateTimeImmutable($dueDate, $tz);
    return (int)$today->diff($due)->format('%r%a');
}

function agent_reminder_subject($days) {
    if ($days < 0) return 'Masa sewa Agen AI kamu sudah berakhir';
    if ($days === 0) return 'Agen AI kamu jatuh tempo hari ini';
    if ($days === 1) return 'Pengingat: Agen AI jatuh tempo besok';
    return "Pengingat: Agen AI jatuh tempo $days hari lagi";
}

/**
 * Kirim / jadwalkan satu email. $sendAt null = kirim sekarang.
 * @return array [ok(bool), resend_id(string|null)]
 */
function agent_reminder_deliver($it, $sendAt = null) {
    $body = [
        'from'    => AGENT_REMINDER_FROM,
        'to'      => [$it['email']],
        'subject' => agent_reminder_subject($it['days']),
        'html'    => agent_reminder_html($it),
    ];
    $key = agent_reminder_resend_key();
    if ($key) {
        if ($sendAt) $body['scheduled_at'] = gmdate('Y-m-d\TH:i:s\Z', $sendAt);
        $url = getenv('AGENT_RESEND_URL') ?: 'https://api.resend.com/emails'; // env hanya untuk uji lokal
        $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $key];
    } else {
        if ($sendAt) return [false, null]; // tanpa API key tidak bisa menjadwalkan
        $body['to'] = $it['email'];
        $url = getenv('AGENT_EMAIL_WORKER') ?: AGENT_REMINDER_WORKER; // env hanya untuk uji lokal
        $headers = ['Content-Type: application/json'];
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($body),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = $resp ? json_decode($resp, true) : null;
    return [$code >= 200 && $code < 300, is_array($j) ? ($j['id'] ?? null) : null];
}

/** Ambil data agen (milik user / satu order) yang perlu diingatkan. */
function agent_reminder_rows($conn, $where, $types, ...$params) {
    agent_reminder_table($conn);
    $ext = riwayat_ensure_columns($conn);
    $cols = $ext ? "r.paket, r.jatuh_tempo, r.detail" : "NULL AS paket, NULL AS jatuh_tempo, NULL AS detail";
    $type = $ext ? "(r.order_type = 'agent_ai' OR r.service_name LIKE 'Agen AI%')" : "r.service_name LIKE 'Agen AI%'";
    $st = $conn->prepare("SELECT r.order_id, r.service_name, $cols, u.email, u.name
                          FROM riwayat_pesanan r JOIN users u ON u.id = r.user_id
                          WHERE $type AND r.status <> 'batal' AND $where");
    if (!$st) return [];
    $st->bind_param($types, ...$params);
    $st->execute();
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
    $st->close();
    return $rows;
}

/**
 * Inti: untuk satu agen, jadwalkan tahap yang masih ≤30 hari ke depan dan kirim
 * tahap terakhir yang sudah lewat (bila belum pernah). Tidak pernah dobel.
 */
function agent_reminder_process_row($conn, $r) {
    $dueDate = agent_reminder_due_date($r);
    if (!$dueDate || empty($r['email']) || !filter_var($r['email'], FILTER_VALIDATE_EMAIL)) return [];
    $times = agent_reminder_stage_times($dueDate);
    $now = time();
    // agen yang sudah lewat > 1 hari tidak perlu diingatkan lagi
    if ($now > $times['h0'] + 2 * 86400) return [];

    $detail = !empty($r['detail']) ? (json_decode($r['detail'], true) ?: []) : [];
    $base = [
        'order_id' => $r['order_id'],
        'email'    => $r['email'],
        'name'     => $r['name'] ?: 'Pelanggan',
        'paket'    => $r['paket'] ?: trim(preg_replace('/^Agen AI WhatsApp\s*|\s*-\s*Jatuh tempo.*$/i', '', $r['service_name'])),
        'nama_ai'  => $detail['nama_ai'] ?? '',
        'due_date' => $dueDate,
    ];
    $logged = agent_reminder_logged($conn, $r['order_id']);
    $done = [];

    // Tahap yang sudah lewat waktunya: kirim HANYA yang paling dekat jatuh tempo.
    $past = array_filter($times, fn($t) => $t <= $now);
    if ($past) {
        $kind = array_key_last($past); // urutan h7,h3,h1,h0 → terakhir = paling mendesak
        if (!isset($logged[$kind])) {
            // kirim sekarang -> hitung sisa hari sebenarnya (bisa negatif bila sudah lewat)
            $it = $base + ['days' => agent_reminder_days_left($dueDate)];
            [$ok, $id] = agent_reminder_deliver($it, null);
            if ($ok) { agent_reminder_log($conn, $r['order_id'], $kind, $r['email'], 'sent', $now, $id); $done[] = "$kind:sent"; }
        }
        // tahap lebih awal yang terlewat ditandai agar tidak dikirim belakangan
        foreach ($past as $k => $t) if ($k !== $kind && !isset($logged[$k])) agent_reminder_log($conn, $r['order_id'], $k, $r['email'], 'skipped', $t, null);
    }

    // Tahap mendatang dalam jangkauan jadwal Resend (≤ 30 hari) → jadwalkan.
    if (agent_reminder_resend_key()) {
        foreach ($times as $kind => $t) {
            if ($t <= $now + 300 || $t > $now + RESEND_MAX_AHEAD || isset($logged[$kind])) continue;
            $it = $base + ['days' => AGENT_REMINDER_STAGES[$kind]];
            [$ok, $id] = agent_reminder_deliver($it, $t);
            if ($ok) { agent_reminder_log($conn, $r['order_id'], $kind, $r['email'], 'scheduled', $t, $id); $done[] = "$kind:scheduled"; }
        }
    }
    return $done;
}

/** Dipanggil agent_order.php setelah order sukses. */
function agent_reminder_plan_order($conn, $orderId) {
    $out = [];
    foreach (agent_reminder_rows($conn, "r.order_id = ?", "s", $orderId) as $r) $out[$r['order_id']] = agent_reminder_process_row($conn, $r);
    return $out;
}

/** Dipanggil saat user membuka Overview / Agen AI Saya (hanya agen milik user tsb). */
function agent_reminder_check_user($conn, $uid) {
    $out = [];
    foreach (agent_reminder_rows($conn, "r.user_id = ?", "i", (int)$uid) as $r) $out[$r['order_id']] = agent_reminder_process_row($conn, $r);
    return $out;
}

/** Jalankan fungsi setelah respons terkirim ke browser (user tidak menunggu email). */
function agent_reminder_after_response(callable $fn) {
    register_shutdown_function(function () use ($fn) {
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
        ignore_user_abort(true);
        try { $fn(); } catch (\Throwable $e) { /* jangan ganggu respons utama */ }
    });
}
