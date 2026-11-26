// Uji menu + halaman Playground "Generate 3D Model" (dashboard AI 3D Model Generator):
//  • proxy php-api/v2fun.php: Bearer key server-side, endpoint meshes + polling task,
//    upload data-URI disimpan sementara & dikirim sebagai URL publik, purge 24 jam,
//    pesan jelas bila key belum diset;
//  • klien src/services/v2funApi.ts lewat MAIN_API/v2fun.php (key tidak pernah di browser);
//  • PlaygroundPage: menu baru "Generate 3D Model" (?m=gen3d) fullscreen seperti studio;
//  • UI dashboard sesuai brief: navbar tanpa brand V2FUN (avatar user / teks login), sidebar Image/Model/Animation/Tutorials,
//    panel pengaturan (dropzone, dropdown Standard/Pro/Ultra, toggle tekstur), canvas
//    empty state, Asset Library + pagination; Generate disabled tanpa input;
//  • perilaku jsdom: mode teks → Generate aktif → task QUEUED→RUNNING→COMPLETED →
//    aset masuk pustaka, kredit terpotong, viewer GLB jatuh ke tautan unduh bila WebGL gagal.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-playground-3d.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);
const read = (f) => readFileSync(f, 'utf8');

/* ---------- 1. Proxy PHP ---------- */
const php = read('php-api/v2fun.php');
const PhpParser = require('php-parser');
new PhpParser({ parser: { php7: true } }).parseCode(php, 'v2fun'); // parse OK
assert.match(php, /getenv\('V2FUN_API_KEY'\)/, 'key dari env var');
assert.match(php, /v2fun_config\.php/, 'alternatif key dari file config (tidak di-commit)');
assert.match(php, /'Authorization: Bearer ' \. \$key/, 'Bearer token dipasang server-side');
assert.match(php, /V2FUN_BASE = 'https:\/\/api\.v2fun\.ai\/api\/v1'/, 'basis URL API V2Fun');
assert.match(php, /'\/3d_models\/meshes'/, 'endpoint generate meshes');
assert.match(php, /'\/3d_models\/meshes\/' \. rawurlencode\(\$uuid\)/, 'endpoint polling task');
assert.match(php, /API key V2Fun belum diset di server/, 'pesan jelas bila key belum diset');
assert.match(php, /v2fun_store_data_uri/, 'gambar data-URI disimpan sementara');
assert.match(php, /v2fun_public_url/, 'gambar dikirim sebagai URL publik (kontrak API)');
assert.match(php, /\$now - \(int\)filemtime\(\$f\) > 86400/, 'upload sementara dipurge > 24 jam');
assert.match(php, /\$payload\['with_texture'\] = \(bool\)\(\$in\['with_texture'\] \?\? true\)/, 'opsi white mesh/textured');
assert.match(php, /\$payload\['hd_texture'\] = true/, 'opsi HD 8K');
assert.match(php, /\$payload\['pbr_texture'\] = true/, 'opsi PBR');
assert.match(php, /V2Fun menolak request \(HTTP /, 'error provider diteruskan apa adanya');
assert.match(php, /input_images/, 'mode multi-view didukung');

/* ---------- 2. Klien frontend ---------- */
const api = read('src/services/v2funApi.ts');
assert.match(api, /MAIN_API}\/v2fun\.php/, 'klien memanggil proxy PHP, bukan api.v2fun.ai langsung');
assert.match(api, /action=generate/, 'aksi generate');
assert.match(api, /action=task/, 'aksi polling task');
assert.match(api, /metadata\?\.downloads\?\.\[0\]\?\.download_url/, 'URL GLB diambil dari metadata.downloads');

