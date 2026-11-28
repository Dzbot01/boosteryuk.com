import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(path, 'utf8');
const footer = read('src/components/Footer.css');
assert.match(footer, /\.site-footer-logo \{[^}]*background: #fff;/);
assert.match(footer, /\.site-footer-body \{[^}]*background: var\(--footer-blue\)/);
for (const file of ['Header', 'SideMenu']) {
  const source = read(`src/components/${file}.tsx`);
  assert.match(source, /<span className="text-sky-400">\{settings.brandName\}<\/span>/);
  assert.doesNotMatch(source, /<span className="by-accent">\{settings.brandName\}/);
}
assert.match(read('src/components/Header.tsx'), /aria-label=\{`\$\{settings.brandName\}.*className="[^"\n]*lg:hidden/);
const profile = read('src/pages/ProfilPage.tsx');
assert.doesNotMatch(profile, /page-align-left/);
// Rombak UI: mobile-first (360-414px), header gradient ungu + card rounded 16px, padding bawah 100px.
assert.match(profile, /bg-\[#F5F5F7\] pb-\[100px\]/, 'latar halaman #F5F5F7 + padding bawah 100px');
assert.match(profile, /mx-auto w-full max-w-md px-4/, 'kolom mobile-first (max-w-md) tetap terpusat di layar besar');
assert.match(profile, /linear-gradient\(160deg,#5B21B6 0%,#7C3AED 100%\)/, 'header gradient ungu #5B21B6 -> #7C3AED');
assert.match(profile, /Akun Saya/, 'judul "Akun Saya" ada di header');
// Modul "Akun Saya" + ikon avatar kini SATU baris dan diposisikan di tengah header.
assert.match(profile, /relative mx-auto mt-2 flex w-fit max-w-full items-center gap-3\.5/, 'blok Akun Saya + ikon jadi satu grup terpusat (mx-auto w-fit) di header');
assert.ok(profile.indexOf('h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full') < profile.indexOf('>Akun Saya</h1>'), 'ikon avatar berada di sisi kiri judul "Akun Saya" (satu baris, bukan di bawahnya)');
assert.ok(!/flex flex-col items-center/.test(profile), 'tidak lagi ditumpuk vertikal di tengah');
assert.match(profile, /viewBox="0 0 1440 120"/, 'pola gelombang halus di bawah header');
assert.match(profile, /fill="#8B5CF6"/, 'gelombang ungu lebih terang');
assert.match(profile, /bg-\[#22C55E\]/, 'lingkaran hijau Pemasukan + titik indikator akun aktif');
assert.match(profile, /bg-\[#F59E0B\]/, 'lingkaran oranye Pengeluaran');
assert.match(profile, /mt-6 rounded-2xl bg-white p-4/, 'card pertama berada DI BAWAH header ungu dengan jarak (mt-6), tidak menempel');
assert.match(profile, /md:mt-8 md:rounded-3xl md:bg-white md:p-6/, 'desktop: card besar punya jarak mt-8 dari header ungu');
assert.ok(!profile.includes('mt-4 rounded-2xl bg-white'), 'jarak lama (mt-4) yang membuat header menempel card sudah diganti');
assert.ok(!profile.includes('-mt-10'), 'tidak ada lagi margin negatif yang menyelipkan body ke bawah header');
assert.match(profile, /md:rounded-3xl md:bg-white md:p-6/, 'desktop: semua card profil menyatu menjadi SATU card');
assert.match(profile, /VERSI_APP = '6\.1\.4'/, 'baris Versi App menampilkan 6.1.4 (variabel)');
assert.match(profile, /formatRupiah\(/, 'semua nominal diformat Rupiah');
for (const baris of ['Transfer', 'Riwayat', 'Kartu Saya', 'Pengaturan Profil', 'Saldo'])
  assert.ok(profile.includes(`label="${baris}"`), `baris menu "${baris}" ada`);
// Menu Referral & Tukar Poin DIHAPUS dari halaman profil atas permintaan user.
for (const baris of ['Referral', 'Tukar Poin'])
  assert.ok(!profile.includes(`label="${baris}"`), `baris menu "${baris}" sudah dihapus`);
assert.match(profile, /active:scale-\[0\.99\] active:bg-slate-50/, 'baris menu punya efek tekan');
assert.match(profile, /<PengaturanAkunPage embedded \/>/, 'Pengaturan Akun tetap ter-embed');
assert.match(profile, /<OwnedTitles \/>/, 'OwnedTitles tetap dirender');
console.log('PASS footer white logo card, sky-blue header/sidebar brand; halaman profil mobile-first (header ungu bergelombang, body di bawah header tidak tertutup, desktop satu card, menu Transfer/Riwayat (Referral & Tukar Poin dihapus), Versi App) dengan semua fitur lama dipertahankan.');
