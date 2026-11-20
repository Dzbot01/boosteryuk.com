# Event dan game Naikkan Akunmu!

## Perubahan

- Ikon Event mengambang dihapus. Event ada setelah **Cek Status Pesanan** di menu pengguna yang login (termasuk admin). Rute `/event` dan `/event/:id/game` memerlukan login.
- Kartu poster vertikal desain Uiverse mamyapro123 dengan status pada switch gaya; tidak ada tampilan countdown. Judul “Hitung mundur tahun baru” tetap judul event. Kartu game yang berlangsung langsung membuka game HTML lampiran. Coming soon tetap menyembunyikan judul/deskripsi; event selesai membuka detail.
- Admin `/admin/events` dapat memilih jenis Game Naikkan Akunmu!, jadwal, dan status. Event awal id 1 dengan judul asli dan jenis lama countdown dimigrasi ke game; event lain tidak diubah. Akhir seed tetap 1 Januari 2027 00.00 WIB. GET daftar tetap publik untuk kompatibilitas, tanpa data progres pribadi.
- Progres per `(event_id,user_id)`: username permainan, posting, followers, views, like, komentar, skor, tahapan, waktu akhir, grid, status selesai. Save berkala saat menjawab (maksimal sekali/8 detik), mulai, selesai, dan saat tab tersembunyi; bukan setiap frame. Reload mengambil DB. Konflik revisi menolak overwrite dari tab/perangkat lama. Koneksi gagal dapat kehilangan progres yang belum tersimpan; jangan menutup tab sebelum tersimpan.
- Inventori dan bonus terpisah di DB. Merchant memakai **saldo website asli**, bukan saldo Rp10.000 bawaan HTML. Ada konfirmasi nominal dari halaman induk sebelum pembayaran. Harga ditentukan ulang server; pembelian langsung memperbarui saldo, inventori, dan Riwayat Pesanan berjenis Event dengan ID `EVG...`. Saldo juga dimuat ulang setiap 15 detik saat halaman terlihat.
- Item adalah **item virtual game**, bukan pengiriman followers/like ke akun media sosial asli. Bonus item ditampilkan di profil game terpisah dari statistik organik kuis; skor kompetisi mengikuti formula kuis asli, tidak ditambah bonus merchant.

## Keamanan dan batasan

Iframe sandbox tanpa `allow-same-origin`; token login hanya berada di halaman induk, tidak dikirim ke HTML. Bridge memvalidasi window sumber, channel acak, aksi, dan antrean. API mengautentikasi user dan memeriksa jadwal/jenis event. Semua harga, saldo, inventori, dan konsumsi item ditulis server.

Pembelian memakai transaksi InnoDB dengan user/player row lock, pengurangan saldo bersyarat, inventori, riwayat, dan receipt dalam satu commit. Request ID unik + hash payload membuat pengulangan **ID yang sama** tidak memotong dua kali. Retry tombol setelah timeout di halaman yang sama memakai ID sebelumnya. Konsumsi item juga idempoten. Sesudah timeout pembayaran, jangan reload dan membayar ulang sebelum memeriksa riwayat/saldo: reload dapat membuat ID baru. Tidak ada refund/prize otomatis. Status riwayat Event final dan dikecualikan dari pengubahan status manual admin; bukan order provider SMM.

**Statistik kuis masih dihitung browser dan belum anti-cheat.** Server memvalidasi batas nilai dan menghitung ulang formula skor, tetapi bukan bukti jawaban sah. Leaderboard ditandai `verified:false`; hadiah menunggu verifikasi admin. Maksimal 5 mulai permainan per akun per hari WIB, global lintas event. Resume tidak memakan jatah. Mulai baru mereset statistik kuis terakhir (bukan best score); inventori dan bonus merchant tetap. Fitur grant/reset admin HTML lama tidak dipakai.

## Deploy (belum dijalankan ke produksi)

