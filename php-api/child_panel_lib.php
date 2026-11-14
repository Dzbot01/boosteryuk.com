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
    $pct = $kind === 'agent' ? $tenant['markup_agent_pct'] : $tenant['markup_smm_pct'];
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
