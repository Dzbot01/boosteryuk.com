
## D. Refinement visual homepage (v2)
Tugas refinement visual (bukan rebuild). Konten, fungsi, auth, backend, routing dijaga 100%.
- **Hero background:** layer WebGL `Lightfall` (kanvas ogl + animasi kontinyu) diganti
  komposisi CSS ringan & statis: navy dalam + glow cyan terarah + grid halus + garis
  "meteor" diagonal. Mengurangi noise, hemat performa. File `Lightfall.tsx` TIDAK dihapus
  (hanya tidak dirender di homepage).
- **Visual kanan:** logo kini di dalam "orb" kaca yang menyatu dengan latar (bukan gambar
  menempel). Ring orbit dikurangi 3 → 1. Animasi float kontinyu dihapus. Dua kartu status
  (Booster aktif, Engagement naik) tetap (informatif) namun statis & bergaya kaca gelap.
- **Statistik:** rating di baris atas, dua metrik (698+, 24/7) sejajar di bawah — konsisten,
  tidak meng-wrap/terpotong di desktop & mobile.
- **Tipografi:** tracking headline dirapikan, ukuran sedikit diturunkan (tidak oversized).
- **Performa & aksesibilitas:** tanpa library animasi baru / WebGL; transisi tetap halus;
  ditambah dukungan `prefers-reduced-motion` (menonaktifkan animasi berjalan).
- Diverifikasi: 0 error TS, `vite build` sukses, 0 runtime error, tanpa overflow horizontal
  (desktop & mobile), konten & seksi (hero, ulasan, marquee, footer) tetap lengkap.

> Backup versi sebelum refinement: `RESTORE-POINT_Boosteryukk-v1.zip`.

## E. Revisi hero (grey + art peta dunia), dark hitam, preview WhatsApp (v3)
- **Hero:** tema diganti ABU-ABU/NETRAL dengan art peta dunia (gambar statis
  `public/hero-world.webp`, di-grayscale + digelapkan). Latar biru-navy sebelumnya dibuang.
- **Logo:** dikembalikan ke versi awal — logo BERANIMASI (float) dengan beberapa LINGKARAN
  di belakangnya, TANPA card/orb dan tanpa badge mengambang.
- **Mode gelap = HITAM (bukan biru tua):** latar dasar `#0a0a0b`, token `--by-*` dark
  dinetralkan (surface/muted/line jadi abu-abu gelap), blob ambient biru/fuchsia dinetralkan.
- **Preview WhatsApp (Open Graph):**
  - PENTING: tidak ada "modal"/pengaturan di aplikasi yang mengontrol ini. Preview WhatsApp
    dibaca dari tag `<meta property="og:*">` di `index.html` SAAT HALAMAN DIMUAT. Crawler
    WhatsApp/Facebook TIDAK menjalankan JavaScript, jadi pengaturan React/Admin tidak terbaca.
  - Gambar preview baru yang profesional: `public/og-image.jpg` (1200×630, ~108 KB, < 300 KB
    syarat WhatsApp) — wordmark Boosteryuk + tagline + stat, tema grey/peta dunia.
  - Tag OG/Twitter lengkap; URL gambar absolut via `siteUrlPlugin` (default https://boosteryuk.com).
  - Versi cache dinaikkan ke `?v=4`.

### Cara agar preview muncul di WhatsApp (WAJIB, karena bukan di aplikasi):
1. **Deploy build ini ke domain boosteryuk.com** sehingga `index.html` + `/og-image.jpg`
   tersaji di root domain (hasil `npm run build` ada di folder `dist/`).
2. **Refresh cache crawler:** WhatsApp memakai cache Facebook. Buka
   https://developers.facebook.com/tools/debug/ → masukkan `https://boosteryuk.com` →
   klik **Scrape Again**. Setelah itu kirim ulang link di WhatsApp (chat baru).
3. Pastikan `https://boosteryuk.com/og-image.jpg` bisa dibuka (HTTP 200, image/jpeg).

## F. Perbaikan "hero hanya hitam" (gambar peta 404)
- Penyebab: `public/hero-world.webp` tidak tersaji di hosting (404), jadi hero kosong/hitam.
- Perbaikan: gambar peta dunia kini **ditanam (inline) sebagai data-URI di CSS** (`.hero-map`),
  jadi TIDAK MUNGKIN 404 walau aset tidak ikut ter-upload. Base hero dibuat abu-abu/charcoal
  (jaring pengaman) dan peta dibuat lebih terlihat (opacity .60, brightness .92). File
  `public/hero-world.webp` tetap disertakan untuk referensi.

## G. Hero kembali GELAP + responsif desktop + modal lebar (v4)
- Hero dikembalikan ke tema GELAP (charcoal + peta dunia, teks terang) atas permintaan,
  TETAPI pertahankan: hero naik ke belakang header (tak ada strip hitam di atas), peta
  ditanam di CSS (anti-404), dark mode hitam.
- Header: teks dibuat terang saat melayang di atas hero gelap (homepage, belum scroll).
- Responsif desktop:
  - Halaman "Buat Pesanan" (Layanan) jadi 2 kolom di desktop: FORM rata KIRI (±440px) +
    slider diperkecil di kanan (16/10). Mobile tetap bertumpuk (slider atas, form bawah).
  - Slider OrderVps diperkecil di desktop (maks 720px, 16/10).
  - 17 halaman sempit diberi utility `.page-align-left` (rata kiri di desktop).
- Modal diperlebar di desktop: SettingsModal & FAQModal (max-w-md -> sm:max-w-xl),
  BottomSheet (max-w-2xl -> max-w-3xl).
