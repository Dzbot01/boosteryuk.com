// Model 3D karakter "merangkul" pojok KIRI ATAS card image slider (semua halaman yang punya slider):
//  • model kecil (90–130px desktop, 70–90px mobile) dan BERTENGGER di sudut card: sebagian besar
//    badannya di LUAR card sehingga isi image slider tidak tertutup;
//  • wrapper absolute (top/left negatif) + z-index di atas slider + pointer-events-none,
//    parent overflow visible, hanya card slider yang overflow-hidden;
//  • pose model (rotasi pitch/yaw/roll) + posisi di dalam panggung (align/offset) bisa disetel
//    lewat konstanta SLIDER_HUG agar tangan terlihat memeluk sudut card;
//  • rumus fit + penempatan (computeStageFit / computeStagePlacement) diuji numerik.
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

/* ---------- 1. Komponen SliderHugModel ---------- */
const hug = read('src/components/SliderHugModel.tsx');
assert.match(
  hug,
  /export const SLIDER_HUG_MODEL_URL =\s*\n?\s*'https:\/\/zcxtbtleeeaeqeryiwea\.supabase\.co\/storage\/v1\/object\/public\/video\/scene%20\(1\)\.glb';/,
  'GLB scene (1).glb dari Supabase Storage public (spasi di-encode %20)',
);
assert.match(hug, /export const SLIDER_HUG = \{/, 'semua nilai fine-tuning dikumpulkan di satu konstanta SLIDER_HUG');
assert.match(hug, /data-slider-hug=""/, 'overlay punya penanda untuk inspeksi/test');
assert.match(hug, /className=\{`pointer-events-none absolute select-none \$\{className\}`\}/, 'absolute + pointer-events-none (slider tetap bisa diklik/di-drag)');
assert.match(hug, /style=\{\{ top, left, width: w, height: h, zIndex: c\.zIndex \}\}/, 'posisi & ukuran dari config (top/left/width/height/z-index)');
assert.match(hug, /aria-hidden="true"/, 'overlay dekoratif disembunyikan dari screen reader');
assert.match(hug, /const \[narrow, setNarrow\] = useState\(false\);/, 'ada cabang layar sempit (mobile)');
assert.match(hug, /window\.innerWidth \|\| 1024\) < 640/, 'mobile = lebar < 640px');
assert.match(hug, /window\.addEventListener\('resize', calc\)/, 'posisi/ukuran menyesuaikan saat resize');
assert.match(hug, /const w = narrow \? c\.mobileWidth : c\.width;/, 'ukuran model diperkecil di mobile');
assert.match(hug, /const top = narrow \? c\.mobileTop : c\.top;/, 'posisi digeser di mobile');
assert.match(hug, /modelUrl=\{SLIDER_HUG_MODEL_URL\}/, 'panggung memakai GLB tersebut');
assert.match(hug, /height=\{h\}/, 'tinggi panggung = width × ratio');
assert.match(hug, /fitBy="height"/, 'skala model mengacu tinggi model');
assert.match(hug, /fitAxes="both"/, 'model dijaga utuh (tidak terpotong panggung)');
assert.match(hug, /motion=\{false\}/, 'pose stabil (tidak diayun) supaya tangan tetap di sudut card');
assert.match(hug, /rotation=\{\[c\.pitchDeg, c\.yawDeg, c\.rollDeg\]\}/, 'rotasi pose (pitch/yaw/roll) dari config');
assert.match(hug, /align=\{\[c\.alignX, c\.alignY\]\}/, 'posisi model di dalam panggung dari config');
assert.match(hug, /offset=\{\[c\.offsetX, c\.offsetY\]\}/, 'geser halus dari config');
assert.match(hug, /className="!p-0"/, 'tanpa card/padding sendiri (transparan, menempel sudut)');

