<?php
/**
 * plan_config.php — harga paket Upgrade (dibaca plan_upgrade.php). Ubah di server bila perlu.
 *
 * plus  : sekali bayar, harga reseller SELAMANYA + badge reseller.
 * extra : langganan bulanan. Termasuk semua benefit Plus (selamanya) + Child Panel + Full Support.
 *         Bulan pertama harga promo KHUSUS user yang belum pernah berlangganan EXTRA,
 *         bulan berikutnya harga normal. Child panel nonaktif bila langganan tidak diperpanjang.
 */
return [
    'plus' => [
        'price' => 5000,
    ],
    'extra' => [
        'price'             => 20000, // per bulan (normal)
        'first_month_price' => 10000, // bulan pertama, sekali per user
        'markup_default'    => 10,    // markup awal child panel (%), bisa diubah reseller di Admin Panel Toko
    ],
];
