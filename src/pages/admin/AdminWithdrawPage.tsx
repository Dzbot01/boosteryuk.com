import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, X, Check, CircleAlert, Loader2, Copy, ExternalLink, RefreshCw, MailWarning } from 'lucide-react';
import Reveal from '../../components/Reveal';
import Seo from '../../components/Seo';
import { WD_STATUS } from '../../components/childpanel/WithdrawPanel';
import { withdrawApi, type WdAdminRow, type WdBalance, type WdOrder, type WdRow, type WdStatus } from '../../services/childPanelApi';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const waktu = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? s : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};
type Filter = WdStatus | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'Menunggu' },
  { id: 'paid', label: 'Dibayar' },
  { id: 'rejected', label: 'Ditolak' },
  { id: 'all', label: 'Semua' },
];

/** Admin utama: daftar permintaan pencairan pemilik child panel. */
export default function AdminWithdrawPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('pending');
  const [rows, setRows] = useState<WdAdminRow[] | null>(null);
  const [counts, setCounts] = useState<Record<WdStatus, number>>({ pending: 0, paid: 0, rejected: 0 });
  const [totals, setTotals] = useState<Record<WdStatus, number>>({ pending: 0, paid: 0, rejected: 0 });
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async (f: Filter) => {
    setErr('');
    setRows(null);
    const r = await withdrawApi.list(f);
    if (!r.ok) {
      setRows([]);
      return setErr(r.message || 'Gagal memuat permintaan withdraw.');
    }
    setRows(r.requests || []);
    if (r.counts) setCounts(r.counts);
    if (r.totals) setTotals(r.totals);
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.ok ? 4000 : 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80';

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6">
      <Seo title="Withdraw Request" noindex />
      <Reveal>
        <button
          onClick={() => navigate('/admin')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> Admin Panel
        </button>
      </Reveal>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white">Withdraw Request</h1>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            Pencairan pendapatan markup pemilik child panel. Transfer manual, lalu tandai <b>Sudah dibayar</b>.
          </p>
        </div>
        <button onClick={() => void load(filter)} aria-label="Muat ulang" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${rows === null ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        {(['pending', 'paid', 'rejected'] as WdStatus[]).map((s) => (
          <div key={s} className={card}>
            <p className="text-[11.5px] text-slate-400">{s === 'pending' ? 'Menunggu transfer' : s === 'paid' ? 'Sudah dibayar' : 'Ditolak'}</p>
            <p className="text-[18px] font-extrabold text-slate-900 dark:text-white">{counts[s]}</p>
            <p className="text-[11.5px] text-slate-500">{rupiah(totals[s])}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-1.5 overflow-x-auto" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${
              filter === f.id ? 'bg-cyan-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {f.label}
            {f.id !== 'all' && counts[f.id as WdStatus] > 0 && (
              <span className={`rounded-full px-1.5 text-[10.5px] ${filter === f.id ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-700'}`}>{counts[f.id as WdStatus]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {rows === null && <div className={`${card} h-24 animate-pulse`} />}
        {err && (
          <div className={`${card} flex items-center gap-2 text-[13px] text-rose-600`}>
            <CircleAlert className="h-4 w-4" /> {err}
          </div>
        )}
        {rows?.length === 0 && !err && <div className={`${card} py-10 text-center text-[13.5px] text-slate-500`}>Tidak ada permintaan di kategori ini.</div>}
        {rows?.map((w) => (
          <button key={w.id} onClick={() => setOpenId(w.id)} className={`${card} flex w-full flex-wrap items-center gap-4 text-left transition hover:border-cyan-300 hover:shadow-md`}>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
              <Banknote className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-bold text-slate-900 dark:text-white">
                {rupiah(w.net_amount)} · {w.method_label}
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${WD_STATUS[w.status].cls}`}>{WD_STATUS[w.status].label}</span>
              </p>
              <p className="truncate text-[12.5px] text-slate-600 dark:text-slate-300">
                {w.panel_name || 'Panel #' + w.child_panel_id} · {w.owner_name || '—'} ({w.owner_email || '—'})
              </p>
              <p className="text-[11.5px] text-slate-400">#{w.id} · {waktu(w.created_at)}</p>
            </div>
            <span className="text-[12px] font-bold text-cyan-700 dark:text-cyan-400">Detail</span>
          </button>
        ))}
      </div>

      {openId !== null && (
        <WithdrawModal
          id={openId}
          onClose={() => setOpenId(null)}
          onDone={(msg) => {
            setOpenId(null);
            setToast({ ok: true, msg });
            void load(filter);
          }}
        />
      )}

      {toast && (
        <div role="alert" className="fixed inset-x-4 top-5 z-[90] mx-auto flex max-w-sm items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {toast.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.8} /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
          <p className="flex-1 text-slate-700 dark:text-slate-200">{toast.msg}</p>
          <button onClick={() => setToast(null)} aria-label="Tutup" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function WithdrawModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [data, setData] = useState<{ request: WdAdminRow; balance: WdBalance; history: WdRow[]; orders: WdOrder[] } | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'' | 'paid' | 'rejected'>('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    void (async () => {
      const r = await withdrawApi.detail(id);
      if (!r.ok || !r.request) return setErr(r.message || 'Gagal memuat detail.');
      setData({ request: r.request, balance: r.balance!, history: r.history || [], orders: r.orders || [] });
    })();
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const copy = (label: string, v: string) => {
    void navigator.clipboard?.writeText(v).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1500);
    });
  };

  const act = async (status: 'paid' | 'rejected') => {
    if (!data) return;
    if (status === 'rejected' && note.trim().length < 3) return setErr('Tulis alasan penolakan di kolom catatan.');
    const w = data.request;
    const q = status === 'paid'
      ? `Sudah mentransfer ${rupiah(w.net_amount)} ke ${w.method_label} ${w.account_number} a.n. ${w.account_name}?`
      : `Tolak permintaan #${w.id}? Saldo pendapatan pemilik akan dikembalikan.`;
    if (!window.confirm(q)) return;
    setErr('');
    setBusy(status);
    const r = await withdrawApi.update(w.id, status, note.trim());
    setBusy('');
    if (!r.ok) return setErr(r.message || 'Gagal memproses.');
    onDone(r.message || 'Tersimpan.');
  };

  const w = data?.request;
  // Saldo saat ini sudah dikurangi permintaan pending ini; nilai negatif = pendapatan berkurang (pesanan dibatalkan).
  const shortfall = (data?.balance.raw_available ?? 0) < 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detail withdraw"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Withdraw #{id}</p>
            <h2 className="text-[19px] font-extrabold text-slate-900 dark:text-white">{w ? rupiah(w.net_amount) : 'Memuat…'}</h2>
          </div>
          <button onClick={onClose} disabled={!!busy} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!data && !err && <div className="mt-4 h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />}

        {w && data && (
          <>
            <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${WD_STATUS[w.status].cls}`}>{WD_STATUS[w.status].label}</span>

            <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 dark:border-cyan-800/50 dark:bg-cyan-900/20">
              <p className="text-[11.5px] font-semibold text-cyan-800 dark:text-cyan-300">Transfer ke</p>
              <p className="mt-1 text-[15px] font-bold text-slate-900 dark:text-white">{w.method_label}{w.bank_name ? ` — ${w.bank_name}` : ''}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  { k: 'Nomor', v: w.account_number },
                  { k: 'Atas nama', v: w.account_name },
                  { k: 'Nominal transfer', v: String(Math.round(w.net_amount)) },
                ].map((x) => (
                  <button key={x.k} type="button" onClick={() => copy(x.k, x.v)} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-left dark:bg-slate-800">
                    <span className="min-w-0">
                      <span className="block text-[10.5px] text-slate-400">{x.k}</span>
                      <span className="block truncate text-[13.5px] font-bold text-slate-800 dark:text-slate-100">{x.k === 'Nominal transfer' ? rupiah(w.net_amount) : x.v}</span>
                    </span>
                    {copied === x.k ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-400" />}
                  </button>
                ))}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-3">
              <div><dt className="text-[11px] text-slate-400">Child panel</dt><dd className="font-semibold">{w.panel_name || '—'}</dd></div>
              <div className="col-span-2 sm:col-span-1"><dt className="text-[11px] text-slate-400">Subdomain</dt><dd>
                {w.hostname ? <a className="inline-flex items-center gap-1 font-semibold text-cyan-700 hover:underline dark:text-cyan-400" href={`https://${w.hostname}`} target="_blank" rel="noreferrer">{w.hostname}<ExternalLink className="h-3 w-3" /></a> : '—'}
              </dd></div>
              <div><dt className="text-[11px] text-slate-400">Pemilik</dt><dd className="font-semibold">{w.owner_name || '—'}</dd></div>
              <div className="col-span-2 sm:col-span-1"><dt className="text-[11px] text-slate-400">Email</dt><dd className="truncate font-semibold">{w.owner_email || '—'}</dd></div>
              <div><dt className="text-[11px] text-slate-400">Ditarik</dt><dd className="font-semibold">{rupiah(w.amount)}</dd></div>
              <div><dt className="text-[11px] text-slate-400">Biaya admin</dt><dd className="font-semibold">{rupiah(w.fee)}</dd></div>
              <div><dt className="text-[11px] text-slate-400">Diajukan</dt><dd className="font-semibold">{waktu(w.created_at)}</dd></div>
              {w.processed_at && <div><dt className="text-[11px] text-slate-400">Diproses</dt><dd className="font-semibold">{waktu(w.processed_at)}</dd></div>}
              {w.admin_note && <div className="col-span-2 sm:col-span-3"><dt className="text-[11px] text-slate-400">Catatan</dt><dd className="font-semibold">{w.admin_note}</dd></div>}
            </dl>
            {!w.email_sent && w.status === 'pending' && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-amber-600"><MailWarning className="h-3.5 w-3.5" /> Email notifikasi ke admin tidak terkirim (cek resend_key) — permintaan tetap tersimpan.</p>
            )}

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[12px] dark:bg-slate-800/60">
              <p className="font-bold text-slate-700 dark:text-slate-200">Saldo pendapatan panel (verifikasi)</p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                <span>Total: <b>{rupiah(data.balance.earned)}</b></span>
                <span>Tertahan: <b>{rupiah(data.balance.held)}</b></span>
                <span>Diproses: <b>{rupiah(data.balance.pending)}</b></span>
                <span>Dibayar: <b>{rupiah(data.balance.paid)}</b></span>
              </div>
              {shortfall && (
                <p className="mt-2 font-semibold text-rose-600">Perhatian: ada pesanan yang dibatalkan setelah pengajuan — pendapatan bersih kini lebih kecil dari yang dicairkan. Pertimbangkan menolak.</p>
              )}
            </div>

            {data.orders.length > 0 && (
              <details className="mt-3 text-[12px]">
                <summary className="cursor-pointer font-semibold text-slate-600 dark:text-slate-300">Pesanan terbaru panel ({data.orders.length})</summary>
                <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                  {data.orders.map((o) => (
                    <li key={`${o.kind}-${o.order_id}`} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="min-w-0 truncate">{o.service_name} <span className="text-slate-400">· {o.name || '—'} · {o.status || '—'}</span></span>
                      <span className="shrink-0 font-semibold text-emerald-600">+{rupiah(o.profit)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {w.status === 'pending' && (
              <>
                <label className="mt-4 block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-slate-500">Catatan (opsional untuk dibayar, wajib untuk ditolak)</span>
                  <input
                    value={note}
                    maxLength={255}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="mis. Ref transfer DANA 1234 / alasan penolakan"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  />
                </label>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button onClick={() => void act('rejected')} disabled={!!busy} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 px-4 text-[13px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800/50 dark:hover:bg-rose-900/20">
                    {busy === 'rejected' && <Loader2 className="h-4 w-4 animate-spin" />} Tolak
                  </button>
                  <button onClick={() => void act('paid')} disabled={!!busy} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {busy === 'paid' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Sudah dibayar
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {err && (
          <p role="alert" className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600">
            <CircleAlert className="h-4 w-4" /> {err}
          </p>
        )}
      </div>
    </div>
  );
}
