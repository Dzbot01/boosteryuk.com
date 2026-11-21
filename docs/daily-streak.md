# Daily Streak, Plus Trial, dan title event

## Aturan yang diterapkan

- Kartu Coming Soon bawaan **event #2** menjadi Daily Streak. Kartu Coming Soon baru adalah #3. Seed tidak menimpa event custom admin yang sudah diberi judul; jika #2/#3 sudah diubah, admin perlu menyesuaikannya melalui Kelola Event.
- Kalender server **Asia/Jakarta / WIB**, pergantian hari 00.00 WIB. Bukan cooldown 24 jam dari klik sebelumnya.
- Hari 1–6 mendapat saldo sesuai nomor hari: **Rp1, Rp2, Rp3, Rp4, Rp5, Rp6**, langsung menambah `users.balance`. Tidak membuat deposit, tidak memanggil Worker/Tripay atau payment gateway.
- Hari 7: **Plus Trial 24 jam**, dihitung sejak klaim berhasil, serta title permanen `daily-streak-7`. Hari 7 tidak memberi Rp1 tambahan.
- Satu klaim per akun per tanggal WIB. Request ulang, refresh, respons hilang atau tab lain tidak memberi hadiah kedua.
- Jika melewatkan satu tanggal saat progres hari 1–6, progres menjadi 0 dan klaim berikutnya adalah hari 1. Saldo lama dan title tetap dimiliki. Pemberitahuan reset dicatat server sampai pengguna mengakuinya.
- Setelah selesai hari 7, pengguna boleh memulai siklus baru paling cepat tanggal WIB berikutnya. Jeda setelah siklus yang sudah selesai tidak dianggap gagal.
- Trial disimpan di `user_plus_trials`, bukan `users.plus_active` atau flag Plus permanen. Entitlement diperiksa dengan UTC di server. Tidak memerlukan cron untuk kedaluwarsa. Klaim memperpanjang dari maksimum waktu sekarang/expiry trial sebelumnya sebanyak 86.400 detik.
- Member Plus permanen/EXTRA tetap mendapat pencatatan trial/title, tetapi paket/avatarnya tidak diturunkan menjadi trial. Pengguna trial-only memakai avatar trial khusus (termasuk saat pilihan avatar dasarnya perempuan); setelah habis, kembali ke avatar pilihan/default sebelumnya.
- `plan_upgrade.php` mengembalikan `plus`, `plus_permanent`, `plus_trial_active`, `plus_trial_until`. Harga SMM di `order_price.php` mengenali trial yang belum habis. Pembelian Plus permanen tetap boleh selama trial, bukan diblokir sebagai member permanen.
- Frontend menghentikan status trial saat expiry dan saat tab kembali aktif, termasuk saat offline. Otoritas hak/discount tetap server.

## Title dan badge Tahun Baru

- `daily-streak-7`: menyelesaikan hari 7; animasi memakai animasi ucapan selamat Daily Streak yang sama.
- `newyear-2027`: menyelesaikan satu sesi game event #1 yang mempunyai receipt `start` server, run_id sesuai, status selesai tersimpan, dan minimal **180 detik** sudah berlalu sejak receipt server dibuat. Ini badge penyelesaian/partisipasi, **bukan** bukti skor atau kemenangan leaderboard yang belum diverifikasi.
- Badge tidak diberikan hanya karena mengunjungi Event, menunggu countdown, memasukkan kode title, atau mengirim score tertentu dari browser.
- Game mencoba mencatat badge saat menyimpan sesi selesai; get koleksi juga merekonsiliasi sesi terakhir. Sesi lama tanpa receipt server tidak diberi badge retroaktif. Riwayat sesi selesai yang sudah ditimpa sesi baru sebelum fitur ini tersedia tidak dapat ditebak.
- Title tersimpan sekali per akun/kode dan tidak hilang bersama expiry trial, reset streak atau pergantian siklus.

## UI

