# Root slider editor, Server 1 label, Top Service

## Root admin → Pengaturan Website → Image Slider

Three existing slide slots can each be replaced (JPG/PNG/WebP up to 2 MB, maximum 8192px on either side) or reset to their previous default image. Upload/reset saves immediately with loading/success/error feedback. Existing slide titles/subtitles and the number/order of slides stay unchanged.

The shared `useSlides()` consumer covers Buat Pesanan (`LayananPage`), Sewa Agen AI and VPS (`OrderVpsPage`). Root changes do not override child-panel custom slides or child default slides.

Assets live in separate `site_settings` rows `asset_slide_0..2`, not large base64 values inside the main settings JSON/localStorage. Public settings return small versioned refs; public image endpoint is `site_settings.php?asset=slide&index=N&v=HASH`. Saving requires existing session/admin DB verification; requests marked child-panel are rejected. Input index/type/bytes and decoded image MIME/dimensions are validated in PHP. SVG is not accepted. Each slot uses its own row, so updating one doesn't overwrite other slots. Reset removes the custom asset row and the old built-in image is used automatically. The existing table schema is sufficient.

## Frontend

- Server 1 option/selected label: **Server 1 — Ringkas & Murah**. Server 2 label unchanged; routing/default/prices unchanged.
- Dashboard: user-supplied PNG displayed under **Top Service**, before the video. Uses full-width responsive image with max-width 56rem inside page container, `h-auto` / `object-contain`, no crop. Original file included as `public/images/top-service-google-maps.png`. The artwork is an illustration, not live place ratings.
- Hero/map/fade and video behavior unchanged. Before-edit HomePage backup: `backups/before-dashboard-top-service/HomePage.tsx`.

## Upload

Update **`/api/site_settings.php`**, then build (`npm ci && npm run build`) and upload `dist/` including `images/top-service-google-maps.png`. No new PHP file, SQL migration, API key, or configdb.php change. Table `site_settings` is created by the existing endpoint if missing. Not deployed automatically.

## Tests

`NODE_PATH=/tmp/root-slider-tests/node_modules node scripts/test-root-slider-settings.mjs`: PHP syntax parser/source auth-validation contracts, jsdom admin three defaults/reset/upload/invalid type, root/tenant guard and shared consumers, responsive Top Service placement. `node scripts/test-server-option-label.mjs`: labels/default/wrapping. Build passes including 24 SEO pages.

No PHP CLI/MySQL production execution was available. Verify actual save/reset with an admin account, then open the three pages in a second browser after upload. Existing TypeScript baseline errors remain in DepositInvoicePage and PlaygroundPage; no new type errors from these changes.
