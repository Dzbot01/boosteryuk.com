<?php
/**
 * child_panel_config.php — konfigurasi upload video child panel ke Supabase Storage.
 * Upload ke /api lalu isi supabase_service_key (Supabase → Project Settings → API → service_role).
 * Key HANYA disimpan di server: browser admin hanya menerima signed upload URL sekali pakai.
 * JANGAN commit key asli ke GitHub.
 */
return [
    'supabase_url'         => 'https://dzvsjcjvnpasrwuuopeg.supabase.co', // proyek yang sama dengan video web utama
    'supabase_service_key' => '',
    'video_bucket'         => 'publik',  // bucket publik (sama dengan boosteryuk.mp4)
    'video_folder'         => 'childpanel',
    'video_max_mb'         => 50,        // batas file gratis Supabase
];
