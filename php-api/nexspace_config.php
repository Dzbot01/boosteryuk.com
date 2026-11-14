<?php
/**
 * nexspace_config.php — paket & pengaturan NexSpace (tanpa rahasia; boleh di-commit).
 * Token & alamat tunnel VPS memakai agent_config.php (sama dengan Sewa Agen AI).
 *
 * HARGA STARTED masih USULAN (belum ditentukan pemilik) — ubah 'price' sesuai keinginan.
 * Harga Pro sesuai ketentuan pemilik.
 */
return [
    'ssh_host' => '185.205.222.202',
    'ssh_port' => 10892,
    'admin_email' => 'boosteryukid@gmail.com',
    'months' => [1, 3, 6, 12],
    'rules' => [
        'Dilarang menjalankan Pterodactyl (panel/wings) dan VPN dalam bentuk apa pun.',
        'Dilarang mining, DDoS, spam, phishing, scanning, atau aktivitas ilegal lain.',
        'Pelanggaran = akun dihentikan tanpa pengembalian saldo.',
    ],
    'plans' => [
        // ---- Started: dibuat OTOMATIS di VPS, user Linux biasa (tanpa root) ----
        ['id' => 'started-512', 'tier' => 'started', 'name' => 'NexSpace Started 512MB', 'ram' => '512 MB', 'ram_mb' => 512,  'cpu' => '0.5 vCPU', 'cpu_pct' => 50,  'disk_gb' => 5,  'tasks' => 64,  'price' => 7000],
        ['id' => 'started-1g',  'tier' => 'started', 'name' => 'NexSpace Started 1GB',   'ram' => '1 GB',   'ram_mb' => 1024, 'cpu' => '1 vCPU',   'cpu_pct' => 100, 'disk_gb' => 10, 'tasks' => 128, 'price' => 12000],
        ['id' => 'started-2g',  'tier' => 'started', 'name' => 'NexSpace Started 2GB',   'ram' => '2 GB',   'ram_mb' => 2048, 'cpu' => '1 vCPU',   'cpu_pct' => 100, 'disk_gb' => 20, 'tasks' => 256, 'price' => 18000],
        // ---- Pro: disiapkan MANUAL oleh admin (akses root, boleh dijual lagi) ----
        ['id' => 'pro-1g',  'tier' => 'pro', 'name' => 'NexSpace Pro 1GB',  'ram' => '1 GB',  'cpu' => '1 vCPU', 'disk_gb' => 20,  'price' => 20000],
        ['id' => 'pro-2g',  'tier' => 'pro', 'name' => 'NexSpace Pro 2GB',  'ram' => '2 GB',  'cpu' => '2 vCPU', 'disk_gb' => 40,  'price' => 28000],
        ['id' => 'pro-4g',  'tier' => 'pro', 'name' => 'NexSpace Pro 4GB',  'ram' => '4 GB',  'cpu' => '2 vCPU', 'disk_gb' => 60,  'price' => 55000],
        ['id' => 'pro-8g',  'tier' => 'pro', 'name' => 'NexSpace Pro 8GB',  'ram' => '8 GB',  'cpu' => '4 vCPU', 'disk_gb' => 100, 'price' => 105000],
        ['id' => 'pro-16g', 'tier' => 'pro', 'name' => 'NexSpace Pro 16GB', 'ram' => '16 GB', 'cpu' => '6 vCPU', 'disk_gb' => 200, 'price' => 205000],
        ['id' => 'pro-32g', 'tier' => 'pro', 'name' => 'NexSpace Pro 32GB', 'ram' => '32 GB', 'cpu' => '8 vCPU', 'disk_gb' => 400, 'price' => 410000],
    ],
];
