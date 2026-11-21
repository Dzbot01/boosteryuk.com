// NODE_PATH=/tmp/deposit-tests/node_modules node scripts/test-deposit-navigation.mjs
// Uses the real useTripayChannels hook with deliberately delayed Worker responses.
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
globalThis.IntersectionObserver = class { observe() {} disconnect() {} };
const dir = mkdtempSync(path.join(tmpdir(), 'deposit-navigation-'));
let root;
try {
  const { outputFiles } = await build({
    stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';export {default as Channels} from './src/pages/DepositPage';export {default as Method} from './src/pages/DepositMethodPage';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'test-auth-only', setup(build) {
      build.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'test-auth' }));
      build.onLoad({ filter: /.*/, namespace: 'test-auth' }, () => ({ contents: 'export const useAuth=()=>({user:{id:1},refresh:async()=>{}});' }));
    } }],
  });
  const file = path.join(dir, 'bundle.cjs');writeFileSync(file, outputFiles[0].text);
  const { createElement: h, act, createRoot, MemoryRouter, Routes, Route, useLocation, Channels, Method } = require(file);
  const channel = { code: 'QRIS', name: 'QRIS Test Worker', group: 'QRIS', type: 'direct', active: true, minimum_amount: 1000, maximum_amount: 10000000, fee_customer: { flat: 0, percent: 0 }, fee_merchant: { flat: 0, percent: 0 }, total_fee: { flat: 0, percent: 0 } };
  let pendingChannel = [];let createCalls = [];let invoice = null;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/channels')) return new Promise(resolve => pendingChannel.push(resolve));
    assert.ok(url.endsWith('/deposit.php'));
    const body = JSON.parse(options.body);
    if (body.action === 'create') {
      createCalls.push(body);
      invoice = { merchant_ref: 'BY-1-nav', reference: 'T123', nominal: 5000, bonus: 150, credit: 5150, method: 'QRIS', status: 'CREATING', created_time: 1, cancel_after: 601, transaction: null };
    }
    return new Response(JSON.stringify({ ok: true, invoice }));
  };
  let location = '';
  function Probe() { location = useLocation().pathname;return null; }
  const mount = async entry => {
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(h(MemoryRouter, { initialEntries: [entry] }, h(Probe), h(Routes, null,
      h(Route, { path: '/deposit', element: h(Channels) }), h(Route, { path: '/deposit/:method', element: h(Method) })))));
  };
  const settleChannels = async (fail = false) => {
    const resolve = pendingChannel.shift();assert.ok(resolve, 'channel request started');
    await act(async () => resolve(new Response(JSON.stringify(fail ? { success: false } : { success: true, data: [channel] }))));
  };
  await mount('/deposit');await settleChannels();
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes(channel.name)).click());
  assert.equal(location, '/deposit/QRIS', 'click must stay on selected method while its new channel request is loading');
  assert.match(document.body.textContent, /Memuat metode pembayaran/);
  assert.equal(createCalls.length, 0, 'navigation never creates a transaction');
  await settleChannels();
  assert.equal(location, '/deposit/QRIS');assert.ok(document.querySelector('#deposit-amount'), 'nominal form appears after delayed Worker response');
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('5.000')).click());
  await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Konfirmasi deposit').click());
  assert.equal(createCalls.length, 1);assert.equal(createCalls[0].method, 'QRIS');assert.equal(createCalls[0].amount, 5000);assert.equal(createCalls[0].token, 'test-session');
  await act(async () => root.unmount());root = null;
  invoice = null;await mount('/deposit/QRIS');
  assert.equal(location, '/deposit/QRIS', 'direct link/refresh does not bounce while loading');
  await settleChannels(true);
  assert.equal(location, '/deposit/QRIS');assert.ok(document.querySelector('#deposit-amount'), 'existing fallback channel remains usable after Worker channel error');
  await act(async () => root.unmount());root = null;
  await mount('/deposit/INVALID');assert.equal(location, '/deposit/INVALID');
  await settleChannels();assert.equal(location, '/deposit', 'unknown method redirects only after lookup finishes');
  console.log('PASS: actual channel click → delayed channel lookup → nominal form → authenticated create; direct refresh/fallback; invalid method redirects only after loading.');
} finally {
  if (root) { const { act } = require(path.join(dir, 'bundle.cjs'));await act(async () => root.unmount()); }
  dom.window.close();rmSync(dir, { recursive: true, force: true });
}
