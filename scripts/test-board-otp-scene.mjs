// Papan Penilaian: username disensor (3 huruf depan + bintang) & 1 layanan = 1 penilaian.
// Order OTP: panggung 3D scene.glb di bawah Riwayat Nomor — TANPA card, TANPA fungsi geser
// kamera POV (panggung pasif), dan LEBIH TINGGI + kamera auto-fit (fitMargin) supaya model
// yang sedang beranimasi tidak terpotong/tertutup card di atas maupun Footer di bawahnya.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-board-otp-scene.mjs
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

const read = (f) => readFileSync(f, 'utf8');

/* ---------- 1. Statis ---------- */
const board = read('src/pages/ReviewBoardPage.tsx');
assert.match(board, /export function maskUsername\(u: string\) \{/, 'helper sensor username diekspor');
assert.match(board, /s\.slice\(0, 3\) \+ '\*'\.repeat\(Math\.max\(0, s\.length - 3\)\)/, '3 huruf depan + bintang sisanya');
assert.match(board, /export function dedupeByService\(rows: ReviewItem\[\]\)/, 'helper dedup layanan diekspor');
assert.match(board, /const k = \(r\.service_name \|\| ''\)\.trim\(\)\.toLowerCase\(\);/, 'kunci dedup nama layanan (case-insensitive)');
assert.match(board, /setRows\(dedupeByService\(r\.reviews \|\| \[\]\)\);/, 'papan memakai daftar hasil dedup');
assert.match(board, /\{maskUsername\(r\.username\)\}<\/td>/, 'kolom username dirender tersensor');

const esm = read('src/components/EmptyStateModel.tsx');
assert.match(esm, /modelUrl\?: string;/, 'EmptyStateModel menerima URL GLB custom');
assert.match(esm, /loadAsync\(modelUrl \|\| EMPTY_STATE_MODEL_URL\)/, 'GLB custom dipakai bila diberikan');
assert.match(esm, /\{text && <p className="mt-3 font-display/, 'teks opsional (panggung 3D saja bila tanpa teks)');
/* Fungsi geser/POV kamera DIHAPUS: panggung pasif lagi. */
assert.ok(!/OrbitControls/.test(esm), 'OrbitControls tidak dipakai lagi (fungsi geser POV kamera dihapus)');
assert.ok(!/interactive/.test(esm), 'prop interactive dihapus dari EmptyStateModel');
assert.ok(!/data-orbit-reset|Reset kamera/.test(esm), 'tombol Reset kamera dihapus');
assert.ok(!/touchAction|cursor = 'grab'/.test(esm), 'canvas tidak lagi menangkap drag pointer');
assert.match(esm, /className=\{`pointer-events-none w-full \$\{stageClassName\}`\}/, 'panggung pasif: pointer-events-none (tidak menahan scroll/drag)');
assert.match(esm, /if \(pivot\) \{\s*\n\s*pivot\.rotation\.y = Math\.sin\(t \* 0\.35\) \* 0\.55;/, 'ayunan animasi panggung aktif kembali');
/* Kamera di-fit otomatis agar model beranimasi tidak terpotong frame. */
assert.match(esm, /fitMargin\?: number;/, 'prop fitMargin (ruang gerak animasi) tersedia');
assert.match(esm, /const fitCamera = \(\) => \{/, 'fitCamera menghitung jarak kamera dari ukuran frame');
assert.match(esm, /const visH = 2 \* Math\.tan\(\(cam\.fov \* Math\.PI\) \/ 180 \/ 2\);/, 'tinggi frame dihitung dari FOV kamera');
assert.match(esm, /const minDistV = need \/ visH;\s*\n\s*const minDistH = cam\.aspect > 0\.01 \? need \/ \(visH \* cam\.aspect\) : minDistV;/, 'fit vertikal DAN horizontal (wadah sempit/tinggi di HP ikut dijaga)');
assert.match(esm, /const dist = Math\.max\(want, minDistV, minDistH\);/, 'kamera dijauhkan bila model akan terpotong, sedekat `zoom` bila masih muat');
assert.match(esm, /const need = target \* Math\.max\(fitMargin, 1\);/, 'ruang gerak animasi dihitung dari fitMargin');
assert.match(esm, /fitCamera\(\);\s*\n\s*\};\s*\n\s*if \(typeof ResizeObserver/, 'fitCamera dipanggil ulang setiap resize (aspect berubah)');
/* Tinggi panggung responsif: lebih tinggi, dan punya tinggi khusus layar sempit. */
assert.match(esm, /mobileHeight\?: number;/, 'prop mobileHeight tersedia');
assert.match(esm, /setStageH\(mobileHeight && w < 640 \? mobileHeight : height\);/, 'tinggi panggung menyesuaikan lebar layar (< 640px)');
assert.match(esm, /style=\{\{ height: stageH, opacity: state === 'ready' \? 1 : 0\.001 \}\}/, 'tinggi host mengikuti tinggi panggung efektif');
assert.match(esm, /\}, \[stageH, modelUrl, zoom, targetSize, fitMargin\]\);/, 'effect memuat ulang bila tinggi/model/ukuran berubah');

const otp = read('src/pages/OrderOtpPage.tsx');
assert.match(otp, /const OTP_SCENE_MODEL_URL = 'https:\/\/zcxtbtleeeaeqeryiwea\.supabase\.co\/storage\/v1\/object\/public\/video\/scene\.glb';/, 'URL scene.glb dari Supabase Storage public');
assert.match(otp, /modelUrl=\{OTP_SCENE_MODEL_URL\}/, 'panggung 3D memakai scene.glb');
const sceneBlock = otp.slice(otp.indexOf('aria-label="Scene 3D animasi"') - 260, otp.indexOf('aria-label="Scene 3D animasi"') + 520);
/* Tanpa card: section scene tidak boleh punya border/background/rounded/padding card. */
assert.match(sceneBlock, /<section className="relative mt-10 mb-16" aria-label="Scene 3D animasi">/, 'section scene polos (hanya jarak, tanpa card)');
assert.ok(!/rounded-\[18px\]|border|background: COLOR\.surface/.test(sceneBlock), 'scene tidak dibungkus card (tanpa border/background/rounded)');
assert.ok(sceneBlock.indexOf('mt-10') > -1 && sceneBlock.indexOf('mb-16') > -1, 'jarak longgar ke card di atas (mt-10) dan ke Footer di bawah (mb-16)');
/* Fungsi geser POV dihapus + panggung lebih tinggi. */
assert.ok(!/interactive|zoom=\{1\.7\}|Reset kamera/.test(sceneBlock), 'tidak ada lagi kontrol geser/POV kamera di scene Order OTP');
assert.match(sceneBlock, /height=\{560\}/, 'panggung lebih tinggi (560px desktop, sebelumnya 360px)');
assert.match(sceneBlock, /mobileHeight=\{460\}/, 'tetap tinggi di layar sempit (460px)');
assert.match(sceneBlock, /fitMargin=\{1\.45\}/, 'kamera menyisakan 45% ruang gerak agar animasi tidak terpotong');
assert.match(sceneBlock, /stageClassName="max-w-none w-full"/, 'panggung memakai lebar penuh (tidak dibatasi 280px)');
assert.match(sceneBlock, /className="!p-0"/, 'tanpa padding card di dalam panggung');
// Posisi: section scene berada SETELAH section Riwayat Nomor.
assert.ok(otp.indexOf('aria-label="Riwayat nomor OTP"') < otp.indexOf('aria-label="Scene 3D animasi"'), 'scene berada di bawah card Riwayat Nomor');

/* ---------- 2. Fungsional: maskUsername & dedupeByService ---------- */
const dir = mkdtempSync(path.join(tmpdir(), 'board-otp-'));
const { outputFiles } = await build({
  stdin: { contents: `export {maskUsername, dedupeByService} from './src/pages/ReviewBoardPage';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}', '__MUSIC_URL__': '""' },
});
const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
const { maskUsername, dedupeByService } = require(file);

assert.equal(maskUsername('andini_r'), 'and*****', 'username 8 karakter => 3 huruf + 5 bintang');
assert.equal(maskUsername('budi'), 'bud*', 'username 4 karakter => 3 huruf + 1 bintang');
assert.equal(maskUsername('ab'), 'ab', 'username <= 3 karakter tampil utuh');
assert.equal(maskUsername(''), '', 'username kosong aman');

const rows = [
  { username: 'andini_r', service_name: 'Google Maps Review', stars: 5, created_at: 'a' },
  { username: 'dimas_p', service_name: 'google maps review', stars: 4, created_at: 'b' },
  { username: 'sinta_n', service_name: 'TikTok Followers', stars: 5, created_at: 'c' },
  { username: 'fajar_a', service_name: 'TikTok Followers ', stars: 3, created_at: 'd' },
];
const uniq = dedupeByService(rows);
assert.equal(uniq.length, 2, 'satu layanan hanya satu penilaian (duplikat case/spasi dibuang)');
assert.deepEqual(uniq.map((r) => r.username), ['andini_r', 'sinta_n'], 'penilaian pertama per layanan dipertahankan');
assert.equal(dedupeByService([]).length, 0, 'daftar kosong aman');

console.log('PASS Papan Penilaian (username tersensor 3 huruf + 1 layanan 1 penilaian) & Order OTP (scene.glb 3D tanpa card, tanpa geser POV kamera, panggung lebih tinggi 560/460px + kamera auto-fit fitMargin 1.45 agar animasi tidak terpotong, berjarak sebelum Footer).');
process.exit(0);
