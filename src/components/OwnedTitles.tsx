import { useEffect, useId, useState } from 'react';
import { Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { streakCall, TITLE_CATALOG, type EarnedTitle } from '../services/streakApi';
import RewardAnimation from './RewardAnimation';

/** Owned titles are always visible on the profile, not hidden behind a modal. */
export default function OwnedTitles() {
  const { user } = useAuth();const heading = useId();
  const [rows, setRows] = useState<EarnedTitle[]>([]);
  const [loading, setLoading] = useState(true);const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;setLoading(true);setError('');setRows([]);
    streakCall('get').then(r => { if (alive) setRows(r.state.titles); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat title.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.id, reload]);
  const owned = rows.filter(row => TITLE_CATALOG[row.code]);
  return <section aria-labelledby={heading} className="mt-6 rounded-[28px] border border-violet-200 bg-white p-5 dark:border-violet-900/60 dark:bg-slate-900 sm:p-6">
    <header className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800"><Award className="h-7 w-7 text-violet-500" /><div><h2 id={heading} className="text-lg font-extrabold">Title dimiliki</h2><p className="mt-1 text-xs text-slate-500">Koleksi pencapaian dan badge event milikmu.</p></div>{!loading && !error && <span className="ml-auto rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600 dark:bg-violet-950/50">{owned.length}</span>}</header>
    {loading && <p role="status" className="py-8 text-center text-sm text-slate-500">Memuat koleksi akun…</p>}
    {error && <div role="alert" className="py-6 text-center text-sm text-rose-500">{error}<button onClick={() => setReload(n => n + 1)} className="ml-2 font-bold underline">Coba lagi</button></div>}
    {!loading && !error && !owned.length && <p className="py-8 text-center text-sm leading-relaxed text-slate-500">Belum ada title. Selesaikan Daily Streak 7 hari atau satu sesi game Tahun Baru untuk mendapatkannya.</p>}
    <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3">{owned.map(row => {
      const title = TITLE_CATALOG[row.code];
      return <article key={row.code} className="flex flex-col items-center rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/70 to-white p-3 text-center dark:border-slate-700 dark:from-violet-950/20 dark:to-slate-900">
        <div className="h-20 w-20 sm:h-24 sm:w-24"><RewardAnimation src={title.src} label={title.name} /></div>
        <h3 className="mt-2 text-xs font-extrabold sm:text-sm">{title.name}</h3><p className="mt-2 max-w-sm text-[10px] leading-relaxed text-slate-500">{title.description}</p>
        <p className="mt-3 text-[9px] font-semibold text-violet-500">Didapat {new Date(row.earned_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })} · Permanen</p>
      </article>;
    })}</div>
  </section>;
}
