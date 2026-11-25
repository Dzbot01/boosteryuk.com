import { useCallback, useEffect, useState } from 'react';
import { CircleAlert, Loader2, Radio } from 'lucide-react';
import AdminShell, { adminCard } from './AdminShell';
import { adminDataApi, rupiah, type AdminDeposit, type ProfitData } from '../../services/adminDataApi';

const waktu = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? s : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(d);
};
const REFRESH_MS = 15000;

/** Admin utama: 10 deposit terbaru semua user, sinkron dengan database (diperbarui otomatis tiap 15 detik). */
export default function AdminDepositPage() {
  const [rows, setRows] = useState<AdminDeposit[] | null>(null);
  const [stats, setStats] = useState<ProfitData['deposits'] | null>(null);
  const [err, setErr] = useState('');
  const [at, setAt] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminDataApi.deposits();
    setLoading(false);
    if (!r.ok) return setErr(r.message || 'Gagal memuat deposit.');
    setErr('');
    setRows(r.deposits || []);
    setStats(r.stats || null);
    setAt(new Date().toLocaleTimeString('id-ID'));
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [load]);

  // Top up manual admin TIDAK dihitung (permintaan admin): total halaman ini murni deposit
  // gateway. Baris manual tetap tampil di tabel sebagai catatan, tanpa ikut menjumlah.
  const today = stats ? stats.today : null;
  const month = stats ? stats.month : null;

  return (
    <AdminShell title="Data Deposit" desc="10 deposit terbaru dari semua user, langsung dari database. Top up manual admin tampil sebagai baris catatan tetapi TIDAK dihitung pada total." loading={loading} onRefresh={() => void load()}>
      <p className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600"><Radio className="h-3.5 w-3.5 animate-pulse" /> Realtime · diperbarui tiap 15 detik{at && ` · terakhir ${at}`}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className={`${adminCard} p-4`}><p className="text-[11.5px] text-slate-400">Deposit hari ini</p><p className="text-[20px] font-extrabold text-slate-900 dark:text-white">{rupiah(today)}</p></div>
        <div className={`${adminCard} p-4`}><p className="text-[11.5px] text-slate-400">Deposit bulan ini</p><p className="text-[20px] font-extrabold text-slate-900 dark:text-white">{rupiah(month)}</p></div>
      </div>

      {err && <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:bg-rose-950/40"><CircleAlert className="h-4 w-4" /> {err}</p>}

      <div className={`${adminCard} mt-4 overflow-x-auto p-0`}>
        <table className="w-full min-w-[720px] text-left text-[12.5px]">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800/40">
            <tr>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Metode</th>
              <th className="px-4 py-3">Referensi</th>
              <th className="px-4 py-3 text-right">Nominal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {rows === null && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {rows?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Belum ada deposit tercatat di database.</td></tr>}
            {rows?.map((r, i) => (
              <tr key={`${r.ref || ''}-${r.time}-${i}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{waktu(r.time)}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.username || r.user_name || '—'}</p>
                  <p className="text-[11px] text-slate-400">{r.user_email || '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.source === 'manual' ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'}`}>
                    {r.source === 'manual' ? 'Manual admin' : r.method || 'Gateway'}
                  </span>
                  {r.note && <p className="mt-1 text-[11px] text-slate-400">{r.note}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-[11.5px] text-slate-500">{r.ref || '—'}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">+{rupiah(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11.5px] text-slate-500">Deposit gateway dicatat oleh callback.php ke tabel <code>deposits</code>; riwayat lama dari tripay_log.txt diimpor otomatis.</p>
    </AdminShell>
  );
}
