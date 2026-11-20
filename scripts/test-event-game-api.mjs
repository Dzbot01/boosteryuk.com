import assert from 'node:assert/strict';
import { build } from 'esbuild';
globalThis.window = { location: { hostname: 'boosteryuk.com', origin: 'https://boosteryuk.com' } };
const { outputFiles } = await build({entryPoints:['src/services/eventGameApi.ts'],bundle:true,format:'esm',write:false});
const { eventGameRequest } = await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
let calls=0;
function reply(text,status=200){globalThis.fetch=async(url,init)=>{
 calls++;assert.equal(url,'https://boosteryuk.com/api/event_game.php');assert.equal(init.method,'POST');assert.equal(init.headers.Accept,'application/json');assert.equal(JSON.parse(init.body).request_id,'same-id');assert.equal(init.cache,'no-store');
 return new Response(text,{status});
};}
const get={action:'get',token:'private-token',request_id:'same-id'};
const buy={...get,action:'buy'};
reply(JSON.stringify({ok:true,wallet:{bal:500},revision:2}));assert.equal((await eventGameRequest(get)).revision,2);
for(const [text,status,pattern] of [
 ['',200,/respons kosong/],['<!DOCTYPE html><html>SPA fallback</html>',200,/halaman HTML/],
 ['<html><script src="aes.js"></script>toNumbers("test")</html>',200,/proteksi hosting/],
 ['<!DOCTYPE html>Not found',404,/Upload event_game.php/],['{"ok":',502,/tidak valid atau terpotong/],
 ['null',200,/tidak valid/],['[]',200,/tidak valid/],['{"hello":true}',200,/tidak valid/],
 ['{"ok":false,"message":"Saldo tidak cukup"}',400,/Saldo tidak cukup/],
 ]){
 reply(text,status);await assert.rejects(eventGameRequest(get),pattern);
}
reply('<!DOCTYPE html>server failed',500);
await assert.rejects(eventGameRequest(buy),e=>/Jangan bayar ulang/.test(e.message)&&!e.message.includes('private-token'));
globalThis.fetch=async()=>{calls++;throw new Error('network failure with internal secrets')};
await assert.rejects(eventGameRequest(buy),/Jangan bayar ulang/);
reply(JSON.stringify({ok:false,code:'GAME_ENGINE_NOT_READY',payment_started:false,message:'Saldo tidak dipotong; users (MyISAM) belum InnoDB.'}),503);
await assert.rejects(eventGameRequest(buy),e=>/users \(MyISAM\)/.test(e.message)&&!e.message.includes('Jangan bayar ulang'));
reply(JSON.stringify({ok:false,code:'GAME_ENGINE_NOT_READY',message:'Engine error tanpa jaminan preflight'}),503);
await assert.rejects(eventGameRequest(buy),/Jangan bayar ulang/);
assert.equal(calls,14,'exactly one fetch per call, no automatic payment retry/fallback');
console.log('PASS: game API success, empty/HTML/challenge/404/truncated/invalid responses, API rejection, network errors, safe payment warning, no retries.');
