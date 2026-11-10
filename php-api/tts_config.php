<?php
/**
 * tts_config.php — Konfigurasi key ElevenLabs untuk tts.php.
 *
 * Upload file ini ke folder yang sama dengan tts.php (mis. boosteryuk.com/api/),
 * lalu ISI 'key' dengan API key ElevenLabs Anda.
 *
 * CATATAN KEAMANAN:
 *  - Jangan commit file ini ke Git setelah diisi (sudah di .gitignore).
 *  - Alternatif lebih aman: set environment variable ELEVENLABS_API_KEY di server,
 *    maka file ini boleh dibiarkan kosong (tts.php memprioritaskan env var).
 */

return [
    // Tempel API key di sini, contoh: 'sk_xxxxxxxxxxxxxxxxxxxxxxxx'
    'key' => '',
];
