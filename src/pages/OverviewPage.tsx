import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThumbsUp, ChevronUp, ChevronRight, ShoppingCart, Wallet, Newspaper, Server, Bot, BellRing, X } from 'lucide-react';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings, type InfoItem } from '../context/SiteSettingsContext';
import { fetchServices, type ServiceItem } from '../services/servicesApi';
import { MAIN_API } from '../lib/apiBase';

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);

/** Platform yang ditampilkan di Layanan Rekomendasi (urut sesuai tampilan). */
const PLATFORMS: { key: string; test: RegExp }[] = [
  { key: 'whatsapp', test: /whats\s*app/i },
  { key: 'tiktok', test: /tik\s*tok/i },
  { key: 'instagram', test: /insta\s*gram/i },
];
const PER_PLATFORM = 5;
/** Statistik per user dihitung server dari tabel riwayat_pesanan (kolom jatuh_tempo dll). */
const STATS_API = `${MAIN_API}/order_stats.php`;
/** Cadangan: sumber riwayat yang sama dengan halaman Riwayat Pesanan. */
const RIWAYAT_API = 'https://cekidku.my.id/api/riwayat_pesanan.php';

interface OverviewStats {
  bulanIni: number;
  vps: number;
  agen: number;
  /** Agen AI yang jatuh tempo ≤ 7 hari lagi (pengingat di Overview). */
  segera?: { orderId: string; nama: string; hari: number }[];
}

const REMINDER_DAYS = 7;

interface RiwayatRow {
  order_id: string;
  service_name: string;
  quantity: number | string;
  price: number | string;
  status: 'pending' | 'proses' | 'selesai' | 'batal' | string;
  created_at: number | string;
}

const BULAN_PENDEK: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6,
  agu: 7, agt: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
};

