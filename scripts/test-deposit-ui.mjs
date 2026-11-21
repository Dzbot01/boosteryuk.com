// Test-only dependency: npm install --prefix /tmp/deposit-tests jsdom
// NODE_PATH=/tmp/deposit-tests/node_modules node scripts/test-deposit-ui.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com' });
globalThis.window = dom.window;globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;localStorage.setItem('token', 'test-session');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.MessageChannel = class { port1 = { onmessage: null };port2 = { postMessage: () => setImmediate(() => this.port1.onmessage?.()) }; };
let refreshed = 0;
globalThis.__depositAuth = { user: { id: 1, name: 'Test' }, refresh: async () => { refreshed++; } };
const dir = mkdtempSync(path.join(tmpdir(), 'deposit-ui-'));
try {
  const { outputFiles } = await build({
    stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter,Routes,Route} from 'react-router-dom';export {default as Page} from './src/pages/DepositMethodPage';export {default as History} from './src/pages/DepositHistoryPage';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'deposit-test-hooks', setup(build) {
      build.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'test-hooks' }));
      build.onResolve({ filter: /hooks\/useTripayChannels$/ }, () => ({ path: 'channels', namespace: 'test-hooks' }));
      build.onLoad({ filter: /.*/, namespace: 'test-hooks' }, args => ({ contents: args.path === 'auth' ? 'export const useAuth=()=>globalThis.__depositAuth;' : 'export const useTripayChannels=()=>({channels:[{code:"QRIS",name:"QRIS",minimum_amount:1000,maximum_amount:10000000}]});', loader: 'js' }));
    } }],
  });
  const file = path.join(dir, 'bundle.cjs');writeFileSync(file, outputFiles[0].text);
  const { createElement: h, act, createRoot, MemoryRouter, Routes, Route, Page, History } = require(file);
  let root;
  const now = Math.floor(Date.now() / 1000);
  const make = (age = 0) => ({ merchant_ref: 'BY-1-test', reference: 'T12345', nominal: 10000, bonus: 300, credit: 10300, method: 'QRIS', status: 'UNPAID', created_time: now-age, cancel_after: now-age+600, cancelled_at: null, paid_at: null,
    transaction: { reference: 'T12345', merchant_ref: 'BY-1-test', payment_method: 'QRIS', payment_name: 'QRIS', amount: 10100, fee_customer: 100, fee_merchant: 0, total_fee: 100, amount_received: 10000, total_due: 10100, deposit_amount: 10000, saldo_masuk: 10300, status: 'UNPAID', expired_time: now+86400, qr_url: 'https://example.test/invoice.png', instructions: [], created_time: now-age } });
  let stored = make();let live = 'UNPAID';let requests = [];
  const installFetch = () => { globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/deposit.php'));
    const body = JSON.parse(options.body);requests.push(body);assert.equal(body.token, 'test-session');
    if (body.action === 'create') {
      assert.equal(body.amount, 5000);assert.equal(body.method, 'QRIS');assert.equal(body.user_id, undefined);assert.equal(body.bonus, undefined);assert.equal(body.merchant_ref, undefined);
      stored = make();stored.nominal = 5000;stored.bonus = 150;stored.credit = 5150;
    }
    if (body.action === 'status' && stored) { stored.status = live;stored.transaction.status = live; }
    if (body.action === 'cancel' && stored) { stored.status = 'CANCELLED';stored.transaction.status = 'CANCELLED'; }
    return new Response(JSON.stringify({ ok: true, invoice: stored, server_time: now }));
  }; };
  installFetch();
  const mount = async (url = '/deposit/QRIS') => {
    root = createRoot(document.getElementById('root'));
    await act(async () => { root.render(h(MemoryRouter, { initialEntries: [url] }, h(Routes, null, h(Route, { path: '/deposit/:method', element: h(Page) }))));await new Promise(r => setTimeout(r, 20)); });
  };
  const unmount = async () => { await act(async () => root.unmount()); };
  const buttons = () => [...document.querySelectorAll('button')];
  const text = () => document.body.textContent;
  await mount();
  assert.ok(document.querySelector('img[alt="QR pembayaran"]'), 'restores QR from authenticated active invoice');
  assert.equal(buttons().find(b => b.textContent.startsWith('Batalkan deposit')).disabled, true, 'ten-minute cooldown survives refresh');
  assert.ok(!text().includes('Konfirmasi deposit'), 'cannot create another while pending');
  assert.ok(text().includes('10.300') && text().includes('10.100'), 'credit includes bonus but bill does not');
  live = 'PAID';
  await act(async () => { buttons().find(b => b.textContent === 'Cek status').click();await new Promise(r => setTimeout(r, 20)); });
  assert.equal(refreshed, 1);assert.ok(text().includes('Sukses'));assert.equal(document.querySelector('img[alt="QR pembayaran"]'), null, 'hide paid QR');
  assert.equal(requests.filter(r => r.action === 'create').length, 0);
  await unmount();
  stored = make(601);live = 'UNPAID';requests = [];window.confirm = () => true;
  await mount('/deposit/QRIS?invoice=BY-1-test');
  const cancel = buttons().find(b => b.textContent === 'Batalkan deposit');assert.equal(cancel.disabled, false);
  await act(async () => { cancel.click();await new Promise(r => setTimeout(r, 20)); });
  assert.ok(requests.some(r => r.action === 'cancel'));assert.ok(text().includes('Deposit dibatalkan di aplikasi'));
  assert.equal(document.querySelector('img[alt="QR pembayaran"]'), null, 'cancelled QR must not remain payable');
  await unmount();await mount('/deposit/QRIS?invoice=BY-1-test');
  assert.ok(text().includes('Deposit dibatalkan di aplikasi'), 'cancelled detail persists after remount');await unmount();
  stored=make();stored.transaction.expired_time=now-1;live='EXPIRED';requests=[];
  await mount('/deposit/QRIS?invoice=BY-1-test');
  assert.ok(requests.some(r=>r.action==='status'),'deadline immediately asks server to persist expiry');
  assert.ok(document.body.textContent.includes('Kedaluwarsa'));assert.equal(document.querySelector('img[alt="QR pembayaran"]'),null);await unmount();
  globalThis.fetch=async(url,options)=>{assert.equal(JSON.parse(options.body).action,'list');return new Response(JSON.stringify({ok:true,rows:[stored],has_more:false}));};
  root=createRoot(document.getElementById('root'));await act(async()=>root.render(h(MemoryRouter,null,h(History))));
  assert.ok(document.querySelector('table').textContent.includes('Kedaluwarsa'));assert.ok(document.querySelector('.max-w-3xl.px-4'),'history uses padded order-history sized container');await unmount();installFetch();
  stored = null;requests = [];
  await mount();
  await act(async () => buttons().find(b => b.textContent.includes('5.000')).click());
  await act(async () => { buttons().find(b => b.textContent === 'Konfirmasi deposit').click();await new Promise(r => setTimeout(r, 20)); });
  assert.equal(requests.filter(r => r.action === 'create').length, 1, 'one nominal-only authenticated create');
  assert.ok(document.querySelector('img[alt="QR pembayaran"]'));
  await unmount();
  console.log('PASS: restore persisted QR, refresh cooldown, pending blocks form, nominal+fee bill versus bonus credit, live status/balance refresh, cancel/remount, hide inactive QR, server-owned create payload.');
} finally { dom.window.close();rmSync(dir, { recursive: true, force: true }); }
