// Test-only jsdom: NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-guri-voice.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://boosteryuk.com'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.sessionStorage=dom.window.sessionStorage;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.MessageChannel=class{port1={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())};};
const modal=readFileSync('src/components/AuthModal.tsx','utf8');assert.ok(modal.indexOf('boostyVoice.prime();')<modal.indexOf('await startGoogleLogin()'),'prime synchronously inside login gesture');
const audios=[];let blocked=false;let pendingReject;
globalThis.Audio=class{
 src='';muted=false;volume=1;currentTime=0;plays=0;pauses=0;
 constructor(){audios.push(this);}
 play(){this.plays++;if(blocked==='pending')return new Promise((_,reject)=>{pendingReject=reject;});return blocked?Promise.reject(new Error('NotAllowedError')):Promise.resolve();}
 pause(){this.pauses++;}
};
const dir=mkdtempSync(path.join(tmpdir(),'guri-voice-'));let root;let act;
try{
const {outputFiles}=await build({stdin:{contents:"export {createElement,act,StrictMode} from 'react';export {createRoot} from 'react-dom/client';export {boostyVoice} from './src/services/boostyVoice';export {default as Session} from './src/components/GuriVoiceSession';export {default as Card} from './src/components/AiAssistantCard';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',loader:{'.mp3':'dataurl','.webp':'dataurl','.png':'dataurl'},plugins:[{name:'mocks',setup(b){
b.onResolve({filter:/(AuthContext|SiteSettingsContext|lib\/apiBase)$/},a=>({path:a.path.split('/').pop(),namespace:'mock'}));
b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='AuthContext'?'export const useAuth=()=>globalThis.auth;':a.path==='SiteSettingsContext'?'export const useSiteSettings=()=>globalThis.settings;':'export const IS_CHILD_PANEL=true;'}));
}}]});writeFileSync(path.join(dir,'test.cjs'),outputFiles[0].text);
const bundle=require(path.join(dir,'test.cjs'));({act}=bundle);const {createElement:h,StrictMode,createRoot,boostyVoice:voice,Session,Card}=bundle;
let changes=0;const unsub=voice.subscribe(()=>changes++);
voice.start('welcome');assert.equal(audios.length,1);assert.equal(voice.getState().voice.id,'welcome');await Promise.resolve();const a=audios[0];a.currentTime=6;a.ontimeupdate();assert.ok(voice.getState().subtitle.includes('ini?'));a.onended();assert.equal(voice.isActive(),false);
voice.start('full');await Promise.resolve();a.onended();assert.equal(voice.getState().voice.id,'reseller');assert.equal(audios.length,1);a.onended();assert.equal(voice.isActive(),false);
voice.start('welcome');voice.start('off');assert.deepEqual(voice.getState(),{voice:null,subtitle:'',blocked:false});
blocked=true;voice.start('welcome');await Promise.resolve();await Promise.resolve();assert.equal(voice.getState().blocked,true);blocked=false;window.dispatchEvent(new window.Event('pointerdown'));window.dispatchEvent(new window.Event('click'));await new Promise(setImmediate);assert.equal(voice.getState().blocked,false);voice.stop();const plays=a.plays;window.dispatchEvent(new window.Event('click'));assert.equal(a.plays,plays,'stop removes gesture retries');
blocked='pending';voice.start('welcome');voice.stop();pendingReject(new Error('late rejection'));await new Promise(setImmediate);assert.equal(voice.getState().blocked,false);assert.equal(voice.isActive(),false);window.dispatchEvent(new window.Event('click'));assert.equal(a.plays,plays+1,'stale promise cannot rearm stopped playback');
unsub();assert.ok(changes>0);blocked=false;
globalThis.auth={user:null,loading:false};globalThis.settings={voiceMode:'full',tenant:null};root=createRoot(document.getElementById('root'));
const render=()=>root.render(h(StrictMode,null,h(Session),h(Card,{category:'',serviceName:null,hasTarget:false,qty:0,priceText:'Rp0',ordering:false,orderNotice:null})));
const finishGreeting=async()=>{for(let i=0;i<6&&voice.isActive();i++){await act(async()=>a.onended());}};
const emptyAreaClicks=async()=>{await act(async()=>{['pointerdown','keydown','touchstart','click'].forEach((ev)=>window.dispatchEvent(new window.Event(ev)));});await new Promise(setImmediate);};
await act(async()=>render());const before=a.plays;
auth={user:{token:'session1'},loading:false};await act(async()=>render());assert.equal(a.plays,before,'child config must arrive before audio');
sessionStorage.setItem('by-just-logged-in',String(Date.now()));
settings={voiceMode:'off',tenant:{id:1}};await act(async()=>render());assert.equal(a.plays,before,'off mode stays silent');
blocked=true;sessionStorage.setItem('by-just-logged-in',String(Date.now()));settings={voiceMode:'welcome',tenant:{id:1}};auth={user:{token:'session1b'},loading:false};
await act(async()=>render());assert.equal(a.plays,before+1,'login baru membunyikan sapaan sekali');assert.ok(document.body.textContent.includes('Suara menunggu izin browser'));assert.equal(document.querySelectorAll('button').length,0,'Guri card has no playback or extra buttons');
blocked=false;await act(async()=>window.dispatchEvent(new window.Event('pointerdown')));assert.equal(voice.getState().blocked,false);assert.ok(document.body.textContent.includes('Sedang berbicara'));
const stable=a.plays;auth={...auth,user:{...auth.user,name:'refreshed'}};await act(async()=>render());assert.equal(a.plays,stable,'balance/profile refresh must not replay greeting');
await finishGreeting();assert.equal(voice.isActive(),false);
await emptyAreaClicks();assert.equal(a.plays,stable,'klik bilah kosong sesudah sapaan selesai tidak memutar audio');
auth={user:null,loading:false};await act(async()=>render());assert.equal(voice.isActive(),false);
/* BUG FIX: sesi dipulihkan (refresh/kunjungan berikutnya) tanpa login baru → tetap senyap. */
auth={user:{token:'session2'},loading:false};await act(async()=>render());assert.equal(a.plays,stable,'pemulihan sesi tanpa login baru tidak membunyikan sapaan');
await emptyAreaClicks();assert.equal(a.plays,stable,'pemulihan sesi + klik bilah kosong tetap senyap');
/* Login baru (penanda sesi diset AuthContext) → sapaan berbunyi sekali. */
sessionStorage.setItem('by-just-logged-in',String(Date.now()));
auth={user:{token:'session3'},loading:false};await act(async()=>render());assert.equal(a.plays,stable+1,'login baru membunyikan sapaan');
assert.equal(sessionStorage.getItem('by-just-logged-in'),null,'penanda login dikonsumsi sekali');
await finishGreeting();const afterLogin=a.plays;await emptyAreaClicks();assert.equal(a.plays,afterLogin,'sesudah login pun klik bilah kosong tidak memutar ulang audio');
/* Penanda kedaluwarsa (mis. tab lama yang ditinggal) → tidak berbunyi. */
sessionStorage.setItem('by-just-logged-in',String(Date.now()-5*60*1000));
auth={user:{token:'session4'},loading:false};await act(async()=>render());assert.equal(a.plays,afterLogin,'penanda login kedaluwarsa tidak membunyikan audio');
/* Autoplay diblokir saat login: retry gesture hanya berlaku dalam jendela login. */
blocked=true;sessionStorage.setItem('by-just-logged-in',String(Date.now()));
auth={user:{token:'session5'},loading:false};await act(async()=>render());await Promise.resolve();await Promise.resolve();
assert.equal(a.plays,afterLogin+1,'login baru mencoba putar walau diblokir browser');assert.equal(voice.getState().blocked,true);
const realNow=Date.now;Date.now=()=>realNow()+5*60*1000;
await act(async()=>{window.dispatchEvent(new window.Event('click'));window.dispatchEvent(new window.Event('pointerdown'));});
Date.now=realNow;await new Promise(setImmediate);
assert.equal(a.plays,afterLogin+1,'klik lama setelah jendela login tidak lagi membunyikan audio');
assert.equal(voice.getState().blocked,false);assert.equal(voice.isActive(),false);
blocked=false;
await act(async()=>voice.stop());console.log('PASS: sapaan Guri hanya saat baru selesai login; pemulihan sesi/refresh/klik bilah kosong senyap; retry gesture dibatasi jendela login; panel off/welcome/full, subtitle sinkron, logout/relogin, tanpa resurrect promise basi.');
}finally{if(root)await act(async()=>root.unmount());dom.window.close();rmSync(dir,{recursive:true,force:true});}
