import { startGoogleLogin } from '../services/googleRedirect';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

type Mode = 'login' | 'register';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: Mode;
}

/**
 * AuthModal — login & daftar HANYA lewat Google (tidak ada kolom username/email/password).
 * Alur redirect melalui boosteryuk.com; tidak memuat Google Identity Services.
 */
export default function AuthModal({ open, onClose, initialMode = 'login' }: Props) {

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setLoading(false);
  }, [open, initialMode]);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleGoogleLogin = async () => {
    setError(''); setLoading(true);
    try { await startGoogleLogin(); }
    catch { setLoading(false); setError('Tidak dapat memulai login Google. Coba lagi.'); }
  };

  const subtitle =
    initialMode === 'register'
      ? 'Satu klik dengan Google — akun baru dibuat otomatis bila belum ada.'
      : 'Masuk aman dengan akun Google Anda, tanpa password.';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/55" onClick={onClose} />

      <div ref={rootRef} className="authflip-wrapper" role="dialog" aria-modal="true" aria-label="Masuk dengan Google">
        <button onClick={onClose} aria-label="Tutup" className="authflip-close">
          <X className="h-4 w-4" strokeWidth={2.6} />
        </button>

        <div className="authflip-static" style={{ alignItems: 'center', textAlign: 'center', gap: 14 }}>
          <div className="authflip-title" style={{ margin: 0 }}>
            {initialMode === 'register' ? 'Daftar' : 'Masuk'}
          </div>
          <p className="authflip-footnote" style={{ margin: 0 }}>
            {subtitle}
          </p>

          {error && (
            <p className="authflip-error w-full" role="alert">
              {error}
            </p>
          )}

          <button disabled={loading} onClick={() => void handleGoogleLogin()} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60">
            {loading ? 'Mengalihkan ke Google…' : 'Lanjutkan dengan Google'}
          </button>

          <p className="authflip-footnote" style={{ margin: 0, fontSize: 11.5, opacity: 0.85 }}>
            Dengan melanjutkan, Anda menyetujui{' '}
            <a className="authflip-link" href="/terms">Syarat &amp; Ketentuan</a> dan{' '}
            <a className="authflip-link" href="/privacy">Kebijakan Privasi</a> Boosteryuk.
          </p>
        </div>
      </div>
    </div>
  );
}