1. Backup DB dan uji di staging dengan akun/saldo khusus uji.
2. Jalankan `php-api/events.sql`, `php-api/riwayat_pesanan_migration.sql` bila kolom riwayat belum tersedia, lalu `php-api/event_game.sql`. SQL game hanya membuat dua tabel baru. Endpoint dapat menyiapkan tabel/kolom bila izin DB memungkinkan. Tabel `users`, `riwayat_pesanan`, `event_game_players`, `event_game_receipts` **wajib InnoDB**; pembayaran ditolak jika ada engine berbeda. Jangan konversi tabel produksi tanpa backup dan maintenance yang sesuai.
3. Upload `events.php`, `event_game.php`, `event_game_lib.php`, `admin_data.php`, `riwayat_schema.php` ke folder `/api`, dengan `child_panel_lib.php` dan `configdb.php` existing tetap tersedia. Jangan mengganti kredensial.
4. Build `npm run build`; upload isi `dist/`, termasuk `games/naikkan-akunmu.html`. Server wajib menyajikan HTML tersebut sebagai file, bukan fallback SPA. Frontend dan API harus dirilis bersama. PHP membutuhkan mysqli/mysqlnd seperti API existing; tidak membutuhkan mbstring baru.
5. Jika lewat child panel, pastikan proxy existing meneruskan `event_game.php` ke API utama dan autentikasi bekerja. Tidak ada perubahan kredensial atau layanan Supabase.

## Pengujian lokal

- `node scripts/test-events.mjs`: lifecycle/tanggal event dan kontrak API.
- `node scripts/test-event-game.mjs`: sintaks seluruh JS game, UUID fallback opaque iframe, RPC sumber/channel, respons sukses/gagal, sandbox, menu.
- `node scripts/test-avatar.mjs`, `node scripts/test-google-redirect.mjs`: regresi fitur sebelumnya.
- Build produksi dan parser sintaks PHP lulus. TypeScript masih memiliki dua error baseline: DepositInvoicePage unused method dan deklarasi ScrollExpand di PlaygroundPage.
- **Belum diuji runtime PHP/MySQL atau visual perangkat/browser.** Pengujian Node bukan bukti transaksi saldo end-to-end berhasil.

## Wajib lolos di staging sebelum saldo nyata

1. Guest tidak melihat menu Event; pengguna/admin melihatnya tepat setelah Cek Status. Tidak ada ikon floating atau tombol memunculkannya lagi. Cek kartu poster vertikal mobile/desktop, coming soon, modal selesai, dan rotasi game.
2. Mulai game, jawab soal, reload: username/statistik/tahapan/grid kembali. Buka dua tab: save dari revisi lama ditolak. Save tidak boleh menimpa hasil selesai; permainan berikutnya harus melalui aksi start server. Pengguna lain/event lain terisolasi.
3. Catat saldo awal, beli satu tiap produk. Pastikan selisih tepat harga server, inventori benar, satu riwayat Event selesai, dan saldo header diperbarui. Coba saldo kurang, kuantitas negatif/desimal/di atas 100, ID produk palsu, harga palsu, token kedaluwarsa, event upcoming/finished.
4. Kirim dua request bersamaan dengan ID identik: hanya satu potongan/riwayat. Ulang ID dengan cart berbeda: ditolak. Dua ID berbeda dengan saldo hanya cukup satu: hanya satu berhasil. Simulasikan putus respons setelah commit, lalu retry ID sama.
5. Paksa kegagalan insert riwayat/receipt: saldo dan inventori harus rollback. Coba engine non-InnoDB: pembayaran harus ditolak tanpa potongan.
6. Seret item: inventori turun satu, bonus naik sesuai katalog, reload tetap sama. Retry ID konsumsi sama tidak mengurangi lagi. Tidak ada panggilan provider atau saldo/hadiah gratis dari HTML.
7. Pastikan order Event muncul pada filter riwayat pengguna/admin, bukan SMM atau estimasi markup SMM; checkout SMM/OTP/VPS/agen dan avatar/OAuth lama tetap bekerja.


