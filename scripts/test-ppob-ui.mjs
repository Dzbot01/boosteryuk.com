// PPOB — menu baru + dua halaman (Beranda PPOB & Pulsa Reguler) dan rombak UI halaman profil.
//  • Semua data layanan berupa variabel/mock di src/data/ppob.ts (operator, prefix, produk,
//    menu service, banner, berita, pengumuman, poin) → diuji sebagai modul (bukan cuma teks);
//  • deteksi operator otomatis dari 4 digit pertama nomor (+62 disamakan jadi 0);
//  • Beranda PPOB: header biru gradient, nama user emas, sapaan dinamis, lonceng bertitik merah,
//    card saldo overlap (mata untuk sembunyikan/tampilkan), Point, 3 aksi cepat, marquee,
//    grid Menu Service 4×2, carousel banner + indikator titik, section NEWS UPDATES + VIEW ALL;
//  • Pulsa Reguler: jam real-time per detik, tombol kembali, input Nomor Tujuan + lencana
//    operator, grid produk 2 kolom (badge available/unavailable, unavailable tidak bisa diklik,
//    terpilih = border biru tebal + latar biru muda), skeleton loading, tombol "Beli Sekarang"
//    sticky di bawah (bukan navbar);
//  • TANPA bottom navigation bar & TANPA tombol scan QR melayang; padding bawah ±100px;
//  • menu PPOB terdaftar di side menu user (setelah Topup Game) & admin, rute /ppob +
//    /ppob/pulsa-reguler dilindungi login; halaman profil tetap mempertahankan fitur lama.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-ppob-ui.mjs
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

const read = (f) => readFileSync(f, 'utf8');
const dir = mkdtempSync(path.join(tmpdir(), 'ppob-ui-'));

/* ---------- 1. Rute & menu ---------- */
const app = read('src/App.tsx');
assert.match(app, /const PpobPage = lazy\(\(\) => import\('\.\/pages\/PpobPage'\)\);/, 'halaman PPOB dimuat malas');
assert.match(app, /const PpobPulsaRegulerPage = lazy\(\(\) => import\('\.\/pages\/PpobPulsaRegulerPage'\)\);/, 'halaman Pulsa Reguler dimuat malas');
assert.match(app, /<Route path="ppob" element=\{<ProtectedRoute><PpobPage \/><\/ProtectedRoute>\} \/>/, 'route /ppob terdaftar & wajib login');
assert.match(app, /<Route path="ppob\/pulsa-reguler" element=\{<ProtectedRoute><PpobPulsaRegulerPage \/><\/ProtectedRoute>\} \/>/, 'route /ppob/pulsa-reguler terdaftar & wajib login');
assert.match(app, /const PpobLayananPage = lazy\(\(\) => import\('\.\/pages\/PpobLayananPage'\)\);/, 'halaman Semua Layanan dimuat malas');
assert.match(app, /<Route path="ppob\/layanan" element=\{<ProtectedRoute><PpobLayananPage \/><\/ProtectedRoute>\} \/>/, 'route /ppob/layanan (grid semua layanan selain top up game) terdaftar & wajib login');
assert.ok(app.indexOf('path="ppob"') < app.indexOf('path=":slug"'), 'route PPOB didefinisikan sebelum catch-all :slug (struk)');

const menu = read('src/components/SideMenu.tsx');
assert.match(menu, /\| 'ppob';/, 'PageId ppob ada');
assert.match(menu, /ppob: '\/ppob',/, 'ROUTE_PATH ppob = /ppob');
assert.match(menu, /\{ id: 'ppob', icon: Zap, label: 'PPOB', desc: 'Pulsa, paket data, e-money & bayar tagihan' \},/, 'menu PPOB ada di baseMenu (side menu user)');
assert.match(menu, /\{ id: 'ppob' as const, icon: Zap, label: 'PPOB', desc: 'Pulsa, paket data, e-money & bayar tagihan', path: '\/ppob' \},/, 'menu PPOB juga ada di ADMIN_MENU');
assert.match(menu, /'overview', 'ppob'\];/, 'PPOB butuh login (AUTH_REQUIRED)');
assert.ok(menu.indexOf("label: 'Topup Game', desc: 'Top up game & produk digital' },") < menu.indexOf("label: 'PPOB'"), 'PPOB tepat setelah Topup Game di baseMenu');
assert.ok(menu.indexOf("...base.slice(0, 6),...authMenu,...base.slice(6)") > 0, 'urutan menu user: Order Nomor → Topup Game → PPOB → grup deposit');

