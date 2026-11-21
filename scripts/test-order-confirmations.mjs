import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);const {JSDOM}=require('jsdom');
const dom=new JSDOM('<div id="root"></div>',{url:'https://boosteryuk.com/buat-pesanan?service=1'});
globalThis.DOMParser=dom.window.DOMParser;globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.MessageChannel=class{port1={onmessage:null};port2={postMessage:()=>setImmediate(()=>this.port1.onmessage?.())};};
const dir=mkdtempSync(path.join(tmpdir(),'confirm-order-'));let root;
try{
const {outputFiles}=await build({stdin:{contents:"export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {MemoryRouter} from 'react-router-dom';export {default as Card} from './src/components/BuatPesananCard';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',plugins:[{name:'mocks',setup(b){
 b.onResolve({filter:/(AuthContext|OrderHistoryContext|servicesApi|checkoutApi|AiAssistantCard|LinkPreview|TransactionButton)$/},a=>({path:a.path.split('/').pop(),namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({resolveDir:process.cwd(),contents:({
 AuthContext:'export const useAuth=()=>({user:{balance:10000},topUp:()=>{}});',
 OrderHistoryContext:'export const useOrderHistory=()=>({addOrder:()=>{}});',
 servicesApi:"export const fetchServices=async()=>({ok:true,services:[{id:'1',name:'Test service',category:'Test',rate:1000,min:1,max:10000,description:'Read this first'}]});export const applyMarkup=r=>r;export const formatRate=r=>String(r);export const isCustomCommentService=()=>false;",
 checkoutApi:"export const placeOrder=async()=>{globalThis.orders++;return {ok:true,orderId:'TEST'};};",
 AiAssistantCard:'export default ()=>null;',LinkPreview:'export default ()=>null;',
 TransactionButton:"import {createElement} from 'react';export default p=>createElement('button',p,p.children);"
 })[a.path]}));
}}]});
writeFileSync(path.join(dir,'test.cjs'),outputFiles[0].text);const {createElement:h,act,createRoot,MemoryRouter,Card}=require(path.join(dir,'test.cjs'));
globalThis.orders=0;root=createRoot(document.getElementById('root'));await act(async()=>root.render(h(MemoryRouter,{initialEntries:['/buat-pesanan?service=1']},h(Card))));
const boxes=()=>[...document.querySelectorAll('input[type="checkbox"]')];
assert.equal(boxes().length,2);assert.ok(document.body.textContent.includes('Sudah membaca deskripsi layanan'));assert.ok(document.body.textContent.includes('Target yang di masukan sudah benar.'));assert.ok(!document.body.textContent.includes('Tampilkan layanan favorit saja'));
const button=()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Pesan');
async function input(el,value){await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}));});}
await input(document.querySelector('input[placeholder="https://instagram.com/username"]'),'target1');await input(document.querySelector('input[type="number"]'),'100');assert.equal(button().disabled,true);
await act(async()=>boxes()[0].click());assert.equal(button().disabled,true);
await act(async()=>boxes()[1].click());assert.equal(button().disabled,false);
await input(document.querySelector('input[placeholder="https://instagram.com/username"]'),'target2');assert.equal(boxes()[1].checked,false);assert.equal(button().disabled,true);
await act(async()=>boxes()[1].click());await act(async()=>button().click());assert.equal(globalThis.orders,1);assert.ok(boxes().every(b=>!b.checked));assert.equal(button().disabled,true);
const src=readFileSync('src/components/BuatPesananCard.tsx','utf8');assert.match(src,/if \(ordering[^\n]*!descriptionRead \|\| !targetConfirmed\) return/);
console.log('PASS: two confirmations gate checkout, target edits invalidate confirmation, successful order resets confirmations; old favorite checkbox removed.');
}finally{if(root)await require(path.join(dir,'test.cjs')).act(async()=>root.unmount());dom.window.close();rmSync(dir,{recursive:true,force:true});}
