import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_URL, SITE_NAME, DEFAULT_TITLE, DEFAULT_DESC, DEFAULT_OG_IMAGE, abs } from '../seo/config';
import { IS_CHILD_PANEL } from '../lib/apiBase';
import { useSiteSettings } from '../context/SiteSettingsContext';

type JsonLd = Record<string, unknown> | Record<string, unknown>[];

interface SeoProps {
  title?: string;        // judul halaman (tanpa brand); kosong = judul default
  description?: string;
  image?: string;        // path/URL gambar OG
  type?: 'website' | 'article';
  noindex?: boolean;     // halaman privat (mis. dashboard) -> jangan diindeks
  /** true = jangan render tag OG/Twitter (dipakai homepage yang sudah punya meta statis di index.html). */
  bareOnHome?: boolean;
  jsonLd?: JsonLd;       // Schema.org JSON-LD
}

/**
 * SEO per-route. React 19 otomatis menghoist <title>/<meta>/<link> ke <head>.
 * Canonical dibangun dari SITE_URL + pathname aktif (URL management).
 */
export default function Seo({ title, description, image, type = 'website', noindex, bareOnHome, jsonLd }: SeoProps) {
  const { pathname } = useLocation();
  const canonical = SITE_URL + (pathname === '/' ? '/' : pathname.replace(/\/+$/, ''));
  const { settings } = useSiteSettings();
  // Child panel: judul memakai brand panel & halaman tidak diindeks (hindari konten duplikat web utama).
  const brand = IS_CHILD_PANEL ? `${settings.brandName}${settings.brandSuffix}` : SITE_NAME;
  const fullTitle = title ? `${title} · ${brand}` : IS_CHILD_PANEL ? brand : DEFAULT_TITLE;
  noindex = noindex || IS_CHILD_PANEL;
  const desc = description || DEFAULT_DESC;
  const img = abs(image || DEFAULT_OG_IMAGE);

  // index.html / HTML prerender membawa tag SEO statis (data-seo-static) untuk crawler tanpa JS.
  // Setelah React jalan, tag milik React yang dipakai -> hapus duplikat statis agar
  // <title>/description per halaman benar-benar berlaku (browser memakai <title> pertama).
  useEffect(() => {
    document.head.querySelectorAll('[data-seo-static]').forEach((el) => {
      const isSocial = /^(og:|twitter:)/.test(el.getAttribute('property') || el.getAttribute('name') || '');
      if (bareOnHome && isSocial) return; // homepage memakai OG statis
      el.remove();
    });
  }, [bareOnHome, pathname]);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />
      {noindex
        ? <meta name="robots" content="noindex,nofollow" />
        : <meta name="robots" content="index,follow,max-image-preview:large" />}

      {!bareOnHome && (
        <>
          <meta property="og:type" content={type} />
          <meta property="og:site_name" content={SITE_NAME} />
          <meta property="og:locale" content="id_ID" />
          <meta property="og:url" content={canonical} />
          <meta property="og:title" content={fullTitle} />
          <meta property="og:description" content={desc} />
          <meta property="og:image" content={img} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={fullTitle} />
          <meta name="twitter:description" content={desc} />
          <meta name="twitter:image" content={img} />
        </>
      )}

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
    </>
  );
}
