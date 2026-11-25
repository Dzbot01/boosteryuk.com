// Uji perilaku Daily Streak saat streak PUTUS lalu progres mengulang dari hari ke-1:
// hadiah uang yang sudah pernah diterima tidak dibayar lagi (check-in tetap tercatat),
// sedangkan hari yang belum pernah diterima tetap dibayar penuh.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-streak-repeat.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
const require = createRequire(import.meta.url);const { JSDOM } = require('jsdom');
const dom = new JSDOM('<button id="origin">Open</button><div id="root"></div>', { url: 'https://boosteryuk.com' });
globalThis.window = dom.window;globalThis.document = dom.window.document;globalThis.localStorage = dom.window.localStorage;
localStorage.setItem('token', 'session');globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.MessageChannel = class { port1 = { onmessage: null };port2 = { postMessage: () => setImmediate(() => this.port1.onmessage?.()) }; };
const dir = mkdtempSync(path.join(tmpdir(), 'streak-repeat-'));let root;
try {
 const { outputFiles } = await build({
  stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter} from 'react-router-dom';export {default as Daily} from './src/pages/DailyStreakPage';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'test-mocks', setup(build) {
   build.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'mock' }));
   build.onResolve({ filter: /components\/Seo$/ }, () => ({ path: 'seo', namespace: 'mock' }));
   build.onResolve({ filter: /context\/MusicContext$/ }, () => ({ path: 'music', namespace: 'mock' }));
   build.onResolve({ filter: /^@lottiefiles\/dotlottie-react$/ }, () => ({ path: 'lottie', namespace: 'mock' }));
   build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'seo' ? 'export default function Seo(){return null;}' : args.path === 'music' ? 'const music={play:()=>{},toggle:()=>{},playing:false,blocked:false};export const useMusic=()=>music;' : args.path === 'auth' ? 'export const useAuth=()=>globalThis.__auth;' : `import {createElement} from 'react';export const DotLottieReact=props=>createElement('div',{'data-lottie':props.src,'data-loop':String(props.loop)});`, resolveDir: process.cwd() }));
  } }],
 });
 const file = path.join(dir, 'bundle.cjs');writeFileSync(file, outputFiles[0].text);
 const { createElement: h, act, createRoot, MemoryRouter, Daily } = require(file);
 let refreshed = 0;globalThis.__auth = { user: { id: 1 }, refresh: async () => { refreshed++; } };
 const now = Math.floor(Date.now()/1000);
 /** Siklus ke-2: hari 1-3 uangnya sudah pernah masuk di siklus pertama. */
 const base = (over = {}) => ({ day: 0, last_checkin: null, claimed_today: false, can_claim: true, today: '2026-11-19',
  next_day_at: now+3600, server_time: now, cycle: 2, reset_notice: false, reset_version: 1, trial_until: null,
  balance: 60, titles: [], event_active: true, paid_days: [1,2,3], next_cash: 0, ...over });
 let state = base();const calls = [];
 globalThis.fetch = async (url, options) => {
  assert.ok(url.endsWith('/daily_streak.php'));
  const body = JSON.parse(options.body);calls.push(body);assert.equal(body.token, 'session');
  let reward = null;
  if (body.action === 'claim' && !state.claimed_today) {
   const day = state.day + 1;
   const already = state.paid_days.includes(day);
   const cash = day <= 6 && !already ? day * 10 : 0;
   const paid = cash > 0 ? [...state.paid_days, day].sort((a,b)=>a-b) : state.paid_days;
   state = { ...state, day, claimed_today: true, can_claim: false, balance: state.balance + cash, paid_days: paid,
    next_cash: day < 6 ? (paid.includes(day+1) ? 0 : (day+1)*10) : 0 };
   reward = { day, cash, already_paid: already, trial_until: null };
  }
  return new Response(JSON.stringify({ ok: true, state, reward }));
 };
 const mount = async () => { document.getElementById('origin').focus();root = createRoot(document.getElementById('root'));
  await act(async () => root.render(h(MemoryRouter, {initialEntries:['/event/daily-streak']}, h(Daily)))); };
 const unmount = async () => { await act(async () => root.unmount());root = null;assert.equal(document.body.style.overflow, ''); };
 const button = text => [...document.querySelectorAll('#root button')].find(b => b.textContent.includes(text));
 const cells = () => [...document.querySelectorAll('[aria-label="Hadiah check-in harian"] > div')];

 /* 1. Kartu hari: hari yang uangnya sudah pernah diterima ditandai, hari lain tidak. */
 await mount();
 assert.equal(cells().length, 7, 'tujuh kartu hari tetap tampil');
 for (const day of [1,2,3]) assert.ok(cells()[day-1].textContent.includes('Uang sudah pernah diterima'), `hari ${day} ditandai sudah pernah diterima`);
 for (const day of [4,5,6]) assert.ok(!cells()[day-1].textContent.includes('Uang sudah pernah diterima'), `hari ${day} masih berhak hadiah`);
 assert.ok(cells()[0].textContent.includes('Check-in tanpa uang'), 'hari berikutnya = check-in tanpa uang');
 assert.ok(cells()[3].textContent.includes('Terkunci'), 'hari yang belum dibuka tetap terkunci');
 assert.ok(document.body.textContent.includes('Check-in hari ini tanpa hadiah uang (sudah pernah diterima)'), 'keterangan header saat next_cash 0');
 assert.ok(button('Check-in hari ke-1'), 'check-in tetap bisa dilakukan walau tanpa uang');

 /* 2. Claim hari ke-1 (ulang): tercatat, tanpa uang. */
 await act(async () => button('Check-in hari ke-1').click());
 assert.equal(calls.filter(c => c.action === 'claim').length, 1);
 assert.equal(state.balance, 60, 'saldo tidak bertambah untuk hari yang sudah pernah dibayar');
 assert.equal(refreshed, 1, 'saldo tetap disinkronkan ulang');
 assert.ok(document.body.textContent.includes('Check-in hari ke-1 berhasil tercatat! Hadiah uang hari ini sudah pernah kamu terima sebelumnya, jadi tidak ditambahkan lagi.'), 'pesan check-in tanpa uang');
 assert.ok(!document.body.textContent.includes('Rp0 sudah masuk'), 'tidak ada pesan "Rp0 sudah masuk"');
 assert.equal(cells()[0].textContent.includes('Diklaim'), true, 'hari ke-1 siklus baru tetap ditandai diklaim');
 await unmount();

 /* 3. Hari ke-2 dan ke-3 (ulang) juga tanpa uang, lalu hari ke-4 dibayar penuh. */
 state = base({ day: 1, claimed_today: false, can_claim: true, last_checkin: '2026-11-18', next_cash: 0 });
 await mount();await act(async () => button('Check-in hari ke-2').click());
 assert.equal(state.balance, 60, 'hari ke-2 tanpa uang');
 assert.ok(document.body.textContent.includes('Check-in hari ke-2 berhasil tercatat!'), 'pesan hari ke-2');
 await unmount();
 state = base({ day: 2, claimed_today: false, can_claim: true, last_checkin: '2026-11-18', next_cash: 0 });
 await mount();await act(async () => button('Check-in hari ke-3').click());
 assert.equal(state.balance, 60, 'hari ke-3 tanpa uang');await unmount();
 state = base({ day: 3, claimed_today: false, can_claim: true, last_checkin: '2026-11-18', next_cash: 40 });
 await mount();
 assert.ok(!cells()[3].textContent.includes('Uang sudah pernah diterima'), 'hari ke-4 belum pernah diterima');
 assert.ok(cells()[3].textContent.includes('Tersedia hari ini'), 'hari ke-4 tersedia hari ini');
 assert.ok(document.body.textContent.includes('Hadiah hari ini menunggumu'), 'header kembali menjanjikan hadiah');
 await act(async () => button('Check-in hari ke-4').click());
 assert.equal(state.balance, 100, 'hari ke-4 dibayar Rp40 penuh');
 assert.ok(document.body.textContent.includes('Check-in berhasil! Rp40 sudah masuk ke saldo website.'), 'pesan hadiah masuk');
 await unmount();

 /* 4. Akun baru (belum pernah menerima apa pun) tidak terpengaruh. */
 state = base({ cycle: 1, paid_days: [], next_cash: 10, balance: 0 });
 await mount();
 for (const day of [1,2,3,4,5,6]) assert.ok(!cells()[day-1].textContent.includes('Uang sudah pernah diterima'), `akun baru: hari ${day} masih berhak`);
 await act(async () => button('Check-in hari ke-1').click());
 assert.equal(state.balance, 10, 'akun baru tetap dibayar Rp10');
 assert.ok(document.body.textContent.includes('Rp10 sudah masuk ke saldo website.'));
 await unmount();
 console.log('PASS Daily Streak: setelah streak putus & mengulang, hari yang uangnya sudah pernah diterima hanya check-in tanpa uang, hari yang belum pernah diterima tetap dibayar penuh, akun baru tidak terpengaruh.');
} finally { if (root) { const { act } = require(path.join(dir,'bundle.cjs'));await act(async () => root.unmount()); }dom.window.close();rmSync(dir,{recursive:true,force:true}); }
