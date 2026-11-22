# Salinan sebelum footer publik, kontrol header, video lebar, hero mobile

File .bak dibuat sebelum perubahan dari main
`32d655a04c37b9af5e0e42311df9d005d804cbf8`.

Rollback UI: salin Footer.tsx, Footer.css, BottomNavbar.tsx, Header.tsx,
Layout.tsx dari .bak ke src/components/; salin HomePage.tsx dan
HomePage.hero-desktop.css ke src/pages/, lalu build/upload frontend.
Jangan menimpa perubahan lain setelah rilis ini tanpa membandingkan diff.

Footer sekarang memakai getUserMenuItems(false,false,IS_CHILD_PANEL) untuk SEMUA
akun. Menu sidebar/admin aslinya tidak diubah. Legal Syarat/Privasi dan copyright
tetap di bawah; link Layanan lama yang memerlukan login dihilangkan dari footer.

BottomNavbar dipakai ulang dengan placement=header untuk desktop (urutan kanan:
Pengaturan, Profil jika login, Musik sesuai konfigurasi panel, FAQ, hamburger).
Mobile tetap memakai bottom bar. Modal dirender melalui portal document.body
agar tidak terpotong backdrop/filter header. Desktop header tetap tanpa logo.

Desktop video max-w-6xl sama dengan main di bawahnya. Hero desktop tidak diubah;
aturan max-width1023 baru meratakan teks, rating, statistik dan CTA ke tengah.
CTA mobile sempit boleh membungkus per grup: utama di atas, Masuk/Daftar sejajar.
Tidak ada perubahan API/PHP/SQL/Worker; deploy frontend saja.
