import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, MapPin, Layers, CircleAlert, RefreshCw } from 'lucide-react';
import { fetchServices, formatRate, type ServiceItem } from '../services/servicesApi';
import { useAuth } from '../context/AuthContext';

/** Key sessionStorage untuk melanjutkan step order sesudah login Google. */
export const PENDING_ORDER_PATH_KEY = 'by_pending_order_path';
/** Event pembuka modal login (didengarkan HomePage yang memiliki AuthModal). */
export const OPEN_LOGIN_EVENT = 'by-open-login';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Dua kolom "Kategori" dan "Layanan" Google Maps Review dari Server 3 (Medanpedia),
 * ditampilkan di dashboard tepat di bawah gambar Top Service dan sebelum video player.
 * Kolom selalu tampil: skeleton saat memuat, pesan error jelas + tombol coba lagi bila
 * API gagal, dan pesan informatif bila katalog belum punya kategori GM Review.
 * Tombol keranjang memakai gaya yang sama dengan modal Layanan Rekomendasi di Overview;
 * tamu diarahkan ke modal login dulu, lalu step order dilanjutkan otomatis setelah login.
 */
export default function GoogleMapsReviewColumns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setState('loading');
    setError('');
    fetchServices(3).then((result) => {
      if (!alive) return;
      if (!result.ok) {
        setError(result.message || 'Gagal memuat data Google Maps Review dari Server 3.');
        setState('error');
        return;
      }
      setServices(result.services);
      setCategories(result.categories?.length ? result.categories : Array.from(new Set(result.services.map((s) => s.category))));
      setState('ready');
    });
    return () => { alive = false; };
  }, [reload]);

  const handleCart = (service: ServiceItem) => {
    const path = `/layanan?server=3&service=${encodeURIComponent(service.id)}`;
    if (!user) {
      try { sessionStorage.setItem(PENDING_ORDER_PATH_KEY, path); } catch { /* privat mode */ }
      window.dispatchEvent(new CustomEvent(OPEN_LOGIN_EVENT));
      return;
    }
    navigate(path);
  };

  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {state === 'error' ? (
        <div role="alert" className="sm:col-span-2 flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800/50 dark:bg-rose-950/20 sm:flex-row sm:items-center">
          <CircleAlert className="h-5 w-5 shrink-0 text-rose-500" strokeWidth={2.2} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">Kolom Google Maps Review gagal dimuat.</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-rose-600/90 dark:text-rose-400/90">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setReload((n) => n + 1)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-2 text-[12px] font-bold text-white transition-colors hover:bg-rose-600 active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={2.4} />
            Coba Lagi
          </button>
        </div>
      ) : (
        <>
          <section aria-label="Kategori Google Maps Review" className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/60">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              <Layers className="h-4 w-4 text-cyan-500" strokeWidth={2.2} />
              Kategori
            </h3>
            {state === 'loading' ? (
              <div role="status" aria-label="Memuat kategori" className="mt-3 space-y-2">
                <div className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="h-9 w-2/3 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
            ) : categories.length === 0 ? (
              <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">Kategori Google Maps Review belum tersedia di Server 3.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {categories.map((c) => (
                  <li key={c} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-800 dark:bg-slate-800/70 dark:text-slate-100">
                    <MapPin className="h-4 w-4 shrink-0 text-rose-500" strokeWidth={2.2} />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Layanan Google Maps Review" className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700/70 dark:bg-slate-900/60">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
              <ShoppingCart className="h-4 w-4 text-emerald-500" strokeWidth={2.2} />
              Layanan
            </h3>
            {state === 'loading' ? (
              <div role="status" aria-label="Memuat layanan" className="mt-3 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 flex-1 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                    <div className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
                  </div>
                ))}
              </div>
            ) : services.length === 0 ? (
              <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">Layanan Google Maps Review belum tersedia di Server 3.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {services.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100">{s.name}</span>
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                        {formatRate(s.rate, Boolean(user?.plusActive))} / 1rb · min {s.min ?? '—'} – max {s.max ?? '—'}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCart(s)}
                      aria-label={`Pesan ${s.name}`}
                      title="Pesan layanan ini"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white transition-colors hover:bg-emerald-600 active:scale-95"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
