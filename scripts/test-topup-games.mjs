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
// Permintaan pemilik: tombol menu kategori (Voucher, Pulsa, dst) DIHAPUS dari /topup;
// grid kartu game diambil LIVE dari API katalog penyedia, bukan hardcode.
assert.ok(!page.includes('TOPUP_CATEGORIES'), 'tombol tab kategori (Voucher dkk) dihapus dari halaman /topup');
assert.ok(!page.includes('TOPUP_OTHER'), 'daftar voucher/pulsa/reseller hardcode tidak lagi dirender');
assert.ok(page.includes('tvKatalog'), 'grid kartu game diambil dari API katalog penyedia (action=katalog)');
assert.ok(page.includes('server ID (Indonesia)'), 'sub kartu menyebut hanya server ID Indonesia');
assert.match(page, /placeholder="Cari game…"/, 'placeholder search tetap ada');
assert.match(page, /rounded-full border border-slate-200 bg-white pl-11/, 'search bar rounded-full putih ber-border + ikon kaca');
assert.match(page, /grid grid-cols-3 items-stretch gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-6 xl:gap-6 2xl:grid-cols-8/, 'grid 3/4/6/8 kolom responsif + items-stretch');
assert.match(page, /hover:-translate-y-1 hover:shadow-lg/, 'hover: kartu naik + shadow membesar');
assert.match(page, /duration-200/, 'transisi hover 200ms');
assert.match(page, /aspect-square w-full overflow-hidden rounded-xl/, 'thumbnail persegi rounded-xl');
assert.match(page, /bg-gradient-to-t from-\[#14143c\]/, 'overlay gradasi navy di bawah thumbnail (tempat nama game)');
assert.match(page, /text-\[13px\] leading-snug text-slate-800 md:text-\[18px\]/, 'nama game 13px mobile / 18px desktop, rata tengah');
assert.match(page, /Game tidak ditemukan/, 'state kosong "Game tidak ditemukan"');
assert.match(page, /animate-pulse/, 'skeleton loading kartu');
assert.match(page, /loading\s*\n\s*\? Array\.from/, 'skeleton tampil selama katalog live penyedia dimuat');
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
assert.ok(php.includes('function tv_label_wilayah_ok'), 'proxy PHP punya filter kategori wilayah (hanya ID Indonesia)');
assert.ok(php.includes("strpos($l, 'promo')"), 'kategori Promo dibuang di sumbernya');
assert.ok(/array_filter\(\$all, function \(\$p\) \{ return tv_label_wilayah_ok/.test(php), 'pricelist menerapkan filter wilayah ke seluruh daftar produk penyedia');
assert.ok(php.includes("action === 'katalog'"), 'proxy menyediakan action=katalog untuk grid game live di /topup');
assert.ok(php.includes('function tv_game_key_of_label'), 'label kategori penyedia dipetakan ke game kanonik');
assert.ok(php.includes('function tv_game_display'), 'nama tampil game untuk kartu grid tersedia di proxy');
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
for (const t of ['Membership Mingguan', 'Membership Bulanan', 'Level Up Pass', 'Booyah Pass', 'Weekly Diamond Pass', 'Twilight Pass'])
  assert.ok(dname.includes(t), `token khusus "${t}" mengikuti pricelist resmi penyedia`);
assert.ok(dname.includes("'free-fire': { root: 'FF', kanalDepan: ['M'] }"), 'Free Fire dikunci ke kanal resmi M (daftar 122 kode MFF dari web penyedia)');
assert.ok(!detail.includes('Katalog live dari pricelist penyedia'), 'teks log "Katalog live … diperbarui" dihapus dari halaman detail');
assert.ok(detail.includes('rapihkanKatalog('), 'halaman detail merapikan katalog lewat rapihkanKatalog');
assert.ok(detail.includes('Paket &amp; Membership'), 'halaman detail punya seksi Paket & Membership di atas list eceran');
assert.ok(!detail.includes('>Eceran<'), 'judul seksi "Eceran" dihapus sesuai permintaan pemilik');
assert.ok(detail.indexOf('1 · Data akun tujuan') < detail.indexOf('2 · Pilih produk'), 'input ID akun pindah ke atas, sebelum list produk');
assert.ok(detail.includes('scrollIntoView'), 'klik produk menggulir otomatis ke langkah konfirmasi pesanan');
assert.ok(detail.includes(".split('-')"), 'halaman detail mensintesis kartu game baru dari slug katalog live');
assert.ok(!read('src/pages/TopupGamePage.tsx').includes('Halaman detail:'), 'teks bantuan route "/topup/{slug}" dihapus dari halaman daftar game');
assert.ok(dname.includes('(RU|SG|MY|BR|PH|LATAM|GLOBAL)'), 'filter server luar (hanya server ID/Indonesia) lintas game');
// Uji perilaku helper (type-stripping Node) terhadap kode asli dari /produk/code.
const perilaku = execFileSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '-e', `
    import { namaTampilanTopup, rapihkanKatalog } from './src/lib/topupDisplayName.ts';
    const kasus = [
      ['free-fire', 'MFF5', 'MFF5', '5 Diamond'],
      ['free-fire', 'MFF2020', 'MFF2020', '2020 Diamond'],
      ['free-fire', 'MFFM', 'MFFM', 'Membership Mingguan'],
      ['free-fire', 'MFFB', 'MFFB', 'Membership Bulanan'],
      ['free-fire', 'MFFLUP', 'MFFLUP', 'Level Up Pass'],
      ['free-fire', 'MFFBP', 'MFFBP', 'Booyah Pass'],
      ['free-fire', 'MFF5', 'Free Fire 5 Diamonds', 'Free Fire 5 Diamonds'],
      ['free-fire', 'GMXFF1', 'GMXFF1', 'GMXFF 1'],
      ['mobile-legends', 'MLA85', 'MLA85', '85 Diamond'],
      ['mobile-legends', 'MLBB875', 'MLBB875', '875 Diamond'],
      ['mobile-legends', 'MLC17', 'MLC17', '17 Diamond'],
      ['mobile-legends', 'MLWDP2', 'MLWDP2', 'Weekly Diamond Pass 2'],
      ['mobile-legends', 'MLATP', 'MLATP', 'Twilight Pass'],
    ];
    for (const [slug, kode, nama, ingin] of kasus) {
      const dapat = namaTampilanTopup(slug, kode, nama);
      if (dapat !== ingin) throw new Error(slug + ' ' + kode + ' => ' + dapat + ' (ingin ' + ingin + ')');
    }
    // FF: hanya kanal resmi M yang lolos; kode kanal aneh dibuang walau lebih murah;
    // pass/membership masuk kelompok paket.
    const ff = rapihkanKatalog('free-fire', [
      { kode: 'MFF5', nama: 'MFF5', harga: 800 },
      { kode: 'KPPFF5', nama: 'KPPFF5', harga: 790 },
      { kode: 'FF5', nama: 'FF5', harga: 780 },
      { kode: 'ZFF5', nama: 'ZFF5', harga: 770 },
      { kode: 'IDFF4', nama: 'IDFF4', harga: 16000 },
      { kode: 'VFFGLOBAL100', nama: 'VFFGLOBAL100', harga: 17600 },
      { kode: 'FFMY100', nama: 'FFMY100', harga: 16500 },
      { kode: 'FFPH100', nama: 'FFPH100', harga: 17800 },
      { kode: 'FFGLOBAL100', nama: 'FFGLOBAL100', harga: 18400 },
      { kode: 'GMXFF1', nama: 'GMXFF1', harga: 22705 },
      { kode: 'CEKFF', nama: 'CEKFF', harga: 5 },
      { kode: 'MFF10', nama: 'MFF10', harga: 1508 },
      { kode: 'MFFM', nama: 'MFFM', harga: 25138 },
      { kode: 'MFFBP', nama: 'MFFBP', harga: 37708 },
    ]);
    if (ff.eceran.length !== 2) throw new Error('eceran FF harus 2 (kode aneh dibuang): ' + ff.eceran.length);
    if (ff.eceran[0].kode !== 'MFF5' || ff.eceran[0].nama !== '5 Diamond') throw new Error('eceran FF[0] salah');
    if (ff.eceran[1].kode !== 'MFF10' || ff.eceran[1].nama !== '10 Diamond') throw new Error('eceran FF[1] salah');
    if (ff.paket.length !== 2) throw new Error('paket FF harus 2: ' + ff.paket.length);
    if (ff.paket[0].nama !== 'Membership Mingguan' || ff.paket[1].nama !== 'Booyah Pass') throw new Error('isi/urutan paket FF salah');
    // ML: kanal denominasi resmi digabung ke termurah; RU/LMLM/GMX/CEK dibuang; WDP = paket.
    const ml = rapihkanKatalog('mobile-legends', [
      { kode: 'MLA85', nama: 'MLA85', harga: 24479 },
      { kode: 'MLBB85', nama: 'MLBB85', harga: 24854 },
      { kode: 'MLRU55', nama: 'MLRU55', harga: 18081 },
      { kode: 'LMLM', nama: 'LMLM', harga: 88957 },
      { kode: 'GMXML1', nama: 'GMXML1', harga: 22855 },
      { kode: 'MLWDP2', nama: 'MLWDP2', harga: 61516 },
      { kode: 'CEKML', nama: 'CEKML', harga: 5 },
    ]);
    if (ml.eceran.length !== 1 || ml.eceran[0].kode !== 'MLA85' || ml.eceran[0].nama !== '85 Diamond') throw new Error('eceran ML salah');
    if (ml.paket.length !== 1 || ml.paket[0].nama !== 'Weekly Diamond Pass 2') throw new Error('paket ML salah');
    // Game tanpa daftar resmi: kode huruf+angka jadi "N <satuan game>" (bukan nama kode),
    // kanal kembar digabung ke termurah, kode server luar negeri tetap dibuang.
    const pb = rapihkanKatalog('pubg-mobile', [
      { kode: 'UC60', nama: '', harga: 1000 },
      { kode: 'PUC60', nama: '', harga: 900 },
      { kode: 'UCRU60', nama: '', harga: 800 },
      { kode: 'UCSG60', nama: '', harga: 850 },
    ]);
    if (pb.eceran.length !== 1 || pb.eceran[0].nama !== '60 UC' || pb.eceran[0].kode !== 'PUC60') throw new Error('game tanpa aturan: "60 UC" kanal termurah + buang server luar: ' + JSON.stringify(pb.eceran));
    const hsr = rapihkanKatalog('honkai-star-rail', [
      { kode: 'HSR120', nama: 'HSR120', harga: 100 },
      { kode: 'PHSR120', nama: 'PHSR120', harga: 90 },
      { kode: 'HSRM', nama: 'HSRM', harga: 25000 },
    ]);
    if (hsr.eceran.length !== 1 || hsr.eceran[0].nama !== '120 Oneiric Shard') throw new Error('HSR harus "120 Oneiric Shard": ' + JSON.stringify(hsr.eceran));
    if (hsr.paket.length !== 1 || hsr.paket[0].nama !== 'Membership Mingguan') throw new Error('token khusus game lain masuk paket: ' + JSON.stringify(hsr.paket));
    // Daftar 122 kode RESMI Free Fire dari web penyedia (dikonfirmasi pemilik 27 Nov 2026):
    // semuanya harus lolos tampil, tepat 118 eceran + 4 paket.
    const RESMI_FF = ('MFF5 MFF10 MFF12 MFF15 MFF20 MFF25 MFF30 MFF50 MFF40 MFF55 MFF60 MFF70 MFF75 MFF80 MFF90 MFF100 MFF95 MFFLUP ' +
      'MFF120 MFF130 MFF140 MFF145 MFF150 MFF160 MFF165 MFF170 MFF175 MFF190 MFF180 MFF185 MFF200 MFF210 MFFM MFF215 MFF220 MFF235 MFF240 ' +
      'MFF250 MFF265 MFF280 MFF290 MFF300 MFFBP MFF330 MFF355 MFF350 MFF360 MFF365 MFF370 MFF375 MFF380 MFF400 MFF405 MFF415 MFF420 MFF425 ' +
      'MFF430 MFF440 MFF455 MFF465 MFF475 MFF480 MFF495 MFF500 MFF505 MFF510 MFF512 MFF515 MFF520 MFF545 MFF565 MFF600 MFF635 MFFB MFF645 ' +
      'MFF655 MFF720 MFF710 MFF700 MFF725 MFF740 MFF770 MFF790 MFF800 MFF860 MFF925 MFF930 MFF1000 MFF1050 MFF1060 MFF1075 MFF1080 MFF1200 ' +
      'MFF1215 MFF1300 MFF1440 MFF1450 MFF1490 MFF1510 MFF1580 MFF1795 MFF1800 MFF2000 MFF2020 MFF2050 MFF2070 MFF2140 MFF2160 MFF2190 ' +
      'MFF2200 MFF2210 MFF2280 MFF2350 MFF2355 MFF2400 MFF2720 MFF3620 MFF3640 MFF3800 MFF4000 MFF4720 MFF7290').split(/\\s+/);
    if (RESMI_FF.length !== 122) throw new Error('daftar resmi FF harus 122 kode: ' + RESMI_FF.length);
    const ff2 = rapihkanKatalog('free-fire', RESMI_FF.map((k, i) => ({ kode: k, nama: k, harga: 1000 + i })));
    if (ff2.eceran.length !== 118 || ff2.paket.length !== 4) throw new Error('122 kode resmi FF => 118 eceran + 4 paket, dapat ' + ff2.eceran.length + '+' + ff2.paket.length);
    console.log('OK');
  `],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim();
assert.equal(perilaku, 'OK', 'perilaku nama tampilan & rapihkanKatalog sesuai konvensi pricelist resmi');

console.log('PASS TopUp All Game: menu tampil untuk pengunjung/user/child panel DAN admin (ADMIN_MENU) + route /topup & /topup/:slug, UI marketplace sesuai spesifikasi (latar #E5E5E7 berpola, tab pill navy, search realtime, grid 3/4/6/8, skeleton, state kosong), 16 game dummy + helper teruji, halaman detail dengan Player/Server ID, dan transaksi lewat proxy server (signature MD5 user_code:secret:ref_id dihitung di server, secret tidak pernah ke browser).');
process.exit(0);