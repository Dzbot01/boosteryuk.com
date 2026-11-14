<?php
/**
 * child_panel_lib.php — skema + tenant resolver Child Panel.
 *
 * Alur hostname → tenant:
 *   Pengunjung buka toko1.boosteryuk.com → Cloudflare Worker meneruskan ke boosteryuk.com dengan
 *   header  X-Child-Panel: toko1  → PHP membaca header itu (atau ?host= dari frontend) →
 *   child_panel_domains.hostname = 'toko1.boosteryuk.com' → child_panels (tenant_id + konfigurasi).
 *
 * Tabel (dibuat otomatis; lihat juga child_panel.sql):
 *   child_panels         : 1 baris per child panel (nama, status, markup, config JSON tema/brand)
 *   child_panel_domains  : hostname → child_panel_id (hostname UNIK)
 *   child_panel_assets   : gambar (logo, hero, slider) disimpan terpisah agar config tetap kecil
 *
 * Catatan keamanan: header X-Child-Panel bisa dipalsukan oleh siapa pun yang memanggil API langsung.
 * Akibatnya hanya memilih tema/markup panel lain yang memang publik; markup tidak pernah membuat
 * harga di bawah harga dasar, jadi tidak ada cara membayar lebih murah dari web utama.
 */

const CP_ROOT_DOMAIN = 'boosteryuk.com';
const CP_MAX_MARKUP = 300; // persen
const CP_SLOTS = ['logo', 'hero', 'poster', 'slide0', 'slide1', 'slide2', 'slide3', 'slide4', 'slide5'];
/** Sama dengan RESERVED_SUBDOMAINS di worker/childpanel/proxy.ts (repo Boosteryuk). */
const CP_RESERVED = [
    'www', 'wa-origin', 'mail', 'webmail', 'smtp', 'imap', 'pop', 'ftp', 'cpanel', 'vpanel',
    'ns1', 'ns2', 'autodiscover', 'autoconfig', '_dmarc', 'status',
    'api', 'admin', 'app', 'dashboard', 'panel', 'static', 'cdn', 'assets', 'dev', 'test', 'staging',
];

function cp_q($conn, $sql, $types = '', ...$params) {
    $st = $conn->prepare($sql);
    if (!$st) throw new Exception('Query gagal: ' . $conn->error);
    if ($types !== '') $st->bind_param($types, ...$params);
    $st->execute();
    return $st;
}

