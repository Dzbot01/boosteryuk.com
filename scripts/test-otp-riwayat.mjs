// Uji perilaku halaman Order Nomor OTP (child panel):
//  • kartu penjelasan shadow ban pindah ke ATAS (sebelum card order), tertutup default,
//    dibuka lewat tombol di sisi kanan card;
//  • riwayat nomor (sukses & batal) dipisah jadi card tabel sendiri di bawah card order,
//    maksimal 10 baris; card order hanya menampilkan nomor yang masih aktif.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-otp-riwayat.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);const { JSDOM } = require('jsdom');
const dom = new JSDOM('<button id="origin">Open</button><div id="root"></div>', { url: 'https://tokoku.boosteryuk.com' });
globalThis.window = dom.window;globalThis.document = dom.window.document;globalThis.localStorage = dom.window.localStorage;
localStorage.setItem('token', 'session');globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.MessageChannel = class { port1 = { onmessage: null };port2 = { postMessage: () => setImmediate(() => this.port1.onmessage?.()) }; };
globalThis.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe(el) { this.cb([{ isIntersecting: true, target: el }], this); } disconnect() {} unobserve() {} };
const dir = mkdtempSync(path.join(tmpdir(), 'otp-riwayat-'));let root;
try {
 const { outputFiles } = await build({
  stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter} from 'react-router-dom';export {default as Otp} from './src/pages/OrderOtpPage';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl', '.mp3': 'dataurl', '.webp': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', __MUSIC_URL__: '"/boosteryuk-official-music.mp3"' },
  plugins: [{ name: 'test-mocks', setup(build) {
   build.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'mock' }));
   build.onResolve({ filter: /components\/Seo$/ }, () => ({ path: 'seo', namespace: 'mock' }));
   build.onResolve({ filter: /context\/MusicContext$/ }, () => ({ path: 'music', namespace: 'mock' }));
   build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'seo' ? 'export default function Seo(){return null;}' : args.path === 'music' ? 'const music={play:()=>{},toggle:()=>{},playing:false,blocked:false};export const useMusic=()=>music;' : 'export const useAuth=()=>globalThis.__auth;', resolveDir: process.cwd() }));
  } }],
 });
 const file = path.join(dir, 'bundle.cjs');writeFileSync(file, outputFiles[0].text);
 const { createElement: h, act, createRoot, MemoryRouter, Otp } = require(file);
 globalThis.__auth = { user: { id: 7, balance: 50000 }, refresh: async () => {} };

 const order = (i, status, over = {}) => ({ order_id: `OTP-${i}`, service: 'WhatsApp', country: 'Indonesia', price: 5000 + i,
  phone: `628120000${i}`, code: status === 'selesai' ? `1000${i}` : null, status, refunded: status === 'batal',
  note: status === 'batal' ? 'Dibatalkan user' : null, seconds_left: status === 'menunggu' ? 600 : null,
  created_at: `2026-11-${String((i % 28) + 1).padStart(2, '0')} 10:0${i % 6}:00`, ...over });
 // 1 aktif + 13 sudah berakhir → tabel riwayat harus memotong jadi 10 baris.
 let orders = [order(1, 'menunggu'), ...Array.from({ length: 8 }, (_, k) => order(k + 2, 'selesai')), ...Array.from({ length: 5 }, (_, k) => order(k + 10, 'batal'))];
 let listCalls = 0;
 globalThis.fetch = async (url, options) => {
  const body = options?.body ? JSON.parse(options.body) : null;
  if (typeof url === 'string' && url.includes('action=services')) return new Response(JSON.stringify({ ok: true, services: [{ code: 'whatsapp', name: 'WhatsApp' }, { code: 'telegram', name: 'Telegram' }] }));
  if (typeof url === 'string' && url.includes('action=countries')) return new Response(JSON.stringify({ ok: true, countries: [{ id: 'id', name: 'Indonesia' }] }));
  if (typeof url === 'string' && url.includes('action=prices')) return new Response(JSON.stringify({ ok: true, tiers: [{ harga: 5000, stok: 12 }] }));
  if (body?.action === 'list') { listCalls++;return new Response(JSON.stringify({ ok: true, orders })); }
  if (body?.action === 'status') return new Response(JSON.stringify({ ok: true, order: orders.find((o) => o.order_id === body.order_id) || null }));
  return new Response(JSON.stringify({ ok: true }));
 };

 const mount = async () => { document.getElementById('origin').focus();root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, { initialEntries: ['/order-otp'] }, h(Otp)))); };
 const unmount = async () => { await act(async () => root.unmount());root = null; };
 const button = (text) => [...document.querySelectorAll('#root button')].find((b) => b.textContent.includes(text));
 const shadowSection = () => document.querySelector('[aria-label="Keterangan penting dan penjelasan shadow ban"]');
 const riwayatSection = () => document.querySelector('[aria-label="Riwayat nomor OTP"]');
 const orderCard = () => [...document.querySelectorAll('#root h2')].find((h) => h.textContent === 'Buat Pesanan Nomor')?.closest('div.rounded-\\[18px\\]') || document.getElementById('otp-aktif')?.parentElement?.parentElement;
 const rows = () => [...riwayatSection().querySelectorAll('tbody tr')];

 await mount();
 assert.ok(listCalls >= 1, 'riwayat dimuat dari otp.php action=list');

 /* ---- 1. Posisi: shadow ban di atas card order, riwayat di bawahnya ---- */
 assert.ok(shadowSection(), 'card penjelasan shadow ban ada');
 assert.ok(riwayatSection(), 'card riwayat nomor ada');
 const posShadow = shadowSection().compareDocumentPosition(orderCard());
 assert.ok(posShadow & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'card shadow ban berada SEBELUM card order');
 const posRiwayat = orderCard().compareDocumentPosition(riwayatSection());
 assert.ok(posRiwayat & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'card riwayat berada SETELAH card order');
 assert.ok(!orderCard().contains(riwayatSection()), 'riwayat tidak lagi di dalam card order');
 assert.ok(!orderCard().contains(shadowSection()), 'penjelasan shadow ban tidak lagi di dalam card order');

 /* ---- 2. Shadow ban tertutup default, tombol di sisi kanan card ---- */
 const toggle = button('Buka penjelasan');
 assert.ok(toggle, 'tombol buka penjelasan ada');
 assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'tertutup secara default');
 assert.equal(toggle.getAttribute('aria-controls'), 'otp-shadowban-body');
 const body = document.getElementById('otp-shadowban-body');
 assert.ok(body, 'isi penjelasan ada di DOM');
 assert.ok(body.classList.contains('hidden'), 'isi penjelasan disembunyikan saat tertutup');
 // tombol berada di sisi kanan: satu baris flex dengan judul, setelah judul
 const header = shadowSection().querySelector('div.flex.items-center.justify-between');
 assert.ok(header, 'header card: judul kiri, tombol kanan');
 assert.ok(header.contains(toggle) && header.textContent.includes('Apa itu Shadow Ban?'), 'judul + tombol dalam satu baris');
 assert.ok(header.querySelector('h3').compareDocumentPosition(toggle) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'tombol setelah judul (kanan)');
 await act(async () => toggle.click());
 assert.equal(toggle.getAttribute('aria-expanded'), 'true', 'terbuka setelah diklik');
 assert.ok(!document.getElementById('otp-shadowban-body').classList.contains('hidden'), 'isi penjelasan tampil');
 assert.ok(button('Tutup penjelasan'), 'label tombol berubah jadi tutup');
 assert.ok(document.body.textContent.includes('Shadow ban adalah mekanisme'), 'isi penjelasan tetap utuh');
 assert.equal(document.querySelectorAll('[aria-label="Keterangan penting dan penjelasan shadow ban"]').length, 1, 'penjelasan shadow ban hanya satu');
 await act(async () => button('Tutup penjelasan').click());
 assert.ok(document.getElementById('otp-shadowban-body').classList.contains('hidden'), 'bisa ditutup lagi');

 /* ---- 3. Card order hanya nomor aktif; riwayat = tabel maks 10 baris (sukses + batal) ---- */
 const cardText = orderCard().textContent;
 assert.ok(cardText.includes('Menunggu kode'), 'nomor aktif tetap tampil di card order');
 assert.ok(cardText.includes('Batalkan'), 'tombol batal untuk nomor aktif');
 assert.ok(!cardText.includes('Dibatalkan'), 'riwayat batal tidak lagi menumpuk di card order');
 assert.equal(rows().length, 10, 'maksimal 10 baris riwayat');
 const statuses = rows().map((r) => r.textContent);
 assert.ok(statuses.some((t) => t.includes('Selesai')), 'riwayat sukses ditampilkan');
 assert.ok(statuses.some((t) => t.includes('Dibatalkan')), 'riwayat batal ditampilkan');
 assert.ok(!statuses.some((t) => t.includes('Menunggu kode')), 'nomor aktif tidak masuk tabel riwayat');
 assert.ok(!statuses.some((t) => /#OTP-1(?!\d)/.test(t)), 'order aktif (OTP-1) tidak ikut di tabel riwayat');
 const heads = [...riwayatSection().querySelectorAll('thead th')].map((th) => th.textContent);
 assert.deepEqual(heads, ['Waktu', 'Layanan', 'Negara', 'Nomor', 'Kode OTP', 'Harga', 'Status'], 'kolom tabel riwayat');
 assert.ok(riwayatSection().textContent.includes('10 dari 10 terbaru'), 'keterangan jumlah baris');
 assert.ok(rows()[0].querySelector('button[aria-label^="Salin nomor"]'), 'nomor bisa disalin dari tabel');
 assert.ok(rows()[0].querySelector('button[aria-label^="Salin kode OTP"]'), 'kode OTP bisa disalin dari tabel');
 assert.ok(rows().some((r) => r.textContent.includes('saldo dikembalikan')), 'keterangan refund untuk pesanan batal');
 await unmount();

 /* ---- 4. Tanpa riwayat: keterangan kosong di kedua tempat ---- */
 orders = [];
 await mount();
 assert.ok(riwayatSection().textContent.includes('Belum ada riwayat Nomor'), 'keterangan riwayat kosong');
 assert.ok(riwayatSection().querySelector('[aria-label="Riwayat nomor kosong"]'), 'empty state riwayat nomor = model 3D + teks');
 assert.equal(riwayatSection().querySelectorAll('table').length, 0, 'tidak ada tabel saat riwayat kosong');
 assert.ok(orderCard().textContent.includes('Belum ada nomor aktif'), 'keterangan nomor aktif kosong');
 assert.equal(rows().length, 0, 'tidak ada baris tabel');
 await unmount();

 console.log('PASS Order OTP (perilaku): card shadow ban di atas & tertutup default dengan tombol kanan, card order hanya nomor aktif, riwayat sukses+batal jadi tabel terpisah di bawah dengan maks 10 baris, nomor/kode tetap bisa disalin.');
} finally { if (root) { const { act } = require(path.join(dir, 'bundle.cjs'));await act(async () => root.unmount()); }dom.window.close();rmSync(dir, { recursive: true, force: true }); }
