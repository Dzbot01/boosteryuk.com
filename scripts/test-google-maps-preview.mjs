import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';import {build} from 'esbuild';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');const parser=new (require('php-parser'))({parser:{php7:true}});parser.parseCode(fs.readFileSync('php-api/maps_preview.php','utf8'));
const dom=new JSDOM('<div id="root"></div>',{url:'https://boosteryuk.com'});const requests=[];
const {outputFiles}=await build({stdin:{contents:"export * from './src/lib/googleMapsPreview';export {default as Preview,parseTargetUrl} from './src/components/LinkPreview';export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic'});
const ctx={process,performance,queueMicrotask,MessageChannel:class{port1={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())};},module:{exports:{}},exports:{},console,window:dom.window,document:dom.window.document,navigator:dom.window.navigator,URL,AbortController,DOMException,setTimeout,clearTimeout,IS_REACT_ACT_ENVIRONMENT:true,fetch:async(url,opts)=>{requests.push(url);assert.ok(url.endsWith('/maps_preview.php'));assert.equal(JSON.parse(opts.body).url,'https://maps.app.goo.gl/test');return new Response(JSON.stringify({ok:true,url:'https://www.google.com/maps?q=Monas+Jakarta'}));}};
vm.runInNewContext(outputFiles[0].text,ctx);const {googleMapsKind:kind,googleMapsPreview:map,Preview,parseTargetUrl,createElement:h,act,createRoot}=ctx.module.exports;
for(const url of ['https://www.google.com/maps/place/Depok','https://maps.google.com/?q=Depok','https://google.co.id/maps?q=Depok'])assert.equal(kind(new URL(url)),'map');
for(const url of ['https://maps.app.goo.gl/abc','https://goo.gl/maps/abc'])assert.equal(kind(new URL(url)),'short');
for(const url of ['https://maps.app.goo.gl.evil.com/abc','https://evil.com/maps','https://www.google.com/search?q=maps','https://google.com.evil.id/maps','https://evil@maps.app.goo.gl/abc','https://maps.app.goo.gl:8443/abc','javascript:alert(1)'])assert.equal(kind(new URL(url)),null,url);
for(const url of ['https://www.google.com/maps?q=Monas+Jakarta','https://www.google.com/maps/search/?api=1&query=Monas+Jakarta','https://www.google.com/maps/place/Monas+Jakarta']){const m=map(new URL(url));assert.equal(new URL(m.embedUrl).searchParams.get('q'),'Monas Jakarta');}
assert.equal(new URL(map(new URL('https://www.google.com/maps/place/Test/@-6,106,12z/data=!3d-6.1754!4d106.8272')).embedUrl).searchParams.get('q'),'-6.1754,106.8272');
assert.equal(new URL(map(new URL('https://maps.google.com/?cid=12345')).embedUrl).searchParams.get('cid'),'12345');
assert.equal(map(new URL('https://maps.app.goo.gl/abc')).embedUrl,null);assert.equal(map(new URL('https://www.google.com/maps')).embedUrl,null);
assert.equal(new URL(map(new URL('https://google.com/maps/embed?pb=test')).embedUrl).origin,'https://www.google.com');assert.equal(parseTargetUrl('username'),null);
const root=createRoot(dom.window.document.getElementById('root'));
try{
 await act(async()=>root.render(h(Preview,{target:'https://www.google.com/maps?q=Depok'})));assert.ok(dom.window.document.querySelector('iframe'));assert.equal(requests.length,0,'direct Maps must bypass public metadata proxies');assert.equal(dom.window.document.querySelector('iframe').title,'Peta Depok');
 await act(async()=>root.render(h(Preview,{target:'username'})));assert.equal(dom.window.document.querySelector('iframe'),null);
 await act(async()=>root.render(h(Preview,{target:'https://maps.app.goo.gl/test'})));assert.equal(dom.window.document.querySelector('iframe'),null);assert.ok(dom.window.document.querySelector('a[href="https://maps.app.goo.gl/test"]'));
 await act(async()=>new Promise(r=>setTimeout(r,850)));assert.equal(requests.length,1);assert.equal(dom.window.document.querySelector('iframe').title,'Peta Monas Jakarta');
 await act(async()=>root.render(h(Preview,{target:'https://www.google.com/maps?q=Bogor'})));assert.equal(dom.window.document.querySelector('iframe').title,'Peta Bogor','old target not retained');
}finally{await act(async()=>root.unmount());dom.window.close();}
const php=fs.readFileSync('php-api/maps_preview.php','utf8');assert.match(php,/CURLOPT_FOLLOWLOCATION=>false/);assert.match(php,/CURLOPT_SSL_VERIFYPEER=>true/);assert.match(php,/mp_kind\(\$location\)/);assert.match(php,/CURLOPT_NOBODY=>true/);
console.log('PASS PHP parse; strict Maps host detection; query/place/coordinates/cid/embed parsing; no generic metadata calls; shortlink resolution mock/fallback; target switching; resolver redirect/TLS safety contracts. No live Google requests.');
