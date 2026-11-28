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
assert.match(profile, /Akun Saya/, 'judul "Akun Saya" di tengah atas header');
assert.match(profile, /viewBox="0 0 1440 120"/, 'pola gelombang halus di bawah header');
assert.match(profile, /fill="#8B5CF6"/, 'gelombang ungu lebih terang');
assert.match(profile, /bg-\[#22C55E\]/, 'lingkaran hijau Pemasukan + titik indikator akun aktif');
assert.match(profile, /bg-\[#F59E0B\]/, 'lingkaran oranye Pengeluaran');
assert.match(profile, /-mt-10 rounded-2xl bg-white p-4/, 'card pertama menimpa (overlap) bagian bawah header');
assert.match(profile, /VERSI_APP = '6\.1\.4'/, 'baris Versi App menampilkan 6.1.4 (variabel)');
assert.match(profile, /formatRupiah\(/, 'semua nominal diformat Rupiah');
for (const baris of ['Transfer', 'Referral', 'Tukar Poin', 'Riwayat', 'Kartu Saya', 'Pengaturan Profil', 'Saldo'])
  assert.ok(profile.includes(`label="${baris}"`), `baris menu "${baris}" ada`);
assert.match(profile, /active:scale-\[0\.99\] active:bg-slate-50/, 'baris menu punya efek tekan');
assert.match(profile, /<PengaturanAkunPage embedded \/>/, 'Pengaturan Akun tetap ter-embed');
assert.match(profile, /<OwnedTitles \/>/, 'OwnedTitles tetap dirender');
console.log('PASS footer white logo card, sky-blue header/sidebar brand; halaman profil mobile-first (header ungu bergelombang, card overlap, menu Transfer/Referral/Tukar Poin/Riwayat, Versi App) dengan semua fitur lama dipertahankan.');
