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
const CP_SLOTS = ['logo', 'hero', 'slide0', 'slide1', 'slide2', 'slide3', 'slide4', 'slide5'];
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
    $st = cp_q($conn, "SELECT p.* FROM child_panel_domains d JOIN child_panels p ON p.id = d.child_panel_id
                       WHERE d.hostname = ? AND p.status = 'active' LIMIT 1", 's', $hostname);
    $row = $st->get_result()->fetch_assoc();
    $st->close();
    return $row ? cp_public($row, $hostname) : null;
}

/** Harga setelah markup child panel. Tidak pernah di bawah harga dasar. */
function cp_apply_markup($basePrice, $tenant, $kind) {
    if (!$tenant) return (float)$basePrice;
    $pct = $kind === 'agent' ? $tenant['markup_agent_pct'] : $tenant['markup_smm_pct'];
    $pct = max(0, min(CP_MAX_MARKUP, (float)$pct));
    return (float)ceil($basePrice * (1 + $pct / 100));
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
