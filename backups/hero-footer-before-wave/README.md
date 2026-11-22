# Salinan sebelum pembaruan hero kecil dan footer bergelombang

Dibuat sebelum edit berdasarkan main `45c72661365872fea4337ab35e723eab42a6196d`.

Untuk rollback UI ini, salin file `.bak` ke lokasi aslinya:

- `Footer.tsx.bak` → `src/components/Footer.tsx`
- `SideMenu.tsx.bak` → `src/components/SideMenu.tsx`
- `HomePage.hero-desktop.css.bak` → `src/pages/HomePage.hero-desktop.css`

Hapus stylesheet baru `src/components/Footer.css` lalu build/upload frontend.
`HomePage.tsx.bak` disertakan untuk pembandingan tes; file aslinya tidak diubah.
Jangan timpa file dengan backup jika setelah rilis ini ada perubahan lain yang
masih diperlukan; gunakan diff/revert terbatas pada perubahan terkait.

Catatan desain: pada desktop tinggi >800px padding bawah hero bertambah64px
menjadi128px. Pada layar pendek padding bawah total56px agar target1280x720 tetap
muat dengan ukuran teks/jarak atas yang dikunci. Gradasi hero tetap asli.

Footer memakai selektor menu yang sama dengan SideMenu; aturan lama dipindah
utuh ke helper bersama, bukan diubah. Semua tautan footer lama dipertahankan.
Sosial memakai # karena URL akun resmi belum ada di konfigurasi. Tidak ada
perubahan PHP, SQL, Worker, atau routing; deploy frontend saja.
