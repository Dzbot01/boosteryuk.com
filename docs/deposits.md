# Deposit website — Worker Tripay tetap dipakai

## Batas perubahan

Worker yang dikirim pemilik (`index.ts`, repo terpisah) **tidak diubah/disalin ke repo ini**. Pengambilan channel pada `useTripayChannels`/`getPaymentChannels` tetap seperti sebelumnya. Tidak ada konfigurasi, API key, private key, merchant code, atau signature Tripay baru di PHP/browser.

Endpoint Worker yang digunakan:

- `GET https://api.boosteryuk.com/api/tripay/channels` — frontend, tidak berubah.
- `POST https://api.boosteryuk.com/api/tripay/create` — body JSON `method`, `merchant_ref`, `amount` nominal murni, `customer_name`, `customer_email`.
- `GET https://api.boosteryuk.com/api/tripay/status?reference=...` — reference gateway, **bukan** merchant_ref.
- Callback yang sudah ada: Tripay → Worker memverifikasi signature → `https://boosteryuk.com/api/callback.php` dengan `X-Callback-Secret`. Secret callback lama tetap dipakai, tidak perlu diganti untuk fitur ini.

PHP baru adalah penyimpan lifecycle dan pengaman akun, **bukan pengganti gateway Worker**:

```
Browser + sesi login → /api/deposit.php → Worker /create atau /status → Tripay
                                ↓
                        MySQL invoice + ledger saldo
```

Alasan create melewati API akun: pembatasan satu deposit aktif tidak aman bila hanya disimpan di localStorage atau dikirim setelah invoice dibuat. API memesan satu slot unik per akun sebelum memanggil Worker, sehingga dua tab tidak membuat dua tagihan. Worker tetap membuat seluruh invoice, menghitung fee, signature, callback URL, return URL dan expiry seperti semula (24 jam untuk website). Alias QRIS2 → QRIS mengikuti Worker.

## Perhitungan

Semua invoice website baru mendapat bonus `floor(nominal × 3 / 100)`. Contoh nominal Rp10.000, fee customer Rp100:

- `amount` yang dikirim **ke Worker**: Rp10.000.
- tagihan dari Worker: Rp10.100 (nominal + fee customer), **bukan Rp10.400**.
- saldo setelah PAID diverifikasi server: Rp10.300.

Callback dan Cek status menggunakan fungsi kredit yang sama. Nominal/bonus diambil dari reservasi server, tidak dari browser dan tidak dari `amount_received` (yang dapat dikurangi biaya merchant). Identitas merchant_ref, reference, metode dan nominal dari detail Worker diverifikasi. Ledger `deposits.merchant_ref` unik; insert ledger, update saldo dan status invoice dilakukan dalam satu transaksi InnoDB. PAID tidak diturunkan menjadi unpaid oleh snapshot lama. Pembayaran PAID terlambat sesudah pembatalan lokal tetap dikreditkan sekali.

`deposits` tetap ledger **pembayaran sukses saja**, sehingga halaman admin Data Deposit/My Profit tidak berisi reservasi pending. `deposit_invoices` menyimpan pending/sukses/batal beserta QR, kode/link bayar, instruksi, nominal, bonus, biaya gateway dan waktu. Riwayat akun memakai gabungan invoice baru dan ledger lama, dengan filter user dari token server dan pagination 25 baris. Data nominal/bonus/fee historis yang memang tidak tersimpan ditampilkan `—`, bukan ditebak. Callback tanpa invoice baru (integrasi bot/alur lama) tetap memakai alur legacy yang sudah ada dan tidak diberi bonus retrospektif.

## Refresh, cek status dan batal

- Invoice aktif dipulihkan dari server ketika halaman metode dibuka. URL detail menyimpan **ID invoice saja**, bukan token/kunci. Pembaruan halaman memuat ulang detail akun dari database.
- `Cek status` meminta status live dari endpoint Worker dengan `reference`. Bila PAID, saldo di-refresh dari API akun, bukan `topUp` browser.
- Pending dengan reference dipoll setiap 15 detik. Gangguan ditampilkan, invoice tidak dihapus dan create tidak diulang otomatis.
- Tombol batal menunggu 600 detik dari waktu server; batas ini dicek lagi oleh PHP. Sebelum batal, PHP meminta status live. Jika PAID, tampil sukses, bukan batal. Jika Worker gagal merespons, pembatalan tidak diteruskan.
- **Worker terlampir tidak menyediakan endpoint pembatalan Tripay.** Batal hanya menutup invoice di aplikasi, menyembunyikan QR/tombol bayar dan membuka slot baru. QR lama di gateway mungkin tetap dapat dibayar sampai expiry. UI mengingatkan jangan membayar invoice lama; callback terlambat tetap aman dikreditkan. Jangan mengklaim QR gateway telah dimatikan.
- Riwayat menampilkan hasil sinkronisasi terakhir; buka Detail → Cek status untuk pemeriksaan live, termasuk invoice batal.

