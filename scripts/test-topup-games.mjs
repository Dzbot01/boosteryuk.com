// Halaman + menu "TopUp All Game": marketplace top up game & produk digital.
//  • UI sesuai spesifikasi: latar #E5E5E7 + pola gamepad, tab pill (aktif navy #14143C),
//    search rounded-full, grid 3/4/6/8 kolom, kartu hover terangkat, skeleton, state kosong;
//  • data 16 game dummy dalam array terpisah (mudah diganti data asli);
//  • halaman detail /topup/:slug dengan form Player ID/Server ID + pilih produk;
//  • integrasi penyedia lewat proxy SERVER php-api/tokovoucher.php — signature
//    MD5(user_code:secret:ref_id) dihitung di server, secret tidak pernah ke browser.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-topup-games.mjs
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

const read = (f) => readFileSync(f, 'utf8');

/* ---------- 1. Menu & route ---------- */
const app = read('src/App.tsx');
assert.match(app, /<Route path="topup" element=\{<TopupGamePage \/>} \/>/, 'route /topup terdaftar');
assert.match(app, /<Route path="topup\/:slug" element=\{<TopupGameDetailPage \/>} \/>/, 'route detail /topup/:slug terdaftar');
assert.match(app, /const TopupGamePage = lazy\(\(\) => import\('\.\/pages\/TopupGamePage'\)\);/, 'halaman dimuat malas (tidak membebani bundle awal)');
const menu = read('src/components/SideMenu.tsx');
assert.match(menu, /\| 'topup';/, 'PageId topup ada');
assert.match(menu, /topup: '\/topup',/, 'ROUTE_PATH topup = /topup');
assert.match(menu, /\{ id: 'topup', icon: Gamepad2, label: 'TopUp All Game', desc: 'Top up game & produk digital' \},/, 'menu "TopUp All Game" ada di SideMenu');
assert.match(menu, /Gamepad2,/, 'ikon Gamepad2 diimpor');

