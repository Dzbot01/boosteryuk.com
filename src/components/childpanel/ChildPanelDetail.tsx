import { useCallback, useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { childPanelApi, type ChildPanel, type PanelDetail } from '../../services/childPanelApi';
import { rupiah } from '../../services/adminDataApi';
const date = (s?: string | null) => s ? new Date(s.replace(' ', 'T')).toLocaleString('id-ID') : '—';
export default function ChildPanelDetail({ panel, onClose }: {panel: ChildPanel; onClose: () => void}) {
  const [data, setData] = useState<PanelDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const load = useCallback(async () => {
    const r = await childPanelApi.detail(panel.id);
    if (!r.ok) return setError(r.message || 'Gagal memuat detail.');
    setData(r);
  }, [panel.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose,busy]);
  const credit = async () => {
    if (busy) return;
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || note.trim().length < 3) return setError('Isi nominal positif dan catatan minimal 3 karakter.');
    if (!window.confirm(`Tambahkan ${rupiah(Number(amount))} ke pendapatan ${panel.hostname}? Saldo debug ini dapat dicairkan.`)) return;
    setBusy(true); setError('');
    const r = await childPanelApi.credit(panel.id, Number(amount), note.trim());
    setBusy(false);
    if (!r.ok) return setError(r.message || 'Gagal menambah saldo.');
    setData(r); setAmount(''); setNote('');
  };
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !busy && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="panel-detail-title" onClick={e => e.stopPropagation()} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
      <div className="flex justify-between gap-3"><div><h2 id="panel-detail-title" className="text-lg font-bold">Detail {panel.name}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{panel.hostname}</p></div><button disabled={busy} onClick={onClose} aria-label="Tutup"><X/></button></div>
      {!data && !error && <Loader2 className="my-6 animate-spin"/>}
      {error && <p role="alert" className="my-3 text-sm text-rose-600">{error}</p>}
      {data && <>
        <dl className="my-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">{[
          ['Email pemilik',data.panel.owner_email || '—'], ['Dibuat',date(data.panel.created_at)],
          ['Awal upgrade EXTRA',date(data.panel.extra_started)], ['Expired panel',data.panel.expires_at ? date(data.panel.expires_at) : 'Tanpa batas waktu (panel admin)'],
          ['Total user yang login',`${(data.users_total ?? 0).toLocaleString('id-ID')} user`],
          ['Markup Merchant',`${panel.config?.merchantMarkupPct||0}%`],['Markup SMM',`${panel.markup_smm_pct}%`],['Markup Agen AI',`${panel.markup_agent_pct}%`],['Markup OTP',`${panel.markup_otp_pct || 0}%`],
          ['Total pendapatan (termasuk debug)',rupiah(data.balance.earned)],['Total tambahan debug',rupiah(data.balance.debug_credit || 0)],['Pendapatan pesanan',rupiah(data.balance.earned - (data.balance.debug_credit || 0))], ['Bisa dicairkan',rupiah(data.balance.available)],['Tertahan',rupiah(data.balance.held)],['Withdraw pending',rupiah(data.balance.pending)],['Sudah dibayar',rupiah(data.balance.paid)],
        ].map(([k,v]) => <div key={k}><dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt><dd className="break-all font-semibold">{v}</dd></div>)}</dl>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Awal EXTRA diambil dari tanggal upgrade pertama akun; expired memakai masa aktif panel yang tersimpan, termasuk perpanjangan. Total user yang login dihitung dari aktivitas akun (unregister maupun visitor) yang tercatat lewat panel ini.</p>
        <form onSubmit={e => { e.preventDefault(); void credit(); }} className="space-y-3 rounded-xl border border-amber-300 p-4">
          <h3 className="font-bold">Tambah saldo pendapatan (debug)</h3><p className="text-xs text-amber-700">Saldo ini masuk saldo tersedia dan dapat di-withdraw. Semua penambahan dicatat dengan ID admin dan catatan.</p>
          <input required type="number" min="1" max="100000000" step="0.01" aria-label="Nominal tambahan" placeholder="Nominal Rupiah" value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded border p-2 dark:bg-slate-800"/>
          <input required minLength={3} maxLength={255} aria-label="Catatan debug" placeholder="Catatan / tujuan debug" value={note} onChange={e => setNote(e.target.value)} className="w-full rounded border p-2 dark:bg-slate-800"/>
          <button disabled={busy} className="rounded bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Menyimpan…' : 'Tambah saldo'}</button>
        </form>
        <h3 className="mb-2 mt-5 font-bold">Riwayat penambahan debug (50 terbaru)</h3><ul className="divide-y text-xs">{data.credits.map(c => <li key={c.id} className="py-2">{date(c.created_at)} · Admin #{c.admin_id} · <b>{rupiah(Number(c.amount))}</b><p>{c.note}</p></li>)}{!data.credits.length && <li>Belum ada penambahan debug.</li>}</ul>
      </>}
    </section>
  </div>;
}
