import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';
const { outputFiles } = await build({entryPoints:['src/lib/rootBranding.ts'],bundle:true,write:false,format:'cjs',platform:'node'});
const sandbox={exports:{},module:{exports:{}}};vm.runInNewContext(outputFiles[0].text,sandbox);
const {applyRootBranding,ROOT_LOGO,ROOT_FAVICON}=sandbox.module.exports;
const old={logoUrl:'tenant-logo.png',faviconUrl:'tenant-icon.png',brandName:'Panel'};
assert.equal(applyRootBranding(old,true),old);
assert.equal(applyRootBranding(old,false).logoUrl,ROOT_LOGO);
assert.equal(applyRootBranding(old,false).faviconUrl,ROOT_FAVICON);
assert.equal(old.logoUrl,'tenant-logo.png');
const html=fs.readFileSync('index.html','utf8');const script=html.match(/<script>\s*(if \(!window\.__CHILD_PANEL__[\s\S]*?)<\/script>/)[1];
for(const [hostname,injected,expected] of [['boosteryuk.com',null,true],['www.boosteryuk.com',null,true],['app.boosteryuk.com',null,true],['toko.boosteryuk.com',null,false],['custom-panel.id','toko',false],['boosteryuk.com','toko',false]]){
 const icons=[{href:'legacy.png'},{href:'legacy.ico'},{href:'apple.png'}];
 vm.runInNewContext(script,{window:{__CHILD_PANEL__:injected},location:{hostname},document:{getElementById:()=>icons[0],querySelector:s=>icons[s.includes('x-icon')?1:2]}});
 assert.equal(icons[0].href.includes('/branding/'),expected,hostname);
}
const context=fs.readFileSync('src/context/SiteSettingsContext.tsx','utf8');
assert.ok(context.indexOf('if (!IS_CHILD_PANEL) return applyRootBranding')<context.indexOf('if (!tenant) return settings'));
for(const file of [ROOT_LOGO,ROOT_FAVICON,'/branding/root-apple-zigzag.png','/branding/root-favicon-zigzag.ico'])assert.ok(fs.statSync('public'+file).size>0);
console.log('PASS root-only branding: persisted old root values overridden, child defaults/custom logos preserved, initial host guard, local icon assets.');
