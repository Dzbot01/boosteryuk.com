import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NX_BANNER_EVENT, nexspaceApi, type NxBanner } from '../services/nexspaceApi';

/**
 * Banner di bawah header (semua halaman) selama pesanan NexSpace Pro belum selesai diambil:
 * pintu masuk kembali ke Portal Server / halaman tunggu. Tidak bisa ditutup.
 */
export default function NexSpaceBanner() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [b, setB] = useState<NxBanner | null>(null);

  const load = useCallback(async () => {
    if (!user) return setB(null);
    const r = await nexspaceApi.banner();
    if (r.ok) setB(r.banner ?? null);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const on = () => void load();
    window.addEventListener(NX_BANNER_EVENT, on);
    const t = window.setInterval(on, 60000);
    return () => { window.removeEventListener(NX_BANNER_EVENT, on); window.clearInterval(t); };
  }, [load]);

  if (!b || pathname.startsWith('/nexspace/portal')) return null;
  const view = {
    unclaimed: { icon: KeyRound, text: <>Pembayaran <b>{b.plan_name}</b> berhasil. Masukkan kode unik dari email di Portal Server.</>, cta: 'Masukkan kode', tone: 'bg-slate-900 text-white' },
    waiting: { icon: Server, text: <>Server <b className="font-mono">{b.username}</b> sedang dibuat.</>, cta: 'Lihat status', tone: 'bg-slate-900 text-white' },
    ready: { icon: ShieldCheck, text: <>Data login server <b className="font-mono">{b.username}</b> sudah siap.</>, cta: 'Ambil data login', tone: 'bg-emerald-700 text-white' },
  }[b.state];
  const Icon = view.icon;
  return (
    <div className="relative z-30 px-3 pt-2 sm:px-6">
      <Link
        to="/nexspace/portal"
        className={`mx-auto flex max-w-6xl items-center gap-3 rounded-xl px-4 py-2.5 text-[13px] shadow-sm hover:opacity-95 ${view.tone}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${b.state === 'waiting' ? 'animate-pulse' : ''}`} />
        <span className="min-w-0 flex-1 truncate">{view.text}</span>
        <span className="inline-flex shrink-0 items-center gap-0.5 font-bold">{view.cta}<ChevronRight className="h-4 w-4" /></span>
      </Link>
    </div>
  );
}