## Jika merchant menampilkan error JSON / HTML

`Unexpected end of JSON input` berarti respons kosong/terpotong. `Unexpected token '<'` berarti respons berupa HTML (misalnya 404, fallback SPA, halaman proteksi hosting, atau output error PHP), bukan bukti saldo kurang. Penyebab spesifik perlu dilihat dari status/respons di Network dan log hosting; frontend tidak dapat memperbaiki upload atau routing server secara otomatis.

1. Pastikan **backend ikut di-upload**, bukan hanya hasil build frontend. Upload versi terbaru `event_game.php`, `event_game_lib.php`, `child_panel_lib.php`, `riwayat_schema.php` ke `/api` hosting PHP; pertahankan `configdb.php` server. SQL ada di langkah Deploy di atas.
2. Buka `/api/event_game.php` pada host API yang dipakai website (domain utama: `https://boosteryuk.com/api/event_game.php`; app/child: host masing-masing). GET seharusnya membalas **HTTP 405 JSON** `Gunakan POST.`, bukan halaman website/404. Ini hanya memeriksa file/routing, belum membuktikan koneksi DB/transaksi berhasil.
3. Jika HTML proteksi hosting, periksa Worker/proxy yang sudah ada dan route `/api/*`; jangan arahkan API ke `index.html`. Worker app existing sudah meneruskan semua path `/api/*`, tidak memiliki allowlist endpoint game.
4. Jika respons kosong/HTTP 500, periksa log PHP. Endpoint terbaru membuang output warning/include dari respons JSON, melaporkan file pendukung yang hilang, dan mencatat exception/fatal ke log server tanpa membocorkan detail ke browser. Ini tidak dapat menangkap error dari webserver/proxy sebelum PHP dijalankan.
5. Setelah respons POST `get` valid, uji saldo kurang/saldo uji, riwayat, rollback, dan retry ID sama di staging. Respons pembayaran yang hilang bisa terjadi **sesudah commit**: cek saldo/riwayat terlebih dahulu, jangan membuat pembelian baru secara membabi buta. Klien tidak otomatis retry atau beralih endpoint saat gagal.

Tes penanganan respons: `node scripts/test-event-game-api.mjs` mencakup JSON sukses, kosong, HTML, challenge, 404, JSON terpotong, bentuk JSON salah, penolakan API, putus koneksi, serta satu request per panggilan (tanpa auto-retry pembayaran).

## Pembelian ditolak karena tabel belum InnoDB

Jika membuka API membalas JSON “Gunakan POST.” tetapi membeli membalas “tabel transaksi harus InnoDB”, routing/file API sudah terbaca; pemeriksaan engine database menghentikan permintaan **sebelum transaksi dan sebelum pengurangan saldo**. Hal ini tidak menjamin hasil permintaan lain yang sebelumnya timeout. `CREATE TABLE IF NOT EXISTS ... ENGINE=InnoDB` tidak mengonversi tabel lama yang sudah ada, misalnya `users` atau `riwayat_pesanan` berbasis MyISAM.

Gunakan **`php-api/event_game_innodb_migration.sql`** di phpMyAdmin database website. File menyediakan query pemeriksaan dan perintah ALTER yang sengaja dikomentari. Export backup lengkap, hentikan sementara semua transaksi/penulisan terkait (maintenance), pastikan InnoDB didukung, lalu jalankan hanya ALTER tabel yang belum InnoDB. Jika tabel tidak muncul, pastikan database benar dan jalankan migrasi pembuatan tabel terlebih dahulu. Jika hosting melarang ALTER/InnoDB, hubungi hosting; jangan menonaktifkan pengaman di PHP atau mengganti dengan MyISAM. ALTER melakukan implicit commit dan bisa mengunci tabel, jadi jangan jalankan sambil pembayaran aktif.

