// Papan Penilaian: username disensor (3 huruf depan + bintang) & 1 layanan = 1 penilaian.
// Order OTP: panggung 3D scene.glb (+animasi) ukuran sedang di bawah card Riwayat Nomor,
// berjarak longgar sebelum Footer.
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
assert.match(esm, /\}, \[height, modelUrl\]\);/, 'effect memuat ulang bila modelUrl berubah');

const otp = read('src/pages/OrderOtpPage.tsx');
assert.match(otp, /const OTP_SCENE_MODEL_URL = 'https:\/\/zcxtbtleeeaeqeryiwea\.supabase\.co\/storage\/v1\/object\/public\/video\/scene\.glb';/, 'URL scene.glb dari Supabase Storage public');
assert.match(otp, /modelUrl=\{OTP_SCENE_MODEL_URL\}/, 'panggung 3D memakai scene.glb');
assert.match(otp, /height=\{240\}/, 'ukuran panggung sedang (240px)');
assert.match(otp, /className="mt-6 mb-10 rounded-\[18px\] border p-3 sm:p-4"/, 'card scene berjarak longgar (mt-6 & mb-10 sebelum Footer)');
assert.match(otp, /aria-label="Scene 3D animasi"/, 'section scene punya label aksesibilitas');
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

console.log('PASS Papan Penilaian (username tersensor 3 huruf + 1 layanan 1 penilaian) & Order OTP (scene.glb 3D+animasi ukuran sedang di bawah Riwayat Nomor, berjarak sebelum Footer).');
process.exit(0);