/* ---------- 2. Data PPOB sebagai modul (deteksi operator, produk, helper) ---------- */
const { outputFiles: dataFiles } = await build({
  stdin: { contents: `export * from './src/data/ppob';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  define: { 'process.env.NODE_ENV': '"development"' },
});
const dataFile = path.join(dir, 'ppob-data.cjs');
writeFileSync(dataFile, dataFiles[0].text);
const data = require(dataFile);

assert.equal(data.detectOperator('081234567890').nama, 'Telkomsel', 'prefix 0812 → Telkomsel');
assert.equal(data.detectOperator('082212347543').id, 'telkomsel', 'prefix 0822 → Telkomsel');
assert.equal(data.detectOperator('+6285712345678').id, 'indosat', '+62 disamakan jadi 0 lalu 0857 → Indosat');
assert.equal(data.detectOperator('6281712345678').id, 'xl', '62817 → XL');
assert.equal(data.detectOperator('0895-1234-5678').id, 'tri', 'karakter non-angka diabaikan, 0895 → Tri');
assert.equal(data.detectOperator('088112345678').id, 'smartfren', '0881 → Smartfren');
assert.equal(data.detectOperator('081'), null, 'kurang dari 4 digit → belum terdeteksi');
assert.equal(data.detectOperator('0812').id, 'telkomsel', 'tepat 4 digit prefix sudah cukup untuk deteksi operator');
assert.equal(data.detectOperator('12345678'), null, 'nomor tanpa 0/62 di depan tidak ditebak');
assert.equal(data.PPOB_OPERATORS.length, 5, 'lima operator didukung');

const tsel = data.PPOB_PULSA_REGULER.telkomsel;
const cari = (n) => tsel.find((p) => p.nominal === n);
assert.equal(cari(1000).harga, 2025, 'Telkomsel 1.000 = Rp 2.025 (mock sesuai contoh)');
assert.equal(cari(1000).nama, 'Telkomsel 1.000', 'nama produk memakai pemisah ribuan titik');
assert.equal(cari(2000).harga, 3230, 'Telkomsel 2.000 = Rp 3.230');
assert.equal(cari(3000).harga, 4155, 'Telkomsel 3.000 = Rp 4.155');
assert.equal(cari(5000).harga, 5515, 'Telkomsel 5.000 = Rp 5.515');
assert.equal(cari(10000).harga, 10465, 'Telkomsel 10.000 = Rp 10.465');
assert.equal(cari(3000).tersedia, false, 'ada produk berstatus unavailable (badge abu-abu, tidak bisa diklik)');
for (const op of Object.keys(data.PPOB_PULSA_REGULER))
  assert.ok(data.PPOB_PULSA_REGULER[op].length >= 8, `daftar produk ${op} lengkap`);

// Card Menu Service tidak lagi mock: isinya layanan ASLI dari endpoint list produk
// penuh penyedia, difilter HANYA layanan selain top up game. Yang di data hanya
// layanan halaman lokal + tile "Lainnya" (grid semua layanan non-game).
assert.equal(data.PPOB_MENU_LOKAL.length, 1, 'satu layanan lokal dipatok di grid Menu Service');
assert.equal(data.PPOB_MENU_LOKAL[0].label, 'Pulsa Reguler', 'label layanan lokal');
assert.equal(data.PPOB_MENU_LOKAL[0].to, '/ppob/pulsa-reguler', 'klik "Pulsa Reguler" membuka Halaman B');
assert.equal(data.PPOB_MENU_LAINNYA.label, 'Lainnya', 'tile terakhir = Lainnya');
assert.equal(data.PPOB_MENU_LAINNYA.to, '/ppob/layanan', 'klik "Lainnya" membuka grid semua layanan selain top up game');
assert.equal(data.RUTE_LAYANAN_PPOB, '/ppob/layanan', 'rute halaman layanan diekspor (dipakai tile live + Lainnya)');
assert.ok(!('PPOB_MENU' in data), 'daftar layanan mock lama (termasuk tile top up game) sudah dilepas');
assert.ok(data.PPOB_MENU_LOKAL.every((m) => m.desc && m.desc.length > 10), 'tiap layanan punya deskripsi');
// Ikon tile layanan live dipilih dari kata kunci nama layanan/kategori.
assert.equal(data.ikonLayanan('Pulsa Telkomsel'), 'smartphone', 'layanan pulsa → ikon smartphone');
assert.equal(data.ikonLayanan('Paket Data XL'), 'wifi', 'paket data → ikon wifi');
assert.equal(data.ikonLayanan('OVO E-Money'), 'wallet', 'e-money → ikon dompet');
assert.equal(data.ikonLayanan('PLN Token Listrik'), 'receipt', 'token listrik/tagihan → ikon struk');
assert.equal(data.ikonLayanan('AIS'), 'globe', 'operator telekomunikasi luar → ikon globe');
assert.equal(data.ikonLayanan('TrueMove H'), 'globe', 'TrueMove H → ikon globe');
assert.equal(data.ikonLayanan('Voucher Netflix'), 'gamepad', 'voucher streaming → ikon voucher/game');
assert.equal(data.ikonLayanan('Entah Apa'), 'grid', 'label tak dikenal → ikon grid (netral)');

assert.equal(data.hargaPulsa(2025), 'Rp 2.025,-', 'format harga jual pulsa');
assert.equal(data.rupiahTitik(1000000), 'Rp 1.000.000', 'format Rupiah pemisah titik');
assert.equal(data.sapaanPpob(9), 'Good Morning', 'sapaan pagi');
assert.equal(data.sapaanPpob(13), 'Good Afternoon', 'sapaan siang');
assert.equal(data.sapaanPpob(17), 'Good Evening', 'sapaan sore');
assert.equal(data.sapaanPpob(22), 'Good Night', 'sapaan malam');
assert.equal(data.formatJamPpob(new Date(2026, 10, 28, 16, 57, 19)), '16:57:19 PM', 'jam real-time format HH:mm:ss + AM/PM');
assert.equal(data.formatJamPpob(new Date(2026, 10, 28, 9, 5, 7)), '09:05:07 AM', 'jam pagi memakai AM + nol di depan');
assert.equal(data.PPOB_PENGUMUMAN, 'Selamat datang, terima kasih sudah bergabung', 'teks marquee pengumuman');
assert.equal(data.PPOB_POINT_FALLBACK, 120, 'poin mock sebelum API tersambung');
assert.ok(data.PPOB_BANNERS.length >= 2 && data.PPOB_BANNERS.every((b) => b.sub.includes('{APP}')), 'banner promo memakai {APP} = nama brand website');
assert.ok(data.PPOB_BERITA.length >= 2 && data.PPOB_BERITA[0].kategori === 'INFO', 'section berita punya badge kategori INFO');

/* ---------- 3. Halaman A: Beranda PPOB ---------- */
const kepala = read('src/components/PpobHeader.tsx');
const layout = read('src/components/Layout.tsx');
assert.match(kepala, /sticky top-0 z-30/, 'header biru PPOB sticky di atas = header utama situs');
assert.match(kepala, /linear-gradient\(135deg,#3B82F6 0%,#2563EB 100%\)/, 'header gradient biru #3B82F6 → #2563EB');
assert.match(kepala, /rounded-b-\[32px\]/, 'sudut bawah header melengkung');
assert.match(kepala, /pb-8 pt-3/, 'padding bawah header secukupnya supaya body mulai di bawah header');
assert.match(kepala, /text-\[#F5B73B\]/, 'nama user kuning/emas');
assert.match(kepala, /sapaanPpob\(jam\.getHours\(\)\)/, 'sapaan dinamis sesuai jam');
assert.match(kepala, /<Bell[\s\S]{0,400}bg-rose-500/, 'ikon lonceng dengan titik merah notifikasi');
assert.match(kepala, /HamburgerToggle/, 'hamburger header lama pindah ke header biru');
assert.match(kepala, /BottomNavbar placement="header"/, 'ikon pengaturan/FAQ/musik/profil header lama pindah ke header biru');
assert.match(kepala, /to="\/playground"/, 'tombol Playground header lama pindah ke header biru');
assert.match(kepala, /md:max-w-3xl lg:max-w-5xl/, 'kontainer header melebar di tablet/desktop (responsif)');
assert.match(layout, /import PpobHeader from '\.\/PpobHeader';/, 'Layout memakai PpobHeader');
assert.match(layout, /pathname === '\/ppob' \|\| pathname\.startsWith\('\/ppob\/'\)/, 'header biru hanya tampil di rute PPOB');
assert.ok(layout.indexOf('<PpobHeader') < layout.indexOf('<Header '), 'di rute PPOB header glass situs diganti header biru');
const beranda = read('src/pages/PpobPage.tsx');
assert.ok(!beranda.includes('BottomNavbar'), 'TANPA bottom navigation bar');
assert.ok(!/QrCode|QrScan/.test(beranda), 'TANPA tombol scan QR melayang');
assert.match(beranda, /bg-\[#F4F6FB\] pb-\[100px\]/, 'latar #F4F6FB + padding bawah ±100px');
assert.match(beranda, /mx-auto w-full max-w-md px-4/, 'mobile-first 360–414px');
assert.ok(!beranda.includes('<header'), 'halaman tidak lagi merender header sendiri (header utama dari Layout)');
assert.match(beranda, /id="berita-ppob"/, 'section berita punya id untuk scroll tombol lonceng di header');
assert.match(beranda, /mt-4 rounded-\[20px\] bg-white p-4/, 'card saldo berada DI BAWAH header biru (body tidak tertutup header)');
assert.ok(!beranda.includes('-mt-10'), 'tidak ada margin negatif yang menyelipkan body PPOB ke bawah header');
assert.match(beranda, /md:max-w-3xl lg:max-w-5xl/, 'kontainer halaman melebar di desktop');
assert.match(beranda, /md:grid-cols-8/, 'Menu Service 4 kolom mobile → 8 kolom desktop');
assert.match(beranda, /IDR ••••••••••/, 'saldo tersamar default');
assert.match(beranda, /setLihatSaldo\(\(v\) => !v\)/, 'toggle mata berfungsi');
assert.match(beranda, /divide-x divide-slate-100/, 'dua kolom dipisah garis vertikal tipis');
assert.match(beranda, /<Coins[\s\S]{0,120}\{poin\}/, 'kolom Point dengan ikon koin');
for (const aksi of ['Transfer', 'Top up', 'Exchange'])
  assert.ok(beranda.includes(`label: '${aksi}'`), `aksi cepat ${aksi} ada`);
assert.match(beranda, /ppob-marquee/, 'banner info berjalan (marquee)');
assert.match(beranda, /prefers-reduced-motion/, 'marquee menghormati prefers-reduced-motion');
assert.match(beranda, /Menu Service/, 'chip label Menu Service');
assert.match(beranda, /grid grid-cols-4 gap-x-2 gap-y-3\.5 md:grid-cols-8/, 'grid 4 kolom mobile, 8 kolom desktop');
// Layanan di card Menu Service berasal dari endpoint list produk penuh (selain top up game).
assert.match(beranda, /import \{ tvLayanan, type TvLayananKelompok \} from '\.\.\/services\/tokovoucherApi';/, 'beranda PPOB menarik layanan dari proxy server');
assert.match(beranda, /const r = await tvLayanan\(\);/, 'layanan dimuat lewat tvLayanan()');
assert.match(beranda, /MAKS_LAYANAN_MENU = 6/, 'maks 6 layanan live di card Menu Service (sisanya lewat tile Lainnya)');
assert.match(beranda, /layananMenu\.map\(\(l\) =>/, 'tile layanan live dirender dari data server');
assert.match(beranda, /data-layanan=\{l\.id\}/, 'tiap tile layanan punya penanda id (bisa diuji/ditelusuri)');
assert.match(beranda, /navigate\(`\$\{RUTE_LAYANAN_PPOB\}\?grup=\$\{encodeURIComponent\(l\.id\)\}`\)/, 'klik tile layanan membuka layanannya di halaman Semua Layanan');
assert.match(beranda, /data-lainnya="true"/, 'tile Lainnya selalu ada di grid Menu Service');
assert.match(beranda, /ikonLayanan\(/, 'ikon tile layanan live dipilih dari kata kunci namanya');
assert.ok(!/streaming-game|Streaming & Game/.test(beranda), 'tile top up game TIDAK lagi tampil di card Menu Service PPOB');
assert.match(beranda, /Katalog penyedia belum mengirim layanan selain top up game/, 'state kosong jujur (tanpa daftar layanan karangan)');
assert.match(beranda, /Coba lagi/, 'galat layanan punya tombol Coba lagi');
assert.match(beranda, /Login ulang/, 'galat layanan punya tombol Login ulang');
assert.match(beranda, /Memuat layanan dari katalog penyedia/, 'state memuat layanan dijelaskan ke user');
assert.match(beranda, /h-11 w-11[\s\S]{0,80}rounded-2xl bg-\[#3B82F6\]/, 'kotak ikon rounded biru solid ±44px');
assert.match(beranda, /truncate text-center text-\[10\.5px\]/, 'label 1 baris dipotong … bila panjang');
assert.match(beranda, /snap-x snap-mandatory/, 'carousel banner bisa di-swipe');
assert.match(beranda, /scrollTo\(\{ left: i \*/, 'indikator titik banner bisa diklik');
assert.match(beranda, /News Updates/i, 'section NEWS UPDATES');
assert.match(beranda, /View All/i, 'link VIEW ALL');
assert.match(beranda, /settings\.brandName/, 'nama app dinamis (bukan hardcode "Kupedia")');
assert.match(beranda, /user\?\.balance/, 'saldo dari data user (siap disambung API)');

/* ---------- 4. Halaman B: Pulsa Reguler ---------- */
const pulsa = read('src/pages/PpobPulsaRegulerPage.tsx');
assert.ok(!pulsa.includes('BottomNavbar'), 'TANPA bottom navigation bar');
assert.ok(!/QrCode|QrScan/.test(pulsa), 'TANPA tombol scan QR');
assert.match(pulsa, /pb-\[120px\]/, 'padding bawah ±100px (ruang tombol sticky)');
assert.ok(!pulsa.includes('<header'), 'halaman pulsa tidak lagi merender header sendiri');
assert.match(kepala, /setInterval\(\(\) => setJam\(new Date\(\)\), 1000\)/, 'jam real-time update tiap detik (di header)');
assert.match(kepala, /formatJamPpob\(jam\)/, 'format jam HH:mm:ss AM/PM (di header)');
assert.match(kepala, /to="\/ppob"[\s\S]{0,200}rounded-full bg-white/, 'tombol kembali bulat putih di header varian pulsa');
assert.match(pulsa, /mt-4 rounded-\[20px\]/, 'card putih pulsa berada DI BAWAH header (tidak tertutup)');
assert.ok(!pulsa.includes('-mt-9'), 'tidak ada margin negatif yang menyelipkan body pulsa ke bawah header');
assert.match(pulsa, /md:grid-cols-3/, 'grid produk 2 kolom mobile → 3 kolom desktop');
assert.match(pulsa, />Pulsa Reguler</, 'judul card "Pulsa Reguler"');
assert.match(pulsa, /placeholder="08xx"/, 'input Nomor Tujuan placeholder 08xx');
assert.match(pulsa, /inputMode="numeric"/, 'input angka');
assert.match(pulsa, /detectOperator\(nomor\)/, 'deteksi operator otomatis dari nomor');
assert.match(pulsa, /backgroundColor: operator\.warna/, 'logo operator = placeholder teks berwarna merek');
assert.match(pulsa, /PPOB_PULSA_REGULER\[operator\.id\]/, 'daftar produk menyesuaikan operator terdeteksi');
assert.match(pulsa, /Pilih Layanan/, 'label "Pilih Layanan"');
assert.match(pulsa, /grid grid-cols-2 gap-3/, 'grid produk 2 kolom jarak 12px');
assert.match(pulsa, /p\.tersedia \? 'available' : 'unavailable'/, 'badge status available/unavailable');
assert.match(pulsa, /disabled=\{!p\.tersedia\}/, 'produk habis tidak bisa diklik');
assert.match(pulsa, /border-\[3px\] border-\[#3B82F6\] bg-\[#EFF6FF\]/, 'produk terpilih: border biru tebal + latar biru sangat muda');
assert.match(pulsa, /hargaPulsa\(p\.harga\)/, 'harga jual format "Rp 2.025,-"');
assert.match(pulsa, /function SkeletonProduk/, 'state loading berupa skeleton daftar produk');
assert.match(pulsa, /fixed inset-x-0 bottom-0 z-20/, 'tombol Beli Sekarang sticky di bawah (bukan navbar)');
assert.match(pulsa, /Beli Sekarang/, 'label tombol beli');
assert.match(pulsa, /\{terpilih \?/, 'tombol beli baru muncul setelah produk dipilih');
assert.match(pulsa, /saldo < terpilih\.harga/, 'saldo user dibandingkan dengan harga sebelum beli');
assert.match(pulsa, /Checkout PPOB belum tersambung ke penyedia/, 'tidak membuat pesanan palsu sebelum API tersambung');

/* ---------- 5. Perilaku menu (bundle SideMenu) ---------- */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.localStorage = dom.window.localStorage;
const { outputFiles: menuFiles } = await build({
  stdin: { contents: `export { getUserMenuItems, getAdminMenuItems } from './src/components/SideMenu';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.webp': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', __MUSIC_URL__: '""', 'import.meta.env': '{}' },
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
      : a.path === 'notif' ? 'export const useAdminNotifications=()=>({items:[],unread:0,refresh:()=>{},markRead:()=>{}});'
      : 'export const useAuth=()=>({user:null,isAdmin:false});', resolveDir: process.cwd() }));
  } }],
});
const menuFile = path.join(dir, 'menu.cjs'); writeFileSync(menuFile, menuFiles[0].text);
const { getUserMenuItems, getAdminMenuItems } = require(menuFile);
const ids = (arr) => arr.map((i) => i.id);

