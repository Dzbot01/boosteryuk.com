import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, RotateCcw, Settings2, TriangleAlert } from 'lucide-react';
import Reveal from './Reveal';
import {
  DEFAULT_TRIPAY_CONFIG,
  TRIPAY_PRODUCTION,
  TRIPAY_SANDBOX,
  saveConfig,
  type TripayConfig,
} from '../services/tripay';

/**
 * =============================================================
 *  MODAL PENGATURAN API TRIPAY
 *  Panel yang bisa dilipat untuk mengatur API Key, Private Key,
 *  environment (sandbox/production), dan URL proxy backend.
 *  Perubahan disimpan ke localStorage.
 * ============================================================= */
export interface SignaturePreview {
  merchantRef: string;
  amount: number;
  signature: string;
}

export default function TripaySettings({
  config,
  onChange,
  signaturePreview = null,
}: {
  config: TripayConfig;
  onChange: (next: TripayConfig) => void;
  /** Contoh hasil HMAC-SHA256(merchant_ref + amount) dari form aktif. */
  signaturePreview?: SignaturePreview | null;
}) {
  const [open, setOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<TripayConfig>) => onChange({ ...config, ...patch });

  const reset = () => {
    onChange({ ...DEFAULT_TRIPAY_CONFIG });
    saveConfig(DEFAULT_TRIPAY_CONFIG);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const fieldClass =
    'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-800 outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:text-slate-100 dark:bg-slate-900 dark:border-slate-700';

  return (
    <Reveal delay={110}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
        {/* Header panel — klik untuk membuka/menutup */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Settings2 className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-extrabold text-slate-900 dark:text-white">Pengaturan API Tripay</span>
            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
              {config.baseUrl === TRIPAY_PRODUCTION ? 'Production' : 'Sandbox'} ·{' '}
              {config.proxyUrl.trim() ? `proxy aktif` : 'tanpa proxy (rawan diblokir CORS)'}
            </span>
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide ${
              config.baseUrl === TRIPAY_PRODUCTION
                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 dark:bg-rose-950/40'
                : 'bg-amber-50 text-amber-600 ring-1 ring-amber-200 dark:bg-amber-950/40'
            }`}
          >
            {config.baseUrl === TRIPAY_PRODUCTION ? 'Live' : 'Sandbox'}
          </span>
        </button>

        {/* Isi panel */}
        {open && (
          <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
            {/* Peringatan keamanan */}
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:bg-amber-950/40 dark:border-amber-800/60">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" strokeWidth={2.4} />
              <p className="text-[11px] leading-relaxed text-amber-800">
                <span className="font-extrabold">Private Key di browser = tidak aman.</span> Siapa pun yang membuka
                halaman ini bisa membacanya, dan Tripay memblokir permintaan lintas-origin dari browser. Untuk
                produksi, panggil <span className="font-mono">/transaction/create</span> dari backend Anda lalu isi URL
                proxy di bawah.
              </p>
            </div>

            {/* Toggle environment */}
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Environment
            </label>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {[
                { url: TRIPAY_SANDBOX, label: 'Sandbox', hint: 'api-sandbox' },
                { url: TRIPAY_PRODUCTION, label: 'Production', hint: 'api' },
              ].map((env) => {
                const active = config.baseUrl === env.url;
                return (
                  <button
                    key={env.url}
                    type="button"
                    onClick={() => update({ baseUrl: env.url })}
                    className={`rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] ${
                      active
                        ? 'border-cyan-400 bg-cyan-50 shadow-[0_10px_24px_-18px_rgba(72,198,229,1)] dark:bg-cyan-950/40'
                        : 'border-slate-200 bg-white hover:border-cyan-200 dark:bg-slate-900 dark:border-slate-700'
                    }`}
                  >
                    <span className={`block text-[12.5px] font-extrabold ${active ? 'text-cyan-700' : 'text-slate-800 dark:text-slate-100'}`}>
                      {env.label}
                    </span>
                    <span className="block font-mono text-[10px] text-slate-400 dark:text-slate-400">{env.hint}</span>
                  </button>
                );
              })}
            </div>

            {/* API Key & Private Key */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="tripay-apikey" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <KeyRound className="h-3 w-3" strokeWidth={2.6} />
                  API Key
                </label>
                <input
                  id="tripay-apikey"
                  value={config.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  spellCheck={false}
                  className={`${fieldClass} font-mono ${showSecret ? '' : 'tracking-tight'}`}
                  type={showSecret ? 'text' : 'password'}
                  placeholder="Bearer token"
                />
              </div>
              <div>
                <label htmlFor="tripay-privatekey" className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <KeyRound className="h-3 w-3" strokeWidth={2.6} />
                  Private Key
                </label>
                <div className="relative">
                  <input
                    id="tripay-privatekey"
                    value={config.privateKey}
                    onChange={(e) => update({ privateKey: e.target.value })}
                    spellCheck={false}
                    className={`${fieldClass} font-mono pr-10`}
                    type={showSecret ? 'text' : 'password'}
                    placeholder="untuk HMAC-SHA256"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((v) => !v)}
                    aria-label={showSecret ? 'Sembunyikan kunci' : 'Tampilkan kunci'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Proxy / callback / return */}
            <div className="mt-3">
              <label htmlFor="tripay-proxy" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                URL Proxy / Backend <span className="font-medium normal-case text-slate-400 dark:text-slate-400">(opsional)</span>
              </label>
              <input
                id="tripay-proxy"
                value={config.proxyUrl}
                onChange={(e) => update({ proxyUrl: e.target.value })}
                spellCheck={false}
                className={`${fieldClass} font-mono`}
                placeholder="https://domainanda.com/api/tripay-proxy.php"
              />
              <p className="mt-1 text-[10.5px] text-slate-400 dark:text-slate-400">
                Proxy akan menerima <span className="font-mono">?target=&lt;url-tripay&gt;</span> lalu meneruskan
                request beserta header Authorization dari sisi server.
              </p>
            </div>

            {/* Preview signature HMAC-SHA256 dari form aktif */}
            {signaturePreview && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:bg-slate-800/60 dark:border-slate-700">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Signature (HMAC-SHA256)
                </p>
                <p className="break-all font-mono text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                  hash(<span className="text-cyan-600">{signaturePreview.merchantRef}</span> +{' '}
                  <span className="text-cyan-600">{signaturePreview.amount}</span>, privateKey)
                </p>
                <p className="mt-1.5 break-all font-mono text-[10.5px] font-bold leading-relaxed text-slate-900 dark:text-white">
                  {signaturePreview.signature}
                </p>
              </div>
            )}

            {/* Aksi */}
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  saveConfig(config);
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 1600);
                }}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-[12.5px] font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
              >
                {saved ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.6} /> : null}
                {saved ? 'Tersimpan' : 'Simpan pengaturan'}
              </button>
              <button
                type="button"
                onClick={reset}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-[12.5px] font-bold text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:text-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.6} />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </Reveal>
  );
}
