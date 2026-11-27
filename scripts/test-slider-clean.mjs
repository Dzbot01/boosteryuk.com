// Image slider bersih: model 3D karakter di pojok card slider DIHAPUS total.
//  • komponen SliderHugModel + semua referensinya tidak ada lagi;
//  • ketiga halaman yang punya slider (Layanan/Buat Pesanan, Order VPS, Sewa Agen AI) kembali
//    ke markup card slider semula (tanpa wrapper tambahan, tanpa overlay 3D);
//  • EmptyStateModel tidak lagi membawa prop pose (rotation/align/offset) khusus model slider,
//    tetapi panggung 3D scene Order OTP tetap utuh (tidak ikut terhapus);
//  • rumus fit kamera (computeStageFit) tetap teruji numerik.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-slider-clean.mjs
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

const read = (f) => readFileSync(f, 'utf8');

/* ---------- 1. Komponen model 3D slider dihapus ---------- */
assert.ok(!existsSync('src/components/SliderHugModel.tsx'), 'SliderHugModel.tsx dihapus');
assert.ok(!existsSync('scripts/test-slider-hug-model.mjs'), 'test khusus model slider lama dihapus');

// Tidak ada satu pun sumber yang masih menyebut model 3D slider.
const sumber = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) sumber.push(p);
  }
};
walk('src');
const leftover = sumber.filter((f) => /SliderHugModel|SLIDER_HUG|data-slider-hug|scene%20\(1\)/.test(read(f)));
assert.deepEqual(leftover, [], `tidak ada sisa referensi model 3D slider (ketemu di: ${leftover.join(', ') || '-'})`);

/* ---------- 2. Ketiga halaman slider kembali ke markup semula ---------- */
const CARD = 'className="relative mx-auto aspect-[16/9] w-full max-w-2xl overflow-hidden rounded-[22px] border border-slate-200 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.5)] dark:border-slate-700/60 sm:aspect-[21/8] lg:!aspect-[21/7]"';
const pages = ['src/pages/LayananPage.tsx', 'src/pages/OrderVpsPage.tsx', 'src/pages/SewaAgenAiPage.tsx'];
for (const f of pages) {
  const page = read(f);
  assert.ok(page.includes(CARD), `${f}: card slider kembali ke markup asli (relative mx-auto max-w-2xl overflow-hidden)`);
  assert.ok(!page.includes('<div className="relative mx-auto w-full max-w-2xl">'), `${f}: wrapper tambahan untuk overlay 3D dihapus`);
  assert.ok(!/EmptyStateModel/.test(page), `${f}: tidak lagi memakai panggung 3D`);
  assert.match(page, /transition-transform duration-500 ease-out/, `${f}: track slider tetap ada`);
  assert.ok(page.indexOf('translateX(-') > -1, `${f}: geser slide tetap ada`);
  assert.ok(page.indexOf('aria-label={`Slide ${i + 1}`}') > -1, `${f}: dots slider tetap ada`);
  assert.match(page, /window\.setInterval\(/, `${f}: auto-advance slider tetap ada`);
}

/* ---------- 3. EmptyStateModel: prop pose slider dihapus, fitur panggung lain tetap ---------- */
const esm = read('src/components/EmptyStateModel.tsx');
assert.ok(!/rotation\?:|align\?:|offset\?:|computeStagePlacement/.test(esm), 'prop pose (rotation/align/offset) + computeStagePlacement dihapus');
assert.match(esm, /export function computeStageFit\(opts: \{/, 'rumus fit kamera tetap ada');
assert.match(esm, /\}, \[modelUrl\]\);/, 'GLB tetap dimuat sekali per modelUrl');
assert.match(esm, /const ro = new ResizeObserver\(layout\);/, 'resize tetap menata ulang tanpa re-fetch');
assert.match(esm, /pivot\.rotation\.y = Math\.sin\(t \* 0\.35\) \* 0\.55;/, 'ayunan panggung tetap ada');
assert.match(esm, /mobileHeight\?: number;/, 'prop mobileHeight tetap ada');
assert.match(esm, /fitMargin\?: number;/, 'prop fitMargin tetap ada');
assert.ok(!/OrbitControls|interactive/.test(esm), 'tetap tanpa kontrol geser POV kamera');

/* ---------- 4. Panggung 3D Order OTP TIDAK ikut terhapus ---------- */
const otp = read('src/pages/OrderOtpPage.tsx');
assert.match(otp, /const OTP_SCENE_MODEL_URL = '\/models\/scene\.glb\?v=2';/, 'scene.glb Order OTP tetap ada (aset lokal /models/scene.glb)');
assert.match(otp, /aria-label="Scene 3D animasi"/, 'section scene 3D Order OTP tetap ada');
assert.match(otp, /height=\{560\}/, 'ukuran panggung Order OTP tidak berubah');
assert.ok(!/scene%20\(1\)/.test(otp), 'Order OTP tidak memakai GLB model slider');

/* ---------- 5. Numerik: computeStageFit tetap menjaga model muat di frame ---------- */
const dir = mkdtempSync(path.join(tmpdir(), 'slider-clean-'));
const { outputFiles } = await build({
  stdin: { contents: `export {computeStageFit} from './src/components/EmptyStateModel';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}', '__MUSIC_URL__': '""' },
});
const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
const { computeStageFit } = require(file);

const otpFit = computeStageFit({ sizeX: 3, sizeY: 1.4, sizeZ: 2, aspect: 1100 / 560, fitMargin: 1.45, zoom: 1.35 });
assert.ok(otpFit.visibleH >= otpFit.modelH * 1.45 - 1e-9, 'scene Order OTP tetap muat vertikal + ruang gerak 45%');
assert.ok(otpFit.visibleH * (1100 / 560) >= Math.hypot(3, 2) * otpFit.scale * 1.45 - 1e-9, 'scene Order OTP tetap muat horizontal');
const boy = computeStageFit({ sizeX: 0.9, sizeY: 1.8, sizeZ: 0.5, aspect: 280 / 220 });
assert.ok(Math.abs(boy.dist - 2.2 * 2.15) < 1e-9, 'jarak bawaan empty state riwayat tetap 2.2*2.15 (tampilan tidak berubah)');
assert.ok(boy.visibleH >= boy.modelH * 1.3 - 1e-9, 'empty state riwayat tetap punya ruang gerak 30%');

console.log('PASS Image slider bersih: model 3D karakter (SliderHugModel + scene (1).glb) dihapus dari Layanan/Buat Pesanan, Order VPS, dan Sewa Agen AI; markup slider kembali seperti semula (track/dots/auto-advance utuh), prop pose dihapus dari EmptyStateModel, scene 3D Order OTP tetap ada, computeStageFit teruji numerik.');
process.exit(0);