const userIn = getUserMenuItems(true, false, false);
const guest = getUserMenuItems(false, false, false);
const childIn = getUserMenuItems(true, false, true);
assert.ok(ids(userIn).includes('ppob'), 'menu PPOB tampil untuk user login');
assert.equal(ids(userIn).indexOf('ppob'), ids(userIn).indexOf('topup') + 1, 'PPOB tepat setelah Topup Game');
assert.equal(ids(userIn).indexOf('topup'), ids(userIn).indexOf('nokos') + 1, 'urutan lama tetap: Order Nomor → Topup Game');
assert.ok(!ids(guest).includes('ppob'), 'belum login: PPOB tersembunyi (butuh saldo & akun)');
assert.ok(ids(childIn).includes('ppob'), 'child panel juga melihat PPOB');
assert.equal(userIn.find((i) => i.id === 'ppob').label, 'PPOB');
assert.equal(userIn.find((i) => i.id === 'ppob').desc, 'Pulsa, paket data, e-money & bayar tagihan', 'deskripsi menu sesuai layanan PPOB');

const adminRoot = getAdminMenuItems(false);
assert.ok(ids(adminRoot).includes('ppob'), 'admin juga punya menu PPOB');
assert.deepEqual(ids(adminRoot).slice(0, 4), ['nokos', 'topup', 'cek-status', 'event'], 'urutan terkunci admin tidak berubah');
assert.equal(adminRoot.find((i) => i.id === 'ppob').path, '/ppob', 'menu admin membuka /ppob');

