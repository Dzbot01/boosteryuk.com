// Modal login: saat PHP tidak dapat dihubungi, JANGAN tampilkan pesan error versi lama —
// ganti dengan antrean 5 menit (simulasi): teks "Server sedang ramai, anda sedang dalam
// antrian. <timer>", deadline tersimpan di localStorage sehingga TIDAK reset oleh refresh
// halaman maupun tutup-buka modal; error teks hanya untuk kegagalan lain (mis. server
// login benar-benar versi lama / belum dikonfigurasi).
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-login-cooldown.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const read = (p) => fs.readFileSync(p, 'utf8');
import fs from 'node:fs';

/* Kontrak kode: antrean 5 menit, persisten, teks baru. */
const modal = read('src/components/AuthModal.tsx');
assert.match(modal, /const RECOVERY_SECONDS = 300;/, 'antrean 5 menit (300 detik)');
assert.match(modal, /const QUEUE_LS_KEY = 'by-login-queue-until';/, 'deadline antrean punya kunci localStorage');
assert.match(modal, /setQueueUntil\(readQueueUntil\(\)\);/, 'modal dibuka → deadline dipulihkan (tidak reset saat close/open)');
assert.match(modal, /Server sedang ramai, anda sedang dalam antrian/, 'teks antrean pengganti pesan lama');
assert.ok(!modal.includes('Server login tidak dapat dihubungi. Mencoba ulang otomatis'), 'teks cooldown lama dihapus');
assert.match(modal, /\(e as \{ serverDown\?: boolean \}\)\.serverDown === true/, 'flag serverDown dari googleRedirect dipakai');
const gr = read('src/services/googleRedirect.ts');
assert.match(gr, /if \(!response\.ok \|\| status === null\) throw Object\.assign\(new Error\('Server login tidak dapat dihubungi\.'\), \{ serverDown: true \}\);/, 'PHP tak membalas = serverDown');
assert.match(gr, /if \(status\.protocol !== 1\) throw new Error\('Server login masih versi lama\./, 'versi lama (PHP terbaca) tetap pesan error tersendiri');
assert.ok(!gr.includes('Server login masih versi lama atau tidak dapat dihubungi'), 'pesan gabungan lama dihapus');

/* Perilaku jsdom. */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://tokoku.boosteryuk.com' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const dir = mkdtempSync(path.join(tmpdir(), 'login-cooldown-')); let root = null;
try {
  const { outputFiles } = await build({
    stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {default as AuthModal} from './src/components/AuthModal';`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl', '.mp3': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'mocks', setup(b) {
      b.onResolve({ filter: /services\/boostyVoice$/ }, () => ({ path: 'voice', namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const boostyVoice={prime(){}};', resolveDir: process.cwd() }));
    } }],
  });
  const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
  const { createElement: h, act, createRoot, AuthModal } = require(file);
  const mount = async () => {
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(h(AuthModal, { open: true, onClose: () => {} })));
  };
  const unmount = async () => { await act(async () => root.unmount()); root = null; };
  const googleBtn = () => document.querySelector('#root button[aria-label="Masuk dengan Google"]');
  const statusText = () => (document.querySelector('#root [role="status"]')?.textContent || '');
  const remainOf = () => { const m = statusText().match(/(\d+):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

  /* 1. PHP tidak dapat dihubungi (network error) → antrean 5 menit, tanpa pesan error. */
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await mount();
  await act(async () => googleBtn().click());
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(document.querySelector('#root [role="alert"]'), null, 'tidak ada kotak error merah');
  assert.match(statusText(), /Server sedang ramai, anda sedang dalam antrian\. \d+:\d{2}/, 'teks antrean dengan format m:ss');
  const first = remainOf();
  assert.ok(first !== null && first >= 295 && first <= 300, `timer mulai dari 5 menit (dapat ${first})`);
  assert.match(googleBtn().textContent, /Tunggu \d+:\d{2}/, 'tombol menampilkan hitung mundur');
  assert.equal(googleBtn().disabled, true, 'tombol nonaktif selama antrean');
  assert.ok(localStorage.getItem('by-login-queue-until'), 'deadline antrean tersimpan di localStorage');
  await unmount();

  /* 2. Tutup modal lalu buka lagi (simulasi close + refresh): antrean LANJUT, tidak reset. */
  await mount();
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  const second = remainOf();
  assert.ok(second !== null && second <= first && second > 0, `antrean dilanjutkan bukan direset (${second} <= ${first})`);
  assert.match(statusText(), /Server sedang ramai, anda sedang dalam antrian/, 'teks antrean tetap tampil setelah dibuka ulang');
  await unmount();

  /* 3. Deadline di masa lalu (antrean habis) → modal bersih tanpa antrean. */
  localStorage.setItem('by-login-queue-until', String(Date.now() - 1000));
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await mount();
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(document.querySelector('#root [role="status"]'), null, 'deadline lampau tidak memunculkan antrean');
  await unmount();
  localStorage.removeItem('by-login-queue-until');

  /* 4. PHP membalas non-JSON (mis. 404/HTML dari hosting) → antrean juga. */
  globalThis.fetch = async () => new Response('<html>404</html>', { status: 404 });
  await mount();
  await act(async () => googleBtn().click());
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(document.querySelector('#root [role="alert"]'), null, 'respons non-JSON tidak jadi error teks');
  assert.ok(document.querySelector('#root [role="status"]'), 'antrean tampil untuk respons non-JSON');
  await unmount();
  localStorage.removeItem('by-login-queue-until');

  /* 5. PHP terbaca tetapi versi lama (protocol !== 1) → pesan error tetap (butuh aksi admin). */
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, protocol: 0 }), { status: 200 });
  await mount();
  await act(async () => googleBtn().click());
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  const alert = document.querySelector('#root [role="alert"]');
  assert.ok(alert && alert.textContent.includes('Server login masih versi lama'), 'versi lama tetap error teks');
  assert.equal(document.querySelector('#root [role="status"]'), null, 'tidak ada antrean untuk server versi lama');
  await unmount();

  console.log('PASS Modal login: PHP tak dapat dihubungi → antrean 5 menit "Server sedang ramai, anda sedang dalam antrian" yang tahan refresh/close modal, tombol nonaktif & coba ulang otomatis; error teks hanya untuk server versi lama.');
} finally {
  if (root) { const { act } = require(path.join(dir, 'bundle.cjs')); await act(async () => root.unmount()); }
  dom.window.close(); rmSync(dir, { recursive: true, force: true });
}
process.exit(0);
