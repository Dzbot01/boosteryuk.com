/* Test: (1) produk ROBLOX muncul di halaman top up game — kanal kategori "Voucher Game"
 * ikut katalog, alias/nama/prefiks Roblox tersedia, dan kode kanal voucher-only tidak
 * disaring sebagai duplikat; (2) aturan API TokoVoucher untuk status transaksi:
 * SEMUA HTTP error + NETWORK TIMEOUT diset PENDING (bukan gagal, tanpa refund), status
 * final menunggu callback penyedia atau cek berkala tiap 10 menit (action=pending_sync),
 * dan saldo penyedia yang kurang/kosong TIDAK ditampilkan sebagai error di halaman top up.
 *
 * Logika filter PHP dicerminkan di JS dengan tabel (alias, prefiks, kata kunci) yang
 * DIEKSTRAK dari sumber php-api/tokovoucher.php, jadi test ini ikut berubah bila
 * aturan di server berubah — bukan daftar harapan yang ditulis ulang manual.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, '..');
const read = (f) => readFileSync(path.join(root, f), 'utf8');

const php = read('php-api/tokovoucher.php');

/* ======================= 1. AKAR MASALAH ROBLOX ======================= */

// 1a. Kanal kategori: penyedia punya "Topup Game" DAN "Voucher Game"; sebelumnya hanya
//     kategori ber-substring "topup" yang lolos sehingga semua produk Roblox terbuang.
assert.match(
  php,
  /if \(\$cat !== '' && stripos\(\$cat, 'topup'\) === false && stripos\(\$cat, 'voucher game'\) === false\) continue;/,
  'katalog top up game menerima kanal kategori "Voucher Game" (tempat produk Roblox)',
);
const badanItemsFull = php.slice(php.indexOf('function tv_items_from_full('), php.indexOf('function tv_layanan_from_full('));
assert.match(badanItemsFull, /voucher game/, 'filter kategori di tv_items_from_full menyebut kanal voucher game');

// 1b. Alias + nama tampil Roblox (label penyedia: "Voucher Roblox").
const badanAlias = php.slice(php.indexOf('function tv_game_alias_map('), php.indexOf('function tv_game_aliases('));
assert.match(badanAlias, /'roblox'\s+=> \['roblox', 'rbx', 'robux'\]/, 'tabel alias game punya kunci roblox (roblox/rbx/robux)');
const badanDisplay = php.slice(php.indexOf('function tv_game_display('), php.indexOf('function tv_slugify('));
assert.match(badanDisplay, /'roblox' => 'Roblox'/, 'nama tampil kartu = "Roblox"');

