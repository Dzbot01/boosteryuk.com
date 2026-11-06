# Optimasi SEO — Boosteryuk (Vite/React)

| # | Pekerjaan | Status | Implementasi |
|---|-----------|--------|--------------|
| 1 | Prerendering produk & kategori (Kritis) | script | `scripts/prerender.mjs` (`npm run prerender`) — snapshot rute publik jadi HTML statis. Butuh Chromium saat build. |
| 2 | SEO metadata (Kritis) | done | `src/components/Seo.tsx` (metadata bawaan React 19): title, description, OG, Twitter per halaman publik. |
| 3 | Sitemap & robots.txt (Kritis) | done | `public/robots.txt` + `scripts/gen-sitemap.mjs` -> `public/sitemap.xml` (otomatis saat `prebuild`). |
| 4 | Canonical & URL management (Tinggi) | done | `<link rel="canonical">` per rute di `Seo`. |
| 5 | Schema.org (Tinggi) | done | JSON-LD Organization + WebSite(SearchAction) di beranda; BreadcrumbList + Service di kategori. |
| 6 | Image SEO (Tinggi) | done | Gambar utama `alt` + `loading=lazy`; og-image 1200x630. |
| 7 | Performance (Tinggi) | done | Code-split per rute (React.lazy+Suspense), manualChunks vendor, hero-map pakai file (CSS -150KB). |
| 8 | Search Console (Penting) | kamu | Isi `<meta name="google-site-verification">` di `index.html`, daftarkan sitemap. |

## Catatan
- Halaman privat (deposit/payment/admin/dll) otomatis `noindex` via `ProtectedRoute`.
- Prerender di Vercel: set Build Command `npm run build && npm run prerender` + sediakan Chromium.
  Tanpa Chromium, prerender dilewati aman; Google tetap mengindeks (render JS), OG WhatsApp statis di index.html.
- `VITE_SITE_URL` mengatur domain canonical/sitemap/OG (default https://boosteryuk.com).
