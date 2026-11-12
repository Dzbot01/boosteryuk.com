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
} from 'lucide-react';
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
type OrderFromDB = {
  id: number;
  order_id: string;
  service_name: string;
  quantity: number;
  price: number;
  status: 'pending' | 'proses' | 'selesai' | 'batal';
  created_at: number;
}

export default function RiwayatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<number | null>(null);

  useEffect(() => {
  if(!user?.token) { setLoading(false); return; }
  fetch('https://cekidku.my.id/api/riwayat_pesanan.php?token=' + user.token)
 .then(res => res.json())
 .then(data => {
      setOrders(data.orders || []);
      setLoading(false);
    }).catch(() => {
      setOrders([]);
      setLoading(false);
    })
}, [user]);

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

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'selesai', label: 'Selesai' },
    { id: 'proses', label: 'Diproses' },
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
          <div className="flex gap-1.5">
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
                 ? 'Pesanan yang berhasil dibuat di halaman Layanan akan muncul otomatis di sini.'
                  : 'Coba kata kunci lain atau ubah filter status.'}
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
                    const st = STATUS_META[statusOf(o)];
                    const StIcon = st.icon;
                    return (
                      <tr
                        key={o.id}
                        className="group transition-colors hover:bg-cyan-50/40 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-5 py-4">
                          <p className="max-w-[220px] truncate text-[13px] font-bold text-slate-800 dark:text-slate-200">
                            {o.service_name}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-400 dark:text-slate-500">
                            <StIcon className="h-3 w-3" strokeWidth={2.2} />
                            {st.label} · {formatDate(o.created_at)}, {formatTime(o.created_at)}
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
                          {formatQty(o.quantity)}
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