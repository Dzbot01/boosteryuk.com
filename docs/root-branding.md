# Root-domain zigzag branding

Uses the supplied `logo-b-zigzag-runcing.png`, resized without changing its colors, aspect ratio, or transparency. Dedicated local assets are under `public/branding/`; favicon/apple variants have transparent square padding (no distortion).

Root settings resolve logo/favicon to these assets even when browser cache or remote settings still contain the old favicon. Root branding is now defined in `src/lib/rootBranding.ts`; root logo/favicon upload overrides are not applied while this explicit root branding override is active. Other settings remain unchanged.

Child panels retain the previous defaults while loading and their own configured logo/favicon after tenant load. Legacy `public/favicon*`, apple icon and shared LOGO_URL are deliberately not replaced. Initial HTML uses a host guard for root/www/app; child-host and injected tenant branding are excluded. Desktop header branding stays hidden as before.

Deployment: build frontend (`npm ci && npm run build`) and upload the resulting `dist/`, including `/branding/`. No PHP, SQL or configuration changes. Not deployed automatically. Browsers may cache existing icons; the dedicated new asset URLs avoid reusing old root icon URLs.

Verification: `node scripts/test-root-branding.mjs`, production build + SEO prerender. Asset generation used Pillow outside the repo; no runtime dependency was added.
