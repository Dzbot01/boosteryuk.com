<?php
/**
 * Konfigurasi integrasi TokoVoucher (TopUp All Game).
 * SALIN file ini menjadi `tokovoucher_config.php` DI SERVER (jangan di-commit; sudah di-.gitignore),
 * lalu isi `secret` dengan SECRET KEY akun TokoVoucher Anda.
 * Bisa juga lewat environment: TOKOVOUCHER_USER_CODE & TOKOVOUCHER_SECRET.
 */
return [
    'user_code' => 'U261127WMDV3568YV', // kode akun TokoVoucher (boleh tampil tersamarkan di UI)
    'secret'    => '',                  // WAJIB diisi di server — tidak boleh bocor ke browser
    // 'base_url' => 'https://api.tokovoucher.me/v1',
    // 'timeout'  => 20,
];
