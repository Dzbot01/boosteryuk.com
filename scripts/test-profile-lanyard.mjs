import assert from 'node:assert/strict';import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));assert.ok(pkg.dependencies.three,'dependensi three terpasang');
const lanyard=fs.readFileSync('src/components/Lanyard.tsx','utf8');
assert.ok(lanyard.startsWith('// @ts-nocheck'),'Lanyard.tsx bebas pemeriksaan tipe');
assert.match(lanyard,/import \* as THREE from 'three';/);assert.match(lanyard,/import '\.\/Lanyard\.css';/);assert.match(lanyard,/export default Lanyard;/);
assert.match(lanyard,/new THREE\.WebGLRenderer/);assert.match(lanyard,/prefers-reduced-motion/);
const css=fs.readFileSync('src/components/Lanyard.css','utf8');assert.match(css,/\.lanyard \{/);assert.match(css,/\.lanyard-canvas \{/);
// Halaman profil dirombak jadi UI mobile-first (header ungu + card rounded): avatar bulat 64px
// memakai UserAvatar (ikon profil animasi yang sama) dengan fallback ikon user abu-abu di latar putih.
const page=fs.readFileSync('src/pages/ProfilPage.tsx','utf8');
assert.match(page,/import UserAvatar from '\.\.\/components\/UserAvatar';/,'halaman profil memuat UserAvatar');
assert.match(page,/h-16 w-16[^"\n]*rounded-full border-4 border-white/,'avatar bulat 64px ber-border putih tebal');
assert.match(page,/<UserAvatar user=\{user\} fallbackClassName="bg-white">/,'avatar memakai ikon profil animasi dengan latar putih');
assert.match(page,/<User className="h-7 w-7 text-slate-400"/,'tanpa foto -> ikon user abu-abu');
assert.match(page,/samarkanTengah\(user\.phone/,'nomor telepon disamarkan di header');
// Fitur lama tetap ada di halaman profil (rombak UI tidak menghapus fungsi).
for (const fitur of ['<AvatarPicker \/>','<OwnedTitles \/>','<TikTokAnalytics \/>','<PengaturanAkunPage embedded \/>','onClick=\{logout\}','to="/deposit"'])
  assert.match(page,new RegExp(fitur),'fitur lama dipertahankan: '+fitur);
const svg=fs.readFileSync('public/images/google-profile-default.svg','utf8');assert.match(svg,/width="512" height="512"/);
// Halaman pengaturan profil: ikon statis diganti animasi Lanyard (three.js) yang sama.
const set=fs.readFileSync('src/pages/PengaturanAkunPage.tsx','utf8');
assert.match(set,/const Lanyard = lazy\(\(\) => import\('\.\.\/components\/Lanyard'\)\);/,'halaman pengaturan memuat Lanyard malas');
assert.match(set,/frontImage=\{profilePhoto\} backImage=\{profilePhoto\}/,'kartu animasi memakai ikon profil yang sudah ada');
assert.match(set,/\/images\/google-profile-default\.svg/,'fallback ikon default di halaman pengaturan');
assert.match(set,/aria-label="Ikon profil animasi 3D"/,'slot animasi ikon profil ada');
assert.ok(!set.includes('UserAvatar'),'ikon statis UserAvatar tidak dipakai lagi di halaman pengaturan');
console.log('PASS profil: card ikon profil memakai animasi Lanyard (three.js) dengan ikon profil yang sudah ada.');
