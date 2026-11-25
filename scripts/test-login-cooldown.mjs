// Modal login: saat PHP tidak dapat dihubungi, JANGAN tampilkan pesan error versi lama —
// ganti dengan timer cooldown 3 menit (simulasi) + percobaan ulang otomatis; error teks
// hanya untuk kegagalan lain (mis. server login benar-benar versi lama / belum dikonfigurasi).
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

/* Kontrak kode: cooldown 3 menit & penanda serverDown. */
const modal = read('src/components/AuthModal.tsx');
assert.match(modal, /const RECOVERY_SECONDS = 180;/, 'cooldown 3 menit (180 detik)');
assert.match(modal, /\(e as \{ serverDown\?: boolean \}\)\.serverDown === true/, 'flag serverDown dari googleRedirect dipakai');
assert.match(modal, /setError\(''\);\s*setCountdown\(RECOVERY_SECONDS\);/, 'saat server down: error dikosongkan, cooldown dijalankan');
const gr = read('src/services/googleRedirect.ts');
assert.match(gr, /if \(!response\.ok \|\| status === null\) throw Object\.assign\(new Error\('Server login tidak dapat dihubungi\.'\), \{ serverDown: true \}\);/, 'PHP tak membalas = serverDown');
assert.match(gr, /if \(status\.protocol !== 1\) throw new Error\('Server login masih versi lama\./, 'versi lama (PHP terbaca) tetap pesan error tersendiri');
assert.ok(!gr.includes('Server login masih versi lama atau tidak dapat dihubungi'), 'pesan gabungan lama dihapus');

/* Perilaku jsdom. */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://tokoku.boosteryuk.com' });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.localStorage = dom.window.localStorage;
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

  /* 1. PHP tidak dapat dihubungi (network error) → cooldown, tanpa pesan error. */
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await mount();
  await act(async () => googleBtn().click());
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(document.querySelector('#root [role="alert"]'), null, 'tidak ada kotak error merah');
  const status = document.querySelector('#root [role="status"]');
  assert.ok(status, 'timer cooldown tampil');
  assert.match(status.textContent, /Server login tidak dapat dihubungi\. Mencoba ulang otomatis dalam \d+:\d{2}/, 'teks cooldown dengan format m:ss');
  assert.match(googleBtn().textContent, /Tunggu \d+:\d{2}/, 'tombol menampilkan hitung mundur');
  assert.equal(googleBtn().disabled, true, 'tombol nonaktif selama cooldown');
  await unmount();

  /* 2. PHP membalas non-JSON (mis. 404/HTML dari hosting) → cooldown juga. */
  globalThis.fetch = async () => new Response('<html>404</html>', { status: 404 });
  await mount();
  await act(async () => googleBtn().click());
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  assert.equal(document.querySelector('#root [role="alert"]'), null, 'respons non-JSON tidak jadi error teks');
  assert.ok(document.querySelector('#root [role="status"]'), 'cooldown tampil untuk respons non-JSON');
  await unmount();

  /* 3. PHP terbaca tetapi versi lama (protocol !== 1) → pesan error tetap (butuh aksi admin). */
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, protocol: 0 }), { status: 200 });
  await mount();
  await act(async () => googleBtn().click());
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  const alert = document.querySelector('#root [role="alert"]');
  assert.ok(alert && alert.textContent.includes('Server login masih versi lama'), 'versi lama tetap error teks');
  assert.equal(document.querySelector('#root [role="status"]'), null, 'tidak ada cooldown untuk server versi lama');
  await unmount();

  console.log('PASS Modal login: PHP tak dapat dihubungi → timer cooldown 3 menit (simulasi) tanpa pesan error, tombol nonaktif & coba ulang otomatis; error teks hanya untuk server versi lama.');
} finally {
  if (root) { const { act } = require(path.join(dir, 'bundle.cjs')); await act(async () => root.unmount()); }
  dom.window.close(); rmSync(dir, { recursive: true, force: true });
}
process.exit(0);
