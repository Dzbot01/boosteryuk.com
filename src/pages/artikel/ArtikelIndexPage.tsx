import { Link } from 'react-router-dom';
import Seo from '../../components/Seo';
import { ARTICLES, readingMinutes, tanggal } from '../../lib/articles';
import { SITE_URL } from '../../seo/config';
import { ArticleCard, ArticleFonts } from './ArticleParts';

const TITLE = 'Artikel & Panduan SMM Panel, Media Sosial, dan Agen AI';
const DESC =
  'Kumpulan artikel Boosteryuk: panduan SMM panel, cara menumbuhkan akun TikTok, child panel untuk reseller, dasar VPS, dan agen AI WhatsApp — ditulis dari pengalaman operasional.';

export default function ArtikelIndexPage() {
  const sorted = [...ARTICLES].sort((a, b) => (a.published < b.published ? 1 : a.published > b.published ? -1 : 0));
  // Artikel utama: "Apa itu SMM Panel" (prioritas), sisanya urut terbaru.
  const lead = sorted.find((a) => a.slug === 'apa-itu-smm-panel') || sorted[0];
  const rest = sorted.filter((a) => a !== lead);
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: TITLE,
      description: DESC,
      url: SITE_URL + '/artikel',
      hasPart: sorted.map((a) => ({ '@type': 'Article', headline: a.title, url: `${SITE_URL}/artikel/${a.slug}`, datePublished: a.published })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Beranda', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Artikel', item: SITE_URL + '/artikel' },
      ],
    },
  ];

  return (
    <div className="bk-art">
      <Seo title={TITLE} description={DESC} image={lead.thumbnail} jsonLd={jsonLd} />
      <ArticleFonts />
      <div className="bk-wrap">
        <nav className="bk-crumbs" aria-label="Breadcrumb">
          <ol>
            <li><Link to="/">Beranda</Link></li>
            <li aria-current="page">Artikel</li>
          </ol>
        </nav>
        <header className="bk-index-head">
          <h1>Artikel &amp; Panduan</h1>
          <p>Penjelasan praktis seputar SMM panel, pertumbuhan media sosial, bisnis reseller, server, dan agen AI — ditulis oleh tim yang menjalankan layanannya setiap hari.</p>
        </header>

        <section className="bk-lead" aria-label="Artikel utama">
          <Link to={`/artikel/${lead.slug}`} className="bk-card" tabIndex={-1} aria-hidden="true">
            <img src={lead.thumbnail} alt="" width={1200} height={630} fetchPriority="high" />
          </Link>
          <div className="bk-card">
            <p className="k" style={{ marginTop: 0 }}>{lead.category}</p>
            <h2><Link to={`/artikel/${lead.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{lead.title}</Link></h2>
            <p>{lead.excerpt}</p>
            <p className="m">
              <time dateTime={lead.published}>{tanggal(lead.published)}</time> · {readingMinutes(lead)} menit baca
            </p>
          </div>
        </section>

        <section className="bk-list" aria-label="Semua artikel">
          <div className="bk-grid two">
            {rest.map((a) => <ArticleCard key={a.slug} a={a} headingLevel={2} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
