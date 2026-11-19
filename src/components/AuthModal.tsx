import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useGoogleClientId } from '../context/GoogleClientIdContext';
import { boostyVoice } from '../services/boostyVoice';
import { useSiteSettings } from '../context/SiteSettingsContext';

type Mode = 'login' | 'register';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: Mode;
}

/**
 * AuthModal — login & daftar HANYA lewat Google (tidak ada kolom username/email/password).
 * Alur: tombol Google (GSI) mengembalikan ID token (credential) → dikirim ke
 * google_auth.php → server memverifikasi token ke Google → mengeluarkan sesi Boosteryuk
 * (tabel sessions) → token disimpan & diarahkan ke /overview (sama seperti logic login lama).
 */
export default function AuthModal({ open, onClose, onSuccess, initialMode = 'login' }: Props) {
  const { loginWithGoogle } = useAuth();
  const { voiceMode } = useSiteSettings();
  const googleClientId = useGoogleClientId();
  const navigate = useNavigate();

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

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const credential = credentialResponse.credential;
    if (!credential) {
      setError('Token Google tidak diterima. Coba lagi.');
      return;
    }
    setError('');
    setLoading(true);
    // Buka kunci audio SEKARANG (masih di dalam gesture klik, sebelum await)
    // agar suara Guri Booster boleh diputar setelah login selesai.
    boostyVoice.prime();
    try {
      const res = await loginWithGoogle(credential);
      if (res.ok) {
        boostyVoice.start(voiceMode);
        onSuccess?.();
        onClose();
        navigate('/overview'); // redirect setelah login -> Overview
      } else {
        boostyVoice.stop();
        setError(res.message || 'Login Google gagal');
      }
    } catch (err: any) {
      boostyVoice.stop();
      setError('Gagal konek ke server: ' + (err?.message || 'Coba lagi'));
    } finally {
      setLoading(false);
    }
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

          {googleClientId ? (
            <div className="flex min-h-[44px] w-full items-center justify-center">
              {loading ? (
                <div className="flex items-center gap-2 py-2" aria-live="polite">
                  <span className="authflip-spinner" aria-hidden />
                  <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
                    Memverifikasi akun Google…
                  </span>
                </div>
              ) : (
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Login Google gagal dimuat. Periksa koneksi lalu coba lagi.')}
                  text={initialMode === 'register' ? 'signup_with' : 'signin_with'}
                  shape="pill"
                  size="large"
                  theme="outline"
                  width="300"
                />
              )}
            </div>
          ) : (
            <p className="authflip-error w-full">
              Login Google belum dikonfigurasi di server (GOOGLE_CLIENT_ID kosong). Silakan coba lagi nanti.
            </p>
          )}

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