## Upload (belum dijalankan otomatis)

1. Backup database. Saat maintenance, jalankan `php-api/deposit_invoices.sql` di database website. File menyediakan tabel ledger bila belum ada, tabel invoice baru, serta konversi `users`/`deposits` ke InnoDB. Konversi dapat mengunci tabel; jangan jalankan saat transaksi aktif. API tidak otomatis mengubah engine tabel pengguna.
2. Upload bersama ke folder `/api` hosting:
   - `deposit.php` (baru)
   - `deposit_invoice_lib.php` (baru)
   - `callback.php` (diperbarui)
   - pastikan `deposit_lib.php`, `child_panel_lib.php`, `configdb.php`, dan `callback_config.php` lama tetap tersedia.
   PHP memerlukan mysqli/mysqlnd dan cURL HTTPS keluar ke `api.boosteryuk.com`. Tidak ada `tripay_server_config.php` yang perlu dibuat.
3. Upload `nexspace_config.php` untuk harga Started Rp3.000 / Rp5.000 / Rp10.000. Harga Pro tidak berubah.
4. Build frontend (`npm ci`, `npm run build`), upload hasil `dist/`. Jangan ubah deploy atau env Worker untuk perubahan ini.
5. Uji di akun sendiri dengan nominal minimum: bayar nominal + fee → saldo nominal +3%; ulangi cek/callback tidak menambah saldo lagi; uji dua tab, refresh QR, batas 10 menit, batal, dan riwayat akun berbeda. Pengujian pembayaran live tidak dilakukan di sandbox ini.

## Penanganan gangguan

- Timeout sesudah create dapat berarti gateway sudah membuat invoice tetapi respons belum sampai. Reservasi `CREATING` **tetap mengunci slot**, bukan otomatis retry/membuka slot yang berisiko membuat dua invoice. Bila callback PAID masuk dengan reference, server bisa memulihkan dan menyelesaikannya. Bila tidak, admin harus mencocokkan `merchant_ref` dengan dashboard Tripay. Setelah reference resmi diketahui, admin dapat mengisi kolom `reference` invoice yang sesuai, lalu pemilik akun menekan Cek status untuk mengambil detail melalui Worker. Jangan isi status PAID/saldo secara manual dan jangan membebaskan reservasi sebelum hasil gateway dipastikan.
- Worker terlampir membalas callback sukses sebelum hasil forward PHP selesai (`waitUntil`). Karena itu HTTP error PHP tidak menjamin callback akan diulang Worker. Pastikan file & SQL lengkap sebelum membuka deposit; Cek status melakukan rekonsiliasi lewat Worker bila callback sempat gagal. Untuk pembayaran terlambat pada invoice batal, admin perlu memonitor forward callback dan rekonsiliasi bila terjadi gangguan hosting.
- Pending lama yang dibuat **sebelum fitur ini** tidak tersimpan di database, sehingga tidak dapat direkonstruksi otomatis setelah refresh. Biarkan invoice lama selesai/expired sebelum rollout; ledger pembayaran lamanya tetap tampil tanpa menambah saldo ulang.
- Pembatasan slot berlaku pada API website baru, termasuk tab dan perangkat berbeda. Endpoint create Worker eksternal tetap publik sesuai file pemilik; tidak ada klaim bahwa pembatasan website juga mengubah akses langsung/bot pada endpoint Worker yang tidak diubah.
- Deposit WhatsApp manual tetap konsultasi admin, bukan invoice otomatis. Bonus estimasi UI menjadi 3%; admin tetap harus memverifikasi pembayaran dan tidak menarik nominal + bonus sebagai tagihan.

## Pemeriksaan lokal

- `node scripts/test-deposits.mjs`: kontrak integrasi Worker/no keys, kepemilikan, nominal-only, reservasi/cooldown/idempotensi berbasis source, client API mocked, harga dan FAQ.
- `NODE_PATH=/tmp/deposit-tests/node_modules node scripts/test-deposit-ui.mjs`: jsdom, restore QR, cooldown, form pending terkunci, tagihan vs bonus, cek status/refetch saldo, batal/remount, sembunyikan QR terminal, payload create.
- PHP syntax diperiksa memakai `php-parser` eksternal test-only. Test source-contract bukan pengganti pengujian transaksi/concurrency pada MySQL sungguhan. Tidak menambah npm dependency proyek.
