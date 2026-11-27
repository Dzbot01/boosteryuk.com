// Papan Penilaian: username disensor (3 huruf depan + bintang) & 1 layanan = 1 penilaian.
// Order OTP: panggung 3D scene.glb di bawah Riwayat Nomor — TANPA card, TANPA fungsi geser
// kamera POV (panggung pasif), dan LEBIH TINGGI + kamera auto-fit (fitMargin) supaya model
// yang sedang beranimasi tidak terpotong/tertutup card di atas maupun Footer di bawahnya.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-board-otp-scene.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
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
/* Kamera di-fit otomatis agar model beranimasi tidak terpotong frame. */
assert.match(esm, /fitMargin\?: number;/, 'prop fitMargin (ruang gerak animasi) tersedia');
assert.match(esm, /export function computeStageFit\(opts: \{/, 'rumus fit kamera diekspor sebagai fungsi murni (bisa diuji tanpa WebGL)');
assert.match(esm, /const visH = 2 \* Math\.tan\(\(\(fov \* Math\.PI\) \/ 180\) \/ 2\);/, 'tinggi frame dihitung dari FOV kamera');
assert.match(esm, /const minDistV = needV \/ visH;\s*\n\s*const minDistH = opts\.fitAxes === 'vertical' \? 0 : needH \/ \(visH \* aspect\);/, 'fit vertikal DAN horizontal (wadah sempit/tinggi di HP ikut dijaga)');
assert.match(esm, /const dist = Math\.max\(want, minDistV, minDistH\);/, 'kamera dijauhkan bila model akan terpotong, sedekat `zoom` bila masih muat');
assert.match(esm, /const needV = modelH \* margin;/, 'ruang gerak animasi dihitung dari fitMargin');
assert.match(esm, /const layout = \(\) => \{/, 'layout() menerapkan ulang ukuran panggung + kamera');
assert.match(esm, /const ro = new ResizeObserver\(layout\);/, 'layout dipanggil ulang setiap resize (aspect berubah) tanpa memuat ulang GLB');
assert.match(esm, /\}, \[modelUrl\]\);/, 'GLB dimuat sekali per modelUrl (resize/re-fetch tidak terjadi)');
assert.match(esm, /layoutRef\.current\?\.\(\);\s*\n\s*\}, \[stageH, zoom, targetSize, fitMargin, fitBy, fitAxes, motion\]\);/, 'perubahan tinggi/zoom hanya menata ulang, tidak re-fetch model');
/* Tinggi panggung responsif: lebih tinggi, dan punya tinggi khusus layar sempit. */
assert.match(esm, /mobileHeight\?: number;/, 'prop mobileHeight tersedia');
assert.match(esm, /setStageH\(mobileHeight && w < 640 \? mobileHeight : height\);/, 'tinggi panggung menyesuaikan lebar layar (< 640px)');
assert.match(esm, /style=\{\{ height: stageH, opacity: state === 'ready' \? 1 : 0\.001 \}\}/, 'tinggi host mengikuti tinggi panggung efektif');
assert.match(esm, /if \(pivot && cfgRef\.current\.motion\) \{\s*\n\s*pivot\.rotation\.y = Math\.sin\(t \* 0\.35\) \* 0\.55;/, 'ayunan animasi panggung aktif (bisa dimatikan lewat prop motion)');

const otp = read('src/pages/OrderOtpPage.tsx');
/* Scene Order OTP memakai aset GLB LOKAL repo, bukan URL Supabase. */
assert.match(otp, /const OTP_SCENE_MODEL_URL = '\/models\/scene\.glb\?v=1';/, 'scene.glb dimuat dari aset lokal /models/scene.glb');
assert.ok(!/supabase\.co/.test(otp), 'OrderOtpPage tidak lagi memuat apa pun dari Supabase Storage');
assert.ok(existsSync('public/models/scene.glb'), 'public/models/scene.glb ada di repo (ikut tersalin ke dist/)');
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

/* ---------- 3. Aset GLB lokal: biner valid, self-contained, dan punya animasi ---------- */
const glbPath = 'public/models/scene.glb';
const glb = readFileSync(glbPath);
assert.equal(glb.toString('ascii', 0, 4), 'glTF', 'magic bytes GLB valid');
assert.equal(glb.readUInt32LE(4), 2, 'GLB versi 2 (glTF 2.0)');
assert.equal(glb.readUInt32LE(8), glb.length, 'panjang yang dideklarasikan header = ukuran file sebenarnya');
const jsonLen = glb.readUInt32LE(12);
assert.equal(glb.toString('ascii', 16, 20), 'JSON', 'chunk pertama GLB = JSON');
const gltf = JSON.parse(glb.toString('utf8', 20, 20 + jsonLen));
assert.ok((gltf.scenes || []).length >= 1 && (gltf.nodes || []).length >= 1 && (gltf.meshes || []).length >= 1, 'GLB punya scene, node, dan mesh');
const clips = (gltf.animations || []).filter((a) => (a.channels || []).length > 0);
assert.ok(clips.length >= 1, `GLB punya clip animasi ber-channel (model bergerak sendiri): ${clips.length} clip`);
assert.ok(!(gltf.buffers || []).some((b) => b.uri), 'buffer menyatu di dalam GLB (tanpa .bin eksternal)');
assert.ok(!(gltf.images || []).some((i) => i.uri), 'tekstur menyatu di dalam GLB (tanpa file gambar eksternal)');
assert.ok(!(gltf.extensionsRequired || []).length, `tanpa extension wajib yang butuh decoder tambahan (${(gltf.extensionsRequired || []).join(',') || '-'})`);
assert.ok(glb.length > 1_000_000, `ukuran aset GLB wajar (${(glb.length / 1e6).toFixed(1)} MB)`);

console.log(`PASS Papan Penilaian (username tersensor 3 huruf + 1 layanan 1 penilaian) & Order OTP (scene 3D dari aset LOKAL public/models/scene.glb ${(glb.length / 1e6).toFixed(1)} MB, ${clips.length} clip animasi, tanpa card, tanpa geser POV kamera, panggung 560/460px + kamera auto-fit fitMargin 1.45, berjarak sebelum Footer).`);
process.exit(0);
