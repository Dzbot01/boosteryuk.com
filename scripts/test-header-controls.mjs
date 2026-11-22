// Test-only jsdom + browser packages live outside project dependencies.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
const {chromium:pw}=require('playwright');const chromium=require('@sparticuz/chromium').default;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'header-controls-'));let root,browser,act;
const dom=new JSDOM('<div id="root"></div>',{url:'https://boosteryuk.com'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=cb=>setTimeout(cb,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.MessageChannel=class{port1={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())};};
try{
 const {outputFiles}=await build({stdin:{contents:"export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter} from 'react-router-dom';export {default as Header} from './src/components/Header';export {default as Controls} from './src/components/BottomNavbar';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'mocks',setup(b){
 b.onResolve({filter:/(context\/(AuthContext|SiteSettingsContext|MusicContext)|lib\/apiBase|\/(UserAvatar|FAQModal|SettingsModal))$/},a=>({path:a.path.split('/').pop(),namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({resolveDir:process.cwd(),contents:({
 AuthContext:'export const useAuth=()=>globalThis.auth;',SiteSettingsContext:"export const useSiteSettings=()=>({settings:{brandName:'Booster',brandSuffix:'yuk',logoUrl:'/logo.webp'},tenant:globalThis.tenant});",MusicContext:'export const useMusic=()=>globalThis.music;',apiBase:'export const IS_CHILD_PANEL=false;',
 UserAvatar:"import {createElement} from 'react';export default ()=>createElement('span',null,'U');",
 FAQModal:"import {createElement} from 'react';export default ({isOpen,onClose})=>isOpen?createElement('div',{role:'dialog','aria-label':'FAQ'},createElement('button',{onClick:onClose},'Tutup FAQ')):null;",
 SettingsModal:"import {createElement} from 'react';export default ({isOpen,onClose})=>isOpen?createElement('div',{role:'dialog','aria-label':'Pengaturan'},createElement('button',{onClick:onClose},'Tutup Pengaturan')):null;"
 })[a.path]}));
 }}]});const file=path.join(dir,'test.cjs');fs.writeFileSync(file,outputFiles[0].text);
 const bundle=require(file);({act}=bundle);const {createElement:h,createRoot,MemoryRouter,Header,Controls}=bundle;
 let toggles=0,menus=0;globalThis.music={playing:false,toggle:()=>toggles++,showTooltip:false};globalThis.auth={user:{initials:'U'}};globalThis.tenant=null;
 root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(h(MemoryRouter,null,h(Header,{menuOpen:false,onToggleMenu:()=>menus++}),h(Controls))));
 const header=document.querySelector('header');const controls=header.querySelector('[data-navigation-controls="header"]');assert.ok(controls);
 await act(async()=>controls.querySelector('[aria-label="FAQ"]').click());assert.ok(document.querySelector('[role="dialog"][aria-label="FAQ"]'));assert.equal(header.querySelector('[role="dialog"]'),null,'modal portals outside fixed/blurred header');await act(async()=>[...document.querySelectorAll('button')].find(e=>e.textContent==='Tutup FAQ').click());
 await act(async()=>controls.querySelector('[aria-label="Pengaturan"]').click());assert.ok(document.querySelector('[role="dialog"][aria-label="Pengaturan"]'));await act(async()=>[...document.querySelectorAll('button')].find(e=>e.textContent==='Tutup Pengaturan').click());
 await act(async()=>controls.querySelector('[aria-label="Putar musik"]').click());assert.equal(toggles,1);
 await act(async()=>header.querySelector('input[aria-label="Buka menu"]').click());assert.equal(menus,1);
 // Browser geometry checks use the same rendered control markup + built CSS.
 const markup=document.getElementById('root').innerHTML;
 const index=fs.readdirSync('dist/assets').find(f=>f.startsWith('index-')&&f.endsWith('.css'));const css=fs.readFileSync('dist/assets/'+index,'utf8');
 browser=await pw.launch({headless:true,executablePath:await chromium.executablePath(),args:chromium.args});const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 for(const width of [375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await page.setContent(`<style>${css}*{animation:none!important;transition:none!important}</style>${markup}`);
  const m=await page.evaluate(()=>{const q=s=>document.querySelector(s);const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;const h=q('header');return {bottom:visible(q('[data-navigation-controls="bottom"]')),header:visible(q('[data-navigation-controls="header"]')),brand:visible(h.querySelector('a')),order:[...h.querySelectorAll('button[aria-label],label[data-by-menu-toggle]')].filter(visible).map(e=>({label:e.getAttribute('aria-label')||e.title,x:e.getBoundingClientRect().x})).sort((a,b)=>a.x-b.x).map(e=>e.label),overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.equal(m.overflow,false);assert.equal(m.bottom,width<1024);assert.equal(m.header,width>=1024);assert.equal(m.brand,width<1024,'desktop header has no brand logo/title');
  if(width>=1024)assert.deepEqual(m.order,['Playground','Buka menu','FAQ','Putar musik','Profil','Pengaturan'],'rightmost settings then profile/music/FAQ/menu');
 }
 console.log('PASS: desktop right-edge settings/profile/music/FAQ/hamburger order, no desktop bottom bar, mobile bottom bar retained, no desktop brand, FAQ/settings portals and actions, music/hamburger callbacks, no overflow375–1920.');
}finally{if(root)await act(async()=>root.unmount());if(browser)await browser.close();dom.window.close();fs.rmSync(dir,{recursive:true,force:true});}
