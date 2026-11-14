import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, X } from 'lucide-react';
import { AUTH_EXPIRED_EVENT } from '../context/AuthContext';

/**
 * Saat sesi login berakhir (token kedaluwarsa/tidak valid), AuthContext mengeluarkan user lalu
 * memancarkan AUTH_EXPIRED_EVENT. Komponen ini memindahkan user ke beranda (tidak tetap di halaman
 * sebelumnya) dan menampilkan pemberitahuan.
 */
export default function SessionGuard() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onExpired = () => {
      navigate('/', { replace: true });
      setShow(true);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [navigate]);

  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(false), 7000);
    return () => window.clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div role="alert" className="fixed inset-x-4 top-5 z-[95] mx-auto flex max-w-sm items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <LogOut className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div className="flex-1">
        <p className="font-bold text-slate-900 dark:text-white">Sesi kamu telah berakhir</p>
        <p className="mt-0.5 text-slate-500 dark:text-slate-400">Demi keamanan, kamu otomatis keluar. Silakan masuk lagi.</p>
      </div>
      <button onClick={() => setShow(false)} aria-label="Tutup" className="text-slate-400 hover:text-slate-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
