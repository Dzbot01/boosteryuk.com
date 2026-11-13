// Utilitas SEO bersama: dipakai gen-sitemap.mjs (sitemap.xml) & vite.config.ts (prerender HTML).
// Sumber konten: src/seo/pages.json (deskripsi unik per halaman).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATEGORY_NAMES = {
  tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', threads: 'Threads', telegram: 'Telegram',
  whatsapp: 'WhatsApp', snackvideo: 'SnackVideo', shopee: 'Shopee', tokopedia: 'Tokopedia', linkedin: 'LinkedIn', roblox: 'Roblox',
};

/** Semua halaman yang boleh diindeks, beserta konten unik masing-masing. */
export function seoPages() {
  const data = JSON.parse(readFileSync(join(ROOT, 'src/seo/pages.json'), 'utf8'));
  const pages = data.static.map((p) => ({ ...p, kind: 'static' }));
  for (const [slug, c] of Object.entries(data.categories)) {
    const name = CATEGORY_NAMES[slug] || slug;
    pages.push({ ...c, kind: 'category', slug, name, path: `/layanan/${slug}`, h1: `Layanan ${name}` });
  }
  return pages;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Isi statis di dalam #root (diganti React saat aplikasi dimuat). */
function bodyHtml(page, all) {
  const parts = [`<main style="max-width:860px;margin:0 auto;padding:96px 16px 40px;font-family:system-ui,sans-serif;color:#0f172a">`];
  parts.push(`<h1>${esc(page.h1 || page.title)}</h1>`);
  for (const p of page.intro || [page.description]) parts.push(`<p>${esc(p)}</p>`);
  if (page.faq?.length) {
    parts.push(`<h2>Pertanyaan Umum Layanan ${esc(page.name)}</h2><dl>`);
    for (const f of page.faq) parts.push(`<dt><strong>${esc(f.q)}</strong></dt><dd>${esc(f.a)}</dd>`);
    parts.push('</dl>');
  }
  const cats = all.filter((p) => p.kind === 'category' && p.path !== page.path);
  if (cats.length) {
    parts.push('<nav aria-label="Layanan lain"><h2>Layanan lainnya</h2><ul>');
    for (const c of cats) parts.push(`<li><a href="${c.path}">${esc(c.h1)}</a></li>`);
    parts.push('</ul></nav>');
  }
  parts.push('</main>');
  return parts.join('');
}

/** Buat HTML per halaman dari template index.html hasil build. */
export function renderPage(template, page, all, siteUrl) {
  const url = siteUrl + page.path;
  const full = page.path === '/' ? page.title : `${page.title} · Boosteryuk`;
  const set = (html, re, val) => html.replace(re, (_m, a, b) => `${a}${esc(val)}${b}`);
  let html = template;
  html = html.replace(/<title[^>]*>[\s\S]*?<\/title>/, `<title data-seo-static>${esc(full)}</title>`);
  html = set(html, /(<meta name="description"[^>]*content=")[^"]*(")/, page.description);
  html = set(html, /(<meta property="og:url"[^>]*content=")[^"]*(")/, url);
  html = set(html, /(<meta property="og:title"[^>]*content=")[^"]*(")/, full);
  html = set(html, /(<meta property="og:description"[^>]*content=")[^"]*(")/, page.description);
  html = set(html, /(<meta name="twitter:title"[^>]*content=")[^"]*(")/, full);
  html = set(html, /(<meta name="twitter:description"[^>]*content=")[^"]*(")/, page.description);
  html = html.replace('</head>', `  <link rel="canonical" href="${esc(url)}" data-seo-static />\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml(page, all)}</div>`);
  return html;
}