/* ---------- 3. Menu Playground ---------- */
const pg = read('src/pages/PlaygroundPage.tsx');
assert.match(pg, /\{ id: 'gen3d', label: 'Generate 3D Model', icon: Boxes/, 'menu baru Generate 3D Model');
assert.match(pg, /\['overview', 'hook', 'caption', 'tts', 'studio', 'gen3d'\]/, 'menu gen3d diterima dari URL');
assert.match(pg, /const Generator3dStudio = lazy\(\(\) => import\('\.\.\/components\/Generator3dStudio'\)\)/, 'studio dimuat malas');
assert.match(pg, /menu === 'gen3d' \? \(\s*\/\* Dashboard AI 3D Model Generator memenuhi SELURUH layar/, 'halaman fullscreen 100vh');
assert.match(pg, /<Generator3dStudio onOpenMenu=\{\(\) => setDrawerOpen\(true\)\} onLoginClick=\{\(\) => navigate\('\/'\)\} \/>/, 'tombol menu Playground + onLoginClick tersedia di navbar studio');

/* ---------- 4. UI dashboard sesuai brief ---------- */
const studio = read('src/components/Generator3dStudio.tsx');
for (const hex of ['#0f0f0f', '#1a1a1a', '#2a2a2a', '#00d4c8', '#f472b6']) assert.ok(studio.includes(hex), `palet warna ${hex}`);
for (const txt of [
  'Workspace', 'Resources', 'Subscribe',
  'Reference Image', 'AI 3D Model', 'Texture',
  'Upload / Drag &amp; Drop Image', 'Supported: .jpg, .jpeg, .png, .webp', 'Image Size: 64–4096 px', 'Max 20MB',
  'Generate Now', 'Estimated 2 min', 'Credit Details &gt;',
  'Asset Library', 'View All ({filtered.length})',
  'Generate a creation or select from your asset library.',
  'Tutorials',
]) assert.ok(studio.includes(txt), `teks UI: ${txt}`);
assert.match(studio, /\['Standard', 'Pro', 'Ultra'\] as Tier\[\]/, 'dropdown model Standard/Pro/Ultra');
assert.ok(!studio.includes('/> V2FUN'), 'judul+logo V2FUN dihapus dari navbar studio');
assert.match(studio, /useContext\(AuthContext\)/, 'navbar membaca user login dari AuthContext');
assert.match(studio, /<UserAvatar user=\{user\}/, 'avatar bulat navbar memakai UserAvatar (ikon profil user login)');
assert.match(studio, /underline underline-offset-4/, 'teks login tamu bergaris bawah');
assert.match(studio, /sessionStorage\.setItem\('by-open-login-on-home', '1'\)/, 'klik login menyetel flag pembuka modal di dasbor');
assert.match(pg, /onLoginClick=\{\(\) => navigate\('\/'\)\}/, 'PlaygroundPage meneruskan onLoginClick navigasi ke dasbor');
const home = read('src/pages/HomePage.tsx');
assert.match(home, /by-open-login-on-home/, 'HomePage membaca flag login dari navbar studio');
assert.match(home, /openLogin\?: boolean/, 'HomePage mendukung state openLogin');
assert.match(studio, /const TIER_COST: Record<Tier, number> = \{ Standard: 30, Pro: 60, Ultra: 120 \}/, 'biaya kredit per tier');
assert.match(studio, /segTab === 'text' \? prompt\.trim\(\).length > 0 : refImage !== null/, 'Generate aktif hanya bila ada input');
assert.match(studio, /disabled=\{!canGenerate\}/, 'tombol Generate punya state disabled');
assert.match(studio, /function ModelViewer/, 'viewer 3D hasil generate');
assert.match(studio, /await import\('three'\)/, 'viewer memakai three.js dinamis');
assert.match(studio, /Drag untuk memutar/, 'kontrol rotate di viewer');
assert.match(studio, /const PAGE_SIZE = 8/, 'paginasi pustaka aset');

/* ---------- 5. Perilaku jsdom: alur generate task-based ---------- */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com/playground?m=gen3d' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
globalThis.IntersectionObserver = class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} unobserve() {} };
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
globalThis.sessionStorage = dom.window.sessionStorage;
const dir = mkdtempSync(path.join(tmpdir(), 'playground-3d-'));
let root = null;
try {
  const { outputFiles } = await build({
    stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {default as Studio} from './src/components/Generator3dStudio';export {AuthContext} from './src/context/AuthContext';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
    loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
  });
  const file = path.join(dir, 'bundle.cjs'); writeFileSync(file, outputFiles[0].text);
  const { createElement: h, act, createRoot, Studio, AuthContext } = require(file);

  let taskCalls = 0;
  globalThis.fetch = async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null;
    if (body?.action === 'generate') {
      assert.ok(body.prompt.includes('royal crown'), 'prompt diteruskan ke proxy');
      assert.equal(body.with_texture, true, 'opsi tekstur default menyala');
      return new Response(JSON.stringify({ ok: true, task: { task_uuid: 'task-abc-123', status: 'QUEUED' } }));
    }
    if (body?.action === 'task') {
      taskCalls++;
      if (taskCalls === 1) return new Response(JSON.stringify({ ok: true, task: { task_uuid: 'task-abc-123', status: 'RUNNING' } }));
      return new Response(JSON.stringify({ ok: true, task: { task_uuid: 'task-abc-123', status: 'COMPLETED',
        metadata: { downloads: [{ asset_path: 'models/x.glb', download_url: 'https://asset.v2fun.ai/download/models/x.glb', download_expires_at: 9999999999 }] } } }));
    }
    return new Response(JSON.stringify({ ok: true }));
  };

  let loginSpyCalls = 0;
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(Studio, { onLoginClick: () => { loginSpyCalls++; } })));
  const txt0 = document.getElementById('root').textContent;
  for (const t of ['Workspace', 'Subscribe', '320', 'Image', 'Model', 'Animation', 'Tutorials', 'Reference Image', 'AI 3D Model', 'Texture', 'Upload / Drag & Drop Image', 'Asset Library', 'Generate a creation or select from your asset library.', 'View All (1)']) {
    assert.ok(txt0.includes(t), `UI awal memuat "${t}"`);
  }
  const genBtn = () => [...document.querySelectorAll('#root button')].find((b) => b.textContent.includes('Generate Now'));
  assert.equal(genBtn().disabled, true, 'Generate disabled sebelum ada input');

  /* pindah ke tab teks → isi prompt → Generate aktif */
  await act(async () => [...document.querySelectorAll('#root button')].find((b) => b.getAttribute('aria-label') === 'Prompt teks').click());
  const ta = document.querySelector('#root textarea');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, 'a royal crown with five pointed peaks and gem sockets');
    ta.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  assert.equal(genBtn().disabled, false, 'Generate aktif setelah prompt terisi');

  /* klik Generate → polling → COMPLETED → aset masuk pustaka + kredit terpotong */
  await act(async () => genBtn().click());
  await act(async () => { await new Promise((r) => setTimeout(r, 3000)); });
  assert.ok(document.getElementById('root').textContent.includes('Model sedang dibangun…'), 'status RUNNING tampil di canvas');
  await act(async () => { await new Promise((r) => setTimeout(r, 4600)); });
  const txt1 = document.getElementById('root').textContent;
  assert.ok(taskCalls >= 2, 'task dipoll lebih dari sekali');
  assert.ok(txt1.includes('View All (2)'), 'hasil generate menambah kartu pustaka');
  assert.ok(txt1.includes('260'), 'kredit terpotong biaya tier Pro (320-60)');
  assert.ok(txt1.includes('a royal crown with five pointed peaks and gem sockets'), 'nama aset dari prompt');
  // Viewer GLB: jsdom tanpa WebGL → fallback tautan unduh GLB tetap tersedia.
  await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
  const dl = [...document.querySelectorAll('#root a')].find((a) => a.textContent.includes('Unduh GLB'));
  assert.ok(dl, 'viewer gagal di jsdom → tautan unduh GLB tampil');
  assert.equal(dl.getAttribute('href'), 'https://asset.v2fun.ai/download/models/x.glb', 'tautan unduh memakai download_url task');

  /* navbar: judul/logo V2FUN hilang; tamu melihat teks "login" bergaris bawah */
  assert.ok(!txt0.includes('V2FUN'), 'judul/logo V2FUN tidak lagi dirender di navbar');
  const loginBtn = [...document.querySelectorAll('#root button')].find((b) => b.textContent.trim() === 'login');
  assert.ok(loginBtn, 'tamu melihat teks login di navbar studio');
  assert.ok(loginBtn.className.includes('underline'), 'teks login bergaris bawah');
  await act(async () => loginBtn.click());
  assert.equal(loginSpyCalls, 1, 'klik login memanggil onLoginClick (navigasi SPA ke dasbor)');
  assert.equal(dom.window.sessionStorage.getItem('by-open-login-on-home'), '1', 'flag pembuka modal login dasbor diset');

  /* user login: avatar bulat navbar = UserAvatar + initials user, teks login hilang */
  await act(async () => root.unmount()); root = null;
  const fakeUser = { id: 7, name: 'Dz Bot', username: 'dzbot', email: 'dz@bot.id', initials: 'DZ', joined: '', phone: '', timezone: 'WIB', balance: 0, role: 'user', plusActive: false };
  root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(AuthContext.Provider, { value: { user: fakeUser } }, h(Studio, {}))));
  const txt2 = document.getElementById('root').textContent;
  assert.ok(txt2.includes('DZ'), 'initials user login tampil di avatar navbar');
  assert.ok(![...document.querySelectorAll('#root button')].some((b) => b.textContent.trim() === 'login'), 'teks login hilang saat user sudah login');

  await act(async () => root.unmount()); root = null;
  console.log('PASS Playground Generate 3D Model: menu + halaman fullscreen, dashboard tanpa brand V2FUN (avatar user/login di navbar), proxy PHP Bearer key + polling task, dan alur generate→COMPLETED→aset+kredit.');
} finally {
  if (root) { const { act } = require(path.join(dir, 'bundle.cjs')); await act(async () => root.unmount()); }
  dom.window.close(); rmSync(dir, { recursive: true, force: true });
}
process.exit(0);
