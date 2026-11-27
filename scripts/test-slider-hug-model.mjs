// Model 3D "merangkul" pojok kiri atas card image slider di halaman Buat Pesanan (/layanan):
//  • GLB scene (1).glb dari Supabase Storage public dipakai sebagai overlay pojok kiri atas,
//    tanpa card sendiri, transparan, dan tidak menahan klik/scroll (pointer-events-none);
//  • tinggi panggung model = tinggi card slider (diukur dengan ResizeObserver, mengikuti
//    aspect ratio 16/9 → 21/8 → 21/7 di setiap lebar layar);
//  • model sedikit menumpuk sudut card (-8% / -6%) sehingga tampak merangkul, dan overlay
//    berada DI LUAR card ber-overflow-hidden agar tidak terpotong card;
//  • rumus fit kamera (computeStageFit) diuji numerik: model muat utuh (tidak terpotong)
//    dan tingginya ~= tinggi panggung/card.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-slider-hug-model.mjs
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

const read = (f) => readFileSync(f, 'utf8');

/* ---------- 1. Halaman Buat Pesanan (/layanan): overlay model di pojok kiri atas slider ---------- */
const page = read('src/pages/LayananPage.tsx');
assert.match(page, /import EmptyStateModel from '\.\.\/components\/EmptyStateModel';/, 'halaman memakai panggung 3D');
assert.match(
  page,
  /const SLIDER_HUG_MODEL_URL =\s*\n?\s*'https:\/\/zcxtbtleeeaeqeryiwea\.supabase\.co\/storage\/v1\/object\/public\/video\/scene%20\(1\)\.glb';/,
  'GLB scene (1).glb dari Supabase Storage public (spasi di-encode %20)',
);
assert.match(page, /modelUrl=\{SLIDER_HUG_MODEL_URL\}/, 'overlay memakai GLB tersebut');

