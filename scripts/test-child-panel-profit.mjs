// Keuntungan child panel HARUS = markup yang disetel panel (harga dibayar − harga web utama),
// bukan harga final dan bukan selisih terhadap harga asli provider (itu milik admin utama).
// Uji ini mengunci rumus di php-api (statis) + simulasi numerik rumus yang sama.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-child-panel-profit.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(f, 'utf8');

/* ---------- 1. Inti pencatatan: profit = price - base_price (markup saja) ---------- */
const lib = read('php-api/child_panel_lib.php');
assert.match(lib, /\$basePrice = round\(min\(\(float\)\$basePrice, \$price\), 2\);/, 'base tidak pernah melebihi harga dibayar (profit tidak negatif)');
assert.match(lib, /\$profit = round\(\$price - \$basePrice, 2\);/, 'profit child panel = harga dibayar − harga web utama (markup saja)');
assert.match(lib, /profit\s+DECIMAL\(15,2\) NOT NULL COMMENT 'price - base_price \(pendapatan panel\)'/, 'kolom profit didokumentasikan sebagai selisih markup');
assert.match(lib, /return \(float\)ceil\(\$basePrice \* \(1 \+ \$pct \/ 100\)\);/, 'harga panel = harga dasar × (1 + markup%) dibulatkan ke atas');
assert.match(lib, /\$pct = \$kind === 'event' \? \(\$tenant\['markup_event_pct'\] \?\? 0\) : \(\$kind === 'agent' \? \$tenant\['markup_agent_pct'\] : \(\$kind === 'otp' \? \(\$tenant\['markup_otp_pct'\] \?\? 0\) : \$tenant\['markup_smm_pct'\]\)\);/, 'markup per jenis layanan (smm/agent/otp/event) diambil dari setelan panel');
assert.match(lib, /return round\(\(float\)\$price \/ \(1 \+ \$pct \/ 100\), 2\);/, 'cp_base_from_price = kebalikan markup (mengembalikan harga dasar)');
// Saldo pencairan hanya menjumlah profit (markup) dan membuang pesanan batal.
assert.match(lib, /COALESCE\(SUM\(CASE WHEN COALESCE\(s\.st,''\) <> 'batal' THEN s\.profit END\),0\) AS earned/, 'pendapatan = SUM(profit) tanpa pesanan batal');

/* ---------- 2. SMM: base = harga web utama, cost = provider (milik admin, bukan panel) ---------- */
const op = read('php-api/order_price.php');
assert.match(op, /\$perK = \$rates\[\(string\)\$serviceId\] \+ \(\$plus \? BK_MARKUP_PLUS_PER_1000 : BK_MARKUP_PER_1000\);/, 'harga web utama = tarif provider + markup web');
assert.match(op, /\$base = round\(\(\$qty \/ 1000\) \* \$perK\);/, 'base (harga web utama) dihitung terpisah');
assert.match(op, /\$perKPanel = \$tenant \? cp_apply_markup\(\$perK, \$tenant, 'smm'\) : \$perK;/, 'harga panel = harga web utama + markup panel');
assert.match(op, /\$cost = round\(\(\$qty \/ 1000\) \* \$rates\[\(string\)\$serviceId\], 2\);/, 'cost = harga asli provider (tanpa markup apa pun)');
assert.match(op, /'base' => \(float\)min\(\$base, \$price\)/, 'base yang dikirim tidak melebihi harga dibayar');
const order = read('php-api/order.php');
assert.match(order, /cp_record_order\(\$conn, \(int\)\$calc\['tenant'\]\['id'\], \$user_id, \$provider_order_id, 'smm', \$serviceName, \$quantity, \$price, \$calc\['base'\]\);/, 'pencatatan panel memakai base (harga web utama), BUKAN cost provider');
assert.ok(!/cp_record_order\([^)]*\$calc\['cost'\]/.test(order), 'cost provider TIDAK pernah dipakai sebagai dasar profit panel');
assert.match(order, /bk_record_profit\(\$conn, \$provider_order_id, \$user_id, \$service, \$quantity, \$calc\['cost'\], \$calc\['base'\], \$price\);/, 'margin admin utama (harga web - cost provider) dicatat terpisah dari pendapatan panel');
assert.match(order, /6b\. CHILD PANEL: catat pendapatan panel \(harga dibayar − harga web utama\)/, 'dasar profit panel ditegaskan di komentar kode: harga web utama');
const cp = read('php-api/child_panel.php');
assert.match(cp, /\$base = cp_base_from_price\(\$row\['price'\], \$tenant\['markup_smm_pct'\]\);/, 'record_order manual menurunkan base dari markup panel yang sama');

