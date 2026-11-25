import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Server, Wifi, WifiOff, Activity, Lock, LockOpen, Loader2, Ban } from 'lucide-react';
import Reveal from '../../components/Reveal';
import { useSiteSettings } from '../../context/SiteSettingsContext';

const PING_INTERVAL_MS = 6000;
const PING_TIMEOUT_MS = 4500;

interface Provider {
  /** Nomor server internal — sama dengan yang dikirim ke order.php / servicesApi. */
  server: '1' | '2' | '3' | '4';
  /** Nama provider (hanya terlihat admin; tidak pernah tampil ke user). */
  name: string;
  /** API yang benar-benar dipanggil file PHP di folder /api. */
  url: string;
  method?: 'GET' | 'POST';
  /** Pilihan server yang dikendalikan API ini di form order user. */
  uiLabel: string;
  /** Berkas PHP pemanggilnya, supaya admin tahu API ini dipakai di mana. */
  usedBy: string;
}

/**
 * Hanya API yang BENAR-BENAR dipakai web ini (dipetakan dari php-api/*_lib.php + src/supabase.ts).
 * Provider lama yang tidak lagi dipanggil berkas mana pun sudah dihapus dari daftar:
 * irvankedesmm.co.id, indosmm.id, djuragansosmed.com.
 */
const PROVIDERS: Provider[] = [
  {
    server: '1',
    name: 'Fayupedia',
    url: 'https://fayupedia.id/api/services',
    method: 'POST',
    uiLabel: 'Server 1 — Ringkas & Stabil',
    usedBy: 'config.php ($BASE_URL) · order.php · order_price.php · status.php · refill.php',
  },
  {
    server: '2',
    name: 'Naizop',
    url: 'https://naizop.com/api/v2',
    method: 'POST',
    uiLabel: 'Server 2 — Baru · Layanan Lebih Lengkap',
    usedBy: 'naizop_lib.php · naizop_services.php · naizop_status.php',
  },
  {
    server: '3',
    name: 'Medanpedia',
    url: 'https://api.medanpedia.co.id',
    method: 'POST',
    uiLabel: 'Layanan Google Maps Review (ikut di dalam Server 1)',
    usedBy: 'medanpedia_lib.php · medanpedia_services.php · order.php (server 3)',
  },
  {
    server: '4',
    name: 'SMMGen',
    url: 'https://my.smmgen.com/api/v2',
    method: 'POST',
    uiLabel: 'Server 3 — Lengkap & Murah',
    usedBy: 'smmgen_lib.php · smmgen_services.php · smmgen_status.php · smmgen_refill.php',
  },
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
  const { settings, updateSettings, sync } = useSiteSettings();
  const [rows, setRows] = useState<Row[]>(
    PROVIDERS.map((p) => ({ ...p, ping: null, status: 'pinging', updatedAt: 0 })),
  );
  const [tick, setTick] = useState(0);
  /** Server yang sedang dikirim perubahannya (tombol dikunci sebentar agar tidak dobel klik). */
  const [pending, setPending] = useState('');
  const mountedRef = useRef(true);

  /** Daftar server yang order-nya ditutup (disimpan di database lewat site_settings.php). */
  const closed = useMemo(
    () => new Set((settings.closedServers || []).map((s) => String(s))),
    [settings.closedServers],
  );
  useEffect(() => {
    if (sync.status !== 'saving') setPending('');
  }, [sync.status]);

  const toggleClosed = (server: Provider['server'], name: string) => {
    if (pending) return;
    const isOpen = closed.has(server);
    const next = isOpen
      ? Array.from(closed).filter((s) => s !== server)
      : [...Array.from(closed), server];
    if (
      !isOpen &&
      !window.confirm(
        `Tutup akses order ${name}?\n\nUser tidak akan bisa memesan layanan dari server ini sampai Anda membukanya lagi. Order yang sudah berjalan tetap diproses.`,
      )
    )
      return;
    setPending(server);
    updateSettings({ closedServers: next });
  };

  const runPings = useCallback(async () => {
    // Mark all as pinging
    setRows((prev) => prev.map((r) => ({ ...r, status: 'pinging' as const })));

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
  const closedCount = rows.filter((r) => closed.has(r.server)).length;

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
              {PROVIDERS.length} API yang dipakai web ini · ping otomatis tiap {PING_INTERVAL_MS / 1000}s
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
            {rows.map((row) => {
              const isClosed = closed.has(row.server);
              const busy = pending === row.server && sync.status === 'saving';
              return (
                <li
                  key={row.url}
                  className={`flex flex-wrap items-center gap-3.5 px-5 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 ${
                    isClosed ? 'bg-rose-50/40 dark:bg-rose-900/10' : ''
                  }`}
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
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-white">
                      {row.name}
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                        server={row.server}
                      </span>
                      {isClosed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                          <Ban className="h-3 w-3" strokeWidth={2.4} /> Order ditutup
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400 dark:text-slate-500">
                      {row.url.replace(/^https?:\/\//, '')}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{row.uiLabel}</p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                      {row.usedBy}
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

                  {/* Tutup/buka akses order server ini untuk semua user. */}
                  <button
                    type="button"
                    onClick={() => toggleClosed(row.server, row.name)}
                    disabled={!!pending}
                    aria-pressed={isClosed}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12px] font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                      isClosed
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-800/50 dark:bg-slate-800 dark:text-rose-400 dark:hover:bg-rose-900/20'
                    }`}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isClosed ? (
                      <LockOpen className="h-3.5 w-3.5" strokeWidth={2.4} />
                    ) : (
                      <Lock className="h-3.5 w-3.5" strokeWidth={2.4} />
                    )}
                    {isClosed ? 'Buka order' : 'Tutup order'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </Reveal>

      {/* Penjelasan + status penyimpanan ke database. */}
      <Reveal delay={90}>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-700/60 dark:bg-slate-800/80">
          <p className="text-[12.5px] font-bold text-slate-900 dark:text-white">Akses order per server</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            <li>
              <b>Tutup order</b> = server itu hilang dari pilihan di form order dan layanannya tidak
              ditampilkan lagi; {closedCount > 0 ? `${closedCount} server sedang ditutup.` : 'saat ini semua server terbuka.'}
            </li>
            <li>
              Penolakan juga ditegakkan di <span className="font-mono">order.php</span> (HTTP 403) sebelum
              saldo dipotong, jadi order tidak bisa lolos lewat request langsung.
            </li>
            <li>
              Pesanan yang sudah masuk tetap diproses & dicek statusnya seperti biasa; yang ditutup hanya
              pemesanan baru.
            </li>
          </ul>
          <p
            role="status"
            aria-live="polite"
            className={`mt-2 text-[11.5px] font-semibold ${
              sync.status === 'error'
                ? 'text-rose-600 dark:text-rose-400'
                : sync.status === 'saved'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {sync.status === 'saving'
              ? 'Menyimpan ke database…'
              : sync.status === 'saved'
                ? 'Tersimpan ke database — berlaku untuk semua user.'
                : sync.status === 'error'
                  ? sync.message || 'Gagal menyimpan ke database.'
                  : 'Perubahan disimpan ke tabel site_settings (kunci closedServers).'}
          </p>
        </div>
      </Reveal>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        Ping diukur dari browser Anda (round-trip). Nilai bervariasi tergantung jaringan & lokasi.
      </p>
    </div>
  );
}
