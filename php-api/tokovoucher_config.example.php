<?php
/**
 * tokovoucher_config.example.php — CONTOH config integrasi top up (sistem API baru).
 *
 * Salin menjadi `tokovoucher_config.php` di folder yang sama (file itu di-gitignore),
 * lalu isi SECRET KEY member Anda. Bisa juga lewat environment variable:
 *   TV_SECRET        = secret key member
 *   TV_MEMBER_CODE   = opsional, menimpa member_code di bawah
 *
 * Dokumentasi endpoint penyedia:
 *   POST https://api.tokovoucher.net/v1/transaksi         {ref_id, produk, tujuan, server_id, member_code, signature}
 *   POST https://api.tokovoucher.net/v1/transaksi/status  {ref_id, member_code, signature}
 *        signature = md5(MEMBER_CODE:SECRET:REF_ID)
 *   GET  https://api.tokovoucher.net/member?member_code=&secret=
 *   GET  https://api.tokovoucher.net/produk/code?member_code=&secret=
 *   GET  https://api.tokovoucher.net/member/produk/full?member_code=&signature=
 *   GET  https://api.tokovoucher.net/v1/deposit?member_code=&secret=
 *
 * WEBHOOK perubahan status transaksi — isi URL ini di Member Area TokoVoucher:
 *   https://app.boosteryuk.com/api/tokovoucher-webhook
 * (Worker Cloudflare menerimanya lalu meneruskan ke file ini sebagai ?action=webhook;
 *  validasi header X-TokoVoucher-Authorization = md5(MEMBER_CODE:SECRET:REF_ID).
 *  Uji cepat: https://app.boosteryuk.com/api/tokovoucher-webhook?probe=1)
 */
return [
    'member_code' => 'M250727KGST5158OE',
    'secret'      => '', // ← ISI SECRET KEY MEMBER DI SINI (jangan di-commit)
    // 'base_url' => 'https://api.tokovoucher.net',
    // 'timeout'  => 20,

    // Cek akun tujuan (apigames.id, Free Fire & Mobile Legends):
    // signature = md5(merchant_id + secret_key). Lihat member.apigames.id > Pengaturan > Secret Key.
    // Bila kosong, fitur cek akun dilewati senyap di UI.
    // Bisa juga lewat env: APIGAMES_MERCHANT_ID & APIGAMES_SECRET_KEY.
    'ag_merchant' => '',
    'ag_secret'   => '',
];
