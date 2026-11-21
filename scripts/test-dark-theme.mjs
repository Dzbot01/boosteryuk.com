import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const css=read('src/index.css');
assert.match(css,/\.dark body \{ background-color: #000000; color: #f5f5f5;/);
assert.match(css,/--background: #000000/);
assert.match(css,/--card: #121212/);
const neutralBlock=css.match(/\.dark \{\s+--color-slate-50:[\s\S]*?\n\}/)[0];
for(const [,hex] of neutralBlock.matchAll(/: #(\w{6})/g)) assert.ok(hex.slice(0,2)===hex.slice(2,4)&&hex.slice(2,4)===hex.slice(4),'neutral slate tokens have no blue tint');
assert.match(read('src/components/BottomNavbar.tsx'),/dark:bg-black\/95/);
assert.match(read('src/components/Layout.tsx'),/dark:bg-black/);
assert.match(read('src/context/ThemeContext.tsx'),/localStorage.setItem\('bt-theme', theme\)/);
const lum=hex=>{const channels=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
for(const bg of ['000000','121212','262626'])for(const fg of ['f5f5f5','d4d4d4','a3a3a3'])assert.ok((lum(fg)+.05)/(lum(bg)+.05)>=4.5,`${fg} on ${bg} must meet AA text contrast`);
for(const file of ['SettingsModal','FAQModal','RewardSheet']){
 const s=read(`src/components/${file}.tsx`);
 assert.match(s,/dark:bg-slate-900 dark:text-slate-100/,'shared modal panel inherits readable text');
 assert.doesNotMatch(s,/dark:text-slate-500/,'muted modal text must not be too dim');
}
// Intentional light buttons must retain dark text, not blanket white overrides.
assert.match(read('src/components/SettingsModal.tsx'),/dark:bg-slate-100 dark:text-slate-900/);
assert.match(read('src/components/AuthModal.tsx'),/bg-white[^"\n]*text-\[#1f1f1f\]/);
console.log('PASS: black dark theme, neutral scoped palette, AA foreground contrast, shared modal inheritance, preserved inverse/Google buttons and theme persistence.');
