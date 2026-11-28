// Layanan PPOB dari endpoint list produk penuh penyedia (/member/produk/full):
// hanya layanan SELAIN top up game yang dikirim ke halaman PPOB — tampil sebagai
// card "Menu", dan tile "Lainnya" membuka grid card semua layanan itu.
//
// Yang diuji:
//  1. filter PHP (tv_layanan_label / tv_is_layanan berbasis KATEGORI penyedia) —
//     pola aslinya dibaca dari php-api/tokovoucher.php lalu dijalankan terhadap
//     label penyedia sungguhan (game vs operator telekomunikasi/e-money);
//  2. aksi layanan & layanan_produk (cache, status aktif, diagnostik kategori);
//  3. render sungguhan halaman /ppob/layanan (grid card → halaman order per layanan)
//     + card Menu di /ppob (harga + markup PPOB panel, pencarian, galat jujur).
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-ppob-layanan.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire('/home/user/boosteryuk.com/package.json');
const { JSDOM } = require('jsdom');
const { build } = require('esbuild');
const read = (f) => fs.readFileSync(f, 'utf8');

/* ---------- 1. Filter PHP: layanan selain top up game ---------- */
const php = read('php-api/tokovoucher.php');
for (const fn of ['tv_layanan_label', 'tv_is_layanan', 'tv_layanan_from_full', 'tv_layanan_kelompok', 'tv_provider_layanan'])
  assert.ok(php.includes(`function ${fn}(`), `php-api/tokovoucher.php punya function ${fn}()`);
