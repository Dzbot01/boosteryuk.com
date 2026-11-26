// Worker proxy (worker/app-api-proxy.js): pengaman rate-limit 429, cache GET jarang berubah,
// header samaran, dan cookie __test per pengunjung.
//  • kontrak kode: blockedUntil + jendela 120 dtk, 503 JSON + Retry-After: 120 tanpa menyentuh
//    origin, CACHEABLE_GET 45 dtk (rentang 30–60), buildInit mengisi UA/Accept/Accept-Language,
//    FORWARD_VISITOR_IP default mati, cookie jar per pengunjung (bukan satu cookie bersama);
//  • fungsional: stub caches + fetch origin di Node — cache HIT untuk site_settings, 429 →
//    request berikutnya dibalas 503 tanpa hit origin, dan pengunjung kedua tetap ditantang
//    (cookie tidak dibagi antar pengunjung).
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-worker-guard.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const src = readFileSync('worker/app-api-proxy.js', 'utf8');

/* ---------- 1. Kontrak kode ---------- */
assert.match(src, /let blockedUntil = 0;/, 'variabel blockedUntil di atas file');
assert.match(src, /const BLOCK_WINDOW_MS = 120000;/, 'jendela blokir 120 detik');
assert.match(src, /if \(res && res\.status === 429\) blockedUntil = Date\.now\(\) \+ BLOCK_WINDOW_MS;/, 'callOrigin mencatat 429');
assert.match(src, /if \(Date\.now\(\) < blockedUntil\) return rateLimitGuardResponse\(\);/, 'proxyApi menahan request saat jendela blokir');
assert.match(src, /status: 503/, 'balasan penahan = 503');
assert.match(src, /"Retry-After": "120"/, 'header Retry-After 120');
assert.match(src, /retry_after: 120/, 'body JSON menyertakan retry_after');
assert.match(src, /"\/api\/site_settings\.php": 45/, 'site_settings di-cache 45 detik (rentang 30–60)');
assert.match(src, /X-Worker-Cache/, 'penanda HIT/MISS cache Worker');
assert.match(src, /if \(!headers\.has\("user-agent"\)\)/, 'User-Agent diisi bila kosong');
assert.match(src, /if \(!headers\.has\("accept"\)\)/, 'Accept diisi bila kosong');
assert.match(src, /if \(!headers\.has\("accept-language"\)\)/, 'Accept-Language diisi bila kosong');
assert.match(src, /const FORWARD_VISITOR_IP = false;/, 'penerusan IP pengunjung default MATI (wajib tes dulu)');
assert.match(src, /X-Visitor-IP/, 'header khusus IP pengunjung tersedia di balik flag');
assert.match(src, /function visitorKey\(request\)/, 'kunci cookie per pengunjung (hash IP)');
assert.match(src, /const cookieJar = new Map\(\);/, 'cookie jar per pengunjung');
assert.ok(!src.includes('let memoryCookie'), 'satu cookie bersama untuk semua pengunjung dihapus');

/* ---------- 2. Fungsional dengan stub caches + fetch ---------- */
const store = new Map();
const cacheStore = {
  async match(url) {
    const e = store.get(String(url));
    if (!e) return undefined;
    return new Response(e.buf, { status: e.status, headers: e.headers });
  },
  async put(url, res) {
    const buf = Buffer.from(await res.arrayBuffer());
    store.set(String(url), { status: res.status, headers: [...res.headers.entries()], buf });
  },
  async delete(url) { return store.delete(String(url)); },
};
globalThis.caches = { default: cacheStore, open: async () => cacheStore };

let originCalls = [];
let originHandler = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, init) => {
  originCalls.push({ url: String(url), headers: new Headers(init?.headers || {}) });
  return originHandler(String(url), init);
};

