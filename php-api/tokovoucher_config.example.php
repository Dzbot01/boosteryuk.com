<?php
/**
 * tokovoucher_config.example.php — CONTOH config integrasi top up (sistem API baru).
 *
 * Salin menjadi `tokovoucher_config.php` di folder yang sama (file itu di-gitignore),
 * lalu isi SECRET KEY member Anda. Bisa juga lewat environment variable:
 *   TV_SECRET        = secret key member
 *   TV_MEMBER_CODE   = opsional, menimpa member_code di bawah
 *
 * Dokumentasi endpoint penyedia (semua method GET):
 *   https://api.tokovoucher.net/v1/transaksi?ref_id=&produk=&tujuan=&server_id=&member_code=&secret=
 *   https://api.tokovoucher.net/v1/transaksi/status?ref_id=&member_code=&secret=
 *   https://api.tokovoucher.net/member?member_code=&secret=
 *   https://api.tokovoucher.net/produk/code?member_code=&secret=
 *   https://api.tokovoucher.net/v1/deposit?member_code=&secret=
 */
return [
    'member_code' => 'M250727KGST5158OE',
    'secret'      => '', // ← ISI SECRET KEY MEMBER DI SINI (jangan di-commit)
    // 'base_url' => 'https://api.tokovoucher.net',
    // 'timeout'  => 20,
];
