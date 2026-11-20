import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { webcrypto } from 'node:crypto';
const { outputFiles } = await build({ entryPoints: ['src/services/googleRedirect.ts'], bundle: true, format: 'esm', write: false });
const source = outputFiles[0].text;
const load = n => import(`data:text/javascript;base64,${Buffer.from(source + '\n//' + n).toString('base64')}`);
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
function storage() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k,v) => m.set(k,v), removeItem: k => m.delete(k) }; }
globalThis.sessionStorage = storage(); globalThis.localStorage = storage();
let assigned = ''; let cleaned = false;
globalThis.window = { location: { hostname: 'tolestore.boosteryuk.com', search: '', assign: url => { assigned = url; } }, history: { replaceState: () => { cleaned = true; } } };
const m = await load('success');
globalThis.fetch = async (endpoint, options) => { assert.equal(endpoint, '/api/google_auth.php?action=oauth_status'); assert.equal(options.cache, 'no-store'); return {ok:true,json:async()=>({ok:true,protocol:1,redirect_ready:true})}; };
await m.startGoogleLogin();
const url = new URL(assigned); assert.equal(url.origin, 'https://boosteryuk.com'); assert.equal(url.pathname, '/auth/google'); assert.equal(url.searchParams.get('return'), 'tolestore.boosteryuk.com');
const verifier = sessionStorage.getItem(m.GOOGLE_PROOF_KEY); assert.match(verifier, /^[a-f0-9]{64}$/);
const expected = Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url'); assert.equal(url.searchParams.get('challenge'), expected);
const grant = 'a'.repeat(64); const session = 'b'.repeat(64); window.location.search = '?token=' + grant;
let requests = 0;
globalThis.fetch = async (endpoint, options) => { requests++; assert.ok(cleaned); assert.equal(endpoint,'/api/google_auth.php'); assert.equal(options.referrerPolicy,'no-referrer'); assert.equal(options.credentials,'same-origin'); assert.deepEqual(JSON.parse(options.body),{action:'exchange',token:grant,verifier}); return {ok:true,json:async()=>({ok:true,token:session})}; };
const one = m.finishGoogleLogin(), two = m.finishGoogleLogin(); assert.equal(one,two); await one; assert.equal(requests,1); assert.equal(localStorage.getItem('token'),session); assert.equal(sessionStorage.getItem(m.GOOGLE_PROOF_KEY),null);
const missing = await load('missing'); window.location.search = '?token=' + grant; await assert.rejects(missing.finishGoogleLogin(),/tidak valid/); assert.equal(requests,1);
const cancelled = await load('cancel'); window.location.search = '?error=cancelled'; await assert.rejects(cancelled.finishGoogleLogin(),/dibatalkan/);
const expired = await load('expired'); sessionStorage.setItem(m.GOOGLE_PROOF_KEY,verifier); window.location.search = '?token=' + grant;
globalThis.fetch = async () => ({ok:false,json:async()=>({ok:false,message:'Token kedaluwarsa'})});
await assert.rejects(expired.finishGoogleLogin(),/kedaluwarsa/);
console.log('PASS: central URL, browser proof SHA-256, query cleanup, single exchange (StrictMode), session storage, missing proof, cancellation, expired token.');

assigned = '';
globalThis.fetch = async () => ({ok:false,json:async()=>({ok:false,message:'Metode tidak didukung.'})});
await assert.rejects(m.startGoogleLogin(),/versi lama/); assert.equal(assigned,'');
globalThis.fetch = async () => ({ok:true,json:async()=>({ok:true,protocol:1,redirect_ready:false,message:'Secret belum diisi'})});
await assert.rejects(m.startGoogleLogin(),/Secret belum diisi/); assert.equal(assigned,'');
globalThis.fetch = async () => ({ok:true,json:async()=>{throw new Error('HTML');}});
await assert.rejects(m.startGoogleLogin(),/versi lama/); assert.equal(assigned,'');
console.log('PASS: stale PHP, incomplete OAuth config, and HTML errors block redirect and surface actionable errors.');

const network = await load('network'); window.location.search = '?token=' + grant;
globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
await assert.rejects(network.finishGoogleLogin(),/Tidak dapat menukar token/);
const html = await load('html-exchange'); window.location.search = '?token=' + grant;
globalThis.fetch = async () => ({ok:true,json:async()=>{throw new SyntaxError('HTML challenge');}});
await assert.rejects(html.finishGoogleLogin(),/tidak membalas JSON/);
// Root follows the identical relative API path, while navigation remains centralized.
window.location.hostname = 'boosteryuk.com';
globalThis.fetch = async endpoint => { assert.equal(endpoint,'/api/google_auth.php?action=oauth_status'); return {ok:true,json:async()=>({protocol:1,redirect_ready:true})}; };
await m.startGoogleLogin(); assert.equal(new URL(assigned).searchParams.get('return'),'boosteryuk.com');
console.log('PASS: same-origin exchange/status on child and root; network/HTML errors translated without leaking Failed to fetch.');