/* ---------- 6. Halaman profil: fitur lama tetap ada setelah rombak UI ---------- */
const profil = read('src/pages/ProfilPage.tsx');
assert.match(profil, /export function samarkanTengah\(nilai: string\): string/, 'helper penyamaran nomor telepon diekspor (bisa diuji)');
for (const fitur of ['<AvatarPicker />', '<OwnedTitles />', '<TikTokAnalytics />', '<PengaturanAkunPage embedded />', 'onClick={logout}', 'copyId'])
  assert.ok(profil.includes(fitur), `fitur profil lama dipertahankan: ${fitur}`);
assert.match(profil, /orders\.filter\(\(o\) => o\.status !== 'batal'\)/, 'Pengeluaran = total pesanan yang tidak batal');
const pengaturan = read('src/pages/PengaturanAkunPage.tsx');
for (const fn of ['changePassword', 'requestEmailOtp', 'verifyOtp', 'saveProfile'])
  assert.ok(pengaturan.includes(fn), `fungsi pengaturan akun tetap ada: ${fn}`);

/* ---------- 7. Render sungguhan (SSR) — halaman tidak crash & isinya benar ---------- */
const { outputFiles: renderFiles } = await build({
  stdin: { contents: `
    export { default as PpobHeader } from './src/components/PpobHeader';
    export { default as PpobPage } from './src/pages/PpobPage';
    export { default as PulsaPage } from './src/pages/PpobPulsaRegulerPage';
    export { default as ProfilPage, samarkanTengah } from './src/pages/ProfilPage';
    export { MemoryRouter } from 'react-router-dom';
    export { createElement } from 'react';
    export { renderToStaticMarkup } from 'react-dom/server';
  `, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.webp': 'dataurl', '.glb': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', __MUSIC_URL__: '""', 'import.meta.env': '{}' },
  plugins: [{ name: 'mocks-render', setup(b) {
    const MAP = [
      [/context\/AuthContext$/, 'auth', `export const useAuth=()=>({user:{id:7,name:'Melvi Husin',username:'melvi',email:'melvi@contoh.com',phone:'082212347543',joined:'2025-01-01',balance:1250000,role:'user',plusActive:false,plan:{plus:false,extra_active:false,promo_available:false,price_plus:0,price_extra:0,price_extra_first:0,child_panel:null}},isAdmin:false,logout:()=>{}});`],
      [/context\/OrderHistoryContext$/, 'hist', `export const useOrderHistory=()=>({orders:[{key:'a',serviceName:'IG Followers',orderId:'1',quantity:100,price:25000,createdAt:Date.now(),status:'selesai'},{key:'b',serviceName:'TikTok Likes',orderId:'2',quantity:50,price:15000,createdAt:Date.now(),status:'batal'}],addOrder:()=>{}});`],
      [/context\/SiteSettingsContext$/, 'set', `export const useSiteSettings=()=>({settings:{brandName:'Boosteryuk'},tenant:null});`],
      [/components\/Seo$/, 'seo', 'export default function Seo(){return null;}'],
      [/UserAvatar$/, 'ava', 'export default function UserAvatar({children}){return children;}'],
      [/BottomNavbar$/, 'bnb', 'export default function BottomNavbar(){return null;}'],
      [/HamburgerToggle$/, 'hbt', 'export default function HamburgerToggle(){return null;}'],
      [/components\/AvatarPicker$/, 'avp', 'export default function AvatarPicker(){return null;}'],
      [/components\/OwnedTitles$/, 'owt', 'export default function OwnedTitles(){return null;}'],
      [/components\/TikTokAnalytics$/, 'tka', 'export default function TikTokAnalytics(){return null;}'],
      [/pages\/PengaturanAkunPage$/, 'pak', 'export default function PengaturanAkunPage(){return null;}'],
    ];
    for (const [filter, key] of MAP) b.onResolve({ filter }, () => ({ path: key, namespace: 'mock' }));
    b.onLoad({ filter: /.*/, namespace: 'mock' }, (x) => {
      const hit = MAP.find(([, key]) => key === x.path);
      return { contents: hit ? hit[2] : 'export default function Stub(){return null;}', resolveDir: process.cwd() };
    });
  } }],
});
const renderFile = path.join(dir, 'render.cjs'); writeFileSync(renderFile, renderFiles[0].text);
const R = require(renderFile);
const h = R.createElement;
const render = (route, Page) => R.renderToStaticMarkup(h(R.MemoryRouter, { initialEntries: [route] }, h(Page)));

