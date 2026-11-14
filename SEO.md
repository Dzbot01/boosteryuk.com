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

## Artikel (`/artikel`) — ditambahkan 2026-11-14
- **Sumber tunggal:** `src/content/articles.json` (judul SEO, meta description, kategori, thumbnail, tanggal
  terbit/diperbarui, isi berupa blok `p/h2/h3/ul/ol/note/table/cta`, FAQ, artikel terkait). Inline: `[teks](/url)`, `**tebal**`.
- Dipakai oleh: halaman React (`src/pages/artikel/*`), HTML statis + JSON-LD untuk crawler (`scripts/seo-pages.mjs`),
  dan `public/sitemap.xml` (`<lastmod>` = field `updated`).
- **Schema:** Article (headline, image, datePublished, dateModified, author, publisher) + BreadcrumbList + FAQPage.
- **Thumbnail:** SVG di `scripts/artikel-thumbs/` → `node scripts/gen-article-thumbs.mjs` → `public/artikel/*.jpg`
  (1200×630, juga dipakai sebagai OG image).
- **Desain:** kolom baca 660px (±70 karakter/baris), Source Serif 4 19px / line-height 1.72, IBM Plex Sans untuk
  navigasi & meta, daftar isi menempel di kiri (desktop) / kotak lipat (mobile), dark mode, tanpa gradien.
- **Menambah artikel:** tambahkan objek baru di `articles.json` + SVG thumbnail, jalankan generator thumbnail, build.
  Hindari artikel dengan isi mirip; setiap artikel harus menjawab kebutuhan yang berbeda.

## Judul homepage & halaman SMM Panel
- Homepage: "Boosteryuk — SMM Panel Indonesia & Jasa Booster Media Sosial" + meta description baru.
- `/layanan`: title "SMM Panel Indonesia – Panel Social Media Marketing | Boosteryuk", H1 "Boosteryuk, SMM Panel Indonesia
  untuk Berbagai Kebutuhan Media Sosial", bagian penjelasan (apa itu, cara kerja, layanan, deposit/harga/saldo) + FAQ (FAQPage).
