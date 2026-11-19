import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CircleAlert, Copy, Loader2, RefreshCcw, Search, SearchCheck, X } from 'lucide-react';
import AdminShell, { adminCard, adminInput } from './AdminShell';
import { adminDataApi, rupiah, TYPE_LABEL, type AdminOrder, type OrderStatus } from '../../services/adminDataApi';
import { requestRefill } from '../../services/refillApi';
import { checkOrderStatus, statusLabel } from '../../services/orderApi';

const waktu = (ms: number) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ms);
const ST: Record<OrderStatus, string> = {
  selesai: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  proses: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  pending: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  batal: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};
const ST_LABEL: Record<OrderStatus, string> = { selesai: 'Selesai', proses: 'Diproses', pending: 'Pending', batal: 'Batal' };
/** Refill & cek status ke provider hanya untuk pesanan SMM dengan ID provider (angka). */
const providerId = (o: AdminOrder) => (o.type === 'smm' && /^\d+$/.test(o.order_id) ? o.order_id : null);

/** Admin utama: tabel pesanan SEMUA user + aksi refill & cek status provider. */
export default function AdminOrdersPage() {
  const [rows, setRows] = useState<AdminOrder[] | null>(null);
  const [total, setTotal] = useState(0);
  const [omzet, setOmzet] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [info, setInfo] = useState<{ o: AdminOrder; title: string; lines: [string, string][]; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(0);

  const load = useCallback(async () => {
    setRows(null);
    setErr('');
    const r = await adminDataApi.orders({ q: query, type, status, page });
    if (!r.ok) { setRows([]); return setErr(r.message || 'Gagal memuat pesanan.'); }
    setRows(r.orders || []);
    setTotal(r.total || 0);
    setOmzet(r.omzet || 0);
    setPerPage(r.per_page || 25);
  }, [query, type, status, page]);
  useEffect(() => { void load(); }, [load]);

  const refill = async (o: AdminOrder) => {
    const id = providerId(o);
    if (!id || !window.confirm(`Kirim permintaan refill untuk pesanan #${id}?`)) return;
    setBusy(`r${o.id}`);
    const r = await requestRefill(id);
    setBusy('');
    setInfo({ o, title: 'Refill', ok: r.ok, lines: [['Pesan', r.message], ...(r.refillId ? [['ID refill', r.refillId] as [string, string]] : [])] });
  };
  const status_ = async (o: AdminOrder) => {
    const id = providerId(o);
    if (!id) return;
    setBusy(`s${o.id}`);
    const r = await checkOrderStatus(id);
    setBusy('');
    const d = r.orders[0];
    if (!d) return setInfo({ o, title: 'Status pesanan', ok: false, lines: [['Pesan', r.failures[0]?.reason || r.message || 'Pesanan tidak ditemukan di provider.']] });
    setInfo({ o, title: 'Status pesanan', ok: true, lines: [
      ['Status provider', statusLabel(d.orderStatus)], ['Start count', d.startCount === null ? '—' : String(d.startCount)],
      ['Sisa (remains)', d.remains === null ? '—' : String(d.remains)], ['Biaya provider', rupiah(d.charge)], ['Pesan', d.msg],
    ] });
  };
  const setSt = async (o: AdminOrder, s: OrderStatus) => {
    if (!window.confirm(`Ubah status #${o.order_id} menjadi "${ST_LABEL[s]}"? Saldo user tidak berubah otomatis.`)) return;
    const r = await adminDataApi.setOrderStatus(o.id, s);
    if (!r.ok) return setErr(r.message || 'Gagal.');
    setRows((list) => list?.map((x) => (x.id === o.id ? { ...x, status: s } : x)) || null);
    setInfo(null);
  };

  const pages = Math.max(1, Math.ceil(total / perPage));
  const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-cyan-400 hover:text-cyan-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-600 dark:text-slate-300';

  return (
    <AdminShell wide title="Data Pesanan" desc="Pesanan semua user (SMM, Agen AI, NexSpace, Nomor OTP, Upgrade) lengkap dengan data user. Refill & cek status tersedia untuk pesanan SMM." loading={rows === null} onRefresh={() => void load()}>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={`${adminCard} p-4`}><p className="text-[11.5px] text-slate-400">Pesanan (sesuai filter)</p><p className="text-[20px] font-extrabold text-slate-900 dark:text-white">{total.toLocaleString('id-ID')}</p></div>
        <div className={`${adminCard} p-4`}><p className="text-[11.5px] text-slate-400">Omzet (tanpa batal)</p><p className="text-[20px] font-extrabold text-slate-900 dark:text-white">{rupiah(omzet)}</p></div>
      </div>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${adminInput} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari ID pesanan, layanan, nama, username, email…" aria-label="Cari pesanan" />
        </div>
        <select className={`${adminInput} sm:w-40`} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} aria-label="Jenis">
          <option value="">Semua jenis</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className={`${adminInput} sm:w-36`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="">Semua status</option>
          {(Object.keys(ST_LABEL) as OrderStatus[]).map((s) => <option key={s} value={s}>{ST_LABEL[s]}</option>)}
        </select>
        <button className="h-10 rounded-lg bg-cyan-600 px-4 text-[13px] font-bold text-white hover:bg-cyan-700">Cari</button>
      </form>

      {err && <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:bg-rose-950/40"><CircleAlert className="h-4 w-4" /> {err}</p>}

      <div className={`${adminCard} mt-4 overflow-x-auto p-0`}>
        <table className="w-full min-w-[1200px] text-left text-[12.5px]">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800/40">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Layanan</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">ID Pesanan</th>
              <th className="px-4 py-3 text-right">Jumlah</th>
              <th className="px-4 py-3 text-right">Harga</th>
              <th className="px-4 py-3 text-right">Markup</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {rows === null && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {rows?.length === 0 && !err && <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">Tidak ada pesanan.</td></tr>}
            {rows?.map((o) => {
              const pid = providerId(o);
              return (
                <tr key={o.id} className="align-top hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{waktu(o.created_at)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{o.username || o.user_name || `#${o.user_id}`}</p>
                    <p className="text-[11px] text-slate-400">{o.user_name && o.username ? `${o.user_name} · ` : ''}{o.user_email || '—'}</p>
                  </td>
                  <td className="min-w-[260px] break-words px-4 py-3">
                    {/* Seluruh teks layanan ditampilkan (tanpa clamp/truncation) */}
                    <p className="whitespace-pre-line font-semibold text-slate-800 dark:text-slate-100">{o.service_name}</p>
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">{TYPE_LABEL[o.type]}</span>
                  </td>
                  <td className="min-w-[200px] max-w-[320px] break-all px-4 py-3">
                    {/* Target persis seperti yang diinput user (link SMM / nomor WA agen / hostname VPS) */}
                    {o.target
                      ? (/^https?:\/\//i.test(o.target)
                          ? <a href={o.target} target="_blank" rel="noreferrer noopener" className="font-medium text-cyan-700 hover:underline dark:text-cyan-400">{o.target}</a>
                          : <span className="font-medium text-slate-700 dark:text-slate-200">{o.target}</span>)
                      : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => void navigator.clipboard?.writeText(o.order_id).then(() => { setCopied(o.id); window.setTimeout(() => setCopied(0), 1200); })} className="inline-flex items-center gap-1 font-mono text-[12px] font-bold text-slate-600 hover:text-cyan-700 dark:text-slate-300" title="Salin ID">
                      #{o.order_id} {copied === o.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-40" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{o.quantity.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-100">{rupiah(o.price)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600" title={o.cost !== null ? `Harga provider ${rupiah(o.cost)}` : 'Belum tercatat (pesanan lama / non-SMM)'}>
                    {o.markup !== null ? rupiah(o.markup) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${ST[o.status] || ST.pending}`}>{ST_LABEL[o.status] || o.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1.5">
                      <button type="button" className={iconBtn} disabled={!pid || !!busy} onClick={() => void refill(o)} aria-label={`Refill pesanan ${o.order_id}`} title={pid ? 'Refill' : 'Refill hanya untuk pesanan SMM'}>
                        {busy === `r${o.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                      </button>
                      <button type="button" className={iconBtn} disabled={!pid || !!busy} onClick={() => void status_(o)} aria-label={`Cek status pesanan ${o.order_id}`} title={pid ? 'Cek status di provider' : 'Cek status hanya untuk pesanan SMM'}>
                        {busy === `s${o.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12.5px] text-slate-500">
        <span>Halaman {page} dari {pages}</span>
        <div className="flex gap-1.5">
          <button className={iconBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Halaman sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
          <button className={iconBtn} disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Halaman berikutnya"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {info && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setInfo(null)}>
          <div role="dialog" aria-modal="true" aria-label={info.title} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{info.title}</p>
                <p className="font-mono text-[16px] font-bold text-slate-900 dark:text-white">#{info.o.order_id}</p>
              </div>
              <button onClick={() => setInfo(null)} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <p className={`mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-bold ${info.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{info.ok ? <Check className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />} {info.ok ? 'Berhasil' : 'Gagal'}</p>
            <dl className="mt-3 space-y-2 text-[13px]">
              {info.lines.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-slate-400">{k}</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-100">{v}</dd></div>)}
            </dl>
            <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-2 text-[11.5px] text-slate-500">Sesuaikan status di Boosteryuk (saldo user tidak berubah otomatis):</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ST_LABEL) as OrderStatus[]).map((s) => (
                  <button key={s} disabled={info.o.status === s} onClick={() => void setSt(info.o, s)} className={`rounded-lg px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-40 ${ST[s]}`}>{ST_LABEL[s]}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
