// npm install --prefix /tmp/streak-tests jsdom
// NODE_PATH=/tmp/streak-tests/node_modules node scripts/test-streak-ui.mjs
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
const dir = mkdtempSync(path.join(tmpdir(), 'streak-ui-'));let root;
try {
 const { outputFiles } = await build({
  stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';export {default as Events} from './src/pages/EventsPage';export {default as GoogleFallback} from './src/components/GoogleProfileFallback';export {default as Daily} from './src/pages/DailyStreakPage';export {default as Titles} from './src/components/OwnedTitles';`, resolveDir: process.cwd() },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"development"' },
  plugins: [{ name: 'test-mocks', setup(build) {
   build.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'mock' }));
   build.onResolve({ filter: /components\/Seo$/ }, () => ({ path: 'seo', namespace: 'mock' }));
   build.onResolve({ filter: /context\/MusicContext$/ }, () => ({ path: 'music', namespace: 'mock' }));
   build.onResolve({ filter: /^@lottiefiles\/dotlottie-react$/ }, () => ({ path: 'lottie', namespace: 'mock' }));
   build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'seo' ? 'export default function Seo(){return null;}' : args.path === 'music' ? 'export const useMusic=()=>({play:()=>{}});' : args.path === 'auth' ? 'export const useAuth=()=>globalThis.__auth;' : `import {createElement} from 'react';export const DotLottieReact=props=>createElement('div',{'data-lottie':props.src,'data-loop':String(props.loop)});`, resolveDir: process.cwd() }));
  } }],
 });
 const file = path.join(dir, 'bundle.cjs');writeFileSync(file, outputFiles[0].text);
 const { createElement: h, act, createRoot, MemoryRouter, Routes, Route, useLocation, Events, GoogleFallback, Daily, Titles } = require(file);
 let refreshed = 0;globalThis.__auth = { user: { id: 1 }, refresh: async () => { refreshed++; } };
 const now = Math.floor(Date.now()/1000);
 const base = () => ({ day: 0, last_checkin: null, claimed_today: false, can_claim: true, today: '2026-11-19', next_day_at: now+3600, server_time: now, cycle: 1, reset_notice: false, reset_version: 0, trial_until: null, balance: 0, titles: [], event_active: true });
 let state = base();let calls = [];let fail = false;
 globalThis.fetch = async (url, options) => {
  if (url.endsWith('/events.php')) return new Response(JSON.stringify({ok:true,events:[{id:2,title:'Daily Streak',kind:'streak',status:'ongoing',effective_status:'ongoing',starts_at:null,ends_at:null}],server_time:new Date().toISOString()}));
  assert.ok(url.endsWith('/daily_streak.php'));const body = JSON.parse(options.body);calls.push(body);assert.equal(body.token, 'session');
  if (fail) return new Response(JSON.stringify({ ok: false, message: 'Sesi tidak valid' }), { status: 401 });
  let reward = null;
  if (body.action === 'claim' && !state.claimed_today) {
   state = { ...state, day: state.day+1, claimed_today: true, can_claim: false };
   if (state.day <= 6) { state.balance+=state.day;reward = { day: state.day, cash: state.day, trial_until: null }; }
   else { state.trial_until = new Date(Date.now()+86400000).toISOString();reward = { day: 7, cash: 0, trial_until: state.trial_until }; }
  }
  if (body.action === 'ack_reset') { assert.equal(body.version, state.reset_version);state.reset_notice = false; }
  return new Response(JSON.stringify({ ok: true, state, reward }));
 };
 const mount = async (Component = Daily) => { document.getElementById('origin').focus();root = createRoot(document.getElementById('root'));await act(async () => root.render(h(MemoryRouter, {initialEntries:['/event/daily-streak']}, h(Component)))); };
 const unmount = async () => { await act(async () => root.unmount());root = null;assert.equal(document.body.style.overflow, ''); };
 const button = text => [...document.querySelectorAll('#root button')].find(b => b.textContent.includes(text));
 const animation = () => document.querySelector('[role="dialog"] [data-lottie]') || document.querySelector('[data-lottie]');
 await mount();assert.equal(document.body.style.overflow, '');assert.equal(document.querySelector('[role="dialog"]'),null,'check-in is a page, not a sheet');assert.equal(document.querySelectorAll('[aria-label="Hadiah check-in harian"] > div').length, 7);
 await act(async () => { button('Check-in hari ke-1').click();button('Check-in hari ke-1').click(); });
 assert.equal(calls.filter(c => c.action === 'claim').length, 1, 'rapid double click makes one claim');
 assert.equal(state.balance, 1);assert.equal(refreshed, 1);assert.ok(animation().dataset.lottie.includes('iwCQfoJS1z'));assert.ok(button('Sudah check-in').disabled);
 await unmount();state = { ...base(), day: 2, claimed_today: true, can_claim: false };await mount();assert.ok(animation().dataset.lottie.includes('2Dft6FCcZn'));await unmount();
 state = { ...base(), day: 6 };await mount();await act(async () => button('Check-in hari ke-7').click());
 assert.ok(document.body.textContent.includes('Selamat! PLUS TRIAL'));assert.ok(animation().dataset.lottie.includes('9Lbirovu0g'));assert.equal(animation().dataset.loop, 'true');assert.equal(state.balance, 0, 'day seven does not credit cash');
 await act(async () => button('Mengerti').click());assert.ok(animation().dataset.lottie.includes('YJydJSM6hi'));await unmount();
 state = { ...base(), reset_notice: true, reset_version: 3 };await mount();assert.ok(document.body.textContent.includes('Streak terputus'));
 assert.ok(animation().dataset.lottie.includes('y5zJ7z4ncG'));assert.equal(animation().dataset.loop, 'false', 'failed animation plays once and holds last frame');
 await act(async () => button('Mengerti').click());assert.equal(state.reset_notice, false);assert.ok(button('Check-in hari ke-1'));await unmount();
 state = { ...base(), titles: [{ code: 'daily-streak-7', earned_at: '2026-11-19T00:00:00Z' }, { code: 'newyear-2027', earned_at: '2026-11-19T00:00:00Z' }] };
 await mount(Titles);assert.equal(document.querySelector('[role="dialog"]'),null,'owned titles display inline');assert.equal(document.querySelectorAll('article').length,2);assert.equal(document.querySelectorAll('[data-lottie]').length, 2);assert.ok(document.body.textContent.includes('Hitung Mundur Tahun Baru'));await unmount();
 for (const day of [2,3,4,5,6]) {
  state={...base(),day:day-1};await mount();await act(async()=>button(`Check-in hari ke-${day}`).click());
  assert.equal(state.balance,day);assert.ok(document.body.textContent.includes(`Rp${day} sudah masuk`));await unmount();
 }
 let location='';function Probe(){location=useLocation().pathname;return null;}
 state=base();root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(h(MemoryRouter,{initialEntries:['/event']},h(Probe),h(Routes,null,h(Route,{path:'/event',element:h(Events)}),h(Route,{path:'/event/daily-streak',element:h(Daily)})))));
 await act(async()=>button('Daily Streak').click());assert.equal(location,'/event/daily-streak');assert.ok(document.querySelector('[aria-label="Hadiah check-in harian"]'));assert.equal(document.querySelector('[role="dialog"]'),null);await act(async()=>document.querySelector('a[href="/event"]').click());assert.equal(location,'/event');await unmount();
 await mount(GoogleFallback);assert.ok(document.querySelector('[aria-label="Foto profil Google default"]'));await unmount();
 root=createRoot(document.getElementById('root'));await act(async()=>root.render(h(GoogleFallback,{src:'https://example.test/photo.png'})));
 assert.ok(document.querySelector('img[alt="Foto profil Google"]'));await act(async()=>document.querySelector('img').dispatchEvent(new window.Event('error')));assert.ok(document.querySelector('[aria-label="Foto profil Google default"]'));await unmount();
 fail = true;await mount();assert.ok(document.querySelector('[role="alert"]'));assert.equal(calls.filter(c => c.action === 'claim').length, 7, 'auth failures never claim rewards');await unmount();
 console.log('PASS: event card navigates to standalone page, day1–6 ascending cash, trial animation in seventh cell, inline vertical titles, Google fallback/error, 7-day grid, first/day2/day7 flames, double-click guard, refetch balance, seventh-day reward sheet, one-shot failure/reset acknowledgement, persisted owned title animations, auth errors and scroll/focus cleanup.');
} finally { if (root) { const { act } = require(path.join(dir,'bundle.cjs'));await act(async () => root.unmount()); }dom.window.close();rmSync(dir,{recursive:true,force:true}); }
