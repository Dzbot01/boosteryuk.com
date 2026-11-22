// Test-only browser deps can live outside the repo:
// NODE_PATH=/tmp/hero-browser/node_modules node scripts/test-hero-viewport.mjs
// Run npm run build first. Chromium requires its usual Linux shared libraries.
// No runtime dependencies are added to the app.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import postcss from 'postcss';
const require=createRequire(import.meta.url);
const {chromium:pw}=require('playwright');const chromium=require('@sparticuz/chromium').default;
const old=fs.readFileSync('backups/hero-before-desktop-scale/HomePage.tsx.bak','utf8');
const current=fs.readFileSync('src/pages/HomePage.tsx','utf8');
const oldCSS=fs.readFileSync('backups/hero-before-desktop-scale/HomePage.hero-desktop.css.bak','utf8');
const newCSS=fs.readFileSync('src/pages/HomePage.hero-desktop.css','utf8');
assert.equal(current.replace('home-hero-container ',''),old,'only hero container class changed in JSX');
postcss.parse(newCSS).walkRules(r=>{assert.equal(r.parent.name,'media');assert.ok(r.parent.params.startsWith('(min-width: 1024px)'));});
assert.doesNotMatch(newCSS,/background:|color:|font-family:|animation:|@keyframes|box-shadow:/);
assert.doesNotMatch(newCSS,/right: -128px|position: absolute/,'remove former desktop mascot positioning');
const cssFile=fs.readdirSync('dist/assets').find(f=>f.startsWith('index-')&&f.endsWith('.css'));assert.ok(cssFile);
const parsed=postcss.parse(fs.readFileSync('dist/assets/'+cssFile,'utf8'));
parsed.walkRules(r=>{if(r.selector.includes('home-hero-'))r.remove();});
const baseCSS=parsed.toString();
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hero-viewport-'));
async function render(source,loggedIn){
 const componentFile=path.join(dir,`page-${loggedIn}-${Math.random()}.cjs`);
 const bundled=await build({stdin:{contents:`import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';${source.replace('export default function HomePage()', 'function HomePage()')}\nexport const html=renderToStaticMarkup(createElement(HomePage));`,resolveDir:path.resolve('src/pages'),loader:'tsx'},define:{'import.meta.env.VITE_SITE_URL':'undefined'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',loader:{'.css':'empty'},plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/(components\/(Seo|Reveal|AuthModal|ReviewsSection)|context\/(ThemeContext|SiteSettingsContext|AuthContext)|^react-router-dom$)/},a=>({path:a.path.split('/').pop(),namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({resolveDir:process.cwd(),contents:a.path==='Reveal'?"import {createElement} from 'react';export default ({children,className=''})=>createElement('div',{className},children);":a.path==='react-router-dom'?"export const useNavigate=()=>()=>{};":a.path==='ThemeContext'?"export const useTheme=()=>({isDark:false});":a.path==='AuthContext'?`export const useAuth=()=>({user:${loggedIn?'{id:1}':'null'}});`:a.path==='SiteSettingsContext'?"export const useSiteSettings=()=>({settings:{brandName:'Booster',brandSuffix:'yuk',logoUrl:'/mascot.png'},heroImageSrc:'',dashboardVideo:null});":"export default ()=>null;"}));
 }}]});
 fs.writeFileSync(componentFile,bundled.outputFiles[0].text);return require(componentFile).html;
}
let browser;
try{
 browser=await pw.launch({headless:true,executablePath:await chromium.executablePath(),args:chromium.args});const page=await browser.newPage();await page.route('**/*',r=>r.abort());
 const html={};for(const logged of [false,true]){html[`old${logged}`]=await render(old,logged);html[`new${logged}`]=await render(current,logged);}
 async function measure(version,width,logged,height=900){await page.setViewportSize({width,height});await page.setContent(`<style>${baseCSS}\n${version==='old'?oldCSS:newCSS}
*{animation:none!important;transition:none!important}</style><div class="${logged?'lg:pl-16':''}">${html[version+logged]}</div>`);return page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2};};const q=s=>document.querySelector(s);return {hero:rect(q('section')),copy:rect(q('.home-hero-copy')),title:rect(q('h1')),stats:rect(q('.home-hero-stats')),divider:rect(q('.home-hero-stats > span')),buttons:[...document.querySelectorAll('.home-hero-primary > button,.home-hero-auth > button')].map(rect),mascot:rect(q('img[alt="Boosteryuk"]')),tagline:rect(q('.home-hero-tagline')),desc:rect(q('.home-hero-description')),rating:rect(q('.home-hero-rating')),stageDisplay:getComputedStyle(q('.home-hero-copy').parentElement).display};});}
 for(const logged of [false,true])for(const width of [375,768,1023])assert.deepEqual(await measure('new',width,logged),await measure('old',width,logged),`mobile/tablet unchanged ${width} logged=${logged}`);
 for(const logged of [false,true])for(const width of [1024,1280,1440,1920])for(const height of [720,768,900,1080]){
  const m=await measure('new',width,logged,height);
  for(const group of ['copy','title','stats','divider','tagline','desc','rating'])assert.ok(Math.abs(m[group].cx-width/2)<1,`${group} centered ${width} logged=${logged}: ${m[group].cx}`);
  assert.ok(Math.abs(m.tagline.y-(m.title.y+m.title.h)-16)<1);
  assert.ok(Math.abs(m.desc.y-(m.tagline.y+m.tagline.h)-24)<1);
  assert.ok(Math.abs(m.rating.y-(m.desc.y+m.desc.h)-32)<1);
  assert.ok(Math.abs(m.stats.y-(m.rating.y+m.rating.h)-32)<1);
  assert.ok(Math.abs(m.buttons[0].y-(m.stats.y+m.stats.h)-40)<1);
  assert.equal(m.stageDisplay,'block');assert.equal(m.copy.w,760);
  assert.equal(m.mascot.w,0,'floating mascot has no desktop box');assert.equal(m.mascot.h,0);
  assert.ok(m.hero.h<=height,`hero ${m.hero.h}px must fit ${width}x${height}`);
  assert.ok(m.title.h<=93,'title stays on one line');assert.ok(m.tagline.h<=96,'tagline stays on two intentional lines');assert.ok(m.desc.h<=65,'description stays on two lines');
  for(const button of m.buttons)assert.equal(button.h,56);
  if(!logged){assert.equal(m.buttons.length,3);assert.equal(m.buttons[1].w,m.buttons[2].w);assert.ok(m.buttons[1].w>=144);assert.ok(m.buttons.every(b=>Math.abs(b.cy-m.buttons[0].cy)<1));assert.ok(Math.abs((m.buttons[0].x+m.buttons[2].x+m.buttons[2].w)/2-width/2)<1);for(let i=1;i<3;i++)assert.ok(Math.abs(m.buttons[i].x-(m.buttons[i-1].x+m.buttons[i-1].w)-16)<1);}
 }
 console.log('PASS Chromium: 760px hero centered at viewport50%, symmetric stats, 56px CTA row/16px gaps/equal secondary buttons; floating mascot has no desktop box; no excessive line wraps; hero fits 720/768/900/1080px heights at 1024/1280/1440/1920 widths, guest+login. Mobile/tablet geometry unchanged at375/768/1023.');

}finally{if(browser)await browser.close();fs.rmSync(dir,{recursive:true,force:true});}
