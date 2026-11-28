// Chip wilayah/server di halaman detail top up: satu kartu produk per game, semua
// varian (jenis) dari pricelist live jadi chip — termasuk server luar & Promo yang
// dulu tampak sebagai "kode aneh" dan dibuang. Pricelist mengikuti chip terpilih.
// Data uji = bentuk ASLI respons php-api/tokovoucher.php?action=pricelist (item
// membawa jenis + wilayah_ok sejak skema __all_v3__).
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-topup-region-chips.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire('/home/user/boosteryuk.com/package.json');
const { JSDOM } = require('jsdom');

const detailSrc = fs.readFileSync('src/pages/TopupGameDetailPage.tsx', 'utf8');
assert.match(detailSrc, /role="tablist"/, 'chip wilayah dirender sebagai tablist');
assert.match(detailSrc, /daftarJenis\.map\(\(j\) =>/, 'chip diambil dari jenis pricelist live');
assert.match(detailSrc, /semuaWilayah: !!jenisAktif,\s*wilayah: jenisAktif\.replace/, 'pricelist di-scope ke chip aktif (label rapi)');
assert.match(detailSrc, /namaWilayahJenis\(j\)/, 'label chip memakai nama wilayah lengkap (tanpa singkatan)');

// Pricelist live Free Fire (kode & nama asli penyedia, dipangkas).
const ITEMS = [
  { kode: 'FF5', nama: '5 Diamond Free Fire', harga: 814, butuh_server: false, jenis: 'Free Fire  ID Fast', wilayah_ok: true },
  { kode: 'FF10', nama: '10 Diamond Free Fire', harga: 1628, butuh_server: false, jenis: 'Free Fire  ID Fast', wilayah_ok: true },
  { kode: 'MFF5', nama: 'Free Fire 5 Diamonds', harga: 734, butuh_server: false, jenis: 'Free Fire  ID Murah', wilayah_ok: true },
  { kode: 'MFF100', nama: 'Free Fire 100 Diamonds', harga: 11715, butuh_server: false, jenis: 'Free Fire  ID Murah', wilayah_ok: true },
  { kode: 'ZFF70', nama: 'Freefire Jalur Promo 70 Diamond', harga: 8010, butuh_server: false, jenis: 'Free Fire ID Promo', wilayah_ok: true },
  { kode: 'MFFLPR10', nama: '(PROMO) - Level 10', harga: 8488, butuh_server: false, jenis: 'Free Fire ID Promo', wilayah_ok: true },
  { kode: 'FF_SG_25', nama: '25 Diamonds (SG)', harga: 4414, butuh_server: false, jenis: 'Free Fire SG', wilayah_ok: false },
  { kode: 'FF_SG_100', nama: '100 Diamonds (SG)', harga: 19102, butuh_server: false, jenis: 'Free Fire SG', wilayah_ok: false },
  { kode: 'FFTH33', nama: '33 Diamond', harga: 5253, butuh_server: false, jenis: 'Free Fire TH', wilayah_ok: false },
  { kode: 'FFMYLT', nama: 'Weekly Lite', harga: 5912, butuh_server: false, jenis: 'Free Fire MY', wilayah_ok: false },
  { kode: 'FFBDSWM', nama: 'Weekly Membership', harga: 23934, butuh_server: false, jenis: 'Free Fire Membership', wilayah_ok: true },
];
const php = fs.readFileSync('php-api/tokovoucher.php', 'utf8');
assert.match(php, /'wilayah_ok' => \$wilayahOk/, 'pricelist mengirim flag wilayah per jenis');
assert.match(php, /if \(array_key_exists\('wilayah_ok', \$p\)\) return tv_label_wilayah_ok/, 'pricelist tidak lagi membuang varian luar');

const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com/topup/free-fire' });
const { outputFiles } = await build({
  stdin: {
    contents:
      "export {default as Page} from './src/pages/TopupGameDetailPage';" +
      "export {MemoryRouter,Routes,Route} from 'react-router-dom';" +
      "export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.mp3': 'dataurl', '.glb': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{
    name: 'mocks',
    setup(b) {
      b.onResolve({ filter: /(components\/Seo|context\/AuthContext|services\/tokovoucherApi|react-router-dom)$/ }, (a) => ({ path: a.path, namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => {
        if (a.path.endsWith('Seo')) return { contents: 'export default function Seo(){return null;}', resolveDir: process.cwd() };
        if (a.path.endsWith('AuthContext')) return { contents: 'export const useAuth=()=>({user:null});', resolveDir: process.cwd() };
        if (a.path.endsWith('tokovoucherApi')) {
          return {
            contents: `export const tvStatus=async()=>({ok:true,configured:true});
export const tvPricelist=async()=>({ok:true,source:'provider',game:'Free Fire',items:globalThis.__TV_ITEMS__,updated_at:'2026-11-27 20:38'});
export const tvCekAkun=async()=>({ok:false,alasan:'unsupported'});
export const tvTransaksi=async()=>({ok:false,message:'x'});
export const tvCekStatus=async()=>({ok:false,message:'x'});`,
            resolveDir: process.cwd(),
          };
        }
        return { contents: "export * from 'react-router-dom-real';export {MemoryRouter} from 'react-router-dom-real';", resolveDir: process.cwd() };
      });
      b.onResolve({ filter: /^react-router-dom-real$/ }, () => ({ path: require.resolve('react-router-dom') }));
    },
  }],
});
const ctx = {
  process, performance, queueMicrotask, setTimeout, clearTimeout,
  MessageChannel: class { port1 = { onmessage: null }; port2 = { postMessage: () => setImmediate(() => this.port1.onmessage?.()) } },
  module: { exports: {} }, exports: {}, console,
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
  __TV_ITEMS__: ITEMS,
  URL, URLSearchParams, TextEncoder, TextDecoder,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
  Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  fetch: async () => { throw new TypeError('Failed to fetch'); },
};
ctx.global = ctx;
vm.runInNewContext(outputFiles[0].text, ctx);
ctx.globalThis = ctx;
const { Page, createElement: h, act, createRoot } = ctx.module.exports;
const teks = () => dom.window.document.body.textContent || '';
const chips = () => [...dom.window.document.querySelectorAll('[role="tab"]')];
const produk = () => [...dom.window.document.querySelectorAll('code')]
  .map((c) => c.textContent.trim())
  .filter((t) => /^[A-Z0-9_]+$/.test(t) && t.length > 1 && t !== 'Rp');

const root = createRoot(dom.window.document.getElementById('root'));
try {
  await act(async () => root.render(
    h(ctx.module.exports.MemoryRouter, { initialEntries: ['/topup/free-fire'] },
      h(ctx.module.exports.Routes, null,
        h(ctx.module.exports.Route, { path: '/topup/:slug', element: h(Page) })))));
  // Chip tampil: semua varian (jenis) pricelist, ID dulu baru server luar/Promo.
  const labels = chips().map((c) => c.textContent.trim());
  assert.deepEqual(labels, [
    'Free Fire Indonesia Fast', 'Free Fire Indonesia Murah', 'Free Fire Indonesia Promo', 'Free Fire Singapura',
    'Free Fire Thailand', 'Free Fire Malaysia', 'Free Fire Membership',
  ], 'satu chip per jenis; singkatan wilayah diperjelas (ID→Indonesia, SG→Singapore, TH→Thailand, MY→Malaysia)');
  const aktif = chips().find((c) => c.getAttribute('aria-selected') === 'true');
  assert.match(aktif.className, /bg-white/, 'chip terpilih = pill putih berbingkai + bayangan (sesuai desain)');
  assert.match(aktif.className, /shadow-sm/, 'chip terpilih berbayang');
  assert.equal(chips().filter((c) => c.getAttribute('aria-selected') === 'true').length, 1, 'tepat satu chip aktif');
  // Chip ID default: pricelist hanya kanal ID Fast (kode FF…), tanpa SG/TH/MY/Promo.
  assert.deepEqual(produk(), ['FF5', 'FF10'], 'chip ID Fast: pricelist ikut pilihan (FF5, FF10)');
  assert.match(teks(), /Rp[\s\u00a0]?900/, 'harga Rupiah titik ribuan (814 → jual Rp 900, markup 0%)');
  assert.match(teks(), /Rp[\s\u00a0]?1\.700/, 'pembulatan ratusan: 1628 → Rp 1.700');

  const klik = async (label) => {
    const c = chips().find((x) => x.textContent.trim() === label);
    assert.ok(c, 'chip ' + label + ' ada');
    await act(async () => c.click());
  };
  await klik('Free Fire Singapura');
  assert.deepEqual(produk(), ['FF_SG_25', 'FF_SG_100'], 'chip SG: hanya produk server SG, nama asli penyedia');
  assert.match(teks(), /25 Diamonds \(SG\)/, 'nama produk SG tampil apa adanya');
  await klik('Free Fire Thailand');
  assert.deepEqual(produk(), ['FFTH33'], 'chip TH: hanya produk server TH');
  await klik('Free Fire Malaysia');
  assert.deepEqual(produk(), ['FFMYLT'], 'chip MY: hanya produk server MY');
  await klik('Free Fire Indonesia Promo');
  assert.deepEqual(produk(), ['ZFF70', 'MFFLPR10'], 'chip Promo: jalur promo tidak dibuang lagi (urut harga naik)');
  await klik('Free Fire Indonesia Murah');
  assert.deepEqual(produk(), ['MFF5', 'MFF100'], 'chip ID Murah: kanal resmi M');
  await klik('Free Fire Membership');
  assert.match(teks(), /Paket & Membership/, 'pass/membership jadi kartu kecil di atas list');
  assert.deepEqual(produk(), ['FFBDSWM'], 'chip Membership: produk membership tampil');
  await klik('Free Fire Indonesia Fast');
  assert.deepEqual(produk(), ['FF5', 'FF10'], 'kembali ke chip ID Fast: pricelist ikut lagi');
  assert.equal(dom.window.document.querySelectorAll('section').length > 2, true, 'satu halaman detail (satu produk/game) untuk semua wilayah');

  // Fase 2 — pricelist versi lama di hosting (item tanpa `jenis`): chip tidak muncul
  // dan daftar tetap ketat (hanya kode resmi M) sampai php-api/tokovoucher.php baru
  // diunggah. Tidak ada pricelist kosong / kode karangan.
  ctx.__TV_ITEMS__ = ITEMS.map(({ jenis, wilayah_ok, ...rest }) => rest);
  await act(async () => root.unmount());
  const root2 = createRoot(dom.window.document.getElementById('root'));
  await act(async () => root2.render(
    h(ctx.module.exports.MemoryRouter, { initialEntries: ['/topup/free-fire'] },
      h(ctx.module.exports.Routes, null,
        h(ctx.module.exports.Route, { path: '/topup/:slug', element: h(Page) })))));
  assert.equal(chips().length, 0, 'sumber tanpa jenis: chip wilayah tidak dirender');
  assert.deepEqual(produk(), ['MFF5', 'MFF100'], 'sumber tanpa jenis: tetap kode resmi, server luar dibuang');
  await act(async () => root2.unmount());
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}

console.log('PASS Chip wilayah/server TopUp: satu kartu produk per game, semua varian pricelist (ID Fast/ID Murah/Promo/SG/TH/MY/Membership) jadi chip, dan pricelist menyesuaikan chip yang dipilih — kode server luar tidak dibuang lagi.');
process.exit(0);
