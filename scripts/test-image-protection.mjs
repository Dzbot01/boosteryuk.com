import assert from 'node:assert/strict';import fs from 'node:fs';
const css=fs.readFileSync('src/index.css','utf8');
const block=css.slice(css.indexOf('Proteksi asset gambar'));
assert.match(block,/-webkit-user-drag: none/);assert.match(block,/user-select: none/);assert.match(block,/-webkit-touch-callout: none/);
const layout=fs.readFileSync('src/components/Layout.tsx','utf8');
assert.match(layout,/const onDragStart = \(e: DragEvent\)/);assert.match(layout,/const onContextMenu = \(e: MouseEvent\)/);assert.match(layout,/document\.addEventListener\('dragstart', onDragStart\)/);assert.match(layout,/document\.addEventListener\('contextmenu', onContextMenu\)/);
console.log('PASS image protection: CSS anti-drag/anti-select + blokir dragstart & contextmenu global pada semua <img>.');
