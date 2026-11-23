# Server 2 — Naizop

## UI dan routing

Dropdown Server ditambahkan di card Buat Pesanan; default tetap Server 1. Mengganti server membersihkan kategori/layanan/target/quantity dan acknowledgement sebelumnya, menampilkan loading, serta mengabaikan respons request server lama. Layout, kontrol kategori, layanan, jumlah dan target tetap seperti form bawaan. Server tidak dapat diganti selama checkout.

Server 1 tetap menggunakan services.php, order.php dan konfigurasi provider lama. Server 2 mengambil katalog lewat naizop_services.php. Hanya layanan **type Default** yang ditawarkan pada Server 2: kontrak pemesanan saat ini hanya service, link, quantity, runs=1. Tipe dengan required fields khusus (Subscriptions, Custom Comments, Poll, SEO, dll.) tidak dijual agar tidak menerima pembayaran untuk order yang parameternya tidak lengkap. Refill/cancel Server 2 belum diaktifkan; tidak diteruskan ke Server 1.

## Kurs dan markup

- PHP mengambil referensi USD→IDR terbaru dari `https://open.er-api.com/v6/latest/USD` (rate harian, bukan kurs bank jual/beli/intraday).
- Cache lokal kurs 1 jam; timestamp sumber harus tidak lebih tua dari 48 jam dan tidak di masa depan. Jika cache kedaluwarsa dan jaringan/sumber gagal, Server 2 ditolak sebelum debit (tanpa fallback harga browser/hardcoded).
- Katalog provider di-cache 10 menit dan dipisahkan berdasarkan fingerprint akun. Akun provider harus memakai USD; mata uang lain ditolak. API key tidak masuk respons/log/browser.
- Tarif IDR/1000 = rate USD × kurs, dibulatkan 6 desimal sebelum markup.
- Markup sama dengan Server 1: normal +Rp4.425/1000; Plus/trial +Rp1.000/1000. Child-panel tetap mengikuti persentase markup panel. Total = round(qty/1000 × rate setelah markup).
- Checkout memvalidasi ID/type/min/max dan menghitung ulang harga di PHP. Kenaikan harga >Rp1 dibanding quote memerlukan reload. Profit mencatat biaya dalam rupiah, bukan USD. Saldo provider 2 di My Profit root menampilkan USD asli, estimasi rupiah, kurs dan timestamp kurs.
- Tidak ada angka kurs statis yang diklaim terbaru: nilai ditarik pada saat PHP hosting melayani request. Konektivitas/kurs live belum diverifikasi dari sandbox.

## Order dan status

Request add di PHP: key, action=add, service, link, quantity, runs=1. TLS verification tetap aktif, timeout dibatasi, tidak retry otomatis pada add.

Order berhasil disimpan dengan ID `S2-<provider-order>` agar tidak bertabrakan dengan ID Server 1. Riwayat dan profit menggunakan ID yang sama. Cek Status mendukung ID campuran kedua server dan memisahkan routing. Charge USD sengaja tidak ditampilkan sebagai rupiah.

Penolakan eksplisit provider mengembalikan debit dan membalas ok:false. Timeout/response tidak jelas bisa berarti order sudah diterima: dicatat sebagai `S2-PENDING-...`, saldo tidak otomatis direfund, jangan kirim ulang; admin wajib rekonsiliasi di Naizop dengan link/jumlah/waktu dari riwayat. Tidak ada auto-resubmit. Pola pending manual Server 1 tidak diubah. Riwayat tidak otomatis diperbarui oleh endpoint cek status baru (mengikuti mekanisme aplikasi sebelumnya).

## Upload

1. Upload file baru `naizop_lib.php`, `naizop_services.php`, `naizop_status.php` ke `/api/`.
2. Salin `naizop_config.example.php` menjadi **`/api/naizop_config.php`** pada hosting. Isi `api_key` milik akun Naizop USD di PHP tersebut. File ini di-ignore Git; jangan masukkan key ke React atau chat.
3. Update `/api/order.php`, `/api/order_price.php`, `/api/admin_data.php`. Jangan mengganti config.php/configdb.php provider lama.
4. Folder PHP harus bisa menulis cache `naizop_*_cache.json` (di-ignore Git); cache tidak berisi API key.
5. Hosting perlu outbound HTTPS ke naizop.com dan open.er-api.com serta ekstensi cURL. Tidak ada perubahan Worker Tripay atau kredensial lain.
6. Build/upload frontend `dist/`. **Tidak diperlukan SQL baru**; memakai tabel riwayat/profit yang sudah ada.
7. Uji Server 1, pergantian server cepat, Server 2 katalog/min/max/markup Plus, order saldo kurang, order kecil, status S2, profit dan balance. Jangan menguji order produksi besar. Belum deploy otomatis.

## Verifikasi lokal

`NODE_PATH=/tmp/naizop-tests/node_modules node scripts/test-naizop.mjs` (php-parser test-only di luar repo): PHP parse, mock transport katalog/harga/markup/payload/ID/status campuran, isolasi refill, serta source contracts keamanan dan loading state. `npm run build` termasuk SEO prerender.

Tidak tersedia PHP CLI/MySQL lokal; autentikasi DB, debit/refund, konkurensi dan live provider belum diuji end-to-end. Dua error TypeScript baseline DepositInvoicePage/PlaygroundPage tetap terpisah dari fitur ini.
