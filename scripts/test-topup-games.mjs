// Halaman + menu "Topup Game": marketplace top up game & produk digital.
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
assert.match(menu, /\| 'topup'\n  \| 'ppob';/, 'PageId topup (dan ppob) ada');
assert.match(menu, /topup: '\/topup',/, 'ROUTE_PATH topup = /topup');
assert.match(menu, /\{ id: 'topup', icon: Gamepad2, label: 'Topup Game', desc: 'Top up game & produk digital' \},/, 'menu "Topup Game" ada di SideMenu');
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
assert.ok(page.includes('item.logo') && page.includes('onError'), 'kartu game memakai logo resmi penyedia dengan fallback ikon gamepad');
assert.ok(page.includes('server ID (Indonesia)'), 'sub kartu menyebut hanya server ID Indonesia');
assert.match(page, /placeholder="Cari game…"/, 'placeholder search tetap ada');
assert.match(page, /rounded-full border border-slate-200 bg-white pl-11/, 'search bar rounded-full putih ber-border + ikon kaca');
assert.match(page, /grid grid-cols-3 items-stretch gap-4 md:grid-cols-4 md:gap-5 lg:grid-cols-6 xl:gap-6 2xl:grid-cols-8/, 'grid 3/4/6/8 kolom responsif + items-stretch');
assert.match(page, /hover:-translate-y-1/, 'hover: kartu naik');
assert.match(page, /duration-200/, 'transisi hover 200ms');
assert.match(page, /aspect-square w-full overflow-hidden rounded-2xl/, 'thumbnail persegi rounded-2xl');
assert.ok(!page.includes('bg-gradient-to-t from-[#14143c]'), 'overlay gradasi navy dihapus — image API tampil langsung');
assert.ok(!page.includes('linear-gradient(155deg'), 'card background berwarna pada thumbnail dihapus');
assert.ok(!/rounded-2xl bg-white p-3 shadow-sm/.test(page), 'kartu grid tidak lagi memakai card background putih');
assert.match(page, /object-cover transition-transform duration-300 group-hover:scale/, 'image API langsung tanpa background + zoom halus saat hover');
assert.match(page, /login ulang/i, 'PHP error: pesan wajib login ulang (tanpa fallback snapshot repo)');
assert.ok(!page.includes('TOPUP_GAMES.map'), 'fallback snapshot repo dihapus dari grid /topup');
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
const topupSrc = read('src/data/topupGames.ts');
assert.equal(TOPUP_MARKUP_PCT, 2, 'markup sistem 2% dari harga modal');
assert.equal(hargaJual(756), 756 * 1.02, 'markup 2% eksak: 756 → 771,12 (TIDAK dibulatkan ke ratusan)');
assert.equal(hargaJual(12066), 12066 * 1.02, '12066 + 2% = 12.307,32 (bukan 12.400)');
assert.equal(hargaJual(814), 830.28, '814 + 2% = 830,28 — modal + markup = harga user');
assert.equal(hargaJual(1000, 5), 1050, 'persen child panel (yang sudah beli akses) menimpa markup sistem');
assert.ok(!/Math\.ceil\(\(hargaModal \* \(1 \+ TOPUP_MARKUP_PCT/.test(topupSrc), 'tidak ada lagi pembulatan ke ratusan terdekat');

/* ---------- 4. Halaman detail + layanan + keamanan integrasi ---------- */
const detail = read('src/pages/TopupGameDetailPage.tsx');
assert.match(detail, /Player ID \/ User ID/, 'form Player ID ada');
assert.match(detail, /Server ID/, 'form Server ID ada (produk yang membutuhkannya)');
assert.match(detail, /const butuhServer = slug === 'mobile-legends';/, 'Server ID HANYA untuk Mobile Legends (Free Fire & game lain tidak)');
assert.match(detail, /tvTransaksi\(\{\s*player_id: playerId\.trim\(\),\s*server_id: butuhServer \? serverId\.trim\(\) : '',\s*kode_produk: produk\.kode,\s*\}\)/, 'pesanan dikirim lewat layanan proxy; server_id dikirim hanya untuk Mobile Legends');
assert.match(detail, /Silakan login dulu untuk memesan top up\./, 'pesan wajib login sebelum memesan');
assert.match(detail, /tokovoucher_config\.php/, 'notice bila integrasi belum dikonfigurasi di server');
assert.match(detail, /tvPricelist\(game\.nama\)/, 'halaman detail menarik katalog ASLI dari server saat dibuka');
assert.match(detail, /Katalog produk game ini belum tersedia di server/, 'game tanpa katalog menampilkan state jujur (bukan kode karangan)');
assert.match(detail, /rupiah\(hargaJual\(n, pctTopup\)\)/, 'harga tampilan lewat hargaJual dengan markup tenant (margin terpusat)');
assert.match(detail, /daftarJenis\.find\(\(j\) => wilayahOkJenis\[j\] !== false\)/, 'chip bawaan = varian Indonesia termurah');
const svc = read('src/services/tokovoucherApi.ts');
assert.match(svc, /export const tvPricelist = \(game\?: string\) =>/, 'layanan punya tvPricelist (katalog asli dari server)');
assert.match(svc, /action=pricelist/, 'tvPricelist memanggil action=pricelist');
assert.match(svc, /const API = `\$\{MAIN_API\}\/tokovoucher\.php`;/, 'frontend memanggil proxy PHP, bukan API penyedia langsung');
assert.ok(!/secret\s*:/.test(svc), 'payload frontend tidak pernah memuat field secret');
assert.ok(!/md5\(/i.test(svc) && !/signature\s*=/.test(svc), 'signature tidak dihitung di browser');

const php = read('php-api/tokovoucher.php');
assert.ok(php.includes('function tv_label_wilayah_ok'), 'proxy PHP punya filter kategori wilayah (hanya ID Indonesia)');
assert.ok(php.includes("strpos($l, 'promo')"), 'kategori Promo dibuang di sumbernya');
assert.ok(/array_key_exists\('wilayah_ok', \$p\)/.test(php), 'pricelist memakai flag wilayah_ok: semua wilayah ikut (chip), sumber datar tetap ID-saja');
assert.ok(php.includes("'wilayah_ok' => \$wilayahOk"), 'item dari /member/produk/full membawa flag wilayah_ok per jenis');
assert.ok(php.includes('function tv_kode_katalog_ok($kode, $izinkanWilayah = false)'), 'filter kode punya opsi izinkan token wilayah (produk chip server luar)');
assert.ok(/\$okWilayah = array_key_exists\('wilayah_ok', \$p\)/.test(php), 'grid katalog tetap ringkasan varian Indonesia (wilayah_ok)');
assert.ok(php.includes("action === 'katalog'"), 'proxy menyediakan action=katalog untuk grid game live di /topup');
assert.ok(php.includes('function tv_kode_katalog_ok'), 'filter kode: produk tes, server luar, dan voucher game dibuang');
assert.ok(php.includes('labels_dilihat'), 'katalog melaporkan label mentah penyedia untuk diagnostik');
assert.ok(/tv_code_prefix_game\(\$p\['kode'\]\)/.test(php), 'katalog fallback pengelompokan lewat prefiks kode (respons datar)');
assert.ok(php.includes('/member/produk/full'), 'sumber katalog utama: endpoint resmi /member/produk/full');
assert.ok(php.includes('__all_v3__') && php.includes('__full_v2__'), 'kunci cache diversi ulang lagi (item kini membawa wilayah_ok + varian luar): cache lama tidak menutupi');
assert.ok(php.includes('sumber_katalog') && php.includes('tv_full_error'), 'katalog melaporkan sumber data & alasan gagal endpoint full untuk diagnostik');
assert.ok(php.includes('function tv_provider_full'), 'fetcher + cache katalog full tersedia');
assert.ok(php.includes('function tv_items_from_full'), 'normalisasi kategori/operator/jenis/produk (nama asli, status, format_form)');
assert.ok(php.includes("stripos($cat, 'topup')"), 'hanya kategori Topup yang diambil dari katalog full');
assert.ok(/butuh_server' => !empty\(\$p\['butuh_server'\]\)/.test(php), 'butuh_server produk (format_form server_id) diteruskan ke pricelist');
assert.ok(php.includes("preg_match('/mobile\\s*legends?\\b/i', $opNama)") && php.includes('$butuhServer ='), 'PHP menandai butuh_server hanya untuk operator Mobile Legends');
assert.ok(!php.includes("(string)($fd['name'] ?? '') !== 'server_id'"), 'aturan lama server_id dari format_form sudah dibuang (label kosong di game lain menyesatkan)');
assert.ok(php.includes('cek-username') && php.includes("md5($c['ag_merchant'] . $c['ag_secret'])"), 'action=cek_akun memanggil apigames.id dengan signature md5(merchant+secret)');
assert.ok(php.includes("$gagal('unconfigured'") && php.includes("$gagal('ditolak'") && php.includes("$gagal('koneksi'") && php.includes("$gagal('non_json'"), 'cek akun mengembalikan alasan gagal + cuplikan respons ASLI apigames');
assert.ok(php.includes("$gagal('not_found'") && php.includes("$raw = is_string($body) ? substr(preg_replace"), 'Data Not Found ditandai not_found dan raw respons ikut dikirim');
assert.ok(detail.includes("r.reason === 'not_found'") && detail.includes('cekAkun.error.raw || cekAkun.error.message') && !detail.includes('Cek akun apigames bermasalah'), 'UI: not_found senyap; error lain menampilkan HANYA respons penyedia tanpa teks tambahan');
assert.ok(php.includes("trim((string)$c['ag_merchant']") && php.includes("trim((string)$c['ag_secret']"), 'kredensial apigames dinormalisasi (spasi/newline/kutipan dibuang) supaya signature tidak Unauthorized');
assert.ok(php.includes("$gagal('ditolak', $raw !== '' ? $raw"), 'pesan penolakan apigames = respons penyedia apa adanya');
assert.ok(php.includes("'ag_merchant' => ''"), 'kredensial apigames dibaca dari config/env (kosong = skip senyap)');
assert.ok(php.includes("\\b(sg|my|br|th|vn|ph|tr|ru|kr|tw|bd"), 'filter wilayah diperkuat: token region polos (Free Fire SG, ML MY, Genshin KR) dibuang');
assert.ok(php.includes("'label:' ."), 'operator di luar tabel alias tetap jadi grup katalog dengan namanya sendiri');
const svcApi = read('src/services/tokovoucherApi.ts');
assert.ok(svcApi.includes('action=cek_akun'), 'service frontend tvCekAkun tersedia');
assert.ok(detail.includes('tvCekAkun(') && detail.includes('animate-pulse'), 'cek akun otomatis dengan skeleton saat memuat');
assert.ok(detail.includes('Akun terbaca:'), 'nama akun tampil bila ditemukan; gagal = skip senyap (tanpa pesan error)');
assert.ok(detail.includes("slug === 'mobile-legends'") && detail.includes('const butuhServer ='), 'halaman detail: flag gabungan butuhServer + pengaman slug Mobile Legends');
assert.ok(!detail.includes('{produk?.butuhServer &&'), 'tampilan kolom Server ID tidak lagi membaca flag mentah produk');
assert.ok(php.includes('function tv_game_key_of_label'), 'label kategori penyedia dipetakan ke game kanonik');
assert.ok(php.includes('function tv_game_display'), 'nama tampil game untuk kartu grid tersedia di proxy');
assert.match(php, /if \(\$action === 'pricelist'\)/, 'proxy punya action=pricelist (katalog asli)');
assert.match(php, /function tv_parse_pricelist_html\(\$html\)/, 'proxy bisa membaca tabel pricelist penyedia');
assert.match(php, /function tv_pricelist_override\(\)/, 'proxy mendukung override katalog manual di server');
assert.match(php, /tokovoucher_pricelist_cache\.json/, 'pricelist live di-cache di server (6 jam)');
assert.match(php, /function tv_trx_normalize\(\$j\)/, 'status penyedia dinormalisasi: pending | sukses | gagal | error (status:0 + error_msg)');
assert.ok(php.includes("'error_msg'") && php.includes("'trx_id'") && php.includes("'sisa_saldo'"), 'field docs (error_msg, trx_id, sn, price, sisa_saldo) ikut dibaca');
assert.ok(!php.includes('$okProvider ? 200 : 502'), 'penolakan bisnis TIDAK lagi membalas 502 (UI dapat pesan penyedia)');
assert.match(php, /CURL_ERROR=/, 'gagal koneksi dicatat terpisah di log server');
assert.ok(existsSync('php-api/tokovoucher_pricelist.example.php'), 'contoh file override katalog tersedia');
/* Sistem API penyedia yang BERLAKU: api.tokovoucher.net (member code, transaksi GET). */
assert.match(php, /'base_url'    => 'https:\/\/api\.tokovoucher\.net',/, 'base URL penyedia = https://api.tokovoucher.net');
assert.match(php, /'member_code' => 'M250727KGST5158OE',/, 'member code default sesuai akun member');
assert.match(php, /getenv\('TV_SECRET'\)/, 'secret bisa dari env TV_SECRET');
assert.match(php, /is_file\(__DIR__ \. '\/tokovoucher_config\.php'\)/, 'secret dibaca dari file config server (tidak di-commit)');
assert.match(php, /cp_user_id\(\$conn, \(string\)\(\$in\['token'\] \?\? ''\)\)/, 'transaksi wajib token login valid');
assert.match(php, /tv_api_trx\('\/v1\/transaksi', \[/, 'transaksi memanggil /v1/transaksi lewat helper POST+signature');
assert.match(php, /function tv_api_post_json\(\$path, array \$payload, \$timeout = 25\)/, 'ada helper POST JSON ke penyedia (docs: transaksi metode POST)');
assert.match(php, /function tv_tx_signature\(\$c, \$ref\)/, 'signature transaksi = md5(MEMBER_CODE:SECRET:REF_ID) sesuai docs');
assert.match(php, /md5\(\(string\)\$c\['member_code'\] \. ':' \. \(string\)\$c\['secret'\] \. ':' \. \(string\)\$ref\)/, 'rumus signature persis md5(member_code:secret:ref_id)');
for (const param of ['ref_id', 'produk', 'tujuan', 'server_id', 'member_code', 'secret']) {
  assert.ok(php.includes(`'${param}'      =>`) || php.includes(`'${param}' =>`) || php.includes(`'${param}'      => $`) || new RegExp(`'${param}'\\s*=>`).test(php), `parameter query ${param} dikirim ke penyedia`);
}
assert.match(php, /tv_api_trx\('\/v1\/transaksi\/status', \['ref_id' => \$ref\]\)/, 'cek status memakai POST /v1/transaksi/status + signature (docs)');
assert.match(php, /tv_api_get_authed\('\/member'/, 'info member memakai GET /member (helper ber-signature)');
assert.match(php, /tv_api_get_authed\('\/produk\/code'/, 'katalog live memakai GET /produk/code (helper ber-signature)');
assert.match(php, /function tv_walk_products\(\$node, \$game, array &\$out\)/, 'respons /produk/code dibaca tahan-bentuk (list datar, map ber-kunci kode, grup per game, bungkus status/data)');
assert.match(php, /\(b\) nama produk menyebut game/, 'filter per game punya fallback cocokkan nama produk (bila JSON tanpa field kategori)');
assert.match(php, /PARSE_KOSONG/, 'bila katalog tetap tak terbaca, raw response dicatat di log server (secret disamarkan)');
/* Endpoint katalog (/produk/code, /member, /member/produk/full) menuntut `signature` menurut log
   produksi ("signature not valid"); proxy mencoba rumus otomatis & mengingat yang berhasil.
   Transaksi & cek status memakai rumus resmi docs: md5(MEMBER_CODE:SECRET:REF_ID) lewat POST,
   dengan fallback GET+secret bila POST ditolak (tv_api_trx). */
assert.match(php, /function tv_sig_candidates\(\$c\)/, 'proxy punya kandidat rumus signature');
assert.match(php, /function tv_api_get_authed\(\$path, array \$extra = \[\], \$timeout = 15\)/, 'proxy mencoba signature otomatis bila endpoint menolaknya (timeout bisa diperpanjang untuk katalog besar)');
assert.match(php, /tv_sig_cache_write\(\$i\)/, 'rumus signature yang berhasil disimpan ke cache');
assert.match(php, /tv_api_get_authed\('\/produk\/code'\)/, '/produk/code dipanggil lewat helper ber-signature');
assert.match(php, /tv_api_get_authed\('\/member'\)/, '/member dipanggil lewat helper ber-signature');
assert.match(php, /\$simpan = tv_trx_store_read\(\$ref\);/, 'cek status mendahulukan status yang dilaporkan webhook (tanpa menembak API)');
assert.match(php, /function tv_game_aliases\(\$game\)/, 'pencocokan game punya tabel alias (MLBB=Mobile Legends dll)');
assert.match(php, /function tv_code_prefix_game\(\$kode\)/, 'pencocokan terakhir lewat prefiks kode produk (MFF/ML/AMLBB…)');
assert.match(php, /TIDAK cocok \| label penyedia:/, 'bila tetap tidak cocok, label asli penyedia dicatat ke log (dasar pemetaan berikutnya)');
const txCall = php.split("tv_api_trx('/v1/transaksi', [")[1].split(']);')[0];
assert.ok(!txCall.includes('secret') && !txCall.includes('signature'), 'body transaksi hanya ref_id/produk/tujuan/server_id — signature & member_code ditambah helper di server');
assert.ok(php.includes("'GET+secret'") && php.includes("'POST+signature'"), 'bila POST+signature ditolak, otomatis dicoba varian GET lama dan metodenya dilaporkan');
assert.ok(php.includes("tv_trx_store_write($ref, $norm + ['sumber' => 'transaksi'"), 'hasil transaksi disimpan per ref_id agar cocok dengan webhook/cek status');
const phpCode = php.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
const totalMd5 = (phpCode.match(/md5\(/g) || []).length;
const candBody = php.split('function tv_sig_candidates')[1].split('\n}')[0];
const candMd5 = (candBody.match(/md5\(/g) || []).length;
const agMd5 = (php.match(/md5\(\$c\['ag_merchant'\] \. \$c\['ag_secret'\]\)/g) || []).length;
const txMd5 = (php.match(/md5\(\(string\)\$c\['member_code'\]/g) || []).length;
assert.ok(totalMd5 > 0 && totalMd5 === candMd5 + agMd5 + txMd5, 'md5 hanya untuk: kandidat signature, signature apigames, signature transaksi/webhook — tidak ada di browser');
assert.match(php, /function tv_sanitize\(\$j\)/, 'field rahasia dibuang dari balasan penyedia sebelum ke browser');
assert.match(php, /\$ref = \(\$jenisOrder === 'ppob' \? 'PPOB-' : 'TVG-'\) \. date\('ymdHis'\) \. random_int\(10, 99\);/, 'ref_id unik dibuat server (TVG- top up game, PPOB- layanan)');
// Pesanan sekarang diproses server: harga+markup dari katalog, saldo dipotong, tercatat di riwayat.
assert.match(php, /\$buat = tv_buat_pesanan\(\$conn, \$uid, \$ref, \$jenisOrder, \$judulPesanan, \$tujuan, \$hargaJual, \$hargaModal, \$tenant\);/, 'saldo dipotong + riwayat ditulis server sebelum transaksi dikirim');
assert.match(php, /'saldo'      => \$saldoSetelah,/, 'balasan transaksi membawa sisa saldo');
const WEBHOOK_HEADER_LIT = 'X-TokoVoucher-Authorization';
assert.match(svc, /export const tvCekStatus = \(ref_id: string\)/, 'frontend punya tvCekStatus (POST /v1/transaksi/status via proxy)');
assert.match(php, /if \(\$action === 'webhook'\) \{/, 'PHP punya action=webhook untuk callback penyedia');
assert.ok(php.includes('HTTP_X_TOKOVOUCHER_AUTHORIZATION') && php.includes('hash_equals($harus, $hdr)'), 'webhook divalidasi dengan header X-TokoVoucher-Authorization = md5(member:secret:ref) (hash_equals)');
assert.match(php, /function tv_trx_store_write\(\$ref, array \$data\)/, 'status webhook disimpan per ref_id');
assert.ok(php.includes("($lama['trx_id'] ?? '') === ($data['trx_id'] ?? '')"), 'penyimpanan IDEMPOTEN: trx_id + status sama tidak ditulis ulang');
assert.match(php, /tokovoucher_trx_cache\.json/, 'status transaksi disimpan di file cache sendiri (terpisah dari cache katalog)');
const worker = read('worker/app-api-proxy.js');
assert.ok(worker.includes('const WEBHOOK_PATH = "/api/tokovoucher-webhook";'), 'Worker punya endpoint webhook /api/tokovoucher-webhook');
assert.ok(worker.includes('url.pathname === WEBHOOK_PATH') && worker.includes('handleWebhook(request, ctx)'), 'endpoint webhook dirutekan sebelum proxy /api umum');
assert.ok(worker.includes('WEBHOOK_PHP = "/api/tokovoucher.php?action=webhook"'), 'Worker meneruskan webhook ke PHP action=webhook');
assert.ok(worker.includes(WEBHOOK_HEADER_LIT) || worker.includes('"X-TokoVoucher-Authorization"'), 'header validasi penyedia diteruskan ke PHP');
assert.ok(worker.includes('status: 200') || /return jsonOut\(\{\n    ok: true,\n    diterima: true,/.test(worker), 'Worker membalas HTTP 200 ke penyedia (syarat docs)');
assert.ok(worker.includes('503') && worker.includes('Retry-After'), 'bila origin kena 429, webhook dibalas 503 + Retry-After agar penyedia mengulang');
assert.ok(worker.includes('probe=1'), 'ada mode ?probe=1 untuk menguji URL webhook tanpa payload');
assert.match(detail, /Cek status pesanan/, 'halaman detail punya tombol cek status pesanan per ref_id');
assert.ok(detail.includes('result.status') && detail.includes('result.trxId') && detail.includes('result.sn'), 'hasil pesanan menampilkan status, TRX ID, dan SN dari penyedia');
assert.ok(detail.includes('Respons asli penyedia:'), 'bila transaksi gagal, respons ASLI penyedia ditampilkan ke user');
assert.ok(detail.includes("['pending', 'processing', 'diproses'].includes"), 'status pending diberi nada amber + ikon berputar (bukan gagal)');
assert.ok(svc.includes('raw?: string') && svc.includes('error_msg?: string'), 'tipe API memuat raw & error_msg untuk diagnostik');
assert.ok(existsSync('php-api/tokovoucher_config.example.php'), 'contoh config tersedia untuk server');
const gi = read('.gitignore');
assert.match(gi, /php-api\/tokovoucher_config\.php/, 'config rahasia di-gitignore');
assert.match(gi, /php-api\/tokovoucher_log\.txt/, 'log transaksi di-gitignore');
assert.ok(!read('php-api/tokovoucher_config.example.php').includes("'secret'    => 'U"), 'contoh config tidak menyertakan secret asli');

/* ---------- 5. Menu benar-benar ter-render untuk SEMUA peran (bundle SideMenu) ---------- */
// Admin: daftar "Navigasi" (menu user) disembunyikan seluruhnya, jadi entri topup juga harus
// ada di ADMIN_MENU — kalau tidak, admin tidak pernah melihat menu Topup Game.
assert.match(menu, /\{ id: 'topup' as const, icon: Gamepad2, label: 'Topup Game', desc: 'Top up game & produk digital', path: '\/topup' \},/, 'ADMIN_MENU juga punya Topup Game (path /topup)');
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
assert.ok(ids(guest).includes('topup'), 'menu Topup Game tampil untuk pengunjung (belum login)');
assert.ok(ids(userIn).includes('topup'), 'menu Topup Game tampil untuk user login');
assert.ok(ids(childIn).includes('topup'), 'menu Topup Game tampil di child panel');
// Posisi: di baseMenu topup tepat setelah "Buat Pesanan" (layanan). Untuk user login, "Buat Pesanan"
// & "Order Nomor" berada di depan grup deposit sehingga topup mengikuti "Order Nomor"; untuk
// pengunjung (belum login) layanan/nokos tersembunyi sehingga topup langsung setelah Dashboard.
assert.equal(ids(userIn).indexOf('nokos'), ids(userIn).indexOf('layanan') + 1, 'user login: "Order Nomor" (OTP) di atas, tepat setelah Buat Pesanan');
assert.equal(ids(userIn).indexOf('topup'), ids(userIn).indexOf('nokos') + 1, 'user login: Topup Game berdampingan dengan Order Nomor');
assert.equal(ids(guest).indexOf('topup'), ids(guest).indexOf('home') + 1, 'pengunjung: item pertama setelah Dashboard');
assert.equal(ids(childIn).indexOf('topup'), ids(childIn).indexOf('nokos') + 1, 'child panel: urutan sama dengan root domain');
const topupGuest = guest.find((i) => i.id === 'topup');
assert.equal(topupGuest.label, 'Topup Game', 'label menu sesuai permintaan');
assert.equal(topupGuest.desc, 'Top up game & produk digital');
const adminRoot = getAdminMenuItems(false);
const adminChild = getAdminMenuItems(true);
assert.ok(ids(adminRoot).includes('topup'), 'ADMIN juga melihat menu Topup Game di side menu');
assert.equal(ids(adminRoot)[0], 'nokos', 'admin: menu paling atas = Order Nomor (OTP)');
assert.equal(ids(adminRoot)[1], 'topup', 'admin: urutan kedua = Topup Game (berdampingan dengan OTP)');
assert.equal(adminRoot[0].path, '/otp-service', 'menu OTP admin membuka /otp-service');
assert.ok(ids(adminChild).includes('topup'), 'pemilik child panel (admin ke-2) juga melihatnya');
const topupAdmin = adminRoot.find((i) => i.id === 'topup');
assert.equal(topupAdmin.path, '/topup', 'menu admin membuka /topup');
assert.equal(topupAdmin.label, 'Topup Game');
assert.ok(!ids(getUserMenuItems(true, true, false)).length, 'admin memang tidak merender daftar menu user (karena itu entri ADMIN_MENU wajib ada)');

// ---------- Nama produk manusiawi (kode penyedia -> nama baca) ----------
assert.ok(existsSync('src/lib/topupDisplayName.ts'), 'helper nama tampilan top up ada');
const dname = read('src/lib/topupDisplayName.ts');
for (const t of ['Membership Mingguan', 'Membership Bulanan', 'Level Up Pass', 'Booyah Pass', 'Weekly Diamond Pass', 'Twilight Pass'])
  assert.ok(dname.includes(t), `token khusus "${t}" mengikuti pricelist resmi penyedia`);
assert.ok(dname.includes("'free-fire': { root: 'FF', kanalDepan: ['M'] }"), 'Free Fire dikunci ke kanal resmi M (daftar 122 kode MFF dari web penyedia)');
assert.ok(!detail.includes('Katalog live dari pricelist penyedia'), 'teks log "Katalog live … diperbarui" dihapus dari halaman detail');
assert.ok(detail.includes('rapihkanKatalog('), 'halaman detail merapikan katalog lewat rapihkanKatalog');
assert.ok(detail.includes('const daftarJenis =') && detail.includes('role="tablist"'), 'halaman detail punya chip wilayah/server (tablist) dari jenis pricelist');
assert.ok(detail.includes('setJenisAktif(j)') && detail.includes('aria-selected={jenisAktif === j}'), 'chip wilayah bisa dipilih & ditandai aktif');
assert.ok(detail.includes('sumber = jenisAktif ? semua.filter((i) => i.jenis === jenisAktif) : semua'), 'pricelist menyesuaikan chip wilayah yang dipilih');
assert.ok(/semuaWilayah: !!jenisAktif,\s*wilayah: jenisAktif\.replace/.test(detail), 'satu chip wilayah aktif = daftar di-scope ke chip itu (kode non-resmi ikut, wilayah lain dibuang)');
assert.match(detail, /my-3\.5 border-t border-slate-200\/80/, 'garis pembatas antara modul Paket & Membership dan daftar produk');
assert.match(detail, /lg:grid-cols-\[minmax\(0,1fr\)_360px\]/, 'desktop: dua kolom (konten + ringkasan konfirmasi sticky)');
assert.match(detail, /lg:max-w-6xl/, 'kontainer detail melebar di desktop');
assert.match(detail, /lg:grid-cols-3/, 'grid produk/paket 3 kolom di desktop');
assert.ok(dname.includes('semuaWilayah?: boolean'), 'rapihkanKatalog punya opsi semuaWilayah');
assert.ok(dname.includes('const wKode = wilayahKode(k);') && dname.includes('if (wKode !== wilayahChipAktif) continue;'), 'kode ber-token wilayah hanya lolos pada chip wilayah yang sama');
assert.ok(dname.includes("const TOKEN_WILAYAH = ['SG', 'MY', 'BR', 'PH', 'TH', 'VN', 'TR', 'RU', 'KR', 'TW', 'BD', 'GLOBAL', 'LATAM']"), 'daftar token wilayah mencakup semua varian chip (SG/MY/BR/PH/TH/VN/TR/RU/KR/TW/BD/Global/Latam)');
assert.ok(dname.includes('wilayah?: string'), 'rapihkanKatalog menerima nama chip wilayah aktif');
assert.ok(detail.includes('Paket &amp; Membership'), 'halaman detail punya seksi Paket & Membership di atas list eceran');
assert.ok(!detail.includes('>Eceran<'), 'judul seksi "Eceran" dihapus sesuai permintaan pemilik');
assert.ok(detail.indexOf('1 · Data akun tujuan') < detail.indexOf('2 · Pilih produk'), 'input ID akun pindah ke atas, sebelum list produk');
assert.ok(detail.includes('scrollIntoView'), 'klik produk menggulir otomatis ke langkah konfirmasi pesanan');
assert.ok(detail.includes(".split('-')"), 'halaman detail mensintesis kartu game baru dari slug katalog live');
assert.ok(!read('src/pages/TopupGamePage.tsx').includes('Halaman detail:'), 'teks bantuan route "/topup/{slug}" dihapus dari halaman daftar game');
assert.ok(dname.includes("const m = /(GLOBAL|LATAM|SG|MY|BR|PH|TH|VN|TR|RU|KR|TW|BD)(?=\\d|$|_|[A-Z])/.exec(kode);"), 'token wilayah terdeteksi di kode lintas game (SG/MY/BR/PH/TH/VN/TR/RU/KR/TW/BD/Global/Latam)');
assert.ok(dname.includes('} else if (!semuaWilayah) continue;'), 'tanpa chip wilayah, kode server luar tetap dibuang (hanya server ID/Indonesia)');
// Uji perilaku helper (type-stripping Node) terhadap kode asli dari /produk/code.
const perilaku = execFileSync(
  process.execPath,
  ['--experimental-strip-types', '--input-type=module', '-e', `
    import { namaTampilanTopup, namaWilayahJenis, rapihkanKatalog } from './src/lib/topupDisplayName.ts';
    const wilayah = [
      ['Free Fire  ID Fast', 'Free Fire Indonesia Fast'],
      ['Free Fire ID Promo', 'Free Fire Indonesia Promo'],
      ['Free Fire PH', 'Free Fire Filipina'],
      ['Free Fire BD', 'Free Fire Bangladesh'],
      ['Free Fire SG', 'Free Fire Singapura'],
      ['Free Fire BR', 'Free Fire Brasil'],
      ['Free Fire MY', 'Free Fire Malaysia'],
      ['Free Fire TH', 'Free Fire Thailand'],
      ['Free Fire Latam', 'Free Fire Amerika Latin'],
      ['Free Fire Level Up Pass', 'Free Fire Level Up Pass'],
    ];
    for (const [asal, ingin] of wilayah) {
      const dapat = namaWilayahJenis(asal);
      if (dapat !== ingin) throw new Error('namaWilayahJenis(' + asal + ') => ' + dapat + ' (ingin ' + ingin + ')');
    }
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
    // Kode kanal nyata bersufiks saluran: "_S2"/"KP" dilebur jadi satu nama produk,
    // server luar tetap dibuang, voucher/tes difilter di PHP (diuji terpisah).
    const pb = rapihkanKatalog('pubg-mobile', [
      { kode: 'PUBGM120_S2', nama: 'PUBGM120_S2', harga: 33312 },
      { kode: 'PUBGMKP120', nama: 'PUBGMKP120', harga: 32713 },
      { kode: 'PUBGM60_S2', nama: 'PUBGM60_S2', harga: 16797 },
      { kode: 'PUBGMRU60', nama: 'PUBGMRU60', harga: 15000 },
    ]);
    if (pb.eceran.length !== 2) throw new Error('PUBG harus 2 eceran (S2+KP lebur, RU dibuang): ' + JSON.stringify(pb.eceran));
    if (pb.eceran[0].nama !== '60 UC' || pb.eceran[1].nama !== '120 UC' || pb.eceran[1].kode !== 'PUBGMKP120') throw new Error('nama/kanal termurah PUBG salah: ' + JSON.stringify(pb.eceran));
    const hsr = rapihkanKatalog('honkai-star-rail', [
      { kode: 'HSR60', nama: 'HSR60', harga: 10508 },
      { kode: 'HSRES2', nama: 'HSRES2', harga: 103743 },
      { kode: 'HSRAP', nama: 'HSRAP', harga: 2163789 },
    ]);
    if (hsr.eceran.length !== 2 || hsr.eceran[0].nama !== '60 Oneiric Shard') throw new Error('HSR eceran salah: ' + JSON.stringify(hsr.eceran));
    if (hsr.paket.length !== 1 || hsr.paket[0].nama !== 'Express Supply 2') throw new Error('HSRES2 = Express Supply 2 (paket): ' + JSON.stringify(hsr.paket));
    const zzz = rapihkanKatalog('zenless-zone-zero', [
      { kode: 'ZZZ60', nama: 'ZZZ60', harga: 19195 },
      { kode: 'ZZZ60M', nama: 'ZZZ60M', harga: 12753 },
      { kode: 'ZZZM', nama: 'ZZZM', harga: 95973 },
    ]);
    if (zzz.eceran.length !== 1 || zzz.eceran[0].nama !== '60 Monochrome' || zzz.eceran[0].kode !== 'ZZZ60M') throw new Error('ZZZ60M kanal lebur ke termurah: ' + JSON.stringify(zzz.eceran));
    if (zzz.paket.length !== 1 || zzz.paket[0].nama !== 'Membership Mingguan') throw new Error('ZZZM = Membership Mingguan: ' + JSON.stringify(zzz.paket));
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
    // Chip wilayah: kode nyata dari pricelist live (FF_SG_25, FFBDS25, FFTH33,
    // FFMYLT, ZFF70, MFFLPR6) tampil di chip-nya masing-masing dengan nama asli
    // penyedia; chip lain tidak ikut; tanpa chip aturan ketat lama tetap berlaku.
    const chip = (jenis, items) => rapihkanKatalog('free-fire', items.map(([kode, nama, harga]) => ({ kode, nama, harga, jenis })), { semuaWilayah: true, wilayah: jenis });
    const sg = chip('Free Fire SG', [['FF_SG_25', '25 Diamonds (SG)', 4414], ['FF_SG_100', '100 Diamonds (SG)', 19102], ['FFBDS25', '25 Diamonds', 3794]]);
    if (sg.eceran.length !== 2 || sg.eceran[0].kode !== 'FF_SG_25') throw new Error('chip SG harus 2 produk SG saja, dapat ' + sg.eceran.map((i) => i.kode).join(','));
    const th = chip('Free Fire TH', [['FFTH33', '33 Diamond', 5253], ['FFTH172', '172 Diamond', 26302]]);
    if (th.eceran.length !== 2 || th.eceran[0].nama !== '33 Diamond') throw new Error('chip TH salah: ' + JSON.stringify(th.eceran));
    const my = chip('Free Fire MY', [['FFMYLT', 'Weekly Lite', 5912]]);
    if (my.eceran.length !== 1 || my.eceran[0].nama !== 'Weekly Lite') throw new Error('chip MY salah: ' + JSON.stringify(my.eceran));
    const promo = chip('Free Fire ID Promo', [['ZFF70', 'Freefire Jalur Promo 70 Diamond', 8010], ['MFFLPR6', '(PROMO) - Level 6', 5093]]);
    if (promo.eceran.length !== 2) throw new Error('chip Promo harus menampilkan jalur promo, dapat ' + promo.eceran.length);
    // Chip ID: kode kanal non-resmi (FF5/FF10) TIDAK dibuang lagi karena daftar
    // sudah ter-scope per chip; pass/membership resmi tetap masuk kelompok paket.
    const fast = chip('Free Fire  ID Fast', [['FF5', '5 Diamond Free Fire', 814], ['FF10', '10 Diamond Free Fire', 1628], ['FFMD20', '20 MD', 20000]]);
    if (fast.eceran.length !== 3) throw new Error('chip ID Fast harus menampilkan kanal FF, dapat ' + fast.eceran.length);
    const murah = chip('Free Fire  ID Murah', [['MFF5', 'Free Fire 5 Diamonds', 734], ['MFFLUP', 'Level Up Pass - Level 30', 13886], ['MFFM', 'Free Fire Mingguan Membership', 24406]]);
    if (murah.eceran.length !== 1 || murah.paket.length !== 2) throw new Error('chip ID Murah: 1 eceran + 2 paket, dapat ' + murah.eceran.length + '+' + murah.paket.length);
    const tanpa = rapihkanKatalog('free-fire', [
      { kode: 'MFF5', nama: 'Free Fire 5 Diamonds', harga: 734 },
      { kode: 'FF5', nama: '5 Diamond Free Fire', harga: 814 },
      { kode: 'FF_SG_25', nama: '25 Diamonds (SG)', harga: 4414 },
      { kode: 'FFTH33', nama: '33 Diamond', harga: 5253 },
    ]);
    if (tanpa.eceran.length !== 1 || tanpa.eceran[0].kode !== 'MFF5') throw new Error('tanpa chip (snapshot/sumber datar) tetap ketat: ' + tanpa.eceran.map((i) => i.kode).join(','));
    // FFM/FFMD20 bukan token wilayah (MY) — tidak boleh tersaring chip wilayah.
    const bukanWilayah = chip('Free Fire  ID Fast', [['FFM', 'Member Mingguan Free Fire', 27132], ['FFMD20', 'MD 20', 20000]]);
    if (bukanWilayah.eceran.length + bukanWilayah.paket.length !== 2) throw new Error('FFM/FFMD20 salah dianggap kode wilayah');
    console.log('OK');
  `],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim();
assert.equal(perilaku, 'OK', 'perilaku nama tampilan & rapihkanKatalog sesuai konvensi pricelist resmi');

console.log('PASS Topup Game: menu tampil untuk pengunjung/user/child panel DAN admin (ADMIN_MENU) + route /topup & /topup/:slug, UI marketplace sesuai spesifikasi (latar #E5E5E7 berpola, tab pill navy, search realtime, grid 3/4/6/8, skeleton, state kosong), 16 game dummy + helper teruji, halaman detail dengan Player/Server ID, dan transaksi lewat proxy server (signature MD5 user_code:secret:ref_id dihitung di server, secret tidak pernah ke browser).');
process.exit(0);