import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Server, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import type { DebugInfo, LookupFailure } from '../services/orderApi';

interface Props {
  title: string;
  message: string;
  failures: LookupFailure[];
  debug: DebugInfo | null;
  onRetry: () => void;
}

/** Try to extract an IP address from any string */
function extractIp(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
  return match ? match[1] : null;
}

/** Check if the server message is about IP not allowed */
function isIpBlocked(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('ip') &&
    (lower.includes('tidak diizinkan') ||
      lower.includes('not allowed') ||
      lower.includes('blocked') ||
      lower.includes('whitelist') ||
      lower.includes('ditolak') ||
      lower.includes('not permitted'))
  );
}

export default function ErrorPanel({ title, message, failures, debug, onRetry }: Props) {
  const [open, setOpen] = useState(false);

  const serverMsg = debug?.serverMsg || null;
  const responseText = debug?.responseText || null;
  const netError = debug?.networkError || null;
  const parseError = debug?.parseError || null;
  const httpBad = debug ? debug.okHttp === false : false;

  // Detect IP block from server response or message
  const ipBlocked =
    isIpBlocked(serverMsg) ||
    isIpBlocked(responseText) ||
    isIpBlocked(message) ||
    failures.some((f) => isIpBlocked(f.reason));

  const blockedIp =
    extractIp(serverMsg) ||
    extractIp(responseText) ||
    extractIp(message) ||
    (() => {
      for (const f of failures) {
        const ip = extractIp(f.reason);
        if (ip) return ip;
      }
      return null;
    })();

  // Determine the core error to show
  const getCoreError = (): { headline: string; sub: string | null; icon: 'alert' | 'ip' | 'wifi' } => {
    // IP blocked
    if (ipBlocked) {
      return {
        headline: blockedIp
          ? `IP ${blockedIp} tidak diizinkan`
          : 'IP Anda tidak diizinkan oleh server',
        sub: 'Hubungi admin untuk menambahkan IP ini ke daftar yang diizinkan.',
        icon: 'ip',
      };
    }

    // Network / CORS error
    if (netError) {
      if (netError.includes('Failed to fetch') || netError.includes('NetworkError')) {
        return {
          headline: 'Gagal terhubung ke server',
          sub: 'Periksa koneksi internet Anda atau coba lagi nanti.',
          icon: 'wifi',
        };
      }
      if (netError.includes('CORS') || netError.includes('cross-origin')) {
        return {
          headline: 'Permintaan diblokir browser (CORS)',
          sub: 'Server tidak mengizinkan akses dari halaman ini.',
          icon: 'wifi',
        };
      }
      return {
        headline: 'Gangguan jaringan',
        sub: netError,
        icon: 'wifi',
      };
    }

    // HTTP errors
    if (httpBad && debug?.httpStatus) {
      const code = debug.httpStatus;
      if (code === 403) {
        return {
          headline: blockedIp ? `IP ${blockedIp} tidak diizinkan` : 'Akses ditolak oleh server',
          sub: blockedIp
            ? 'Hubungi admin untuk menambahkan IP ini ke daftar yang diizinkan.'
            : serverMsg || responseText || 'Server mengembalikan status 403 (Forbidden).',
          icon: 'ip',
        };
      }
      if (code === 404) {
        return { headline: 'Pesanan tidak ditemukan', sub: null, icon: 'alert' };
      }
      if (code === 429) {
        return {
          headline: 'Terlalu banyak permintaan',
          sub: 'Tunggu beberapa saat sebelum mencoba lagi.',
          icon: 'alert',
        };
      }
      if (code >= 500) {
        return {
          headline: `Server sedang bermasalah (${code})`,
          sub: 'Coba lagi dalam beberapa saat.',
          icon: 'alert',
        };
      }
      return { headline: `Server error — HTTP ${code}`, sub: serverMsg, icon: 'alert' };
    }

    // JSON parse error
    if (parseError) {
      return { headline: 'Respons server tidak valid', sub: null, icon: 'alert' };
    }

    // Server returned status: false with a message
    if (serverMsg) {
      return { headline: serverMsg, sub: null, icon: 'alert' };
    }

    // Fallback
    return { headline: message || title, sub: null, icon: 'alert' };
  };

  const { headline, sub, icon } = getCoreError();

  const IconEl =
    icon === 'ip' ? ShieldAlert : icon === 'wifi' ? WifiOff : AlertCircle;

  return (
    <div className="animate-fade-in overflow-hidden rounded-[28px] border border-rose-200 bg-rose-50/70 dark:border-rose-800/40 dark:bg-rose-950/20">
      {/* Main error */}
      <div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
          <IconEl className="h-6 w-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold text-rose-800 dark:text-rose-300">
            {headline}
          </p>
          {sub && (
            <p className="mt-1 text-[13px] leading-relaxed text-rose-700/80 dark:text-rose-400/80">
              {sub}
            </p>
          )}

          {/* Show blocked IP prominently */}
          {ipBlocked && blockedIp && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 font-mono text-[13px] font-bold text-rose-800 dark:border-rose-700/40 dark:bg-rose-900/30 dark:text-rose-300">
              <Wifi className="h-4 w-4 text-rose-500" strokeWidth={2.2} />
              {blockedIp}
            </div>
          )}
        </div>
        <button
          onClick={onRetry}
          className="shrink-0 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-[13px] font-bold text-rose-700 transition-all hover:bg-rose-100 active:scale-95 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/40"
        >
          Coba lagi
        </button>
      </div>

      {/* Per-ID failures (only if different from the main error) */}
      {failures.length > 0 && !ipBlocked && (
        <div className="border-t border-rose-200/70 px-6 py-4 dark:border-rose-800/30">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-rose-500/80 dark:text-rose-400/80">
            ID yang gagal
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {failures.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12.5px] text-rose-800/90 dark:text-rose-300/90"
              >
                <code className="rounded-md bg-rose-100 px-2 py-0.5 font-mono text-[12px] font-bold dark:bg-rose-900/40">
                  #{f.id}
                </code>
                <span className="text-rose-700/80 dark:text-rose-400/80">{f.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Collapsible technical detail */}
      {debug && (
        <div className="border-t border-rose-200/70 dark:border-rose-800/30">
          <button
            onClick={() => setOpen(!open)}
            className="flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-rose-100/50 dark:hover:bg-rose-900/20"
          >
            <span className="flex items-center gap-2 text-[12px] font-bold text-rose-700 dark:text-rose-400">
              <Server className="h-3.5 w-3.5" strokeWidth={2.4} />
              Detail teknis
            </span>
            {open ? (
              <ChevronUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            )}
          </button>

          <div
            className={`grid transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-6 pb-6 pt-1">
                <dl className="overflow-hidden rounded-xl border border-rose-200/80 bg-white text-[11.5px] dark:border-rose-800/30 dark:bg-slate-900">
                  {[
                    { k: 'HTTP', v: debug.httpStatus !== null ? `${debug.httpStatus}${debug.okHttp === false ? ' (gagal)' : ''}` : '— (tidak ada respons)' },
                    { k: 'Waktu', v: `${debug.durationMs} ms` },
                    ...(debug.networkError ? [{ k: 'Jaringan', v: debug.networkError }] : []),
                    ...(debug.parseError ? [{ k: 'Parse', v: debug.parseError }] : []),
                    ...(blockedIp ? [{ k: 'IP ditolak', v: blockedIp }] : []),
                    ...(debug.serverMsg ? [{ k: 'Server', v: debug.serverMsg }] : []),
                  ].map((r) => (
                    <div
                      key={r.k}
                      className="grid grid-cols-[90px_1fr] gap-3 border-b border-slate-100 px-3.5 py-2 last:border-b-0 dark:border-slate-700/60"
                    >
                      <dt className="font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {r.k}
                      </dt>
                      <dd className="break-all font-mono leading-relaxed text-slate-700 dark:text-slate-300">
                        {r.v}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