Upload `event_game.php` terbaru untuk melihat nama tabel dan engine yang menghalangi. Respons preflight ini memiliki `code: GAME_ENGINE_NOT_READY`, `payment_started: false`; frontend terbaru tidak menambah peringatan pembayaran ambigu pada penolakan tersebut. Timeout/HTML/HTTP 500 lain tetap memperingatkan untuk memeriksa riwayat sebelum membayar ulang. Tidak ada konversi engine otomatis dari request pengguna, penghapusan tabel, atau perubahan saldo dalam migrasi ini; tetap uji perubahan engine dan transaksi di staging sebelum produksi.


## Update: 5 permainan/hari, Data Event admin, poster dan tombol transaksi

### Deploy update ini

- Jalankan `php-api/event_game_daily.sql` pada database website (satu tabel InnoDB baru; tidak mengubah engine/struktur users). `event_game.sql` terbaru juga sudah memuat tabel ini untuk instalasi baru.
- Upload **bersamaan**: `event_game.php`, `event_game_lib.php`, **`event_game_admin.php`** terbaru ke `/api`, kemudian frontend hasil build termasuk HTML game dan `games/transaction-button.css`. HTML/API lama tidak boleh dicampur: versi baru mewajibkan sesi start dari server. Permainan aktif versi lama ditutup saat dimuat ulang tanpa menghapus statistik lama; pengguna dapat memulai sesi baru.
- Tidak ada migrasi/konversi database produksi yang dijalankan dari sandbox ini. Engine users tetap tidak diubah oleh kode ini; pembayaran tetap membutuhkan InnoDB seperti sebelumnya.

### Jatah harian

`event_game_daily` memiliki PK `(user_id,play_date)`; tanggal ditentukan server **Asia/Jakarta**, bukan jam browser. Batas **5 kali mulai berhasil per hari, global lintas event**. Pergantian tanggal membuat jatah baru tanpa cron. Membuka game, resume, melihat leaderboard, dan membeli item tidak memakan jatah. Mulai yang gagal rollback tidak memakan jatah. Mulai lalu meninggalkan permainan tetap memakai satu jatah.

Aksi `start` memakai transaksi, counter `UPDATE ... plays<5`, lock peserta dan receipt request-id. Retry ID start sama tidak menambah jatah lagi. Save memerlukan run ID server dan revisi; tidak dapat membuat ronde baru dengan save langsung atau menghidupkan sesi selesai. Counter bukan bukti anti-cheat jawaban; skor tetap belum terverifikasi. Inventori/bonus bertahan antar-ronde; statistik kuis dan skor yang ditampilkan adalah **ronde terakhir**, bukan akumulasi/best score. Sisa jatah ditampilkan di leaderboard.

### Admin Data Event

Klik kartu event berlangsung di `/admin/events` menuju `/admin/events/:id/data`. Tombol pensil tetap mengubah konfigurasi event. Halaman Data Event menampilkan total peserta unik yang mempunyai state game dan tabel 50 peserta/halaman: ID akun, username game, score, followers, likes, views, komentar, serta bonus merchant terpisah. Statistik tabel adalah statistik kuis, bukan bonus virtual berbayar.

Endpoint memverifikasi role admin di DB, menolak akses child panel, membatasi event/user, dan memakai row lock + revision untuk edit/hapus. Admin dapat mengubah score/followers/likes/views/komentar. Score manual disimpan sebagai adjustment server, tidak ditimpa save lama; tab game lama perlu dimuat ulang. Ronde baru mulai dengan statistik baru. Penghapusan hanya menghapus row peserta event (termasuk inventori/bonus event tersebut), **tidak menghapus akun website, saldo, riwayat/receipt pembayaran, atau counter harian**. Pengguna boleh ikut lagi jika masih punya jatah. Tidak ada refund otomatis.

### Tampilan

