import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Seo from '../../components/Seo';
import {
  ARTICLES, AUTHOR, articleJsonLd, getArticle, readingMinutes, slugify, tanggal, tocOf, type Block, type TocItem,
} from '../../lib/articles';
import { ArticleCard, ArticleFonts, Inline, Monogram } from './ArticleParts';

function TocList({ toc, active, onPick }: { toc: TocItem[]; active: string; onPick?: () => void }) {
  return (
    <ol>
      {toc.map((t) => (
        <li key={t.id} className={t.level === 3 ? 'lv3' : undefined}>
          <a href={`#${t.id}`} aria-current={active === t.id ? 'true' : undefined} onClick={onPick}>
            {t.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'p':
      return <p><Inline text={b.x} /></p>;
    case 'h2':
    case 'h3': {
      const id = slugify(b.x);
      const H = b.t;
      return (
        <H id={id}>
          <Inline text={b.x} />
          <a className="bk-anchor" href={`#${id}`} aria-label="Tautan ke bagian ini">#</a>
        </H>
      );
    }
    case 'ul':
      return <ul>{b.items.map((x, i) => <li key={i}><Inline text={x} /></li>)}</ul>;
    case 'ol':
      return <ol>{b.items.map((x, i) => <li key={i}><Inline text={x} /></li>)}</ol>;
    case 'note':
      return (
        <aside className="bk-note">
          <b>Catatan</b>
          <Inline text={b.x} />
        </aside>
      );
    case 'table':
      return (
        <div className="bk-table" role="region" aria-label="Tabel" tabIndex={0}>
          <table>
            <thead><tr>{b.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'cta':
      return (
        <section className="bk-cta" aria-label={b.title}>
          <h4>{b.title}</h4>
          <p>{b.x}</p>
          <Link className="bk-btn" to={b.href}>{b.label} →</Link>
        </section>
      );
  }
}

export default function ArtikelPage() {
  const { slug } = useParams();
  const a = getArticle(slug);
  const toc = useMemo(() => (a ? tocOf(a) : []), [a]);
  const [active, setActive] = useState('');
  const [copied, setCopied] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

  // Daftar isi aktif mengikuti bagian yang sedang dibaca.
  useEffect(() => {
    if (!toc.length) return;
    const els = toc.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [toc]);

  // Indikator progres membaca (tipis di atas layar).
  useEffect(() => {
    const onScroll = () => {
      const el = body.current;
      if (!el || !bar.current) return;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      bar.current.style.transform = `scaleX(${p})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [slug]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!a) return <Navigate to="/artikel" replace />;

  const minutes = readingMinutes(a);
  const related = (a.related || []).map((s) => ARTICLES.find((x) => x.slug === s)).filter(Boolean).slice(0, 3) as typeof ARTICLES;
  const share = async () => {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) await navigator.share({ title: a.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* dibatalkan pengguna */
    }
  };

  return (
    <div className="bk-art">
      <Seo title={a.seoTitle} description={a.description} image={a.thumbnail} type="article" jsonLd={articleJsonLd(a)} />
      <ArticleFonts />
      <meta property="article:published_time" content={a.published} />
      <meta property="article:modified_time" content={a.updated} />
      <meta property="article:section" content={a.category} />
      <div ref={bar} className="bk-progress" style={{ width: '100%', transform: 'scaleX(0)' }} aria-hidden="true" />

      <div className="bk-wrap">
       <div className="bk-frame">
        <nav className="bk-crumbs bk-indent" aria-label="Breadcrumb">
          <ol>
            <li><Link to="/">Beranda</Link></li>
            <li><Link to="/artikel">Artikel</Link></li>
            <li aria-current="page">{a.category}</li>
          </ol>
        </nav>

        <article>
          <header className="bk-head bk-indent">
            <p className="bk-kicker">{a.category}</p>
            <h1 className="bk-h1">{a.title}</h1>
            <p className="bk-dek">{a.excerpt}</p>
            <div className="bk-byline">
              <Monogram name={AUTHOR.name} />
              <div>
                Oleh <strong><Link to={AUTHOR.url} style={{ color: 'inherit', textDecoration: 'none' }}>{AUTHOR.name}</Link></strong>
                <span className="bk-meta">
                  <time dateTime={a.published}>{tanggal(a.published)}</time>
                  {a.updated !== a.published && <> · Diperbarui <time dateTime={a.updated}>{tanggal(a.updated)}</time></>}
                  {' · '}{minutes} menit baca
                </span>
              </div>
              <div className="bk-share">
                <button type="button" className="bk-btn-ghost" onClick={() => void share()}>{copied ? 'Link disalin' : 'Bagikan'}</button>
              </div>
            </div>
          </header>

          <figure className="bk-figure">
            <img src={a.thumbnail} alt={a.thumbAlt} width={1200} height={630} fetchPriority="high" decoding="async" />
            <figcaption>{a.thumbAlt}. Ilustrasi: Boosteryuk.</figcaption>
          </figure>

          <div className="bk-body">
            <nav className="bk-toc bk-toc-side" aria-label="Daftar isi">
              <p className="bk-toc-title">Daftar isi</p>
              <TocList toc={toc} active={active} />
            </nav>

            <div ref={body} className="bk-prose">
              <details className="bk-toc bk-toc-inline">
                <summary>Daftar isi</summary>
                <TocList toc={toc} active={active} onPick={() => document.querySelector<HTMLDetailsElement>('.bk-toc-inline')?.removeAttribute('open')} />
              </details>

              {a.blocks.map((b, i) => <BlockView key={i} b={b} />)}

              {a.faq?.length ? (
                <>
                  <h2 id="faq">Pertanyaan yang sering diajukan</h2>
                  <div className="bk-faq">
                    {a.faq.map((f) => (
                      <details key={f.q}>
                        <summary>{f.q}</summary>
                        <p>{f.a}</p>
                      </details>
                    ))}
                  </div>
                </>
              ) : null}

              <section className="bk-author" aria-label="Tentang penulis">
                <Monogram name={AUTHOR.name} />
                <div>
                  <p className="who">Penulis</p>
                  <p className="name">{AUTHOR.name}</p>
                  <p>{AUTHOR.role}</p>
                </div>
              </section>
              <p className="bk-dates">
                Terbit <time dateTime={a.published}>{tanggal(a.published)}</time>
                {' · '}Terakhir diperbarui <time dateTime={a.updated}>{tanggal(a.updated)}</time>
              </p>
            </div>
          </div>
        </article>
       </div>
      </div>

      {related.length > 0 && (
        <aside className="bk-related" aria-labelledby="bk-related-h">
          <div className="bk-wrap">
            <h2 id="bk-related-h">Baca juga</h2>
            <div className="bk-grid">
              {related.map((r) => <ArticleCard key={r.slug} a={r} />)}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
