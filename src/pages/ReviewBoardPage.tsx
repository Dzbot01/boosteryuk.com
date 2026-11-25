import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Star, Trophy } from 'lucide-react';
import Seo from '../components/Seo';
import { reviewsApi, type ReviewItem } from '../services/reviewsApi';

/**
 * Papan Penilaian — tabel penilaian user (username, bintang, layanan, ulasan) plus tombol
 * aksi ikon keranjang (sama seperti di Overview) untuk memesan layanan yang dinilai.
 * Nama layanan sudah dicatat server saat penilaian dibuat → halaman ini TIDAK memanggil
 * API provider berulang kali (logika sama dengan layanan Google Maps Review di dashboard).
 */
export default function ReviewBoardPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReviewItem[] | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const r = await reviewsApi.list();
    if (!r.ok) { setErr(r.message || 'Gagal memuat papan penilaian.'); setRows([]); return; }
    setRows(r.reviews || []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Seo title="Papan Penilaian — Boosteryuk" description="Bintang dan ulasan pengguna untuk layanan Boosteryuk." />
      <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white"><Trophy className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-[20px] font-extrabold text-slate-900 dark:text-white">Papan Penilaian</h1>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Bintang & ulasan user setelah pesanan selesai</p>
          </div>
        </div>

        {err && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-[12.5px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{err}</p>}

        {!rows ? (
          <div className="mt-5 h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : rows.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-[13px] font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            Belum ada penilaian. Penilaian muncul otomatis setelah user menilai pesanan yang selesai.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                  <th className="border-b border-slate-100 px-3 py-2 dark:border-slate-700/60">Username</th>
                  <th className="border-b border-slate-100 px-3 py-2 dark:border-slate-700/60">Bintang</th>
                  <th className="border-b border-slate-100 px-3 py-2 dark:border-slate-700/60">Layanan</th>
                  <th className="border-b border-slate-100 px-3 py-2 dark:border-slate-700/60">Ulasan</th>
                  <th className="border-b border-slate-100 px-3 py-2 text-right dark:border-slate-700/60">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.username}-${r.created_at}-${i}`} className="align-top">
                    <td className="border-b border-slate-50 px-3 py-2.5 text-[13px] font-bold text-slate-800 dark:border-slate-800 dark:text-slate-100">{r.username}</td>
                    <td className="border-b border-slate-50 px-3 py-2.5 dark:border-slate-800">
                      <span className="flex items-center gap-0.5" aria-label={`${r.stars} bintang`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= r.stars ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} fill={n <= r.stars ? 'currentColor' : 'none'} strokeWidth={2} />
                        ))}
                      </span>
                    </td>
                    <td className="border-b border-slate-50 px-3 py-2.5 text-[12.5px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">{r.service_name}</td>
                    <td className="max-w-[280px] border-b border-slate-50 px-3 py-2.5 text-[12.5px] leading-snug text-slate-600 dark:border-slate-800 dark:text-slate-300">{r.review || '—'}</td>
                    <td className="border-b border-slate-50 px-3 py-2.5 text-right dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => navigate(r.service_key ? `/layanan?service=${encodeURIComponent(r.service_key)}` : '/layanan')}
                        aria-label={`Pesan ${r.service_name}`}
                        title="Pesan layanan ini"
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500 text-white transition-colors hover:bg-emerald-600 active:scale-95 ml-auto"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" strokeWidth={2.4} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