/* Tinggi panggung = tinggi card slider, diukur live. */
assert.match(page, /const sliderRef = useRef<HTMLDivElement \| null>\(null\);/, 'ref ke card slider');
assert.match(page, /ref=\{sliderRef\}/, 'ref dipasang pada card slider');
assert.match(page, /new ResizeObserver\(measure\)/, 'tinggi card diukur ulang saat ukuran berubah (desktop & mobile)');
assert.match(page, /Math\.round\(el\.getBoundingClientRect\(\)\.height\)/, 'tinggi card dibaca dari tinggi render sebenarnya');
assert.match(page, /setSliderH\(\(prev\) => \(Math\.abs\(prev - h\) > 1 \? h : prev\)\)/, 'state tinggi hanya berubah bila benar-benar berbeda (anti re-render beruntun)');
assert.match(page, /height=\{sliderH\}/, 'tinggi panggung 3D = tinggi card slider');
assert.match(page, /style=\{\{ height: sliderH, width: sliderH \}\}/, 'kotak overlay setinggi (dan selebar) tinggi card slider');
assert.match(page, /\{sliderH > 0 && \(/, 'overlay baru dirender setelah tinggi card terukur');

/* Posisi: pojok kiri ATAS, menumpuk sudut card, tidak menahan interaksi, tidak terpotong card. */
assert.match(page, /className="pointer-events-none absolute left-0 top-0 z-20 -translate-x-\[8%\] -translate-y-\[6%\] select-none"/, 'overlay di pojok kiri atas, menumpuk sudut card, klik/scroll tetap tembus');
assert.match(page, /aria-hidden="true"/, 'overlay dekoratif disembunyikan dari screen reader');
assert.match(page, /<div className="relative mx-auto w-full max-w-2xl">/, 'wrapper polos tanpa overflow-hidden (model boleh menumpuk sudut card)');
assert.match(page, /className="relative aspect-\[16\/9\] w-full overflow-hidden rounded-\[22px\] border/, 'card slider tetap memotong imagenya sendiri (overflow-hidden)');
const cardIdx = page.indexOf('ref={sliderRef}');
const dotsIdx = page.indexOf('{/* dots */}');
const overlayIdx = page.indexOf('pointer-events-none absolute left-0 top-0 z-20');
const buatPesananIdx = page.indexOf('BUAT PESANAN CARD');
assert.ok(cardIdx > -1 && dotsIdx > cardIdx && overlayIdx > dotsIdx, 'overlay berada setelah card slider (sibling, bukan di dalamnya)');
assert.ok(overlayIdx < buatPesananIdx, 'overlay tetap di area slider, sebelum card Buat Pesanan');

/* Cara model diisi ke panggung: tinggi model ~= tinggi card, tetap utuh (tidak terpotong). */
assert.match(page, /fitBy="height"/, 'skala model mengacu pada TINGGI model (tingginya menyamai tinggi card)');
assert.match(page, /fitAxes="both"/, 'vertikal & horizontal dijaga muat sehingga model tidak terpotong panggung');
assert.match(page, /fitMargin=\{1\.05\}/, 'ruang gerak animasi 5% agar tidak menempel tepi');
assert.match(page, /zoom=\{1\.4\}/, 'kamera cukup dekat sehingga tinggi model ~= tinggi panggung/card');
assert.match(page, /motion=\{false\}/, 'ayunan otomatis dimatikan supaya pose model stabil merangkul sudut card');
assert.match(page, /stageClassName="max-w-none w-full"/, 'panggung mengisi lebar kotak overlay');
assert.match(page, /className="!p-0"/, 'tanpa padding/card tambahan di dalam panggung');

/* ---------- 2. Komponen: GLB sekali muat, layout dinamis, prop fit/motion ---------- */
const esm = read('src/components/EmptyStateModel.tsx');
assert.match(esm, /export function computeStageFit\(opts: \{/, 'rumus fit kamera diekspor (fungsi murni)');
assert.match(esm, /fitBy\?: FitBy;/, 'prop fitBy tersedia');
assert.match(esm, /fitAxes\?: FitAxes;/, 'prop fitAxes tersedia');
assert.match(esm, /motion\?: boolean;/, 'prop motion tersedia');
assert.match(esm, /\}, \[modelUrl\]\);/, 'GLB dimuat sekali per modelUrl');
assert.match(esm, /const ro = new ResizeObserver\(layout\);/, 'resize hanya menata ulang (tidak re-fetch GLB)');
assert.match(esm, /layoutRef\.current\?\.\(\);/, 'perubahan tinggi (hasil pengukuran) langsung ditata ulang');
assert.ok(!/OrbitControls|interactive/.test(esm), 'tetap tanpa kontrol geser POV kamera');

/* ---------- 3. Numerik: computeStageFit ---------- */
const dir = mkdtempSync(path.join(tmpdir(), 'slider-hug-'));
const { outputFiles } = await build({
  stdin: { contents: `export {computeStageFit} from './src/components/EmptyStateModel';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}', '__MUSIC_URL__': '""' },
});
const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
const { computeStageFit } = require(file);

// Kotak overlay = persegi setinggi card (aspect 1), model "merangkul" seperti karakter.
const hug = { sizeX: 1.1, sizeY: 2, sizeZ: 0.7, aspect: 1, fitBy: 'height', fitAxes: 'both', fitMargin: 1.05, zoom: 1.4 };
const f = computeStageFit(hug);
assert.ok(Math.abs(f.modelH - 2.2) < 1e-9, `fitBy 'height' => tinggi model = targetSize (2.2), dapat ${f.modelH}`);
assert.ok(f.visibleH >= f.modelH * 1.05 - 1e-9, 'model + ruang gerak 5% muat vertikal (tidak terpotong atas/bawah)');
const fill = f.modelH / f.visibleH;
assert.ok(fill >= 0.9 && fill <= 0.98, `tinggi model ~= tinggi panggung/card (isian ${(fill * 100).toFixed(1)}%)`);
const visibleW = f.visibleH * hug.aspect;
assert.ok(visibleW >= Math.hypot(hug.sizeX, hug.sizeZ) * f.scale * 1.05 - 1e-9, 'model muat horizontal (tidak terpotong kiri/kanan)');

// Model lebar: fitAxes 'both' menjauhkan kamera supaya utuh; 'vertical' lebih dekat (boleh melebar).
const wide = { sizeX: 4, sizeY: 1, sizeZ: 1, aspect: 1, fitBy: 'height', fitMargin: 1.05, zoom: 1.4 };
const wBoth = computeStageFit({ ...wide, fitAxes: 'both' });
const wVert = computeStageFit({ ...wide, fitAxes: 'vertical' });
assert.ok(wBoth.dist > wVert.dist, 'model lebar: fitAxes both menjauhkan kamera agar tidak terpotong');
assert.ok(wBoth.visibleH * wide.aspect >= Math.hypot(wide.sizeX, wide.sizeZ) * wBoth.scale * 1.05 - 1e-9, 'lebar model tetap muat pada fitAxes both');
assert.ok(Math.abs(wVert.modelH / wVert.visibleH - 1 / 1.05) < 1e-9, 'fitAxes vertical => tinggi model tepat mengisi panggung');

// Card slider di HP lebih pendek & aspek berbeda: fit vertikal tetap terjaga.
const phone = computeStageFit({ ...hug, aspect: 1, fitMargin: 1.05 });
assert.ok(phone.visibleH >= phone.modelH * 1.05 - 1e-9, 'tetap muat pada panggung persegi (kotak setinggi card)');

// Monoton: zoom lebih besar => lebih dekat; fitMargin lebih besar => lebih jauh.
assert.ok(computeStageFit({ ...hug, zoom: 2 }).dist <= f.dist, 'zoom lebih besar mendekatkan kamera');
assert.ok(computeStageFit({ ...hug, fitMargin: 1.45 }).dist > f.dist, 'fitMargin lebih besar menjauhkan kamera (ruang animasi)');

// Perilaku lama empty state (boy.glb: tinggi = dimensi terpanjang) tidak berubah.
const boy = computeStageFit({ sizeX: 0.9, sizeY: 1.8, sizeZ: 0.5, aspect: 280 / 220 });
assert.ok(Math.abs(boy.modelH - 2.2) < 1e-9, "fitBy default 'max': dimensi terpanjang = targetSize");
assert.ok(boy.visibleH >= boy.modelH * 1.3 - 1e-9, 'ruang gerak default 30% tetap dijaga');
assert.ok(Math.abs(boy.dist - (2.2 * 2.15)) < 1e-9, `jarak bawaan empty state tetap 2.2*2.15 (dapat ${boy.dist.toFixed(3)})`);

console.log('PASS Model 3D merangkul pojok kiri atas card image slider di halaman Buat Pesanan: scene (1).glb overlay transparan tanpa card, tinggi panggung = tinggi card slider (ResizeObserver), menumpuk sudut -8%/-6%, pointer-events-none, fitBy height + fitAxes both (tidak terpotong), dan computeStageFit teruji numerik.');
process.exit(0);
