<?php
/**
 * tokovoucher_pricelist.example.php — CONTOH override katalog manual di server.
 *
 * Salin jadi `tokovoucher_pricelist.php` (file itu di-gitignore) bila ingin menambah/
 * mengganti katalog produk suatu game TANPA deploy frontend: halaman detail TopUp All
 * Game memakai file ini sebagai sumber pertama (source="override"), lalu pricelist live
 * penyedia (source="provider"), terakhir snapshot di repo.
 *
 * Cara isi: buka dashboard/pricelist penyedia (tokovoucher.me/pricelist), salin KODE
 * produk, nama, dan harga modal (kolom yang berlaku untuk akun Anda). JANGAN menulis
 * kode karangan — transaksi dengan kode yang tidak ada di pricelist akan ditolak penyedia.
 *
 * Format: [ 'Nama Game (sama dengan kartu)' => [ ['kode'=>…, 'nama'=>…, 'harga'=>…, 'butuh_server'=>bool], … ] ]
 */
return [
    'Mobile Legends' => [
        // Contoh BARIS (ganti dengan kode asli dari pricelist penyedia):
        // ['kode' => 'ML86',  'nama' => '86 Diamond',  'harga' => 20500, 'butuh_server' => true],
        // ['kode' => 'ML172', 'nama' => '172 Diamond', 'harga' => 40500, 'butuh_server' => true],
    ],
    'Free Fire' => [
        // ['kode' => 'MFF5', 'nama' => 'Free Fire 5 Diamonds', 'harga' => 756],
    ],
];
