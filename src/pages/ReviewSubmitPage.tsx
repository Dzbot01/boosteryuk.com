import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Star, ThumbsDown, ThumbsUp, Megaphone } from 'lucide-react';
import Seo from '../components/Seo';
import { reviewsApi, type PendingReviewOrder } from '../services/reviewsApi';

/** Komentar cepat menyesuaikan banyaknya bintang yang dipilih. */
export function quickComments(stars: number): string[] {
  if (stars <= 2) return ['Pengiriman Lama', 'Drop'];
  if (stars === 3) return ['Pengiriman Lama', 'Non Drop'];
  return ['Pengiriman Cepat', 'Non Drop', 'Rekomendasi'];
}

/**
 * Beri Penilaian & ulasan layanan — dibuka dari banner "Pesanan #… sudah selesai".
 * Kartu modal: bintang 1–5 → komentar cepat sesuai ekspresi bintang → ulasan →
 * selesai, user otomatis diarahkan ke halaman Overview.
 */
export default function ReviewSubmitPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const wanted = params.get('order') || '';
  const [orders, setOrders] = useState<PendingReviewOrder[] | null>(null);
  const [picked, setPicked] = useState(wanted);
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const r = await reviewsApi.pending();
    setOrders(r.orders || []);
    if (wanted && !(r.orders || []).some((o) => o.order_id === wanted)) {
      setErr(r.ok
        ? 'Pesanan ini sudah dinilai atau belum berstatus selesai.'
        : (/404|405/.test(r.message || '') ? 'Halaman penilaian belum tersedia di server. Admin perlu mengupload reviews.php ke /api.' : (r.message || 'Gagal memuat daftar pesanan.')));
    }
  }, [wanted]);
  useEffect(() => { void load(); }, [load]);

  const order = useMemo(() => (orders || []).find((o) => o.order_id === picked) || null, [orders, picked]);
  const chips = stars > 0 ? quickComments(stars) : [];

  const submit = async () => {
    if (!order || stars < 1) { setErr('Pilih bintang 1 sampai 5 dulu.'); return; }
    setBusy(true); setErr('');
    const r = await reviewsApi.submit(order.order_id, stars, review.trim());
    setBusy(false);
    if (!r.ok) { setErr(r.message || 'Gagal mengirim penilaian.'); return; }
    navigate('/overview', { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <Seo title="Beri Penilaian — Boosteryuk" description="Nilai layanan dengan bintang 1–5 dan ulasan cepat." />
      <div className="rounded-[22px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white"><Megaphone className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-[20px] font-extrabold text-slate-900 dark:text-white">Beri Penilaian</h1>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Penilaian & ulasan pada layanan ini</p>
          </div>
        </div>

        {!orders ? (
          <div className="mt-6 h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        ) : (orders.length === 0 || !order) ? (
          <p className="mt-6 rounded-xl bg-slate-50 p-4 text-[13px] font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            {err || 'Tidak ada pesanan selesai yang belum dinilai. Penilaian dibuka otomatis setelah pesanan selesai.'}
          </p>
        ) : (
          <>
            {wanted && orders.length > 1 && (
              <label className="mt-5 block text-[12px] font-bold text-slate-500 dark:text-slate-400">
                Pesanan yang dinilai
                <select
                  value={picked}
                  onChange={(e) => { setPicked(e.target.value); setStars(0); setReview(''); setErr(''); }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {orders.map((o) => <option key={o.order_id} value={o.order_id}>#{o.order_id} — {o.service_name}</option>)}
                </select>
              </label>
            )}
            <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              Pesanan #{order.order_id} · {order.service_name}
            </p>

            <div className="mt-5" role="radiogroup" aria-label="Bintang penilaian">
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">Bintang</p>
              <div className="mt-2 flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={stars === n}
                    aria-label={`${n} bintang`}
                    onClick={() => { setStars(n); setErr(''); }}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${stars >= n ? 'border-amber-400 bg-amber-50 text-amber-500 dark:bg-amber-950/40' : 'border-slate-200 bg-white text-slate-300 hover:text-amber-400 dark:border-slate-700 dark:bg-slate-800'}`}
                  >
                    <Star className="h-5 w-5" fill={stars >= n ? 'currentColor' : 'none'} strokeWidth={2} />
                  </button>
                ))}
              </div>
            </div>

            {stars > 0 && (
              <div className="mt-4">
                <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  {stars >= 4 ? <ThumbsUp className="h-3.5 w-3.5 text-emerald-500" /> : <ThumbsDown className="h-3.5 w-3.5 text-rose-500" />}
                  Komentar cepat
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {chips.map((c) => {
                    const on = review.split('\n').includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          const parts = review.split('\n').filter((x) => x.trim() !== '');
                          const next = on ? parts.filter((x) => x !== c) : [...parts, c];
                          setReview(next.join('\n'));
                        }}
                        className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${on ? 'border-emerald-500 bg-emerald-500 text-white' : stars >= 4 ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200' : 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200'}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="mt-4 block text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Ulasan
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value.slice(0, 500))}
                rows={4}
                placeholder="Ceritakan pengalamanmu memakai layanan ini…"
                className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-800 normal-case tracking-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <p className="mt-1 text-right text-[11px] text-slate-400">{review.length}/500</p>

            {err && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-2.5 text-[12.5px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">{err}</p>}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || stars < 1}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-[13.5px] font-extrabold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Mengirim…' : 'Kirim penilaian & ulasan'}
            </button>
            <p className="mt-2 text-center text-[11.5px] text-slate-400">Setelah mengirim, Anda diarahkan ke halaman Overview.</p>
          </>
        )}
      </div>
    </div>
  );
}
