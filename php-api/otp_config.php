<?php
/**
 * otp_config.php — konfigurasi Order Nomor (OTP). Upload ke /api lalu ISI api_key DI SERVER SAJA.
 * Nilai harga SAMA dengan settings.js bot Paimon (bagian ORDER OTP) agar harga web = harga bot.
 * JANGAN commit api_key asli ke GitHub.
 */
return [
    'api_key'        => '',        // API key provider nomor OTP (sama dengan apiKey di settings.js bot)
    'base_url'       => 'https://smsbower.page/stubs/handler_api.php',
    'timeout'        => 15,
    'kurs'           => 17000,     // kurs USD → IDR
    'markup_persen'  => 20,        // margin persen web utama
    'markup_min'     => 1000,      // margin minimum (Rp)
    'pembulatan'     => 100,       // pembulatan ke atas (Rp)
    'sms_maks_menit' => 15,        // batas menunggu kode OTP; lewat → dibatalkan & saldo kembali
    'maks_aktif'     => 3,         // maksimal order OTP berjalan per user
];
