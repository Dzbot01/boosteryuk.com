// Generate public/sitemap.xml dari src/seo/pages.json (halaman publik + kategori layanan).
// Google mengabaikan <priority>/<changefreq>; <lastmod> dipakai bila AKURAT, jadi tanggalnya
// diambil dari field "updated" tiap halaman (bukan tanggal build).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seoPages } from './seo-pages.mjs';

const SITE = (process.env.VITE_SITE_URL || 'https://boosteryuk.com').replace(/\/+$/, '');
const pages = seoPages();

const body = pages
  .map((p) => `  <url>\n    <loc>${SITE}${p.path}</loc>\n    <lastmod>${p.updated}</lastmod>\n  </url>`)
  .join('\n');
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml'), xml);
console.log('sitemap.xml ditulis:', pages.length, 'URL');