- Halaman `/event/daily-streak` (bukan modal floating) mempunyai kartu api di atas grid 7 hadiah. Sebelum klaim pertama ditampilkan ikon api; sesudah hari 1 animasi pertama, hari 2–6 animasi kedua, hari 7 animasi ketiga.
- Semua URL animasi mengikuti permintaan pemilik. Animasi gagal memakai `loop={false}` sehingga berjalan satu kali dan berhenti pada frame terakhir; lainnya autoplay/loop.
- Hanya ucapan selamat/reset memakai sheet menempel di bawah dengan animasi masuk vertikal seperti FAQ bottom navbar, dukungan Escape, focus trap dan pemulihan scroll/fokus.
- Reset diinformasikan saat membuka halaman Daily Streak. Versi reset disimpan sehingga dua tab tidak salah mengakui reset yang lebih baru.
- `/profil` berisi identitas, saldo sebenarnya, pemilih avatar, bagian **Title dimiliki** dengan kartu vertikal yang langsung terlihat tanpa modal, dan pengaturan akun lengkap di bawah. Tidak menampilkan statistik pesanan dummy atau switch keamanan lokal palsu dari profil lama.
- `/pengaturan-akun` diarahkan ke `/profil#pengaturan-akun`; tombol profil bottom navbar/sidebar menuju halaman gabungan.
- Lottie gagal dimuat tidak membatalkan hadiah atau mengubah state server. Pada halaman profil, avatar menampilkan animasi saja tanpa gradient/latar/lingkaran tambahan; fallback adalah foto Google HTTPS jika tersedia pada field `picture` API, atau siluet profil Google default lokal jika tidak tersedia/gagal. Avatar di area lain tetap memakai fallback lamanya. Field `picture` opsional; perubahan ini tidak menambahkan penyimpanan foto pada backend OAuth.

## Database dan keamanan

`daily_streak.sql` membuat:

1. `user_daily_streaks`: progres, tanggal klaim terakhir, nomor siklus, notifikasi reset/ack.
2. `daily_streak_receipts`: tanggal klaim, hari, siklus, jumlah reward, expiry trial. PK `(user_id, checkin_date)`.
3. `user_plus_trials`: masa aktif trial terpisah dari langganan permanen.
4. `user_event_titles`: koleksi permanen. PK `(user_id, title_code)`.

API `daily_streak.php` menerima hanya aksi `get`, `claim`, `ack_reset` dan token sesi. ID user diambil dari token; tanggal/hari/bonus/nominal/trial/title tidak dipercayai dari browser. Sebelum operasi API memeriksa semua tabel reward dan `users` adalah InnoDB. Tidak otomatis mengubah engine pengguna saat request. Lock user `FOR UPDATE` → lock progres → tanggal WIB dihitung setelah lock → receipt unik → kredit/trial/title/progres → commit. Error melakukan rollback. Ini juga menjaga dua request yang melewati tengah malam. Claim pada event tidak aktif/selesai ditolak server.

## Pembaruan halaman dan nominal reward

- Kartu Daily Streak pada Event mengarah ke route terautentikasi `/event/daily-streak`. Halaman bisa di-refresh/dibuka langsung dan mempunyai tautan kembali ke Event. Tidak ada scroll-lock/modal untuk halaman utama check-in.
- Hari ke-7 pada grid memakai animasi avatar PLUS TRIAL (`nhBFSRR128.lottie`), bukan ikon mahkota statis. Animasi api besar hari 7 dan notifikasi sukses/gagal tetap dipertahankan.
- Perhitungan kredit baru ada di PHP, bukan hanya label UI: `cash = day <= 6 ? day : 0` dan update saldo terparameterisasi dengan nilai yang sama seperti receipt. Total cash satu siklus penuh sekarang Rp21; hari 7 hanya trial/title.
- Receipt lama dan saldo yang sudah diberikan **tidak dihitung ulang**. Pengguna yang sudah klaim hari ini tidak dapat mengklaim selisih lagi setelah pembaruan. Klaim pada tanggal berikutnya memakai aturan nominal baru sesuai progresnya.
- **Tidak memerlukan migrasi skema baru** bila `daily_streak.sql` dari rilis sebelumnya sudah dijalankan. Cukup upload `daily_streak.php` dan `events.php` terbaru, lalu build/upload frontend. `events.php` memperbarui deskripsi bawaan lama tanpa menimpa deskripsi custom admin. Instalasi pertama tetap memerlukan SQL dan semua file di bawah.

