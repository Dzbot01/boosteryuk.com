// Papan Penilaian: username disensor (3 huruf depan + bintang) & 1 layanan = 1 penilaian.
// Order OTP: panggung 3D scene.glb di bawah Riwayat Nomor — TANPA card, model lebih besar,
// kamera POV bisa digeser/diputar + zoom (OrbitControls), dan berjarak longgar sebelum Footer.
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
assert.match(esm, /\}, \[height, modelUrl, interactive, zoom, targetSize\]\);/, 'effect memuat ulang bila model/ukuran/interaksi berubah');
/* Kamera POV interaktif (OrbitControls) + ukuran model bisa diperbesar. */
assert.match(esm, /interactive\?: boolean;/, 'prop interactive tersedia');
assert.match(esm, /await import\('three\/addons\/controls\/OrbitControls\.js'\)/, 'OrbitControls di-import dinamis (tidak membebani bundle halaman)');
assert.match(esm, /const oc = new OrbitControls\(cam, webgl\.domElement\);/, 'kontrol kamera dipasang pada canvas');
assert.match(esm, /oc\.enableDamping = true;/, 'gerakan kamera halus (damping)');
assert.match(esm, /oc\.minDistance = dist \* 0\.3;\s*\n\s*oc\.maxDistance = dist \* 3;/, 'batas zoom dekat/jauh dijaga agar model tidak hilang');
assert.match(esm, /webgl\.domElement\.style\.touchAction = 'none';/, 'drag di model tidak menggulir halaman (mobile)');
assert.match(esm, /webgl\.domElement\.style\.cursor = 'grab';/, 'kursor grab sebagai penanda bisa digeser');
assert.match(esm, /resetCamRef\.current = \(\) => \{ try \{ oc\.reset\(\); \}/, 'POV bisa dikembalikan ke posisi awal');
assert.match(esm, /data-orbit-reset=""[\s\S]{0,420}Reset kamera/, 'tombol Reset kamera dirender');
assert.match(esm, /if \(pivot && !interactive\) \{/, 'ayunan otomatis dimatikan saat POV dikendalikan pengguna');
assert.match(esm, /controls\?\.update\(\);\s*\n\s*renderer\.render\(scene, camera\);/, 'kontrol diperbarui tiap frame render');
assert.match(esm, /try \{ controls\?\.dispose\(\); \}/, 'kontrol dilepas saat unmount');
assert.match(esm, /const dist = \(target \* 2\.15\) \/ Math\.max\(zoom, 0\.2\);/, 'zoom > 1 mendekatkan kamera (model tampak lebih besar)');
assert.match(esm, /\$\{interactive \? 'pointer-events-auto' : 'pointer-events-none'\}/, 'panggung interaktif menerima pointer');
assert.match(esm, /c\.addEventListener\('change', \(\) => \{ if \(!disposed\) r\.render\(scene, cam\); \}\);/, 'prefers-reduced-motion: tanpa animasi otomatis tapi kamera tetap bisa digeser');

const otp = read('src/pages/OrderOtpPage.tsx');
assert.match(otp, /const OTP_SCENE_MODEL_URL = 'https:\/\/zcxtbtleeeaeqeryiwea\.supabase\.co\/storage\/v1\/object\/public\/video\/scene\.glb';/, 'URL scene.glb dari Supabase Storage public');
assert.match(otp, /modelUrl=\{OTP_SCENE_MODEL_URL\}/, 'panggung 3D memakai scene.glb');
/* Tanpa card: section scene tidak boleh punya border/background/rounded/padding card. */
const sceneBlock = otp.slice(otp.indexOf('aria-label="Scene 3D animasi"') - 200, otp.indexOf('aria-label="Scene 3D animasi"') + 400);
assert.match(sceneBlock, /<section className="mt-6 mb-12" aria-label="Scene 3D animasi">/, 'section scene polos (hanya jarak, tanpa card)');
assert.ok(!/rounded-\[18px\]|border|background: COLOR\.surface/.test(sceneBlock), 'scene tidak lagi dibungkus card (tanpa border/background/rounded)');
assert.ok(sceneBlock.indexOf('mb-12') > -1, 'jarak longgar sebelum Footer dijaga (mb-12)');
/* Model diperbesar + kamera bisa digeser. */
assert.match(sceneBlock, /height=\{360\}/, 'panggung diperbesar (360px, sebelumnya 240px)');
assert.match(sceneBlock, /zoom=\{1\.7\}/, 'kamera didekatkan sehingga model tampak lebih besar');
assert.match(sceneBlock, /interactive/, 'kamera POV bisa digeser/diputar + zoom');
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

console.log('PASS Papan Penilaian (username tersensor 3 huruf + 1 layanan 1 penilaian) & Order OTP (scene.glb 3D tanpa card, model lebih besar, kamera POV bisa digeser/di-zoom + Reset kamera, berjarak sebelum Footer).');
process.exit(0);
