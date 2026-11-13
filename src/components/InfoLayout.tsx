import Seo from './Seo';
import { useLocation } from 'react-router-dom';
import { staticSeo } from '../seo/content';
import type { ReactNode } from 'react';

import { Info } from 'lucide-react';
import Reveal from './Reveal';

/**
 * Layout bersama untuk halaman informasi:
 * Privasi, Tentang Kami, Syarat & Ketentuan, dan Kontak Support.
 */
export function InfoLayout({
  title,
  intro,
  icon: Icon,
  children,
}: {
  title: string;
  intro: string;
  icon: typeof Info;
  children: ReactNode;
}) {
  // Judul & deskripsi unik dari src/seo/pages.json (sama dengan sitemap/prerender) bila ada.
  const seo = staticSeo(useLocation().pathname);

  return (
    <main className="page-align-left mx-auto max-w-3xl px-4 pb-24 pt-8 sm:px-6">
      <Seo title={seo?.title || title} description={seo?.description || intro} />

      <Reveal delay={30}>
        <header className="border-b border-slate-200 pb-6 dark:border-slate-700">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
            <Icon className="h-5 w-5" strokeWidth={2.3} />
          </span>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">{title}</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">{intro}</p>
        </header>
      </Reveal>

      <Reveal delay={70}>
        <article className="mt-7 space-y-7">{children}</article>
      </Reveal>
    </main>
  );
}

/** Seksi teks sederhana untuk konten halaman informasi. */
export function TextSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
      <div className="mt-2 space-y-2 text-[13px] leading-7 text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}