assert.match(php, /if \(\$action === 'layanan'\) \{/, 'aksi ?action=layanan terdaftar');
assert.match(php, /if \(\$action === 'layanan_produk'\) \{/, 'aksi ?action=layanan_produk terdaftar (daftar produk satu layanan)');
assert.match(php, /\$cache\['__layanan_v1__'\] = \['ts' => \$now, 'items' => \$items, 'sumber' => 'full', 'diag' => \$diag\];/, 'daftar layanan di-cache 6 jam di file cache yang sama');
assert.match(php, /\(\$now - \(int\)\$cache\['__layanan_v1__'\]\['ts'\]\) < 21600/, 'TTL cache layanan 6 jam');
assert.match(php, /if \(\(int\)\(\$p\['status'\] \?\? 1\) !== 1\) continue;\s*\n\s*\$kode = strtoupper/, 'hanya produk aktif yang jadi layanan');
assert.match(php, /if \(!\$op \|\| \(int\)\(\$op\['status'\] \?\? 1\) !== 1\) continue;/, 'operator non-aktif dibuang');
assert.match(php, /'kategori_penyedia' => \(array\)\(\$diag\['kategori'\] \?\? \[\]\)/, 'respons membawa diagnostik kategori asli penyedia');
assert.match(php, /'operator_penyedia' => \(array\)\(\$diag\['operator'\] \?\? \[\]\)/, 'respons membawa diagnostik operator asli penyedia');
// Game tidak boleh bocor ke grid top up game bila ternyata layanan (AIS/TrueMove/DTAC).
assert.match(php, /if \(tv_is_layanan\(\(string\)\$p\['game'\], \(string\)\(\$p\['jenis'\] \?\? ''\), \(string\)\(\$p\['kategori'\] \?\? ''\)\)\) continue;/, 'aksi katalog membuang layanan PPOB dari grid top up game (memakai kategori penyedia)');
assert.match(php, /'kategori' => \$cat,/, 'item katalog game membawa kategori penyedia supaya filternya jujur');
// Urutan keputusan: game dikenal ditolak dulu, baru kata kunci layanan.
const badanIsLayanan = php.slice(php.indexOf('function tv_is_layanan('), php.indexOf('function tv_layanan_from_full('));
assert.ok(badanIsLayanan.indexOf('tv_game_key_of_label') < badanIsLayanan.indexOf('tv_layanan_label'), 'game yang dikenal tabel alias ditolak sebelum cek kata kunci layanan');
assert.match(badanIsLayanan, /preg_match\('\/top[^\n]*up[^\n]*game\|[^\n]*games\?[^\n]*\/i'/, 'label/kategori yang menyebut "game" tidak dianggap layanan');
assert.match(badanIsLayanan, /return tv_layanan_label\(\$operatorNama\) \|\| tv_layanan_label\(\$jenisNama\);/, 'tanpa kategori: label tak dikenal tidak diklaim sebagai layanan (default false)');
// Kategori penyedia = penanda utama: "Topup Game"/"Voucher Game" ditolak, kategori lain diterima.
const badanKategori = badanIsLayanan.slice(0, badanIsLayanan.indexOf('// Tanpa kategori'));
assert.match(badanKategori, /if \(preg_match\('\/\\bgames\?\\b\/i', \$kat\)\) return false;/, 'kategori yang menyebut game (Topup Game / Voucher Game) BUKAN layanan PPOB');
assert.match(badanKategori, /return true;/, 'kategori non-game (Pulsa, Paket Data, PLN, E-Money, TV, dst) diterima sebagai layanan walau namanya tak dikenal tabel kata kunci');

// Jalankan pola aslinya (dibaca dari source PHP) terhadap label penyedia sungguhan.
const polaMatch = php.match(/function tv_layanan_label\(\$teks\) \{[\s\S]*?preg_match\('\/([\s\S]*?)\/', \$t\) === 1;/);
assert.ok(polaMatch, 'pola kata kunci layanan bisa dibaca dari source PHP');
// Source PHP memakai string kutip tunggal: '\\s' di file = \s di mesin regex.
const polaLayanan = new RegExp(polaMatch[1].replace(/\\\\/g, '\\').replace(/\\'/g, "'"), 'i');
const LAYANAN = ['AIS', 'TrueMove H', 'DTAC', 'DTAC DATA', 'DTAC Credit', 'Pulsa Telkomsel', 'Paket Data XL', 'OVO', 'GoPay', 'ShopeePay', 'PLN Token Listrik', 'Voucher Netflix', 'Google Play', 'Wifi Internet Rumah', 'BPJS Kesehatan', 'Tagihan Pascabayar'];
for (const l of LAYANAN) assert.ok(polaLayanan.test(l), `"${l}" terdeteksi sebagai layanan (bukan top up game)`);
// Label operator game ASLI dari katalog penyedia (probe ?action=katalog) — tidak boleh lolos.
const GAME = ['Free Fire & FFMAX', 'Mobile Legends', 'Farlight 84', 'Captain Tsubasa : Ace', 'Magic Chess: Go Go', 'Hago Diamond ID', 'Werewolf (Party Game)', 'Metal Slug: Awakening', 'Eggy Party', 'Crossfire Legends', 'Laplace M', 'Honor Of Kings', 'The Ants : Underground Kingdom', 'MU Origin 2', 'Football Master 2', 'Call Of Duty Mobile', 'Delta Force', 'Moonlight Blade M', 'Hatsune Miku Colorful Stage', 'Lokapala', 'EA Sports Fc Mobile', 'King Choice', 'Zepeto', 'Roblox via Login', 'Valorant ID', 'Ragnarok X: Next Generation', 'Wuthering Waves', 'Zenless Zone Zero', 'Tomb Busters', 'Sausage Man'];
for (const g of GAME) assert.ok(!polaLayanan.test(g), `game "${g}" tidak ikut ke daftar layanan PPOB`);

/* ---------- 2. Klien API ---------- */
const api = read('src/services/tokovoucherApi.ts');
assert.match(api, /export const tvLayanan = \(\) => get<TvLayanan>\('action=layanan&cb=' \+ Date\.now\(\)\.toString\(36\)\);/, 'tvLayanan memanggil ?action=layanan (cache-buster)');
assert.match(api, /action=layanan_produk&kelompok=/, 'tvLayananProduk memanggil ?action=layanan_produk per layanan');
assert.match(api, /export interface TvLayananKelompok \{/, 'tipe kelompok layanan diekspor');
assert.match(api, /layanan: string;/, 'nama layanan asli penyedia ada di tipe');
assert.match(api, /kategori: string;/, 'kategori penyedia ada di tipe');

/* ---------- 3. Render sungguhan halaman Semua Layanan + Menu Service ---------- */
const KELOMPOK = [
  { id: 'pulsa-ais', layanan: 'AIS', kategori: 'Pulsa', logo: '', jumlah: 6, termurah: 13353, termahal: 52000, labels: ['AIS Credit'] },
  { id: 'paket-data-truemove-h', layanan: 'TrueMove H', kategori: 'Paket Data', logo: 'https://cdn.aplikasikreasi.id/uploads/contoh/truemove.png', jumlah: 4, termurah: 15900, termahal: 99000, labels: ['TrueMove DATA'] },
  { id: 'pulsa-dtac', layanan: 'DTAC', kategori: 'Pulsa', logo: '', jumlah: 10, termurah: 8500, termahal: 45000, labels: ['DTAC Credit', 'DTAC DATA'] },
  { id: 'e-money-ovo', layanan: 'OVO', kategori: 'E-Money', logo: '', jumlah: 5, termurah: 20500, termahal: 200000, labels: ['OVO Cash'] },
];
const PRODUK_DTAC = [
  { kode: 'DTAC5', nama: 'DTAC 5 THB', harga: 4250, jenis: 'DTAC Credit' },
  { kode: 'DTAC10', nama: 'DTAC 10 THB', harga: 8500, jenis: 'DTAC Credit' },
  { kode: 'DTACDATA1', nama: 'DTAC DATA 1 GB', harga: 12900, jenis: 'DTAC DATA' },
];

const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com/ppob/layanan' });
const { outputFiles } = await build({
  stdin: {
    contents:
      "export {default as LayananPage} from './src/pages/PpobLayananPage';" +
      "export {default as OrderPage} from './src/pages/PpobLayananOrderPage';" +
      "export {default as PpobPage} from './src/pages/PpobPage';" +
      "export {MemoryRouter,Routes,Route} from 'react-router-dom';" +
      "export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.webp': 'dataurl', '.glb': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', __MUSIC_URL__: '""', 'import.meta.env': '{}' },
  plugins: [{
    name: 'mocks',
    setup(b) {
      b.onResolve({ filter: /(components\/Seo|context\/AuthContext|context\/SiteSettingsContext|services\/tokovoucherApi|react-router-dom)$/ }, (a) => ({ path: a.path, namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => {
        if (a.path.endsWith('Seo')) return { contents: 'export default function Seo(){return null;}', resolveDir: process.cwd() };
        if (a.path.endsWith('AuthContext')) return { contents: "export const useAuth=()=>({user:{id:7,name:'Melvi Husin',username:'melvi',balance:1250000},isAdmin:false,logout:()=>{},refresh:async()=>{}});", resolveDir: process.cwd() };
        if (a.path.endsWith('SiteSettingsContext')) return { contents: 'export const useSiteSettings=()=>({settings:{brandName:"Boosteryuk"},tenant:globalThis.__TENANT__});', resolveDir: process.cwd() };
        if (a.path.endsWith('tokovoucherApi')) {
          return {
            contents: `export const tvLayanan=async()=>globalThis.__LAYANAN__();
export const tvLayananProduk=async(id)=>globalThis.__LAYANAN_PRODUK__(id);
export const tvTransaksi=async(b)=>globalThis.__TRANSAKSI__(b);
export const tvCekStatus=async(ref)=>globalThis.__CEK_STATUS__(ref);
export const tvStatus=async()=>({ok:true,configured:true});
export const tvKatalog=async()=>({ok:true,source:'kosong',groups:[]});`,
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
  URL, URLSearchParams, TextEncoder, TextDecoder,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
  Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  fetch: async () => { throw new TypeError('Failed to fetch'); },
  __TENANT__: null,
  __LAYANAN__: async () => ({ ok: true, source: 'provider', sumber: 'full', total_produk: 25, kelompok: KELOMPOK, updated_at: '2026-11-28 12:00' }),
  __LAYANAN_PRODUK__: async (id) => (id === 'pulsa-dtac' ? { ok: true, kelompok: KELOMPOK[2], items: PRODUK_DTAC } : { ok: false, message: 'Layanan tidak ditemukan di katalog penyedia.' }),
  __PESANAN__: [],
  __TRANSAKSI__: async (b) => { ctx.__PESANAN__.push(b); return { ok: true, ref_id: 'PPOB-26112812000011', status: 'pending', jenis: 'ppob', harga: 8500, saldo: 1241500, message: 'Transaksi diterima penyedia.' }; },
  __CEK_STATUS__: async () => ({ ok: true, ref_id: 'PPOB-26112812000011', sumber: 'webhook', status: 'sukses', trx_id: 'TV991122', sn: '0123456789', message: 'Berhasil' }),
};
ctx.global = ctx;
vm.runInNewContext(outputFiles[0].text, ctx);
ctx.globalThis = ctx;
const { LayananPage, PpobPage, createElement: h, act, createRoot } = ctx.module.exports;

const teks = () => dom.window.document.body.textContent || '';
const kartu = () => [...dom.window.document.querySelectorAll('[data-layanan]')];

const rute = () =>
  h(ctx.module.exports.Routes, null,
    h(ctx.module.exports.Route, { path: '/ppob/layanan', element: h(LayananPage) }),
    h(ctx.module.exports.Route, { path: '/ppob/layanan/:id', element: h(ctx.module.exports.OrderPage) }),
    h(ctx.module.exports.Route, { path: '/ppob', element: h(PpobPage) }));

const root = createRoot(dom.window.document.getElementById('root'));
await act(async () => root.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob/layanan'] }, rute())));

assert.match(teks(), /Semua Layanan/, 'judul halaman Semua Layanan');
assert.match(teks(), /selain top up game/, 'keterangan: hanya layanan selain top up game');
assert.equal(kartu().length, 4, 'satu grid card per layanan dari endpoint');
assert.deepEqual(kartu().map((k) => k.getAttribute('data-layanan')).sort(), ['e-money-ovo', 'paket-data-truemove-h', 'pulsa-ais', 'pulsa-dtac'], 'id kelompok dipakai sebagai penanda kartu');
for (const nama of ['AIS', 'TrueMove H', 'DTAC', 'OVO']) assert.ok(teks().includes(nama), `layanan "${nama}" tampil sebagai card`);
for (const kat of ['Pulsa', 'Paket Data', 'E-Money']) assert.ok(teks().includes(kat), `kategori "${kat}" jadi judul seksi grid`);
assert.match(teks(), /4 layanan · 25 produk/, 'ringkasan jumlah layanan & produk dari server');
// Kartu = tautan ke HALAMAN ORDER khusus layanan itu (bukan membuka daftar harga di tempat).
assert.equal(kartu()[0].tagName, 'A', 'card layanan adalah tautan (navigasi ke halaman order)');
assert.deepEqual(
  kartu().map((k) => k.getAttribute('href')).sort(),
  ['/ppob/layanan/e-money-ovo', '/ppob/layanan/paket-data-truemove-h', '/ppob/layanan/pulsa-ais', '/ppob/layanan/pulsa-dtac'],
  'tiap card menuju halaman order layanannya sendiri',
);
assert.match(teks(), /Order sekarang/, 'card mengajak user memesan (bukan melihat daftar harga)');
assert.ok(!/Lihat produk|Tutup daftar/.test(teks()), 'daftar harga inline dihapus dari halaman grid');
// Judul kategori juga punya halaman sendiri (mis. Aktivasi Perdana → pemilih operator).
const kat = [...dom.window.document.querySelectorAll('[data-kategori]')].map((k) => k.getAttribute('href'));
assert.ok(kat.includes('/ppob/layanan/pulsa') && kat.includes('/ppob/layanan/e-money'), 'judul kategori menaut ke halaman order kategori itu');
assert.match(teks(), /Rp 8\.500/, 'harga termurah DTAC tampil (harga asli penyedia, tanpa markup di web utama)');
assert.match(teks(), /Rp 13\.353/, 'harga termurah AIS tampil');
assert.ok(!/Free Fire|Mobile Legends/.test(teks()), 'tidak ada kartu top up game di halaman layanan PPOB');

/* ---------- 3b. Halaman order khusus layanan (klik card DTAC) ---------- */
await act(async () => root.unmount());
const rootOrder = createRoot(dom.window.document.getElementById('root'));
await act(async () => rootOrder.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob/layanan/pulsa-dtac'] }, rute())));

assert.match(teks(), /DTAC/, 'halaman order menampilkan nama layanannya');
assert.match(teks(), /Pulsa/, 'kategori penyedia ikut tampil');
assert.match(teks(), /1\. Data tujuan/, 'langkah 1 = data tujuan (sesuai dokumentasi transaksi penyedia)');
assert.match(teks(), /Nomor HP/, 'layanan pulsa meminta nomor HP');
assert.match(teks(), /2\. Pilih produk/, 'langkah 2 = pilih produk dari katalog penyedia');
assert.match(teks(), /DTAC 10 THB/, 'produk asli penyedia tampil di halaman order');
assert.match(teks(), /DTACDATA1/, 'kode produk asli penyedia tampil (bukan karangan)');
assert.match(teks(), /Rp 4\.250/, 'harga produk termurah tampil');
assert.match(teks(), /Bayar & Proses/, 'tombol order ada di halaman layanan');
assert.match(teks(), /saldo dipotong\s*saat pesanan dibuat|saldo dipotong saat pesanan dibuat/, 'user diberi tahu saldo dipotong server saat pesanan dibuat');

// Tombol order mati sampai produk dipilih + nomor tujuan valid.
const tombolPesan = () => dom.window.document.querySelector('[data-pesan="true"]');
assert.ok(tombolPesan().disabled, 'order belum bisa dikirim sebelum produk dipilih');
await act(async () => dom.window.document.querySelector('[data-produk="DTAC10"]').click());
assert.ok(tombolPesan().disabled, 'order masih terkunci selama nomor tujuan kosong');

const inputTujuan = dom.window.document.querySelector('[data-tujuan="true"]');
assert.ok(inputTujuan, 'input nomor tujuan ada');
const setterInput = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
const isiInput2 = async (el, nilai) => {
  await act(async () => {
    setterInput.call(el, nilai);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};
await isiInput2(inputTujuan, '08123');
await act(async () => inputTujuan.dispatchEvent(new dom.window.FocusEvent('focusout', { bubbles: true }))); // onBlur React = focusout
assert.match(teks(), /hanya angka, 8–16 digit/, 'nomor terlalu pendek ditolak di browser sebelum dikirim');
assert.ok(tombolPesan().disabled, 'order terkunci selama nomor tujuan tidak valid');

await isiInput2(inputTujuan, '081234567890');
assert.ok(!tombolPesan().disabled, 'order bisa dikirim setelah produk + nomor tujuan valid');
await act(async () => tombolPesan().click());
assert.equal(JSON.stringify(ctx.__PESANAN__.at(-1)), JSON.stringify({ player_id: '081234567890', kode_produk: 'DTAC10' }), 'order mengirim kode produk asli + nomor tujuan ke proxy server');
assert.match(teks(), /Pesanan diteruskan ke penyedia/, 'status pending dijelaskan ke user');
assert.match(teks(), /PPOB-26112812000011/, 'ref pesanan ditampilkan (dipakai cek status & komplain)');
assert.match(teks(), /Rp 1\.241\.500/, 'sisa saldo dari server ditampilkan');
assert.match(teks(), /Riwayat pesanan/, 'ada jalan ke Riwayat Pesanan setelah order');

// Cek status menarik jawaban webhook/provider.
await act(async () => [...dom.window.document.querySelectorAll('button')].find((b) => /Cek status/.test(b.textContent || '')).click());
assert.match(teks(), /Pesanan berhasil/, 'status sukses dari webhook mengubah tampilan hasil');
assert.match(teks(), /TV991122/, 'ID transaksi penyedia ditampilkan');
assert.match(teks(), /0123456789/, 'serial number/token ditampilkan');

/* ---------- 3c. Halaman order per KATEGORI (mis. Aktivasi Perdana / e-money) ---------- */
await act(async () => rootOrder.unmount());
const rootKat = createRoot(dom.window.document.getElementById('root'));
await act(async () => rootKat.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob/layanan/pulsa'] }, rute())));
assert.match(teks(), /Pilih layanan/, 'kategori dengan beberapa operator menampilkan pemilih layanan');
const operator = [...dom.window.document.querySelectorAll('[data-operator]')].map((o) => o.getAttribute('data-operator'));
assert.deepEqual(operator, ['pulsa-ais', 'pulsa-dtac'], 'pemilih berisi operator dalam kategori itu');
await act(async () => dom.window.document.querySelector('[data-operator="pulsa-dtac"]').click());
assert.match(teks(), /DTAC 10 THB/, 'produk operator pilihan dimuat di halaman kategori');

/* ---------- 3d. Layanan tak dikenal: jujur, tanpa data karangan ---------- */
await act(async () => rootKat.unmount());
const root404 = createRoot(dom.window.document.getElementById('root'));
await act(async () => root404.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob/layanan/tidak-ada-layanan'] }, rute())));
assert.match(teks(), /tidak ada di katalog penyedia/, 'id layanan tak dikenal dijelaskan apa adanya');
assert.match(teks(), /Pilih layanan lain/, 'ada jalan kembali memilih layanan');
await act(async () => root404.unmount());

/* ---------- 3e. Galat daftar produk di halaman order ---------- */
const rootGalat = createRoot(dom.window.document.getElementById('root'));
await act(async () => rootGalat.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob/layanan/pulsa-ais'] }, rute())));
assert.match(teks(), /Layanan tidak ditemukan di katalog penyedia\./, 'galat daftar produk ditampilkan apa adanya');
assert.match(teks(), /Coba lagi/, 'galat produk punya tombol Coba lagi');
await act(async () => rootGalat.unmount());

/* ---------- 3f. Pencarian di halaman Semua Layanan ---------- */
const rootCari = createRoot(dom.window.document.getElementById('root'));
await act(async () => rootCari.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob/layanan'] }, rute())));
// Pencarian menyaring kartu layanan.
const inputCari = dom.window.document.querySelector('input[aria-label="Cari layanan PPOB"]');
assert.ok(inputCari, 'kotak pencarian layanan ada');
/** Isi input lewat setter prototipe asli supaya onChange React ikut terpicu di jsdom. */
const isiInput = async (el, nilai) => {
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(el, nilai);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
};
await isiInput(inputCari, 'ovo');
assert.equal(kartu().length, 1, 'pencarian "ovo" menyisakan satu kartu');
assert.equal(kartu()[0].getAttribute('data-layanan'), 'e-money-ovo', 'kartu yang tersisa = OVO');
await isiInput(inputCari, 'zzz-tidak-ada');
assert.match(teks(), /Tidak ada layanan yang cocok/, 'pencarian tanpa hasil punya state kosong');
await act(async () => rootCari.unmount());

/* ---------- 4. Markup PPOB child panel ikut dihitung di halaman layanan ---------- */
ctx.__TENANT__ = { name: 'Panelku', hostname: 'panelku.contoh', access_ppob_markup: 1, markup_ppob_pct: 3, config: {} };
const root2 = createRoot(dom.window.document.getElementById('root'));
await act(async () => root2.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob/layanan'] }, rute())));
assert.match(teks(), /Rp 8\.755/, 'DTAC 8.500 + markup PPOB 3% = Rp 8.755 (child panel ber-akses)');
assert.match(teks(), /harga sudah termasuk markup panel 3%/, 'user diberi tahu harga sudah termasuk markup panel');

/* ---------- 5. Galat endpoint: kartu galat jujur, bukan daftar dummy ---------- */
ctx.__LAYANAN__ = async () => ({ ok: false, message: 'Daftar layanan belum dapat diambil dari server penyedia (http=0 timeout).' });
await act(async () => root2.unmount());
const root3 = createRoot(dom.window.document.getElementById('root'));
await act(async () => root3.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob/layanan'] }, rute())));
assert.match(teks(), /http=0 timeout/, 'pesan galat asli dari server ditampilkan');
assert.match(teks(), /Coba lagi/, 'tombol Coba lagi saat galat');
assert.match(teks(), /Login ulang/, 'tombol Login ulang saat galat');
assert.equal(kartu().length, 0, 'tidak ada kartu layanan karangan saat endpoint gagal');

/* ---------- 6. Card Menu di beranda PPOB ---------- */
ctx.__TENANT__ = null;
ctx.__LAYANAN__ = async () => ({ ok: true, source: 'provider', kelompok: KELOMPOK });
await act(async () => root3.unmount());
const root4 = createRoot(dom.window.document.getElementById('root'));
await act(async () => root4.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob'] }, rute())));
assert.match(teks(), /\nMenu\n|Menu/, 'card Menu tetap ada di beranda PPOB');
assert.ok(!teks().includes('Menu Service'), 'labelnya "Menu", bukan "Menu Service"');
const tile = [...dom.window.document.querySelectorAll('[data-layanan]')].map((t) => t.getAttribute('data-layanan'));
assert.deepEqual(tile, ['pulsa-ais', 'paket-data-truemove-h', 'pulsa-dtac', 'e-money-ovo'], 'tile layanan live = layanan selain top up game dari endpoint');
assert.ok(teks().includes('Pulsa Reguler'), 'layanan lokal Pulsa Reguler tetap dipatok di grid');
assert.ok(dom.window.document.querySelector('[data-lainnya="true"]'), 'tile Lainnya ada di grid Menu');
assert.ok(!/Streaming & Game|Pulsa Internasional/.test(teks()), 'tile mock lama (termasuk top up game) hilang dari Menu');
assert.ok(!teks().includes('Exchange'), 'aksi cepat Exchange dihapus dari halaman PPOB');
assert.deepEqual(
  [...dom.window.document.querySelectorAll('a[href="/ppob/layanan/e-money"]')].length, 2,
  'aksi cepat Transfer & Top up menuju layanan e-money',
);

console.log('PASS Layanan PPOB: endpoint list produk penuh difilter berbasis KATEGORI penyedia (AIS/TrueMove H/DTAC/OVO lolos, 30 label game asli ditolak), tampil sebagai card Menu di /ppob dan grid card di /ppob/layanan yang menavigasi ke HALAMAN ORDER khusus per layanan/kategori (form tujuan sesuai jenis layanan, produk asli penyedia + markup, validasi, kirim transaksi, ref/status/serial, cek status, galat jujur tanpa data dummy).');