- Poster event vertikal 250×360, texture/grid/orb/tape/barcode dan switch mode sesuai contoh Uiverse mamyapro123. Switch menampilkan status Indonesia (Berlangsung/Akan hadir/Selesai); klik switch mengganti gaya, klik poster membuka event. Coming soon tetap merahasiakan judul/deskripsi dan tidak bisa dibuka.
- `TransactionButton` memakai desain Uiverse Admin12121 yang di-scope, tanpa menambah paket runtime. Dipakai di Buat Pesanan SMM, pesan OTP, NexSpace, paket/pesan Agen AI, bayar upgrade, dan bayar merchant HTML. Efek dijalankan lewat klik (termasuk touch/keyboard), menunggu **1,35 detik** sebelum menjalankan handler. Klik ganda dikunci; jika disabled/unmount sebelum selesai, handler tidak berjalan. Prefers-reduced-motion melewati animasi/dekorasi bergerak dengan jeda nol.
- Error server 5xx (kecuali penolakan engine yang diketahui), jaringan, respons kosong/HTML/rusak, dan timeout bridge ditampilkan sebagai **Game sedang ditutup, silakan cobalagi nanti.** Validasi saldo/kuota/login tetap menggunakan pesan spesifik. Tidak ada auto-retry pembayaran. Peringatan memeriksa riwayat bila putus koneksi tetap ada sebagai teks informasi terpisah.

### Validasi tambahan dan staging wajib

`node scripts/test-event-sessions.mjs` menguji start RPC, guard klik ganda, reuse request-ID saat retry dan kontrak sumber quota/auth/delete. Tes ini **bukan** eksekusi transaksi MySQL. `scripts/test-event-ui.mjs` memakai jsdom khusus pengujian (instal sementara di `/tmp`, tanpa perubahan package.json) untuk delay, klik ganda, pembatalan disabled/unmount, reduced motion, submit form, status poster, dan redaksi coming soon. Pemeriksaan sintaks PHP, build, tes bridge/API/event dan regresi avatar/OAuth juga dijalankan.

Sebelum produksi: uji 5 start berhasil, start ke-6 ditolak, resume/reload tidak menambah jatah, retry ID sama, dua tab bersamaan saat tersisa satu, batas 00.00 WIB, isolasi akun, edit admin vs save yang bersamaan, hapus game tanpa mengubah users/riwayat/kuota, halaman kedua peserta, non-admin ditolak, serta klik pesan hanya mengirim **satu** transaksi setelah animasi. Pengujian runtime PHP/MySQL dan visual perangkat belum dilakukan di sandbox.


## Koreksi kompatibilitas versi dan tombol paket Agen AI

“Aksi tidak valid.” saat mulai bermain bukan efek mengganti username game atau menghapus peserta. Source PHP terbaru menerima `start`; PHP sebelum fitur batas harian tidak mengenalnya. Pesan tersebut mengarah pada kemungkinan API lama di hosting/proxy/cache, bukan bukti masalah akun. Diagnosis produksi tetap memerlukan pemeriksaan file/respons server.

