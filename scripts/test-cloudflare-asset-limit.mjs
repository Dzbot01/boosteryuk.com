// Guard deploy Cloudflare: tidak boleh ada file statis >= 25 MiB.
//
// Latar belakang: `public/models/scene.glb` hasil ekspor Mixamo berukuran 40,5 MB
// (dua tekstur PNG 4096x4096). Karena Vite menyalin public/ apa adanya ke dist/, file itu
// ikut ter-upload sebagai aset statis dan deploy Cloudflare (Workers/Pages) GAGAL —
// batas resminya 25 MiB per file. Efeknya situs produksi tertahan di build lama
// (menu/halaman baru tidak pernah muncul meski PR sudah di-merge).
//
// Test ini menolak kembalinya aset raksasa:
//  • semua file di public/ (dan dist/ bila ada) harus < 25 MiB;
//  • scene.glb tetap ada, self-contained, dan animasinya utuh;
//  • bila ada pelanggar, pesannya menyebut cara memperbaiki (scripts/optimize-scene-glb.py).
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-cloudflare-asset-limit.mjs
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MIB = 1024 * 1024;
const LIMIT = 25 * MIB; // batas Cloudflare Workers/Pages: 25 MiB per file statis

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
};

for (const root of ['public', 'dist']) {
  if (!existsSync(root)) continue;
  const oversize = walk(root)
    .map((f) => ({ f, size: statSync(f).size }))
    .filter((x) => x.size >= LIMIT);
  assert.equal(
    oversize.length,
    0,
    `file statis >= 25 MiB di ${root}/ akan menggagalkan deploy Cloudflare: ` +
      oversize.map((x) => `${x.f} (${(x.size / MIB).toFixed(1)} MiB)`).join(', ') +
      ' — perkecil dulu (untuk GLB: python3 scripts/optimize-scene-glb.py).'
  );
}

/* ---------- scene.glb: masih valid, self-contained, animasi utuh, dan ringan ---------- */
const glbPath = 'public/models/scene.glb';
assert.ok(existsSync(glbPath), 'public/models/scene.glb ada');
const glb = readFileSync(glbPath);
assert.equal(glb.toString('ascii', 0, 4), 'glTF');
assert.equal(glb.readUInt32LE(4), 2);
assert.equal(glb.readUInt32LE(8), glb.length, 'panjang header = ukuran file');
const jsonLen = glb.readUInt32LE(12);
assert.equal(glb.toString('ascii', 16, 20), 'JSON');
const gltf = JSON.parse(glb.toString('utf8', 20, 20 + jsonLen));
assert.ok(!(gltf.buffers || []).some((b) => b.uri), 'tanpa buffer eksternal');
assert.ok(!(gltf.images || []).some((i) => i.uri), 'tanpa gambar eksternal');
const clips = (gltf.animations || []).filter((a) => (a.channels || []).length > 0);
assert.ok(clips.length >= 1, `clip animasi ber-channel tetap ada (${clips.length})`);
assert.ok(!(gltf.extensionsRequired || []).length, 'tanpa extension wajib (loader mana pun bisa)');
const imgViews = new Set((gltf.images || []).map((i) => i.bufferView));
const imgBytes = (gltf.bufferViews || [])
  .filter((_, i) => imgViews.has(i))
  .reduce((s, v) => s + v.byteLength, 0);
assert.ok(glb.length < LIMIT, `scene.glb ${glb.length} byte harus < 25 MiB`);

console.log(
  `PASS Guard deploy Cloudflare: tidak ada file >= 25 MiB di public/` +
    (existsSync('dist') ? ' dan dist/' : '') +
    `; scene.glb ${(glb.length / MIB).toFixed(2)} MiB (tekstur ${(imgBytes / MIB).toFixed(2)} MiB, ` +
    `${clips.length} clip animasi, ${gltf.nodes.length} node) — deploy otomatis aman.`
);
process.exit(0);
