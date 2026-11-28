// Markup Top Up Game & PPOB untuk child panel: pemilik panel menyetel persennya di
// Panel Admin, tetapi AKSES-nya dibeli terpisah (Rp35.000 masing-masing, satu per satu).
// Markup top up game sistem = 2% dari harga modal, tanpa pembulatan.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-panel-markup-access.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = (p) => fs.readFileSync(p, 'utf8');

/* ---------- 1. Markup sistem 2% eksak (tanpa pembulatan ratusan) ---------- */
const bundle = execFileSync('npx', ['esbuild', '--bundle', '--format=cjs', '--platform=node', '--log-level=error', '--loader:.css=empty'], {
  input: `import { hargaJual, TOPUP_MARKUP_PCT } from './src/data/topupGames';
import { HARGA_AKSES_MARKUP, markupTopupPct, markupPpobPct, hargaMarkup } from './src/lib/panelMarkup';
console.log(JSON.stringify({ TOPUP_MARKUP_PCT, HARGA_AKSES_MARKUP,
  a: hargaJual(814), b: hargaJual(734), c: hargaJual(12066), d: hargaJual(1000, 7.5),
  topupDefault: markupTopupPct(null), ppobDefault: markupPpobPct(null),
  topupPanel: markupTopupPct({ access_topup_markup: 1, markup_topup_pct: 5 }),
  topupTerkunci: markupTopupPct({ access_topup_markup: 0, markup_topup_pct: 5 }),
  ppobPanel: markupPpobPct({ access_ppob_markup: 1, markup_ppob_pct: 3 }),
  ppobTerkunci: markupPpobPct({ access_ppob_markup: 0, markup_ppob_pct: 3 }),
  ppobModal: Math.round(hargaMarkup(2025, 3)) }));`,
  cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
});
fs.writeFileSync('/tmp/panel-markup-bundle.cjs', bundle);
const out = execFileSync('node', ['/tmp/panel-markup-bundle.cjs'], { cwd: process.cwd(), encoding: 'utf8' });
const r = JSON.parse(out.trim().split('\n').pop());
assert.equal(r.TOPUP_MARKUP_PCT, 2, 'markup sistem 2%');
assert.equal(r.HARGA_AKSES_MARKUP, 35000, 'harga akses markup Rp35.000 per akses');
// Nilai eksak (toleransi presisi float): modal + markup = harga user, tanpa pembulatan ratusan.
const hampir = (a, b, pesan) => assert.ok(Math.abs(a - b) < 0.01, `${pesan} (dapat ${a}, harap ${b})`);
hampir(r.a, 830.28, '814 + 2% = 830,28');
hampir(r.b, 748.68, '734 + 2% = 748,68');
hampir(r.c, 12307.32, '12066 + 2% = 12.307,32 (bukan 12.400)');
hampir(r.d, 1075, 'persen custom (child panel) dipakai: 1000 + 7,5% = 1075');
assert.equal(r.topupDefault, 2, 'tanpa tenant → markup sistem 2%');
assert.equal(r.ppobDefault, 0, 'tanpa tenant → PPOB tanpa markup');
assert.equal(r.topupPanel, 5, 'child panel ber-akses → markup top up game setelannya sendiri');
assert.equal(r.topupTerkunci, 2, 'akses belum dibeli → markup top up game tetap 2% sistem');
assert.equal(r.ppobPanel, 3, 'child panel ber-akses PPOB → markup PPOB aktif');
assert.equal(r.ppobTerkunci, 0, 'akses PPOB belum dibeli → harga PPOB = harga asli');
assert.equal(r.ppobModal, 2086, 'harga PPOB = modal + markup (2025 + 3% = 2.085,75 → 2.086)');