- Respons `event_game.php` kini menyertakan `api_version: 2`. Frontend memeriksa versi dan data jatah pada `get`/`start`; API lama ditolak sebelum game dimulai dengan instruksi update file, bukan fallback save lokal yang melewati kuota. Error `start` dari PHP lama juga diterjemahkan menjadi pesan versi tidak sesuai. Tidak ada auto-retry atau perubahan jatah/saldo oleh pemeriksaan versi frontend.
- `event_game_lib.php` memiliki penanda protokol yang diperiksa endpoint agar file PHP baru tidak berjalan dengan helper lama. URL iframe memakai `?v=2` untuk membedakan dokumen game dari cache lama.
- Upload `event_game.php` **dan** `event_game_lib.php` terbaru ke `/api` hosting PHP, bukan hanya frontend. Pertahankan configdb.php server. Jalankan SQL harian dari update sebelumnya jika belum dilakukan; tidak ada migrasi SQL tambahan pada koreksi ini. Jika file sudah benar tetapi versi respons lama, bersihkan cache proxy dan minta hosting me-refresh OPcache sesuai prosedurnya. Jangan membuka endpoint reset OPcache publik.
- GET `/api/event_game.php` kini diharapkan membalas HTTP 405 JSON dengan `api_version: 2` dan “Gunakan POST.” Ini hanya membuktikan versi file endpoint yang terlayani, bukan keberhasilan transaksi DB atau kecocokan semua helper. POST get yang terautentikasi harus sukses dengan versi 2 dan objek daily.
- Menghapus peserta hanya menghapus data event. Jatah harian tetap berdasarkan **ID akun website**, bukan username yang diketik di game. Mengganti nama game tidak mereset kuota. Peserta yang dihapus dapat mulai lagi bila masih punya jatah.
- Di Agen AI, tahap kartu harga/pilih paket kembali memakai tombol biasa yang langsung memilih paket. Animasi transaksi tetap hanya pada “Pesan Sekarang” di tahap pengisian data, dengan jeda sebelum submit seperti sebelumnya.

Tes API mencakup backend lama tanpa versi, `start` tidak dikenal, helper tidak cocok, kuota hilang, serta get/start versi baru. Tes kontrak Agen AI memastikan kartu harga tidak memakai TransactionButton dan form tetap memakainya. Pengujian langsung hosting/MySQL belum dijalankan.

## Update: grid gabungan, merchant child panel, kontak, musik dan hero

### Tampilan event dan musik

Seluruh status kini berada dalam **satu grid** yang sama, diurutkan Berlangsung → Akan hadir → Selesai. Badge/switch poster tetap menunjukkan status, dan judul/deskripsi coming soon tetap dirahasiakan. Grid responsif: satu kolom layar sempit, dua tablet, tiga desktop.

Klik poster game memanggil `MusicContext.play()` dalam gesture pengguna sebelum navigasi. Halaman game juga mencoba start untuk deep link. Ini memakai **satu Audio website yang sudah ada**, track build website, loop aktif; tidak membuat musik kedua di iframe dan tidak mengubah track. Ada tombol Putar/Jeda pada halaman game. Browser tetap dapat melarang autoplay; bila demikian pengguna perlu mengetuk Putar musik. Perilaku musik di luar halaman game tetap memakai kontrol global.

### Markup dan penghasilan merchant child panel

- Pengaturan markup 0–300% ada pada editor toko (admin utama/pemilik EXTRA/Pengaturan Website toko) dan tab Markup admin child panel. Disimpan dalam **JSON config existing** `child_panels.config.merchantMarkupPct`, bukan menambah kolom atau mengubah engine users.
- Harga unit = `ceil(harga_dasar × (1 + markup/100))`; total adalah jumlah harga unit × kuantitas. Default 0%. Katalog ditentukan server berdasarkan tenant hasil resolver host/Worker existing, bukan panel ID atau harga dari browser. Panel yang tidak aktif ditolak.
- HTML merchant menampilkan katalog harga respons API. Konfirmasi saldo berasal dari katalog server di parent; `expected_total` harus sama dengan total yang dihitung ulang saat buy. Bila harga berubah, pembelian baru ditolak sebelum potong saldo agar pengguna mengonfirmasi ulang.
- Dalam transaksi **yang sama** dengan saldo, inventori, history dan receipt, server memanggil ledger existing `cp_record_order` dengan kind `event`: harga dibayar, harga dasar, dan selisih profit. Tabel `child_panel_orders` dan `child_panel_activity` wajib InnoDB, ikut pemeriksaan sebelum pembayaran. Tidak ada konversi engine otomatis.
- Receipt/hash terikat tenant untuk mencegah retry lintas toko diatribusikan ke toko lain. Retry receipt sama di toko sama tidak menambah saldo potong atau pendapatan. Receipt root lama tetap dapat dibaca ulang dengan hash legacy; tidak ada backfill pendapatan untuk transaksi sebelum fitur ini.
- Tab **Penghasilan Merchant** menampilkan total omzet/profit/jumlah transaksi merchant (semua waktu) dan hingga 200 pembelian merchant terbaru dari toko tersebut saja. Ledger juga termasuk ringkasan total dan alur withdraw existing. Histori masih ditulis ke Riwayat Pesanan pengguna seperti biasa. Endpoint `record_order` browser menolak ID EVG agar transaksi ini tidak dicatat lagi sebagai SMM.

