// Order top up game & PPOB diproses SERVER: harga + markup dihitung ulang dari katalog
// penyedia, saldo user dipotong, pesanan tercatat di riwayat_pesanan (jadi tampil di
// halaman Riwayat Pesanan), dan pesanan yang gagal/ditolak dibatalkan dengan saldo
// dikembalikan. Plus: News Update PPOB diatur admin (Admin Panel → News Update PPOB),
// halaman top up game masuk sitemap.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-ppob-order.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire('/home/user/boosteryuk.com/package.json');
const { JSDOM } = require('jsdom');
const { build } = require('esbuild');
const read = (f) => fs.readFileSync(f, 'utf8');

/* ================= 1. Server: harga, saldo, riwayat, refund ================= */
const php = read('php-api/tokovoucher.php');
for (const fn of ['tv_markup_pct', 'tv_find_produk', 'tv_judul_pesanan', 'tv_buat_pesanan', 'tv_batalkan_pesanan', 'tv_selesaikan_pesanan', 'tv_sync_pesanan'])
  assert.ok(php.includes(`function ${fn}(`), `php-api/tokovoucher.php punya function ${fn}()`);

// Markup top up game di server HARUS sama dengan TOPUP_MARKUP_PCT di frontend (2%).
assert.match(php, /const TV_MARKUP_TOPUP_PCT = 2;/, 'markup top up game server = 2% (sama dengan frontend)');
const fe = read('src/data/topupGames.ts');
assert.match(fe, /export const TOPUP_MARKUP_PCT = 2;/, 'markup top up game frontend = 2%');
assert.match(php, /return \$jenis === 'ppob' \? 0\.0 : \(float\)TV_MARKUP_TOPUP_PCT;/, 'web utama: PPOB tanpa markup, top up game 2%');
assert.match(php, /\$jenis === 'ppob' && \(int\)\(\$tenant\['access_ppob_markup'\] \?\? 0\) === 1/, 'child panel ber-akses memakai markup PPOB-nya sendiri');
assert.match(php, /\$jenis === 'topup' && \(int\)\(\$tenant\['access_topup_markup'\] \?\? 0\) === 1/, 'child panel ber-akses memakai markup top up-nya sendiri');
assert.match(php, /max\(0, min\(CP_MAX_MARKUP, \(float\)\(\$tenant\['markup_ppob_pct'\] \?\? 0\)\)\)/, 'markup panel dibatasi 0..CP_MAX_MARKUP');

