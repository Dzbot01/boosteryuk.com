// Render thumbnail artikel (scripts/artikel-thumbs/*.svg) → public/artikel/*.jpg (1200×630, juga untuk OG).
// Jalankan manual setelah mengubah SVG: node scripts/gen-article-thumbs.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs').catch(() => import('playwright'));
const b = await chromium.launch({ executablePath: process.env.PRERENDER_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const f of readdirSync(join(here, 'artikel-thumbs')).filter((x) => x.endsWith('.svg'))) {
  await p.setContent(`<html><body style="margin:0">${readFileSync(join(here, 'artikel-thumbs', f), 'utf8')}</body></html>`);
  await p.screenshot({ path: join(here, '..', 'public', 'artikel', f.replace('.svg', '.jpg')), type: 'jpeg', quality: 86 });
  console.log('thumb', f);
}
await b.close();
