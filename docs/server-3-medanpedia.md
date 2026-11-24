# Server 3 — Medanpedia (api.medanpedia.co.id)

Integrasi provider ketiga dengan alur & UI yang sama seperti Server 1/2, tetapi **belum
ditampilkan** di kolom server maupun daftar layanan umum. Satu-satunya pintu masuk saat
ini: kolom Google Maps Review di dashboard (gambar Top Service) → tombol keranjang →
halaman Buat Pesanan dengan kategori & layanan terpilih otomatis.

## Endpoint provider

- `POST /services` → `{status,msg,data:[{id,name,type,category,price,min,max,refill,average_time,description}]}` (price = Rp per 1000, format sama dengan Server 1)
- `POST /order`, `POST /status`, `POST /refill`, `POST /refill_status`

## File PHP (upload ke /api)

Baru: `medanpedia_lib.php`, `medanpedia_services.php`, `medanpedia_status.php`,
`medanpedia_refill.php`, dan **privat** `medanpedia_config.php` (salin dari
`medanpedia_config.example.php`, isi `$MP_API_ID` dan `$MP_API_KEY`; jangan commit). Diperbarui:
`order.php`, `order_price.php`. Tidak ada SQL baru; cache file `medanpedia_*_cache.json`
otomatis (TTL 10 menit). Key hanya dibaca di PHP; semua request keluar memakai TLS
tervalidasi, timeout, tanpa follow redirect.

- Transport adaptif: bentuk request yang ditolak provider (`permintaan tidak valid`, 400/405/415) dicoba ulang dengan bentuk lain (POST form → GET query → POST JSON) untuk endpoint baca, dan bentuk yang berhasil di-cache (`medanpedia_transport_cache.json`). Endpoint mutating (order/refill) TIDAK di-retry (anti double-submit) dan memakai transport cache. Penolakan eksplisit provider = exception `MpReject` dengan pesan ASLI server; order menolaknya = refund atomik, status/refill meneruskannya ke pemanggil.
- `medanpedia_services.php` (publik): hanya kategori+layanan Google Maps Review
  (filter regex `google\s*(maps?)?\s*review` / substring "google map"). Katalog penuh tidak dipublikasikan.
- `medanpedia_status.php` (publik): menerima `S3-<id>`, `S3-PENDING-<16hex>`, dan ID angka
  polos (untuk auto-deteksi). Tidak ditemukan → `status:false` supaya pemanggil lanjut mencoba server lain.
- `medanpedia_refill.php` (publik): `{action:"refill"|"refill_status", id}`; bentuk balasan sama dengan reffil.php Server 1.
- `order.php`: server=3 valid; harga diverifikasi server (katalog Medanpedia + markup web/Plus/panel sama seperti Server 1);
  penolakan eksplisit provider = saldo dikembalikan atomik; timeout/ambigu = `S3-PENDING-<16hex>` (saldo tetap, rekonsiliasi manual admin, tanpa retry otomatis);
  ID sukses = `S3-<id provider>`; nama riwayat berprefix `[Server 3]`.
- `order_price.php`: cabang server 3 memvalidasi layanan+min/max dari katalog; gagal validasi = order ditolak (bukan harga kiriman).

## Frontend

- Dropdown server tetap hanya Server 1 & Server 2. Mode Server 3 hanya lewat deeplink
  `/layanan?server=3&service=<id>`: kolom Server tampil sebagai chip read-only
  "Server 3 — Google Maps Review", kategori/layanan dimuat dari endpoint publik subset GM Review,
  layanan dari param dipilih otomatis.
- Cek Status: ID `S3-…` langsung ke Medanpedia; ID angka polos dicoba satu persatu
  Server 1 lalu Server 3; bulk campuran S2/S3/polos dipecah per grup dan digabung.
- Refill & status refill: `S3-…` → Server 3; ID polos → Server 1 lalu Server 3; `S2-…` tetap pesan "belum tersedia".
- Dashboard: dua kolom POLOS (tanpa card) Kategori & Layanan GM Review persis di bawah gambar Top Service, tombol
  keranjang gaya modal Layanan Rekomendasi. Tamu: simpan path tertunda di sessionStorage +
  buka modal login; setelah login (kembali ke /overview) Layout melanjutkan ke step order.
  Menutup modal tanpa login membatalkan path tertunda. Kolom selalu tampil: skeleton saat memuat,
  panel error jelas + tombol Coba Lagi bila API gagal, pesan informatif bila katalog belum punya kategori GM Review.
- Garis pembatas tipis setelah kolom (mt-10) dan jarak lebih besar ke video player (mt-12).

## Asumsi & batasan

- Markup Server 3 sama dengan Server 1 (Rp4.425/1000, Plus Rp1.000/1000, faktor child panel),
  karena tidak ada instruksi markup khusus.
- Refill Server 2 tetap nonaktif; status Server 2 tetap lewat prefix S2-.
- Kategori GM Review bergantung penamaan kategori di Medanpedia; bila provider memakai nama
  lain, kolom dashboard kosong sampai nama cocok filter.
- Integrasi live (key, order sungguhan, respons refill) belum diverifikasi dari sandbox.

## Verifikasi

`NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-server3-medanpedia.mjs`
(syntax PHP via parser, kontrak order/refund/pending/auto-deteksi, jsdom kolom+keranjang+
gerbang login, Server 3 tidak muncul di dropdown). `npm run build` lolos (24 halaman SEO);
tsc hanya dua baseline error DepositInvoicePage/PlaygroundPage.

## Satu UI dengan Server 1 (menggantikan jalur server=3 terpisah)

- `fetchServices(1)` memuat katalog Server 1 DAN Server 3 sekaligus, lalu menggabungkannya
  dalam satu daftar/UI default. Item Server 3 diberi namespace ID `M3:<id>` + `source: 3`
  agar tidak bertabrakan dengan ID Server 1/2; tidak ada teks/tanda tambahan di tampilan.
- Saat order, prefix `M3:` dilepas dan `placeOrder` mengirim `server: 3` sehingga order.php
  tetap memakai jalur Medanpedia (ID pesanan `S3-…` / `S3-PENDING-…` tidak berubah).
- Tombol keranjang kolom Google Maps Review di dashboard kini mengarah ke
  `/layanan?service=M3:<id>` (UI Server 1 default); resume setelah login mengikuti pola yang sama.
- Panel statis "Server 3 — Google Maps Review" di BuatPesananCard dihapus; dropdown server
  tetap hanya Server 1 & Server 2.

## Kolom Top Service di dashboard: konten hardcode

Kolom Kategori/Layanan Google Maps Review di dashboard TIDAK lagi memanggil API
(sebelumnya fetchServices(3) saat mount + retry). Isinya hardcode sesuai referensi pemilik web:
kategori "Google Map Review" dan layanan "Google Buzzer Indonesia Map Reviews [ 5 ⭐ ]
[ Custom Comments Reviews ] [ Max 1K ]" dengan label harga "Rp 1.331.000 / 1rb · min 10 – max 1000".
Katalog asli (Server 1 + Server 3) baru dimuat saat tombol keranjang diklik dan user masuk ke
halaman /layanan; layanan yang sama dipilih otomatis karena preselect kini cocok lewat ID atau nama.

## Catatan penomoran (sejak adanya SMMGen)

Label UI "Server 3" kini milik provider SMMGen (internal `server=4`, prefix `S4-`, lihat
docs/server-4-smmgen.md). Medanpedia tetap internal `server=3`/prefix `S3-` tetapi tidak pernah
tampil sebagai opsi terpisah: katalognya digabung ke daftar Server 1 dan kolom Top Service hardcode.
