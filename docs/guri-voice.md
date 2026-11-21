# Pemulihan suara Guri setelah login Google

Alur Google redirect tidak lagi memakai handler login lama yang memanggil controller suara. `GuriVoiceSession` di layout sekarang memulai suara setelah AuthContext memuat sesi terverifikasi (termasuk kembali dari redirect dan restore sesi). Tidak ada perubahan OAuth/token/backend.

- Satu sapaan per token/mode dalam instance layout; refresh saldo/profil dan navigasi tidak mengulangnya. Reload dokumen dapat memulai sapaan lagi.
- Domain utama memakai full; child panel menunggu tenant sebelum memainkan welcome/full/off. Bila konfigurasi child gagal, tidak memaksakan suara domain utama. Mode off membersihkan audio dan subtitle.
- Autoplay tetap mengikuti kebijakan browser. Klik login memanggil prime secara sinkron sebelum await. Jika autoplay sesudah redirect ditolak, controller otomatis mencoba lagi pada interaksi biasa berikutnya tanpa tombol/kontrol tambahan di kartu. Gesture dari halaman sebelum redirect tidak menjamin izin suara di dokumen baru; tidak ada bypass kebijakan browser.
- Logout menghentikan audio dan melepas gesture listener. Promise play lama tidak boleh menghidupkan ulang suara sesudah stop/logout.
- Subtitle tetap mengikuti currentTime dari MP3 yang sudah ada; tidak ada audio AI baru atau dependensi runtime baru.

## Deploy

Frontend saja: `npm ci && npm run build`, upload isi `dist/` termasuk aset MP3 hasil build. Tidak perlu upload PHP, menjalankan SQL, atau mengubah Worker.

## Validasi

`NODE_PATH=/tmp/streak-tests/node_modules node scripts/test-guri-voice.mjs` memakai jsdom dan Audio mock untuk sesi login, replay guard, panel modes, subtitle, autoplay/gesture tanpa tombol, logout, stale promise, dan login kembali. Test-only jsdom dipasang di luar proyek. Build dan regresi UI dijalankan terpisah. Pemutaran MP3 nyata, volume perangkat, dan kebijakan Safari/iOS tetap perlu diperiksa melalui browser/perangkat sungguhan; browser dapat mensyaratkan tap setelah redirect.
