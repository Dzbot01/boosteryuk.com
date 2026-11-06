import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDownLeft,
  TrendingUp,
  DollarSign,
  Users,
  Inbox,
  Wallet,
  Link2,
  Plus,
  Check,
  RefreshCw,
} from 'lucide-react';
import Reveal from '../../components/Reveal';
import { fetchBalance } from '../../services/balanceApi';
import { useDeposits } from '../../context/DepositContext';

function rupiah(n: number | null): string {
  if (n === null) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Baru saja';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  return `${Math.floor(diff / 86_400_000)} hari lalu`;
}

interface ProviderBalance {
  id: string;
  name: string;
  endpoint: string;
  apiId: string;
  apiKey: string;
  balance: number | null;
  loading: boolean;
  connected: boolean;
}

const STORAGE_KEY = 'boosteryuk-provider-balances';

function loadProviders(): ProviderBalance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProviderBalance[];
  } catch {
    return [];
  }
}

export default function AdminProfitPage() {
  const navigate = useNavigate();
  const { deposits } = useDeposits();

  // Fayupedia balance (existing function)
  const [fayBalance, setFayBalance] = useState<number | null>(null);
  const [fayError, setFayError] = useState('');
  const [fayLoading, setFayLoading] = useState(true);

  // Connected external providers
  const [providers, setProviders] = useState<ProviderBalance[]>(loadProviders());

  // Add-provider form
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');
  const [newApiId, setNewApiId] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [formError, setFormError] = useState('');
  const [connected, setConnected] = useState('');

  const [newIds, setNewIds] = useState<Set<string>>(new Set());

  const totalIn = useMemo(
    () => deposits.reduce((sum, d) => sum + d.amount, 0),
    [deposits],
  );

  const providerTotal = useMemo(
    () => providers.reduce((sum, p) => sum + (p.balance ?? 0), 0),
    [providers],
  );

  const totalOut = fayBalance !== null ? fayBalance + providerTotal : null;

  const loadFay = async () => {
    setFayLoading(true);
    setFayError('');
    const res = await fetchBalance();
    if (res.ok) setFayBalance(res.balance);
    else {
      setFayError(res.message || 'Gagal memuat saldo.');
      setFayBalance(null);
    }
    setFayLoading(false);
  };

  useEffect(() => {
    loadFay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist providers
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
    } catch {
      // ignore
    }
  }, [providers]);

  // Auto-fetch balances for connected providers when page loads
  useEffect(() => {
    providers.forEach(async (p) => {
      if (!p.connected) return;
      await pingProvider(p.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pingProvider = async (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, loading: true } : p)));

    // Try to read balance from the /balance endpoint of that provider
    const base = provider.endpoint.replace(/\/+$/, '');
    const balanceUrl = `${base}/balance`;

    try {
      const res = await fetch(balanceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          api_id: provider.apiId,
          api_key: provider.apiKey,
        }).toString(),
      });
      const text = await res.text();
      let parsed: { balance?: unknown; saldo?: unknown; data?: { balance?: unknown } } = {};
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        // ignore
      }
      const balRaw = (parsed.balance ?? parsed.saldo ?? parsed.data?.balance) as
        | number
        | string
        | undefined;
      const balance = balRaw !== undefined ? Number(String(balRaw).replace(/[^\d.,-]/g, '').replace(',', '.')) : null;

      setProviders((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, balance: Number.isFinite(balance) ? balance : null, loading: false }
            : p,
        ),
      );
    } catch {
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, balance: null, loading: false } : p)),
      );
    }
  };

  const addProvider = () => {
    setFormError('');
    const name = newName.trim() || 'Provider Baru';
    const endpoint = newEndpoint.trim();
    if (!endpoint) {
      setFormError('Endpoint API wajib diisi.');
      return;
    }
    if (!newApiKey.trim()) {
      setFormError('API Key wajib diisi.');
      return;
    }
    const rec: ProviderBalance = {
      id: `PROV-${Date.now()}`,
      name,
      endpoint,
      apiId: newApiId.trim(),
      apiKey: newApiKey.trim(),
      balance: null,
      loading: false,
      connected: true,
    };
    setProviders((prev) => [...prev, rec]);
    setAdding(false);
    setNewName('');
    setNewEndpoint('');
    setNewApiId('');
    setNewApiKey('');
    setConnected(name);
    window.setTimeout(() => setConnected(''), 2000);
    pingProvider(rec.id).catch(() => {});
  };

  // Deposit animation
  useEffect(() => {
    if (deposits.length === 0) return;
    const first = deposits[0];
    setNewIds((s) => new Set(s).add(first.id));
    const t = window.setTimeout(() => {
      setNewIds((s) => {
        const next = new Set(s);
        next.delete(first.id);
        return next;
      });
    }, 900);
    return () => window.clearTimeout(t);
  }, [deposits]);

  const profit = totalOut !== null ? totalIn - totalOut : null;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6">
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
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-600/25">
            <DollarSign className="h-6 w-6" strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white sm:text-[30px]">
              My Profit
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              Ringkasan uang masuk, saldo provider, & profit
            </p>
          </div>
        </div>
      </Reveal>

      {/* Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Reveal delay={60}>
          <SummaryCard
            icon={ArrowDownLeft}
            label="Uang Masuk"
            value={rupiah(totalIn)}
            sub={`${deposits.length} deposit`}
            tone="in"
          />
        </Reveal>
        <Reveal delay={100}>
          <SummaryCard
            icon={TrendingUp}
            label="Estimasi Profit"
            value={rupiah(profit)}
            sub="Masuk − Saldo Provider"
            tone="profit"
          />
        </Reveal>
        <Reveal delay={140}>
          <SummaryCard
            icon={Users}
            label="Deposit Masuk"
            value={String(deposits.length)}
            sub="Transaksi real-time"
            tone="count"
          />
        </Reveal>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* Saldo Provider */}
        <Reveal delay={170}>
          <div className="flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-cyan-500" strokeWidth={2.2} />
                <h2 className="font-display text-[14px] font-extrabold text-slate-900 dark:text-white">
                  Saldo Provider
                </h2>
              </div>
              <button
                onClick={() => setAdding((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition-all hover:bg-cyan-700 active:scale-95"
              >
                <Plus className="h-3 w-3" strokeWidth={2.6} />
                Hubungkan
              </button>
            </div>

            {/* add form */}
            {adding && (
              <div className="border-b border-slate-100 p-4 dark:border-slate-700/50">
                <div className="space-y-2.5">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="provider-input"
                    placeholder="Nama Provider (contoh: IndoSMM)"
                  />
                  <input
                    value={newEndpoint}
                    onChange={(e) => setNewEndpoint(e.target.value)}
                    className="provider-input font-mono"
                    placeholder="Endpoint API (https://…/api)"
                  />
                  <input
                    value={newApiId}
                    onChange={(e) => setNewApiId(e.target.value)}
                    className="provider-input font-mono"
                    placeholder="API ID (jika ada)"
                  />
                  <input
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    className="provider-input font-mono"
                    placeholder="API KEY"
                  />
                  {formError && (
                    <p className="text-[11.5px] font-semibold text-rose-600 dark:text-rose-400">
                      {formError}
                    </p>
                  )}
                  <button
                    onClick={addProvider}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[12.5px] font-bold text-white transition-all hover:bg-cyan-700 active:scale-[0.99]"
                  >
                    <Link2 className="h-4 w-4" strokeWidth={2.3} />
                    Hubungkan
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 space-y-2.5 p-4">
              {/* Fayupedia — always first */}
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-sm">
                  <Wallet className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white">Fayupedia</p>
                  <p className="text-[10.5px] text-slate-400 dark:text-slate-500">Terhubung</p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-mono text-[14px] font-extrabold ${
                      fayError
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {fayLoading ? '…' : rupiah(fayBalance)}
                  </p>
                  <button
                    onClick={loadFay}
                    disabled={fayLoading}
                    className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-cyan-600 hover:text-cyan-700 disabled:opacity-50 dark:text-cyan-400"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 ${fayLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Connected providers */}
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200 font-display text-[12px] font-extrabold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-slate-900 dark:text-white">
                      {p.name}
                    </p>
                    <p className="truncate font-mono text-[10px] text-slate-400 dark:text-slate-500">
                      {p.endpoint.replace(/^https?:\/\//, '')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[14px] font-extrabold text-slate-900 dark:text-white">
                      {p.loading ? '…' : rupiah(p.balance)}
                    </p>
                    <button
                      onClick={() => pingProvider(p.id)}
                      disabled={p.loading}
                      className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold text-cyan-600 hover:text-cyan-700 disabled:opacity-50 dark:text-cyan-400"
                    >
                      <RefreshCw className={`h-2.5 w-2.5 ${p.loading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                </div>
              ))}

              {connected && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11.5px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                  Provider terhubung
                </div>
              )}
            </div>
          </div>
        </Reveal>

        {/* Deposit realtime */}
        <Reveal delay={210}>
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
                <h2 className="font-display text-[14px] font-extrabold text-slate-900 dark:text-white">
                  Deposit Real-time
                </h2>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 pulse-ring text-emerald-400" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                LIVE
              </span>
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              {deposits.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                    <Inbox className="h-7 w-7" strokeWidth={1.7} />
                  </span>
                  <p className="mt-4 text-[13.5px] font-bold text-slate-800 dark:text-slate-200">
                    Belum ada user yang Deposit
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                    Kartu deposit baru akan muncul di sini secara otomatis.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {deposits.map((d) => (
                    <li
                      key={d.id}
                      className={`flex items-center gap-3 px-5 py-3.5 ${
                        newIds.has(d.id) ? 'animate-drop-in' : ''
                      }`}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 font-display text-[12px] font-extrabold text-cyan-700 dark:bg-cyan-900/25 dark:text-cyan-400">
                        {d.username.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[13px] font-bold text-slate-900 dark:text-white">
                          @{d.username}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {timeAgo(d.createdAt)}
                        </p>
                      </div>
                      <p className="font-mono text-[13px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        +{rupiah(d.amount)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Reveal>
      </div>

      <style>{`
        .provider-input {
          height: 40px;
          width: 100%;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          background: #fff;
          padding: 0 12px;
          font-size: 12.5px;
          color: #0f172a;
          outline: none;
          transition: all .2s;
        }
        .provider-input:focus {
          border-color: #06b6d4;
          box-shadow: 0 0 0 4px rgba(6,182,212,.12);
        }
        .dark .provider-input {
          border-color: #334155;
          background: rgba(51,65,85,.45);
          color: #f1f5f9;
        }
        @keyframes drop-in {
          0%   { opacity: 0; transform: translateY(-18px); }
          60%  { opacity: 1; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-drop-in { animation: drop-in 0.55s cubic-bezier(0.22, 1, 0.36, 1); }
      `}</style>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  sub: string;
  tone: 'in' | 'profit' | 'count';
}) {
  const toneCls =
    tone === 'in'
      ? 'from-emerald-500 to-emerald-700 shadow-emerald-600/25'
      : tone === 'count'
        ? 'from-slate-600 to-slate-800 shadow-slate-600/25'
        : 'from-cyan-500 to-cyan-700 shadow-cyan-600/25';
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-700/60 dark:bg-slate-800/80">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${toneCls} text-white shadow-md`}>
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <p className="mt-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-display text-[22px] font-extrabold leading-none text-slate-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
  );
}
