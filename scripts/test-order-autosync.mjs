// Alur pesanan otomatis + penilaian & ulasan:
//  • order.php: sesudah order tersimpan, status langsung disinkron ke provider (pending →
//    proses/selesai/batal); gagal kirim karena saldo provider TIDAK ditampilkan — order tetap
//    "sukses" berstatus pending dengan ID unik berslug PENDING yang tidak pernah dicek;
//  • pengecekan otomatis 1 jam sekali (osx_maybe_run, tanpa cron) untuk pesanan pending/proses
//    ber-ID valid; slug PENDING dilewati;
//  • banner "Pesanan #… sudah selesai … beri penilaian disini" (mobile bawah header, desktop
//    atas), tertutup hanya lewat tombol silang; halaman Beri Penilaian (bintang → komentar
//    cepat sesuai bintang → redirect overview); Papan Penilaian (tabel + ikon keranjang).
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-order-autosync.mjs
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

/* ---------- 1. Backend: lib sinkron status ---------- */
for (const f of ['order_status_lib.php', 'order.php', 'riwayat_pesanan.php', 'reviews.php']) parser.parseCode(read('php-api/' + f), f);
const lib = read('php-api/order_status_lib.php');
assert.match(lib, /function osx_is_pending_slug\(\$id\) \{\s*return stripos\(\(string\)\$id, 'PENDING-'\) !== false;/, 'slug PENDING dikenali');
assert.match(lib, /if \(osx_is_pending_slug\(\$id\)\) return null;/, 'ID slug PENDING tidak punya provider → tidak dicek');
assert.match(lib, /if \(preg_match\('\/\^S2-\[0-9\]\+\$\/', \$id\)\) return 'naizop';/, 'prefix S2 = Naizop');
assert.match(lib, /if \(preg_match\('\/\^\[0-9\]\+\$\/', \$id\)\) return 'fayupedia';/, 'ID angka = Server 1');
assert.match(lib, /return 'selesai';/, 'completed → selesai');
assert.match(lib, /return 'batal';/, 'canceled/refunded → batal');
assert.match(lib, /return 'proses'; \/\/ pending\/processing\/in progress\/partial\/queue\/sebutan lain = sedang berjalan/, 'sebutan status provider apa pun (selain selesai/batal/error) → proses, pesanan tidak menempel di pending');
assert.match(lib, /strpos\(\$s, 'not found'\) !== false/, 'balasan error/"tidak ditemukan" tidak mengubah status');
assert.match(lib, /\[\$GLOBALS\['BASE_URL'\] \. 'status', \$auth \+ \['order' => \$num\]\],/, 'status Server 1: path /status + param order');
assert.match(lib, /\[\$GLOBALS\['BASE_URL'\] \. 'status', \$auth \+ \['id' => \$num\]\],/, 'status Server 1: path /status + param id');
assert.match(lib, /\[\$GLOBALS\['BASE_URL'\], \$auth \+ \['action' => 'status', 'order' => \$num\]\],/, 'status Server 1: action=status + order');
assert.match(lib, /\[\$GLOBALS\['BASE_URL'\], \$auth \+ \['action' => 'status', 'id' => \$num\]\],/, 'status Server 1: action=status + id');
assert.match(lib, /function osx_extract_status\(\$j, \$depth = 0\)/, 'status dicari rekursif di respons bentuk apa pun');
assert.match(lib, /function osx_status_via_proxy\(\$id, \$file = 'status\.php'\)/, 'proxy cek status dipakai dari server');
assert.match(lib, /\$url = 'https:\/\/boosteryuk\.com\/api\/' \. \$file;/, 'proxy dipanggil di host pusat (database & provider sama)');
assert.match(lib, /\$proxyFile = \['fayupedia' => 'status\.php', 'naizop' => 'naizop_status\.php',/, 'dispatch proxy sama dengan halaman Cek Status (per prefix ID)');
assert.match(lib, /\$st = osx_status_via_proxy\(\$id, \$proxyFile\);/, 'percobaan pertama = fungsi cek status halaman Cek Status');
assert.match(lib, /if \(isset\(\$j\[\$want\]\) && is_string\(\$j\[\$want\]\) && \$j\[\$want\] !== ''\) return \$j\[\$want\];/, 'nilai bool pada kunci status diabaikan');
assert.match(lib, /osx_log\("fayupedia status gagal id=\$num body="/, 'balasan mentah dicatat bila semua bentuk gagal');
assert.match(lib, /order_status_log\.txt/, 'jejak sync untuk debugging di hosting');
assert.match(lib, /function osx_sync_user_orders\(\$conn, \$userId, \$limit = 10\)/, 'sync pesanan satu user seusai respons riwayat');
assert.match(lib, /UPDATE riwayat_pesanan SET status = \? WHERE order_id = \? AND status IN \('pending','proses'\)/, 'sync hanya menggeser pending/proses');
assert.match(lib, /if \(\$last && \(time\(\) - strtotime\(\(string\)\$last\)\) < 3600\) return null; \/\/ belum 1 jam/, 'sweep maksimal 1 jam sekali');
assert.match(lib, /WHERE status IN \('pending','proses'\) AND order_id NOT LIKE '%PENDING-%'/, 'sweep melewatkan ID slug PENDING');
assert.match(lib, /CREATE TABLE IF NOT EXISTS order_status_sweep_log/, 'log sweep dibuat otomatis');
assert.match(lib, /catch \(Throwable \$e\) \{\s*return null; \/\/ provider tak membalas/, 'provider diam ≠ gagal: status dibiarkan, dicoba jam berikutnya');

/* ---------- 2. order.php: sync seketika + pesan profesional ---------- */
const order = read('php-api/order.php');
assert.match(order, /if \(is_file\(__DIR__ \. '\/order_status_lib\.php'\)\) require_once __DIR__ \. '\/order_status_lib\.php';/, 'order.php memuat lib sync (toleran deploy parsial)');
assert.match(order, /if \(function_exists\('osx_provider_of'\) && osx_provider_of\(\$provider_order_id\) !== null\)/, 'sync seketika dibungkus function_exists');
assert.ok(!order.includes('Saldo provider kosong'), 'pesan saldo provider tidak lagi dikirim ke user');
assert.match(order, /\$provider_msg = 'Order berhasil masuk antrian\. Status akan diperbarui otomatis\.';/, 'pesan profesional untuk order antrian');
assert.match(order, /\$provider_order_id = 'PENDING-' \. time\(\) \. '-' \. \$user_id \. '-' \. random_int\(100, 999\);/, 'ID antrian unik berslug PENDING');
assert.match(order, /order_pending_log\.txt/, 'alasan saldo provider hanya masuk log server');
assert.match(order, /\$synced = osx_sync_order\(\$conn, \['order_id' => \$provider_order_id, 'status' => \$final_status\], 2\);/, 'cek status seketika (2 percobaan cepat) begitu order tersimpan');
assert.match(order, /"orderId" => \$provider_order_id, "status" => \$final_status,/, 'respons order menyertakan status terbaru');
assert.ok(order.indexOf('osx_sync_order') < order.indexOf('// 7. EMAIL'), 'sync terjadi sebelum respons akhir');
assert.match(order, /osx_maybe_run\(\$conn\);\s*\$conn->close\(\);/, 'sweep 1 jam ikut terpicu seusai order (setelah respons)');
const rip = read('php-api/riwayat_pesanan.php');
assert.match(rip, /osx_sync_user_orders\(\$conn, \$user_id\);/, 'riwayat user: pesanan user ini disinkron sesudah respons');
assert.match(rip, /if \(function_exists\('osx_maybe_run'\)\) osx_maybe_run\(\$conn\);/, 'riwayat user memicu sweep setelah respons dikirim');

/* ---------- 3. reviews.php ---------- */
const rev = read('php-api/reviews.php');
assert.match(rev, /CREATE TABLE IF NOT EXISTS service_reviews/, 'tabel penilaian dibuat otomatis');
assert.match(rev, /UNIQUE KEY uniq_order \(order_id\)/, 'satu penilaian per pesanan');
assert.match(rev, /service_name VARCHAR\(255\) NOT NULL COMMENT 'nama layanan saat dinilai — papan tidak perlu load API'/, 'nama layanan dicatat agar papan tidak load API');
assert.match(rev, /AND NOT EXISTS \(SELECT 1 FROM service_reviews v\s+WHERE v\.order_id COLLATE utf8mb4_unicode_ci = r\.order_id COLLATE utf8mb4_unicode_ci\)/, 'banner hanya untuk pesanan selesai yang belum dinilai (collation eksplisit)');
assert.match(rev, /if \(\$stars < 1 \|\| \$stars > 5\)/, 'bintang divalidasi 1–5');
assert.match(rev, /const RV_TYPE_SQL = "CASE/, 'klasifikasi tipe pesanan sama dengan admin_data.php');
assert.match(rev, /AND \(" \. RV_TYPE_SQL \. "\) = 'smm'/, 'banner/pending hanya pesanan SMM');
assert.match(rev, /if \(\(string\)\$row\['kind'\] !== 'smm'\) rv_out\(\['ok' => false, 'message' => 'Hanya pesanan layanan SMM/, 'submit menolak pesanan non-SMM');
assert.match(rev, /SELECT service_id FROM smm_order_profit WHERE order_id = \? AND user_id = \? LIMIT 1/, 'kunci layanan diambil dari catatan profit order');
assert.match(rev, /if \(\$action === 'list'\)/, 'papan penilaian publik');
assert.match(rev, /\$chk = \$conn->query\("SHOW TABLES LIKE 'service_reviews'"\);/, 'CREATE tabel diverifikasi (mysqli tidak melempar exception)');
assert.match(rev, /ALTER TABLE service_reviews ADD COLUMN service_key/, 'skema parsial dilengkapi otomatis');
assert.match(rev, /reviews_log\.txt/, 'error penilaian dicatat ke reviews_log.txt');
assert.match(rev, /'Gagal memuat pesanan selesai: ' \. \$e->getMessage\(\)/, 'pesan pending menyertakan penyebab SQL');
assert.match(rev, /v\.order_id COLLATE utf8mb4_unicode_ci = r\.order_id COLLATE utf8mb4_unicode_ci/, 'join order_id pakai collation eksplisit (anti illegal mix)');
assert.match(rev, /ALTER TABLE service_reviews CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci/, 'collation tabel disamakan dengan riwayat_pesanan');
assert.match(rev, /FROM riwayat_pesanan r WHERE r\.user_id = \? AND r\.order_id = \? LIMIT 1/, 'lookup submit memakai alias r agar RV_TYPE_SQL valid');
assert.match(rev, /'Gagal memeriksa pesanan: ' \. \$e->getMessage\(\)/, 'error lookup submit tidak ditelan diam-diam');
assert.ok(!rev.includes('catch (Throwable $e) { $row = null; }'), 'catch penelan error lookup submit dihapus');
assert.ok(!read('src/components/OrderReviewBanner.tsx').includes('{order.service_name}'), 'banner tidak menampilkan nama layanan');
assert.match(rev, /CREATE TABLE IF NOT EXISTS service_reviews_dismissed/, 'tabel penanda banner ditutup dibuat otomatis');
assert.match(rev, /AND NOT EXISTS \(SELECT 1 FROM service_reviews_dismissed d/, 'pending melewatkan pesanan yang bannernya sudah ditutup');
assert.match(rev, /INSERT IGNORE INTO service_reviews_dismissed/, 'action dismiss menyimpan penanda per user');
assert.match(read('src/services/reviewsApi.ts'), /dismiss: \(orderId: string\) => call/, 'klien punya action dismiss');
assert.match(read('src/components/OrderReviewBanner.tsx'), /icon-banner-selesai\.gif/, 'ikon banner = GIF centang dari pemilik');
assert.match(read('src/pages/ReviewSubmitPage.tsx'), /icon-beri-penilaian\.gif/, 'ikon halaman penilaian = GIF dokumen bintang dari pemilik');
assert.match(read('src/pages/ReviewSubmitPage.tsx'), /\/404\|405\/\.test\(r\.message/, 'pesan 500 ditampilkan apa adanya sebagai diagnosa');

/* ---------- 4. Frontend: api, banner, route, menu ---------- */
const api = read('src/services/reviewsApi.ts');
assert.match(api, /pending: \(\) => call<\{ orders\?: PendingReviewOrder\[\]; user_id\?: number \}>\(\{ action: 'pending' }\)/, 'api pending untuk banner');
assert.match(api, /list: \(\) => call<\{ reviews\?: ReviewItem\[\] \}>\(\{ action: 'list' }\)/, 'api list untuk papan');
const banner = read('src/components/OrderReviewBanner.tsx');
assert.match(banner, /const dismissedThisSession = new Set<string>\(\);/, 'lapis sesi untuk penutupan banner');
assert.match(banner, /void reviewsApi\.dismiss\(id\);/, 'penutupan banner disimpan server-side (tahan lintas perangkat)');
assert.match(rev, /'orders' => \$rows, 'user_id' => \$uid/, 'pending membalas user_id peminta untuk verifikasi cakupan');
assert.match(read('php-api/riwayat_pesanan.php'), /"user_id" => \(int\)\$user_id, "orders"/, 'riwayat_pesanan membalas user_id terautentikasi');
assert.match(banner, /function sameOwner\(/, 'banner memverifikasi kepemilikan daftar pesanan');
assert.match(banner, /if \(rj\?\.ok && sameOwner\(rj, uid\)\)/, 'jalur cadangan wajib membawa user_id yang cocok (file lama bocor ditolak)');
assert.match(banner, /className="fixed left-1\/2 top-\[76px\] z-\[80\] w-\[min\(92vw,600px\)\] -translate-x-1\/2 md:top-4"/, 'mobile di bawah header (76px), desktop di layar atas');
assert.match(banner, /aria-label="Tutup notifikasi"/, 'tombol silang kecil pojok kanan atas');
assert.match(banner, /sudah selesai\./, 'teks notifikasi pesanan selesai');
assert.match(banner, /<Link\s*to=\{`\/beri-penilaian\?order=/, 'tautan "disini" ke halaman Beri Penilaian');
assert.match(banner, /className="font-bold text-emerald-700 underline underline-offset-2/, 'teks "disini" bergaris bawah');
assert.match(banner, /by-review-banner-dismissed/, 'banner tetap muncul sampai ditutup (disimpan per ID)');
assert.match(banner, /window\.setInterval\(load, 30_000\)/, 'banner mengecek ulang tiap 30 detik');
assert.match(banner, /document\.addEventListener\('visibilitychange', wake\);/, 'banner segar saat tab kembali aktif');
assert.match(banner, /window\.addEventListener\('focus', wake\);/, 'banner segar saat jendela mendapat fokus');
assert.match(read('src/components/Layout.tsx'), /<OrderReviewBanner \/>/, 'banner dipasang di Layout global');
const app = read('src/App.tsx');
assert.match(app, /<Route path="beri-penilaian" element=\{<ProtectedRoute><ReviewSubmitPage \/><\/ProtectedRoute>\} \/>/, 'route halaman penilaian');
assert.match(app, /<Route path="papan-penilaian" element=\{<ReviewBoardPage \/>} \/>/, 'route papan penilaian');
const side = read('src/components/SideMenu.tsx');
assert.match(side, /\{ id: 'papan-penilaian', icon: Star, label: 'Papan Penilaian', desc: 'Bintang & ulasan user' \}/, 'menu Papan Penilaian');
assert.match(side, /'papan-penilaian': '\/papan-penilaian',/, 'path menu papan');
const submit = read('src/pages/ReviewSubmitPage.tsx');
assert.match(submit, /if \(stars <= 2\) return \['Pengiriman Lama', 'Drop'\];/, 'bintang rendah → komentar negatif');
assert.match(submit, /if \(stars === 3\) return \['Pengiriman Lama', 'Non Drop'\];/, 'bintang tiga → campuran');
assert.match(submit, /return \['Pengiriman Cepat', 'Non Drop', 'Rekomendasi'\];/, 'bintang tinggi → komentar positif');
assert.match(submit, /navigate\('\/overview', \{ replace: true \}\);/, 'selesai menilai → redirect overview');
assert.ok(!submit.includes('<textarea'), 'kolom ulasan bebas dihapus — hanya komentar cepat');
assert.match(submit, /const \[chips, setChips\] = useState<string\[\]>\(\[\]\);/, 'ulasan = kumpulan komentar cepat terpilih');
assert.match(submit, /reviewsApi\.submit\(order\.order_id, stars, chips\.join\(', '\)\)/, 'payload ulasan = chip terpilih digabung');
assert.match(submit, /Ulasan terkirim:/, 'pratinjau ulasan dari chip terpilih');
assert.match(banner, /function isSmmOrder\(/, 'banner menyaring pesanan non-SMM di klien');
const board = read('src/pages/ReviewBoardPage.tsx');
for (const h of ['Username', 'Bintang', 'Layanan', 'Ulasan', 'Aksi']) assert.ok(board.includes(`>${h}</th>`), `kolom papan: ${h}`);
assert.match(board, /<ShoppingCart className="h-3\.5 w-3\.5" strokeWidth=\{2\.4\} \/>/, 'ikon keranjang sama seperti overview');
assert.match(board, /navigate\(r\.service_key \? `\/layanan\?service=/, 'tombol aksi membuka pesanan layanan yang dinilai');

/* ---------- 5. Perilaku jsdom: banner + halaman penilaian ---------- */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
const dir = mkdtempSync(path.join(tmpdir(), 'order-autosync-')); let root = null;
try {
  const { outputFiles } = await build({
    stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter,useLocation} from 'react-router-dom';export {default as Banner} from './src/components/OrderReviewBanner';export {default as Submit, quickComments} from './src/pages/ReviewSubmitPage';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl', '.mp3': 'dataurl', '.webp': 'dataurl', '.gif': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"', __MUSIC_URL__: '"/boosteryuk-official-music.mp3"' },
    plugins: [{ name: 'mocks', setup(b) {
      b.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'mock' }));
      b.onResolve({ filter: /components\/Seo$/ }, () => ({ path: 'seo', namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, (a) => ({ contents: a.path === 'seo' ? 'export default function Seo(){return null;}' : 'export const useAuth=()=>globalThis.__auth;', resolveDir: process.cwd() }));
    } }],
  });
  const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
  const { createElement: h, act, createRoot, MemoryRouter, useLocation, Banner, Submit, quickComments } = require(file);

  // quick comments murni
  assert.deepEqual(quickComments(1), ['Pengiriman Lama', 'Drop']);
  assert.deepEqual(quickComments(2), ['Pengiriman Lama', 'Drop']);
  assert.deepEqual(quickComments(3), ['Pengiriman Lama', 'Non Drop']);
  assert.deepEqual(quickComments(4), ['Pengiriman Cepat', 'Non Drop', 'Rekomendasi']);
  assert.deepEqual(quickComments(5), ['Pengiriman Cepat', 'Non Drop', 'Rekomendasi']);

  globalThis.__auth = { user: { id: 9 }, refresh: async () => {} };
  let submitted = null;
  globalThis.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body?.action === 'pending') return new Response(JSON.stringify({ ok: true, orders: [{ order_id: '123456', service_name: 'Followers Instagram' }] }));
    if (body?.action === 'submit') { submitted = body; return new Response(JSON.stringify({ ok: true })); }
    return new Response(JSON.stringify({ ok: true, reviews: [] }));
  };
  const mainFetch = globalThis.fetch;

  /* banner muncul, link disini, ditutup lewat silang */
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, null, h(Banner))));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  let txt = document.getElementById('root').textContent;
  assert.ok(txt.includes('Pesanan #123456 sudah selesai.'), 'banner menyebut ID pesanan selesai');
  assert.ok(txt.includes('Bagaimana pendapatmu? Beri penilaian disini'), 'ajakan penilaian dengan tautan disini');
  assert.ok(!txt.includes('Followers Instagram'), 'nama layanan tidak ditampilkan di banner');
  const link = document.querySelector('#root a[href*="beri-penilaian"]');
  assert.ok(link, 'tautan ke halaman beri penilaian ada');
  await act(async () => document.querySelector('#root button[aria-label="Tutup notifikasi"]').click());
  assert.equal(document.getElementById('root').textContent, '', 'banner hilang setelah ditutup');
  assert.ok(JSON.parse(localStorage.getItem('by-review-banner-dismissed')).includes('123456'), 'penutupan disimpan per ID');
  await act(async () => root.unmount()); root = null;

  /* banner yang sudah ditutup TIDAK muncul lagi saat mount ulang (simulasi refresh halaman) */
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, null, h(Banner))));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(document.getElementById('root').textContent, '', 'banner tertutup tidak muncul lagi setelah refresh (mount ulang)');
  await act(async () => root.unmount()); root = null;

  /* banner jalur cadangan: reviews.php 404 → riwayat pesanan selesai tetap memunculkan banner */
  localStorage.removeItem('by-review-banner-dismissed');
  const fallbackFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('riwayat_pesanan.php')) return new Response(JSON.stringify({ ok: true, user_id: 9, orders: [
      { order_id: 'OTP1234567', service_name: 'Nomor OTP WhatsApp • Indonesia', status: 'selesai' },
      { order_id: '777001', service_name: 'Followers Instagram', status: 'selesai' },
      { order_id: '777002', service_name: 'Like TikTok', status: 'proses' },
    ] }));
    return new Response(JSON.stringify({ ok: false, message: 'Server membalas HTTP 404.' }), { status: 404 });
  };
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, null, h(Banner))));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  txt = document.getElementById('root').textContent;
  assert.ok(txt.includes('Pesanan #777001 sudah selesai.'), 'banner tetap muncul lewat jalur cadangan riwayat');
  assert.ok(!txt.includes('777002'), 'pesanan non-selesai tidak memunculkan banner');
  assert.ok(!txt.includes('OTP1234567'), 'pesanan OTP (non-SMM) tidak ditawarkan untuk dinilai');
  await act(async () => root.unmount()); root = null;

  /* jalur cadangan dengan user_id LAIN (mis. file lama bocor) → banner tidak tampil */
  localStorage.removeItem('by-review-banner-dismissed');
  globalThis.fetch = async (url) => {
    if (String(url).includes('riwayat_pesanan.php')) return new Response(JSON.stringify({ ok: true, user_id: 424242, orders: [
      { order_id: '888001', service_name: 'Followers Instagram', status: 'selesai' },
    ] }));
    return new Response(JSON.stringify({ ok: false, message: 'Server membalas HTTP 404.' }), { status: 404 });
  };
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, null, h(Banner))));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(document.getElementById('root').textContent, '', 'banner tidak tampil bila cakupan riwayat bukan milik sesi ini');
  assert.ok(!document.getElementById('root').textContent.includes('888001'), 'pesanan user lain tidak ditawarkan');
  await act(async () => root.unmount()); root = null;

  /* pending dengan user_id tidak cocok → banner tidak tampil */
  localStorage.removeItem('by-review-banner-dismissed');
  globalThis.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body?.action === 'pending') return new Response(JSON.stringify({ ok: true, user_id: 555, orders: [{ order_id: '999001', service_name: 'Followers Instagram' }] }));
    return new Response(JSON.stringify({ ok: true, reviews: [] }));
  };
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, null, h(Banner))));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(document.getElementById('root').textContent, '', 'banner tidak tampil bila pending membalas user_id lain');
  await act(async () => root.unmount()); root = null;
  globalThis.fetch = mainFetch;

  /* halaman penilaian: bintang → komentar cepat → submit → redirect overview */
  localStorage.removeItem('by-review-banner-dismissed');
  let pathname = '';
  function Probe() { pathname = useLocation().pathname; return null; }
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, { initialEntries: ['/beri-penilaian?order=123456'] }, h(Probe), h(Submit))));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  const star = (n) => document.querySelector(`#root button[aria-label="${n} bintang"]`);
  await act(async () => star(2).click());
  txt = document.getElementById('root').textContent;
  assert.ok(txt.includes('Pengiriman Lama') && txt.includes('Drop'), 'bintang 2 → komentar negatif');
  assert.ok(!txt.includes('Rekomendasi'), 'bintang 2 tanpa komentar positif');
  await act(async () => star(5).click());
  txt = document.getElementById('root').textContent;
  assert.ok(txt.includes('Pengiriman Cepat') && txt.includes('Non Drop') && txt.includes('Rekomendasi'), 'bintang 5 → komentar positif');
  const chip = [...document.querySelectorAll('#root button')].find((b) => b.textContent === 'Rekomendasi');
  await act(async () => chip.click());
  assert.equal(chip.getAttribute('aria-pressed'), 'true', 'chip terpilih bertanda aria-pressed');
  assert.ok(document.getElementById('root').textContent.includes('Ulasan terkirim: Rekomendasi'), 'pratinjau ulasan menampilkan chip terpilih');
  assert.equal(document.querySelector('#root textarea'), null, 'tidak ada kolom ulasan bebas');
  const send = [...document.querySelectorAll('#root button')].find((b) => b.textContent.includes('Kirim penilaian'));
  await act(async () => send.click());
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.deepEqual(submitted, { token: '', action: 'submit', order_id: '123456', stars: 5, review: 'Rekomendasi' }, 'payload submit penilaian');
  assert.equal(pathname, '/overview', 'user diarahkan ke overview setelah menilai');
  await act(async () => root.unmount()); root = null;

  console.log('PASS Alur pesanan otomatis: sync status seketika + sweep 1 jam (slug PENDING dilewati, saldo provider tidak ditampilkan), banner pesanan selesai → Beri Penilaian (bintang → komentar cepat → redirect overview), dan Papan Penilaian dengan ikon keranjang.');
} finally {
  if (root) { const { act } = require(path.join(dir, 'bundle.cjs')); await act(async () => root.unmount()); }
  dom.window.close(); rmSync(dir, { recursive: true, force: true });
}
process.exit(0);
