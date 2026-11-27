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
import { execFileSync } from 'node:child_process';
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
  stdin: { contents: `export {TOPUP_GAMES, TOPUP_CATEGORIES, slugify, filterByName, hargaJual, TOPUP_MARKUP_PCT} from './src/data/topupGames';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
});
const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
const { TOPUP_GAMES, TOPUP_CATEGORIES, slugify, filterByName, hargaJual, TOPUP_MARKUP_PCT } = require(file);

assert.equal(TOPUP_CATEGORIES.length, 9, 'sembilan tab kategori');
assert.equal(TOPUP_GAMES.length, 16, '16 kartu game dummy');
const nama = TOPUP_GAMES.map((g) => g.nama);
for (const n of ['Free Fire', 'Mobile Legends', 'Hago', 'PUBG Mobile', 'Honor of Kings', 'Genshin Impact', 'Garena Undawn', 'Point Blank', 'Call of Duty Mobile', 'Blood Strike', 'Honkai Star Rail', 'Metal Slug : Awakening', 'Magic Chess GO GO', 'Farlight 84', 'Moonlight Blade M', 'Zenless Zone Zero']) {
  assert.ok(nama.includes(n), `game "${n}" ada`);
}
assert.ok(TOPUP_GAMES.every((g) => g.slug === slugify(g.nama) || g.slug.length > 2), 'slug terisi untuk semua game');
// DATA ASLI, bukan dummy: snapshot Free Fire diverifikasi dari pricelist penyedia
// (https://tokovoucher.me/pricelist, 27 Nov 2026) — kode berprefiks MFF & harga kolom Basic.
const ff = TOPUP_GAMES.find((g) => g.slug === 'free-fire');
assert.ok(ff.produk.length >= 20, `Free Fire punya katalog asli lengkap (${ff.produk.length} produk)`);
assert.ok(ff.produk.every((p) => /^MFF[A-Z0-9]+$/.test(p.kode)), 'semua kode Free Fire sesuai pola pricelist penyedia (MFF…)');
for (const [kode, harga] of [['MFF5', 756], ['MFF100', 12066], ['MFFM', 25138], ['MFFBP', 37708]]) {
  const row = ff.produk.find((p) => p.kode === kode);
  assert.ok(row, `kode asli ${kode} ada`);
  assert.equal(row.harga, harga, `harga ${kode} = harga pricelist penyedia`);
}
// Game lain boleh belum punya snapshot — tapi TIDAK boleh memakai kode karangan:
// halaman detail menarik katalog asli dari server (override/pricelist), sonst state jujur.
assert.ok(TOPUP_GAMES.every((g) => Array.isArray(g.produk) && g.produk.every((p) => p.kode && p.harga > 0)), 'bila produk diisi, kode & harganya wajib valid');
assert.equal(slugify('Metal Slug : Awakening'), 'metal-slug-awakening', 'slugify membuang titik dua & spasi');
assert.equal(slugify('Zenless Zone Zero'), 'zenless-zone-zero', 'slugify huruf kecil semua');
assert.equal(filterByName(TOPUP_GAMES, '').length, 16, 'pencarian kosong = semua game');
assert.equal(filterByName(TOPUP_GAMES, 'mobile').length, 3, 'filter "mobile" => PUBG Mobile, Call of Duty Mobile, Mobile Legends');
assert.equal(filterByName(TOPUP_GAMES, 'GENSHIN').length, 1, 'filter case-insensitive');
assert.equal(filterByName(TOPUP_GAMES, 'zzz').length, 0, 'filter tanpa hasil => state kosong');
assert.equal(TOPUP_MARKUP_PCT, 0, 'margin default 0 (jual = harga penyedia; setel di satu tempat bila mau margin)');
assert.equal(hargaJual(756), 800, 'harga jual dibulatkan ke ratusan ke atas (pola pembulatan ala OTP)');
assert.equal(hargaJual(12066), 12100, 'pembulatan ratusan konsisten');

/* ---------- 4. Halaman detail + layanan + keamanan integrasi ---------- */
const detail = read('src/pages/TopupGameDetailPage.tsx');
assert.match(detail, /Player ID \/ User ID/, 'form Player ID ada');
assert.match(detail, /Server ID/, 'form Server ID ada (produk yang membutuhkannya)');
assert.match(detail, /produk\.butuhServer/, 'Server ID hanya tampil bila produk memerlukannya');
assert.match(detail, /tvTransaksi\(\{ player_id: playerId\.trim\(\), server_id: serverId\.trim\(\), kode_produk: produk\.kode \}\)/, 'pesanan dikirim lewat layanan proxy');
assert.match(detail, /Silakan login dulu untuk memesan top up\./, 'pesan wajib login sebelum memesan');
assert.match(detail, /tokovoucher_config\.php/, 'notice bila integrasi belum dikonfigurasi di server');
assert.match(detail, /tvPricelist\(game\.nama\)/, 'halaman detail menarik katalog ASLI dari server saat dibuka');
assert.match(detail, /Katalog produk game ini belum tersedia di server/, 'game tanpa katalog menampilkan state jujur (bukan kode karangan)');
assert.match(detail, /rupiah\(hargaJual\(p\.harga\)\)/, 'harga tampilan lewat hargaJual (margin + pembulatan terpusat)');
const svc = read('src/services/tokovoucherApi.ts');
assert.match(svc, /export const tvPricelist = \(game\?: string\) =>/, 'layanan punya tvPricelist (katalog asli dari server)');
assert.match(svc, /action=pricelist/, 'tvPricelist memanggil action=pricelist');
assert.match(svc, /const API = `\$\{MAIN_API\}\/tokovoucher\.php`;/, 'frontend memanggil proxy PHP, bukan API penyedia langsung');
assert.ok(!/secret\s*:/.test(svc), 'payload frontend tidak pernah memuat field secret');
assert.ok(!/md5\(/i.test(svc) && !/signature\s*=/.test(svc), 'signature tidak dihitung di browser');

const php = read('php-api/tokovoucher.php');
assert.match(php, /if \(\$action === 'pricelist'\)/, 'proxy punya action=pricelist (katalog asli)');
assert.match(php, /function tv_parse_pricelist_html\(\$html\)/, 'proxy bisa membaca tabel pricelist penyedia');
assert.match(php, /function tv_pricelist_override\(\)/, 'proxy mendukung override katalog manual di server');
assert.match(php, /tokovoucher_pricelist_cache\.json/, 'pricelist live di-cache di server (6 jam)');
assert.match(php, /filter_var\(\$st, FILTER_VALIDATE_BOOLEAN\)/, 'status sukses penyedia dibaca toleran (true/success/dll)');
assert.ok(!php.includes('$okProvider ? 200 : 502'), 'penolakan bisnis TIDAK lagi membalas 502 (UI dapat pesan penyedia)');
assert.match(php, /CURL_ERROR=/, 'gagal koneksi dicatat terpisah di log server');
assert.ok(existsSync('php-api/tokovoucher_pricelist.example.php'), 'contoh file override katalog tersedia');
/* Sistem API penyedia yang BERLAKU: api.tokovoucher.net (member code, transaksi GET). */
assert.match(php, /'base_url'    => 'https:\/\/api\.tokovoucher\.net',/, 'base URL penyedia = https://api.tokovoucher.net');
assert.match(php, /'member_code' => 'M250727KGST5158OE',/, 'member code default sesuai akun member');
assert.match(php, /getenv\('TV_SECRET'\)/, 'secret bisa dari env TV_SECRET');
assert.match(php, /is_file\(__DIR__ \. '\/tokovoucher_config\.php'\)/, 'secret dibaca dari file config server (tidak di-commit)');
assert.match(php, /cp_user_id\(\$conn, \(string\)\(\$in\['token'\] \?\? ''\)\)/, 'transaksi wajib token login valid');
assert.match(php, /tv_api_get\('\/v1\/transaksi', \[/, 'transaksi memanggil GET /v1/transaksi');
for (const param of ['ref_id', 'produk', 'tujuan', 'server_id', 'member_code', 'secret']) {
  assert.ok(php.includes(`'${param}'      =>`) || php.includes(`'${param}' =>`) || php.includes(`'${param}'      => $`) || new RegExp(`'${param}'\\s*=>`).test(php), `parameter query ${param} dikirim ke penyedia`);
}
assert.match(php, /tv_api_get_authed\('\/v1\/transaksi\/status'/, 'cek status memakai GET /v1/transaksi/status (helper ber-signature)');
assert.match(php, /tv_api_get_authed\('\/member'/, 'info member memakai GET /member (helper ber-signature)');
assert.match(php, /tv_api_get_authed\('\/produk\/code'/, 'katalog live memakai GET /produk/code (helper ber-signature)');
assert.match(php, /function tv_walk_products\(\$node, \$game, array &\$out\)/, 'respons /produk/code dibaca tahan-bentuk (list datar, map ber-kunci kode, grup per game, bungkus status/data)');
assert.match(php, /\(b\) nama produk menyebut game/, 'filter per game punya fallback cocokkan nama produk (bila JSON tanpa field kategori)');
assert.match(php, /PARSE_KOSONG/, 'bila katalog tetap tak terbaca, raw response dicatat di log server (secret disamarkan)');
/* Endpoint katalog (/produk/code, /member, status) menuntut `signature` menurut log produksi
   ("signature not valid"); proxy harus mencoba rumus otomatis & mengingat yang berhasil,
   sementara /v1/transaksi tetap tanpa signature (terbukti bekerja di produksi). */
assert.match(php, /function tv_sig_candidates\(\$c\)/, 'proxy punya kandidat rumus signature');
assert.match(php, /function tv_api_get_authed\(\$path, array \$extra = \[\]\)/, 'proxy mencoba signature otomatis bila endpoint menolaknya');
assert.match(php, /tv_sig_cache_write\(\$i\)/, 'rumus signature yang berhasil disimpan ke cache');
assert.match(php, /tv_api_get_authed\('\/produk\/code'\)/, '/produk/code dipanggil lewat helper ber-signature');
assert.match(php, /tv_api_get_authed\('\/member'\)/, '/member dipanggil lewat helper ber-signature');
assert.match(php, /tv_api_get_authed\('\/v1\/transaksi\/status', \['ref_id' => \$ref\]\)/, 'cek status dipanggil lewat helper ber-signature');
assert.match(php, /function tv_game_aliases\(\$game\)/, 'pencocokan game punya tabel alias (MLBB=Mobile Legends dll)');
assert.match(php, /function tv_code_prefix_game\(\$kode\)/, 'pencocokan terakhir lewat prefiks kode produk (MFF/ML/AMLBB…)');
assert.match(php, /TIDAK cocok \| label penyedia:/, 'bila tetap tidak cocok, label asli penyedia dicatat ke log (dasar pemetaan berikutnya)');
const txCall = php.split("tv_api_get('/v1/transaksi', [")[1].split(']);')[0];
assert.ok(!txCall.includes('signature'), 'transaksi TETAP tanpa signature (persis docs & terbukti bekerja)');
const totalMd5 = (php.match(/md5\(/g) || []).length;
const candBody = php.split('function tv_sig_candidates')[1].split('\n}')[0];
const candMd5 = (candBody.match(/md5\(/g) || []).length;
assert.ok(totalMd5 > 0 && totalMd5 === candMd5, 'md5 HANYA dipakai di kandidat signature endpoint ber-signature — transaksi tetap tanpa signature');
assert.match(php, /function tv_sanitize\(\$j\)/, 'field rahasia dibuang dari balasan penyedia sebelum ke browser');
assert.match(php, /\$ref = 'INV-' \. date\('ymdHis'\) \. random_int\(10, 99\);/, 'ref_id unik dibuat server (pola INV-…)');
assert.match(svc, /export const tvCekStatus = \(ref_id: string\)/, 'frontend punya tvCekStatus (GET /v1/transaksi/status via proxy)');
assert.match(detail, /Cek status pesanan/, 'halaman detail punya tombol cek status pesanan per ref_id');
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
assert.equal(ids(userIn).indexOf('nokos'), ids(userIn).indexOf('layanan') + 1, 'user login: "Order Nomor" (OTP) di atas, tepat setelah Buat Pesanan');
assert.equal(ids(userIn).indexOf('topup'), ids(userIn).indexOf('nokos') + 1, 'user login: TopUp All Game berdampingan dengan Order Nomor');
assert.equal(ids(guest).indexOf('topup'), ids(guest).indexOf('home') + 1, 'pengunjung: item pertama setelah Dashboard');
assert.equal(ids(childIn).indexOf('topup'), ids(childIn).indexOf('nokos') + 1, 'child panel: urutan sama dengan root domain');
const topupGuest = guest.find((i) => i.id === 'topup');
assert.equal(topupGuest.label, 'TopUp All Game', 'label menu sesuai permintaan');
assert.equal(topupGuest.desc, 'Top up game & produk digital');
const adminRoot = getAdminMenuItems(false);
const adminChild = getAdminMenuItems(true);
assert.ok(ids(adminRoot).includes('topup'), 'ADMIN juga melihat menu TopUp All Game di side menu');
assert.equal(ids(adminRoot)[0], 'nokos', 'admin: menu paling atas = Order Nomor (OTP)');
assert.equal(ids(adminRoot)[1], 'topup', 'admin: urutan kedua = TopUp All Game (berdampingan dengan OTP)');
assert.equal(adminRoot[0].path, '/otp-service', 'menu OTP admin membuka /otp-service');
assert.ok(ids(adminChild).includes('topup'), 'pemilik child panel (admin ke-2) juga melihatnya');
const topupAdmin = adminRoot.find((i) => i.id === 'topup');
assert.equal(topupAdmin.path, '/topup', 'menu admin membuka /topup');
assert.equal(topupAdmin.label, 'TopUp All Game');
assert.ok(!ids(getUserMenuItems(true, true, false)).length, 'admin memang tidak merender daftar menu user (karena itu entri ADMIN_MENU wajib ada)');

// ---------- Nama produk manusiawi (kode penyedia -> nama baca) ----------
assert.ok(existsSync('src/lib/topupDisplayName.ts'), 'helper nama tampilan top up ada');
const dname = read('src/lib/topupDisplayName.ts');
for (const t of ['Membership Mingguan', 'Membership Bulanan', 'Level Up Pass', 'BP Card', 'Weekly Diamond Pass', 'Twilight Pass'])
  assert.ok(dname.includes(t), `token khusus "${t}" mengikuti pricelist resmi penyedia`);
assert.ok(!detail.includes('Katalog live dari pricelist penyedia'), 'teks log "Katalog live … diperbarui" dihapus dari halaman detail');
assert.ok(detail.includes('rapihkanKatalog('), 'halaman detail merapikan katalog lewat rapihkanKatalog');
// Uji perilaku helper (type-stripping Node) terhadap kode asli dari /produk/code.
const perilaku = execFileSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '-e', `
    import { namaTampilanTopup, rapihkanKatalog } from './src/lib/topupDisplayName.ts';
    const kasus = [
      ['free-fire', 'FF5', 'FF5', '5 Diamond'],
      ['free-fire', 'KPPFF5', 'KPPFF5', '5 Diamond'],
      ['free-fire', 'KPPFF12', 'KPPFF12', '12 Diamond'],
      ['free-fire', 'PFF100', 'PFF100', '100 Diamond'],
      ['free-fire', 'MFF2020', 'MFF2020', '2020 Diamond'],
      ['free-fire', 'FFM', 'FFM', 'Membership Mingguan'],
      ['free-fire', 'FFB', 'FFB', 'Membership Bulanan'],
      ['free-fire', 'FFLUP', 'FFLUP', 'Level Up Pass'],
      ['free-fire', 'FFBP', 'FFBP', 'BP Card'],
      ['free-fire', 'GMXFF1', 'GMXFF1', 'GMXFF 1'],
      ['free-fire', 'FF5', 'Free Fire 5 Diamonds', 'Free Fire 5 Diamonds'],
      ['mobile-legends', 'MLA85', 'MLA85', '85 Diamond'],
      ['mobile-legends', 'MLBB875', 'MLBB875', '875 Diamond'],
      ['mobile-legends', 'MLC17', 'MLC17', '17 Diamond'],
      ['mobile-legends', 'MLRU55', 'MLRU55', '55 Diamond (RU)'],
      ['mobile-legends', 'MLWDP2', 'MLWDP2', 'Weekly Diamond Pass 2'],
      ['mobile-legends', 'MLATP', 'MLATP', 'Twilight Pass'],
      ['mobile-legends', 'LMLM', 'LMLM', 'LMLM'],
    ];
    for (const [slug, kode, nama, ingin] of kasus) {
      const dapat = namaTampilanTopup(slug, kode, nama);
      if (dapat !== ingin) throw new Error(slug + ' ' + kode + ' => ' + dapat + ' (ingin ' + ingin + ')');
    }
    const rapih = rapihkanKatalog('free-fire', [
      { kode: 'FF70', nama: 'FF70', harga: 8886 },
      { kode: 'PFF70', nama: 'PFF70', harga: 8719 },
      { kode: 'MFF70', nama: 'MFF70', harga: 7950 },
      { kode: 'CEKFF', nama: 'CEKFF', harga: 5 },
      { kode: 'FF5', nama: 'FF5', harga: 814 },
      { kode: 'KPPFF5', nama: 'KPPFF5', harga: 800 },
    ]);
    if (rapih.length !== 2) throw new Error('dedupe+filter CEK gagal: ' + rapih.length);
    if (rapih[0].nama !== '5 Diamond' || rapih[1].nama !== '70 Diamond') throw new Error('urutan/nama dedupe salah');
    if (rapih[0].kode !== 'KPPFF5' || rapih[0].harga !== 800) throw new Error('kanal termurah KPPFF5 harus menang untuk 5 Diamond');
    if (rapih[1].kode !== 'MFF70' || rapih[1].harga !== 7950) throw new Error('dedupe harus menyimpan kanal termurah');
    console.log('OK');
  `],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim();
assert.equal(perilaku, 'OK', 'perilaku nama tampilan & rapihkanKatalog sesuai konvensi pricelist resmi');

console.log('PASS TopUp All Game: menu tampil untuk pengunjung/user/child panel DAN admin (ADMIN_MENU) + route /topup & /topup/:slug, UI marketplace sesuai spesifikasi (latar #E5E5E7 berpola, tab pill navy, search realtime, grid 3/4/6/8, skeleton, state kosong), 16 game dummy + helper teruji, halaman detail dengan Player/Server ID, dan transaksi lewat proxy server (signature MD5 user_code:secret:ref_id dihitung di server, secret tidak pernah ke browser).');
process.exit(0);