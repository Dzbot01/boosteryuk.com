import assert from 'node:assert/strict';import fs from 'node:fs';
const pg=fs.readFileSync('src/pages/PlaygroundPage.tsx','utf8');
assert.match(pg,/import EditorStudio from '\.\.\/components\/EditorStudio'/);
assert.match(pg,/id: 'studio', label: 'Editor Studio'/,'menu Editor Studio ada di Playground');
assert.match(pg,/\['overview', 'hook', 'caption', 'tts', 'studio'\]/);
assert.match(pg,/menu === 'studio' && <EditorStudio \/>/);
const s=fs.readFileSync('src/components/EditorStudio.tsx','utf8');
// sidebar kanan + upload box
assert.match(s,/lg:w-\[290px\]/,'sidebar kanan desktop');
assert.match(s,/accept="image\/\*,video\/\*"/,'upload image atau video');
assert.match(s,/Upload image atau video/);
// preview tengah besar
assert.match(s,/max-h-\[52vh\] w-full object-contain/,'preview besar di tengah');
// sidebar berubah jadi menu setelah upload
assert.match(s,/\{!hasMedia \? \(/,'sidebar upload -> menu');
assert.match(s,/Tambahkan Teks/);assert.match(s,/\{exporting \? 'Mengekspor…' : 'Ekspor'\}/,'tombol Ekspor di sidebar menu');
// timeline: cut, suara, tandai, plus
assert.match(s,/aria-label="Atur awal cut"/);assert.match(s,/aria-label="Atur akhir cut"/);
assert.match(s,/Suara video:/);assert.match(s,/Tandai\n\s*<\/button>/,'tombol Tandai (marker)');
assert.match(s,/aria-label="Tambah media atau overlay"/);assert.match(s,/Tambah Overlay/);
// modal ikon kecil tambah musik di atas timeline
const iMusic=s.indexOf('Tambah Musik');const iTimeline=s.indexOf('Timeline');
assert.ok(iMusic>-1&&iTimeline>-1&&iMusic<iTimeline,'toolbar tambah musik berada di atas timeline');
assert.match(s,/accept="audio\/\*"/);
// ekspor
assert.match(s,/MediaRecorder/);assert.match(s,/canvas\.captureStream\(30\)/);assert.match(s,/boosteryuk-studio\.webm/);assert.match(s,/boosteryuk-studio\.png/);
console.log('PASS Editor Studio: menu playground, sidebar kanan upload->menu, preview tengah, timeline cut/suara/tandai/plus, modal tambah musik, ekspor webm/png.');
