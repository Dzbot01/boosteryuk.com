// Fitur "Hubungkan TikTok" (DEMO) di halaman profil:
//  • kartu ajakan dengan ikon TikTok + tombol "Hubungkan TikTok";
//  • klik => simulasi verifikasi (TANPA redirect sungguhan ke tiktok.com) => hasil
//    sukses username "Demo" tersimpan di localStorage;
//  • kartu analitik profil (followers, likes, following, video, bio, id akun, dll.);
//  • kartu grafik analisis perkembangan (chart.js, fallback SVG tanpa canvas) + chip rentang 7/14/30 hari;
//  • "Putuskan" mengembalikan ke kartu ajakan dan menghapus status demo.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-tiktok-connect.mjs
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

const read = (f) => readFileSync(f, 'utf8');

/* ---------- 1. Statis: komponen terpasang di halaman profil & tanpa redirect asli ---------- */
const comp = read('src/components/TikTokAnalytics.tsx');
const profil = read('src/pages/ProfilPage.tsx');
assert.match(profil, /import TikTokAnalytics from '\.\.\/components\/TikTokAnalytics';/, 'ProfilPage mengimpor komponen TikTok');
assert.match(profil, /<TikTokAnalytics \/>/, 'ProfilPage merender seksi TikTok');
assert.match(comp, /export const TIKTOK_DEMO_USERNAME = 'Demo';/, 'username demo = Demo');
assert.match(comp, /by-tiktok-demo-connected/, 'status demo persisten di localStorage');
assert.match(comp, /from 'chart\.js\/auto'/, 'grafik memakai chart.js');
assert.match(comp, /tiktok-fallback-chart/, 'fallback SVG untuk lingkungan tanpa canvas');
assert.match(comp, /function TikTokGlyph/, 'ikon TikTok SVG inline');
assert.ok(!comp.includes('www.tiktok.com'), 'DEMO: tidak ada URL otorisasi tiktok.com');
assert.ok(!comp.includes('window.open(') && !comp.includes('location.href ='), 'DEMO: tidak ada redirect/navigasi keluar');
assert.match(comp, /Memverifikasi akun TikTok…/, 'status menunggu verifikasi');
assert.match(comp, /Analisis perkembangan akun/, 'kartu grafik analisis perkembangan');
for (const t of ['Followers', 'Likes', 'Following', 'Video', 'ID akun', 'Region', 'Bergabung', 'Terhubung', 'Putuskan']) {
  assert.ok(comp.includes(t), `kartu analitik memuat "${t}"`);
}

/* ---------- 2. jsdom: alur demo hubungkan -> analitik -> grafik -> putuskan ---------- */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com/profil' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} unobserve() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };

const dir = mkdtempSync(path.join(tmpdir(), 'tiktok-connect-'));
let root = null;
try {
  const { outputFiles } = await build({
    stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {default as TikTokAnalytics} from './src/components/TikTokAnalytics';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
    loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
  });
  const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
  const { createElement: h, act, createRoot, TikTokAnalytics } = require(file);
  const txt = () => document.getElementById('root').textContent;
  const btn = (label) => [...document.querySelectorAll('#root button')].find((b) => b.textContent.includes(label));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(TikTokAnalytics, {})));
  assert.ok(txt().includes('Hubungkan TikTok'), 'kartu ajakan tampil saat belum terhubung');
  assert.ok(btn('Hubungkan TikTok'), 'tombol Hubungkan TikTok ada');

  /* klik => simulasi verifikasi (demo, tanpa redirect) => sukses username Demo */
  await act(async () => btn('Hubungkan TikTok').click());
  assert.ok(txt().includes('Memverifikasi akun TikTok…'), 'status memverifikasi tampil sesaat');
  await act(async () => { await sleep(1700); });
  const t1 = txt();
  assert.ok(t1.includes('@Demo'), 'hasil sukses memakai username TikTok Demo');
  assert.ok(t1.includes('Terhubung'), 'badge terhubung tampil');
  for (const t of ['Followers', 'Likes', 'Following', 'Video', 'ID akun', 'Region', 'Bergabung', 'Disukai (favorit)', 'Status akun', 'Terhubung sejak']) {
    assert.ok(t1.includes(t), `kartu analitik memuat "${t}" setelah terhubung`);
  }
  assert.ok(t1.includes('Analisis perkembangan akun'), 'kartu grafik perkembangan tampil di bawahnya');
  assert.ok(document.querySelector('#root canvas') || document.querySelector('#root svg.tiktok-fallback-chart'), 'grafik dirender (canvas chart.js atau fallback SVG)');
  const saved = JSON.parse(dom.window.localStorage.getItem('by-tiktok-demo-connected'));
  assert.equal(saved.username, 'Demo', 'status demo tersimpan dengan username Demo');

  /* chip rentang grafik 7/14/30 hari */
  await act(async () => btn('7H').click());
  assert.ok(txt().includes('7 hari terakhir'), 'rentang grafik bisa diganti ke 7 hari');
  await act(async () => btn('30H').click());
  assert.ok(txt().includes('30 hari terakhir'), 'rentang grafik bisa diganti ke 30 hari');

  /* persistensi: mount ulang tetap terhubung (demo bertahan saat refresh) */
  await act(async () => root.unmount()); root = null;
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(TikTokAnalytics, {})));
  assert.ok(txt().includes('@Demo'), 'mount ulang langsung menampilkan akun terhubung (persisten)');

  /* putuskan => kembali ke kartu ajakan & penyimpanan dibersihkan */
  await act(async () => btn('Putuskan').click());
  assert.ok(btn('Hubungkan TikTok'), 'setelah diputuskan kartu ajakan kembali');
  assert.equal(dom.window.localStorage.getItem('by-tiktok-demo-connected'), null, 'status demo dihapus saat diputuskan');

  await act(async () => root.unmount()); root = null;
  console.log('PASS Hubungkan TikTok (demo): kartu ajakan berikon TikTok, klik => verifikasi simulasi => analitik profil @Demo + grafik perkembangan (chart.js/fallback SVG) + rentang 7/14/30H, persisten via localStorage, dan Putuskan membersihkan status.');
} finally {
  if (root) { const { act } = require(path.join(dir, 'bundle.cjs')); await act(async () => root.unmount()); }
  delete globalThis.window; delete globalThis.document;
}
process.exit(0);