function cp_ensure_schema($conn) {
    static $done = false;
    if ($done) return;
    $done = true;
    $conn->query("CREATE TABLE IF NOT EXISTS child_panels (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        owner_user_id    INT NULL COMMENT 'users.id reseller pemilik (opsional)',
        name             VARCHAR(80) NOT NULL,
        status           VARCHAR(12) NOT NULL DEFAULT 'active' COMMENT 'active | suspended',
        markup_smm_pct   DECIMAL(6,2) NOT NULL DEFAULT 0,
        markup_agent_pct DECIMAL(6,2) NOT NULL DEFAULT 0,
        config           LONGTEXT NULL COMMENT 'JSON: brand, warna, footer, slider, voice',
        created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_owner (owner_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS child_panel_domains (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        child_panel_id INT NOT NULL,
        hostname       VARCHAR(190) NOT NULL,
        is_primary     TINYINT(1) NOT NULL DEFAULT 1,
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_hostname (hostname),
        KEY idx_panel (child_panel_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $conn->query("CREATE TABLE IF NOT EXISTS child_panel_assets (
        child_panel_id INT NOT NULL,
        slot           VARCHAR(16) NOT NULL,
        data           LONGTEXT NOT NULL COMMENT 'data URL gambar',
        version        VARCHAR(16) NOT NULL,
        updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (child_panel_id, slot)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // Child panel dari paket EXTRA punya masa aktif (expires_at); panel buatan admin = NULL (tanpa batas).
    try {
        $hasExp = $conn->query("SHOW COLUMNS FROM child_panels LIKE 'expires_at'");
        if ($hasExp && $hasExp->num_rows === 0) $conn->query("ALTER TABLE child_panels ADD COLUMN expires_at DATETIME NULL COMMENT 'masa aktif (paket EXTRA)'");
    } catch (Throwable $e) { /* abaikan: resolver tetap jalan tanpa kolom ini */ }
    // Markup Order Nomor (OTP) — persen di atas harga jual OTP web utama.
    try {
        $hasOtp = $conn->query("SHOW COLUMNS FROM child_panels LIKE 'markup_otp_pct'");
        if ($hasOtp && $hasOtp->num_rows === 0) $conn->query("ALTER TABLE child_panels ADD COLUMN markup_otp_pct DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER markup_agent_pct");
    } catch (Throwable $e) { /* abaikan */ }
    // Pesanan yang dibuat lewat child panel (dasar perhitungan pendapatan reseller).
    $conn->query("CREATE TABLE IF NOT EXISTS child_panel_orders (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        child_panel_id INT NOT NULL,
        user_id        INT NOT NULL,
        order_id       VARCHAR(64) NOT NULL,
        kind           VARCHAR(10) NOT NULL COMMENT 'smm | agent',
        service_name   VARCHAR(255) NULL,
        quantity       INT NULL,
        price          DECIMAL(15,2) NOT NULL COMMENT 'harga dibayar user',
        base_price     DECIMAL(15,2) NOT NULL COMMENT 'harga asli web utama',
        profit         DECIMAL(15,2) NOT NULL COMMENT 'price - base_price (pendapatan panel)',
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_order (order_id, kind),
        KEY idx_panel_time (child_panel_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // Aktivitas user per child panel (agregat).
    $conn->query("CREATE TABLE IF NOT EXISTS child_panel_activity (
        child_panel_id INT NOT NULL,
        user_id        INT NOT NULL,
        first_seen     DATETIME NOT NULL,
        last_seen      DATETIME NOT NULL,
        visits         INT NOT NULL DEFAULT 0,
        last_action    VARCHAR(30) NULL,
        PRIMARY KEY (child_panel_id, user_id),
        KEY idx_last_seen (child_panel_id, last_seen)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    // Pencairan pendapatan markup pemilik panel (diproses manual oleh admin utama).
    $conn->query("CREATE TABLE IF NOT EXISTS child_panel_withdrawals (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        child_panel_id INT NOT NULL,
        user_id        INT NOT NULL COMMENT 'pemilik panel yang mengajukan',
        method         VARCHAR(20) NOT NULL COMMENT 'dana|ovo|gopay|shopeepay|bank',
        bank_name      VARCHAR(60) NULL,
        account_number VARCHAR(40) NOT NULL,
        account_name   VARCHAR(80) NOT NULL,
        amount         DECIMAL(15,2) NOT NULL COMMENT 'dipotong dari saldo pendapatan',
        fee            DECIMAL(15,2) NOT NULL DEFAULT 0,
        net_amount     DECIMAL(15,2) NOT NULL COMMENT 'yang ditransfer admin = amount - fee',
        status         VARCHAR(12) NOT NULL DEFAULT 'pending' COMMENT 'pending|paid|rejected',
        admin_note     VARCHAR(255) NULL,
        email_sent     TINYINT(1) NOT NULL DEFAULT 0,
        created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at   DATETIME NULL,
        processed_by   INT NULL,
        KEY idx_panel_status (child_panel_id, status),
        KEY idx_status_time (status, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

/** Catat aktivitas user di panel (kunjungan / login / order). */
function cp_touch_activity($conn, $panelId, $uid, $action = 'visit') {
    if (!$panelId || !$uid) return;
    $isVisit = $action === 'visit' ? 1 : 0;
    cp_q($conn, "INSERT INTO child_panel_activity (child_panel_id, user_id, first_seen, last_seen, visits, last_action)
                 VALUES (?, ?, NOW(), NOW(), ?, ?)
                 ON DUPLICATE KEY UPDATE last_seen = NOW(), visits = visits + VALUES(visits), last_action = VALUES(last_action)",
        'iiis', (int)$panelId, (int)$uid, $isVisit, $action)->close();
}

/** Catat pesanan child panel (sekali per order). Profit = harga dibayar - harga asli. */
function cp_record_order($conn, $panelId, $uid, $orderId, $kind, $service, $qty, $price, $basePrice) {
    $price = round((float)$price, 2);
    $basePrice = round(min((float)$basePrice, $price), 2);
    $profit = round($price - $basePrice, 2);
    $qty = (int)$qty;
    cp_q($conn, "INSERT IGNORE INTO child_panel_orders (child_panel_id, user_id, order_id, kind, service_name, quantity, price, base_price, profit)
                 VALUES (?,?,?,?,?,?,?,?,?)",
        'iisssiddd', (int)$panelId, (int)$uid, (string)$orderId, $kind, mb_substr((string)$service, 0, 255), $qty, $price, $basePrice, $profit)->close();
    cp_touch_activity($conn, $panelId, $uid, 'order');
}

/** Harga asli (sebelum markup) dari harga yang dibayar. */
function cp_base_from_price($price, $pct) {
    $pct = max(0, min(CP_MAX_MARKUP, (float)$pct));
    return round((float)$price / (1 + $pct / 100), 2);
}

/** Samarkan email untuk tampilan admin panel reseller: bu***@gmail.com */
function cp_mask_email($email) {
    $email = (string)$email;
    if (!strpos($email, '@')) return $email;
    [$u, $d] = explode('@', $email, 2);
    return mb_substr($u, 0, 2) . str_repeat('*', max(3, mb_strlen($u) - 2)) . '@' . $d;
}

/** Normalisasi & validasi nama subdomain. @return string|null */
function cp_clean_sub($sub) {
    $sub = strtolower(trim((string)$sub));
    if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/', $sub)) return null;
    if (in_array($sub, CP_RESERVED, true)) return null;
    return $sub;
}

/** Ambil hostname child panel dari header Worker atau parameter host. @return string|null */
function cp_request_host() {
    $sub = $_SERVER['HTTP_X_CHILD_PANEL'] ?? '';
    if ($sub !== '' && ($s = cp_clean_sub($sub))) return $s . '.' . CP_ROOT_DOMAIN;
    $host = strtolower(trim((string)($_GET['host'] ?? '')));
    if ($host !== '' && preg_match('/^([a-z0-9-]+)\.' . preg_quote(CP_ROOT_DOMAIN, '/') . '$/', $host, $m) && cp_clean_sub($m[1])) {
        return $host;
    }
    return null;
}

/** Konfigurasi publik (tanpa data pemilik) dari baris child_panels. */
function cp_public($row, $hostname) {
    $cfg = json_decode((string)($row['config'] ?? ''), true);
    if (!is_array($cfg)) $cfg = [];
    return [
        'id'               => (int)$row['id'],
        'name'             => $row['name'],
        'hostname'         => $hostname,
        'markup_smm_pct'   => (float)$row['markup_smm_pct'],
        'markup_agent_pct' => (float)$row['markup_agent_pct'],
        'markup_otp_pct'   => (float)($row['markup_otp_pct'] ?? 0),
        'config'           => (object)$cfg,
    ];
}

/**
 * Tenant resolver: hostname → child panel aktif. @return array|null (lihat cp_public)
 * Tanpa header/host child panel = website utama (null).
 */
function cp_resolve($conn, $hostname = null) {
    $hostname = $hostname ?: cp_request_host();
    if (!$hostname) return null;
    cp_ensure_schema($conn);
    // Panel paket EXTRA yang langganannya habis (expires_at lewat) dianggap tidak aktif.
    $st = cp_q($conn, "SELECT p.* FROM child_panel_domains d JOIN child_panels p ON p.id = d.child_panel_id
                       WHERE d.hostname = ? AND p.status = 'active' LIMIT 1", 's', $hostname);
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    if (!$row) return null;
    if (!empty($row['expires_at']) && strtotime($row['expires_at']) < time()) return null;
    $t = cp_public($row, $hostname);
    $t['_owner_user_id'] = $row['owner_user_id'] !== null ? (int)$row['owner_user_id'] : null; // internal, dibuang sebelum dikirim
    return $t;
}

/** Harga setelah markup child panel. Tidak pernah di bawah harga dasar. */
function cp_apply_markup($basePrice, $tenant, $kind) {
    if (!$tenant) return (float)$basePrice;
    $pct = $kind === 'agent' ? $tenant['markup_agent_pct'] : ($kind === 'otp' ? ($tenant['markup_otp_pct'] ?? 0) : $tenant['markup_smm_pct']);
    $pct = max(0, min(CP_MAX_MARKUP, (float)$pct));
    return (float)ceil($basePrice * (1 + $pct / 100));
}

/** user id dari token login (null bila tidak valid). */
function cp_user_id($conn, $token) {
    $token = trim((string)$token);
    if ($token === '') return null;
    if (function_exists('getUserIdByToken')) return getUserIdByToken($token) ?: null;
    $st = cp_q($conn, "SELECT user_id FROM sessions WHERE token = ? AND expires_at > NOW() LIMIT 1", 's', $token);
    $r = $st->get_result()->fetch_assoc();
    $st->close();
    return $r['user_id'] ?? null;
}

/** Apakah user ini admin ke-2 (pemilik) panel tsb — admin utama juga diizinkan. */
function cp_is_owner($conn, $tenant, $uid) {
    if (!$tenant || !$uid) return false;
    if (($tenant['_owner_user_id'] ?? null) === (int)$uid) return true;
    $st = cp_q($conn, "SELECT role FROM users WHERE id = ? LIMIT 1", 'i', (int)$uid);
    $u = $st->get_result()->fetch_assoc();
    $st->close();
    return strtolower((string)($u['role'] ?? '')) === 'admin';
}

/** Verifikasi admin langsung di DB (sama dengan site_settings.php). @return int user id */
function cp_require_admin($conn, $token, callable $fail) {
    $token = trim((string)$token);
    if ($token === '') $fail('Token kosong. Silakan login sebagai admin.', 401);
    $uid = function_exists('getUserIdByToken') ? getUserIdByToken($token) : null;
    if (!$uid) $fail('Sesi tidak valid. Login ulang sebagai admin.', 401);
    $st = cp_q($conn, "SELECT role FROM users WHERE id = ? LIMIT 1", 'i', (int)$uid);
    $u = $st->get_result()->fetch_assoc();
    $st->close();
    if (strtolower((string)($u['role'] ?? '')) !== 'admin') $fail('Hanya admin yang boleh mengatur child panel.', 403);
    return (int)$uid;
}

/** Konfigurasi upload video (child_panel_config.php). */
function cp_video_config() {
    $cfg = is_file(__DIR__ . '/child_panel_config.php') ? (include __DIR__ . '/child_panel_config.php') : [];
    $cfg = is_array($cfg) ? $cfg : [];
    return [
        'url'    => rtrim((string)($cfg['supabase_url'] ?? ''), '/'),
        'key'    => (string)(getenv('SUPABASE_SERVICE_KEY') ?: ($cfg['supabase_service_key'] ?? '')),
        'bucket' => (string)($cfg['video_bucket'] ?? 'publik'),
        'folder' => trim((string)($cfg['video_folder'] ?? 'childpanel'), '/'),
        'max_mb' => (int)($cfg['video_max_mb'] ?? 50),
    ];
}

/**
 * Minta signed upload URL ke Supabase Storage (POST /storage/v1/object/upload/sign/{bucket}/{path}).
 * @return array [ok, data|message]
 */
function cp_video_sign($panelId, $ext) {
    $c = cp_video_config();
    if ($c['url'] === '' || $c['key'] === '') return [false, 'Upload video belum dikonfigurasi: isi supabase_service_key di child_panel_config.php (server).'];
    $path = $c['folder'] . '/panel' . (int)$panelId . '-' . date('YmdHis') . '-' . substr(md5(random_bytes(8)), 0, 6) . '.' . $ext;
    $base = (getenv('CP_SUPABASE_STORAGE_URL') ?: ($c['url'] . '/storage/v1')); // env hanya untuk uji lokal
    $ch = curl_init($base . '/object/upload/sign/' . rawurlencode($c['bucket']) . '/' . $path);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => '{}',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $c['key'], 'apikey: ' . $c['key'], 'x-upsert: true'],
    ]);
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $j = $resp ? json_decode($resp, true) : null;
    if ($code < 200 || $code >= 300 || empty($j['url'])) {
        return [false, 'Supabase menolak membuat URL upload (HTTP ' . $code . '): ' . mb_substr((string)($j['message'] ?? $j['error'] ?? $resp), 0, 160)];
    }
    return [true, [
        'upload_url' => $c['url'] . '/storage/v1' . $j['url'],
        'public_url' => $c['url'] . '/storage/v1/object/public/' . rawurlencode($c['bucket']) . '/' . $path,
        'max_mb'     => $c['max_mb'],
    ]];
}


/* ===== Sanitasi konfigurasi tampilan (dipakai child_panel.php & plan_upgrade.php) ===== */
function cp_hex($v) {
    $v = strtolower(trim((string)$v));
    return ($v === '' || preg_match('/^#[0-9a-f]{6}$/', $v)) ? $v : '';
}
function cp_img_ref($v) {
    $v = trim((string)$v);
    if ($v === '' || preg_match('/^cpasset:[a-z0-9]+:[a-f0-9]{6,16}$/', $v)) return $v;
    return preg_match('#^https://[^\s"\'<>]{4,400}$#i', $v) ? $v : '';
}
function cp_str($v, $max) { return mb_substr(trim(strip_tags((string)$v)), 0, $max); }

/** Whitelist konfigurasi tampilan child panel. */
function cp_clean_config($c) {
    $c = is_array($c) ? $c : [];
    $out = [
        'brandName'      => cp_str($c['brandName'] ?? '', 40),
        'brandSuffix'    => cp_str($c['brandSuffix'] ?? '', 40),
        'headerTagline'  => cp_str($c['headerTagline'] ?? '', 30),
        'footerText'     => cp_str($c['footerText'] ?? '', 200),
        'themePreset'    => preg_match('/^[a-z0-9-]{1,30}$/', (string)($c['themePreset'] ?? '')) ? $c['themePreset'] : '',
        'brandAccent'    => cp_hex($c['brandAccent'] ?? ''),
        'headerTint'     => cp_hex($c['headerTint'] ?? ''),
        'menuActive'     => cp_hex($c['menuActive'] ?? ''),
        'headerOrnament' => preg_match('/^[a-z0-9-]{0,40}$/', (string)($c['headerOrnament'] ?? '')) ? (string)($c['headerOrnament'] ?? '') : '',
        'logo'           => cp_img_ref($c['logo'] ?? ''),
        'hero'           => cp_img_ref($c['hero'] ?? ''),
        // Video player dashboard: kosong = tidak tampil. URL https (Supabase Storage / mp4 / webm).
        'videoUrl'       => preg_match('#^https://[^\s"\'<>]{4,500}$#i', trim((string)($c['videoUrl'] ?? ''))) ? trim((string)$c['videoUrl']) : '',
        'videoPoster'    => cp_img_ref($c['videoPoster'] ?? ''),
        // Tombol musik di bottom navbar child panel: bawaan TIDAK tampil.
        'showMusic'      => !empty($c['showMusic']),
        'voice'          => in_array($c['voice'] ?? 'welcome', ['full', 'welcome', 'off'], true) ? ($c['voice'] ?? 'welcome') : 'welcome',
        'slides'         => [],
    ];
    foreach (array_slice(is_array($c['slides'] ?? null) ? $c['slides'] : [], 0, 6) as $s) {
        if (!is_array($s)) continue;
        $img = cp_img_ref($s['image'] ?? '');
        if ($img === '') continue;
        $out['slides'][] = ['image' => $img, 'title' => cp_str($s['title'] ?? '', 80), 'subtitle' => cp_str($s['subtitle'] ?? '', 140)];
    }
    return $out;
}

/* ===================== Pencairan (withdraw) pendapatan child panel ===================== */

const CP_WD_ADMIN_EMAIL = 'boosteryukid@gmail.com';   // penerima notifikasi permintaan withdraw
const CP_WD_MIN         = 10000;                      // minimal pencairan (Rp)
const CP_WD_HOLD_DAYS   = 3;    // pendapatan pesanan yg belum "selesai" baru bisa dicairkan setelah N hari
const CP_WD_FROM        = 'Boosteryuk <noreply@cekidku.my.id>';
const CP_WD_WORKER      = 'https://boosteryuk.boosteryukid.workers.dev/api/email/send';
/** Metode pencairan → [label, biaya admin (Rp), jenis]. DANA direkomendasikan: cepat & tanpa biaya. */
const CP_WD_METHODS = [
    'dana'      => ['DANA', 0, 'ewallet'],
    'ovo'       => ['OVO', 1000, 'ewallet'],
    'gopay'     => ['GoPay', 1000, 'ewallet'],
    'shopeepay' => ['ShopeePay', 1000, 'ewallet'],
    'bank'      => ['Transfer Bank', 2500, 'bank'],
];

/**
 * Subquery status riwayat terbaru suatu pesanan (riwayat_pesanan: pending|proses|selesai|batal), alias tabel `o`.
 * riwayat_pesanan (tabel lama) bisa memakai collation berbeda dari child_panel_orders (mis. utf8mb4_unicode_ci vs
 * utf8mb4_general_ci) → MySQL menolak "Illegal mix of collations". Maka order_id dikonversi ke collation
 * riwayat_pesanan (index riwayat tetap terpakai). Bila tetap gagal → NULL (status tidak difilter, halaman tetap jalan).
 */
function cp_order_status_sql($conn) {
    static $sql = null;
    if ($sql !== null) return $sql;
    $cands = [];
    try {
        $r = $conn->query("SELECT CHARACTER_SET_NAME cs, COLLATION_NAME co FROM information_schema.COLUMNS
                           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'riwayat_pesanan' AND COLUMN_NAME = 'order_id' LIMIT 1");
        $c = $r ? $r->fetch_assoc() : null;
        if ($c && preg_match('/^[a-z0-9_]+$/i', (string)$c['cs']) && preg_match('/^[a-z0-9_]+$/i', (string)$c['co'])) {
            $cands[] = "r.order_id = CONVERT(o.order_id USING {$c['cs']}) COLLATE {$c['co']}";
        }
    } catch (Throwable $e) { /* information_schema tidak bisa dibaca */ }
    array_unshift($cands, 'r.order_id = o.order_id');
    foreach ($cands as $cond) {
        $try = "(SELECT r.status FROM riwayat_pesanan r WHERE $cond AND r.user_id = o.user_id ORDER BY r.id DESC LIMIT 1)";
        try {
            $conn->query("SELECT $try AS st FROM child_panel_orders o LIMIT 1");
            return $sql = $try;
        } catch (Throwable $e) { /* coba kandidat berikutnya */ }
    }
    return $sql = 'NULL';
}

/**
 * Saldo pendapatan panel:
 *  - pesanan BATAL tidak dihitung;
 *  - "cleared" (bisa dicairkan) = pesanan selesai, atau tidak batal & sudah lewat CP_WD_HOLD_DAYS hari;
 *  - available = cleared - (dicairkan + sedang diproses). Bisa negatif bila pesanan dibatalkan setelah dicairkan
 *    → otomatis menahan pencairan berikutnya.
 */
function cp_wd_balance($conn, $panelId) {
    $hold = (int)CP_WD_HOLD_DAYS;
    $st = cp_q($conn, "SELECT
            COALESCE(SUM(CASE WHEN COALESCE(s.st,'') <> 'batal' THEN s.profit END),0) AS earned,
            COALESCE(SUM(CASE WHEN COALESCE(s.st,'') <> 'batal' AND (s.st = 'selesai' OR s.created_at <= NOW() - INTERVAL $hold DAY) THEN s.profit END),0) AS cleared
        FROM (SELECT o.profit, o.created_at, " . cp_order_status_sql($conn) . " AS st FROM child_panel_orders o WHERE o.child_panel_id = ?) s", 'i', (int)$panelId);
    $e = $st->get_result()->fetch_assoc();
    $st->close();
    $st = cp_q($conn, "SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount END),0) paid,
                              COALESCE(SUM(CASE WHEN status='pending' THEN amount END),0) pending,
                              SUM(status='pending') pending_count
                       FROM child_panel_withdrawals WHERE child_panel_id = ?", 'i', (int)$panelId);
    $w = $st->get_result()->fetch_assoc();
    $st->close();
    $earned = round((float)$e['earned'], 2);
    $cleared = round((float)$e['cleared'], 2);
    $paid = round((float)$w['paid'], 2);
    $pending = round((float)$w['pending'], 2);
    return [
        'earned'        => $earned,                       // total pendapatan (tanpa pesanan batal)
        'held'          => round($earned - $cleared, 2),  // menunggu pesanan selesai / masa tahan
        'paid'          => $paid,
        'pending'       => $pending,
        'pending_count' => (int)$w['pending_count'],
        'available'     => floor(max(0, $cleared - $paid - $pending)),
        'raw_available' => round($cleared - $paid - $pending, 2),
    ];
}

function cp_wd_methods_public() {
    $out = [];
    foreach (CP_WD_METHODS as $id => [$label, $fee, $kind]) $out[] = ['id' => $id, 'label' => $label, 'fee' => $fee, 'kind' => $kind, 'recommended' => $id === 'dana'];
    return ['methods' => $out, 'min' => CP_WD_MIN, 'hold_days' => CP_WD_HOLD_DAYS];
}

function cp_wd_row_public($r) {
    foreach (['amount', 'fee', 'net_amount'] as $k) $r[$k] = (float)$r[$k];
    $r['id'] = (int)$r['id'];
    if (isset($r['child_panel_id'])) $r['child_panel_id'] = (int)$r['child_panel_id'];
    $r['method_label'] = CP_WD_METHODS[$r['method']][0] ?? $r['method'];
    if (isset($r['email_sent'])) $r['email_sent'] = (int)$r['email_sent'];
    unset($r['processed_by']);
    return $r;
}

function cp_wd_history($conn, $panelId, $limit = 30) {
    $limit = max(1, min(100, (int)$limit));
    $st = cp_q($conn, "SELECT id, method, bank_name, account_number, account_name, amount, fee, net_amount, status, admin_note, created_at, processed_at, email_sent, processed_by
                       FROM child_panel_withdrawals WHERE child_panel_id = ? ORDER BY id DESC LIMIT $limit", 'i', (int)$panelId);
    $rows = $st->get_result()->fetch_all(MYSQLI_ASSOC);
    $st->close();
    return array_map('cp_wd_row_public', $rows);
}

/**
 * Ajukan pencairan. Diserialkan per panel (SELECT ... FOR UPDATE) agar dua klik/tab bersamaan
 * tidak bisa mencairkan saldo yang sama dua kali. @return array [ok, data|pesan, httpCode]
 */
function cp_wd_request($conn, $panelId, $uid, $in) {
    $method = strtolower(trim((string)($in['method'] ?? '')));
    if (!isset(CP_WD_METHODS[$method])) return [false, 'Pilih metode pencairan.', 400];
    [$label, $fee, $kind] = CP_WD_METHODS[$method];
    $bank = $kind === 'bank' ? cp_str($in['bank_name'] ?? '', 60) : null;
    if ($kind === 'bank' && mb_strlen($bank) < 2) return [false, 'Nama bank wajib diisi.', 400];
    $number = preg_replace('/[\s.-]+/', '', (string)($in['account_number'] ?? ''));
    if ($kind === 'ewallet') {
        if (preg_match('/^(\+?62)/', $number)) $number = '0' . preg_replace('/^\+?62/', '', $number);
        if (!preg_match('/^08\d{8,12}$/', $number)) return [false, 'Nomor ' . $label . ' harus nomor HP aktif, contoh 081234567890.', 400];
    } elseif (!preg_match('/^\d{6,20}$/', $number)) {
        return [false, 'Nomor rekening hanya angka (6–20 digit).', 400];
    }
    $name = cp_str($in['account_name'] ?? '', 80);
    if (mb_strlen($name) < 3 || !preg_match("/^[\p{L} .,'-]+$/u", $name)) return [false, 'Nama pemilik ' . ($kind === 'bank' ? 'rekening' : 'akun ' . $label) . ' wajib diisi sesuai yang terdaftar (huruf saja).', 400];
    $amount = floor((float)($in['amount'] ?? 0));
    if ($amount < CP_WD_MIN) return [false, 'Minimal pencairan Rp' . number_format(CP_WD_MIN, 0, ',', '.') . '.', 400];
    if ($amount <= $fee) return [false, 'Jumlah harus lebih besar dari biaya admin.', 400];

    $conn->begin_transaction();
    try {
        $st = cp_q($conn, "SELECT id FROM child_panels WHERE id = ? FOR UPDATE", 'i', (int)$panelId);
        $st->get_result()->fetch_assoc();
        $st->close();
        $bal = cp_wd_balance($conn, $panelId);
        if ($bal['pending_count'] > 0) { $conn->rollback(); return [false, 'Masih ada pencairan yang sedang diproses. Tunggu sampai selesai dulu ya.', 409]; }
        if ($amount > $bal['available']) { $conn->rollback(); return [false, 'Saldo yang bisa dicairkan hanya Rp' . number_format($bal['available'], 0, ',', '.') . '.', 400]; }
        $net = $amount - $fee;
        cp_q($conn, "INSERT INTO child_panel_withdrawals (child_panel_id, user_id, method, bank_name, account_number, account_name, amount, fee, net_amount)
                     VALUES (?,?,?,?,?,?,?,?,?)", 'iissssddd', (int)$panelId, (int)$uid, $method, $bank, $number, $name, $amount, $fee, $net)->close();
        $id = (int)$conn->insert_id;
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        return [false, 'Gagal menyimpan permintaan: ' . $e->getMessage(), 500];
    }
    return [true, ['id' => $id, 'amount' => $amount, 'fee' => $fee, 'net_amount' => $net, 'method_label' => $label], 200];
}

/** Detail lengkap satu permintaan (untuk email & modal admin). */
function cp_wd_get($conn, $id) {
    $st = cp_q($conn, "SELECT w.*, p.name AS panel_name, d.hostname, u.name AS owner_name, u.email AS owner_email
                       FROM child_panel_withdrawals w
                       LEFT JOIN child_panels p ON p.id = w.child_panel_id
                       LEFT JOIN child_panel_domains d ON d.child_panel_id = w.child_panel_id AND d.is_primary = 1
                       LEFT JOIN users u ON u.id = w.user_id
                       WHERE w.id = ? LIMIT 1", 'i', (int)$id);
    $r = $st->get_result()->fetch_assoc();
    $st->close();
    return $r ? cp_wd_row_public($r) : null;
}

function cp_resend_key() {
    $k = getenv('RESEND_API_KEY') ?: '';
    if (!$k && is_file(__DIR__ . '/agent_config.php')) {
        $cfg = include __DIR__ . '/agent_config.php';
        if (is_array($cfg) && !empty($cfg['resend_key'])) $k = $cfg['resend_key'];
    }
    return $k;
}

/** Kirim email lewat Resend (API key di agent_config.php) — tanpa key: lewat Worker email. */
function cp_send_email($to, $subject, $html) {
    $body = ['from' => CP_WD_FROM, 'to' => [$to], 'subject' => $subject, 'html' => $html];
    $key = cp_resend_key();
    if ($key) {
        $url = getenv('AGENT_RESEND_URL') ?: 'https://api.resend.com/emails'; // env hanya untuk uji lokal
        $headers = ['Content-Type: application/json', 'Authorization: Bearer ' . $key];
    } else {
        $body['to'] = $to;
        $url = getenv('AGENT_EMAIL_WORKER') ?: CP_WD_WORKER;
        $headers = ['Content-Type: application/json'];
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body), CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10, CURLOPT_HTTPHEADER => $headers]);
    curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}

function cp_wd_rp($n) { return 'Rp' . number_format((float)$n, 0, ',', '.'); }

function cp_wd_email_table($w) {
    $h = fn($v) => htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
    $rows = [
        'Child panel'     => $h($w['panel_name']) . ' (' . $h($w['hostname']) . ')',
        'Pemilik'         => $h($w['owner_name']) . ' — ' . $h($w['owner_email']),
        'Metode'          => $h($w['method_label']) . ($w['bank_name'] ? ' — ' . $h($w['bank_name']) : ''),
        'Nomor'           => '<b style="font-size:16px">' . $h($w['account_number']) . '</b>',
        'Atas nama'       => '<b>' . $h($w['account_name']) . '</b>',
        'Jumlah ditarik'  => cp_wd_rp($w['amount']),
        'Biaya admin'     => cp_wd_rp($w['fee']),
        'Ditransfer'      => '<b style="font-size:16px;color:#0e7490">' . cp_wd_rp($w['net_amount']) . '</b>',
        'Diajukan'        => $h($w['created_at']),
    ];
    $tr = '';
    foreach ($rows as $k => $v) $tr .= "<tr><td style=\"padding:6px 12px 6px 0;color:#64748b\">$k</td><td style=\"padding:6px 0\">$v</td></tr>";
    return "<table style=\"border-collapse:collapse;font-size:14px\">$tr</table>";
}

/** Notifikasi permintaan baru ke admin utama. */
function cp_wd_notify_admin($conn, $id) {
    $w = cp_wd_get($conn, $id);
    if (!$w) return false;
    $html = '<div style="font-family:Arial,sans-serif;color:#0f172a"><h2 style="margin:0 0 8px">Permintaan withdraw child panel #' . $w['id'] . '</h2>'
        . '<p style="margin:0 0 14px;color:#475569">Pemilik child panel mengajukan pencairan pendapatan markup.</p>'
        . cp_wd_email_table($w)
        . '<p style="margin:18px 0 0"><a href="https://' . CP_ROOT_DOMAIN . '/admin/withdraw" style="background:#0e7490;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Buka Withdraw Request</a></p>'
        . '<p style="margin:14px 0 0;font-size:12px;color:#94a3b8">Setelah transfer, tandai "Sudah dibayar" di Admin → Withdraw Request.</p></div>';
    $ok = cp_send_email(CP_WD_ADMIN_EMAIL, 'Withdraw ' . cp_wd_rp($w['net_amount']) . ' via ' . $w['method_label'] . ' — ' . $w['panel_name'], $html);
    if ($ok) cp_q($conn, "UPDATE child_panel_withdrawals SET email_sent = 1 WHERE id = ?", 'i', (int)$id)->close();
    return $ok;
}

/** Kabari pemilik panel saat permintaannya dibayar / ditolak. */
function cp_wd_notify_owner($conn, $id) {
    $w = cp_wd_get($conn, $id);
    if (!$w || empty($w['owner_email'])) return false;
    $paid = $w['status'] === 'paid';
    $note = $w['admin_note'] ? '<p style="margin:12px 0 0"><b>Catatan admin:</b> ' . htmlspecialchars($w['admin_note'], ENT_QUOTES, 'UTF-8') . '</p>' : '';
    $html = '<div style="font-family:Arial,sans-serif;color:#0f172a"><h2 style="margin:0 0 8px">'
        . ($paid ? 'Pencairan berhasil ditransfer' : 'Pencairan ditolak') . '</h2>'
        . '<p style="margin:0 0 14px;color:#475569">' . ($paid
            ? 'Dana pencairan child panel kamu sudah dikirim ke akun tujuan.'
            : 'Permintaan pencairan kamu ditolak, saldo pendapatan sudah dikembalikan dan bisa diajukan lagi.') . '</p>'
        . cp_wd_email_table($w) . $note . '</div>';
    return cp_send_email($w['owner_email'], ($paid ? 'Pencairan ' . cp_wd_rp($w['net_amount']) . ' berhasil' : 'Pencairan ditolak') . ' — ' . $w['panel_name'], $html);
}

/** Jalankan $fn setelah respons terkirim (email tidak memperlambat tombol). */
function cp_after_response(callable $fn) {
    register_shutdown_function(function () use ($fn) {
        if (function_exists('fastcgi_finish_request')) @fastcgi_finish_request();
        try { $fn(); } catch (Throwable $e) { /* abaikan */ }
    });
}
