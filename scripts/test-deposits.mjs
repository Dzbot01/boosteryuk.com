import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build } from 'esbuild';
const read = p => fs.readFileSync(p, 'utf8');
const api = read('php-api/deposit.php');
const lib = read('php-api/deposit_invoice_lib.php');
const sql = read('php-api/deposit_invoices.sql');
const callback = read('php-api/callback.php');
// Security/integration source contracts, NOT a substitute for MySQL concurrency tests.
assert.match(lib, /https:\/\/api\.boosteryuk\.com\/api\/tripay/);
assert.match(api, /di_gateway\('\/create'/);
assert.match(lib, /di_gateway\('\/status\?reference='/);
assert.doesNotMatch(lib + api, /tripay\.co\.id|TRIPAY_API_KEY|private_key|di_config|Authorization: Bearer/);
assert.ok(!fs.existsSync('php-api/tripay_server_config.example.php'));
assert.match(api, /cp_user_id\(\$conn,\$in\['token'\]/);
assert.match(api, /di_row\(\$conn,\(string\)\(\$in\['merchant_ref'\].*\$uid\)/);
assert.match(api, /intdiv\(\$nominal\*3,100\)/);
assert.match(api, /'amount'=>\$nominal/);
assert.ok(api.indexOf("INSERT INTO deposit_invoices") < api.indexOf("di_gateway('/create'"), 'reserve before charging');
assert.match(sql, /UNIQUE KEY uq_active_user \(active_user_id\)/);
assert.match(sql, /UNIQUE KEY uq_gateway_ref \(reference\)/);
assert.match(api, /created_epoch'\]\+600/);
assert.ok(api.indexOf('$r=di_sync($conn,$r);') < api.indexOf("SET status='CANCELLED'"), 'verify before cancel');
assert.match(lib, /INSERT IGNORE INTO deposits/);
assert.match(lib, /begin_transaction/);
assert.match(lib, /UPDATE users SET balance=balance\+\?/);
assert.match(lib, /\$stored==='PAID' \|\| \$live==='PAID'/);
assert.match(lib, /'CANCELLED','FAILED','EXPIRED','REFUND'/);
assert.match(callback, /hash_equals\(\$SECRET/);
assert.match(callback, /di_sync\(\$conn, \$invoice/);
assert.match(api, /d\.user_id=\? AND i\.id IS NULL/);
assert.doesNotMatch(read('src/pages/DepositMethodPage.tsx'), /alert\(|hmacSha256Hex|loadConfig|createTransactionViaWorker/);
assert.ok(!read('src/components/FAQModal.tsx').includes('Apakah ID pesanan aman dimasukkan di sini?'));
for (const [id, price] of [['started-512',3000],['started-1g',5000],['started-2g',10000]]) {
  assert.match(read('php-api/nexspace_config.php').split('\n').find(s => s.includes(`'${id}'`)), new RegExp(`'price' => ${price}\\]`));
}
globalThis.window = { location: { hostname: 'boosteryuk.com', origin: 'https://boosteryuk.com' } };
globalThis.localStorage = { getItem: () => 'session-token' };
const { outputFiles } = await build({ entryPoints: ['src/services/depositApi.ts'], bundle: true, format: 'esm', write: false });
const { depositCall, DepositError, depositLabel, depositPending } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
let calls = 0;
globalThis.fetch = async (url, options) => {
  calls++;assert.equal(url, 'https://boosteryuk.com/api/deposit.php');assert.equal(options.cache, 'no-store');
  const body = JSON.parse(options.body);assert.equal(body.token, 'session-token');assert.equal(body.action, 'status');assert.equal(body.merchant_ref, 'BY-1-test');
  return new Response(JSON.stringify({ ok: true, invoice: { status: 'PAID', credit: 10300 } }));
};
assert.equal((await depositCall('status', { merchant_ref: 'BY-1-test' })).invoice.credit, 10300);
assert.equal(calls, 1);
globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, message: 'Masih ada deposit', invoice: { status: 'UNPAID' } }), { status: 409 });
await assert.rejects(depositCall('create'), e => e instanceof DepositError && e.invoice.status === 'UNPAID');
globalThis.fetch = async () => new Response('<html>hosting challenge</html>');
await assert.rejects(depositCall('active'), /tidak merespons JSON/);
globalThis.fetch = async () => { calls++;throw new Error('offline'); };
await assert.rejects(depositCall('create'), /offline/);assert.equal(calls, 2, 'never auto-retry create');
for (const status of ['CREATING','UNPAID','PENDING']) { assert.equal(depositLabel(status), 'Menunggu pembayaran');assert.equal(depositPending({status}), true); }
for (const status of ['FAILED','EXPIRED','REFUND','CANCELLED']) { assert.equal(depositLabel(status), 'Batal');assert.equal(depositPending({status}), false); }
assert.equal(depositLabel('PAID'), 'Sukses');
console.log('PASS: Worker endpoint contracts (no PHP Tripay secrets), authenticated ownership, reserve-before-create, 3% nominal-only billing, unique active slot, cooldown/live-check cancellation, ledger contracts, history ownership, client API errors/no automatic retry, labels, prices, FAQ.');
