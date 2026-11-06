# boosteryuk.com

Website Boosteryuk (SMM Panel) — **React + Vite + TypeScript + Tailwind v4**.
Dilengkapi lapisan **SEO** (metadata, canonical, sitemap, robots, Schema.org, prerender, performa).
Lihat `SEO.md` untuk detail optimasi.

## Jalankan
```bash
npm install
npm run dev        # pengembangan
npm run build      # produksi (otomatis generate sitemap.xml)
npm run prerender  # (opsional) prerender rute publik -> HTML statis (butuh Chromium)
```

## Env
- `VITE_SITE_URL` — domain untuk canonical/sitemap/OG (default `https://boosteryuk.com`).
- `VITE_API_URL` — endpoint API backend (default `https://boosteryuk.com/api`).
