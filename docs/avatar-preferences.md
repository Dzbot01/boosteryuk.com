# Profil dan pilihan animasi Male/Female

## Deploy

- Deploy frontend terbaru.
- Upload `php-api/avatar_preferences.php` ke `/api` bersama configdb.php dan child_panel_lib.php server existing.
- Tabel `user_avatar_preferences` dibuat otomatis bila CREATE diizinkan; SQL manual ada di `php-api/avatar_preferences.sql`. Tidak ada perubahan tabel users atau data akun/gender.

## Perilaku

- `/profil` kini punya route login-required; bagian atas menampilkan avatar 128px, nama/email, badge akun, dan kontrol Ubah animasi profil. Pilihan tersedia pula di Pengaturan Akun, dengan link ke halaman profil.
- Male (default): animasi reguler atau premium berdasarkan Plus/EXTRA aktif seperti sebelumnya. Female: URL iFxLD7TCdf.lottie sesuai permintaan, mengoverride animasi paket tanpa mengubah paket akun.
- Simpan dulu untuk menerapkan pilihan. API menerima hanya male/female dan mengambil user_id dari token sesi, bukan dari input ID user. Tidak dapat mengatur akun lain.
- Setelah simpan sukses, seluruh avatar UserAvatar (sidebar/navbar/profil/pengaturan) mengikuti pilihan dari AuthContext. Preferensi dimuat saat login/refresh dari DB, bukan hanya localStorage, sehingga lintas perangkat/domain dengan akun yang sama.
- Jika API preferensi gagal saat login, login tetap berjalan dengan default/preferensi yang masih ada di state. Save gagal menampilkan pesan dan tidak menerapkan pilihan palsu. Request timeout 8 detik.
- Avatar tetap tanpa latar lingkaran ketika animasi aktif; fallback initials lama dipertahankan jika aset/player gagal. Preview dua animasi memakai player yang sama, bukan upload URL sewenang-wenang.

## Verifikasi

Build, test-avatar (termasuk female override untuk user reguler/Plus/EXTRA), dan parser sintaks PHP lolos. Tsc hanya dua error baseline DepositInvoicePage/PlaygroundPage. Belum ada uji runtime PHP/MySQL atau animasi eksternal live di sandbox.

Staging: pilih Female, simpan, cek avatar seluruh UI, reload/logout/login/perangkat lain. Kembali ke Male dan cek paket tetap memengaruhi animasi default. POST token invalid harus 401, pilihan di luar enum harus 400, user_id tambahan pada body tidak boleh memengaruhi akun lain. Blokir aset untuk memeriksa fallback dan gagalkan API untuk memastikan error save tidak mengubah preferensi.
