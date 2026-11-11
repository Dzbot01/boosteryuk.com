<?php
/**
 * agent_config.php — konfigurasi proxy Agen Sewa AI (dipakai agent.php).
 * Upload ke folder /api, lalu isi token (HARUS SAMA dengan AGENT_TOKEN di VPS server.js).
 *
 * Alternatif: set env AGENT_TOKEN & AGENT_ORIGIN di server, file ini boleh kosong.
 */
return [
    // token rahasia, samakan dengan AGENT_TOKEN di VPS (settings.js / env)
    'token'  => '',
    // hostname tunnel Cloudflare ke VPS
    'origin' => 'https://wa-origin.boosteryuk.com',
];
