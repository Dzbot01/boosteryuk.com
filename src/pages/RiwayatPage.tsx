import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Inbox,
  ReceiptText,
  Copy,
  Check,
  Search,
  PackageCheck,
  Hourglass,
  Ban,
  Bot,
  ChevronRight,
  Server,
  Smartphone,
  Sparkles,
  ShoppingCart,
} from 'lucide-react';
import { MAIN_API } from '../lib/apiBase';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';

function rupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatQty(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n);
}

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(ts);
}

function formatTime(ts: number): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(ts);
}

type Filter = 'all' | 'selesai' | 'proses' | 'batal' | 'pending';
const STATUSES = ['pending', 'proses', 'selesai', 'batal'] as const;

/** Pesanan sewa Agen AI (agent_order.php): ID "AI…" / nama "Agen AI WhatsApp … - Jatuh tempo …". */
function agentInfo(o: { order_id: string; service_name: string }): { title: string; due: string } | null {
  const isAgent = /^AI\d{6,}$/.test(o.order_id) || /^agen ai/i.test(o.service_name);
  if (!isAgent) return null;
  const [title, ...rest] = o.service_name.split(' - ');
  const due = rest.join(' - ').replace(/^jatuh tempo\s*/i, '');
  return { title: title.trim() || 'Agen AI', due };
}

type OrderType = 'smm' | 'agent_ai' | 'nexspace' | 'otp' | 'upgrade';
const TYPE_META: Record<OrderType, { label: string; icon: typeof Bot; to: string | null; hint: string }> = {
  smm: { label: 'SMM', icon: ShoppingCart, to: null, hint: '' },
  agent_ai: { label: 'Agen AI', icon: Bot, to: '/agen-ai-saya', hint: 'Lihat detail Agen AI' },
  nexspace: { label: 'NexSpace', icon: Server, to: '/nexspace', hint: 'Lihat server NexSpace' },
  otp: { label: 'Nomor OTP', icon: Smartphone, to: '/otp-service', hint: 'Lihat nomor & kode OTP' },
  upgrade: { label: 'Upgrade', icon: Sparkles, to: '/plus', hint: 'Lihat paket Upgrade' },
};
/** Jenis pesanan dari awalan ID / nama layanan (NX… / OTP… / AI… / UP…). */
function typeOf(orderId: string, name: string): OrderType {
  const n = name.toLowerCase();
  if (/^NX[0-9A-Z]/.test(orderId) || n.startsWith('nexspace')) return 'nexspace';
  if (/^OTP\d/.test(orderId) || n.startsWith('nomor otp')) return 'otp';
  if (/^AI\d{6,}/.test(orderId) || n.includes('agen ai')) return 'agent_ai';
  if (/^UP\d/.test(orderId) || n.includes('boosteryuk plus') || n.includes('boosteryuk extra')) return 'upgrade';
  return 'smm';
}

/** Normalisasi baris dari riwayat_pesanan.php (mysqli mengirim DECIMAL/INT sebagai string). */
function normalize(r: Record<string, unknown>): OrderFromDB {
  const st = String(r.status ?? '').toLowerCase();
  return {
    id: Number(r.id) || 0,
    order_id: String(r.order_id ?? ''),
    service_name: String(r.service_name ?? ''),
    quantity: Number(r.quantity) || 0,
    price: Number(r.price) || 0,
    status: (STATUSES as readonly string[]).includes(st) ? (st as OrderFromDB['status']) : 'pending',
    created_at: Number(r.created_at) || 0,
    type: (r.type && String(r.type) in TYPE_META ? String(r.type) : typeOf(String(r.order_id ?? ''), String(r.service_name ?? ''))) as OrderType,
  };
}
type OrderFromDB = {
  id: number;
  order_id: string;
  service_name: string;
  quantity: number;
  price: number;
  status: 'pending' | 'proses' | 'selesai' | 'batal';
  created_at: number;
  type: OrderType;
}

