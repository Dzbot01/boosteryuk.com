import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { useT } from '../i18n';

/**
 * Modal loading yang menggantikan InfoModal (kartu "Informasi & Pengumuman" yang dulu
 * muncul setiap buka halaman / refresh).
 *
 * - Hanya tampil SEKALI, saat data auth user dimuat pertama kali (AuthContext.loading).
 * - Begitu auth selesai dimuat, modal memudar lalu tidak pernah muncul lagi di sesi ini,
 *   walaupun refresh() dipanggil ulang (mis. setelah top-up).
 * - Di build demo (auth langsung siap) modal ini tidak pernah tampil.
 */
const FADE_MS = 200;

export default function AuthLoadingModal() {
  const { loading } = useAuth();
  const { settings } = useSiteSettings();
  const t = useT();
  // 'show' → modal terlihat, 'fading' → animasi keluar, 'done' → tidak dirender lagi.
  const [phase, setPhase] = useState<'show' | 'fading' | 'done'>(loading ? 'show' : 'done');

  // Auth selesai dimuat → mulai animasi keluar.
  useEffect(() => {
    if (phase === 'show' && !loading) setPhase('fading');
  }, [loading, phase]);

  // Effect terpisah untuk timer: bila digabung dengan effect di atas, cleanup saat phase
  // berganti ke 'fading' membatalkan timer sehingga overlay transparan tertinggal dan
  // menghalangi semua klik.
  useEffect(() => {
    if (phase !== 'fading') return;
    const timer = window.setTimeout(() => setPhase('done'), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-white/70 backdrop-blur-sm transition-opacity duration-200 dark:bg-slate-950/70 ${
        phase === 'fading' ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex w-[220px] flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-6 text-center shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
        <span className="relative flex h-14 w-14 items-center justify-center">
          {/* Cincin berputar di sekeliling logo sebagai indikator loading */}
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-cyan-100 border-t-cyan-600 dark:border-slate-700 dark:border-t-cyan-400" />
          <img src={settings.logoUrl} alt="" className="h-8 w-8 object-contain" />
        </span>
        <p className="text-[13px] font-bold text-slate-900 dark:text-white">{t('Memuat data akun…')}</p>
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{t('Sebentar ya, sedang menyiapkan halaman.')}</p>
      </div>
    </div>
  );
}