/* ---------- 2. Backend: kolom, gate akses, aksi beli ---------- */
const php = read('php-api/child_panel.php');
const lib = read('php-api/child_panel_lib.php');
const sql = read('php-api/child_panel.sql');
const migrasi = read('php-api/child_panel_markup_akses.sql');
const libSrc = read('php-api/child_panel_lib.php');
for (const kolom of ['markup_topup_pct', 'markup_ppob_pct', 'access_topup_markup', 'access_ppob_markup']) {
  assert.ok(sql.includes(kolom), `schema child_panels punya kolom ${kolom}`);
  assert.ok(migrasi.includes(`ADD COLUMN ${kolom}`), `migrasi menambah kolom ${kolom}`);
  assert.ok(lib.includes(`'${kolom}'`), `cp_public mengirim ${kolom} ke frontend`);
}
assert.match(php, /'owner_buy_markup_access'/, 'aksi beli akses markup terdaftar di allowlist owner');
assert.match(php, /\$harga = 35000;/, 'harga akses markup Rp35.000 di server');
assert.match(php, /cp_q\(\$conn, 'SELECT balance FROM users WHERE id=\? FOR UPDATE', 'i', \$owner\)/, 'saldo pemilik dikunci (FOR UPDATE) sebelum dipotong');
// BUG FIX: cp_resolve() menyembunyikan owner_user_id sebagai '_owner_user_id'.
assert.match(php, /\$owner = \(int\)\(\$tenant\['_owner_user_id'\] \?\? 0\);/, 'id pemilik dibaca dari kunci internal _owner_user_id (bukan owner_user_id yang tidak dikirim cp_public)');
assert.ok(!/\$tenant\['owner_user_id'\]/.test(php), 'tidak lagi membaca $tenant[owner_user_id] yang selalu kosong (penyebab galat saat beli akses)');
assert.match(php, /Panel ini tidak punya akun pemilik/, 'pesan jelas bila panel tidak punya akun pemilik');
assert.match(php, /\$cfg\['markupAccess'\]\[\$kind\] = \['harga' => \$harga/, 'pembelian akses dicatat di config panel (jejak audit)');
// Kolom baru dibuat otomatis supaya panel lama tidak butuh migrasi SQL manual.
const ensure = libSrc.slice(libSrc.indexOf('function cp_ensure_schema('), libSrc.indexOf('function cp_public('));
for (const kolom of ['markup_topup_pct', 'markup_ppob_pct', 'access_topup_markup', 'access_ppob_markup'])
  assert.ok(ensure.includes(`'${kolom}'`), `cp_ensure_schema menambah kolom ${kolom} otomatis`);
assert.match(ensure, /ALTER TABLE child_panels ADD COLUMN \$kolom \$definisi/, 'kolom markup/akses dibuat otomatis bila belum ada');
assert.match(libSrc, /SHOW COLUMNS FROM child_panels LIKE '\$kolom'/, 'cek kolom lewat SHOW COLUMNS sebelum ALTER TABLE');
assert.match(php, /UPDATE users SET balance=balance-\? WHERE id=\?/, 'pembelian memotong saldo pemilik');
assert.match(php, /cp_out\(\['ok' => false, 'message' => 'Saldo tidak cukup/, 'saldo kurang → ditolak (402) tanpa memotong saldo');
assert.match(php, /if \(\(int\)\(\$tenant\[\$col\] \?\? 0\) === 1\) cp_out/, 'akses yang sudah aktif tidak bisa dibeli ulang');
assert.match(php, /\$ubahTopup = array_key_exists\('markup_topup_pct', \$in\) && abs\(round\(\(float\)\$in\['markup_topup_pct'\], 2\) - \$mTopup\) > 0\.001;/, 'gate top up game hanya menolak bila nilainya benar-benar diubah');
assert.match(php, /if \(\(int\)\(\$tenant\['access_topup_markup'\] \?\? 0\) !== 1\)/, 'markup top up game ditolak bila akses belum dibeli');
assert.match(php, /\$ubahPpob = array_key_exists\('markup_ppob_pct', \$in\)/, 'gate PPOB sama: hanya menolak saat nilainya diubah');
assert.match(php, /if \(\(int\)\(\$tenant\['access_ppob_markup'\] \?\? 0\) !== 1\)/, 'markup PPOB ditolak bila akses belum dibeli');
assert.match(php, /max\(0, min\(CP_MAX_MARKUP, round\(\(float\)\$in\['markup_topup_pct'\], 2\)\)\)/, 'markup top up game dibatasi 0–CP_MAX_MARKUP');
assert.match(php, /markup_topup_pct=\?, markup_ppob_pct=\?/, 'markup top up & PPOB disimpan ke child_panels');
assert.match(php, /cp_is_owner/, 'semua aksi owner tetap diverifikasi kepemilikan');

/* ---------- 3. Frontend: Panel Admin + halaman top up/PPOB ---------- */
const panel = read('src/pages/PanelAdminPage.tsx');
const api = read('src/services/panelApi.ts');
const tenantSrc = read('src/lib/tenant.ts');
const detail = read('src/pages/TopupGameDetailPage.tsx');
const pulsa = read('src/pages/PpobPulsaRegulerPage.tsx');
assert.match(api, /buyMarkupAccess: \(kind: 'topup' \| 'ppob'\) =>/, 'panelApi punya buyMarkupAccess(topup|ppob)');
assert.match(api, /'owner_buy_markup_access'/, 'buyMarkupAccess memanggil aksi owner_buy_markup_access');
assert.match(api, /markup_topup_pct\?: number; markup_ppob_pct\?: number; access_topup_markup\?: number; access_ppob_markup\?: number/, 'ringkasan panel membawa markup & flag akses baru');
for (const f of ['markup_topup_pct?: number;', 'markup_ppob_pct?: number;', 'access_topup_markup?: number | boolean;', 'access_ppob_markup?: number | boolean;'])
  assert.ok(tenantSrc.includes(f), `Tenant punya field ${f}`);
assert.match(panel, /Markup \{judul\}/, 'label input markup per layanan');
assert.match(panel, /judul: 'Top Up Game \(%\)'/, 'Panel Admin punya input markup Top Up Game');
assert.match(panel, /judul: 'PPOB \(%\)'/, 'Panel Admin punya input markup PPOB');
assert.match(panel, /disabled=\{!akses\}/, 'input markup terkunci selama akses belum dibeli');
assert.match(panel, /Buka akses \$\{rupiah\(HARGA_AKSES_MARKUP\)\}/, 'tombol beli menampilkan harga Rp35.000');
assert.match(panel, /TERKUNCI/, 'badge TERKUNCI saat akses belum dibeli');
assert.match(panel, /AKSES AKTIF/, 'badge AKSES AKTIF setelah dibeli');
assert.match(panel, /dibeli terpisah \(satu per satu\)/, 'keterangan: akses dibeli terpisah satu per satu');
assert.match(panel, /aksesTopup \? Number\(topup\) \|\| 0 : undefined/, 'persen top up hanya dikirim bila aksesnya sudah dibeli (kalau tidak, server menolak dan markup lain gagal tersimpan)');
assert.match(panel, /aksesPpob \? Number\(ppob\) \|\| 0 : undefined/, 'persen PPOB hanya dikirim bila aksesnya sudah dibeli');
assert.match(detail, /const pctTopup = markupTopupPct\(tenant\);/, 'harga top up game memakai markup tenant');
assert.match(detail, /const jual = \(n: number\) => rupiah\(hargaJual\(n, pctTopup\)\);/, 'semua harga tampilan top up lewat satu helper markup');
assert.ok(!/rupiah\(hargaJual\(p\.harga\)\)/.test(detail), 'tidak ada lagi harga top up yang memakai markup sistem hardcode');
assert.match(pulsa, /const pctPpob = markupPpobPct\(tenant\);/, 'harga pulsa PPOB memakai markup tenant (0 bila akses belum dibeli)');
assert.match(pulsa, /harga: Math\.round\(hargaMarkup\(p\.harga, pctPpob\)\)/, 'harga produk PPOB = modal + markup');
assert.match(pulsa, /\[operator, pctPpob\]/, 'daftar produk PPOB dihitung ulang saat markup berubah');

console.log('PASS Markup child panel: top up game 2% tanpa pembulatan (814 → Rp 830), pemilik panel bisa menyetel markup Top Up Game & PPOB di Panel Admin setelah membeli aksesnya terpisah (Rp35.000 masing-masing, dipotong saldo owner, gate di PHP + UI terkunci).');