/** Ambil tanggal "Jatuh tempo 12 Des 2026" dari nama layanan (null bila tidak ada). */
function dueDateOf(name: string): Date | null {
  const m = name.match(/Jatuh\s*tempo\s+(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/i);
  if (!m) return null;
  const mon = BULAN_PENDEK[m[2].slice(0, 3).toLowerCase()];
  if (mon === undefined) return null;
  return new Date(Number(m[3]), mon, Number(m[1]), 23, 59, 59);
}
/** Hitung statistik dari baris riwayat_pesanan (cadangan bila order_stats.php belum ada). */
function statsFromRows(rows: RiwayatRow[]): OverviewStats {
  const now = new Date();
  let bulanIni = 0;
  let vps = 0;
  let agen = 0;
  for (const r of rows) {
    if (String(r.status) === 'batal') continue;
    const at = new Date(Number(r.created_at) || 0);
    if (at.getMonth() === now.getMonth() && at.getFullYear() === now.getFullYear()) bulanIni += Number(r.price) || 0;
    const n = (r.service_name || '').toLowerCase();
    const due = dueDateOf(r.service_name || '');
    const aktif = !due || due.getTime() >= now.getTime();
    if (n.includes('agen ai') || n.includes('ai agent')) {
      if (aktif) agen += 1;
    } else if (/\bvps\b|server vps/.test(n) && aktif) {
      vps += 1;
    }
  }
  return { bulanIni, vps, agen };
}

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
  // null = sedang dimuat. Selalu milik user yang login (bukan riwayat lokal browser).
  const [stats, setStats] = useState<OverviewStats | null>(null);
  // Banner pengingat bisa ditutup; sengaja TIDAK disimpan -> muncul lagi setiap refresh.
  const [reminderClosed, setReminderClosed] = useState(false);
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

  // Statistik kartu dari database, per user (token login).
  useEffect(() => {
    setStats(null);
    if (!user?.token) return;
    let alive = true;
    const token = encodeURIComponent(user.token);
    const load = async (): Promise<OverviewStats> => {
      // 1) order_stats.php (dihitung server, pakai kolom jatuh_tempo)
      try {
        const r = await fetch(`${STATS_API}?token=${token}&t=${Date.now()}`, { cache: 'no-store' });
        const j = await r.json();
        if (j?.ok) {
          const now = Date.now();
          const segera = (Array.isArray(j.layanan) ? j.layanan : [])
            .filter((l: { type?: string; aktif?: boolean; jatuh_tempo?: string | null }) => l.type === 'agent_ai' && l.aktif && l.jatuh_tempo)
            .map((l: { order_id: string; nama: string; jatuh_tempo: string }) => ({
              orderId: l.order_id,
              nama: String(l.nama || '').split(' - ')[0],
              hari: Math.ceil((new Date(l.jatuh_tempo).getTime() - now) / 86400000),
            }))
            .filter((l: { hari: number }) => l.hari <= REMINDER_DAYS);
          return { bulanIni: Number(j.bulan_ini) || 0, vps: Number(j.vps_aktif) || 0, agen: Number(j.agent_aktif) || 0, segera };
        }
      } catch {
        /* lanjut ke cadangan */
      }
      // 2) cadangan: riwayat_pesanan.php milik user ini, dihitung di klien
      try {
        const r = await fetch(`${RIWAYAT_API}?token=${token}&t=${Date.now()}`, { cache: 'no-store' });
        const j = await r.json();
        if (j?.ok && Array.isArray(j.orders)) return statsFromRows(j.orders as RiwayatRow[]);
      } catch {
        /* abaikan */
      }
      return { bulanIni: 0, vps: 0, agen: 0 };
    };
    load().then((st) => alive && setStats(st));
    return () => {
      alive = false;
    };
  }, [user?.token]);

  const rekomendasi = useMemo(() => {
    const out: ServiceItem[] = [];
    for (const p of PLATFORMS) {
      const list = services.filter((s) => p.test.test(s.category) || (!s.category && p.test.test(s.name)));
      out.push(...list.slice(0, PER_PLATFORM));
    }
    return out;
  }, [services]);


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

      {!reminderClosed && stats?.segera && stats.segera.length > 0 && (
        <div
          role="alert"
          className="mb-4 flex w-full items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-900/20"
        >
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2.4} />
          <button
            type="button"
            onClick={() => navigate('/agen-ai-saya')}
            className="min-w-0 flex-1 text-left text-[13px] text-amber-800 hover:underline dark:text-amber-200"
          >
            <b>Pengingat jatuh tempo:</b>{' '}
            {stats.segera
              .map((a) => `${a.nama} (${a.orderId}) ${a.hari <= 0 ? 'jatuh tempo hari ini' : a.hari === 1 ? 'jatuh tempo besok' : `jatuh tempo ${a.hari} hari lagi`}`)
              .join(' · ')}
            . Lihat detail di Agen AI Saya.
          </button>
          <button
            type="button"
            onClick={() => setReminderClosed(true)}
            aria-label="Tutup pengingat"
            className="-m-1 rounded-md p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-amber-900/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
        {/* ===== Saldo & pesanan bulan ini (mobile: paling atas) ===== */}
        <div className="grid grid-cols-2 gap-4 lg:col-start-2 lg:row-start-1">
          {[
            { label: 'Sisa Saldo Anda', value: rupiah(user?.balance ?? 0), icon: Wallet },
            { label: 'Pesanan Anda Bulan Ini', value: stats ? rupiah(stats.bulanIni) : null, icon: ShoppingCart },
            { label: 'Server VPS Aktif', value: stats ? `${stats.vps} Server` : null, icon: Server },
            { label: 'AI Agent Aktif', value: stats ? `${stats.agen} Agent` : null, icon: Bot, to: '/agen-ai-saya' },
          ].map((s: { label: string; value: string | null; icon: typeof Bot; to?: string }) => {
            const Icon = s.icon;
            const Tag = s.to ? 'button' : 'div';
            return (
              <Tag
                key={s.label}
                {...(s.to ? { type: 'button' as const, onClick: () => navigate(s.to!), 'aria-label': `${s.label} — lihat daftar` } : {})}
                className={`${card} flex items-center gap-3 p-4 text-left ${s.to ? 'group transition-colors hover:border-cyan-300 hover:bg-cyan-50/40 active:scale-[0.99] dark:hover:border-cyan-800 dark:hover:bg-slate-800/60' : ''}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-white">
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11.5px] leading-tight text-slate-400 dark:text-slate-500">{s.label}</p>
                  {s.value === null ? (
                    <span className="mt-1 block h-[18px] w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" aria-label="Memuat" />
                  ) : (
                    <p className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{s.value}</p>
                  )}
                </div>
                {s.to && <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-500 dark:text-slate-600" />}
              </Tag>
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