assert.equal(R.samarkanTengah('082212347543'), '0822••••7543', 'nomor telepon disamarkan 0822••••7543');
assert.equal(R.samarkanTengah(''), '', 'tanpa nomor → string kosong (UI fallback ke @username)');

const htmlProfil = render('/profil', R.ProfilPage);
for (const t of ['Akun Saya', 'Pemasukan', 'Pengeluaran', '0822••••7543', 'Melvi Husin', 'Rp 1.250.000', 'Rp 25.000', 'Kartu Saya', 'Tukar Poin', 'Versi App', '6.1.4', 'Isi saldo', 'Keluar'])
  assert.ok(htmlProfil.includes(t), `profil merender "${t}"`);
assert.ok(!htmlProfil.includes('Rp 15.000'), 'pesanan batal tidak dihitung sebagai pengeluaran');

const kepalaRender = (variant) =>
  R.renderToStaticMarkup(h(R.MemoryRouter, { initialEntries: ['/ppob'] }, h(R.PpobHeader, { variant, onToggleMenu: () => {}, menuOpen: false })));
const htmlKepala = kepalaRender('beranda');
for (const t of ['Melvi Husin', 'PPOB', 'linear-gradient(135deg,#3B82F6 0%,#2563EB 100%)'])
  assert.ok(htmlKepala.includes(t), `header biru merender "${t}"`);
