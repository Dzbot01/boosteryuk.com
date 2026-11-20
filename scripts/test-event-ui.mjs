// Test-only jsdom can be supplied without changing package.json:
// npm install --prefix /tmp/event-ui-check jsdom
// NODE_PATH=/tmp/event-ui-check/node_modules node scripts/test-event-ui.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://boosteryuk.com'});
globalThis.MessageChannel=class {port1={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())};};
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let reduced=false;window.matchMedia=()=>({matches:reduced});
const dir=mkdtempSync(path.join(tmpdir(),'event-ui-'));
try{
 const {outputFiles}=await build({stdin:{contents:"export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {default as Button} from './src/components/TransactionButton';export {default as Poster} from './src/components/EventPoster';export {MusicProvider,useMusic} from './src/context/MusicContext';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,loader:{'.css':'empty'},jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','__MUSIC_URL__':'"/music.test.mp3"'}});
 const file=path.join(dir,'bundle.cjs');writeFileSync(file,outputFiles[0].text);const {createElement:h,act,createRoot,Button,Poster,MusicProvider,useMusic}=require(file);
 let calls=0;const root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(h(Button,{onClick:()=>calls++},'Pesan')));
 const button=document.querySelector('button');
 await act(async()=>{button.click();button.click();});
 assert.equal(calls,0,'handler must not run before animation');assert.equal(button.getAttribute('aria-busy'),'true');
 await act(async()=>{await new Promise(r=>setTimeout(r,1400));});assert.equal(calls,1,'rapid clicks invoke handler only once');
 await act(async()=>button.click());await act(async()=>root.render(h(Button,{disabled:true,onClick:()=>calls++},'Pesan')));
 await act(async()=>{await new Promise(r=>setTimeout(r,1400));});assert.equal(calls,1,'disable during animation cancels operation');
 await act(async()=>root.render(h(Button,{onClick:()=>calls++},'Pesan')));await act(async()=>document.querySelector('button').click());
 await act(async()=>root.render(h('p',null,'Unmounted')));await act(async()=>{await new Promise(r=>setTimeout(r,1400));});assert.equal(calls,1,'unmounted button must not order');
 reduced=true;await act(async()=>root.render(h(Button,{onClick:()=>calls++},'Pesan')));await act(async()=>{document.querySelector('button').click();await new Promise(r=>setTimeout(r,10));});assert.equal(calls,2);
 let submits=0;await act(async()=>root.render(h('form',{onSubmit:e=>{e.preventDefault();submits++;}},h(Button,{type:'submit'},'Bayar'))));await act(async()=>{document.querySelector('button').click();await new Promise(r=>setTimeout(r,10));});assert.equal(submits,1,'native form submits once after animation');
 await act(async()=>root.render(h(Poster,{title:'Rahasia belum diumumkan',status:'upcoming',index:2,onOpen:()=>calls++})));
 assert.equal(document.querySelector('.aesthetic-switch').textContent,'Akan hadir');assert.equal(document.querySelector('.poster-card').disabled,true);assert.ok(!document.body.textContent.includes('Rahasia'));
 await act(async()=>root.render(h(Poster,{title:'Hitung mundur tahun baru',status:'ongoing',index:1,onOpen:()=>calls++})));
 assert.equal(document.querySelector('.aesthetic-switch').textContent,'Berlangsung');await act(async()=>document.querySelector('.poster-card').click());assert.equal(calls,3);
 let music;const audios=[];let rejectPlay=false;
 globalThis.Audio=class extends dom.window.EventTarget{
  paused=true;src='';plays=0;pauses=0;
  constructor(src){super();this.src=src;audios.push(this);}
  play(){this.plays++;if(rejectPlay)return Promise.reject(new Error('Autoplay blocked'));this.paused=false;this.dispatchEvent(new dom.window.Event('play'));return Promise.resolve();}
  pause(){this.pauses++;this.paused=true;this.dispatchEvent(new dom.window.Event('pause'));}
 };
 function MusicProbe(){music=useMusic();return null;}
 await act(async()=>root.render(h(MusicProvider,null,h(MusicProbe))));
 assert.equal(audios.length,1);assert.equal(audios[0].loop,true);
 await act(async()=>{music.play();music.play();});assert.equal(audios.length,1);assert.equal(music.playing,true);assert.equal(audios[0].pauses,0,'idempotent start must not toggle music off');
 await act(async()=>music.toggle());assert.equal(music.playing,false);
 rejectPlay=true;await act(async()=>music.play());assert.equal(music.blocked,true);
 rejectPlay=false;await act(async()=>music.toggle());assert.equal(music.playing,true);assert.equal(music.blocked,false);
 await act(async()=>root.unmount());
 assert.ok(audios[0].pauses>=2,'provider cleanup pauses audio');
 console.log('PASS: delayed single order, disable/unmount cancellation, reduced motion, native form submit, poster status/coming-soon redaction/open, shared loop music with blocked-autoplay recovery.');
}finally{dom.window.close();rmSync(dir,{recursive:true,force:true});}
