# Konfirmasi sebelum membuat pesanan

Ceklis “Tampilkan layanan favorit saja” (sebelumnya tidak memfilter daftar layanan) diganti dengan:

- Sudah membaca deskripsi layanan
- Target yang di masukan sudah benar.

Keduanya wajib dicentang sebelum Pesan aktif; handler checkout juga memeriksanya. Mengganti kategori/layanan mereset keduanya; mengganti target mereset konfirmasi target. Pesanan sukses mereset konfirmasi. Kegagalan API tidak otomatis mengulang pesanan. Tidak mengubah harga, saldo, payload checkout, atau backend pesanan; ini konfirmasi UI, bukan bukti pembacaan server.

Tes: `NODE_PATH=/tmp/streak-tests/node_modules node scripts/test-order-confirmations.mjs` (jsdom test-only). Build/upload frontend untuk menerapkan perubahan, tidak perlu SQL baru.
