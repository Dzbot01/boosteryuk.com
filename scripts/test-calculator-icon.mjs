// Test-only jsdom/Chromium deps outside the project; build first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');const {chromium:pw}=require('playwright');const chromium=require('@sparticuz/chromium').default;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'calculator-icon-'));let root,browser,act;
const dom=new JSDOM('<div id="root"></div>',{url:'https://boosteryuk.com'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.MessageChannel=class{port1={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())};};
try{
 const {outputFiles}=await build({stdin:{contents:"export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter} from 'react-router-dom';export {default as Calculator} from './src/components/Calculator';export {default as Controls} from './src/components/BottomNavbar';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'mocks',setup(b){
  b.onResolve({filter:/(context\/(AuthContext|MusicContext|SiteSettingsContext)|lib\/apiBase|\/(UserAvatar|FAQModal|SettingsModal))$/},a=>({path:a.path.split('/').pop(),namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({resolveDir:process.cwd(),contents:({AuthContext:'export const useAuth=()=>({user:globalThis.user});',MusicContext:'export const useMusic=()=>({playing:false,toggle:()=>{},showTooltip:false});',SiteSettingsContext:'export const useSiteSettings=()=>({tenant:null});',apiBase:'export const IS_CHILD_PANEL=false;',UserAvatar:"import {createElement} from 'react';export default ()=>createElement('span',null,'U');",FAQModal:'export default ()=>null;',SettingsModal:'export default ()=>null;'})[a.path]}));
 }}]});
 const file=path.join(dir,'fixture.cjs');fs.writeFileSync(file,outputFiles[0].text);const bundle=require(file);({act}=bundle);const {createElement:h,createRoot,MemoryRouter,Calculator,Controls}=bundle;
 globalThis.user={initials:'U'};root=createRoot(document.getElementById('root'));
 const render=()=>root.render(h(MemoryRouter,null,h(Controls),h(Calculator)));
 await act(async()=>render());const launch=()=>document.querySelector('.calculator-launcher');const panel=()=>document.getElementById('floating-calculator-panel');
 assert.equal(launch().textContent.trim(),'');assert.ok(launch().querySelector('svg'));assert.equal(panel().getAttribute('aria-hidden'),'true');assert.ok(panel().hasAttribute('inert'));
 const closed=document.getElementById('root').innerHTML;
 await act(async()=>launch().click());assert.equal(launch().getAttribute('aria-expanded'),'true');assert.equal(panel().hasAttribute('inert'),false);assert.ok(!panel().textContent.includes('Kalkulator'));
 const button=text=>[...panel().querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 for(const key of ['7','+','5','='])await act(async()=>button(key).click());assert.ok(panel().textContent.includes('7 + 5 ='));assert.equal(panel().querySelector('.text-\\[24px\\]').textContent.trim(),'12');
 for(const key of ['C','8','÷','2','='])await act(async()=>button(key).click());assert.equal(panel().querySelector('.text-\\[24px\\]').textContent.trim(),'4');
 const opened=document.getElementById('root').innerHTML;
 await act(async()=>panel().querySelector('[aria-label="Tutup kalkulator"]').click());assert.equal(launch().getAttribute('aria-expanded'),'false');
 const index=fs.readdirSync('dist/assets').find(f=>f.startsWith('index-')&&f.endsWith('.css'));const css=fs.readFileSync('dist/assets/'+index,'utf8');
 browser=await pw.launch({headless:true,executablePath:await chromium.executablePath(),args:chromium.args});const page=await browser.newPage();
 for(const dark of [false,true])for(const width of [320,375,768,1024,1440])for(const open of [false,true]){
  await page.setViewportSize({width,height:640});await page.setContent(`<html class="${dark?'dark':''}"><style>${css}*{transition:none!important;animation:none!important}</style><body>${open?opened:closed}</body></html>`);
  const m=await page.evaluate(()=>{const q=s=>document.querySelector(s),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height};};const launcher=q('.calculator-launcher'),s=getComputedStyle(launcher);return {launcher:rect(launcher),bg:s.backgroundColor,shadow:s.boxShadow,border:s.borderTopWidth,panel:rect(q('.calculator-panel')),panelVisible:getComputedStyle(q('.calculator-panel')).visibility,bar:rect(q('[data-navigation-controls="bottom"]'))};});
  assert.equal(m.bg,'rgba(0, 0, 0, 0)');assert.equal(m.shadow,'none');assert.equal(m.border,'0px');assert.equal(m.launcher.h,44);assert.equal(m.launcher.bottom,616);assert.ok(m.launcher.x>=0 && m.launcher.right<=width);
  if(width<1024){assert.ok(m.launcher.x>=m.bar.right,'icon does not overlap bottom navbar');assert.ok(m.launcher.x-m.bar.right<=40,'icon stays adjacent to bottom navbar');}
  if(open){assert.ok(m.panel.x>=0&&m.panel.right<=width);assert.ok(m.panel.y>=0&&m.panel.bottom<=640);if(width<1024)assert.ok(m.panel.bottom<=m.bar.y,'panel stays above dock');}else assert.equal(m.panelVisible,'hidden');
 }
 console.log('PASS: icon-only transparent launcher, bottom dock adjacency/no overlap320–1440 light/dark, panel fit/hidden inert state, open/close, arithmetic7+5 and8÷2.');
}finally{if(root)await act(async()=>root.unmount());if(browser)await browser.close();dom.window.close();fs.rmSync(dir,{recursive:true,force:true});}
