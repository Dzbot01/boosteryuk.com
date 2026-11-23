# Pratinjau target Google Maps

LinkPreview pada form Buat Pesanan mengenali URL Google Maps dan menampilkan kartu lokasi + iframe peta di bawah Target. URL/query target order tidak dimodifikasi. Tampilan responsif dan teks kartu mendukung tema gelap.

- Mendukung `google.com/maps`, `maps.google.com`, serta domain regional yang secara eksplisit diizinkan (termasuk google.co.id).
- Ekstraksi lokasi: query/q/destination, /place/nama, koordinat !3d!4d (prioritas dibanding center @), center @, ll, cid, dan URL embed pb.
- Iframe selalu berasal dari https://www.google.com, bukan URL target arbitrer. Query/koordinat dapat menghasilkan peta pencarian, bukan jaminan identitas listing tertentu; pengguna tetap perlu memeriksa lokasi.
- `maps.app.goo.gl/...` dan `goo.gl/maps/...` diselesaikan melalui PHP `maps_preview.php` setelah debounce. HTTP shortlink dinaikkan ke HTTPS untuk resolusi.
- Resolver hanya HEAD ke host/path shortlink Google yang diizinkan. Setiap redirect diperiksa manual; tidak ada followlocation otomatis, host arbitrary, kredensial URL, port tambahan atau TLS verification yang dimatikan. Tidak membuka halaman listing final di server. Maksimal 4 iterasi dan timeout per request dibatasi.
- Jika redirect non-Maps, tidak didukung, API belum di-upload, jaringan gagal, atau link tidak memiliki lokasi, tampil kartu dengan tautan asli, tanpa menebak lokasi.
- Jika embed diblokir browser/Google, tautan buka Google Maps tetap tersedia. Tidak mengklaim dapat mendeteksi kegagalan cross-origin iframe secara andal.
- Tidak memerlukan API key Google, paket npm baru, SQL, atau perubahan konfigurasi DB. Embed memerlukan koneksi browser ke Google dan tunduk pada kebijakan Google/browser. Nama pengguna/URL selain Maps tetap menggunakan preview lama.

## Upload

Upload file PHP baru `php-api/maps_preview.php` ke `/api/maps_preview.php`, lalu build dan upload frontend `dist/`. Jangan mengganti config.php/configdb.php. Pastikan PHP memiliki cURL dan outbound HTTPS ke Google. Belum deploy otomatis.

## Verifikasi

`NODE_PATH=/tmp/maps-preview-tests/node_modules node scripts/test-google-maps-preview.mjs`: deteksi host asli/palsu, parameter lokasi, render DOM, shortlink mock, fallback kartu, pergantian target, tanpa request metadata generik untuk Maps, PHP syntax parser dan kontrak redirect/TLS.

`npm run build` lolos termasuk 24 halaman SEO. Dua error tsc baseline DepositInvoicePage/PlaygroundPage tetap tidak terkait fitur ini. PHP CLI tidak tersedia dan Google live tidak dapat diakses dari sandbox; resolusi shortlink, lokasi nyata, browser embedding dan hosting harus dicek sesudah upload.
