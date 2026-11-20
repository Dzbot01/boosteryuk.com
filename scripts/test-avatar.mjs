import assert from 'node:assert/strict';
import { build } from 'esbuild';
const {outputFiles}=await build({entryPoints:['src/lib/avatar.ts'],format:'esm',bundle:true,write:false});
const {avatarSource,PREMIUM_AVATAR,REGULAR_AVATAR}=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
for(const user of [null,undefined,{}, {plusActive:false},{plan:{extra_active:false,plus:false}}]) assert.equal(avatarSource(user),REGULAR_AVATAR);
for(const user of [{plusActive:true},{plan:{plus:true}},{plan:{extra_active:true}},{plusActive:false,plan:{extra_active:true}}])assert.equal(avatarSource(user),PREMIUM_AVATAR);
console.log('PASS: normal / Plus / EXTRA / inactive tier avatar selection.');