/* ---------- 3. Agen AI & Event & OTP: dasar = harga web utama ---------- */
const ao = read('php-api/agent_order.php');
assert.match(ao, /\$price = cp_apply_markup\(\$basePrice, \$tenant, 'agent'\);/, 'harga Agen AI panel = harga dasar + markup panel');
assert.match(ao, /'harga_dasar'     => \$basePrice,/, 'harga dasar (web utama) disimpan di detail pesanan');
const al = read('php-api/agent_lifecycle.php');
assert.match(al, /\$base = isset\(\$d\['harga_dasar'\]\) \? \(float\)\$d\['harga_dasar'\] : \(float\)\$row\['price'\];/, 'pendapatan panel Agen AI memakai harga dasar tersimpan');
assert.match(al, /cp_record_order\(\$conn, \(int\)\$d\['child_panel_id'\], \(int\)\$uid, \$orderId, 'agent', \$row\['service_name'\], \$row\['quantity'\], \$row\['price'\], \$base\);/, 'profit Agen AI = dibayar − harga dasar');
const eg = read('php-api/event_game.php');
assert.match(eg, /if\(\$tenant\)cp_record_order\(\$conn,\$tenant\['id'\],\(int\)\$uid,\$order,'event',\$service,\$qty,\$amount,\$baseAmount\);/, 'profit event = dibayar − harga dasar merchant');
const otp = read('php-api/otp.php');
assert.match(otp, /return \$pct > 0 \? ceil\(\$harga \* \(1 \+ \$pct \/ 100\) \/ 100\) \* 100 : \$harga;/, 'harga OTP panel dibulatkan ke ratusan setelah markup');
assert.match(otp, /\$price = \(float\)otp_harga_panel\(\$tier\['harga'\], \$tenant\);\s*\n\s*\$base = \(float\)\$tier\['harga'\];/, 'base OTP = harga tier web utama (tanpa markup)');
assert.match(otp, /cp_record_order\(\$conn, \(int\)\$o\['child_panel_id'\], \(int\)\$o\['user_id'\], \$o\['order_id'\], 'otp', 'OTP ' \. \$o\['service_name'\] \. ' • ' \. \$o\['country_name'\], 1, \$o\['price'\], \$o\['base_price'\]\);/, 'profit OTP = harga panel − harga web utama');

/* ---------- 4. Simulasi numerik rumus yang sama ---------- */
const CP_MAX_MARKUP = 300;
const clampPct = (p) => Math.max(0, Math.min(CP_MAX_MARKUP, p));
const applyMarkupSmm = (base, pct) => Math.ceil(base * (1 + clampPct(pct) / 100));
const applyMarkupOtp = (harga, pct) => (pct > 0 ? Math.ceil((harga * (1 + pct / 100)) / 100) * 100 : harga);
const profit = (price, base) => Math.round((price - Math.min(base, price)) * 100) / 100;

// Contoh user: root 10k, markup membuat final 12k → panel dapat 2k (bukan 12k).
const base1 = 10000, pct1 = 20;
const price1 = applyMarkupSmm(base1, pct1);
assert.equal(price1, 12000, 'root 10k + markup 20% = final 12k');
assert.equal(profit(price1, base1), 2000, 'keuntungan panel = 2k (markup), bukan 12k');
assert.notEqual(profit(price1, base1), price1, 'profit bukan harga final');
// Markup 0 → panel tidak mendapat apa-apa.
assert.equal(profit(applyMarkupSmm(10000, 0), 10000), 0, 'markup 0% = keuntungan 0');
// Markup dibatasi 300%.
assert.equal(applyMarkupSmm(10000, 999), 40000, 'markup dibatasi CP_MAX_MARKUP 300%');
// OTP: web utama 3.600, markup 10% → panel 4.000, untung 400.
const otpPrice = applyMarkupOtp(3600, 10);
assert.equal(otpPrice, 4000, 'OTP 3.600 + markup 10% = 4.000 (pembulatan ratusan)');
assert.equal(profit(otpPrice, 3600), 400, 'keuntungan panel OTP = 400 (markup saja)');
// Selisih terhadap cost provider BUKAN milik panel (itu margin admin utama).
const cost = 7000;
assert.notEqual(profit(price1, cost), 2000, 'profit panel tidak dihitung dari cost provider');

console.log('PASS Keuntungan child panel = markup yang disetel panel (harga dibayar − harga web utama) untuk smm/agent/otp/event; margin provider (base − cost) tercatat terpisah sebagai penghasilan admin utama; simulasi: root 10k + markup 20% → panel 2k, OTP 3.600 + 10% → panel 400.');
process.exit(0);
