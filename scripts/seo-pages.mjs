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
  // Artikel (src/content/articles.json): indeks + tiap artikel, isi lengkap ikut di-prerender.
  const art = JSON.parse(readFileSync(join(ROOT, 'src/content/articles.json'), 'utf8'));
  const latest = art.articles.reduce((m, a) => (a.updated > m ? a.updated : m), '0000-00-00');
  pages.push({ kind: 'article-index', path: '/artikel', updated: latest, articles: art.articles,
    title: 'Artikel & Panduan SMM Panel, Media Sosial, dan Agen AI',
    description: 'Kumpulan artikel Boosteryuk: panduan SMM panel, cara menumbuhkan akun TikTok, child panel untuk reseller, dasar VPS, dan agen AI WhatsApp — ditulis dari pengalaman operasional.' });
  for (const a of art.articles) {
    pages.push({ kind: 'article', path: `/artikel/${a.slug}`, updated: a.updated, title: a.seoTitle, description: a.description,
      image: a.thumbnail, article: a, author: art.author });
  }
  return pages;
}

/* ---------- artikel → HTML statis ---------- */
const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const inline = (s) => esc(s)
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
const plainText = (s) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');

function articleHtml(a, author) {
  const o = [`<main style="max-width:720px;margin:0 auto;padding:96px 16px 40px;font-family:Georgia,serif;color:#1d1f22;line-height:1.7">`];
  o.push(`<nav aria-label="Breadcrumb"><a href="/">Beranda</a> / <a href="/artikel">Artikel</a> / ${esc(a.category)}</nav>`);
  o.push(`<article><header><p>${esc(a.category)}</p><h1>${esc(a.title)}</h1><p>${esc(a.excerpt)}</p>`);
  o.push(`<p>Oleh <a href="${author.url}">${esc(author.name)}</a> · <time datetime="${a.published}">${a.published}</time> · Diperbarui <time datetime="${a.updated}">${a.updated}</time></p></header>`);
  o.push(`<img src="${a.thumbnail}" alt="${esc(a.thumbAlt)}" width="1200" height="630" style="max-width:100%;height:auto">`);
  const toc = a.blocks.filter((b) => b.t === 'h2').map((b) => `<li><a href="#${slugify(b.x)}">${esc(plainText(b.x))}</a></li>`);
  if (a.faq?.length) toc.push('<li><a href="#faq">Pertanyaan yang sering diajukan</a></li>');
  o.push(`<nav aria-label="Daftar isi"><h2>Daftar isi</h2><ol>${toc.join('')}</ol></nav>`);
  for (const b of a.blocks) {
    if (b.t === 'p') o.push(`<p>${inline(b.x)}</p>`);
    else if (b.t === 'h2' || b.t === 'h3') o.push(`<${b.t} id="${slugify(b.x)}">${inline(b.x)}</${b.t}>`);
    else if (b.t === 'ul' || b.t === 'ol') o.push(`<${b.t}>${b.items.map((x) => `<li>${inline(x)}</li>`).join('')}</${b.t}>`);
    else if (b.t === 'note') o.push(`<aside><strong>Catatan:</strong> ${inline(b.x)}</aside>`);
    else if (b.t === 'table') o.push(`<table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
    else if (b.t === 'cta') o.push(`<section><h4>${esc(b.title)}</h4><p>${esc(b.x)}</p><p><a href="${b.href}">${esc(b.label)}</a></p></section>`);
  }
  if (a.faq?.length) {
    o.push('<h2 id="faq">Pertanyaan yang sering diajukan</h2><dl>');
    for (const f of a.faq) o.push(`<dt><strong>${esc(f.q)}</strong></dt><dd>${esc(f.a)}</dd>`);
    o.push('</dl>');
  }
  o.push(`<section aria-label="Tentang penulis"><p><strong>${esc(author.name)}</strong></p><p>${esc(author.role)}</p></section></article></main>`);
  return o.join('');
}

function articleIndexHtml(list) {
  const o = ['<main style="max-width:860px;margin:0 auto;padding:96px 16px 40px;font-family:Georgia,serif;color:#1d1f22">',
    '<h1>Artikel &amp; Panduan</h1><p>Penjelasan praktis seputar SMM panel, pertumbuhan media sosial, bisnis reseller, server, dan agen AI.</p><ul>'];
  for (const a of list) o.push(`<li><h2><a href="/artikel/${a.slug}">${esc(a.title)}</a></h2><p>${esc(a.excerpt)}</p><p><time datetime="${a.published}">${a.published}</time></p></li>`);
  o.push('</ul></main>');
  return o.join('');
}

function articleJsonLd(a, author, siteUrl) {
  const url = `${siteUrl}/artikel/${a.slug}`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: a.description, image: [siteUrl + a.thumbnail],
      datePublished: a.published, dateModified: a.updated, inLanguage: 'id-ID', articleSection: a.category,
      author: { '@type': 'Organization', name: author.name, url: siteUrl + author.url },
      publisher: { '@type': 'Organization', name: 'Boosteryuk', url: siteUrl, logo: { '@type': 'ImageObject', url: siteUrl + '/favicon.png' } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Beranda', item: siteUrl + '/' },
      { '@type': 'ListItem', position: 2, name: 'Artikel', item: siteUrl + '/artikel' },
      { '@type': 'ListItem', position: 3, name: a.title, item: url }] },
  ];
  if (a.faq?.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  return ld;
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
  const full = page.fullTitle || (page.path === '/' ? page.title : `${page.title} · Boosteryuk`);
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
  if (page.image) {
    const img = siteUrl + page.image;
    html = set(html, /(<meta property="og:image"[^>]*content=")[^"]*(")/, img);
    html = set(html, /(<meta property="og:image:secure_url"[^>]*content=")[^"]*(")/, img);
    html = set(html, /(<meta name="twitter:image"[^>]*content=")[^"]*(")/, img);
    if (page.article) html = set(html, /(<meta property="og:image:alt"[^>]*content=")[^"]*(")/, page.article.thumbAlt);
  }
  if (page.kind === 'article') {
    html = set(html, /(<meta property="og:type"[^>]*content=")[^"]*(")/, 'article');
    const ld = JSON.stringify(articleJsonLd(page.article, page.author, siteUrl)).replace(/</g, '\\u003c');
    html = html.replace('</head>', `  <meta property="article:published_time" content="${page.article.published}" data-seo-static />\n  <meta property="article:modified_time" content="${page.article.updated}" data-seo-static />\n  <script type="application/ld+json" data-seo-static>${ld}</script>\n  </head>`);
  }
  const body = page.kind === 'article' ? articleHtml(page.article, page.author)
    : page.kind === 'article-index' ? articleIndexHtml(page.articles) : bodyHtml(page, all);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
}
