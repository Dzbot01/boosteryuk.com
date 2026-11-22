# Backup sebelum hapus judul merek hero dan ubah ikon kalkulator

Dibuat sebelum edit dari main `50f185a572857eec710bb7118eafeed439359b32`.

Rollback: salin HomePage.tsx.bak dan HomePage.hero-desktop.css.bak ke nama asli
di src/pages/, lalu Calculator.tsx.bak ke src/components/Calculator.tsx.
Hapus stylesheet baru src/components/Calculator.css kemudian build/upload ulang.
Jangan timpa perubahan lain sesudah rilis ini tanpa membandingkan diff.

Perubahan: hanya heading merek di hero dihapus (tagline tetap, menjadi h1),
ukuran/spasi elemen lain dipertahankan tanpa ruang judul kosong. Kalkulator
memakai trigger ikon transparan di bawah dekat dock mobile / kanan desktop.
Panel tetap memiliki UI keypad, sekarang terbuka di atas area bawah layar;
nama kalkulator tersedia untuk aksesibilitas, tidak ditampilkan sebagai teks.
Arithmetic tidak diubah. Frontend-only, tidak perlu upload PHP atau SQL.
