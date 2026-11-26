import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import Chart from 'chart.js/auto';
import { BadgeCheck, Link2, LoaderCircle, Music2, Unlink } from 'lucide-react';

/**
 * Kartu "Hubungkan TikTok" di halaman profil (DEMO).
 *
 * Alur nyata nanti: klik -> redirect ke otorisasi TikTok -> kembali ke profil
 * dengan token terverifikasi. Saat ini DEMO: tidak ada redirect sungguhan; klik
 * "Hubungkan TikTok" mensimulasikan verifikasi lalu menampilkan hasil sukses
 * dengan username TikTok "Demo" beserta kartu analitik profil & grafik perkembangan.
 * Status koneksi demo disimpan di localStorage agar bertahan saat refresh.
 */
export const TIKTOK_DEMO_STORAGE_KEY = 'by-tiktok-demo-connected';
export const TIKTOK_DEMO_USERNAME = 'Demo';

/** Ikon TikTok (glyph resmi digambar ulang sebagai SVG inline). */
export function TikTokGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

/* ============ data demo deterministik (30 hari) ============ */
const POINTS = 30;
function demoSeries(base: number, step: number, wave: number) {
  return Array.from({ length: POINTS }, (_, i) => Math.round(base + step * i + Math.sin(i / 2.1) * wave + (i % 4) * (wave / 3)));
}
const FULL_FOLLOWERS = demoSeries(118_900, 320, 900);
const FULL_LIKES = demoSeries(2_236_000, 5_900, 4_200);
const PROFILE_DEMO = {
  username: TIKTOK_DEMO_USERNAME,
  nickname: 'Demo',
  bio: 'Kreator demo Boosteryuk · konten booster & tips sosial media',
  accountId: '7291048866512',
  region: 'ID',
  joined: 'Maret 2021',
  following: 312,
  videos: 348,
  favorites: 1_204,
  verified: true,
};
const fmt = (n: number) => n.toLocaleString('id-ID');
const compact = (n: number) => Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
function dayLabels(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.now() - (count - 1 - i) * 86_400_000);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  });
}
function delta(series: number[]) {
  const first = series[0] || 1;
  return (((series[series.length - 1] - first) / first) * 100).toFixed(1).replace('.', ',');
}

/* ============ grafik chart.js + fallback SVG (lingkungan tanpa canvas) ============ */
class ChartBoundary extends Component<{ fallback: ReactNode; children?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function FallbackLineChart({ followers, likes }: { followers: number[]; likes: number[] }) {
  const W = 640;
  const H = 220;
  const path = (series: number[]) => {
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    return series
      .map((v, i) => `${((i / (series.length - 1)) * W).toFixed(1)},${(H - 14 - ((v - min) / span) * (H - 34)).toFixed(1)}`)
      .join(' ');
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="tiktok-fallback-chart h-52 w-full" role="img" aria-label="Grafik perkembangan akun (fallback)">
      <polyline points={path(followers)} fill="none" stroke="#06b6d4" strokeWidth="3" strokeLinecap="round" />
      <polyline points={path(likes)} fill="none" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 5" />
    </svg>
  );
}
function GrowthChart({ followers, likes }: { followers: number[]; likes: number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current ? ref.current.getContext('2d') : null;
    if (!ctx) throw new Error('canvas 2d tidak tersedia');
    const grad = ctx.createLinearGradient(0, 0, 0, 240);
    grad.addColorStop(0, 'rgba(6,182,212,0.28)');
    grad.addColorStop(1, 'rgba(6,182,212,0)');
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dayLabels(followers.length),
        datasets: [
          { label: 'Followers', data: followers, borderColor: '#06b6d4', backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2.5 },
          { label: 'Likes', data: likes, borderColor: '#ec4899', backgroundColor: 'transparent', borderDash: [6, 5], tension: 0.35, pointRadius: 0, borderWidth: 2, yAxisID: 'y1' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#94a3b8', usePointStyle: true, boxWidth: 8 } } },
        scales: {
          x: { grid: { color: 'rgba(100,116,139,0.14)' }, ticks: { color: '#94a3b8', maxTicksLimit: 7, font: { size: 10 } } },
          y: { grid: { color: 'rgba(100,116,139,0.14)' }, ticks: { color: '#94a3b8', callback: (v) => compact(Number(v)), font: { size: 10 } } },
          y1: { position: 'right', grid: { display: false }, ticks: { color: '#f9a8d4', callback: (v) => compact(Number(v)), font: { size: 10 } } },
        },
      },
    });
    return () => chart.destroy();
  }, [followers, likes]);
  return <canvas ref={ref} role="img" aria-label="Grafik perkembangan followers dan likes akun TikTok" className="h-52 w-full" />;
}

