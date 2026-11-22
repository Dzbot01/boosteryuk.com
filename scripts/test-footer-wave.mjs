// Build first; test-only browser packages live outside project dependencies.
// NODE_PATH=/tmp/hero-browser/node_modules node scripts/test-footer-wave.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import postcss from 'postcss';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
const {chromium:pw}=require('playwright');const chromium=require('@sparticuz/chromium').default;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'footer-wave-'));let browser;
try{
 const {outputFiles}=await build({stdin:{contents:`import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import Footer from './src/components/Footer';export {getUserMenuItems,getAdminMenuItems,baseMenu,authMenu,ROUTE_PATH} from './src/components/SideMenu';export {setChild} from './src/lib/apiBase';export const render=()=>renderToStaticMarkup(createElement(Footer));`,resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',loader:{'.css':'empty','.webp':'dataurl','.mp3':'dataurl'},plugins:[{name:'mocks',setup(b){
  b.onResolve({filter:/(context\/(AuthContext|SiteSettingsContext)|services\/panelApi|lib\/apiBase|^react-router-dom$|\/UserAvatar)$/},a=>({path:a.path.split('/').pop(),namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({resolveDir:process.cwd(),contents:({
   AuthContext:'export const useAuth=()=>globalThis.auth;',SiteSettingsContext:"export const useSiteSettings=()=>({settings:{brandName:'Booster',brandSuffix:'yuk',logoUrl:'/logo.webp',footerText:'Existing copyright'}});",
   panelApi:'export const usePanelOwner=()=>globalThis.owner;',apiBase:'export let IS_CHILD_PANEL=false;export const setChild=v=>{IS_CHILD_PANEL=v;};',
   'react-router-dom':"import {createElement} from 'react';export const Link=({to,children,...props})=>createElement('a',{href:to,...props},children);export const useNavigate=()=>()=>{};export const useLocation=()=>({pathname:'/'});",UserAvatar:'export default ()=>null;'
  })[a.path]}));
 }}]});
 const file=path.join(dir,'fixture.cjs');fs.writeFileSync(file,outputFiles[0].text);const fixture=require(file);
 // Compare the shared selector to the pre-change hamburger logic, not a new
 // independently maintained list that could quietly omit protected menu items.
 const original=fs.readFileSync('backups/hero-footer-before-wave/SideMenu.tsx.bak','utf8');
 const originalBody=original.slice(original.indexOf('  const AUTH_REQUIRED ='),original.indexOf('\n  const handleNav')).replace(' as PageId','');
 const originalSelect=new Function('Smartphone','baseMenu','authMenu','HIDDEN_USER_ITEMS','HIDDEN_PROFILE_ITEM','user','isAdmin','IS_CHILD_PANEL',originalBody+';return menuItems;');
 let sample;
 for(const child of [false,true])for(const signedIn of [false,true])for(const admin of [false,true])for(const owner of [false,true]){
  globalThis.auth={user:signedIn?{token:'session'}:null,isAdmin:admin,logout:()=>{}};globalThis.owner=owner;fixture.setChild(child);
  const originalItems=originalSelect(fixture.getUserMenuItems(true,false,true).find(i=>i.id==='nokos').icon,fixture.baseMenu,fixture.authMenu,['payment','struk'],'profil',auth.user,admin,child);
  assert.deepEqual(fixture.getUserMenuItems(signedIn,admin,child),originalItems);
  const html=fixture.render();const dom=new JSDOM(html);const q=s=>dom.window.document.querySelector(s);
  const expected=[];if(!child)expected.push(['Playground','/playground']);if(!admin&&owner&&child)expected.push(['Admin Panel Toko','/panel-admin']);
  for(const item of admin?fixture.getAdminMenuItems(child):originalItems)expected.push([item.label,admin?item.path:fixture.ROUTE_PATH[item.id]]);
  if(signedIn)expected.push(['Profil & Pengaturan','/profil'],['Keluar',null]);
  const actual=[...dom.window.document.querySelectorAll('.site-footer-nav .site-footer-row')].map(e=>[e.querySelector('.site-footer-menu-label').textContent,e.getAttribute('href')]);assert.deepEqual(actual,expected,'footer reproduces visible header/sidebar menu order and destinations');
  assert.deepEqual([...dom.window.document.querySelectorAll('.site-footer-socials a')].map(a=>a.getAttribute('href')),['#','#','#','#']);assert.equal(q('.site-footer-logo img').getAttribute('src'),'/logo.webp');assert.ok(q('.site-footer-bottom').textContent.includes('Existing copyright'));
  assert.deepEqual([...dom.window.document.querySelectorAll('.site-footer-bottom a')].map(a=>a.textContent),['Layanan','Cek Status','Artikel','Tentang','Syarat','Privasi']);
  if(signedIn&&!admin&&!child)sample=html;dom.window.close();
 }
 const css=fs.readFileSync('src/components/Footer.css','utf8');postcss.parse(css).walkRules(r=>assert.ok(r.selectors.every(s=>s.startsWith('.site-footer'))));assert.doesNotMatch(css,/@keyframes|animation:|transition:|gradient/);
 const index=fs.readdirSync('dist/assets').find(f=>f.startsWith('index-')&&f.endsWith('.css'));const fullCSS=fs.readFileSync('dist/assets/'+index,'utf8');
 browser=await pw.launch({headless:true,executablePath:await chromium.executablePath(),args:chromium.args});const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 for(const dark of [false,true])for(const width of [360,375,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});await page.setContent(`<html class="${dark?'dark':''}"><style>${fullCSS}${css}</style><body>${sample}</body></html>`);
  const m=await page.evaluate(()=>{const q=s=>document.querySelector(s),r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};};return {overflow:document.documentElement.scrollWidth>innerWidth,brand:r(q('.site-footer-brand')),nav:r(q('.site-footer-nav')),wave:r(q('.site-footer-wave')),body:r(q('.site-footer-body')),blue:getComputedStyle(q('.site-footer-body')).backgroundColor,fill:getComputedStyle(q('.site-footer-wave')).fill,rows:[...document.querySelectorAll('.site-footer-row')].map(r)};});
  assert.equal(m.overflow,false,`no footer overflow ${width}`);assert.equal(m.wave.w,width);assert.equal(m.wave.h,60);assert.ok(Math.abs(m.wave.bottom-m.body.y)<=1,'wave and body have no gap');assert.equal(m.blue,'rgb(14, 165, 233)');assert.equal(m.fill,m.blue);assert.ok(m.rows.every(r=>r.h>=56));
  if(width>=1024)assert.equal(m.brand.y,m.nav.y,'two desktop columns');else assert.ok(m.nav.y>=m.brand.bottom,'one mobile/tablet column');
 }
 console.log('PASS: footer/header/sidebar menu parity across guest/user/admin/child/owner, old links/copyright/logo retained, no invented social URLs. Chromium wave/no seam, blue/dark parity, one/two columns, row targets and no overflow360–1920px.');
}finally{if(browser)await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
