import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { type Article, readingMinutes, tanggal } from '../../lib/articles';
import './artikel.css';

/** Font khusus artikel — hanya dimuat di halaman artikel (React 19 menghoist <link> ke <head>). */
export function ArticleFonts() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&display=swap"
        precedence="default"
      />
    </>
  );
}

/** Inline: [teks](/url) dan **tebal**. Link internal memakai <Link>, eksternal membuka tab baru. */
export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[3]) out.push(<strong key={k++}>{m[3]}</strong>);
    else if (m[2].startsWith('/')) out.push(<Link key={k++} to={m[2]}>{m[1]}</Link>);
    else out.push(<a key={k++} href={m[2]} target="_blank" rel="noopener noreferrer">{m[1]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>;
}

/** Monogram penulis (inisial), bukan avatar generik. */
export function Monogram({ name }: { name: string }) {
  const ini = name.replace(/^Tim\s+/i, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return <span className="bk-mono" aria-hidden="true">{ini}</span>;
}

export function ArticleCard({ a, headingLevel = 3, eager = false }: { a: Article; headingLevel?: 2 | 3; eager?: boolean }) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Link to={`/artikel/${a.slug}`} className="bk-card">
      <img src={a.thumbnail} alt={a.thumbAlt} width={1200} height={630} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      <p className="k">{a.category}</p>
      <H>{a.title}</H>
      <p>{a.excerpt}</p>
      <p className="m">
        <time dateTime={a.published}>{tanggal(a.published)}</time> · {readingMinutes(a)} menit baca
      </p>
    </Link>
  );
}