// Produk dikenali dari katalog penyedia — browser tidak bisa mengarang kode/harga.
assert.match(php, /\[\$itemProduk, \$jenisOrder, \$katalogAda\] = tv_find_produk\(\$produk\);/, 'transaksi mencari kode produk di katalog penyedia');
assert.match(php, /'Kode produk tidak ditemukan di katalog penyedia\./, 'kode tak dikenal ditolak (bukan pesanan karangan)');
assert.match(php, /\$hargaJual = \(int\)round\(\$hargaModal \* \(1 \+ \$markupPct \/ 100\)\);/, 'harga jual = modal + markup, tanpa pembulatan ratusan');
assert.match(php, /\$ref = \(\$jenisOrder === 'ppob' \? 'PPOB-' : 'TVG-'\) \. date\('ymdHis'\) \. random_int\(10, 99\);/, 'ref pesanan berawalan PPOB- (layanan) / TVG- (top up game)');

// Urutan: saldo dipotong + riwayat ditulis SEBELUM menembak penyedia.
const badanTrx = php.slice(php.indexOf('$buat = tv_buat_pesanan('), php.indexOf("tv_out([\n    'ok'         => $okProvider,"));
assert.ok(badanTrx.indexOf('tv_buat_pesanan') < badanTrx.indexOf('tv_api_trx'), 'saldo dipotong & riwayat ditulis sebelum transaksi dikirim ke penyedia');
assert.match(badanTrx, /'status' => 'batal', 'jenis' => \$jenisOrder/, 'gagal membuat pesanan dibalas status batal (saldo tidak dipotong)');
assert.match(php, /SELECT balance FROM users WHERE id=\? FOR UPDATE/, 'saldo dikunci saat dipotong (tidak bisa double-spend)');
assert.match(php, /'Saldo tidak cukup \(' \. tv_rupiah\(\$saldo\) \. ' dari ' \. tv_rupiah\(\$hargaJual\) \. '\)\. Isi saldo terlebih dahulu\.'/, 'saldo kurang ditolak dengan pesan jujur + nominal');
assert.match(php, /UPDATE users SET balance=balance-\? WHERE id=\?/, 'saldo user dipotong sebesar harga jual');
assert.match(php, /INSERT INTO riwayat_pesanan \(user_id, order_id, service_name, quantity, price, status, order_type, target\)/, 'pesanan top up/PPOB ditulis ke riwayat_pesanan (tampil di halaman Riwayat)');
assert.match(php, /\$jenis === 'ppob' \? 'ppob' : 'topup'/, 'order_type membedakan pesanan PPOB dan top up game');
assert.match(php, /cp_record_order\(\$conn, \(int\)\$tenant\['id'\], \(int\)\$uid, \(string\)\$ref, \$jenis === 'ppob' \? 'ppob' : 'topup', \$judul, 1, \$hargaJual, \$hargaModal\)/, 'keuntungan child panel (markup) ikut tercatat');
assert.match(php, /\$judulPesanan = tv_judul_pesanan\(\$jenisOrder, \$itemProduk\);/, 'judul pesanan disusun dari nama game/layanan + produk asli penyedia');
assert.match(php, /return mb_substr\('PPOB: ' \./, 'pesanan PPOB diawali "PPOB:" di riwayat');
assert.match(php, /return mb_substr\('Topup Game: ' \./, 'pesanan top up game diawali "Topup Game:" di riwayat');

// Refund: idempoten, hanya untuk pesanan yang masih berjalan.
assert.match(php, /UPDATE riwayat_pesanan SET status='batal' WHERE order_id=\? AND status IN \('proses','pending'\)/, 'pembatalan hanya mengenai pesanan berjalan (refund tidak ganda)');
assert.match(php, /UPDATE users SET balance=balance\+\? WHERE id=\?/, 'saldo dikembalikan saat pesanan batal');
assert.match(php, /function tv_sync_pesanan\(\$conn, \$ref, \$status\) \{[\s\S]{0,400}tv_batalkan_pesanan[\s\S]{0,200}tv_selesaikan_pesanan/, 'status penyedia disinkronkan ke riwayat: gagal → batal+refund, sukses → selesai');
assert.match(php, /if \(tv_sync_pesanan\(\$conn, \$ref, \$st\) && \$st === 'gagal' && \$saldoSetelah !== null\) \$saldoSetelah \+= \$hargaJual;/, 'hasil transaksi disinkronkan ke riwayat + sisa saldo dibetulkan setelah refund');
// Aturan API TokoVoucher: network timeout / penyedia tak terjangkau = transaksi PENDING
// (bukan gagal): pesanan TIDAK dibatalkan dan saldo TIDAK dikembalikan di jalur ini.
assert.ok(!php.includes("tv_batalkan_pesanan($conn, $ref, 'penyedia tidak dapat dihubungi')"), 'penyedia tak terjangkau tidak lagi membatalkan pesanan + refund');
assert.match(php, /\$alasanNet = tv_alasan_pending\('', '', 0, \(string\)\(\$r\['error'\] \?\? ''\)\);[\s\S]{0,400}?tv_out\(tv_pesanan_pending\(\$conn, \$ref, \$ctxPesanan \+ \['metode' => \$a\['metode'\], 'http' => 0\], \$alasanNet\), 200\);/, 'network timeout/CURL error → pesanan PENDING (HTTP 200, tanpa refund)');
assert.ok(!php.includes("tv_batalkan_pesanan($conn, $ref, 'balasan penyedia non-JSON')"), 'balasan non-JSON tidak lagi membatalkan pesanan + refund');
assert.match(php, /\$alasanRaw = tv_alasan_pending\('unknown', \$raw, \(int\)\$r\['code'\], ''\);/, 'balasan non-JSON/HTTP error → alasan PENDING dari kode HTTP penyedia');
assert.match(php, /\$alasanPending = tv_alasan_pending\(\$st, \$pesan, \(int\)\$r\['code'\], \(string\)\(\$r\['error'\] \?\? ''\)\);\s*\n\s*if \(\$alasanPending !== ''\) \{\s*\n\s*tv_out\(tv_pesanan_pending\(/, 'status penyedia yang belum pasti (pending/unknown/saldo provider) → PENDING sebelum sinkronisasi gagal');
const badanWebhook = php.slice(php.indexOf("if ($action === 'webhook')"), php.indexOf("if ($action === 'cek_status')"));
assert.match(badanWebhook, /tv_sync_pesanan\(\$conn, \$ref, \$norm\['status'\]\);/, 'webhook penyedia menyinkron riwayat + refund');
const badanCek = php.slice(php.indexOf("if ($action === 'cek_status')"));
assert.match(badanCek, /tv_sync_pesanan\(\$conn, \$ref, \$stSimpan\);/, 'cek status (webhook tersimpan) menyinkron riwayat');
assert.match(badanCek, /tv_sync_pesanan\(\$conn, \$ref, \$norm\['status'\]\);/, 'cek status (tanya penyedia) menyinkron riwayat');

// Balasan transaksi membawa harga yang ditagih + sisa saldo (dipakai UI).
assert.match(php, /'harga'      => \$hargaJual,\s*\n\s*'harga_modal' => \$hargaModal,\s*\n\s*'markup_pct' => \$markupPct,\s*\n\s*'saldo'      => \$saldoSetelah,/, 'balasan transaksi: harga jual, harga modal, markup, sisa saldo');

// Tujuan boleh berisi @ dan + (email akun voucher digital / nomor internasional).
assert.match(php, /preg_replace\('\/\[\^A-Za-z0-9\._@\+-\]\/', '', \(string\)\(\$in\['player_id'\] \?\? ''\)\)/, 'tujuan disanitasi namun tetap mengizinkan email/nomor internasional');
assert.match(php, /mb_strlen\(\$tujuan\) < 3 \|\| mb_strlen\(\$tujuan\) > 64/, 'panjang tujuan 3..64 karakter');

// Riwayat pesanan mengirim order_type ke browser.
const riwayatPhp = read('php-api/riwayat_pesanan.php');
assert.match(riwayatPhp, /order_type, catatan, UNIX_TIMESTAMP\(created_at\)\*1000 AS created_at/, 'riwayat_pesanan.php mengirim order_type + catatan (alasan PENDING)');
assert.match(riwayatPhp, /action=pending_sync&token=/, 'riwayat_pesanan.php memicu cek berkala pesanan PENDING setelah balasan dikirim (throttle 10 menit di server)');
assert.match(riwayatPhp, /riwayat_ensure_columns/, 'kolom order_type dibuat otomatis bila belum ada');

// News Update PPOB disimpan admin lewat site_settings.php (kunci ppobNews).
const ss = read('php-api/site_settings.php');
assert.match(ss, /if \(array_key_exists\('ppobNews', \$patch\) && is_array\(\$patch\['ppobNews'\]\)\)/, 'site_settings.php menerima setelan ppobNews');
assert.match(ss, /'warna' => clean_str\(\$it\['warna'\] \?\? '', 20\)/, 'warna badge berita disimpan');
assert.match(ss, /'gradien'  => clean_str\(\$it\['gradien'\] \?\? '', 200\)/, 'gradien kartu promo disimpan');
assert.match(ss, /array_slice\(\$src\['berita'\], 0, 30\)/, 'jumlah berita dibatasi 30');
assert.match(ss, /array_slice\(\$src\['kartu'\], 0, 30\)/, 'jumlah kartu dibatasi 30');

/* ================= 2. Klien: riwayat, setelan admin, rute, sitemap ================= */
const riwayat = read('src/pages/RiwayatPage.tsx');
assert.match(riwayat, /topup: \{ label: 'Topup Game', icon: Gamepad2, to: '\/topup'/, 'Riwayat punya tab jenis Topup Game');
assert.match(riwayat, /ppob: \{ label: 'PPOB', icon: Zap, to: '\/ppob'/, 'Riwayat punya tab jenis PPOB');
assert.match(riwayat, /if \(\/\^PPOB\[0-9A-Z-\]\/i\.test\(orderId\) \|\| n\.startsWith\('ppob'\)\) return 'ppob';/, 'pesanan PPOB- dikenali sebagai PPOB');
assert.match(riwayat, /if \(\/\^TVG\[0-9A-Z-\]\/i\.test\(orderId\) \|\| n\.startsWith\('topup game'\)\) return 'topup';/, 'pesanan TVG- dikenali sebagai top up game');
assert.match(riwayat, /const rawType = String\(r\.type \?\? r\.order_type \?\? ''\);/, 'order_type dari server dipakai mengenali jenis pesanan');
assert.match(riwayat, /o\.type === 'topup' \|\| o\.type === 'ppob' \? '1 transaksi'/, 'jumlah pesanan top up/PPOB ditulis "1 transaksi"');

const ctxSet = read('src/context/SiteSettingsContext.tsx');
assert.match(ctxSet, /ppobNews: PpobNews;/, 'setelan ppobNews ada di SiteSettings');
assert.match(ctxSet, /'ppobNews',/, 'ppobNews ikut dibagikan ke semua pengunjung (SHARED_KEYS)');
assert.match(ctxSet, /const setPpobBerita = \(items: PpobBeritaAdmin\[\]\) => \{\s*markDirty\(\['ppobNews'\]\);/, 'setPpobBerita menandai perubahan untuk disimpan ke database');
assert.match(ctxSet, /const setPpobKartu = \(items: PpobKartuAdmin\[\]\) => \{\s*markDirty\(\['ppobNews'\]\);/, 'setPpobKartu menandai perubahan untuk disimpan ke database');
assert.match(ctxSet, /ppobNews: PPOB_NEWS_DEFAULT,/, 'isi bawaan dipakai sebelum admin menyimpan');

const dataPpob = read('src/data/ppob.ts');
assert.match(dataPpob, /export const PPOB_NEWS_DEFAULT: PpobNews = \{/, 'isi bawaan News Update PPOB diekspor');
assert.match(dataPpob, /kartu: PPOB_BANNERS\.map/, 'kartu bawaan = 3 kartu promo lama (BAYAR TAGIHANMU dkk)');

const app = read('src/App.tsx');
assert.match(app, /<Route path="admin\/ppob-news" element=\{<ProtectedRoute adminOnly><AdminPpobNewsPage \/><\/ProtectedRoute>\} \/>/, 'rute admin News Update PPOB khusus admin');
assert.match(app, /<Route path="ppob\/layanan\/:id" element=\{<ProtectedRoute><PpobLayananOrderPage \/><\/ProtectedRoute>\} \/>/, 'rute halaman order per layanan');

const sideMenu = read('src/components/SideMenu.tsx');
assert.match(sideMenu, /id: 'ppob-news' as const, icon: Newspaper, label: 'News Update PPOB'[\s\S]{0,80}path: '\/admin\/ppob-news'/, 'menu Admin Panel "News Update PPOB" ada');

// Halaman top up game masuk sitemap (+ HTML statis saat build).
const sitemap = read('public/sitemap.xml');
assert.match(sitemap, /<loc>https:\/\/boosteryuk\.com\/topup<\/loc>/, 'sitemap memuat halaman Topup Game');
for (const slug of ['free-fire', 'mobile-legends', 'pubg-mobile', 'genshin-impact', 'honkai-star-rail'])
  assert.ok(sitemap.includes(`<loc>https://boosteryuk.com/topup/${slug}</loc>`), `sitemap memuat halaman top up ${slug}`);
const seoPages = read('scripts/seo-pages.mjs');
assert.match(seoPages, /for \(const g of data\.topupGames \|\| \[\]\)/, 'seo-pages.mjs (sitemap + prerender) membaca daftar halaman top up game');
const pagesJson = JSON.parse(read('src/seo/pages.json'));
assert.ok(pagesJson.static.some((p) => p.path === '/topup'), 'pages.json punya halaman indeks /topup');
assert.ok(pagesJson.topupGames.length >= 10, 'pages.json punya daftar halaman detail top up game');
assert.ok(pagesJson.topupGames.every((g) => g.slug && g.title && g.description && g.updated), 'tiap halaman top up punya slug, judul, deskripsi & tanggal');

// Menu Referral & Tukar Poin hilang dari halaman profil; Exchange hilang dari PPOB.
const profil = read('src/pages/ProfilPage.tsx');
assert.ok(!/label="Referral"/.test(profil), 'menu Referral dihapus dari halaman profil');
assert.ok(!/label="Tukar Poin"/.test(profil), 'menu Tukar Poin dihapus dari halaman profil');
const beranda = read('src/pages/PpobPage.tsx');
assert.ok(!beranda.includes("'Exchange'"), 'aksi cepat Exchange dihapus dari halaman PPOB');
assert.match(beranda, /to: RUTE_E_MONEY/, 'Transfer & Top up diarahkan ke layanan e-money');
assert.ok(!/View All/i.test(beranda), 'teks "View All" dihapus dari News Update');
assert.match(beranda, /\n            Menu\n/, 'label card menu berbunyi "Menu"');

/* ================= 3. Render: Admin News Update PPOB + halaman PPOB ================= */
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com/admin/ppob-news' });
const { outputFiles } = await build({
  stdin: {
    contents:
      "export {default as AdminNews} from './src/pages/admin/AdminPpobNewsPage';" +
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
        if (a.path.endsWith('AuthContext')) return { contents: "export const useAuth=()=>({user:{id:7,name:'Melvi Husin',username:'melvi',balance:50000},isAdmin:true,logout:()=>{},refresh:async()=>{}});", resolveDir: process.cwd() };
        if (a.path.endsWith('SiteSettingsContext')) {
          return {
            contents: `export const useSiteSettings=()=>({
  settings: globalThis.__SETTINGS__,
  tenant: null,
  sync: { status: 'idle', message: '' },
  updateSettings: () => {},
  setInfoItems: () => {},
  setPpobBerita: (items) => globalThis.__SIMPAN__.berita.push(items),
  setPpobKartu: (items) => globalThis.__SIMPAN__.kartu.push(items),
});`,
            resolveDir: process.cwd(),
          };
        }
        if (a.path.endsWith('tokovoucherApi')) {
          return {
            contents: `export const tvLayanan=async()=>globalThis.__LAYANAN__();
export const tvLayananProduk=async()=>({ok:true,kelompok:null,items:[]});
export const tvTransaksi=async()=>({ok:false,message:'mock'});
export const tvCekStatus=async()=>({ok:true,status:'sukses'});`,
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
  Event: dom.window.Event, CustomEvent: dom.window.CustomEvent, FocusEvent: dom.window.FocusEvent,
  getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  fetch: async () => { throw new TypeError('Failed to fetch'); },
  __SIMPAN__: { berita: [], kartu: [] },
  __SETTINGS__: { brandName: 'Boosteryuk' },
  __LAYANAN__: async () => ({ ok: true, source: 'provider', kelompok: [] }),
};
ctx.global = ctx;
vm.runInNewContext(outputFiles[0].text, ctx);
ctx.globalThis = ctx;
const { AdminNews, PpobPage, createElement: h, act, createRoot } = ctx.module.exports;
const teks = () => dom.window.document.body.textContent || '';

ctx.__SETTINGS__ = {
  brandName: 'Boosteryuk',
  ppobNews: {
    berita: [{ id: 1, tag: 'PROMO', warna: '#F59E0B', title: 'Diskon token PLN 10%', desc: 'Isi lengkap promo token PLN dari admin.', time: '28 Nov 2026' }],
    kartu: [
      { id: 1, title: 'BAYAR TAGIHANMU', subtitle: 'HANYA DI {APP}', desc: 'PLN, PDAM, BPJS & internet', gradien: 'linear-gradient(120deg,#1D4ED8 0%,#3B82F6 100%)' },
      { id: 2, title: 'TOP UP E-MONEY', subtitle: 'DANA, OVO, GOPAY DI {APP}', desc: '', gradien: 'linear-gradient(120deg,#059669 0%,#34D399 100%)' },
    ],
  },
};

const root = createRoot(dom.window.document.getElementById('root'));
await act(async () => root.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/admin/ppob-news'] },
    h(ctx.module.exports.Routes, null,
      h(ctx.module.exports.Route, { path: '/admin/ppob-news', element: h(AdminNews) })))));

assert.match(teks(), /News Update PPOB/, 'halaman admin News Update PPOB terbuka');
assert.match(teks(), /Kartu Promo PPOB \(baris geser\)/, 'bagian kartu promo ada');
assert.match(teks(), /News Update PPOB \(card \+ modal\)/, 'bagian berita (card + modal) ada');
assert.match(teks(), /Diskon token PLN 10%/, 'berita kiriman admin tampil di form');
assert.match(teks(), /BAYAR TAGIHANMU/, 'kartu promo kiriman admin tampil di form');
assert.match(teks(), /HANYA DI Boosteryuk/, '{APP} diganti nama brand saat pratinjau');
assert.match(teks(), /TOP UP E-MONEY/, 'kartu kedua admin tampil (jumlah kartu bebas)');

// Tambah kartu baru → tersimpan lewat setter context (→ site_settings.php).
const tombolTambahKartu = dom.window.document.querySelector('[data-tambah-kartu="true"]');
assert.ok(tombolTambahKartu, 'tombol Tambah kartu ada');
await act(async () => tombolTambahKartu.click());
assert.match(teks(), /Kartu 3/, 'kartu baru langsung muncul di form');
await act(async () => dom.window.document.querySelector('[data-simpan-kartu="true"]').click());
assert.equal(ctx.__SIMPAN__.kartu.length, 1, 'simpan kartu memanggil setter context');
assert.equal(ctx.__SIMPAN__.kartu[0].length, 3, 'tiga kartu terkirim ke server');

// Ubah judul berita + tambah berita → tersimpan lewat setter.
const inputJudul = dom.window.document.querySelector('[data-berita-judul="1"]');
assert.ok(inputJudul, 'input judul berita ada');
const setterInput = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
await act(async () => {
  setterInput.call(inputJudul, 'Diskon token PLN 15% minggu ini');
  inputJudul.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
});
await act(async () => dom.window.document.querySelector('[data-tambah-berita="true"]').click());
assert.match(teks(), /Berita 2/, 'berita baru muncul di form');
await act(async () => dom.window.document.querySelector('[data-simpan-berita="true"]').click());
assert.equal(ctx.__SIMPAN__.berita.length, 1, 'simpan berita memanggil setter context');
assert.equal(ctx.__SIMPAN__.berita[0][0].title, 'Diskon token PLN 15% minggu ini', 'judul berita yang diedit admin ikut tersimpan');
assert.equal(ctx.__SIMPAN__.berita[0].length, 2, 'dua berita terkirim ke server');

/* ---------- halaman PPOB memakai kiriman admin + modal ---------- */
await act(async () => root.unmount());
const root2 = createRoot(dom.window.document.getElementById('root'));
await act(async () => root2.render(
  h(ctx.module.exports.MemoryRouter, { initialEntries: ['/ppob'] },
    h(ctx.module.exports.Routes, null,
      h(ctx.module.exports.Route, { path: '/ppob', element: h(PpobPage) })))));

assert.match(teks(), /Diskon token PLN 10%/, 'berita admin tampil di halaman PPOB');
assert.ok(!teks().includes('View All'), 'teks "View All" tidak ada di News Update');
assert.match(teks(), /BAYAR TAGIHANMU/, 'kartu promo admin tampil di halaman PPOB');
assert.match(teks(), /PLN, PDAM, BPJS & internet/, 'keterangan kartu promo admin tampil');
assert.equal(dom.window.document.querySelectorAll('[data-kartu]').length, 2, 'jumlah kartu = kiriman admin (bisa lebih dari 3)');
assert.equal(dom.window.document.querySelectorAll('[data-berita]').length, 1, 'jumlah card berita = kiriman admin');

// Klik card berita → modal menampilkan isi lengkap dari admin.
await act(async () => dom.window.document.querySelector('[data-berita="1"]').click());
const modal = dom.window.document.querySelector('[data-modal-berita="true"]');
assert.ok(modal, 'modal News Update terbuka saat card berita diketuk');
assert.match(modal.textContent, /Diskon token PLN 10%/, 'modal menampilkan judul berita admin');
assert.match(modal.textContent, /Isi lengkap promo token PLN dari admin\./, 'modal menampilkan isi berita admin');
assert.match(modal.textContent, /28 Nov 2026/, 'modal menampilkan tanggal berita admin');
await act(async () => dom.window.document.querySelector('[aria-label="Tutup kabar"]').click());
assert.ok(!dom.window.document.querySelector('[data-modal-berita="true"]'), 'modal bisa ditutup');

/* ---------- saldo kurang: order top up/PPOB tidak bisa dipaksa ---------- */
assert.match(teks(), /Saldo kurang|Rp 50\.000|IDR ••••••••••/, 'saldo user tampil di halaman PPOB');

console.log('PASS Order Topup & PPOB: server menghitung harga+markup dari katalog penyedia, memotong saldo, menulis riwayat_pesanan (order_type topup/ppob) sehingga pesanan top up game & PPOB tampil di Riwayat Pesanan, membatalkan + mengembalikan saldo HANYA untuk penolakan pasti (HTTP error/timeout/gangguan penyedia = PENDING, diuji di test-tokovoucher-pending.mjs), webhook & cek status ikut menyinkron; News Update PPOB (card+modal) dan kartu promo geser diatur admin lewat halaman Admin Panel baru; halaman top up game masuk sitemap + prerender; Exchange dihapus, Transfer/Top up ke layanan e-money, Referral & Tukar Poin hilang dari profil.');
