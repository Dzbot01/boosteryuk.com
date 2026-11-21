import { useCallback, useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { streakCall, TITLE_CATALOG, type EarnedTitle } from '../services/streakApi';
import RewardSheet from './RewardSheet';
import RewardAnimation from './RewardAnimation';
export default function OwnedTitles() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);const [rows, setRows] = useState<EarnedTitle[]>([]);
  const [loading, setLoading] = useState(false);const [error, setError] = useState('');
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    let alive = true;setLoading(true);setError('');setRows([]);
    streakCall('get').then(r => { if (alive) setRows(r.state.titles); }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat title.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [open, user?.id]);
  return <><button onClick={() => setOpen(true)} className="mt-5 flex w-full items-center gap-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-5 text-left dark:border-violet-900 dark:bg-violet-950/20"><Award className="h-8 w-8 text-violet-500" /><span><span className="block font-extrabold">Title dimiliki</span><span className="mt-1 block text-xs text-slate-500">Koleksi title &amp; badge dari penyelesaian event →</span></span></button>
    {open && <RewardSheet title="Title dimiliki" onClose={close}>
      {loading && <p className="py-8 text-center text-sm">Memuat koleksi akun…</p>}{error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
      {!loading && !error && !rows.length && <p className="py-8 text-center text-sm text-slate-500">Belum ada title. Selesaikan Daily Streak 7 hari atau satu sesi game Tahun Baru untuk mendapatkannya.</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{rows.filter(row => TITLE_CATALOG[row.code]).map(row => { const title = TITLE_CATALOG[row.code];return <article key={row.code} className="rounded-2xl border border-slate-200 p-4 text-center dark:border-slate-700"><div className="mx-auto h-36 w-36"><RewardAnimation src={title.src} label={title.name} /></div><h3 className="font-extrabold">{title.name}</h3><p className="mt-2 text-xs text-slate-500">{title.description}</p><p className="mt-3 text-[10px] text-violet-500">Didapat {new Date(row.earned_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })} · Permanen</p></article>; })}</div>
    </RewardSheet>}
  </>;
}
