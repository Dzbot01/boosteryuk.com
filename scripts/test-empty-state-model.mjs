// Uji empty state 3D (model GLB Supabase) + posisi dua menu riwayat:
//  • EmptyStateModel memuat boy.glb dari Supabase Storage lewat dynamic import three.js,
//    dan bila WebGL/model gagal (mis. jsdom tanpa WebGL) jatuh ke ikon cadangan + teks yang sama;
//  • teks empty state dipakai di Riwayat Deposit, Riwayat Pesanan, dan Riwayat Nomor (Order OTP);
//  • menu "Riwayat Pesanan" digeser berdekatan dengan "Riwayat Deposit".
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-empty-state-model.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const read = (f) => readFileSync(f, 'utf8');

/* ---------- 1. Komponen: URL model, dynamic import, fallback ---------- */
const model = read('src/components/EmptyStateModel.tsx');
assert.match(model, /https:\/\/zcxtbtleeeaeqeryiwea\.supabase\.co\/storage\/v1\/object\/public\/video\/boy\.glb/, 'model GLB diambil dari Supabase Storage public/video');
assert.match(model, /await import\('three'\)/, 'three.js di-import dinamis (tidak membebani bundle halaman)');
assert.match(model, /await import\('three\/addons\/loaders\/GLTFLoader\.js'\)/, 'GLTFLoader dipakai untuk memuat .glb');
assert.match(model, /setState\('failed'\)/, 'gagal memuat → fallback ikon');
assert.match(model, /prefers-reduced-motion/, 'menghormati prefers-reduced-motion');
assert.match(model, /gltf\.animations/, 'animasi bawaan GLB diputar bila ada');
assert.match(model, /IntersectionObserver/, 'render dijeda saat elemen di luar viewport');

/* ---------- 2. Dipakai di tiga tempat riwayat dengan teks yang diminta ---------- */
const deposit = read('src/pages/DepositHistoryPage.tsx');
assert.match(deposit, /import EmptyStateModel from '\.\.\/components\/EmptyStateModel'/, 'Riwayat Deposit memakai model 3D');
assert.match(deposit, /rows\.length === 0 && <tr><td colSpan=\{9\}[^>]*><EmptyStateModel text="Belum ada riwayat deposit"/, 'teks empty state deposit');

const riwayat = read('src/pages/RiwayatPage.tsx');
assert.match(riwayat, /import EmptyStateModel from '\.\.\/components\/EmptyStateModel'/, 'Riwayat Pesanan memakai model 3D');
assert.match(riwayat, /orders\.length === 0 \? \(\s*\/\* Riwayat benar-benar kosong/, 'model hanya saat riwayat benar-benar kosong (bukan hasil filter)');
assert.match(riwayat, /text="Belum ada riwayat pesanan"/, 'teks empty state pesanan');
assert.match(riwayat, /Tidak ada yang cocok/, 'kasus filter tanpa hasil tetap pakai ikon pencarian');

const otp = read('src/pages/OrderOtpPage.tsx');
assert.match(otp, /import EmptyStateModel from '\.\.\/components\/EmptyStateModel'/, 'Riwayat Nomor memakai model 3D');
assert.match(otp, /\{!riwayat\.length \? \(\s*\/\* Riwayat nomor kosong/, 'model tampil saat riwayat nomor kosong');
assert.match(otp, /text="Belum ada riwayat Nomor"/, 'teks empty state nomor');

/* ---------- 3. Menu: Riwayat Pesanan berdekatan dengan Riwayat Deposit ---------- */
const menu = read('src/components/SideMenu.tsx');
assert.match(menu, /const grouped = \(\(\) => \{/, 'menu dikelompokkan ulang sebelum difilter');
assert.match(menu, /out\.splice\(out\.findIndex\(\(item\) => item\.id === 'riwayat-deposit'\) \+ 1, 0, pesanan\)/, 'Riwayat Pesanan disisipkan tepat setelah Riwayat Deposit');
assert.match(menu, /: grouped\n       \.filter\(/, 'filter memakai urutan hasil pengelompokan');

/* ---------- 4. Render di jsdom: teks selalu tampil, WebGL gagal → ikon cadangan ---------- */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
let observed = 0;
globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() { observed++; } disconnect() {} unobserve() {} };
const dir = mkdtempSync(path.join(tmpdir(), 'empty-state-'));
let root = null;
try {
  const { outputFiles } = await build({
    stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {default as Empty} from './src/components/EmptyStateModel';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
    loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
  const { createElement: h, act, createRoot, Empty } = require(file);
  globalThis.fetch = async () => new Response('not-a-glb', { status: 500 });

  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(Empty, { text: 'Belum ada riwayat deposit', sub: 'Isi penjelasan', fallbackIcon: undefined })));
  // Beri waktu dynamic import three + percobaan WebGL selesai (di jsdom pasti gagal → fallback).
  await act(async () => { await new Promise((r) => setTimeout(r, 400)); });

  const box = document.querySelector('[role="status"]');
  assert.ok(box, 'wadah empty state dirender');
  assert.equal(box.getAttribute('aria-label'), 'Belum ada riwayat deposit', 'label aksesibilitas = teks utama');
  assert.ok(box.textContent.includes('Belum ada riwayat deposit'), 'teks utama tampil');
  assert.ok(box.textContent.includes('Isi penjelasan'), 'penjelasan tambahan tampil');
  assert.equal(box.querySelectorAll('canvas').length, 0, 'tanpa WebGL: canvas dilepas, tidak dibiarkan kosong');
  assert.ok(box.querySelector('span svg'), 'ikon cadangan tampil menggantikan model 3D');

  await act(async () => root.unmount()); root = null;
  console.log('PASS Empty state 3D: model boy.glb dari Supabase Storage dipakai di Riwayat Deposit/Pesanan/Nomor (dynamic import three + fallback ikon), dan menu Riwayat Pesanan digeser berdekatan dengan Riwayat Deposit.');
} finally {
  if (root) { const { act } = require(path.join(dir, 'bundle.cjs')); await act(async () => root.unmount()); }
  dom.window.close(); rmSync(dir, { recursive: true, force: true });
}
process.exit(0);