/* ---------- 2. Halaman marketplace: spesifikasi UI ---------- */
const page = read('src/pages/TopupGamePage.tsx');
assert.match(page, /backgroundColor: '#e5e5e7'/, 'latar halaman #E5E5E7');
assert.match(page, /data:image\/svg\+xml/, 'pola watermark gamepad (SVG inline, tanpa request eksternal)');
for (const c of ['Topup', 'Voucher', 'Pulsa', 'Join Reseller', 'Token Listrik', 'Paket Data', 'Voucher Data', 'Telpon & SMS', 'Inject Voucher']) {
  assert.ok(read('src/data/topupGames.ts').includes(`'${c}'`), `kategori "${c}" ada di data`);
}
assert.match(page, /bg-\[#14143c\] font-bold text-white/, 'tab aktif navy gelap + teks putih bold');
assert.match(page, /bg-white font-medium text-slate-700/, 'tab non-aktif putih');
assert.match(page, /rounded-full px-6/, 'tab pill rounded-full padding horizontal ±24px');
assert.match(page, /md:h-\[54px\]/, 'tinggi tab ±54px di desktop');
assert.match(page, /overflow-x-auto/, 'baris tab bisa di-scroll horizontal');
assert.match(page, /\[scrollbar-width:none\] \[&::-webkit-scrollbar\]:hidden/, 'scrollbar baris tab disembunyikan');
assert.match(page, /bg-gradient-to-l from-\[#e5e5e7\]/, 'fade gradient di ujung kanan baris tab');
assert.match(page, /aria-label="Geser daftar kategori ke kanan"/, 'tombol panah bulat untuk menggeser tab');
assert.match(page, /scrollBy\(\{ left: 260, behavior: 'smooth' \}\)/, 'panah menggeser scroll tab ke kanan');
assert.match(page, /placeholder="Cari game di semua kategori\.\.\."/, 'placeholder search sesuai spesifikasi');
assert.match(page, /rounded-full border border-slate-200 bg-white pl-11/, 'search bar rounded-full putih ber-border + ikon kaca');
assert.match(page, /grid grid-cols-3 items-stretch gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-6 xl:gap-6 2xl:grid-cols-8/, 'grid 3/4/6/8 kolom responsif + items-stretch');
assert.match(page, /hover:-translate-y-1 hover:shadow-lg/, 'hover: kartu naik + shadow membesar');
assert.match(page, /duration-200/, 'transisi hover 200ms');
assert.match(page, /aspect-square w-full overflow-hidden rounded-xl/, 'thumbnail persegi rounded-xl');
assert.match(page, /bg-gradient-to-t from-\[#14143c\]/, 'overlay gradasi navy di bawah thumbnail (tempat nama game)');
assert.match(page, /text-\[13px\] leading-snug text-slate-800 md:text-\[18px\]/, 'nama game 13px mobile / 18px desktop, rata tengah');
assert.match(page, /Game tidak ditemukan/, 'state kosong "Game tidak ditemukan"');
assert.match(page, /animate-pulse/, 'skeleton loading kartu');
assert.match(page, /window\.setTimeout\(\(\) => setLoading\(false\), 420\)/, 'skeleton hanya sebentar (~0,4 detik)');
assert.match(page, /to=\{`\/topup\/\$\{it\.slug\}`\}/, 'klik kartu membuka /topup/{slug}');
assert.match(page, /max-w-\[1900px\]/, 'container maks ±1900px');

/* ---------- 3. Data dummy & helper (fungsional) ---------- */
const dir = mkdtempSync(path.join(tmpdir(), 'topup-games-'));
const { outputFiles } = await build({
  stdin: { contents: `export {TOPUP_GAMES, TOPUP_CATEGORIES, slugify, filterByName} from './src/data/topupGames';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
});
const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
const { TOPUP_GAMES, TOPUP_CATEGORIES, slugify, filterByName } = require(file);

assert.equal(TOPUP_CATEGORIES.length, 9, 'sembilan tab kategori');
assert.equal(TOPUP_GAMES.length, 16, '16 kartu game dummy');
const nama = TOPUP_GAMES.map((g) => g.nama);
for (const n of ['Free Fire', 'Mobile Legends', 'Hago', 'PUBG Mobile', 'Honor of Kings', 'Genshin Impact', 'Garena Undawn', 'Point Blank', 'Call of Duty Mobile', 'Blood Strike', 'Honkai Star Rail', 'Metal Slug : Awakening', 'Magic Chess GO GO', 'Farlight 84', 'Moonlight Blade M', 'Zenless Zone Zero']) {
  assert.ok(nama.includes(n), `game "${n}" ada`);
}
assert.ok(TOPUP_GAMES.every((g) => g.slug === slugify(g.nama) || g.slug.length > 2), 'slug terisi untuk semua game');
assert.ok(TOPUP_GAMES.every((g) => Array.isArray(g.produk) && g.produk.length > 0 && g.produk.every((p) => p.kode && p.harga > 0)), 'tiap game punya produk dengan kode & harga');
assert.equal(slugify('Metal Slug : Awakening'), 'metal-slug-awakening', 'slugify membuang titik dua & spasi');
assert.equal(slugify('Zenless Zone Zero'), 'zenless-zone-zero', 'slugify huruf kecil semua');
assert.equal(filterByName(TOPUP_GAMES, '').length, 16, 'pencarian kosong = semua game');
assert.equal(filterByName(TOPUP_GAMES, 'mobile').length, 3, 'filter "mobile" => PUBG Mobile, Call of Duty Mobile, Mobile Legends');
assert.equal(filterByName(TOPUP_GAMES, 'GENSHIN').length, 1, 'filter case-insensitive');
assert.equal(filterByName(TOPUP_GAMES, 'zzz').length, 0, 'filter tanpa hasil => state kosong');

/* ---------- 4. Halaman detail + layanan + keamanan integrasi ---------- */
const detail = read('src/pages/TopupGameDetailPage.tsx');
assert.match(detail, /Player ID \/ User ID/, 'form Player ID ada');
assert.match(detail, /Server ID/, 'form Server ID ada (produk yang membutuhkannya)');
assert.match(detail, /produk\.butuhServer/, 'Server ID hanya tampil bila produk memerlukannya');
assert.match(detail, /tvTransaksi\(\{ player_id: playerId\.trim\(\), server_id: serverId\.trim\(\), kode_produk: produk\.kode \}\)/, 'pesanan dikirim lewat layanan proxy');
assert.match(detail, /Silakan login dulu untuk memesan top up\./, 'pesan wajib login sebelum memesan');
assert.match(detail, /tokovoucher_config\.php/, 'notice bila integrasi belum dikonfigurasi di server');
const svc = read('src/services/tokovoucherApi.ts');
assert.match(svc, /const API = `\$\{MAIN_API\}\/tokovoucher\.php`;/, 'frontend memanggil proxy PHP, bukan API penyedia langsung');
assert.ok(!/secret\s*:/.test(svc), 'payload frontend tidak pernah memuat field secret');
assert.ok(!/md5\(/i.test(svc) && !/signature\s*=/.test(svc), 'signature tidak dihitung di browser');

const php = read('php-api/tokovoucher.php');
assert.match(php, /\$sig = md5\(\$c\['user_code'\] \. ':' \. \$c\['secret'\] \. ':' \. \$ref\);/, 'signature = MD5(USER_CODE:SECRET:REF_ID) dihitung di server');
assert.match(php, /is_file\(__DIR__ \. '\/tokovoucher_config\.php'\)/, 'secret dibaca dari file config server (tidak di-commit)');
assert.match(php, /cp_user_id\(\$conn, \(string\)\(\$in\['token'\] \?\? ''\)\)/, 'transaksi wajib token login valid');
assert.match(php, /curl_init\(rtrim\(\$c\['base_url'\], '\/'\) \. '\/transaksi'\)/, 'memanggil endpoint transaksi penyedia');
assert.match(php, /'base_url'  => 'https:\/\/api\.tokovoucher\.me\/v1',/, 'base URL penyedia sesuai dokumentasi');
assert.match(php, /unset\(\$j\['signature'\], \$j\['secret'\], \$j\['api_key'\], \$j\['user_code'\]\);/, 'field sensitif dibuang sebelum dibalas ke browser');
assert.match(php, /\$ref = 'BY' \. date\('ymdHis'\) \. random_int\(1000, 9999\);/, 'ref_id unik dibuat server');
assert.ok(existsSync('php-api/tokovoucher_config.example.php'), 'contoh config tersedia untuk server');
const gi = read('.gitignore');
assert.match(gi, /php-api\/tokovoucher_config\.php/, 'config rahasia di-gitignore');
assert.match(gi, /php-api\/tokovoucher_log\.txt/, 'log transaksi di-gitignore');
assert.ok(!read('php-api/tokovoucher_config.example.php').includes("'secret'    => 'U"), 'contoh config tidak menyertakan secret asli');

/* ---------- 5. Menu benar-benar ter-render untuk SEMUA peran (bundle SideMenu) ---------- */
// Admin: daftar "Navigasi" (menu user) disembunyikan seluruhnya, jadi entri topup juga harus
// ada di ADMIN_MENU — kalau tidak, admin tidak pernah melihat menu TopUp All Game.
assert.match(menu, /\{ id: 'topup' as const, icon: Gamepad2, label: 'TopUp All Game', desc: 'Top up game & produk digital', path: '\/topup' \},/, 'ADMIN_MENU juga punya TopUp All Game (path /topup)');
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
const guest = getUserMenuItems(false, false, false);      // belum login, root domain
const userIn = getUserMenuItems(true, false, false);      // user login, root domain
const childIn = getUserMenuItems(true, false, true);      // user login, child panel
assert.ok(ids(guest).includes('topup'), 'menu TopUp All Game tampil untuk pengunjung (belum login)');
assert.ok(ids(userIn).includes('topup'), 'menu TopUp All Game tampil untuk user login');
assert.ok(ids(childIn).includes('topup'), 'menu TopUp All Game tampil di child panel');
// Posisi: di baseMenu topup tepat setelah "Buat Pesanan" (layanan). Untuk user login, "Buat Pesanan"
// & "Order Nomor" berada di depan grup deposit sehingga topup mengikuti "Order Nomor"; untuk
// pengunjung (belum login) layanan/nokos tersembunyi sehingga topup langsung setelah Dashboard.
assert.equal(ids(userIn).indexOf('topup'), ids(userIn).indexOf('nokos') + 1, 'user login: tepat setelah "Order Nomor" (grup Buat Pesanan)');
assert.equal(ids(guest).indexOf('topup'), ids(guest).indexOf('home') + 1, 'pengunjung: item pertama setelah Dashboard');
assert.equal(ids(childIn).indexOf('topup'), ids(childIn).indexOf('nokos') + 1, 'child panel: urutan sama dengan root domain');
const topupGuest = guest.find((i) => i.id === 'topup');
assert.equal(topupGuest.label, 'TopUp All Game', 'label menu sesuai permintaan');
assert.equal(topupGuest.desc, 'Top up game & produk digital');
const adminRoot = getAdminMenuItems(false);
const adminChild = getAdminMenuItems(true);
assert.ok(ids(adminRoot).includes('topup'), 'ADMIN juga melihat menu TopUp All Game di side menu');
assert.ok(ids(adminChild).includes('topup'), 'pemilik child panel (admin ke-2) juga melihatnya');
const topupAdmin = adminRoot.find((i) => i.id === 'topup');
assert.equal(topupAdmin.path, '/topup', 'menu admin membuka /topup');
assert.equal(topupAdmin.label, 'TopUp All Game');
assert.ok(!ids(getUserMenuItems(true, true, false)).length, 'admin memang tidak merender daftar menu user (karena itu entri ADMIN_MENU wajib ada)');

console.log('PASS TopUp All Game: menu tampil untuk pengunjung/user/child panel DAN admin (ADMIN_MENU) + route /topup & /topup/:slug, UI marketplace sesuai spesifikasi (latar #E5E5E7 berpola, tab pill navy, search realtime, grid 3/4/6/8, skeleton, state kosong), 16 game dummy + helper teruji, halaman detail dengan Player/Server ID, dan transaksi lewat proxy server (signature MD5 user_code:secret:ref_id dihitung di server, secret tidak pernah ke browser).');
process.exit(0);
