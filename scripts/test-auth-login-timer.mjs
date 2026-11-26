// Modal login (vm isolate): server down → tanpa kotak error, antrean 5 menit tampil,
// tombol terkunci, deadline persisten di localStorage.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-auth-login-timer.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const src = fs.readFileSync('src/components/AuthModal.tsx', 'utf8');
assert.match(src, /const RECOVERY_SECONDS = 300;/);
assert.match(src, /by-login-queue-until/);
assert.match(src, /queueUntil === null \|\| now < queueUntil/);
assert.match(src, /retryRef\.current\(\)/);
assert.match(src, /disabled=\{loading \|\| countdown !== null\}/);
assert.match(src, /Server sedang ramai, anda sedang dalam antrian/);
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com' });
const { outputFiles } = await build({
  stdin: { contents: "export {default as Modal} from './src/components/AuthModal';export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  loader: { '.css': 'empty', '.png': 'dataurl', '.mp3': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{
    name: 'mocks',
    setup(b) {
      b.onResolve({ filter: /services\/boostyVoice$/ }, () => ({ path: 'voice', namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const boostyVoice={prime(){}};', resolveDir: process.cwd() }));
    },
  }],
});
const ctx = {
  process, performance, queueMicrotask,
  MessageChannel: class { port1 = { onmessage: null }; port2 = { postMessage: () => setImmediate(() => this.port1.onmessage?.()) } },
  module: { exports: {} }, exports: {}, console,
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true,
  fetch: async () => { throw new TypeError('Failed to fetch'); },
};
ctx.global = ctx;
vm.runInNewContext(outputFiles[0].text, ctx);
const { Modal, createElement: h, act, createRoot } = ctx.module.exports;
const root = createRoot(dom.window.document.getElementById('root'));
try {
  await act(async () => root.render(h(Modal, { open: true, onClose: () => {} })));
  const btn = [...dom.window.document.querySelectorAll('button')].find((b) => /Masuk dengan Google/.test(b.getAttribute('aria-label') || ''));
  assert.ok(btn);
  await act(async () => btn.click());
  assert.equal(dom.window.document.querySelector('[role="alert"]'), null, 'server down: tidak ada kotak error lagi');
  const status = dom.window.document.querySelector('[role="status"]');
  assert.match(status.textContent, /Server sedang ramai, anda sedang dalam antrian\. \d+:\d{2}/, 'teks antrean + timer');
  assert.match(status.textContent, /5:00|4:59/, 'timer 5 menit tampil');
  const btn2 = [...dom.window.document.querySelectorAll('button')].find((b) => /Tunggu/.test(b.textContent));
  assert.ok(btn2, 'tombol menampilkan hitung mundur');
  assert.equal(btn2.disabled, true, 'tombol dikunci selama timer');
  assert.ok(dom.window.localStorage.getItem('by-login-queue-until'), 'deadline antrean persisten');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
console.log('PASS auth modal: server down tanpa kotak error — antrean 5 menit "Server sedang ramai, anda sedang dalam antrian", tombol terkunci + deadline persisten + auto-retry terjadwal.');
