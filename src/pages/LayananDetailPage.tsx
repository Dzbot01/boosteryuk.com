import Seo from '../components/Seo';
import { SITE_URL } from '../seo/config';
import { categorySeo, faqJsonLd } from '../seo/content';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  AlertCircle,
  RefreshCw,
  PackageSearch,
  RotateCcw,
  Ban,
  Tag,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import { findCategory } from '../constants';
import { useAuth } from '../context/AuthContext';
import {
  fetchServices,
  filterByCategory,
  formatQty,
  formatRate,
  groupByCategory,
  type ServiceItem,
} from '../services/servicesApi';

export default function LayananDetailPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { platform } = useParams<{ platform: string }>();
  const category = findCategory(platform);
  const seo = categorySeo(category?.slug);

  const [all, setAll] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const res = await fetchServices();
    if (res.ok) {
      setAll(res.services);
    } else {
      setError(res.message);
      setAll([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);

  // Only the services belonging to this platform.
  const scoped = useMemo(
    () => (category ? filterByCategory(all, category) : []),
    [all, category],
  );

  // Extra free-text search inside the platform.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scoped;
    return scoped.filter((s) =>
      `${s.name} ${s.category} ${s.id}`.toLowerCase().includes(q),
    );
  }, [scoped, query]);

  const groups = useMemo(() => Array.from(groupByCategory(visible)), [visible]);

  if (!category) return <Navigate to="/layanan" replace />;

  return (
    <div className="page-align-left mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6">
      <Seo
        title={seo?.title || `Layanan ${category.name}`}
        description={seo?.description || `Beli layanan ${category.name} di Boosteryuk — followers, likes, views & engagement ${category.name}.`}
        jsonLd={[
          { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Beranda', item: SITE_URL + '/' },
            { '@type': 'ListItem', position: 2, name: 'Layanan', item: SITE_URL + '/layanan' },
            { '@type': 'ListItem', position: 3, name: category.name, item: SITE_URL + '/layanan/' + category.slug },
          ] },
          { '@context': 'https://schema.org', '@type': 'Service', name: `Layanan ${category.name}`, description: seo?.description, serviceType: `SMM ${category.name}`, areaServed: 'ID', provider: { '@type': 'Organization', name: 'Boosteryuk', url: SITE_URL } },
          ...(seo?.faq?.length ? [faqJsonLd(seo.faq)] : []),
        ]}
      />
      <Reveal>
        <button
          onClick={() => navigate('/layanan')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Semua Layanan
        </button>
      </Reveal>

      {/* ---------- Platform banner ---------- */}
      <Reveal delay={40}>
        <div
          className="relative overflow-hidden rounded-[28px] p-6 shadow-[0_22px_50px_-26px_rgba(15,23,42,0.6)] sm:p-7"
          style={{ background: category.gradient }}
        >
          <div className="bg-dots absolute inset-0 opacity-[0.18]" />
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />

          <div className="relative flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/18 ring-1 ring-white/25 backdrop-blur-sm">
              <img
                src={category.logo}
                alt={category.name}
                className={`h-8 w-8 object-contain ${category.invert ? 'brightness-0 invert' : ''}`}
              />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight text-white sm:text-[32px]">
                {category.name}
              </h1>
              <p className="mt-2 text-[12.5px] font-medium text-white/80">
                {loading
                  ? 'Memuat daftar layanan…'
                  : `${scoped.length} layanan tersedia`}
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------- Search ---------- */}
      {!loading && !error && scoped.length > 0 && (
        <Reveal delay={70}>
          <div className="relative mt-5">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Cari layanan ${category.name}…`}
              className="h-[50px] w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[14px] text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white dark:placeholder-slate-500"
            />
          </div>
        </Reveal>
      )}

      {/* ---------- Loading ---------- */}
      {loading && (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[92px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700/60 dark:bg-slate-800/60"
            />
          ))}
        </div>
      )}

      {/* ---------- Error ---------- */}
      {error && !loading && (
        <div className="mt-5 flex flex-col items-start gap-4 rounded-[28px] border border-rose-200 bg-rose-50/70 p-6 dark:border-rose-800/40 dark:bg-rose-950/20 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
            <AlertCircle className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-extrabold text-rose-800 dark:text-rose-300">
              Gagal memuat layanan
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-rose-700/85 dark:text-rose-400/85">
              {error}
            </p>
          </div>
          <button
            onClick={load}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-[13px] font-bold text-rose-700 transition-all hover:bg-rose-100 active:scale-95 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
            Coba lagi
          </button>
        </div>
      )}

      {/* ---------- Empty ---------- */}
      {!loading && !error && visible.length === 0 && (
        <div className="mt-5 flex flex-col items-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center dark:border-slate-700/60 dark:bg-slate-800/30">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-slate-300 shadow-sm ring-1 ring-slate-100 dark:bg-slate-800 dark:text-slate-600 dark:ring-slate-700">
            <PackageSearch className="h-8 w-8" strokeWidth={1.6} />
          </span>
          <p className="mt-5 font-display text-lg font-extrabold text-slate-900 dark:text-white">
            {query ? 'Tidak ada hasil' : `Layanan ${category.name} belum tersedia`}
          </p>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
            {query
              ? 'Coba kata kunci lain atau kosongkan pencarian.'
              : 'Silakan cek kembali nanti atau pilih platform lain.'}
          </p>
          {query && (
            <button
              onClick={() => setQuery('')}
              className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reset pencarian
            </button>
          )}
        </div>
      )}

      {/* ---------- Service list ---------- */}
      {!loading && !error && visible.length > 0 && (
        <div className="mt-6 space-y-8">
          {groups.map(([groupName, items]) => (
            <section key={groupName}>
              <div className="mb-3 flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" strokeWidth={2.4} />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  {groupName}
                </h2>
                <span className="text-[11px] font-bold text-slate-300 dark:text-slate-600">
                  ({items.length})
                </span>
              </div>

              <div className="space-y-2.5">
                {items.map((s) => (
                  <article
                    key={`${s.id}-${s.name}`}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-900/5 dark:border-slate-700/60 dark:bg-slate-800/60 dark:hover:border-cyan-700/60 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                            #{s.id}
                          </span>
                          {s.refill && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/50">
                              <RotateCcw className="h-2.5 w-2.5" strokeWidth={2.8} />
                              Refill
                            </span>
                          )}
                          {s.cancel && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/50">
                              <Ban className="h-2.5 w-2.5" strokeWidth={2.8} />
                              Cancel
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1.5 text-[13.5px] font-bold leading-snug text-slate-900 dark:text-white">
                          {s.name}
                        </h3>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-display text-[17px] font-extrabold leading-none text-cyan-700 dark:text-cyan-400">
                          {formatRate(s.rate, user?.plusActive)}
                        </p>
                        <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          / 1000
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-700/50">
                      <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                        Min {formatQty(s.min)}
                      </span>
                      <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                        Max {formatQty(s.max)}
                      </span>
                      {s.type && s.type.toLowerCase() !== 'default' && (
                        <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">
                          {s.type}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ---------- Tentang layanan (teks unik per platform untuk pengguna & SEO) ---------- */}
      {seo && (
        <section aria-labelledby="tentang-layanan" className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700/60 dark:bg-slate-800/60 sm:p-6">
          <h2 id="tentang-layanan" className="text-[17px] font-bold text-slate-900 dark:text-white">
            Tentang Layanan {category.name}
          </h2>
          {seo.intro?.map((p, i) => (
            <p key={i} className="mt-2.5 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
              {p}
            </p>
          ))}
          {seo.faq && seo.faq.length > 0 && (
            <>
              <h3 className="mt-5 text-[14px] font-bold text-slate-900 dark:text-white">Pertanyaan Umum</h3>
              <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-700/60">
                {seo.faq.map((f) => (
                  <details key={f.q} className="group py-2.5">
                    <summary className="cursor-pointer list-none text-[13.5px] font-semibold text-slate-800 marker:hidden dark:text-slate-100">
                      <span className="mr-1.5 inline-block text-slate-400 transition-transform group-open:rotate-90">›</span>
                      {f.q}
                    </summary>
                    <p className="mt-1.5 pl-4 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{f.a}</p>
                  </details>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
