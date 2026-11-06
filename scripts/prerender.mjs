// Prerender rute publik menjadi HTML statis (SEO untuk crawler non-JS).
// Memakai Chromium (Playwright) bila tersedia; jika tidak, dilewati tanpa menggagalkan build.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const CHROME = process.env.PRERENDER_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = Number(process.env.PRERENDER_PORT || 4188);

const ROUTES = ['/', '/layanan', '/cek-status', '/plus', '/about', '/terms', '/privacy', '/support',
  '/layanan/tiktok', '/layanan/instagram', '/layanan/youtube', '/layanan/threads', '/layanan/telegram',
  '/layanan/whatsapp', '/layanan/snackvideo', '/layanan/shopee', '/layanan/tokopedia', '/layanan/linkedin', '/layanan/roblox'];

const MIME = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json',
  '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };

async function serveFile(res, path) {
  try { const buf = await readFile(path); res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' }); res.end(buf); return true; }
  catch { return false; }
}

const server = createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const filePath = join(root, url);
  if (extname(url) && await serveFile(res, filePath)) return;
  await serveFile(res, join(root, 'index.html')); // SPA fallback
});

async function run() {
  if (!existsSync(CHROME)) { console.warn('[prerender] Chromium tidak ditemukan, dilewati. (set PRERENDER_CHROMIUM)'); return; }
  let chromium;
  try { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')); }
  catch { try { ({ chromium } = await import('playwright')); } catch { console.warn('[prerender] playwright tidak ada, dilewati.'); return; } }

  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: CHROME });
  const base = await readFile(join(root, 'index.html'), 'utf8');
  let count = 0;
  for (const route of ROUTES) {
    const page = await browser.newPage();
    // Opsional: blok resource eksternal (cepat) via PRERENDER_BLOCK_EXTERNAL=1.
    if (process.env.PRERENDER_BLOCK_EXTERNAL === '1') {
      await page.route('**/*', (r) => (r.request().url().includes(`127.0.0.1:${PORT}`) ? r.continue() : r.abort()));
    }
    try {
      await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1200);
      const html = '<!doctype html>\n' + await page.evaluate(() => document.documentElement.outerHTML);
      const outDir = route === '/' ? root : join(root, route);
      if (route !== '/') await mkdir(outDir, { recursive: true });
      await writeFile(join(outDir, 'index.html'), html);
      count++;
    } catch (e) { console.warn('[prerender] gagal', route, String(e).slice(0, 80)); }
    await page.close();
  }
  await browser.close();
  server.close();
  console.log(`[prerender] ${count}/${ROUTES.length} rute dibuat.`);
  // kembalikan index.html root ke versi SPA asli? Tidak — index.html root kini versi prerender beranda.
  void base;
}
run().catch((e) => { console.warn('[prerender] error:', e); process.exit(0); });
