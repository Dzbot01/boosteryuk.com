// Order OTP di ROOT DOMAIN + pendapatan OTP di My Profit:
//  • menu "Order Nomor" tampil di root domain (bukan hanya child panel), halaman & UI sama;
//  • admin_data.php menghitung margin OTP (base_price − max_usd × kurs, order selesai & tidak
//    di-refund) dan mengirimnya sebagai income.otp; markup child panel tetap milik pemilik panel;
//  • kartu Penghasilan di My Profit menampilkan baris Order OTP dan totalnya ikut menjumlah.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-otp-root-profit.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const parser = new (require('php-parser'))({ parser: { php7: true } });
const read = (p) => fs.readFileSync(p, 'utf8');

/* ---------- 1. Backend: margin OTP masuk penghasilan ---------- */
const ad = read('php-api/admin_data.php');
parser.parseCode(ad, 'admin_data.php');
assert.match(ad, /if \(ad_cols\(\$conn, 'otp_orders'\)\) \{/, 'tabel otp_orders dicek dulu sebelum dihitung');
assert.match(ad, /\$otpCfg = is_file\(__DIR__ \. '\/otp_config\.php'\) \? \(include __DIR__ \. '\/otp_config\.php'\) : \[\];/, 'kurs dibaca dari konfigurasi OTP yang sama dengan otp.php');
assert.match(ad, /\$kurs = \(float\)\(is_array\(\$otpCfg\) && isset\(\$otpCfg\['kurs'\]\) \? \$otpCfg\['kurs'\] : 17000\);/, 'fallback kurs sama dengan default otp.php');
assert.match(ad, /FROM otp_orders WHERE status = 'selesai' AND refunded = 0/, 'hanya order selesai yang tidak di-refund');
assert.match(ad, /\$mk = max\(0\.0, \(float\)\$r\['base_price'\] - \(float\)\$r\['max_usd'\] \* \$kurs\);/, 'margin = harga web utama − biaya provider (maks USD × kurs)');
assert.match(ad, /Markup child panel \(price − base_price\) milik/, 'markup panel tidak diklaim web utama');
assert.match(ad, /'agent_ai' => \$agent, 'upgrade' => \$upg, 'otp' => \$otp,/, 'income.otp dikirim ke frontend');
assert.match(ad, /'month' => \$smm\['month'\] \+ \$agent\['month'\] \+ \$upg\['month'\] \+ \$otp\['month'\],/, 'total bulan ini menjumlah OTP');
assert.match(ad, /'all' => \$smm\['all'\] \+ \$agent\['all'\] \+ \$upg\['all'\] \+ \$otp\['all'\]/, 'total semua menjumlah OTP');
assert.match(ad, /Penghasilan = markup SMM \+ sewa Agen AI \+ paket Upgrade \+ margin Order OTP\./, 'komentar model penghasilan diperbarui');

/* ---------- 2. Frontend: tipe + kartu My Profit ---------- */
const api = read('src/services/adminDataApi.ts');
assert.match(api, /otp: Period & \{ orders: number \};/, 'ProfitData.income.otp bertipe Period + orders');
const profit = read('src/pages/admin/AdminProfitPage.tsx');
assert.match(profit, /const otpInc = inc\?\.otp \?\? \{ today: 0, month: 0, all: 0, orders: 0 \};/, 'fallback bila server lama belum mengirim otp');
assert.match(profit, /sub="SMM \(markup\) \+ Agen AI \+ Upgrade \+ Order OTP bulan ini"/, 'keterangan kartu Penghasilan menyebut OTP');
assert.match(profit, /<Row k="· dari Order OTP \(bulan ini\)" v=\{rupiah\(otpInc\.month\)\} \/>/, 'baris kontribusi OTP bulan ini');
assert.match(profit, /<Row k="Order OTP \(total\)" v=\{`\$\{otpInc\.orders\} order selesai · \$\{rupiah\(otpInc\.all\)\}`\} \/>/, 'baris total order OTP');
assert.match(profit, /margin Order OTP \(base_price − biaya/, 'dokumen komponen penghasilan diperbarui');
assert.match(profit, /paket Upgrade, dan Order OTP — transaksi/, 'deskripsi halaman menyebut OTP');

/* ---------- 3. Menu + route tersedia di root domain ---------- */
const side = read('src/components/SideMenu.tsx');
assert.match(side, /const base = \[baseMenu\[0\], baseMenu\[1\], baseMenu\[2\], \{ id: 'nokos' as PageId, icon: Smartphone, label: 'Order Nomor', desc: 'Nomor OTP WhatsApp, Telegram, dll' \}, \.\.\.baseMenu\.slice\(3\)\];/, 'menu Order Nomor disusun tanpa syarat child panel');
assert.ok(!/const base = child/.test(side), 'penyusunan menu tidak lagi bercabang child/root untuk Order Nomor');
assert.match(side, /Menu "Order Nomor" \(OTP\) tampil di ROOT DOMAIN maupun child panel/, 'alasan perubahan dicatat');
const app = read('src/App.tsx');
const routeLine = app.split('\n').find((l) => l.includes('path="otp-service"') && l.includes('OrderOtpPage'));
assert.ok(routeLine && !routeLine.trimStart().startsWith('//') && !routeLine.includes('*/'), 'route /otp-service aktif (bukan komentar)');
const otpPage = read('src/pages/OrderOtpPage.tsx');
assert.ok(!otpPage.includes('IS_CHILD_PANEL'), 'halaman OTP tidak mengunci diri ke child panel (UI sama di root)');

/* ---------- 4. Perilaku menu (bundle SideMenu, panggil getUserMenuItems) ---------- */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.localStorage = dom.window.localStorage;
const dir = mkdtempSync(path.join(tmpdir(), 'otp-root-')); let root = null;
try {
  const { outputFiles } = await build({
    stdin: { contents: `export { getUserMenuItems } from './src/components/SideMenu';export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {default as Profit} from './src/pages/admin/AdminProfitPage';export {MemoryRouter} from 'react-router-dom';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl', '.mp3': 'dataurl', '.webp': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"', __MUSIC_URL__: '"/boosteryuk-official-music.mp3"' },
    plugins: [{ name: 'mocks', setup(b) {
      b.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'mock' }));
      b.onResolve({ filter: /components\/Seo$/ }, () => ({ path: 'seo', namespace: 'mock' }));
      b.onResolve({ filter: /context\/MusicContext$/ }, () => ({ path: 'music', namespace: 'mock' }));
      b.onResolve({ filter: /components\/UserAvatar$/ }, () => ({ path: 'avatar', namespace: 'mock' }));
      b.onResolve({ filter: /components\/AdminDataDot$/ }, () => ({ path: 'dot', namespace: 'mock' }));
      b.onResolve({ filter: /context\/AdminNotificationsContext$/ }, () => ({ path: 'notif', namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => ({ contents:
        a.path === 'seo' ? 'export default function Seo(){return null;}'
        : a.path === 'music' ? 'const music={play:()=>{},toggle:()=>{},playing:false,blocked:false};export const useMusic=()=>music;'
        : a.path === 'avatar' ? 'export default function UserAvatar(){return null;}'
        : a.path === 'dot' ? 'export default function AdminDataDot(){return null;}'
        : a.path === 'notif' ? 'export const useAdminNotifications=()=>({items:[],unread:0,refresh:()=>{}});'
        : 'export const useAuth=()=>globalThis.__auth;', resolveDir: process.cwd() }));
    } }],
  });
  const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
  const mod = require(file);
  const { getUserMenuItems, createElement: h, act, createRoot, Profit, MemoryRouter } = mod;

  const ids = (arr) => arr.map((i) => i.id);
  const rootIn = getUserMenuItems(true, false, false);   // root domain, user login
  const childIn = getUserMenuItems(true, false, true);   // child panel, user login
  const rootOut = getUserMenuItems(false, false, false); // root, belum login
  const nokosRoot = rootIn.find((i) => i.id === 'nokos');
  const nokosChild = childIn.find((i) => i.id === 'nokos');
  assert.ok(nokosRoot, 'menu Order Nomor tampil di root domain untuk user login');
  assert.equal(nokosRoot.label, 'Order Nomor', 'label sama dengan child panel');
  assert.equal(nokosRoot.desc, 'Nomor OTP WhatsApp, Telegram, dll');
  assert.ok(nokosChild, 'menu Order Nomor tetap tampil di child panel');
  // Dua menu riwayat berdekatan (Riwayat Deposit → Riwayat Pesanan), Order Nomor mengikuti setelahnya.
  assert.equal(ids(rootIn).indexOf('riwayat'), ids(rootIn).indexOf('riwayat-deposit') + 1, 'Riwayat Pesanan tepat setelah Riwayat Deposit');
  assert.equal(ids(rootIn).indexOf('nokos'), ids(rootIn).indexOf('riwayat') + 1, 'Order Nomor setelah grup riwayat (menu payment disembunyikan untuk user)');
  assert.equal(ids(childIn).indexOf('riwayat'), ids(childIn).indexOf('riwayat-deposit') + 1, 'child panel: dua menu riwayat juga berdekatan');
  assert.ok(!ids(rootOut).includes('riwayat-deposit'), 'belum login: Riwayat Deposit tetap tersembunyi');
  assert.ok(!rootOut.some((i) => i.id === 'nokos'), 'belum login: menu disembunyikan (halaman memang butuh login)');
  assert.ok(!childIn.some((i) => i.id === 'plus'), 'child panel tetap tanpa menu Upgrade');

  /* ---------- 5. Kartu Penghasilan merender angka OTP ---------- */
  globalThis.__auth = { user: { id: 1, role: 'admin' }, refresh: async () => {} };
  globalThis.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body?.action === 'profit') return new Response(JSON.stringify({ ok: true,
      income: {
        recorded: { today: 0, month: 0, all: 0, orders: 0, cost: 0 },
        estimated: { today: 0, month: 0, all: 0, orders: 0 },
        smm: { today: 0, month: 100000, all: 500000, orders: 10 },
        agent_ai: { today: 0, month: 0, all: 0, orders: 0 },
        upgrade: { today: 0, month: 0, all: 0, orders: 0 },
        otp: { today: 5000, month: 12000, all: 30000, orders: 4 },
        today: 5000, month: 112000, all: 530000,
      },
      transactions: { smm: { n: 10, omzet: 600000 }, lain: { n: 4, omzet: 40000 }, today: { n: 1, omzet: 5000 }, month: { n: 14, omzet: 640000 }, batal: 0 },
      deposits: { today: 0, month: 0, all: 0, count_month: 0, source: null },
      users: { total: 3, balance: 100000 }, server_time: '2026-11-25 10:00:00' }));
    return new Response(JSON.stringify({ ok: false, message: 'tidak dipakai' }));
  };
  globalThis.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, { initialEntries: ['/admin/profit'] }, h(Profit))));
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  const txt = document.getElementById('root').textContent.replace(/\u00a0/g, ''); // Intl id-ID memakai NBSP setelah "Rp"
  assert.ok(txt.includes('· dari Order OTP (bulan ini)'), 'baris kontribusi OTP tampil');
  assert.ok(txt.includes('Rp12.000'), 'angka bulan ini OTP tampil (Rp12.000)');
  assert.ok(txt.includes('Order OTP (total)'), 'baris total OTP tampil');
  assert.ok(txt.includes('4 order selesai · Rp30.000'), 'total = 4 order · Rp30.000');
  assert.ok(txt.includes('Rp112.000'), 'nilai kartu Penghasilan = SMM + OTP (100.000 + 12.000)');
  assert.ok(txt.includes('SMM (markup) + Agen AI + Upgrade + Order OTP bulan ini'), 'keterangan kartu diperbarui');
  await act(async () => root.unmount()); root = null;

  console.log('PASS Order OTP root domain: menu "Order Nomor" tampil di root & child panel (route /otp-service aktif, UI sama), dan margin OTP (base_price − max_usd × kurs, order selesai) tercatat di kartu Penghasilan My Profit sebagai income.otp.');
} finally {
  if (root) { const { act } = require(path.join(dir, 'bundle.cjs')); await act(async () => root.unmount()); }
  dom.window.close(); rmSync(dir, { recursive: true, force: true });
}
// Beberapa handle (jsdom/React) bisa menahan event loop setelah sukses — akhiri eksplisit.
process.exit(0);