// 1c. Prefiks kode produk Roblox ada di kanal voucher (bukan kanal topup).
const badanPrefiks = php.slice(php.indexOf('function tv_code_prefix_prefiks('), php.indexOf('/** Daftar game ber-kanal Topup Game'));
assert.match(badanPrefiks, /'voucher' => \[[\s\S]{0,300}?'ROBLOX' => 'roblox'[\s\S]{0,200}?'RBX' => 'roblox'/, 'prefiks kode Roblox (ROBLOX/RBLX/RBX/RBUX/ROBUX) terdaftar');
assert.match(php, /function tv_game_kanal_topup\(\) \{\s*\n\s*return array_values\(array_unique\(tv_code_prefix_prefiks\(\)\['topup'\]\)\);/, 'daftar game ber-kanal Topup Game diturunkan dari tabel prefiks (tidak dobel)');

// 1d. Kode kanal voucher-only tidak dibuang oleh aturan "V…" / token wilayah.
const badanKodeOk = php.slice(php.indexOf('function tv_kode_katalog_ok('), php.indexOf('/**\n * Prefiks kode produk'));
assert.match(badanKodeOk, /\$voucherOnly = \$gKode !== '' && !in_array\(\$gKode, tv_game_kanal_topup\(\), true\);/, 'game kanal voucher-only dikenali dari prefiks kode');
assert.match(badanKodeOk, /if \(!\$izinkanWilayah && !\$voucherOnly && preg_match\('\/\(RU\|SG\|MY\|BR\|PH\|LATAM\|GLOBAL\)\(\[0-9\]\|\$\)\/', \$k\)\) return false;/, 'token wilayah di kode tidak membuang produk voucher-only');
assert.match(badanKodeOk, /if \(strpos\(\$k, 'V'\) === 0 && \$gKode !== '' && !\$voucherOnly\) return false;/, 'kode "V…" tetap dibuang untuk game yang punya kanal Topup Game (duplikat grosir)');

// 1e. Cache katalog/layanan diversi ulang supaya filter baru tidak tertutup cache 6 jam.
assert.ok(php.includes("__all_v4__") && !php.includes("__all_v3__"), 'kunci cache katalog = __all_v4__ (cache lama tidak menutupi Roblox)');
assert.ok(php.includes("__layanan_v2__") && !php.includes("__layanan_v1__"), 'kunci cache layanan = __layanan_v2__');

/* ---- Cermin logika filter PHP (tabel diekstrak dari sumber) ---- */
const aliasMap = {};
for (const m of badanAlias.matchAll(/'([a-z0-9]+)'\s+=> \[([^\]]*)\]/g)) {
  aliasMap[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}
const prefiks = { voucher: {}, topup: {} };
for (const kanal of ['voucher', 'topup']) {
  const blok = badanPrefiks.slice(badanPrefiks.indexOf(`'${kanal}' => [`) + `'${kanal}' => [`.length);
  const isi = blok.slice(0, blok.indexOf('],'));
  for (const m of isi.matchAll(/'([A-Z0-9]+)' => '([^']+)'/g)) prefiks[kanal][m[1]] = m[2];
}
const kanalTopup = [...new Set(Object.values(prefiks.topup))];
const kodePrefiksGame = (kode) => {
  const k = String(kode).toUpperCase();
  for (const kanal of ['voucher', 'topup']) for (const [p, g] of Object.entries(prefiks[kanal])) if (k.startsWith(p)) return g;
  return '';
};
const kodeKatalogOk = (kode, izinkanWilayah = false) => {
  const k = String(kode).toUpperCase();
  if (!k || k.includes('CEK')) return false;
  const g = kodePrefiksGame(k.startsWith('V') ? k.slice(1) : k);
  const voucherOnly = g !== '' && !kanalTopup.includes(g);
  if (!izinkanWilayah && !voucherOnly && /(RU|SG|MY|BR|PH|LATAM|GLOBAL)([0-9]|$)/.test(k)) return false;
  if (k.startsWith('V') && g !== '' && !voucherOnly) return false;
  return true;
};
const gameKeyOfLabel = (label) => {
  const norm = String(label).toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (!norm) return '';
  for (const [key, aliases] of Object.entries(aliasMap))
    for (const a of aliases) if (a.length >= 3 && norm.includes(a)) return key;
  return '';
};
const kategoriLolos = (cat) => {
  const c = String(cat);
  if (!c) return true;
  const l = c.toLowerCase();
  return l.includes('topup') || l.includes('voucher game');
};

// Payload penyedia tiruan dengan BENTUK asli /member/produk/full (kategori "Voucher Game"
// = tempat Roblox berada, sesuai diagnostik kategori_penyedia dari server live).
const produkContoh = [
  { kode: 'RBX100', cat: 'Voucher Game', op: 'Voucher Roblox', harga: 21000 },
  { kode: 'RBX400', cat: 'Voucher Game', op: 'Voucher Roblox', harga: 78000 },
  { kode: 'ROBUX800', cat: 'Voucher Game', op: 'Voucher Roblox', harga: 152000 },
  { kode: 'VRBX1700', cat: 'Voucher Game', op: 'Voucher Roblox', harga: 310000 },
  { kode: 'MFF5', cat: 'Topup Game', op: 'Free Fire', harga: 756 },
  { kode: 'VPUBGGCOIN500', cat: 'Voucher Game', op: 'PUBG Mobile', harga: 65000 },
  { kode: 'FFSG100', cat: 'Topup Game', op: 'Free Fire', harga: 12000 },
  { kode: 'TSEL5', cat: 'Pulsa', op: 'Pulsa Telkomsel', harga: 5000 },
  { kode: 'PLN20', cat: 'PLN', op: 'Token PLN', harga: 20000 },
  { kode: 'CEKMB1', cat: 'Topup Game', op: 'Mobile Legends', harga: 1 },
];
const saring = (p, aturanLama = false) => {
  const c = String(p.cat).toLowerCase();
  const lolosKat = aturanLama ? c.includes('topup') : kategoriLolos(p.cat);
  return lolosKat && kodeKatalogOk(p.kode);
};
const kelompokkan = (rows) => {
  const g = {};
  for (const p of rows) {
    let key = gameKeyOfLabel(p.op);
    if (!key) key = 'label:' + p.op.toLowerCase().replace(/[^a-z0-9]+/g, '');
    (g[key] ||= { key, jumlah: 0, termurah: 0, kode: [] });
    g[key].jumlah++;
    g[key].kode.push(p.kode);
    if (!g[key].termurah || p.harga < g[key].termurah) g[key].termurah = p.harga;
  }
  return g;
};

// Sebelum perbaikan: Roblox HILANG (inilah yang dilaporkan user).
const lama = kelompokkan(produkContoh.filter((p) => saring(p, true)));
assert.ok(!('roblox' in lama), 'aturan lama (hanya kategori "topup") memang membuang seluruh produk Roblox');
// Sesudah perbaikan: Roblox muncul sebagai satu kartu berisi semua denominasinya.
const baru = kelompokkan(produkContoh.filter((p) => saring(p)));
assert.ok('roblox' in baru, 'kartu Roblox terbentuk dari kanal Voucher Game');
assert.equal(baru.roblox.jumlah, 4, 'semua 4 produk Roblox lolos (RBX100, RBX400, ROBUX800, VRBX1700)');
assert.equal(baru.roblox.termurah, 21000, 'harga termurah kartu Roblox = harga asli penyedia');
assert.match(gameKeyOfLabel('Voucher Roblox'), /roblox/, 'label penyedia "Voucher Roblox" dipetakan ke kunci roblox');
// Tidak ada duplikasi & tidak ada layanan non-game yang nyelonong ke grid top up.
assert.ok(!baru.roblox.kode.some((k) => k.startsWith('VPUBG')), 'kode voucher PUBG tidak ikut kartu Roblox');
assert.equal(kelompokkan(produkContoh.filter((p) => saring(p))).freefire.jumlah, 1, 'Free Fire tetap 1 produk ID (FFSG100 bertoken wilayah dibuang, VPUBG… dibuang)');
assert.ok(!('pulsa' in baru) && !Object.keys(baru).some((k) => k.includes('pln')), 'produk Pulsa/PLN tidak masuk katalog top up game');
assert.ok(!baru.freefire.kode.includes('CEKMB1'), 'kode tes penyedia (CEK…) tetap dibuang');

// 1f. Klien: kartu Roblox tersedia untuk rute/sitemap TANPA kode karangan.
const tmp = mkdtempSync(path.join(tmpdir(), 'rbx-'));
const entry = path.join(tmp, 'entry.ts');
writeFileSync(entry, [
  `export { TOPUP_GAMES } from ${JSON.stringify(path.join(root, 'src/data/topupGames.ts'))};`,
  `export { namaTampilanTopup, rapihkanKatalog } from ${JSON.stringify(path.join(root, 'src/lib/topupDisplayName.ts'))};`,
].join('\n'));
const out = buildSync({
  entryPoints: [entry],
  bundle: true, write: false, format: 'cjs', platform: 'node',
  loader: { '.css': 'empty', '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
});
const bundle = path.join(tmp, 'bundle.cjs');
writeFileSync(bundle, out.outputFiles[0].text);
const mod = await import(bundle);
const { TOPUP_GAMES, namaTampilanTopup, rapihkanKatalog } = mod;
const roblox = TOPUP_GAMES.find((g) => g.slug === 'roblox');
assert.ok(roblox, 'TOPUP_GAMES punya kartu Roblox (slug /topup/roblox)');
assert.equal(roblox.nama, 'Roblox', 'nama kartu Roblox');
assert.deepEqual(roblox.produk, [], 'kartu Roblox TIDAK berisi kode karangan — katalog ditarik live dari server');
// Penamaan produk di halaman detail lewat rapihkanKatalog (satuan resmi Roblox = Robux).
assert.equal(namaTampilanTopup('roblox', 'RBX100', 'Roblox 100 Robux'), 'Roblox 100 Robux', 'nama asli penyedia dipakai bila dikirim');
const rapih = rapihkanKatalog('roblox', [
  { kode: 'RBX100', nama: 'RBX100', harga: 21000 },
  { kode: 'ROBUX800', nama: 'ROBUX800', harga: 152000 },
  { kode: 'VRBX1700', nama: 'VRBX1700', harga: 310000 },
]);
assert.equal(rapih.eceran.length, 3, 'semua denominasi Roblox tampil sebagai eceran (termasuk kode kanal voucher VRBX…)');
assert.deepEqual(rapih.eceran.map((i) => i.nama), ['100 Robux', '800 Robux', '1700 Robux'], 'nama Roblox terbaca manusia (satuan Robux) & urut harga');
assert.equal(rapih.paket.length, 0, 'tidak ada kelompok paket karangan untuk Roblox');

// 1g. Halaman Roblox ikut sitemap + prerender SEO.
const sitemap = read('public/sitemap.xml');
assert.ok(sitemap.includes('<loc>https://boosteryuk.com/topup/roblox</loc>'), 'sitemap memuat /topup/roblox');
const pagesJson = JSON.parse(read('src/seo/pages.json'));
const seoRoblox = pagesJson.topupGames.find((g) => g.slug === 'roblox');
assert.ok(seoRoblox && seoRoblox.title && seoRoblox.description, 'pages.json punya SEO halaman Roblox');
assert.match(seoRoblox.intro.join(' '), /Voucher Game/, 'teks SEO menjelaskan Roblox berasal dari kanal Voucher Game penyedia');

/* ============ 2. ATURAN STATUS: HTTP ERROR & TIMEOUT = PENDING ============ */

// 2a. Fungsi alasan PENDING ada + kata kuncinya diekstrak untuk diuji sebagai logika.
const badanAlasan = php.slice(php.indexOf('function tv_alasan_pending('), php.indexOf('/** Riwayat pesanan:'));
assert.match(badanAlasan, /if \(\$e !== ''\) return 'jaringan penyedia bermasalah/, 'gagal jaringan (CURL error) = PENDING');
assert.match(badanAlasan, /if \(\$hc === 0\) return 'penyedia tidak membalas sampai batas waktu \(timeout\)'/, 'network timeout (HTTP 0) = PENDING');
assert.match(badanAlasan, /if \(\$hc >= 400\) return 'HTTP ' \. \$hc \. ' dari penyedia';/, 'SEMUA HTTP error 4xx/5xx = PENDING');
assert.match(badanAlasan, /in_array\(\$st, \['pending', 'processing', 'diproses', 'unknown', ''\], true\)/, 'status menunggu/tak dikenal = PENDING');
const kataKunci = [...badanAlasan.slice(badanAlasan.indexOf('foreach ([')).matchAll(/'([^']+)'/g)].map((m) => m[1]);
assert.ok(kataKunci.includes('saldo') && kataKunci.includes('limit'), 'kata kunci saldo/limit penyedia ikut dianggap belum pasti');
assert.match(php, /if \(!defined\('TV_PENDING_SYNC_INTERVAL'\)\) define\('TV_PENDING_SYNC_INTERVAL', 600\);/, 'interval cek berkala = 600 detik (10 menit) sesuai aturan penyedia');

// Cermin tv_alasan_pending di JS (kata kunci dari sumber) + tabel keputusan.
const alasanPending = (st, pesan, httpCode = 0, curlErr = '') => {
  const s = String(st || '').toLowerCase().trim();
  const p = String(pesan || '').toLowerCase().trim();
  const e = String(curlErr || '').trim();
  if (e) return `jaringan penyedia bermasalah (${e})`;
  const hc = Number(httpCode) || 0;
  if (hc === 0) return 'penyedia tidak membalas sampai batas waktu (timeout)';
  if (hc >= 400) return `HTTP ${hc} dari penyedia`;
  if (['pending', 'processing', 'diproses', 'unknown', ''].includes(s)) return 'status menunggu dari penyedia' + (p ? `: ${p}` : '');
  for (const kw of kataKunci) if (kw && p.includes(kw)) return `penyedia belum memastikan transaksi: ${p}`;
  return '';
};
// HTTP error apa pun -> PENDING (aturan docs yang ditempel user).
for (const hc of [400, 401, 403, 404, 429, 500, 502, 503, 504])
  assert.ok(alasanPending('error', 'Internal Server Error', hc) !== '', `HTTP ${hc} diperlakukan sebagai PENDING`);
// Network timeout / gagal jaringan -> PENDING.
assert.ok(alasanPending('', '', 0, 'Connection timed out after 25001 milliseconds').startsWith('jaringan'), 'CURL timeout = PENDING');
assert.equal(alasanPending('', '', 0, '').includes('timeout'), true, 'tanpa balasan sama sekali = PENDING (timeout)');
// SALDO PENYEDIA kurang/kosong -> PENDING, bukan error ke user.
assert.ok(alasanPending('error', 'Saldo Tidak Cukup', 200) !== '', 'saldo penyedia kurang = PENDING (bukan gagal)');
assert.ok(alasanPending('error', 'Insufficient balance', 200) !== '', 'balance penyedia kosong = PENDING');
assert.ok(alasanPending('gagal', 'Limit transaksi tercapai', 200) !== '', 'limit di sisi penyedia = PENDING');
assert.ok(alasanPending('unknown', '', 200) !== '', 'status tak dikenal = PENDING');
assert.ok(alasanPending('pending', '', 200) !== '', 'status pending penyedia = PENDING');
// Penolakan PASTI tetap gagal (saldo user dikembalikan) — tidak semua hal jadi pending.
assert.equal(alasanPending('gagal', 'Nomor tujuan tidak terdaftar', 200), '', 'penolakan pasti (tujuan salah) tetap gagal + refund');
assert.equal(alasanPending('error', 'Ip Not Allow', 200), '', 'kesalahan konfigurasi (IP tidak diizinkan) tetap gagal + refund');
assert.equal(alasanPending('error', 'Signature Invalid', 200), '', 'signature salah tetap gagal + refund');
assert.equal(alasanPending('sukses', '', 200), '', 'transaksi sukses tidak dianggap PENDING');

// 2b. Jalur transaksi: tidak ada refund/pembatalan untuk HTTP error & timeout.
const badanTrx = php.slice(php.indexOf('/* ===================== POST: transaksi'));
assert.ok(!badanTrx.includes("tv_batalkan_pesanan($conn, $ref, 'penyedia tidak dapat dihubungi')"), 'timeout tidak lagi membatalkan pesanan');
assert.ok(!badanTrx.includes("tv_batalkan_pesanan($conn, $ref, 'balasan penyedia non-JSON')"), 'balasan non-JSON tidak lagi membatalkan pesanan');
assert.equal(badanTrx.match(/tv_pesanan_pending\(/g).length, 4, 'empat jalur PENDING: DB gagal, timeout/CURL, non-JSON/HTTP error, status belum pasti');
assert.match(badanTrx, /tv_out\(tv_pesanan_pending\(\$conn, \$ref, \$ctxPesanan \+ \['metode' => \$a\['metode'\], 'http' => \(int\)\$r\['code'\]\], \$alasanPending, \$norm\), 200\);/, 'status belum pasti dibalas HTTP 200 sebagai PENDING');
assert.match(badanTrx, /if \(tv_sync_pesanan\(\$conn, \$ref, \$st\) && \$st === 'gagal' && \$saldoSetelah !== null\) \$saldoSetelah \+= \$hargaJual;/, 'refund hanya untuk status gagal yang PASTI (setelah jalur PENDING dilewati)');
assert.match(php, /function tv_pesanan_pending\(\$conn, \$ref, array \$ctx, \$alasan, \$norm = null\) \{[\s\S]{0,2600}?'status'\s+=> 'pending',\s*\n\s*'pending'\s+=> true,/, 'tv_pesanan_pending membalas status pending + pending:true');
assert.match(php, /function tv_tandai_pending_pesanan[\s\S]{0,500}UPDATE riwayat_pesanan SET status='pending', catatan=\? WHERE order_id=\? AND user_id=\? AND status IN \('proses','pending'\)/, 'riwayat pesanan ditandai pending + catatan alasan (idempoten)');
assert.match(php, /if \(!empty\(\$ctx\['saldo_dipotong'\]\)[\s\S]{0,120}tv_tandai_pending_pesanan/, 'hanya pesanan yang saldonya terpotong yang ditandai di riwayat');
assert.match(read('php-api/riwayat_schema.php'), /'catatan'\s+=> "VARCHAR\(255\) NULL/, 'kolom catatan dibuat otomatis oleh riwayat_ensure_columns');

// 2c. Cek berkala tiap 10 menit: endpoint + throttle + mode cron.
const badanSync = php.slice(php.indexOf("if ($action === 'pending_sync')"), php.indexOf("if ($action === 'cek_status')"));
assert.match(badanSync, /cp_user_id\(\$conn, trim\(\(string\)\(\$_GET\['token'\] \?\? \$in\['token'\] \?\? ''\)\)\)/, 'pending_sync menerima token login user');
assert.match(badanSync, /hash_equals\(\(string\)\$c\['secret'\], \$kunci\)/, 'mode cron pending_sync diverifikasi dengan secret server');
assert.match(badanSync, /tv_pending_sync\(\$conn, \(int\)\$uid, \$maks, \$paksa\)/, 'pending_sync menjalankan pemeriksaan pesanan user');
assert.match(php, /if \(!\$paksa && \(\$now - \$last\) < TV_PENDING_SYNC_INTERVAL\)/, 'pemeriksaan berkala dibatasi sekali per 10 menit per user');
assert.match(php, /tv_api_trx\('\/v1\/transaksi\/status', \['ref_id' => \$ref\], 8\)/, 'cek berkala menanyakan status per ref_id ke penyedia');
assert.match(php, /return preg_match\('\/\^\(TVG-\|PPOB-\)\/i', trim\(\(string\)\$r\)\) === 1;/, 'hanya pesanan penyedia (TVG-/PPOB-) yang dicek berkala');
assert.match(php, /\$alasan = tv_alasan_pending\(\$stt, \$pesanCek, \(int\)\(\$a\['res'\]\['code'\] \?\? 0\), \(string\)\(\$a\['res'\]\['error'\] \?\? ''\)\);\s*\n\s*if \(\$alasan !== ''\) \{\s*\n[\s\S]{0,200}?tv_tandai_pending_pesanan/, 'cek berkala yang gagal/timeout TIDAK mengubah pesanan jadi gagal');
assert.match(php, /if \(tv_sync_pesanan\(\$conn, \$ref, \$stt\)\) \{/, 'status final dari cek berkala disinkronkan ke riwayat (selesai/batal+refund)');
// Callback penyedia tetap jalur utama status final.
assert.match(php, /if \(\$action === 'webhook'\) \{[\s\S]{0,2500}?tv_sync_pesanan\(\$conn, \$ref, \$norm\['status'\]\);/, 'webhook penyedia menyinkron status final pesanan PENDING');

// 2d. riwayat_pesanan.php memicu cek berkala SETELAH balasan dikirim (user tidak menunggu).
const riwayatPhp = read('php-api/riwayat_pesanan.php');
assert.match(riwayatPhp, /fastcgi_finish_request/, 'balasan riwayat dikirim lebih dulu');
assert.match(riwayatPhp, /action=pending_sync&token=' \. rawurlencode\(\(string\)\$token\) \. '&maks=3/, 'cek berkala PENDING dipicu internal setelah balasan');
assert.match(riwayatPhp, /stripos\(\$oid, 'TVG-'\) === 0 \|\| stripos\(\$oid, 'PPOB-'\) === 0/, 'cek berkala hanya bila ada pesanan penyedia yang menunggu');

// 2e. cek_status tidak melempar error saat penyedia tak terjangkau (pesanan tetap pending).
const badanCek = php.slice(php.indexOf("if ($action === 'cek_status')"));
assert.match(badanCek, /'status' => 'pending', 'pending' => true/, 'cek_status yang gagal membalas status pending, bukan error 502');
assert.ok(!/Tidak dapat menghubungi server penyedia[\s\S]{0,80}\], 502\)/.test(badanCek.slice(0, badanCek.indexOf('function '))), 'tidak ada lagi balasan 502 untuk cek status yang tak terjangkau');

/* =============== 3. UI: PENDING TAMPIL, ERROR SALDO PENYEDIA HILANG =============== */
const api = read('src/services/tokovoucherApi.ts');
assert.match(api, /pending\?: boolean;/, 'klien mengenal tanda pending dari server');
assert.match(api, /alasan_pending\?: string;/, 'alasan PENDING diteruskan ke UI');
assert.match(api, /transport\?: boolean;/, 'kegagalan jaringan browser ditandai transport (nasib pesanan tidak pasti)');
assert.match(api, /export const tvPendingSync = \(maks = 3\) =>/, 'klien punya pemanggil cek berkala PENDING');
assert.match(api, /action=pending_sync&maks=/, 'tvPendingSync memanggil action=pending_sync');

const detail = read('src/pages/TopupGameDetailPage.tsx');
assert.match(detail, /const pending =\s*\n?\s*!!result\.pending \|\| \['pending', 'processing', 'diproses'\]\.includes\(\(result\.status \|\| ''\)\.toLowerCase\(\)\);/, 'kartu hasil halaman top up mengenal status PENDING');
assert.match(detail, /const pending = !!r\.pending \|\| \['pending', 'processing', 'diproses'\]\.includes\(stt\) \|\| \(!!r\.transport && !r\.ok\);/, 'HTTP error/timeout/jaringan dari server diperlakukan sebagai PENDING, bukan gagal');
assert.match(detail, /ok: pending \? true : !!r\.ok,/, 'pesanan PENDING tidak ditandai sebagai error di UI');
assert.match(detail, /data-status=\{pending \? 'pending' : result\.ok \? 'sukses' : 'gagal'\}/, 'UI menandai keadaan pending/sukses/gagal untuk test & gaya');
assert.match(detail, /data-pending-info/, 'ada penjelasan PENDING (tanpa refund, tunggu callback/cek 10 menit)');
assert.match(detail, /\{!result\.ok && !pending && result\.raw \? \(/, 'respons mentah penyedia hanya ditampilkan untuk kegagalan pasti, bukan PENDING');
assert.match(detail, /tvCekStatus\(ref\)\.then[\s\S]{0,900}?window\.setTimeout\(cek, 60000\)/, 'status PENDING diperiksa ulang otomatis selama halaman dibuka');
assert.ok(!/Saldo dikembalikan\. Coba lagi sebentar lagi\./.test(detail), 'pesan error "saldo dikembalikan, coba lagi" hilang dari halaman top up');

const ppobOrder = read('src/pages/PpobLayananOrderPage.tsx');
assert.match(ppobOrder, /judul: sukses\s*\? 'Pesanan berhasil'\s*: pending\s*\? 'Pesanan PENDING — menunggu konfirmasi penyedia'/, 'halaman order PPOB menyebut PENDING secara eksplisit');
assert.match(ppobOrder, /data-pending-info/, 'halaman order PPOB menjelaskan pesanan PENDING tidak di-refund');

const riwayat = read('src/pages/RiwayatPage.tsx');
assert.match(riwayat, /data-menunggu-penyedia/, 'Riwayat Pesanan punya banner pesanan menunggu konfirmasi penyedia');
assert.match(riwayat, /data-refresh-pending/, 'ada tombol Perbarui status untuk pesanan PENDING');
assert.match(riwayat, /tvPendingSync\(3\)/, 'tombol/banner memanggil cek berkala server');
assert.match(riwayat, /if \(waiting && \(o\.type === 'topup' \|\| o\.type === 'ppob'\)\) return 'Menunggu konfirmasi penyedia';/, 'label status pesanan top up/PPOB yang menunggu');
assert.match(riwayat, /catatan: String\(r\.catatan \?\? ''\)/, 'alasan PENDING dari server ikut dibaca');
assert.match(riwayat, /data-catatan-pending/, 'alasan PENDING ditampilkan di baris pesanan');
assert.match(riwayat, /setMuatUlang\(\(n\) => n \+ 1\);/, 'daftar dimuat ulang setelah status final diterima');

console.log('PASS Roblox & Aturan PENDING: kanal kategori "Voucher Game" ikut katalog top up game sehingga kartu Roblox muncul (alias roblox/rbx/robux, nama "Roblox", prefiks RBX/ROBUX, kode voucher-only tidak disaring, cache __all_v4__/__layanan_v2__, kartu /topup/roblox + sitemap tanpa kode karangan, penamaan "100 Robux"); SEMUA HTTP error & network timeout diset PENDING (tanpa refund, tanpa error di UI), saldo penyedia yang kurang/gangguan ikut PENDING, status final menunggu callback atau action=pending_sync tiap 10 menit (dipicu otomatis setelah riwayat_pesanan.php membalas + tombol Perbarui status + catatan alasan di Riwayat Pesanan), sementara penolakan pasti tetap batal + saldo kembali.');