const dir = mkdtempSync(path.join(tmpdir(), 'worker-guard-'));
try {
  const { outputFiles } = await build({
    stdin: { contents: `export { default as worker } from './worker/app-api-proxy.js';`, resolveDir: process.cwd(), sourcefile: 'entry.js' },
    bundle: true, platform: 'node', format: 'cjs', write: false,
  });
  const file = path.join(dir, 'worker.cjs'); writeFileSync(file, outputFiles[0].text);
  const { worker } = require(file);
  const env = { ASSETS: { fetch: async () => new Response('statis', { status: 200 }) } };
  const waiters = [];
  const ctx = { waitUntil: (p) => waiters.push(p) };
  const flush = async () => { while (waiters.length) await waiters.shift(); };

  /* --- cache GET site_settings: hit kedua tanpa menembak origin --- */
  originCalls = [];
  let res = await worker.fetch(new Request('https://app.boosteryuk.com/api/site_settings.php', { headers: { 'cf-connecting-ip': '1.2.3.4' } }), env, ctx);
  await flush();
  assert.equal(res.status, 200, 'proxy site_settings sukses');
  assert.equal(originCalls.length, 1, 'hit pertama menembak origin');
  const ua = originCalls[0].headers.get('user-agent') || '';
  assert.match(ua, /Mozilla\/5\.0/, 'User-Agent browser dipasang bila kosong');
  assert.ok(originCalls[0].headers.get('accept'), 'Accept dipasang bila kosong');
  assert.match(originCalls[0].headers.get('accept-language') || '', /id-ID/, 'Accept-Language dipasang bila kosong');
  res = await worker.fetch(new Request('https://app.boosteryuk.com/api/site_settings.php', { headers: { 'cf-connecting-ip': '1.2.3.4' } }), env, ctx);
  await flush();
  assert.equal(res.headers.get('X-Worker-Cache'), 'HIT', 'hit kedua dilayani cache Worker');
  assert.equal(originCalls.length, 1, 'cache mengurangi hit ke AeonFree');

  /* --- cookie per pengunjung: pengunjung baru tetap ditantang (cookie tidak dibagi) --- */
  const key = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const plain = crypto.randomBytes(16); // nilai cookie = hex plain
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  cipher.setAutoPadding(false);
  const challengeHex = Buffer.concat([cipher.update(plain), cipher.final()]).toString('hex');
  const challengeHtml = `<html><head><script src="/aes.js"></script></head><body><script>var a=toNumbers("${key.toString('hex')}"),b=toNumbers("${iv.toString('hex')}"),c=toNumbers("${challengeHex}");document.cookie="__test="+toHex(slowAES.decrypt(c,2,a,b))+";path=/";</script></body></html>`;
  originHandler = (url, init) => {
    const cookie = new Headers(init?.headers || {}).get('cookie') || '';
    if (!cookie.includes('__test=')) return new Response(challengeHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
    return new Response(JSON.stringify({ ok: true, via: 'cookie' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  originCalls = [];
  res = await worker.fetch(new Request('https://app.boosteryuk.com/api/me.php', { headers: { 'cf-connecting-ip': '10.0.0.1' } }), env, ctx);
  await flush();
  assert.equal(res.status, 200, 'pengunjung A lolos tantangan');
  assert.equal(originCalls.length, 2, 'pengunjung A: tantangan + ulang dengan cookie');
  assert.match(originCalls[1].headers.get('cookie') || '', new RegExp('__test=' + plain.toString('hex')), 'cookie hasil penyelesaian dipakai');
  originCalls = [];
  res = await worker.fetch(new Request('https://app.boosteryuk.com/api/me.php', { headers: { 'cf-connecting-ip': '10.0.0.2' } }), env, ctx);
  await flush();
  assert.equal(originCalls.length, 2, 'pengunjung B menyelesaikan tantangannya sendiri (cookie tidak dibagi)');
  assert.ok(!(originCalls[0].headers.get('cookie') || '').includes('__test='), 'pengunjung B mulai tanpa cookie pengunjung A');

  /* --- 429: Worker berhenti menembak; request berikutnya 503 + Retry-After tanpa hit origin --- */
  originHandler = () => new Response('rate limited', { status: 429 });
  originCalls = [];
  res = await worker.fetch(new Request('https://app.boosteryuk.com/api/order.php', { method: 'POST', body: '{}' , headers: { 'cf-connecting-ip': '10.0.0.3' } }), env, ctx);
  await flush();
  assert.equal(res.status, 429, '429 origin diteruskan apa adanya');
  assert.equal(originCalls.length, 1, 'satu hit saat menerima 429');
  const before = originCalls.length;
  res = await worker.fetch(new Request('https://app.boosteryuk.com/api/site_settings.php', { headers: { 'cf-connecting-ip': '10.0.0.3' } }), env, ctx);
  await flush();
  assert.equal(res.status, 503, 'selama jendela blokir: 503');
  assert.equal(res.headers.get('Retry-After'), '120', 'header Retry-After 120');
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.retry_after, 120, 'body JSON retry_after 120');
  assert.equal(originCalls.length, before, 'origin TIDAK dihubungi selama jendela blokir');

  console.log('PASS Worker: 429 → berhenti menembak (503 + Retry-After tanpa hit origin), cache GET site_settings 45 dtk, header samaran dipasang, cookie __test per pengunjung, forward IP default mati.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(0);