## Upload manual — belum dijalankan

1. Backup database dan jadwalkan maintenance. Pastikan tabel `site_events` dari versi Event sebelumnya sudah ada. Jalankan **`php-api/daily_streak.sql`** pada database website. File mengubah `users` ke InnoDB bila diperlukan (dapat mengunci tabel); lakukan setelah backup saat tidak ada transaksi aktif. Tidak mengubah credential database.
2. Upload file API berikut bersama-sama ke `/api` hosting:
   - **baru** `daily_streak.php`, `daily_streak_lib.php`, `plus_trial_lib.php`;
   - **diperbarui** `events.php`, `plan_upgrade.php`, `order_price.php`, `event_game.php`.
   - Pertahankan `configdb.php`, `child_panel_lib.php`, `event_game_lib.php` dan konfigurasi paket lama.
   `plan_upgrade.php`/`order_price.php` terbaru membutuhkan `plus_trial_lib.php`; jangan lupa file tersebut. SQL harus selesai sebelum membuka check-in publik. Game tetap berjalan bila skema badge belum siap, tetapi klaim reward ditolak sampai tabel lengkap.
3. `npm ci && npm run build`, upload hasil `dist/`. Tidak memerlukan npm dependency proyek baru; dotlottie sudah tersedia.
4. Tidak ada Worker Tripay, endpoint deposit, secret callback, deployment, atau database produksi yang diubah oleh pekerjaan ini.

## Pengujian sebelum produksi

Tes lokal:

- `node scripts/test-daily-streak.mjs`: kontrak keamanan/source backend, mapping animasi, client API/no retry, avatar trial/permanen/expired.
- `NODE_PATH=/tmp/streak-tests/node_modules node scripts/test-streak-ui.mjs`: jsdom grid, double click, saldo refresh, hari 1/2/7, popup sukses, kegagalan one-shot, ack reset, title, auth error, scroll/fokus, navigasi kartu Event ke halaman Daily Streak, kartu title inline, dan fallback Google.
- Build, parser syntax PHP dan seluruh tes regresi event/game/session/merchant/avatar/OAuth/deposit.

**Belum diuji dengan runtime MySQL atau pembayaran/saldo produksi.** Source-contract dan mock bukan bukti concurrency database nyata. Uji staging menggunakan akun/DB uji:

- dua tab/perangkat mengklaim tanggal sama → satu receipt, saldo bertambah sesuai nomor hari sekali;
- retry setelah respons putus → hadiah tidak bertambah lagi;
- hari berturut, batas 23:59:59 → 00:00 WIB, melewatkan sehari, tahun kabisat/pergantian bulan;
- hari 7 → trial tepat 24 jam, saldo tidak bertambah, title sekali;
- siklus berikut, reset notice lintas-tab, expiry saat tab tidur/offline;
- member permanen/EXTRA tidak diturunkan dan trial tidak menghalangi pembelian permanen;
- harga server trial berubah normal setelah expiry walaupun browser mengirim harga lama;
- akun A tidak dapat membaca/mengklaim progres atau koleksi akun B;
- selesaikan game 3 menit → badge Tahun Baru, `done` dini sebelum 180 detik tidak menghasilkan badge;
- uji Lottie pada perangkat nyata; sandbox tidak mengunduh URL lottie.host yang berada di luar allowlist jaringan.
