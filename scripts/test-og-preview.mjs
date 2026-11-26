// Preview link (WhatsApp/Google/Telegram): gambar OG harus screenshot asli halaman
// saat ini (1200x630 JPEG tajam), disajikan dari CDN ramah crawler (Supabase edge
// function `og-image`) dengan kandidat fallback same-origin, URL absolut, dan
// deskripsi panjang yang informatif (bukan sekadar judul) yang konsisten di
// meta description, og:description, twitter:description, config SEO, dan pages.json.
//
// NODE_PATH=/tmp/server3-tests/node_modules node scripts/test-og-preview.mjs
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const FN_OG = 'https://dzvsjcjvnpasrwuuopeg.supabase.co/functions/v1/og-image';

/* ---------- 1. File gambar OG lokal: JPEG 1200x630, ukuran wajar (tajam tapi ringan) ---------- */
const buf = readFileSync('public/og-image.jpg');
assert.equal(buf.readUInt16BE(0), 0xffd8, 'magic JPEG SOI');
function jpegSize(b) {
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    const len = b.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}
const dim = jpegSize(buf);
assert.deepEqual(dim, { width: 1200, height: 630 }, 'dimensi OG 1200x630 (rasio share card)');
const kb = statSync('public/og-image.jpg').size / 1024;
assert.ok(kb > 40 && kb < 400, `ukuran OG wajar untuk crawler WhatsApp (${kb.toFixed(0)} KB)`);

/* ---------- 2. index.html: tag statis untuk crawler tanpa JS ---------- */
const html = readFileSync('index.html', 'utf8');
assert.ok(!html.includes('og-image.jpg?v=4'), 'cache-buster gambar lama dihapus');
// og:image utama = edge function Supabase (CDN ramah crawler); kandidat kedua same-origin.
const ogImages = [...html.matchAll(/<meta property="og:image" (?:data-seo-static )?content="([^"]+)" \/>/g)].map((m) => m[1]);
assert.equal(ogImages[0], FN_OG, 'og:image utama = edge function Supabase');
assert.match(ogImages[1] || '', /^__SITE_URL__\/og-image\.jpg\?v=5$/, 'og:image kandidat kedua = same-origin absolut + v=5');
const sec = html.match(/<meta property="og:image:secure_url" content="([^"]+)" \/>/);
assert.ok(sec && sec[1] === FN_OG, 'og:image:secure_url = edge function');
const tw = html.match(/<meta name="twitter:image" data-seo-static content="([^"]+)" \/>/);
assert.ok(tw && tw[1] === FN_OG, 'twitter:image = edge function');
assert.match(html, /<meta property="og:image:width" content="1200" \/>/, 'lebar OG dideklarasikan');
assert.match(html, /<meta property="og:image:height" content="630" \/>/, 'tinggi OG dideklarasikan');
assert.match(html, /<meta property="og:image:type" content="image\/jpeg" \/>/, 'tipe OG jpeg');
assert.match(html, /<meta name="twitter:card" data-seo-static content="summary_large_image" \/>/, 'twitter card large');

const descOf = (re) => { const m = html.match(re); assert.ok(m, 'meta deskripsi ada'); return m[1]; };
const metaDesc = descOf(/<meta name="description" data-seo-static content="([^"]+)"/);
const ogDesc = descOf(/<meta property="og:description" data-seo-static content="([^"]+)"/);
const twDesc = descOf(/<meta name="twitter:description" data-seo-static content="([^"]+)"/);
assert.equal(ogDesc, metaDesc, 'og:description sama dengan meta description');
assert.equal(twDesc, metaDesc, 'twitter:description sama dengan meta description');
assert.ok(metaDesc.length >= 140 && metaDesc.length <= 400, `deskripsi informatif, tidak terlalu pendek (${metaDesc.length} karakter)`);
assert.ok(/followers/.test(metaDesc) && /24\/7/.test(metaDesc) && /child panel/.test(metaDesc), 'deskripsi memuat nilai jual, bukan sekadar judul');
assert.match(html, /<meta property="og:title" data-seo-static content="Boosteryuk — SMM Panel Indonesia & Jasa Booster Media Sosial" \/>/, 'judul OG tetap');

/* ---------- 3. Config SEO & pages.json konsisten ---------- */
const cfg = readFileSync('src/seo/config.ts', 'utf8');
assert.ok(cfg.includes(`export const DEFAULT_OG_IMAGE = '${FN_OG}';`), 'DEFAULT_OG_IMAGE = edge function Supabase');
const mDesc = cfg.match(/export const DEFAULT_DESC =\n?\s*'([^']+)'/);
assert.ok(mDesc, 'DEFAULT_DESC ada');
assert.equal(mDesc[1], metaDesc, 'DEFAULT_DESC sama dengan deskripsi statis index.html');
const pages = JSON.parse(readFileSync('src/seo/pages.json', 'utf8'));
const home = pages.static.find((p) => p.path === '/');
assert.equal(home.description, metaDesc, 'deskripsi home di pages.json sama (sumber prerender & sitemap)');

/* ---------- 4. Build mengganti __SITE_URL__ menjadi URL absolut (kandidat og:image kedua) ---------- */
const vite = readFileSync('vite.config.ts', 'utf8');
assert.match(vite, /__SITE_URL__/, 'plugin build mengganti placeholder __SITE_URL__');

/* ---------- 5. Homepage mempertahankan OG statis (crawler tanpa JS tetap kebagian) ---------- */
const homePage = readFileSync('src/pages/HomePage.tsx', 'utf8');
assert.match(homePage, /bareOnHome/, 'homepage tidak menimpa tag OG statis');

console.log('PASS Preview link: og-image di-CDN-kan via edge function Supabase (+fallback same-origin v=5, 1200x630), deskripsi panjang konsisten di meta/og/twitter/config/pages.json untuk preview WhatsApp & Google.');