assert.match(htmlKepala, /Good (Morning|Afternoon|Evening|Night)/, 'sapaan dinamis sesuai jam di header');
const htmlKepalaPulsa = kepalaRender('pulsa');
assert.match(htmlKepalaPulsa, /\d{1,2}:\d{2}:\d{2} (AM|PM)/, 'jam real-time HH:mm:ss AM/PM di header pulsa');
assert.ok(htmlKepalaPulsa.includes('Kembali ke beranda PPOB'), 'tombol kembali di header pulsa');
assert.ok(!htmlKepalaPulsa.includes('Berita & pengumuman'), 'lonceng hanya di header beranda');

const htmlPpob = render('/ppob', R.PpobPage);
for (const t of ['Balance:', 'IDR ••••••••••', 'Point', '120', 'Transfer', 'Top up', 'Exchange', 'Menu Service', 'Pulsa Reguler', 'Lainnya', 'Memuat layanan dari katalog penyedia', 'Selamat datang', 'BAYAR TAGIHANMU', 'HANYA DI Boosteryuk', 'News Updates', 'View All'])
  assert.ok(htmlPpob.includes(t), `beranda PPOB merender "${t}"`);
// Layanan selain top up game datang dari server: sebelum data tiba yang tampil
// skeleton + keterangan memuat, bukan daftar mock.
for (const t of ['Pulsa Internasional', 'Streaming & Game', 'Paket Data'])
  assert.ok(!htmlPpob.includes(`>${t}<`), `layanan mock lama "${t}" tidak lagi dirender di Menu Service`);
