import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquarePlus, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { reviewsApi, type PendingReviewOrder } from '../services/reviewsApi';

const LS_KEY = 'by-review-banner-dismissed';

function readDismissed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Banner notifikasi "Pesanan <id> sudah selesai" — muncul otomatis begitu status pesanan
 * menjadi selesai (disinkron otomatis oleh order.php / sweep 1 jam), di bawah header pada
 * mobile dan di layar bagian atas pada desktop. Tetap tampil sampai user menutupnya lewat
 * tombol silang kecil; pilihan ditutup disimpan per ID pesanan.
 */
export default function OrderReviewBanner() {
  const { user } = useAuth();
  const [order, setOrder] = useState<PendingReviewOrder | null>(null);

  useEffect(() => {
    if (!user) { setOrder(null); return; }
    let alive = true;
    const load = async () => {
      const r = await reviewsApi.pending();
      if (!alive) return;
      const dismissed = readDismissed();
      setOrder((r.orders || []).find((o) => !dismissed.includes(o.order_id)) ?? null);
    };
    void load();
    // Status pesanan disinkron otomatis (seketika + sweep 1 jam) → cek ulang berkala.
    const t = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [user]);

  if (!order) return null;

  const close = () => {
    try {
      const d = readDismissed();
      if (!d.includes(order.order_id)) d.push(order.order_id);
      localStorage.setItem(LS_KEY, JSON.stringify(d.slice(-50)));
    } catch { /* penyimpanan penuh/private: banner tetap bisa ditutup sesi ini */ }
    setOrder(null);
  };

  return (
    <div
      role="status"
      aria-label="Notifikasi pesanan selesai"
      className="fixed left-1/2 top-[76px] z-[80] w-[min(92vw,600px)] -translate-x-1/2 md:top-4"
    >
      <div className="relative rounded-2xl border border-emerald-200 bg-white/95 p-4 pr-10 shadow-xl shadow-emerald-500/10 backdrop-blur dark:border-emerald-500/30 dark:bg-slate-900/95">
        <button
          type="button"
          onClick={close}
          aria-label="Tutup notifikasi"
          title="Tutup"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <MessageSquarePlus className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          <p className="text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
            <span className="font-extrabold text-slate-900 dark:text-white">Pesanan #{order.order_id}</span> sudah selesai.
            {' '}Bagaimana pendapatmu? Beri penilaian{' '}
            <Link
              to={`/beri-penilaian?order=${encodeURIComponent(order.order_id)}`}
              className="font-bold text-emerald-700 underline underline-offset-2 hover:text-emerald-800 dark:text-emerald-400"
            >
              disini
            </Link>
            <span className="mt-0.5 block text-[11.5px] text-slate-500 dark:text-slate-400">{order.service_name}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
