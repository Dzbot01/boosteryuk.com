import assert from 'node:assert/strict';
import { build } from 'esbuild';
globalThis.window = { location: { hostname: 'boosteryuk.com', origin: 'https://boosteryuk.com' } };
const { outputFiles } = await build({entryPoints:['src/services/eventGameApi.ts'],bundle:true,format:'esm',write:false});
const { eventGameRequest, GAME_CLOSED, GAME_API_MISMATCH } = await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
let calls=0;
function reply(text,status=200){globalThis.fetch=async(url,init)=>{
 calls++;assert.equal(url,'https://boosteryuk.com/api/event_game.php');assert.equal(init.method,'POST');assert.equal(init.headers.Accept,'application/json');assert.equal(JSON.parse(init.body).request_id,'same-id');assert.equal(init.cache,'no-store');
 return new Response(text,{status});
};}
const get={action:'get',token:'private-token',request_id:'same-id'};
const buy={...get,action:'buy'};
reply(JSON.stringify({ok:true,api_version:3,daily:{limit:5,remaining:4},wallet:{bal:500},revision:2}));assert.equal((await eventGameRequest(get)).revision,2);
for(const [text,status,pattern] of [
 ['',200,/Game sedang ditutup, silakan cobalagi nanti\./],['<!DOCTYPE html><html>SPA fallback</html>',200,/Game sedang ditutup, silakan cobalagi nanti\./],
 ['<html><script src="aes.js"></script>toNumbers("test")</html>',200,/Game sedang ditutup, silakan cobalagi nanti\./],
 ['<!DOCTYPE html>Not found',404,/Game sedang ditutup, silakan cobalagi nanti\./],['{"ok":',502,/Game sedang ditutup, silakan cobalagi nanti\./],
 ['null',200,/Game sedang ditutup, silakan cobalagi nanti\./],['[]',200,/Game sedang ditutup, silakan cobalagi nanti\./],['{"hello":true}',200,/Game sedang ditutup, silakan cobalagi nanti\./],
 ['{"ok":false,"message":"Saldo tidak cukup"}',400,/Saldo tidak cukup/],
 ]){
 reply(text,status);await assert.rejects(eventGameRequest(get),pattern);
}
reply('<!DOCTYPE html>server failed',500);
await assert.rejects(eventGameRequest(buy),e=>e.message===GAME_CLOSED);
globalThis.fetch=async()=>{calls++;throw new Error('network failure with internal secrets')};
await assert.rejects(eventGameRequest(buy),/Game sedang ditutup, silakan cobalagi nanti\./);
reply(JSON.stringify({ok:false,code:'GAME_ENGINE_NOT_READY',payment_started:false,message:'Saldo tidak dipotong; users (MyISAM) belum InnoDB.'}),503);
await assert.rejects(eventGameRequest(buy),e=>/users \(MyISAM\)/.test(e.message)&&!e.message.includes('Jangan bayar ulang'));
reply(JSON.stringify({ok:false,code:'GAME_ENGINE_NOT_READY',message:'Engine error tanpa jaminan preflight'}),503);
await assert.rejects(eventGameRequest(buy),/Game sedang ditutup, silakan cobalagi nanti\./);
reply(JSON.stringify({ok:true,wallet:{bal:500},revision:0}));
await assert.rejects(eventGameRequest(get),e=>e.message===GAME_API_MISMATCH);
reply(JSON.stringify({ok:false,message:'Aksi tidak valid.'}),400);
await assert.rejects(eventGameRequest({...get,action:'start'}),e=>e.message===GAME_API_MISMATCH);
reply(JSON.stringify({ok:false,api_version:3,code:'GAME_API_VERSION_MISMATCH'}),409);
await assert.rejects(eventGameRequest(get),e=>e.message===GAME_API_MISMATCH);
reply(JSON.stringify({ok:true,api_version:3,daily:{limit:5,remaining:5},state:{run_id:'same-id'}}));
assert.equal((await eventGameRequest({...get,action:'start'})).state.run_id,'same-id');
reply(JSON.stringify({ok:true,api_version:3}));
await assert.rejects(eventGameRequest(get),e=>e.message===GAME_API_MISMATCH);
reply(JSON.stringify({ok:true,api_version:2,daily:{limit:5,remaining:5}}));
await assert.rejects(eventGameRequest(get),e=>e.message===GAME_API_MISMATCH);
assert.equal(calls,20,'exactly one fetch per call, no automatic payment retry/fallback');
console.log('PASS: game API success, empty/HTML/challenge/404/truncated/invalid responses, API rejection, network errors, exact closure message, no retries.');