assert.match(htmlPpob, /data-lainnya="true"/, 'tile Lainnya dirender sebagai pintu masuk grid semua layanan');
assert.ok(!htmlPpob.includes('<header'), 'beranda PPOB tidak merender header sendiri (pakai header utama dari Layout)');

const htmlPulsa = render('/ppob/pulsa-reguler', R.PulsaPage);
for (const t of ['Pulsa Reguler', 'Nomor Tujuan', '08xx', 'Pilih Layanan', 'Masukkan nomor tujuan'])
  assert.ok(htmlPulsa.includes(t), `halaman pulsa merender "${t}"`);
assert.ok(!htmlPulsa.includes('Beli Sekarang'), 'tombol Beli Sekarang belum muncul sebelum produk dipilih');

console.log('PASS PPOB: menu + rute /ppob, /ppob/pulsa-reguler & /ppob/layanan, data mock teruji (deteksi operator, produk, format Rupiah, jam, sapaan); header biru PPOB menjadi HEADER UTAMA situs di rute PPOB (ikon header lama pindah, sticky, responsif mobile+desktop), Beranda PPOB (saldo+point, marquee, Menu Service 4/8 kolom, carousel, News Updates) dan Pulsa Reguler (jam real-time di header, deteksi operator, grid 2/3 kolom available/unavailable, skeleton, tombol Beli sticky) tanpa bottom navbar/scan QR; halaman profil dirombak mobile-first tanpa menghapus fitur lama.');