/* ---------- 2. Komponen panggung: pose + penempatan ---------- */
const esm = read('src/components/EmptyStateModel.tsx');
assert.match(esm, /rotation\?: \[number, number, number\];/, 'prop rotation (derajat) tersedia');
assert.match(esm, /align\?: \[number, number\];/, 'prop align tersedia');
assert.match(esm, /offset\?: \[number, number\];/, 'prop offset tersedia');
assert.match(esm, /export function computeStagePlacement\(opts: \{/, 'rumus penempatan diekspor (fungsi murni, bisa diuji tanpa WebGL)');
assert.match(esm, /group\.rotation\.set\(\(rx \* Math\.PI\) \/ 180, \(ry \* Math\.PI\) \/ 180, \(rz \* Math\.PI\) \/ 180\);/, 'rotasi pose diterapkan (derajat -> radian)');
assert.match(esm, /const pos = computeStagePlacement\(\{/, 'align/offset diterapkan lewat fungsi murni');
assert.match(esm, /group\.position\.set\(pos\.x, pos\.y, 0\);/, 'posisi model di dalam frame diterapkan');
assert.match(esm, /pivot\.rotation\.y = pose\.yaw \+ Math\.sin\(t \* 0\.35\) \* 0\.55;/, 'ayunan (bila motion) tidak menimpa pose');
assert.match(esm, /\}, \[modelUrl\]\);/, 'GLB tetap dimuat sekali per modelUrl (tidak re-fetch saat resize)');

/* ---------- 3. Dipakai di SEMUA halaman yang punya image slider ---------- */
const pages = ['src/pages/LayananPage.tsx', 'src/pages/OrderVpsPage.tsx', 'src/pages/SewaAgenAiPage.tsx'];
for (const f of pages) {
  const page = read(f);
  assert.match(page, /import SliderHugModel from '\.\.\/components\/SliderHugModel';/, `${f}: memakai SliderHugModel`);
  // Parent: relative + overflow visible (tidak ada kelas overflow), card: tetap overflow-hidden.
  const wrapIdx = page.indexOf('<div className="relative mx-auto w-full max-w-2xl">');
  const cardIdx = page.indexOf('className="relative aspect-[16/9] w-full overflow-hidden rounded-[22px] border');
  const hugIdx = page.indexOf('<SliderHugModel />');
  assert.ok(wrapIdx > -1, `${f}: slider dibungkus container position:relative`);
  assert.ok(cardIdx > wrapIdx, `${f}: card slider berada di dalam wrapper (dan tetap overflow-hidden di elemen dalamnya)`);
  assert.ok(hugIdx > cardIdx, `${f}: model 3D adalah sibling SETELAH card (tidak di dalam card yang memotong)`);
  const wrapLine = page.slice(wrapIdx, wrapIdx + 60);
  assert.ok(!/overflow/.test(wrapLine), `${f}: wrapper parent overflow visible (tanpa kelas overflow)`);
  // Slider tidak diubah: track + dots tetap ada.
  assert.match(page, /transition-transform duration-500 ease-out/, `${f}: track slider tetap seperti semula`);
  assert.ok(page.indexOf('aria-label={`Slide ${i + 1}`}') > -1, `${f}: dots slider tetap ada`);
}

// Halaman Buat Pesanan tidak lagi menutupi slider dengan panggung setinggi card.
const layanan = read('src/pages/LayananPage.tsx');
assert.ok(!/sliderH|sliderRef|ResizeObserver/.test(layanan), 'pengukuran tinggi card (panggung sebesar card) sudah dihapus');
assert.ok(!/-translate-x-\[8%\]/.test(layanan), 'overlay besar penutup slider sudah dihapus');
assert.ok(!/height=\{sliderH\}/.test(layanan), 'tinggi panggung tidak lagi = tinggi card (model dikecilkan)');

/* ---------- 4. Numerik: config, fit kamera, dan penempatan ---------- */
const dir = mkdtempSync(path.join(tmpdir(), 'slider-hug-'));
const { outputFiles } = await build({
  stdin: { contents: `export {SLIDER_HUG, SLIDER_HUG_MODEL_URL} from './src/components/SliderHugModel';export {computeStageFit, computeStagePlacement} from './src/components/EmptyStateModel';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}', '__MUSIC_URL__': '""' },
});
const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
const { SLIDER_HUG: C, computeStageFit, computeStagePlacement } = require(file);

/* 4a. Ukuran & posisi sesuai spesifikasi (90–130px desktop, 70–90px mobile, di luar card). */
assert.ok(C.width >= 90 && C.width <= 130, `lebar model desktop 90–130px (dapat ${C.width})`);
assert.ok(C.mobileWidth >= 70 && C.mobileWidth <= 90, `lebar model mobile 70–90px (dapat ${C.mobileWidth})`);
assert.ok(C.top < 0 && C.left < 0, 'top & left negatif => model di luar/atas tepi card');
assert.ok(C.mobileLeft >= -16, 'left mobile tidak lebih negatif dari padding halaman (16px) => tanpa scroll horizontal');
assert.ok(C.zIndex >= 10, 'z-index di atas slider');
const dH = Math.round(C.width * C.ratio);
const mH = Math.round(C.mobileWidth * C.ratio);
assert.ok(dH + C.top > 0 && dH + C.top <= dH * 0.45, `hanya sebagian kecil model masuk ke card (desktop ${dH + C.top}px dari ${dH}px)`);
assert.ok(mH + C.mobileTop > 0 && mH + C.mobileTop <= mH * 0.45, `hanya sebagian kecil model masuk ke card (mobile ${mH + C.mobileTop}px dari ${mH}px)`);

/* 4b. Area model yang menimpa card < 8% luas card => isi slider tetap terlihat jelas. */
const overlapPct = (stageW, stageH, top, left, cardW, cardH) =>
  ((stageW + left) * (stageH + top)) / (cardW * cardH) * 100;
const desktopPct = overlapPct(C.width, dH, C.top, C.left, 672, Math.round(672 * 7 / 21)); // max-w-2xl, aspect 21/7
const mobilePct = overlapPct(C.mobileWidth, mH, C.mobileTop, C.mobileLeft, 328, Math.round(328 * 9 / 16)); // 360px - padding 32, aspect 16/9
assert.ok(desktopPct < 8, `desktop: model hanya menimpa ${desktopPct.toFixed(1)}% area card (< 8%)`);
assert.ok(mobilePct < 8, `mobile: model hanya menimpa ${mobilePct.toFixed(1)}% area card (< 8%)`);

/* 4c. Fit kamera: model muat utuh di panggung kecil itu. */
const stage = { sizeX: 1.1, sizeY: 2, sizeZ: 0.7, aspect: C.width / dH, fitBy: 'height', fitAxes: 'both', fitMargin: C.fitMargin, zoom: C.zoom };
const fit = computeStageFit(stage);
assert.ok(Math.abs(fit.modelH - 2.2) < 1e-9, 'tinggi model = targetSize (acuan fitBy height)');
assert.ok(fit.visibleH >= fit.modelH * C.fitMargin - 1e-9, 'model + ruang gerak muat vertikal (tidak terpotong atas/bawah)');
assert.ok(fit.visibleH * stage.aspect >= Math.hypot(stage.sizeX, stage.sizeZ) * fit.scale * C.fitMargin - 1e-9, 'model muat horizontal (tidak terpotong kiri/kanan)');
assert.ok(fit.modelH / fit.visibleH >= 0.85, `model mengisi panggung (${((fit.modelH / fit.visibleH) * 100).toFixed(1)}%)`);

/* 4d. Penempatan: align menempel tepi frame, offset menggeser halus, dan tidak keluar frame. */
const vis = { visibleH: fit.visibleH, modelH: fit.modelH, modelW: stage.sizeX * fit.scale, stageW: C.width, stageH: dH };
const mid = computeStagePlacement({ ...vis, align: [0, 0], offset: [0, 0] });
assert.ok(Math.abs(mid.x) < 1e-12 && Math.abs(mid.y) < 1e-12, 'align 0,0 = model di tengah frame');
const bottom = computeStagePlacement({ ...vis, align: [0, 1], offset: [0, 0] });
assert.ok(Math.abs(bottom.y + (fit.visibleH - fit.modelH) / 2) < 1e-9, 'alignY 1 = model menempel tepi bawah frame (kaki di tepi atas card)');
const top = computeStagePlacement({ ...vis, align: [0, -1], offset: [0, 0] });
assert.ok(Math.abs(top.y - (fit.visibleH - fit.modelH) / 2) < 1e-9, 'alignY -1 = model menempel tepi atas frame');
const right = computeStagePlacement({ ...vis, align: [1, 0], offset: [0, 0] });
const visibleW = fit.visibleH * (C.width / dH);
assert.ok(Math.abs(right.x - (visibleW - vis.modelW) / 2) < 1e-9, 'alignX 1 = model menempel tepi kanan frame');
// align default config: model di dalam frame (tidak keluar panggung)
for (const a of [[C.alignX, C.alignY], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]]) {
  const pl = computeStagePlacement({ ...vis, align: a, offset: [0, 0] });
  assert.ok(Math.abs(pl.y) + fit.modelH / 2 <= fit.visibleH / 2 + 1e-9, `align ${a} tetap di dalam frame (vertikal)`);
  assert.ok(Math.abs(pl.x) + vis.modelW / 2 <= visibleW / 2 + 1e-9, `align ${a} tetap di dalam frame (horizontal)`);
}
// offset = fraksi ukuran panggung dalam satuan dunia
const off = computeStagePlacement({ ...vis, align: [0, 0], offset: [0.1, 0.25] });
const worldPerPx = fit.visibleH / dH;
assert.ok(Math.abs(off.x - 0.1 * C.width * worldPerPx) < 1e-9, 'offsetX = fraksi lebar panggung');
assert.ok(Math.abs(off.y + 0.25 * dH * worldPerPx) < 1e-9, 'offsetY positif = ke bawah');

console.log(`PASS Model 3D merangkul pojok kiri atas card slider: kecil & bertengger di sudut (desktop ${C.width}px, top ${C.top}, left ${C.left}; mobile ${C.mobileWidth}px, top ${C.mobileTop}, left ${C.mobileLeft}), hanya menimpa ${desktopPct.toFixed(1)}% (desktop) / ${mobilePct.toFixed(1)}% (mobile) area card, pointer-events-none + parent overflow visible, dipakai di Layanan/VPS/SewaAgenAI, pose & posisi dapat disetel lewat SLIDER_HUG (computeStageFit + computeStagePlacement teruji numerik).`);
process.exit(0);
