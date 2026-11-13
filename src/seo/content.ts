// Konten SEO unik per halaman (sumber: ./pages.json — juga dipakai sitemap & prerender).
import pages from './pages.json';

export interface SeoFaq {
  q: string;
  a: string;
}
export interface SeoContent {
  title: string;
  description: string;
  h1?: string;
  intro?: string[];
  faq?: SeoFaq[];
  updated: string;
}

export function staticSeo(path: string): SeoContent | undefined {
  return (pages.static as (SeoContent & { path: string })[]).find((p) => p.path === path);
}

export function categorySeo(slug: string | undefined): SeoContent | undefined {
  if (!slug) return undefined;
  return (pages.categories as Record<string, SeoContent>)[slug];
}

/** JSON-LD FAQPage dari daftar tanya-jawab (tampil juga sebagai teks di halaman). */
export function faqJsonLd(faq: SeoFaq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}
