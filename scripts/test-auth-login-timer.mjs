import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';import {build} from 'esbuild';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
const src=fs.readFileSync('src/components/AuthModal.tsx','utf8');
assert.match(src,/const RECOVERY_SECONDS = 120;/);assert.match(src,/countdown <= 0/);assert.match(src,/retryRef\.current\(\)/);assert.match(src,/disabled=\{loading \|\| countdown !== null\}/);
const dom=new JSDOM('<div id="root"></div>',{url:'https://boosteryuk.com'});let calls=0;
const {outputFiles}=await build({stdin:{contents:"export {default as Modal} from './src/components/AuthModal';export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',plugins:[{name:'mock',setup(b){b.onResolve({filter:/(services\/googleRedirect|services\/boostyVoice)$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.endsWith('boostyVoice')?'export const boostyVoice={prime(){}};':'export const startGoogleLogin=async()=>{globalThis.loginCalls=(globalThis.loginCalls||0)+1;throw new Error("Tidak dapat menghubungi server login pusat. Periksa koneksi lalu coba lagi.");};'}));}}]});
const ctx={process,performance,queueMicrotask,MessageChannel:class{port1={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())};},module:{exports:{}},exports:{},console,window:dom.window,document:dom.window.document,navigator:dom.window.navigator,setTimeout,clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,loginCalls:0};
vm.runInNewContext(outputFiles[0].text,ctx);const {Modal,createElement:h,act,createRoot}=ctx.module.exports;
const root=createRoot(dom.window.document.getElementById('root'));
try{
 await act(async()=>root.render(h(Modal,{open:true,onClose:()=>{}})));
 const btn=[...dom.window.document.querySelectorAll('button')].find(b=>/Masuk dengan Google/.test(b.getAttribute('aria-label')||''));assert.ok(btn);
 await act(async()=>btn.click());
 assert.equal(ctx.loginCalls,1);
 const alert=dom.window.document.querySelector('[role="alert"]');assert.match(alert.textContent,/Tidak dapat menghubungi server login pusat/);
 const status=dom.window.document.querySelector('[role="status"]');assert.match(status.textContent,/2:00|1:59/,'timer 2 menit tampil');
 const btn2=[...dom.window.document.querySelectorAll('button')].find(b=>/Tunggu/.test(b.textContent));assert.ok(btn2,'tombol menampilkan hitung mundur');assert.equal(btn2.disabled,true,'tombol dikunci selama timer');
}finally{await act(async()=>root.unmount());dom.window.close();}
console.log('PASS auth modal: pesan error asli server, timer 2 menit simulasi pemulihan, tombol terkunci + auto-retry terjadwal.');
