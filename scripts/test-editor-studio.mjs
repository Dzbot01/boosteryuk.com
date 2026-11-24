import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

/* 1. Playground tetap punya menu Editor Studio */
const pg = read('src/pages/PlaygroundPage.tsx');
assert.match(pg, /import EditorStudio from '\.\.\/components\/EditorStudio'/);
assert.match(pg, /id: 'studio', label: 'Editor Studio'/, 'menu Editor Studio ada di Playground');
assert.match(pg, /\['overview', 'hook', 'caption', 'tts', 'studio'\]/);
assert.match(pg, /menu === 'studio' && <EditorStudio \/>/);

const shell = read('src/components/EditorStudio.tsx');
assert.match(shell, /import Studio from '\.\/editor\/Studio'/, 'EditorStudio merender Studio baru');
assert.match(shell, /<Studio \/>/);

/* 2. Struktur file komponen */
for (const f of [
  'types.ts', 'mockData.ts', 'store.ts', 'ui.tsx', 'TopBar.tsx', 'MediaPanel.tsx', 'Player.tsx',
  'Inspector.tsx', 'InspectorVideo.tsx', 'InspectorAudio.tsx', 'InspectorSpeed.tsx',
  'InspectorAnimate.tsx', 'InspectorAdjust.tsx', 'Timeline.tsx', 'TimelineToolbar.tsx',
  'TimelineRuler.tsx', 'TimelineTrack.tsx', 'TimelineClip.tsx', 'Playhead.tsx',
  'ExportModal.tsx', 'ShortcutModal.tsx', 'exporter.ts', 'Studio.tsx',
]) {
  assert.ok(fs.existsSync(`src/components/editor/${f}`), `file editor/${f} ada`);
}