/* ============ komponen utama ============ */
type Status = 'idle' | 'connecting' | 'connected';
export default function TikTokAnalytics() {
  const [status, setStatus] = useState<Status>('idle');
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TIKTOK_DEMO_STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { connectedAt?: string };
        setConnectedAt(saved.connectedAt ?? new Date().toISOString());
        setStatus('connected');
      }
    } catch { /* penyimpanan tidak tersedia */ }
  }, []);
  useEffect(() => {
    if (status !== 'connecting') return;
    // DEMO: mensimulasikan redirect otorisasi TikTok + verifikasi (tanpa redirect sungguhan).
    const t = window.setTimeout(() => {
      const at = new Date().toISOString();
      try { localStorage.setItem(TIKTOK_DEMO_STORAGE_KEY, JSON.stringify({ username: TIKTOK_DEMO_USERNAME, connectedAt: at })); } catch { /* abaikan */ }
      setConnectedAt(at);
      setStatus('connected');
    }, 1400);
    return () => window.clearTimeout(t);
  }, [status]);

  const disconnect = () => {
    try { localStorage.removeItem(TIKTOK_DEMO_STORAGE_KEY); } catch { /* abaikan */ }
    setConnectedAt(null);
    setStatus('idle');
  };

  const followers = FULL_FOLLOWERS.slice(-range);
  const likes = FULL_LIKES.slice(-range);
  const lastFollowers = FULL_FOLLOWERS[POINTS - 1];
  const lastLikes = FULL_LIKES[POINTS - 1];

  return (
    <section aria-label="Integrasi TikTok" className="mt-5 space-y-5">
      {status === 'connected' ? (
        <>
          {/* ===== Kartu analitik profil TikTok ===== */}
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-black">
                <TikTokGlyph className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-base font-extrabold lg:text-lg">
                  @{PROFILE_DEMO.username}
                  {PROFILE_DEMO.verified && <BadgeCheck className="h-4 w-4 text-cyan-500" aria-label="Terverifikasi" />}
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{PROFILE_DEMO.nickname} · {PROFILE_DEMO.bio}</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Link2 className="h-3.5 w-3.5" /> Terhubung
              </span>
              <button onClick={disconnect} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-rose-200 hover:text-rose-500 dark:border-slate-700">
                <Unlink className="h-3.5 w-3.5" /> Putuskan
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 lg:grid-cols-4">
              {[
                ['Followers', fmt(lastFollowers)],
                ['Likes', fmt(lastLikes)],
                ['Following', fmt(PROFILE_DEMO.following)],
                ['Video', fmt(PROFILE_DEMO.videos)],
              ].map(([label, value]) => (
                <div key={label} className="bg-white p-4 text-center dark:bg-slate-900">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums lg:text-xl">{value}</dd>
                </div>
              ))}
            </dl>
            <dl className="grid gap-3 p-4 text-sm lg:grid-cols-2 lg:p-6">
              {[
                ['ID akun', PROFILE_DEMO.accountId],
                ['Region', PROFILE_DEMO.region],
                ['Bergabung', PROFILE_DEMO.joined],
                ['Disukai (favorit)', fmt(PROFILE_DEMO.favorites)],
                ['Status akun', PROFILE_DEMO.verified ? 'Terverifikasi' : 'Biasa'],
                ['Terhubung sejak', connectedAt ? new Date(connectedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                  <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* ===== Kartu grafik analisis perkembangan ===== */}
          <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 lg:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-2 text-base font-extrabold lg:text-lg">
                  <Music2 className="h-4 w-4 text-cyan-500" /> Analisis perkembangan akun
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold text-emerald-500">+{delta(followers)}%</span> followers · <span className="font-bold text-emerald-500">+{delta(likes)}%</span> likes dalam {range} hari terakhir
                </p>
              </div>
              <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
                {([7, 14, 30] as const).map((r) => (
                  <button key={r} onClick={() => setRange(r)} className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${range === r ? 'bg-cyan-600 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    {r}H
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <ChartBoundary fallback={<FallbackLineChart followers={followers} likes={likes} />}>
                <GrowthChart followers={followers} likes={likes} />
              </ChartBoundary>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Data demo — integrasi API TikTok menampilkan statistik asli setelah verifikasi tersedia.</p>
          </div>
        </>
      ) : (
        /* ===== Kartu ajakan hubungkan ===== */
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 text-center dark:border-slate-700 dark:bg-slate-900 lg:p-8">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-black">
            <TikTokGlyph className="h-7 w-7" />
          </span>
          <h2 className="mt-3 text-lg font-extrabold lg:text-xl">Hubungkan TikTok</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Verifikasi akun TikTok Anda untuk menampilkan kartu analitik profil (followers, likes, username, dll.) serta grafik perkembangan akun langsung di halaman profil.
          </p>
          <button
            onClick={() => setStatus('connecting')}
            disabled={status === 'connecting'}
            className="mx-auto mt-4 flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-black disabled:opacity-70 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {status === 'connecting' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <TikTokGlyph className="h-4 w-4" />}
            {status === 'connecting' ? 'Memverifikasi akun TikTok…' : 'Hubungkan TikTok'}
          </button>
          <p className="mt-2 text-[11px] text-slate-400">Mode demo: tanpa redirect sungguhan, hasil verifikasi memakai username “{TIKTOK_DEMO_USERNAME}”.</p>
        </div>
      )}
    </section>
  );
}