### Kontak support toko

Editor toko memiliki WhatsApp dan email support di config existing (`supportWhatsapp`, `supportEmail`), disanitasi server. Gunakan nomor kode negara, contoh `62812...`; UI juga menormalkan awalan 0 menjadi 62 saat membuat link. Halaman **Kontak Support** (termasuk modalnya) dan **Hubungi** memakai konfigurasi tenant yang sedang aktif, bukan kontak toko lain. Kosong berarti fallback kontak website existing. Kontak root tidak berubah. Setelah simpan, muat ulang halaman toko untuk mengambil konfigurasi baru.

### Pilihan hero

Gambar lampiran asli disertakan sebagai `public/themes/anime-new-year-fireworks.png` (tidak digenerasi ulang). Pilihan **Anime Tahun Baru** tersedia di Tema Website dan editor hero child panel. Memilihnya baru membuat draft/pratinjau; klik Simpan agar dikompres dan disimpan memakai alur upload gambar DB existing. Tidak mengganti hero otomatis; tombol bawaan/upload kustom tetap ada.

### Deploy dan validasi

1. **Rilis bersamaan** frontend terbaru (termasuk game HTML, CSS, dan folder themes) dan `child_panel.php`, `child_panel_lib.php`, `event_game.php`, `event_game_lib.php` ke PHP `/api`. Jangan mengganti configdb.php server.
2. Protokol game sekarang **api_version 3**, helper game versi 3 dan marker helper merchant child panel diperiksa sebelum transaksi. Ini sengaja menolak campuran PHP lama yang belum menghitung markup. Bersihkan cache hosting/proxy/OPcache bila masih melayani versi lama. Tidak ada endpoint reset cache publik.
3. Tidak perlu SQL migrasi baru: konfigurasi memakai JSON existing dan transaksi memakai ledger child panel existing. Migrasi game/kuota sebelumnya tetap harus sudah dijalankan. Tabel transaksi game/saldo/history dan ledger/activity child panel harus InnoDB; backup dan maintenance sebelum perubahan engine manual bila diperlukan.
4. Tes lokal: build; tes API/bridge/sesi/event/avatar/OAuth; `scripts/test-child-event.mjs` untuk propagasi katalog merchant dan kontrak sumber tenant/quote/ledger/isolation; `scripts/test-event-ui.mjs` juga menguji Audio mock tunggal, loop, pause dan pemulihan autoplay blocked. Parser PHP lulus. Kontrak sumber bukan eksekusi MySQL.
5. **Wajib staging**: root harga dasar; dua toko markup berbeda; harga daftar/konfirmasi/potongan tepat; profit = dibayar − dasar; satu transaksi/receipt/profit saat retry ID sama; gagal insert ledger/activity harus rollback saldo/history/inventori; penolakan `expected_total` lama tidak memotong saldo; tenant inactive/akses non-owner/data toko lain ditolak; transaksi merchant tidak tercatat ulang sebagai SMM; ringkasan dan withdraw tetap benar; markup save tidak menghapus kontak/brand; kontak/hero bertahan setelah reload; grid mobile/desktop; autoplay diblokir tetap bisa diputar manual dan tidak terdengar dua track.

Belum ada pengujian runtime PHP/MySQL, transaksi saldo sungguhan, atau visual/audio perangkat nyata. Belum ada deployment atau perubahan database produksi.
