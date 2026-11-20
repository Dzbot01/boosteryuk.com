# Google login terpusat (root & child panel)

## Konfigurasi Google Console — sekali saja

OAuth Client tipe **Web application**. Tambahkan tepat satu **Authorized redirect URI**:

```
https://boosteryuk.com/api/google_auth.php?action=callback
```

Redirect URI harus persis sama (termasuk query `action=callback` dan tanpa slash tambahan). Alur frontend sekarang authorization-code redirect server-side, bukan GSI/popup. **Authorized JavaScript origins tidak diperlukan** untuk alur ini; tidak perlu menambahkan subdomain baru ke Google Console. Root, www, app dan child panel mengawali OAuth di boosteryuk.com.

Di `.env` folder API server, pastikan `GOOGLE_CLIENT_ID` dan **GOOGLE_CLIENT_SECRET** terisi dari client yang sama. Secret kini wajib untuk pertukaran authorization code. Jangan memasukkan secret ke frontend/VITE, Git, URL, atau chat. Tidak ada nilai kredensial baru di repo ini.

## Deploy

1. Upload `php-api/google_auth.php` dan `php-api/google_oauth_flow.php` ke `/api` **di domain pusat boosteryuk.com**, bersama configdb.php dan `.env` server yang sudah ada. PHP perlu HTTPS, cURL, mysqli/PDO MySQL dan akses keluar ke accounts.google.com / oauth2.googleapis.com.
2. Jalankan SQL `php-api/google_oauth.sql` pada database MySQL yang sama dengan users/sessions/child_panels. Tabel users/sessions juga harus mendukung transaksi (InnoDB). Endpoint juga membuat tabel otomatis; untuk hosting tanpa CREATE privilege, jalankan manual sebelum deploy.
3. Deploy frontend hasil build, termasuk `.htaccess` untuk Apache. Pastikan URL SPA `/auth/google` di root dan `/auth/finish` di root/child bisa dibuka langsung (bukan 404). Vercel memakai rewrite yang sudah ada. Worker child harus melayani SPA fallback juga.
4. Tabel child_panels/domains harus memakai skema terbaru (expires_at). Panel harus active dan expires_at NULL atau belum lewat. Tidak ada pendaftaran Google tambahan saat pembelian panel baru.
5. Callback harus dilayani langsung oleh host pusat, bukan melalui proxy child yang membawa X-Child-Panel. Jangan cache callback/start/exchange. Cookie `__Host-by_google` memerlukan Secure, HttpOnly, SameSite=Lax, Path=/, tanpa Domain; proxy tidak boleh menghapus Set-Cookie atau query string.
6. Jangan log query `code`, `state`, atau `token` ke analytics/log publik. Endpoint memakai no-store/no-referrer. Halaman auth tidak merender Layout/konten pihak ketiga. Tambahkan Referrer-Policy:no-referrer dan Cache-Control:no-store juga di CDN/Worker jika header origin tidak diteruskan. HTTPS wajib; uji end-to-end di staging host yang diizinkan, bukan localhost.

## Alur & proteksi

- Tombol login membuat bukti acak di **sessionStorage tab asal**, dan challenge SHA-256.
- Redirect ke `https://boosteryuk.com/auth/google?return=<hostname>&challenge=<hash>`. Halaman ini meneruskan ke API pusat `action=start`; server melakukan whitelist hostname persis terhadap tabel panel aktif, tanpa menerima URL/path/port/scheme/userinfo. Host pihak pertama root/www/app diizinkan eksplisit.
- Server menyimpan hash state acak 256-bit, hash cookie browser, tujuan, nonce, dan verifier PKCE. State berlaku 10 menit dan dikonsumsi atomik di callback. Database + cookie host-only mengikat state ke browser (bukan hanya mempercayai nilai query).
- Google authorization code ditukar di server dengan client secret + PKCE S256. ID token diverifikasi lewat Google tokeninfo, aud/iss/exp/email_verified dan nonce diperiksa. Cari/buat akun memakai logic akun Google existing.
- Callback tidak membuat token sesi di URL. Dibuat grant acak 256-bit berlaku **1 menit**, hanya hash disimpan di DB, terikat host tujuan dan challenge tab.
- Redirect ke `https://<host>/auth/finish?token=<grant>`. Halaman segera menghapus query dari address bar dan POST ke API pusat dengan grant + verifier tab. Origin request wajib persis HTTPS host terdaftar; origin dari browser tidak diambil dari body.
- Pertukaran memakai SELECT FOR UPDATE, memeriksa expiry, host, bukti tab, lalu DELETE grant dan INSERT sesi pada transaksi yang sama. Dua exchange bersamaan tidak bisa memakai grant yang sama. Grant rollback hanya jika pembuatan sesi gagal. Token sesi disimpan di localStorage **origin tujuan** sesuai format sesi aplikasi existing; tidak berbagi cookie login antarsubdomain.
- Whitelist dicek saat mulai, callback dan exchange. Panel suspended/expired/terhapus tidak bisa menerima login. Batal/error menampilkan pesan dan tombol ulang; tidak redirect ke URL bebas.
- Frontend men-share promise exchange agar React StrictMode tidak menghabiskan token dua kali. Tidak ada GSI/client ID fetch saat bootstrap, jadi startup app tidak menunggu layanan Google.
- Endpoint ID-token lama dipertahankan untuk kompatibilitas klien lama, tetapi frontend baru tidak memakainya.

