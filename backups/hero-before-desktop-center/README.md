# Salinan sebelum perubahan layout teks hero desktop

`HomePage.tsx.bak` disalin dari `src/pages/HomePage.tsx` SEBELUM perubahan.
SHA-256: `f3f1058ae57cf06e361f7c6193fee4e8a2deab15ed464ff5a446c07b36a119cd`.
Versi dasar: `05a3af58ccb9bad05caff3c27ab40d947328382f`.

Untuk membatalkan HANYA penyesuaian hero ini:

1. Salin `HomePage.tsx.bak` kembali ke `src/pages/HomePage.tsx`.
2. Hapus `src/pages/HomePage.hero-desktop.css` (stylesheet baru khusus perubahan ini).
3. Build dan upload ulang frontend.

Jangan menimpa HomePage dengan salinan ini jika setelahnya ada perubahan lain
pada file yang ingin dipertahankan; dalam kasus itu cukup hapus import stylesheet
dan class `home-hero-*` yang ditambahkan. Tidak ada file PHP/API yang berubah.
