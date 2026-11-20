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
    catch { setLoading(false); setError('Ups! Tunggu sebentar lalu cobalagi'); }
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

          <button disabled={loading} onClick={() => void handleGoogleLogin()} aria-label={initialMode === 'register' ? 'Daftar dengan Google' : 'Masuk dengan Google'} className="relative inline-flex h-10 w-[300px] max-w-full items-center justify-center gap-3 rounded-full border border-[#747775] bg-white px-3 text-[14px] font-medium tracking-[0.25px] text-[#1f1f1f] transition-colors hover:border-[#747775] hover:bg-[#f8fafd] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-60">
            <svg aria-hidden="true" viewBox="0 0 48 48" className="absolute left-3 h-5 w-5 shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"/>
              <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.84 23.84 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/>
            </svg>
            <span className="px-5">{loading ? 'Mengalihkan…' : initialMode === 'register' ? 'Daftar dengan Google' : 'Masuk dengan Google'}</span>
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