## Playground

Tombol header tidak tampil di child panel. Akses langsung `/playground` di child diarahkan kembali ke `/`. Root domain tetap memiliki Playground. File fitur tidak dihapus.

## Pengujian

Lokal: `node scripts/test-google-redirect.mjs` menguji URL pusat/challenge/bukti tab, penghapusan query, satu exchange pada StrictMode, penyimpanan sesi, bukti hilang, pembatalan dan error expired. Build dan pemeriksaan sintaks PHP dijalankan. Tidak ada package baru di package.json.

**Wajib uji integrasi di hosting** (Google/HTTPS/MySQL tidak tersedia sebagai stack live di sandbox):

1. Login user lama/baru dari dua subdomain berbeda; sesi dan akun berada di domain tujuan yang benar. Uji root/www/app juga.
2. Child yang baru dibeli langsung bisa login tanpa menambahkan origin/redirect URI baru di Google Console.
3. Tolak return domain luar, `evilboosteryuk.com`, `panel.boosteryuk.com.evil.test`, URL dengan scheme/port/path, subdomain tidak terdaftar, expired dan suspended. Respons tidak mengandung Location ke host tersebut.
4. Ubah state, hilangkan cookie, ulang callback, expiry state: semua ditolak. Pembatalan Google tidak membuat sesi.
5. Ubah grant/host/verifier, gunakan di browser/tab tanpa bukti, tunggu >60 detik, replay dan dua exchange bersamaan: tidak ada sesi kedua. Pastikan grant dihapus saat exchange sukses dan disimpan hash, bukan plaintext.
6. Bila Google/DB gagal, tidak ada sesi atau redirect bebas; uji retry dari tab asal. Secret/token Google tidak tampil di frontend.
7. Header Playground hilang di child dan direct URL dialihkan, root tidak berubah.

## Diagnosis `Metode tidak didukung` saat `action=start`

Respons itu bukan hasil normal handler redirect `start`. Kemungkinan utama adalah file `google_auth.php` lama masih dilayani atau file helper tidak cocok; kondisi hosting perlu diverifikasi, jangan menganggap frontend deploy juga mengunggah PHP.

1. Upload ulang **kedua** file dari versi repo yang sama: `google_auth.php` dan `google_oauth_flow.php`, ke direktori `/api` yang benar-benar melayani **boosteryuk.com** (bukan hanya child/app atau folder frontend dist).
2. Pastikan query string diteruskan utuh oleh CDN/proxy. URL nyata harus memakai `&`, bukan teks literal `&amp;`. Jangan memakai ulang challenge dari contoh/link lama; mulai ulang dari tombol di child panel asal.
3. Buka `https://boosteryuk.com/api/google_auth.php?action=oauth_status`. Versi ini mengembalikan `ok:true`, `protocol:1`, dan `redirect_ready:true` jika helper ada dan ID/secret terisi. Endpoint tidak menampilkan credential, tidak menyentuh DB, dan tidak memulai OAuth.
4. Jika masih mendapat `Metode tidak didukung` pada URL status, server belum melayani file PHP terbaru: cek document root/rute API, cache CDN dan OPcache/PHP hosting. Endpoint di repo tidak bisa memperbarui file hosting dengan sendirinya.
5. Jika `redirect_ready:false`, baca pesan, upload helper dan lengkapi GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET pada `.env` server. Lalu pastikan SQL, callback tunggal, dan HTTPS/cookie sesuai langkah deploy di atas.

Frontend sekarang memeriksa status sebelum meninggalkan child panel, sehingga server lama/konfigurasi tidak lengkap ditampilkan sebagai pesan di modal, bukan halaman JSON mentah. Tombol kembali bergaya Google berbingkai putih, pill, logo G empat warna, label masuk/daftar, lebar 300px; ini tombol custom berpenampilan serupa, **bukan** widget GSI (redirect terpusat tetap dipertahankan).
