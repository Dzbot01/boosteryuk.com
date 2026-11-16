import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Seo from '../../components/Seo';

/** Kerangka halaman admin: tombol kembali, judul, deskripsi, tombol muat ulang. */
export default function AdminShell({ title, desc, loading, onRefresh, children, wide }: {
  title: string; desc: ReactNode; loading?: boolean; onRefresh?: () => void; children: ReactNode; wide?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <div className={`mx-auto ${wide ? 'max-w-6xl' : 'max-w-4xl'} px-4 pb-32 pt-10 sm:px-6`}>
      <Seo title={title} noindex />
      <button onClick={() => navigate('/admin')} className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> Admin Panel
      </button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} aria-label="Muat ulang" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export const adminCard = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80';
export const adminInput = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
