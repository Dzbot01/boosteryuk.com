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
assert.match(lib, /\[\$GLOBALS\['BASE_URL'\] \. 'status', \$key\],/, 'status Server 1: bentuk path /status');
assert.match(lib, /\[\$GLOBALS\['BASE_URL'\], \$key \+ \['action' => 'status'\]\],/, 'status Server 1: fallback param action=status');
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
assert.match(order, /if \(function_exists\('osx_provider_of'\) && osx_provider_of\(\$provider_order_id\) !== null\) \{\s*try \{\s*\$synced = osx_sync_order\(\$conn, \['order_id' => \$provider_order_id, 'status' => \$final_status\]\);/, 'cek status dijalankan otomatis begitu order tersimpan');
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
assert.match(rev, /AND NOT EXISTS \(SELECT 1 FROM service_reviews v WHERE v\.order_id = r\.order_id\)/, 'banner hanya untuk pesanan selesai yang belum dinilai');
assert.match(rev, /if \(\$stars < 1 \|\| \$stars > 5\)/, 'bintang divalidasi 1–5');
assert.match(rev, /SELECT service_id FROM smm_order_profit WHERE order_id = \? AND user_id = \? LIMIT 1/, 'kunci layanan diambil dari catatan profit order');
assert.match(rev, /if \(\$action === 'list'\)/, 'papan penilaian publik');

/* ---------- 4. Frontend: api, banner, route, menu ---------- */
const api = read('src/services/reviewsApi.ts');
assert.match(api, /pending: \(\) => call<\{ orders\?: PendingReviewOrder\[\] \}>\(\{ action: 'pending' }\)/, 'api pending untuk banner');
assert.match(api, /list: \(\) => call<\{ reviews\?: ReviewItem\[\] \}>\(\{ action: 'list' }\)/, 'api list untuk papan');
const banner = read('src/components/OrderReviewBanner.tsx');
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
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl', '.mp3': 'dataurl', '.webp': 'dataurl' },
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

  /* banner muncul, link disini, ditutup lewat silang */
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, null, h(Banner))));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  let txt = document.getElementById('root').textContent;
  assert.ok(txt.includes('Pesanan #123456 sudah selesai.'), 'banner menyebut ID pesanan selesai');
  assert.ok(txt.includes('Bagaimana pendapatmu? Beri penilaian disini'), 'ajakan penilaian dengan tautan disini');
  const link = document.querySelector('#root a[href*="beri-penilaian"]');
  assert.ok(link, 'tautan ke halaman beri penilaian ada');
  await act(async () => document.querySelector('#root button[aria-label="Tutup notifikasi"]').click());
  assert.equal(document.getElementById('root').textContent, '', 'banner hilang setelah ditutup');
  assert.ok(JSON.parse(localStorage.getItem('by-review-banner-dismissed')).includes('123456'), 'penutupan disimpan per ID');
  await act(async () => root.unmount()); root = null;

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
  assert.ok(document.querySelector('#root textarea').value.includes('Rekomendasi'), 'chip mengisi ulasan');
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
