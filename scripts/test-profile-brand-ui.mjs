import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(path, 'utf8');
const footer = read('src/components/Footer.css');
assert.match(footer, /\.site-footer-logo \{[^}]*background: #fff;/);
assert.match(footer, /\.site-footer-body \{[^}]*background: var\(--footer-blue\)/);
for (const file of ['Header', 'SideMenu']) {
  const source = read(`src/components/${file}.tsx`);
  assert.match(source, /<span className="text-sky-400">\{settings.brandName\}<\/span>/);
  assert.doesNotMatch(source, /<span className="by-accent">\{settings.brandName\}/);
}
assert.match(read('src/components/Header.tsx'), /aria-label=\{`\$\{settings.brandName\}.*className="[^"\n]*lg:hidden/);
const profile = read('src/pages/ProfilPage.tsx');
assert.doesNotMatch(profile, /page-align-left/);
assert.match(profile, /mx-auto w-full max-w-2xl[^"\n]*lg:max-w-5xl/);
assert.match(profile, /h-\[420px\] w-full max-w-md sm:h-\[520px\] lg:h-\[600px\]/); // slot kartu Lanyard
assert.match(profile, /text-2xl lg:text-3xl/);
assert.match(profile, /p-4 lg:gap-4 lg:p-6/);
assert.match(profile, /<PengaturanAkunPage embedded \/>/);
assert.match(profile, /<OwnedTitles \/>/);
console.log('PASS footer white logo card, sky-blue header/sidebar brand, centered larger desktop profile; mobile sizing and profile features retained.');
