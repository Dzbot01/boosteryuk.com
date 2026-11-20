# Animasi avatar dan pesan login

- Dependency sesuai permintaan: `@lottiefiles/dotlottie-react` (package.json + lockfile).
- User reguler memakai RvCn4lEDXK.lottie; Plus atau EXTRA aktif (`plusActive`, `plan.plus`, `plan.extra_active`) memakai Afpy1ehqkk.lottie dari URL yang diberikan.
- Diterapkan pada sidebar penuh/rail, bottom navbar, Profil dan Pengaturan Akun. Canvas mengisi ukuran avatar existing (40–80px), contain/center, loop/autoplay, rendering offscreen dibekukan.
- Player di-lazy-load. Avatar/initials lama tetap tampil selama loading; diganti hanya setelah render frame. Load/render error, import/player error, atau timeout 12 detik mempertahankan fallback lama. Perubahan tier me-reset player/fallback agar sumber animasi mengikuti akun.
- Aset eksternal dan runtime WASM memerlukan koneksi browser/CORS/CSP yang mengizinkan host player. Tidak ada aset dari host eksternal yang berhasil diverifikasi di sandbox; bila host diblokir fallback harus tetap tampil. Tidak ada kredensial/backend/SQL yang berubah.
- Error pada form login tidak lagi menampilkan diagnosis teknis ke user: teks persis **Ups! Tunggu sebentar lalu cobalagi**. Logic pemeriksaan server/login tetap sama.

## Deploy & uji

Jalankan `npm ci` dan `npm run build`, deploy frontend. Uji user reguler, Plus, EXTRA aktif, dan EXTRA kedaluwarsa; cek ukuran sidebar mobile/desktop, navbar dan halaman profil. Blokir request lottie.host/runtime di DevTools: initials/avatar lama harus tetap terlihat; buka blokir dan reload untuk mencoba animasi lagi. Gagalkan request PHP login: pastikan teks error persis seperti di atas. Uji downgrade/upgrade akun tanpa avatar premium tertinggal.

Lokal: build dan tes `node scripts/test-avatar.mjs`, serta regresi `node scripts/test-google-redirect.mjs` lolos. Tsc hanya dua error baseline DepositInvoicePage/PlaygroundPage. Pengujian visual dan fallback player di browser live belum dijalankan.