export default function RiwayatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<OrderType | 'all'>('all');
  const [loadErr, setLoadErr] = useState('');

  const token = user?.token;
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let alive = true;
    const get = async (url: string) => {
      const r = await fetch(url, { cache: 'no-store' });
      const d = await r.json();
      if (!Array.isArray(d?.orders)) throw new Error(d?.message || 'format');
      return (d.orders as Record<string, unknown>[]).map(normalize);
    };
    (async () => {
      setLoadErr('');
      const q = `?token=${encodeURIComponent(token)}&t=${Date.now()}`;
      try {
        // riwayat_pesanan.php berisi semua jenis pesanan; jenisnya dikenali dari awalan ID (typeOf).
        let list: OrderFromDB[];
        try { list = await get(`${MAIN_API}/riwayat_pesanan.php${q}`); }
        catch { list = await get(`https://cekidku.my.id/api/riwayat_pesanan.php${q}`); }
        if (alive) setOrders(list);
      } catch {
        if (alive) { setOrders([]); setLoadErr('Riwayat belum bisa dimuat. Periksa koneksi lalu muat ulang halaman.'); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const statusOf = (item: OrderFromDB): OrderFromDB['status'] => item.status;

  const STATUS_META = {
    selesai: {
      label: 'Selesai',
      icon: PackageCheck,
      cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/50',
    },
    proses: {
      label: 'Diproses',
      icon: Hourglass,
      cls: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-900/25 dark:text-cyan-400 dark:ring-cyan-800/50',
    },
    batal: {
      label: 'Dibatalkan',
      icon: Ban,
      cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/25 dark:text-rose-400 dark:ring-rose-800/50',
    },
    pending: {
      label: 'Pending',
      icon: Hourglass,
      cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/50',
    },
  } as const;

  const visible = orders.filter((o) => {
    if (filter!== 'all' && statusOf(o)!== filter) return false;
    if (typeFilter !== 'all' && o.type !== typeFilter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      o.service_name.toLowerCase().includes(q) ||
      o.order_id.toLowerCase().includes(q)
    );
  });

  const copyId = (key: number, id: string) => {
    navigator.clipboard?.writeText(id).then(
      () => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 1500);
      },
      () => {},
    );
  };

  const totalSpent = orders
   .filter((o) => statusOf(o)!== 'batal')
   .reduce((sum, o) => sum + o.price, 0);

  const typeCounts = orders.reduce<Record<string, number>>((m, o) => { m[o.type] = (m[o.type] || 0) + 1; return m; }, {});
  const typeTabs = (Object.keys(TYPE_META) as OrderType[]).filter((t) => typeCounts[t]);
  /** Label jumlah & status yang sesuai jenis pesanan. */
  const qtyLabel = (o: OrderFromDB) =>
    o.type === 'agent_ai' || o.type === 'nexspace' ? `${o.quantity} bulan` : o.type === 'otp' ? '1 nomor' : o.type === 'upgrade' ? (/extra/i.test(o.service_name) ? `${o.quantity || 1} bulan` : 'Selamanya') : formatQty(o.quantity);
  const statusLabel = (o: OrderFromDB, fallback: string) => {
    const s = statusOf(o);
    const waiting = s === 'proses' || s === 'pending';
    if (s === 'batal' && o.type !== 'smm') return 'Batal · saldo dikembalikan';
    if (o.type === 'agent_ai' && waiting) return 'Menunggu tautan';
    if (o.type === 'nexspace') return waiting ? 'Server sedang dibuat' : s === 'selesai' ? 'Aktif' : fallback;
    if (o.type === 'otp') return waiting ? 'Menunggu kode OTP' : s === 'selesai' ? 'Kode diterima' : fallback;
    return fallback;
  };

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'selesai', label: 'Selesai' },
    { id: 'proses', label: 'Diproses' },
    { id: 'pending', label: 'Pending' },
    { id: 'batal', label: 'Dibatalkan' },
  ];

  if(!user) return (
  <div className="text-center py-20">Silahkan login dulu</div>
);
if(loading) return <div className="text-center py-20">Loading...</div>;

  return (
    <div className="page-align-left mx-auto max-w-3xl px-4 py-10 sm:px-6">

      {/* Heading */}
      <Reveal delay={30}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-600/25">
              <History className="h-6 w-6" strokeWidth={2} />
            </span>
            <div>
              <h1 className="font-display text-[26px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white sm:text-[30px]">
                Riwayat Pesanan
              </h1>
              <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                {orders.length} pesanan tercatat · total{' '}
                <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                  {rupiah(totalSpent)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Controls */}
      <Reveal delay={60}>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama layanan atau ID pesanan…"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-[13.5px] text-slate-800 outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`h-11 rounded-xl px-3.5 text-[12.5px] font-bold transition-all active:scale-95 ${
                  filter === f.id
                   ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/25'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {typeTabs.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Jenis pesanan">
          {(['all', ...typeTabs] as (OrderType | 'all')[]).map((t) => {
            const on = typeFilter === t;
            const Icon = t === 'all' ? null : TYPE_META[t].icon;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={on}
                onClick={() => setTypeFilter(t)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition-colors ${
                  on ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />}
                {t === 'all' ? 'Semua jenis' : TYPE_META[t].label}
                <span className={`rounded-full px-1.5 text-[10.5px] ${on ? 'bg-white/20 dark:bg-slate-900/15' : 'bg-slate-100 dark:bg-slate-700'}`}>{t === 'all' ? orders.length : typeCounts[t]}</span>
              </button>
            );
          })}
        </div>
      )}
      {loadErr && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300">{loadErr}</p>
      )}

      {/* Table card */}
      <Reveal delay={90}>
        <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.25)] dark:border-slate-700/60 dark:bg-slate-800/80">
          {visible.length === 0? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
                {orders.length === 0? (
                  <Inbox className="h-8 w-8" strokeWidth={1.6} />
                ) : (
                  <Search className="h-8 w-8" strokeWidth={1.6} />
                )}
              </span>
              <p className="mt-4 font-display text-[16px] font-extrabold text-slate-900 dark:text-white">
                {orders.length === 0? 'Belum ada riwayat pesanan' : 'Tidak ada yang cocok'}
              </p>
              <p className="mt-1.5 max-w-[260px] text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                {orders.length === 0
                 ? 'Pesanan layanan SMM, Sewa Agen AI, NexSpace, dan lainnya akan muncul otomatis di sini.'
                  : 'Coba kata kunci lain atau ubah filter status / jenis.'}
              </p>
              {orders.length === 0 && (
                <button
                  onClick={() => navigate('/layanan')}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-95"
                >
                  <ReceiptText className="h-4 w-4" strokeWidth={2.2} />
                  Buat Pesanan
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 dark:border-slate-700/60 dark:bg-slate-700/30">
                    <th className="px-5 py-3.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Nama Layanan
                    </th>
                    <th className="px-5 py-3.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      ID Pesanan
                    </th>
                    <th className="px-5 py-3.5 text-right text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Jumlah Order
                    </th>
                    <th className="px-5 py-3.5 text-right text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      Harga
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {visible.map((o) => {
                    const st = STATUS_META[statusOf(o)] ?? STATUS_META.pending;
                    const StIcon = st.icon;
                    const agent = o.type === 'agent_ai' ? agentInfo(o) : null;
                    const meta = TYPE_META[o.type];
                    const TIcon = meta.icon;
                    const title = agent ? agent.title : o.service_name.replace(/^NexSpace:\s*/i, '');
                    return (
                      <tr
                        key={o.id}
                        className="group transition-colors hover:bg-cyan-50/40 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-5 py-4">
                          {meta.to ? (
                            <button
                              type="button"
                              onClick={() => navigate(meta.to!)}
                              className="group/agent block max-w-[260px] text-left"
                              title={meta.hint}
                            >
                              <span className="flex items-center gap-1.5 text-[13px] font-bold text-slate-800 dark:text-slate-200">
                                <TIcon className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" strokeWidth={2.4} />
                                <span className="truncate">{title}</span>
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover/agent:translate-x-0.5 group-hover/agent:text-cyan-500" />
                              </span>
                              {agent?.due && statusOf(o) !== 'batal' && (
                                <span className="mt-0.5 block text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                  Jatuh tempo {agent.due}
                                </span>
                              )}
                            </button>
                          ) : (
                            <p className="max-w-[240px] truncate text-[13px] font-bold text-slate-800 dark:text-slate-200" title={o.service_name}>
                              {o.service_name}
                            </p>
                          )}
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-slate-400 dark:text-slate-500">
                            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold ${st.cls}`}>
                              <StIcon className="h-3 w-3" strokeWidth={2.2} />
                              {statusLabel(o, st.label)}
                            </span>
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{meta.label}</span>
                            {formatDate(o.created_at)}, {formatTime(o.created_at)}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => copyId(o.id, o.order_id)}
                            className="group/copy inline-flex items-center gap-1.5 rounded-lg border-transparent px-2 py-1 font-mono text-[12px] font-bold text-slate-600 transition-all hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                            title="Salin ID"
                          >
                            #{o.order_id}
                            {copiedKey === o.id? (
                              <Check className="h-3 w-3 text-emerald-500" strokeWidth={3} />
                            ) : (
                              <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover/copy:opacity-100" />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-[13px] font-bold text-slate-700 dark:text-slate-300">
                          {qtyLabel(o)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <p className="font-display text-[14px] font-extrabold text-cyan-700 dark:text-cyan-400">
                            {rupiah(o.price)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}