// Data & utilitas artikel (sumber: src/content/articles.json — juga dipakai scripts/seo-pages.mjs).
import data from '../content/articles.json';
import { SITE_URL, SITE_NAME, abs } from '../seo/config';

export type Block =
  | { t: 'p' | 'note'; x: string }
  | { t: 'h2' | 'h3'; x: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'cta'; title: string; x: string; href: string; label: string };

export interface Faq { q: string; a: string }
export interface Article {
  slug: string;
  category: string;
  title: string;
  seoTitle: string;
  description: string;
  excerpt: string;
  thumbnail: string;
  thumbAlt: string;
  published: string;
  updated: string;
  blocks: Block[];
  faq?: Faq[];
  related?: string[];
}
export interface Author { name: string; role: string; url: string }

export const AUTHOR = data.author as Author;
export const ARTICLES = data.articles as Article[];
export const getArticle = (slug: string | undefined) => ARTICLES.find((a) => a.slug === slug);

/** id anchor dari teks heading (sama dengan scripts/seo-pages.mjs). */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Teks polos (tanpa markup inline) — untuk hitung kata & schema. */
export const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1');

export interface TocItem { id: string; text: string; level: 2 | 3 }
export function tocOf(a: Article): TocItem[] {
  const toc: TocItem[] = [];
  for (const b of a.blocks) if (b.t === 'h2' || b.t === 'h3') toc.push({ id: slugify(b.x), text: plain(b.x), level: b.t === 'h2' ? 2 : 3 });
  if (a.faq?.length) toc.push({ id: 'faq', text: 'Pertanyaan yang sering diajukan', level: 2 });
  return toc;
}

export function readingMinutes(a: Article): number {
  const parts: string[] = [];
  for (const b of a.blocks) {
    if ('x' in b) parts.push(b.x);
    if ('items' in b) parts.push(...b.items);
    if ('rows' in b) parts.push(...b.rows.flat());
  }
  for (const f of a.faq || []) parts.push(f.q, f.a);
  const words = plain(parts.join(' ')).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200)); // ±200 kata/menit untuk teks bahasa Indonesia
}

export const tanggal = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso + 'T00:00:00'));

/** Schema.org: Article + BreadcrumbList (+ FAQPage bila ada). */
export function articleJsonLd(a: Article) {
  const url = `${SITE_URL}/artikel/${a.slug}`;
  const ld: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: a.title,
      description: a.description,
      image: [abs(a.thumbnail)],
      datePublished: a.published,
      dateModified: a.updated,
      inLanguage: 'id-ID',
      articleSection: a.category,
      author: { '@type': 'Organization', name: AUTHOR.name, url: abs(AUTHOR.url) },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: { '@type': 'ImageObject', url: abs('/favicon.png') } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Beranda', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Artikel', item: SITE_URL + '/artikel' },
        { '@type': 'ListItem', position: 3, name: a.title, item: url },
      ],
    },
  ];
  if (a.faq?.length) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: a.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  return ld;
}
