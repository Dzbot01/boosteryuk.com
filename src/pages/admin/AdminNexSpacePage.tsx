import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, CircleAlert, Crown, Loader2, RefreshCw, Wand2, X } from 'lucide-react';
import Seo from '../../components/Seo';
import { nexspaceApi, type NxAdminOrder } from '../../services/nexspaceApi';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const waktu = (s: string | null) => (s ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(s.replace(' ', 'T'))) : '—');
const FILTERS = [
  { id: 'pending', label: 'Menunggu' },
  { id: 'ready', label: 'Terkirim' },
  { id: 'rejected', label: 'Ditolak' },
  { id: 'all', label: 'Semua' },
];
const genPass = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const r = new Uint32Array(14);
  crypto.getRandomValues(r);
  return Array.from(r, (x) => a[x % a.length]).join('');
};

/** Admin utama: NexSpace Pro Request — beri data login ke pemesan (otomatis tampil di portal user + email). */
export default function AdminNexSpacePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState<NxAdminOrder[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [def, setDef] = useState({ host: '185.205.222.202', port: 10892 });
  const [open, setOpen] = useState<NxAdminOrder | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async (f: string) => {
    setRows(null);
    const r = await nexspaceApi.adminList(f);
    setRows(r.ok ? r.requests || [] : []);
    if (r.counts) setCounts(r.counts);
    if (r.default_host) setDef({ host: r.default_host, port: r.default_port || 22 });
  }, []);
  useEffect(() => { void load(filter); }, [filter, load]);

  const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80';
  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6">
      <Seo title="NexSpace Pro Request" noindex />
      <button onClick={() => navigate('/admin')} className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
        <ArrowLeft className="h-4 w-4" /> Admin Panel
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white">NexSpace Pro Request</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">Pesanan Pro yang menunggu data login. Data yang dikirim langsung tampil di Portal Server pemesan dan pemesan diberi tahu lewat email.</p>
        </div>
        <button onClick={() => void load(filter)} aria-label="Muat ulang" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${rows === null ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-5 flex gap-1.5 overflow-x-auto" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${filter === f.id ? 'bg-cyan-600 text-white' : 'border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
            {f.label}{counts[f.id] ? <span className="rounded-full bg-black/10 px-1.5 text-[10.5px]">{counts[f.id]}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {rows === null && <div className={`${card} h-24 animate-pulse`} />}
        {rows?.length === 0 && <div className={`${card} py-10 text-center text-[13.5px] text-slate-500`}>Tidak ada pesanan di kategori ini.</div>}
        {rows?.map((o) => (
          <button key={o.id} onClick={() => setOpen(o)} className={`${card} flex w-full flex-wrap items-center gap-4 text-left hover:border-cyan-300`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30"><Crown className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[15px] font-bold text-slate-900 dark:text-white">{o.username}</p>
              <p className="text-[12.5px] text-slate-600 dark:text-slate-300">{o.plan_name} · {o.months} bln · {rupiah(o.price)}</p>
              <p className="text-[11.5px] text-slate-400">{o.buyer_name || '—'} ({o.buyer_email || '—'}) · {waktu(o.created_at)} · {o.claimed ? 'kode sudah dimasukkan' : 'kode belum dimasukkan'}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${o.status === 'pending' ? 'bg-amber-50 text-amber-700' : o.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {o.status === 'pending' ? 'Menunggu' : o.status === 'ready' ? 'Terkirim' : 'Ditolak'}
            </span>
          </button>
        ))}
      </div>

      {open && <DeliverModal o={open} def={def} onClose={() => setOpen(null)} onDone={(m) => { setOpen(null); setToast(m); void load(filter); window.setTimeout(() => setToast(''), 4000); }} />}
      {toast && (
        <div role="alert" className="fixed inset-x-4 top-5 z-[90] mx-auto flex max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <Check className="h-4 w-4 text-emerald-600" /> {toast}
        </div>
      )}
    </div>
  );
}

function DeliverModal({ o, def, onClose, onDone }: { o: NxAdminOrder; def: { host: string; port: number }; onClose: () => void; onDone: (m: string) => void }) {
  const [host, setHost] = useState(o.login?.host || def.host);
  const [port, setPort] = useState(String(o.login?.port || def.port));
  const [lu, setLu] = useState(o.login?.user || 'root');
  const [pw, setPw] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const pending = o.status === 'pending';
  const inp = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white';

  const deliver = async () => {
    if (!window.confirm(`Kirim data login ke ${o.buyer_email}? Data langsung tampil di Portal Server pemesan.`)) return;
    setBusy('d'); setErr('');
    const r = await nexspaceApi.adminDeliver({ id: o.id, host: host.trim(), port: Number(port), login_user: lu.trim(), password: pw, note: note.trim() });
    setBusy('');
    if (!r.ok) return setErr(r.message || 'Gagal.');
    onDone(r.message || 'Terkirim.');
  };
  const reject = async () => {
    if (reason.trim().length < 3) return setErr('Tulis alasan penolakan.');
    if (!window.confirm(`Tolak pesanan ${o.username}? Saldo ${rupiah(o.price)} dikembalikan.`)) return;
    setBusy('r'); setErr('');
    const r = await nexspaceApi.adminReject(o.id, reason.trim());
    setBusy('');
    if (!r.ok) return setErr(r.message || 'Gagal.');
    onDone(r.message || 'Ditolak.');
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Detail NexSpace Pro" onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{o.order_id}</p>
            <h2 className="font-mono text-[19px] font-extrabold text-slate-900 dark:text-white">{o.username}</h2>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
          <div><dt className="text-[11px] text-slate-400">Paket</dt><dd className="font-semibold">{o.plan_name}</dd></div>
          <div><dt className="text-[11px] text-slate-400">Durasi</dt><dd className="font-semibold">{o.months} bulan · s/d {o.expires_at}</dd></div>
          <div><dt className="text-[11px] text-slate-400">Pemesan</dt><dd className="font-semibold">{o.buyer_name}</dd></div>
          <div><dt className="text-[11px] text-slate-400">Email</dt><dd className="truncate font-semibold">{o.buyer_email}</dd></div>
          <div><dt className="text-[11px] text-slate-400">Dibayar</dt><dd className="font-semibold">{rupiah(o.price)}</dd></div>
          <div><dt className="text-[11px] text-slate-400">Kode unik</dt><dd className="font-mono font-semibold">{o.code} {o.claimed ? '✓' : ''}</dd></div>
        </dl>

        {pending ? (
          <>
            <p className="mt-5 text-[13px] font-bold text-slate-800 dark:text-slate-100">Data login</p>
            <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
              <input className={inp} value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host / IP" aria-label="Host" />
              <input className={inp} value={port} onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} placeholder="Port" aria-label="Port" inputMode="numeric" />
              <input className={`${inp} font-mono`} value={lu} onChange={(e) => setLu(e.target.value)} placeholder="Username" aria-label="Username login" />
              <span />
            </div>
            <div className="mt-2 flex gap-2">
              <input className={`${inp} font-mono`} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" aria-label="Password" />
              <button type="button" onClick={() => setPw(genPass())} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 text-[12px] font-bold text-slate-600 dark:border-slate-600 dark:text-slate-300"><Wand2 className="h-3.5 w-3.5" /> Buat</button>
            </div>
            <input className={`${inp} mt-2`} value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="Catatan untuk pemesan (opsional)" />
            <p className="mt-2 text-[11.5px] text-slate-500">Password disimpan terenkripsi dan hanya tampil di Portal Server pemesan (tidak dikirim lewat email).</p>
            <button onClick={() => void deliver()} disabled={!!busy || pw.length < 6} className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[13.5px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {busy === 'd' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Kirim data login & beri tahu pemesan
            </button>
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <input className={inp} value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="Alasan penolakan (wajib bila menolak)" />
              <button onClick={() => void reject()} disabled={!!busy} className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg border border-rose-200 px-4 text-[12.5px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                {busy === 'r' && <Loader2 className="h-4 w-4 animate-spin" />} Tolak & kembalikan saldo
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[12.5px] dark:bg-slate-800">
            {o.login ? <p className="font-mono">{o.login.ssh}{o.login.password ? ` · ${o.login.password}` : ''}</p> : null}
            {o.note && <p className="mt-1 text-slate-500">Catatan: {o.note}</p>}
            <p className="mt-1 text-slate-500">Diproses {waktu(o.delivered_at)}{o.viewed ? ' · sudah diambil pemesan' : ''}</p>
          </div>
        )}
        {err && <p role="alert" className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600"><CircleAlert className="h-4 w-4" /> {err}</p>}
      </div>
    </div>
  );
}
