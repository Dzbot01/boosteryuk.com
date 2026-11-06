// Generate public/sitemap.xml dari daftar rute publik + kategori layanan.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE = (process.env.VITE_SITE_URL || 'https://boosteryuk.com').replace(/\/+$/, '');
const today = new Date().toISOString().slice(0, 10);

// Rute publik (yang boleh diindeks).
const staticRoutes = [
  { path: '/', priority: '1.0', freq: 'daily' },
  { path: '/layanan', priority: '0.9', freq: 'daily' },
  { path: '/cek-status', priority: '0.7', freq: 'weekly' },
  { path: '/plus', priority: '0.6', freq: 'monthly' },
  { path: '/about', priority: '0.4', freq: 'yearly' },
  { path: '/terms', priority: '0.3', freq: 'yearly' },
  { path: '/privacy', priority: '0.3', freq: 'yearly' },
  { path: '/support', priority: '0.4', freq: 'monthly' },
];
// Kategori/produk layanan (route layanan/:platform). Perbarui bila kategori berubah.
const categories = ['tiktok','instagram','youtube','threads','telegram','whatsapp','snackvideo','shopee','tokopedia','linkedin','roblox'];

const urls = [
  ...staticRoutes,
  ...categories.map((c) => ({ path: `/layanan/${c}`, priority: '0.8', freq: 'weekly' })),
];

const body = urls
  .map((u) => `  <url>\n    <loc>${SITE}${u.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml');
writeFileSync(out, xml);
console.log('sitemap.xml ditulis:', urls.length, 'URL');
