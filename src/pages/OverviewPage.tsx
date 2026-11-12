import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, ChevronUp, ShoppingCart, Wallet, Newspaper } from 'lucide-react';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { useOrderHistory } from '../context/OrderHistoryContext';
import { useSiteSettings, type InfoItem } from '../context/SiteSettingsContext';
import { fetchServices, type ServiceItem } from '../services/servicesApi';

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

/** Platform yang ditampilkan di Layanan Rekomendasi (urut sesuai tampilan). */
const PLATFORMS: { key: string; test: RegExp }[] = [
  { key: 'whatsapp', test: /whats\s*app/i },
  { key: 'tiktok', test: /tik\s*tok/i },
  { key: 'instagram', test: /insta\s*gram/i },
];
const PER_PLATFORM = 5;
const NEWS_INITIAL = 5;

/** Ubah URL di teks berita jadi tautan yang bisa diklik. */
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline dark:text-cyan-400">
            {p}
          </a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders } = useOrderHistory();
  const { settings } = useSiteSettings();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [showAllNews, setShowAllNews] = useState(false);

  // Data layanan dari API yang sama dengan halaman Buat Pesanan.
  // fetchServices() sudah menerapkan filter emoji reaction WhatsApp (😢🤬😥😭😡).
  useEffect(() => {
    let alive = true;
    fetchServices().then((r) => {
      if (!alive) return;
      if (r.ok) setServices(r.services);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const rekomendasi = useMemo(() => {
    const out: ServiceItem[] = [];
    for (const p of PLATFORMS) {
      const list = services.filter((s) => p.test.test(s.category) || (!s.category && p.test.test(s.name)));
      out.push(...list.slice(0, PER_PLATFORM));
    }
    return out;
  }, [services]);

  const pesananBulanIni = useMemo(() => {
    const now = new Date();
    return orders
      .filter((o) => {
        const d = new Date(o.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && o.status !== 'batal';
      })
      .reduce((sum, o) => sum + (o.price || 0), 0);
  }, [orders]);

  // Berita: kartu info Overview (diatur admin) disematkan paling atas + berita admin lainnya.
  const news: InfoItem[] = useMemo(() => {
    const pinned: InfoItem[] = settings.overviewTitle
      ? [
          {
            id: -1,
            tag: 'Info',
            title: settings.overviewTitle,
            desc: [settings.overviewSubtitle, settings.overviewMessage].filter(Boolean).join('\n\n'),
            time: '',
          },
        ]
      : [];
    return [...pinned, ...settings.infoItems];
  }, [settings]);
  const visibleNews = showAllNews ? news : news.slice(0, NEWS_INITIAL);

  const card = 'rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-800 dark:bg-slate-900';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6">
      <Seo title="Overview" description="Ringkasan akun Boosteryuk: saldo, pesanan bulan ini, layanan rekomendasi, dan berita." noindex />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
        {/* ===== Saldo & pesanan bulan ini (mobile: paling atas) ===== */}
        <div className="grid grid-cols-2 gap-4 lg:col-start-2 lg:row-start-1">
          {[
            { label: 'Sisa Saldo Anda', value: rupiah(user?.balance ?? 0), icon: Wallet },
            { label: 'Pesanan Anda Bulan Ini', value: rupiah(pesananBulanIni), icon: ShoppingCart },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className={`${card} flex items-center gap-3 p-4`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-white">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11.5px] leading-tight text-slate-400 dark:text-slate-500">{s.label}</p>
                  <p className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{s.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== Layanan Rekomendasi ===== */}
        <section className={`${card} overflow-hidden lg:col-start-1 lg:row-span-2 lg:row-start-1`}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between border-b border-slate-100 bg-cyan-50/60 px-4 py-3 text-left dark:border-slate-800 dark:bg-cyan-950/20"
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold text-cyan-700 dark:text-cyan-400">
              <ThumbsUp className="h-4 w-4" strokeWidth={2.2} />
              Layanan Rekomendasi
            </span>
            <ChevronUp className={`h-4 w-4 text-slate-400 transition-transform ${open ? '' : 'rotate-180'}`} />
          </button>

          {open && (
            <ol className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="h-3 w-6 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <span className="h-3 flex-1 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <span className="h-7 w-7 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
                  </li>
                ))}

              {!loading && rekomendasi.length === 0 && (
                <li className="px-4 py-8 text-center text-[13px] text-slate-400">Layanan belum tersedia.</li>
              )}

              {!loading &&
                rekomendasi.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-7 shrink-0 text-[12px] text-slate-400">#{i + 1}</span>
                    <span className="min-w-0 flex-1 text-[13px] leading-snug text-slate-700 dark:text-slate-200">{s.name}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/layanan?service=${encodeURIComponent(s.id)}`)}
                      aria-label={`Pesan ${s.name}`}
                      title="Pesan layanan ini"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white transition-colors hover:bg-emerald-600 active:scale-95"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </button>
                  </li>
                ))}
            </ol>
          )}
        </section>

        {/* ===== Berita ===== */}
        <section className={`${card} p-4 lg:col-start-2 lg:row-start-2`}>
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
            <Newspaper className="h-4 w-4 text-slate-500" strokeWidth={2.2} />
            Berita
          </h2>

          <div className="space-y-3">
            {visibleNews.map((n) => (
              <article key={n.id} className="rounded-lg border border-slate-200/80 p-4 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-cyan-500 px-2 py-0.5 text-[10px] font-semibold text-white">{n.tag || 'Info'}</span>
                  {n.time && <span className="text-[11px] text-slate-400">{n.time}</span>}
                </div>
                <h3 className="mt-2 text-[14px] font-semibold text-slate-800 dark:text-slate-100">{n.title}</h3>
                {n.image && <img src={n.image} alt="" className="mt-2 max-h-56 rounded-lg object-cover" loading="lazy" />}
                <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                  <Linkify text={n.desc} />
                </p>
              </article>
            ))}
          </div>

          {news.length > NEWS_INITIAL && (
            <button
              type="button"
              onClick={() => setShowAllNews((v) => !v)}
              className="mt-4 h-9 w-full rounded-lg bg-cyan-500 text-[12.5px] font-semibold text-white transition-colors hover:bg-cyan-600"
            >
              {showAllNews ? 'Tampilkan lebih sedikit' : 'Tampilkan lebih banyak'}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
