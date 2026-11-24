import assert from 'node:assert/strict';import fs from 'node:fs';
const card=fs.readFileSync('src/components/BuatPesananCard.tsx','utf8');
// Urutan UI: card Guri Booster (AiAssistantCard) -> kartu Panduan Pemesanan -> card form/grid.
const iGuri=card.indexOf('<AiAssistantCard');const iGuide=card.indexOf('<OrderGuideCard />');const iForm=card.indexOf('id="buat-pesanan-server"');
assert.ok(iGuri>-1&&iGuide>-1&&iForm>-1&&iGuri<iGuide&&iGuide<iForm,'urutan: Guri Booster -> Panduan Pemesanan -> grid/form');
assert.match(card,/aria-label="Panduan Pemesanan"/);
assert.match(card,/grid gap-2\.5 sm:grid-cols-2/,'format grid card landscape');
for (const note of ['Target wajib mode Public','Target harus benar & valid','Khusus Followers Instagram','Jangan mengubah nama target']) assert.ok(card.includes(note),`catatan panduan: ${note}`);
assert.ok(card.includes('tanpa satu pun pesanan terkirim ke target tersebut'),'peringatan target tidak valid');
assert.ok(card.includes('Tandai untuk Ditinjau'),'catatan khusus followers Instagram');
assert.ok(card.includes('selama proses pesanan berlangsung'),'larangan ubah nama target');
// Langkah berurutan: server -> kategori -> layanan (target wajib public).
for (const [t,b] of [
  ['Pilih Server','Pilih server yang tersedia sesuai kebutuhan anda dengan beragam pilihan layanan dan harga.'],
  ['Pilih Kategori','Pilih kategori yang relevan dengan kebutuhan anda.'],
  ['Pilih Layanan','Pilih layanan dari kategori layanan yang anda pilih, lalu lanjut ke target wajib mode public.'],
]) { assert.ok(card.includes(`title: '${t}'`),`langkah ${t}`); assert.ok(card.includes(b),`deskripsi langkah ${t}`); }
// Buka/tutup dari tombol pojok kanan, default tertutup.
assert.match(card,/function OrderGuideCard\(\) \{\n  const \[open, setOpen\] = useState\(false\);/,'panduan default tertutup');
assert.match(card,/aria-expanded=\{open\}/);assert.match(card,/aria-controls="panduan-pemesanan-isi"/);
assert.match(card,/aria-label=\{open \? 'Tutup panduan pemesanan' : 'Buka panduan pemesanan'\}/,'tombol buka/tutup berlabel');
assert.match(card,/\{!open && \(/,'hint saat tertutup');assert.match(card,/\{open && \(/,'isi hanya saat terbuka');
assert.match(card,/className="ml-auto flex h-8 w-8/,'tombol di pojok kanan header');
// Panduan khusus followers Instagram: gambar contoh + langkah + penutup.
assert.ok(fs.existsSync('public/guides/instagram-flag-for-review.png'),'aset gambar panduan Instagram ada');
assert.match(card,/src="\/guides\/instagram-flag-for-review\.png"/,'gambar contoh dipakai di kartu');
assert.match(card,/sm:w-\[380px\] sm:max-w-full/,'gambar panduan diperkecil khusus desktop (mobile tetap penuh)');
const ai=fs.readFileSync('src/components/AiAssistantCard.tsx','utf8');
assert.match(ai,/import aiAgent from '\.\.\/assets\/ai-agent\.png'/,'ikon AI agent memakai gambar baru');
assert.match(ai,/src=\{aiAgent\} alt="AI Agent"/,'avatar AI agent diganti gambar robot');
assert.ok(fs.existsSync('src/assets/ai-agent.png'),'aset ai-agent.png ada');
assert.ok(!ai.includes('guri.webp'),'avatar lama guri.webp tidak dipakai lagi');
assert.ok(card.includes('kemungkinan besar karena mereka perlu disetujui secara manual'),'pengantar panduan Instagram');
for (const s of ['Buka Pengaturan dan Privasi.','Pilih Ikuti dan Undang Teman.','Nonaktifkan opsi Tandai untuk Ditinjau.','Jika baru Nonaktifkan opsi Tandai untuk Ditinjau, kamu bisa test pesan sedikit dulu.']) assert.ok(card.includes(s),`langkah IG: ${s}`);
assert.ok(card.includes('masuk ke\n              kategori spam')||card.includes('masuk ke kategori spam'),'peringatan mis order spam');
// Label server baru tanpa nama provider.
assert.ok(card.includes("{ value: '1', label: 'Server 1 — Ringkas & Stabil' }"),'label Server 1');
assert.ok(card.includes("{ value: '4', label: 'Server 3 — Lengkap & Murah' }"),'label Server 3');
// Ikon kategori: brand lokal luas + globe website + fallback inisial untuk kategori tanpa merek.
const con=fs.readFileSync('src/constants.ts','utf8');
for (const slug of ['audiomack','deezer','mixcloud','soundcloud','medium','tumblr','steam','trustpilot','tripadvisor','imdb','vk','reddit','kick','rumble','quora','vimeo','dailymotion']) assert.ok(con.includes(`{ slug: '${slug}'`),`brand kategori ${slug}`);
assert.ok(con.includes("slug: 'website'")&&con.includes('/brands/website.svg'),'ikon globe untuk kategori website');
assert.ok(fs.existsSync('public/brands/website.svg'),'aset website.svg ada');
assert.match(card,/if \(!brand\) \{/,'BrandBadge punya fallback');
assert.match(card,/font-display text-\[8px\] font-extrabold text-white">\{initials\}/,'fallback inisial nama kategori');
// Pengelompokan kategori: kunci ternormalisasi, varian huruf/spasi tidak memecah kelompok.
assert.match(card,/function normCategory/);assert.match(card,/normCategory\(s\.category\) === category/);assert.match(card,/setCategory\(normCategory\(pre\.category\)\)/);
console.log('PASS Panduan Pemesanan (grid landscape, urutan card), label Server 1/3 baru, ikon kategori + fallback, pengelompokan kategori stabil.');
