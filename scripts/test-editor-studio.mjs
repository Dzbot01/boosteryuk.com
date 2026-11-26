import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { build } = require('esbuild');

const read = (p) => fs.readFileSync(p, 'utf8');

/* 1. Playground tetap punya menu Editor Studio */
const pg = read('src/pages/PlaygroundPage.tsx');
assert.match(pg, /import EditorStudio from '\.\.\/components\/EditorStudio'/);
assert.match(pg, /id: 'studio', label: 'Editor Studio'/, 'menu Editor Studio ada di Playground');
assert.match(pg, /\['overview', 'hook', 'caption', 'tts', 'studio', 'gen3d'\]/);
assert.match(pg, /menu === 'studio' \? \(/, 'studio punya cabang render sendiri (layar penuh)');
assert.ok(!pg.includes('Wand2'), 'ikon badge Playground dihapus bersama teksnya');

const shell = read('src/components/EditorStudio.tsx');
assert.match(shell, /import Studio from '\.\/editor\/Studio'/, 'EditorStudio merender Studio baru');
assert.match(shell, /<Studio onOpenMenu=\{onOpenMenu\} \/>/);

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

/* 13. Playground: teks "Playground" hilang, kartu Studio layar penuh, Editor Studio interaktif di HP */
assert.ok(!/text-silver-shine">Playground</.test(pg), 'badge teks "Playground" dihapus');
assert.ok(!/menu === 'studio' && <EditorStudio/.test(pg), 'studio tidak lagi di dalam container max-w-5xl/pt-24');
assert.match(pg, /<div className="fixed inset-0 z-50 overflow-hidden bg-black">/, 'studio mengisi seluruh layar begitu menu dibuka');
assert.match(pg, /<EditorStudio onOpenMenu=\{\(\) => setDrawerOpen\(true\)\} \/>/, 'menu Playground tetap bisa dibuka dari studio');
assert.match(studio, /flex h-full w-full flex-col overflow-hidden/, 'ukuran studio ikut layer (bukan 100vh yang kepotong address bar HP)');
assert.match(studio, /<TopBar onOpenMenu=\{onOpenMenu\} \/>/);
assert.match(studio, /<div className="h-\[54vh\] overflow-hidden">/, 'bottom sheet bertinggi pasti → daftar di dalamnya bisa di-scroll');
assert.match(studio, /min-h-\[46px\]/, 'tombol nav bawah cukup besar untuk jari');
assert.match(studio, /safe-area-inset-bottom/, 'nav bawah menghormati safe-area');
assert.match(top, /aria-label="Menu Playground"/, 'tombol menu Playground di TopBar');
assert.match(top, /document\.addEventListener\('pointerdown', outside\)/, 'dropdown ditutup lewat pointerdown (mouse + sentuh)');
assert.ok(!/addEventListener\('mousedown', outside\)/.test(top), 'tidak lagi hanya mendengarkan mousedown');
assert.match(top, /if \(e\.key === 'Escape'\)/, 'Escape menutup dropdown');
assert.match(top, /hidden text-\[13px\] font-bold lg:inline/, 'nama studio disembunyikan di layar sempit');
assert.match(top, /max-w-\[26vw\]/, 'judul proyek tidak menimpa tombol di HP');
assert.match(top, /hidden lg:inline">Shortcut</, 'label teks Shortcut disembunyikan di HP');
assert.match(player, /className="relative mx-3 h-5 cursor-pointer touch-none"/, 'scrub bar tidak memicu scroll saat digeser');
assert.match(player, /setPointerCapture\?\.\(e\.pointerId\)/, 'pointer ditangkap supaya geseran tidak lepas');
assert.match(player, /if \(scrubbing\) setPlayhead\(t\);/, 'playhead mengikuti geseran jari 1:1');
assert.match(player, /-inset-y-2/, 'area sentuh scrub bar diperbesar');
assert.match(player, /hidden items-end gap-\[2px\] sm:flex/, 'meter audio disembunyikan di layar sempit');
assert.match(tb, /overflow-x-auto/, 'toolbar timeline bisa digeser di HP');
assert.match(tb, /\[&>\*\]:shrink-0/, 'tool tidak menyempit sampai tidak bisa ditekan');
/* 12. Hapus media membuang clip timeline + trim mengikuti kursor (regresi bug melebar) */
assert.match(store, /removeAsset: \(id\) =>\n    set\(\(s\) => \{/, 'removeAsset memakai body penuh');
assert.match(store, /const clips = s\.clips\.filter\(\(c\) => c\.assetId !== id\);/, 'clip milik media yang dihapus ikut dibuang');
assert.match(store, /selected: clips\.some\(\(c\) => c\.id === s\.selected\) \? s\.selected : null/, 'selection dibersihkan bila clip terpilih ikut terhapus');
const clipSrc = read('src/components/editor/TimelineClip.tsx');
assert.match(clipSrc, /lastX: number/, 'drag menyimpan posisi pointer terakhir');
assert.match(clipSrc, /const inc = \(ev\.clientX - d\.lastX\) \/ zoom;/, 'trim mengirim delta inkremental per event');
assert.equal((clipSrc.match(/touchAction: 'none'/g) || []).length, 3, 'clip + dua handle trim tidak memicu scroll saat drag (mobile)');
assert.match(store, /playheadTouched: false/, 'guard playhead belum disentuh');
assert.match(store, /setPlayheadDefault: \(t\) => set\(\(s\) => \(s\.playheadTouched \? \{\} : \{ playhead: Math\.max\(0, t\) \}\)\)/, 'default playhead hanya selama belum disentuh');
assert.match(tl, /setPlayheadDefault\(\(view\.scrollLeft \+ view\.clientWidth \/ 2\) \/ zoom\)/, 'default cursor timeline = tengah viewport');
assert.match(clipSrc, /setPlayhead\(clip\.start \+ \(e\.clientX - rect\.left\) \/ zoom\)/, 'klik clip memindahkan playhead ke posisi klik');
assert.match(store, /const under = s\.clips\.find\(\(c\) => s\.playhead >= c\.start && s\.playhead <= c\.start \+ c\.duration\);/, 'cut memakai clip di bawah garis playhead');
assert.match(store, /importAudioFiles: \(files\) => \{/, 'store punya importAudioFiles');
assert.match(tb, /accept="audio\/\*,\.mp3,\.wav,\.m4a,\.aac,\.ogg,\.flac"/, 'input file audio mp3/wav dll.');
assert.match(tb, /importAudioFiles\(e\.target\.files\)/, 'toolbar meneruskan file audio ke store');
assert.match(tb, /const canSplit = Boolean\(selected\) \|\| clips\.some/, 'tombol Split aktif bila playhead di atas clip');
assert.match(tb, /disabled=\{!canSplit\}/, 'Split memakai canSplit');

const uiTsx = read('src/components/editor/ui.tsx');
assert.match(uiTsx, /h-8 w-8[\s\S]{0,120}lg:h-7 lg:w-7/, 'target sentuh IconBtn 32px di HP, 28px di desktop');
for (const f of ['ExportModal.tsx', 'ShortcutModal.tsx']) {
  assert.match(read(`src/components/editor/${f}`), /max-h-\[90vh\] overflow-y-auto ed-scroll/, `modal ${f} bisa di-scroll di layar pendek`);
}

/* 13. Fungsional jsdom: removeAsset menghapus clip + drag trim sinkron 1:1 dengan kursor */
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<div id="root"></div>', { url: 'https://boosteryuk.com/playground?m=studio' });
globalThis.window = dom.window; globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.matchMedia = (q) => ({ matches: false, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false });
globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
const dirEd = mkdtempSync(path.join(tmpdir(), 'editor-studio-'));
let rootEd = null;
try {
  const { outputFiles } = await build({
    stdin: { contents: `export {createElement,act} from 'react';export {createRoot} from 'react-dom/client';export {useEditor} from './src/components/editor/store';export {default as TimelineClip} from './src/components/editor/TimelineClip';`, resolveDir: process.cwd(), sourcefile: 'entry.tsx' },
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
    loader: { '.css': 'empty', '.png': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.wav': 'dataurl' },
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
  });
  const fileEd = path.join(dirEd, 'bundle.cjs'); writeFileSync(fileEd, outputFiles[0].text);
  const { createElement: h, act, createRoot, useEditor, TimelineClip } = require(fileEd);
  const ZOOM = 50;
  const mkClip = (id) => ({ id, track: 'video', assetId: 'asset-1', name: 'Klip Uji', start: 2, duration: 10, inPoint: 0, chips: [], mock: true });

  /* hapus media => clip timeline + selection ikut terhapus */
  useEditor.setState({ assets: [{ id: 'asset-1', name: 'uji.mp4', kind: 'video', url: '', thumb: '', duration: 10, mock: true }], clips: [mkClip('c1')], selected: 'c1' });
  await act(async () => { useEditor.getState().removeAsset('asset-1'); });
  assert.deepEqual(useEditor.getState().clips, [], 'clip timeline terhapus bersama medianya');
  assert.equal(useEditor.getState().selected, null, 'selection clip yang ikut terhapus dibersihkan');
  assert.deepEqual(useEditor.getState().assets, [], 'media hilang dari panel');

  /* drag handle kanan: 3 event pointer +10px masing-masing => durasi +3*(10/50)=+0.6 dtk */
  useEditor.setState({ assets: [], clips: [mkClip('c2')], selected: 'c2' });
  rootEd = createRoot(document.getElementById('root'));
  await act(async () => rootEd.render(h(TimelineClip, { clip: useEditor.getState().clips[0], zoom: ZOOM })));
  const handles = [...document.querySelectorAll('#root span.cursor-ew-resize')];
  assert.equal(handles.length, 2, 'dua handle trim tampil pada clip terpilih');
  const down = (el, x) => act(async () => el.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x })));
  const moveWin = (x) => act(async () => dom.window.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: x })));
  const upWin = () => act(async () => dom.window.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true })));
  await down(handles[1], 1000);
  await moveWin(1010); await moveWin(1020); await moveWin(1030);
  await upWin();
  const after = useEditor.getState().clips[0];
  assert.ok(Math.abs(after.duration - 10.6) < 1e-9, `durasi mengikuti kursor 1:1 (10.6 dtk, dapat ${after.duration})`);
  assert.equal(after.start, 2, 'handle kanan tidak menggeser posisi mulai');

  /* drag handle kiri: 2 event +10px => start +0.4, duration -0.4, inPoint +0.4 */
  await down(handles[0], 500);
  await moveWin(510); await moveWin(520);
  await upWin();
  const left = useEditor.getState().clips[0];
  assert.ok(Math.abs(left.start - 2.4) < 1e-9 && Math.abs(left.duration - 10.2) < 1e-9 && Math.abs(left.inPoint - 0.4) < 1e-9, `trim kiri sinkron kursor (start 2.4 / durasi 10.2, dapat ${left.start}/${left.duration})`);
  await act(async () => rootEd.unmount()); rootEd = null;

  /* playhead default tengah: berlaku hanya selama belum disentuh user */
  useEditor.setState({ clips: [], selected: null, playhead: 0, playheadTouched: false });
  useEditor.getState().setPlayheadDefault(12.5);
  assert.equal(useEditor.getState().playhead, 12.5, 'default tengah dapat menimpa selama belum disentuh');
  useEditor.getState().setPlayhead(3);
  useEditor.getState().setPlayheadDefault(99);
  assert.equal(useEditor.getState().playhead, 3, 'posisi user tidak ditimpa default setelah disentuh');

  /* klik body clip => playhead otomatis ke posisi klik (rect jsdom nol => t = start + clientX/zoom) */
  useEditor.setState({ clips: [mkClip('c3')], selected: null, playhead: 0, playheadTouched: true });
  rootEd = createRoot(document.getElementById('root'));
  await act(async () => rootEd.render(h(TimelineClip, { clip: useEditor.getState().clips[0], zoom: ZOOM })));
  const body = document.querySelector('#root [role="button"]');
  await down(body, 150);
  assert.equal(useEditor.getState().playhead, 2 + 150 / ZOOM, 'klik clip memindahkan cursor timeline ke posisi klik');
  await upWin();
  await act(async () => rootEd.unmount()); rootEd = null;

  /* cut mengikuti garis playhead walau tanpa selection */
  useEditor.setState({ clips: [mkClip('c4')], selected: null, playhead: 5 });
  await act(async () => { useEditor.getState().splitSelected(); });
  const parts = useEditor.getState().clips;
  assert.equal(parts.length, 2, 'Split memotong clip di bawah garis playhead walau tanpa selection');
  assert.ok(Math.abs(parts[0].duration - 3) < 1e-9 && Math.abs(parts[1].start - 5) < 1e-9 && Math.abs(parts[1].duration - 7) < 1e-9, `potongan sesuai garis playhead (3 + 7 dtk, dapat ${parts[0].duration} + ${parts[1].duration})`);

  /* upload audio (mp3) => asset + clip audio di track audio mulai garis playhead */
  // Node menolak File jsdom di createObjectURL & jsdom tidak menyediakannya => shim blob URL.
  globalThis.URL = dom.window.URL;
  let blobSeq = 0;
  dom.window.URL.createObjectURL = () => `blob:https://boosteryuk.com/mock-${++blobSeq}`;
  dom.window.URL.revokeObjectURL = () => {};
  globalThis.Audio = dom.window.Audio;
  const fileMp3 = new dom.window.File([new Uint8Array(32)], 'lagu-demo.mp3', { type: 'audio/mpeg' });
  useEditor.setState({ clips: [mkClip('c5')], selected: null, playhead: 4 });
  await act(async () => { useEditor.getState().importAudioFiles([fileMp3]); });
  const stAfterAudio = useEditor.getState();
  const audioClip = stAfterAudio.clips.find((c) => c.track === 'audio');
  assert.ok(audioClip, 'clip audio terbentuk dari upload mp3');
  assert.equal(audioClip.start, 4, 'clip audio mulai dari garis playhead');
  assert.ok(stAfterAudio.clips.filter((c) => c.track === 'video').length === 1, 'clip media tetap di track video (audio di bawahnya)');
  assert.ok(stAfterAudio.assets.some((a) => a.kind === 'audio' && a.name === 'lagu-demo.mp3'), 'asset audio masuk daftar media');
  assert.equal(stAfterAudio.selected, audioClip.id, 'clip audio baru langsung terpilih');
} finally {
  if (rootEd) { const { act } = require(path.join(dirEd, 'bundle.cjs')); await act(async () => rootEd.unmount()); }
}

console.log('PASS Editor Studio (CapCut-style): badge teks Playground dihapus, kartu Studio layar penuh saat menu dibuka, interaksi mobile (scrub pointer, toolbar bisa digeser, bottom sheet dapat di-scroll, dropdown pointerdown, target sentuh 32-46px), TopBar 44px + menu/auto-save/judul/Export, panel kiri 7 tab (Media/Audio/Text/Stickers/Effects/Transition/Filters), Player + scrub bar + rasio, Inspector 5 tab, Timeline toolbar/ruler/playhead/track/clip, Export & Shortcut modal, shortcut keyboard, divider resizable, export nyata PNG/.webm, hapus media membuang clip timeline, dan drag trim clip sinkron 1:1 dengan kursor (desktop & mobile).');
process.exit(0);