/* 3. Token desain (warna + radius + scrollbar) */
const ui = read('src/components/editor/ui.tsx');
for (const hex of ['#0f0f11', '#1a1a1d', '#232327', '#2b2b30', '#e8e8ea', '#8a8a92', '#55555c', '#00d1e0', '#3a3a40']) {
  assert.ok(ui.includes(hex), `token warna ${hex} ada di ui.tsx`);
}
const css = read('src/index.css');
assert.match(css, /\.ed-scroll/, 'scrollbar tipis editor');
assert.match(css, /scrollbar-color: #3a3a40 transparent/);
assert.match(css, /\.ed-slider::-webkit-slider-thumb/);
assert.match(css, /width: 12px;\s*height: 12px;\s*border-radius: 50%;\s*background: #ffffff/, 'thumb slider 12px putih');

/* 4. TopBar */
const top = read('src/components/editor/TopBar.tsx');
assert.match(top, /h-11/, 'TopBar tinggi 44px');
for (const item of ['New project', 'Open project', 'Save', 'Save as', 'Export', 'Settings', 'Shortcuts']) {
  assert.ok(top.includes(`'${item}'`), `item menu ${item}`);
}
assert.match(top, /Auto save local at \{autosave\}/, 'status auto-save');
assert.match(top, /setInterval\(stampAutosave, 60_000\)/, 'auto-save tiap menit');
assert.match(top, /value=\{title\}/, 'judul proyek inline editable');
assert.ok(top.includes("title: 'This is a title'") === false, 'default judul di store');
assert.match(top, /<Keyboard className/, 'tombol Shortcut');
assert.match(top, /> Export/, 'tombol Export accent');
assert.match(top, /Minimize/); assert.match(top, /Maximize/); assert.match(top, /Close/);

const store = read('src/components/editor/store.ts');
assert.match(store, /title: 'This is a title'/, 'judul default');

/* 5. Panel kiri: 7 tab + isi tiap tab */
const media = read('src/components/editor/MediaPanel.tsx');
for (const t of ['Media', 'Audio', 'Text', 'Stickers', 'Effects', 'Transition', 'Filters']) {
  assert.ok(media.includes(`id: '${t}'`), `tab kiri ${t}`);
}
assert.match(media, /w-\[90px\]/, 'sidebar kecil 90px');
assert.ok(media.includes('Local') && media.includes('Import') && media.includes('Library'), 'sidebar Local/Import/Library');
assert.match(media, /ListFilter|Filter media/, 'filter dropdown');
assert.match(media, /label="List view"/); assert.match(media, /label="Grid view"/);
assert.match(media, /aspect-\[16\/10\]/, 'thumbnail 16:10');
assert.match(media, /rounded-\[999px\][\s\S]{0,180}tcShort\(asset\.duration\)/, 'badge durasi pill');
assert.match(media, /Add to timeline/); assert.match(media, /Rename/); assert.match(media, /Delete/, 'context menu klik kanan');
assert.ok(media.includes('Morning Drive') === false, 'data mock audio di mockData');
for (const cat of ['Music', 'Sound effects', 'Voiceover', 'Extracted']) {
  assert.ok(read('src/components/editor/mockData.ts').includes(cat), `kategori audio ${cat}`);
}
const md = read('src/components/editor/mockData.ts');
for (const n of ['Default text', 'Bold title', 'Neon', 'Outline', 'Gradient', 'Subtitle']) assert.ok(md.includes(n), `style teks ${n}`);
for (const c of ['Trending', 'Basic', 'Retro', 'Glitch', 'Blur', 'Light']) assert.ok(md.includes(c), `kategori effect ${c}`);
for (const c of ['Featured', 'Life', 'Cinematic', 'Film', 'Black & White']) assert.ok(md.includes(c), `kategori filter ${c}`);
for (const n of ['90s', 'Vivid', 'Noir']) assert.ok(md.includes(n), `nama filter ${n}`);
assert.ok(!md.includes('CRST001334.mov') && !md.includes('Morning Drive'), 'tidak ada media/audio mock tersimpan');
assert.match(store, /assets: EMPTY_ASSETS/, 'default proyek: tanpa asset');
assert.match(store, /clips: EMPTY_CLIPS/, 'default proyek: tanpa clip');
assert.match(store, /previewAssetId: ''/, 'default: tanpa preview media');
assert.match(store, /previewAssetId: added\[0\]\.id/, 'import → preview Player otomatis menyesuaikan');
assert.match(store, /pending: asset\.kind !== 'image'/, 'clip menunggu durasi metadata');
assert.match(md, /makeThumb/, 'thumbnail digenerate canvas');

/* 6. Player */
const player = read('src/components/editor/Player.tsx');
assert.match(player, />Player</, 'label header Player');
assert.match(player, /data-player-stage/, 'panggung preview untuk export');
assert.match(player, /rounded-\[4px\] bg-black/, 'area preview gelap radius 4px');
assert.match(player, /\{tc\(playhead\)\}/, 'waktu berjalan accent');
assert.match(player, /\{tc\(end\)\}/, 'total durasi');
assert.match(player, /#22c55e[\s\S]*#eab308[\s\S]*#f97316[\s\S]*#ef4444/, 'meter level audio berwarna');
assert.match(player, /playing \? <Pause/, 'ikon pause saat playing');
for (const r of ['Original', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9']) assert.ok(player.includes(r), `rasio ${r}`);
assert.match(player, /underline underline-offset-2/, 'teks rasio bergaris bawah');
assert.match(player, /Fit to screen/); assert.match(player, /Fullscreen/);
assert.match(player, /hoverT/, 'tooltip waktu di scrub bar');

/* 7. Inspector */
const insp = read('src/components/editor/Inspector.tsx');
for (const t of ['Video', 'Audio', 'Speed', 'Animate', 'Adjust']) assert.ok(insp.includes(`'${t}'`), `tab kanan ${t}`);
assert.match(insp, /overflow-x-auto/, 'tab kanan dapat di-scroll horizontal');
const iv = read('src/components/editor/InspectorVideo.tsx');
for (const seg of ['Basic', 'Cutout', 'Mask', 'Canvas']) assert.ok(iv.includes(seg), `segmen ${seg}`);
assert.match(iv, /rounded-\[999px\]/, 'segmented control pill');
for (const sec of ['Filters', 'Effects', 'Position & Size', 'Blend', 'Stabilize', 'Opacity']) assert.ok(iv.includes(sec), `seksi ${sec}`);
assert.match(iv, /Strength/, 'slider strength filter');
assert.match(iv, /effects\.map/, 'daftar effect dari store');
assert.match(store, /name: 'Motion Blur'/, 'effect mock Motion Blur');
assert.match(iv, /Trash2/, 'ikon hapus effect');
assert.match(iv, /Zoom/, 'slider zoom');
assert.match(iv, /Position X/); assert.match(iv, /Position Y/);
assert.match(iv, /Scale uniformly/);
assert.match(iv, /collapsed\['Position & Size'\]/, 'seksi collapsible');
const ispd = read('src/components/editor/InspectorSpeed.tsx');
assert.ok(ispd.includes('Standard') && ispd.includes('Curve'), 'speed standard/curve');
assert.match(ispd, /min=\{0\.1\} max=\{100\}/, 'rentang kecepatan 0.1x-100x');
assert.match(ispd, /Duration/, 'input durasi');
const iadj = read('src/components/editor/InspectorAdjust.tsx');
for (const k of ['Brightness', 'Contrast', 'Saturation', 'Sharpness', 'Highlight', 'Shadow', 'Temperature', 'Tint']) {
  assert.ok(iadj.includes(k), `slider adjust ${k}`);
}
const iaud = read('src/components/editor/InspectorAudio.tsx');
for (const k of ['Volume', 'Fade in', 'Fade out', 'Noise reduction', 'Voice changer']) assert.ok(iaud.includes(k), `kontrol audio ${k}`);
const iani = read('src/components/editor/InspectorAnimate.tsx');
for (const k of ['In', 'Out', 'Combo']) assert.ok(iani.includes(`'${k}'`), `mode animate ${k}`);

/* 8. Timeline */
const tl = read('src/components/editor/Timeline.tsx');
assert.match(tl, /<TimelineToolbar \/>/); assert.match(tl, /<TimelineRuler/); assert.match(tl, /<Playhead/); assert.match(tl, /<TimelineTrack/); assert.match(tl, /TrackGutter/, 'gutter track');
const tb = read('src/components/editor/TimelineToolbar.tsx');
assert.match(tb, /h-10/, 'toolbar timeline 40px');
for (const l of ['Undo', 'Redo', 'Split', 'Delete']) assert.ok(tb.includes(l), `tool ${l}`);
assert.match(tb, /Magnet/, 'toggle snapping');
assert.match(tb, /ZoomIn/); assert.match(tb, /ZoomOut/);
assert.match(tb, /aria-label="Zoom timeline"/, 'slider zoom accent');
assert.match(tb, /Mic/, 'ikon record');
const ruler = read('src/components/editor/TimelineRuler.tsx');
assert.match(ruler, /tcShort\(t\)/, 'label waktu ruler');
assert.match(ruler, /h-6/, 'tinggi ruler');
const ph = read('src/components/editor/Playhead.tsx');
assert.match(ph, /background: '#ffffff'/, 'garis playhead putih');
assert.match(ph, /M0 0h14v9L7 16 0 9z/, 'handle pentagon');
assert.match(ph, /cursor-ew-resize/, 'playhead draggable');
assert.match(ph, /snapping/, 'snap ke tepi clip');
const tr = read('src/components/editor/TimelineTrack.tsx');
assert.match(tl, /w-\[60px\]/, 'gutter 60px di Timeline');
assert.match(tr, /height: 64/, 'track video 64px');
assert.match(tr, /height: 40/, 'track audio 40px');
assert.match(tr, /index % 2/, 'baris kosong berselang-seling');
const clip = read('src/components/editor/TimelineClip.tsx');
assert.match(clip, /#1b3a63/, 'clip audio biru gelap');
assert.match(clip, /1d6f7a/, 'clip video teal');
assert.match(clip, /rounded-\[6px\]/, 'clip rounded');
assert.match(clip, /boxShadow: on \? `0 0 0 2px \$\{C\.text\}`/, 'border 2px clip terpilih');
assert.match(clip, /cursor-ew-resize/, 'trim handle');
assert.match(clip, /rgba\(255,255,255,\.9\)/, 'handle trim putih');
assert.match(clip, /clip\.thumb/, 'filmstrip thumbnail');
assert.match(clip, /#7fb3ff/, 'waveform biru muda');
assert.match(clip, /clip\.chips/, 'chip tag clip');
assert.match(clip, /pushHistory\(\)/, 'drag clip tercatat untuk undo');

/* 9. Interaksi mock + shortcut */
assert.match(store, /setLeftTab/, 'ganti tab kiri');
assert.match(store, /historyStack/, 'undo/redo');
assert.match(read('src/components/editor/Studio.tsx'), /e\.code === 'Space'/, 'shortcut Space');
assert.match(read('src/components/editor/Studio.tsx'), /'z'/, 'Ctrl+Z');
assert.match(read('src/components/editor/Studio.tsx'), /'y'/, 'Ctrl+Y');
assert.match(read('src/components/editor/Studio.tsx'), /e\.key\.toLowerCase\(\) === 's'/, 'shortcut S split');
assert.match(read('src/components/editor/Studio.tsx'), /'Delete'/, 'shortcut Delete');
assert.match(read('src/components/editor/Studio.tsx'), /startDrag/, 'divider resizable');
assert.match(read('src/components/editor/Studio.tsx'), /max-width: 1023px/, 'mode responsif bottom sheet');
assert.match(read('src/components/editor/Studio.tsx'), /SHEET_ITEMS/, 'toolbar bawah sheet');

/* 10. Modal export & shortcut */
const ex = read('src/components/editor/ExportModal.tsx');
for (const r of ['480p', '720p', '1080p', '2K', '4K']) assert.ok(ex.includes(`'${r}'`), `resolusi ${r}`);
for (const f of [24, 30, 60]) assert.ok(ex.includes(String(f)), `frame rate ${f}`);
assert.ok(ex.includes('MP4') && ex.includes('MOV'), 'format MP4/MOV');
assert.match(ex, /BITRATES/, 'pilihan bitrate');
assert.match(ex, /Filename/, 'input nama file');
assert.match(ex, /\{busy \? 'Exporting…' : 'Export'\}/, 'tombol Export/Cancel');
assert.match(ex, /Cancel/);
const sc = read('src/components/editor/ShortcutModal.tsx');
assert.match(sc, /SHORTCUTS/, 'daftar shortcut dari mockData');
assert.match(md, /Space[\s\S]*Ctrl \+ Z[\s\S]*Ctrl \+ Y/, 'isi daftar shortcut');

/* 11. Perilaku baru: kosong default, loop, drag 1:1, pan, fullscreen */
const studio = read('src/components/editor/Studio.tsx');
assert.match(player, /next >= end \? 0 : next/, 'durasi habis → playhead balik ke awal (loop)');
assert.match(player, /projectEnd\(s\.clips\) \|\| pv\?\.duration/, 'clock berhenti di ujung media, bukan ruler kosong');
assert.match(player, /p-1\.5 sm:p-2/, 'preview Player diperbesar (padding kecil)');
assert.match(studio, /viewportH \* 0\.34/, 'timeline default lebih tipis → player lebih besar');
assert.match(ruler, /startT \+ \(ev\.clientX - startX\) \/ zoom/, 'scrub ruler mengikuti gerakan seret 1:1');
assert.ok(!/onClick=/.test(ruler), 'ruler tidak lompat saat diklik (harus seret manual)');
assert.match(ph, /startT \+ \(ev\.clientX - startX\) \/ zoom/, 'drag playhead mengikuti gerakan seret 1:1');
assert.match(tr, /host\.scrollLeft = startScroll - \(ev\.clientX - startX\)/, 'geser/pan area timeline dengan seret di lane kosong');
assert.match(tr, /cursor-grab/, 'lane kosong bisa digeser');
assert.match(tr, /e\.pointerType === 'touch'/, 'pan mouse di lane kosong; touch memakai scroll native');
assert.match(clip, /touchAction: 'none'/, 'clip touch-drag tidak memicu scroll');
assert.match(media, /assets\.filter\(\(a\) => a\.kind === 'audio'\)/, 'tab Audio hanya menampilkan audio import user');
assert.match(media, /Belum ada audio tersimpan/, 'tab Audio default kosong');
assert.match(media, /tidak terlihat oleh user lain/, 'keterangan privasi: media lokal per perangkat');
const pgs = read('src/pages/PlaygroundPage.tsx');
assert.match(pgs, /m\.id === 'studio' && document\.documentElement\.requestFullscreen/, 'klik menu studio → fullscreen');
assert.match(studio, /el\.requestFullscreen\(\)\.catch/, 'studio mencoba fullscreen saat mount');
assert.match(pgs, /menu !== 'studio' && document\.fullscreenElement/, 'fullscreen dilepas saat keluar studio');

/* 12. Export nyata tetap berjalan (canvas + MediaRecorder) */
const exp = read('src/components/editor/exporter.ts');
assert.match(exp, /drawFrame/, 'gambar frame ke canvas');
assert.match(exp, /canvas\.toBlob\(res, 'image\/png'\)|toBlob\(res, 'image\/png'\)/, 'ekspor PNG');
assert.match(exp, /captureStream\(settings\.fps\)/, 'captureStream untuk video');
assert.match(exp, /video\/webm;codecs=vp9,opus/, 'MediaRecorder VP9/Opus');
assert.match(exp, /MediaStreamDestination|createMediaStreamDestination/, 'mix audio musik');
assert.match(exp, /createMediaElementSource/, 'sumber audio video');
assert.match(read('src/components/editor/store.ts'), /URL\.createObjectURL/, 'media lokal via object URL');

console.log('PASS Editor Studio (CapCut-style): TopBar 44px + menu/auto-save/judul/Export, panel kiri 7 tab (Media/Audio/Text/Stickers/Effects/Transition/Filters), Player + scrub bar + rasio, Inspector 5 tab, Timeline toolbar/ruler/playhead/track/clip, Export & Shortcut modal, shortcut keyboard, divider resizable, export nyata PNG/.webm.');
