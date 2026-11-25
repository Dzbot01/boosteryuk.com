import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import iconBannerSelesai from '../assets/icon-banner-selesai.gif';
import { useAuth } from '../context/AuthContext';
import { MAIN_API } from '../lib/apiBase';
import { reviewsApi, type PendingReviewOrder } from '../services/reviewsApi';

/** Hanya pesanan SMM (Server 1/2/3) yang boleh dinilai — OTP/Agen AI/NexSpace/Upgrade/Event dilewati. */
function isSmmOrder(o: { order_id: string; service_name: string }): boolean {
  if (/^(EVG|NX|OTP)/.test(o.order_id)) return false;
  if (/^AI\d{6}/.test(o.order_id)) return false;
  if (/^UP\d/.test(o.order_id)) return false;
  return !/Event Merchant:|NexSpace|Nomor OTP|Agen AI|Boosteryuk Plus|Boosteryuk EXTRA/.test(o.service_name);
}

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
      let list: PendingReviewOrder[] = r.ok ? (r.orders || []) : [];
      if (!r.ok) {
        // reviews.php belum ada/gagal di hosting → jalur cadangan lewat riwayat pesanan,
        // supaya banner "pesanan selesai" tetap muncul tanpa menunggu upload file baru.
        try {
          const tk = localStorage.getItem('token') || '';
          const rr = await fetch(`${MAIN_API}/riwayat_pesanan.php?token=${encodeURIComponent(tk)}`, { cache: 'no-store' });
          const rj = (await rr.json().catch(() => null)) as { ok?: boolean; orders?: { order_id: string; service_name: string; status: string }[] } | null;
          if (rj?.ok) list = (rj.orders || []).filter((o) => o.status === 'selesai' && isSmmOrder(o)).map((o) => ({ order_id: o.order_id, service_name: o.service_name }));
        } catch { /* biarkan kosong */ }
      }
      if (!alive) return;
      const dismissed = readDismissed();
      setOrder(list.find((o) => isSmmOrder(o) && !dismissed.includes(o.order_id)) ?? null);
    };
    void load();
    // Status pesanan disinkron otomatis (seketika + sync per user + sweep 1 jam) → banner
    // mengecek ulang tiap 30 detik DAN setiap tab kembali aktif/fokus, sehingga begitu
    // admin/provider menandai selesai, banner langsung muncul tanpa reload halaman.
    const t = window.setInterval(load, 30_000);
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('focus', wake);
    return () => {
      alive = false;
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('focus', wake);
    };
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
          <img src={iconBannerSelesai} alt="" aria-hidden="true" className="mt-0.5 h-10 w-10 shrink-0" />
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
