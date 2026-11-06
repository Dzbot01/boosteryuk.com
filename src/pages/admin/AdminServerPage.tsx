import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Wifi, WifiOff, Activity } from 'lucide-react';
import Reveal from '../../components/Reveal';

const PING_INTERVAL_MS = 6000;
const PING_TIMEOUT_MS = 4500;

interface Provider {
  name: string;
  url: string;
  method?: 'GET' | 'POST';
}

const PROVIDERS: Provider[] = [
  { name: 'Irvan Kedes SMM', url: 'https://irvankedesmm.co.id/api/services', method: 'POST' },
  { name: 'IndoSMM', url: 'https://indosmm.id/api/v2', method: 'POST' },
  { name: 'Djuragan Sosmed', url: 'https://djuragansosmed.com/api/v2', method: 'POST' },
  { name: 'Fayupedia', url: 'https://fayupedia.id/api/services', method: 'POST' },
];

interface Row extends Provider {
  ping: number | null;
  status: 'pinging' | 'ok' | 'fail';
  updatedAt: number;
}

async function measurePing(p: Provider): Promise<number | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  const started = performance.now();
  try {
    await fetch(p.url, {
      method: p.method || 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
      // opaque response is fine — we only need the round-trip time
    });
    return Math.round(performance.now() - started);
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function pingColor(ms: number | null): string {
  if (ms === null) return 'text-rose-600 dark:text-rose-400';
  if (ms < 150) return 'text-emerald-600 dark:text-emerald-400';
  if (ms < 400) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function pingBadge(ms: number | null, status: Row['status']): string {
  if (status === 'pinging')
    return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300';
  if (ms === null)
    return 'bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-900/25 dark:ring-rose-800/50';
  if (ms < 150)
    return 'bg-emerald-50 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:ring-emerald-800/50';
  if (ms < 400)
    return 'bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:ring-amber-800/50';
  return 'bg-rose-50 ring-1 ring-rose-200 dark:bg-rose-900/25 dark:ring-rose-800/50';
}

function timeAgo(ts: number): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  if (diff < 1000) return 'baru saja';
  if (diff < 60_000) return `${Math.floor(diff / 1000)} dtk lalu`;
  return `${Math.floor(diff / 60_000)} mnt lalu`;
}

export default function AdminServerPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>(
    PROVIDERS.map((p) => ({ ...p, ping: null, status: 'pinging', updatedAt: 0 })),
  );
  const [tick, setTick] = useState(0);
  const mountedRef = useRef(true);

  const runPings = useCallback(async () => {
    // Mark all as pinging
    setRows((prev) =>
      prev.map((r) => ({ ...r, status: 'pinging' as const })),
    );

    // Ping each provider in parallel; update as results arrive.
    await Promise.all(
      PROVIDERS.map(async (p) => {
        const ms = await measurePing(p);
        if (!mountedRef.current) return;
        setRows((prev) =>
          prev.map((r) =>
            r.url === p.url
              ? {
                  ...r,
                  ping: ms,
                  status: ms === null ? 'fail' : 'ok',
                  updatedAt: Date.now(),
                }
              : r,
          ),
        );
      }),
    );
  }, []);

  // First run + periodic loop (no manual refresh button)
  useEffect(() => {
    runPings();
    const t = window.setInterval(runPings, PING_INTERVAL_MS);
    return () => {
      window.clearInterval(t);
      mountedRef.current = false;
    };
  }, [runPings]);

  // 1s ticker so "N dtk lalu" stays current
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const okCount = rows.filter((r) => r.status === 'ok').length;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate('/admin')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Admin Panel
        </button>
      </Reveal>

      <Reveal delay={30}>
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-lg">
            <Server className="h-6 w-6" strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white sm:text-[30px]">
              Server Panel
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              Ping otomatis ke provider layanan · refresh {PING_INTERVAL_MS / 1000}s
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-700/50">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
              <h2 className="font-display text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                Status Provider
              </h2>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 pulse-ring text-emerald-400" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {okCount}/{rows.length} ONLINE
            </span>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {rows.map((row) => (
              <li
                key={row.url}
                className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    row.status === 'ok'
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400'
                      : row.status === 'fail'
                        ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/25 dark:text-rose-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                  }`}
                >
                  {row.status === 'fail' ? (
                    <WifiOff className="h-[18px] w-[18px]" strokeWidth={2.1} />
                  ) : (
                    <Wifi
                      className={`h-[18px] w-[18px] ${row.status === 'pinging' ? 'animate-pulse' : ''}`}
                      strokeWidth={2.1}
                    />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-slate-900 dark:text-white">
                    {row.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                    {row.url.replace(/^https?:\/\//, '')}
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`rounded-lg px-2.5 py-1 font-mono text-[13px] font-extrabold ${pingBadge(
                      row.ping,
                      row.status,
                    )} ${pingColor(row.ping)}`}
                  >
                    {row.status === 'pinging'
                      ? '…'
                      : row.ping === null
                        ? 'timeout'
                        : `${row.ping}ms`}
                  </span>
                  <p
                    key={tick}
                    className="mt-1 text-[10px] font-medium text-slate-400 dark:text-slate-500"
                  >
                    {timeAgo(row.updatedAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        Ping diukur dari browser Anda (round-trip). Nilai bervariasi tergantung jaringan & lokasi.
      </p>
    </div>
  );
}
