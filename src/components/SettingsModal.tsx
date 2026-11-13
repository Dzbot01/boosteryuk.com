import { X, Bell, Shield, Globe, Sun, Moon, SlidersHorizontal, Check, Lock, Construction } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLang, type Lang } from '../i18n'; // UI: bahasa global + toggle geser/klik
import { mintaIzinNotif } from '../firebase'; // FIX: toggle notif kini benar-benar minta izin FCM
import { useSiteSettings } from '../context/SiteSettingsContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-300 ${
        disabled
          ? 'pointer-events-none cursor-not-allowed bg-slate-200 opacity-50 dark:bg-slate-700'
          : on
            ? 'bg-blue-600'
            : 'bg-slate-200 dark:bg-slate-600'
      }`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300 dark:bg-slate-900 ${
          on && !disabled ? 'left-[23px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}

/**
 * Toggle bahasa yang bisa diklik atau di-swipe: geser ke kanan -> English, ke kiri ->
 * Indonesia. Indikator ikut bergeser; perubahan langsung menerjemahkan seluruh UI
 * lewat LanguageProvider.
 */
function LanguageSwitch({ lang, onChange }: { lang: Lang; onChange: (lang: Lang) => void }) {
  const startX = useRef<number | null>(null);
  const options: Array<{ code: Lang; label: string }> = [
    { code: 'id', label: 'Indonesia' },
    { code: 'en', label: 'English' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Bahasa"
      data-no-translate
      onPointerDown={(e) => (startX.current = e.clientX)}
      onPointerUp={(e) => {
        if (startX.current === null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (Math.abs(dx) > 24) onChange(dx > 0 ? 'en' : 'id');
      }}
      className="relative grid touch-pan-y select-none grid-cols-2 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800"
    >
      <span
        aria-hidden
        className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm ring-1 ring-blue-500/40 transition-transform duration-300 ease-out dark:bg-slate-900 ${
          lang === 'en' ? 'translate-x-full' : 'translate-x-0'
        }`}
      />
      {options.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={lang === l.code}
          onClick={() => onChange(l.code)}
          className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13.5px] font-semibold transition-colors ${
            lang === l.code ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {l.label}
          {lang === l.code && <Check className="h-4 w-4" strokeWidth={2.6} />}
        </button>
      ))}
    </div>
  );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Logo mengikuti pengaturan (child panel / admin), bukan logo Boosteryuk bawaan.
  const logoUrl = useSiteSettings().settings.logoUrl;
  const { theme, setTheme, isDark } = useTheme();
  const { user } = useAuth();
  const [notif, setNotif] = useState(false);
  const [email, setEmail] = useState(false);
  const [whatsapp, setWhatsapp] = useState(false);
  const { lang, setLang } = useLang(); // UI: bahasa global (LanguageProvider)

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 animate-fade-in bg-slate-900/40 backdrop-blur-[3px]"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-0 sm:px-6">
        <div className="flex max-h-[82vh] w-full max-w-md animate-slide-up sm:max-w-xl flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl shadow-slate-900/30 dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-black/40 sm:mb-6 sm:rounded-3xl sm:border">
          <div className="flex justify-center pt-3 sm:hidden">
            <span className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
            <img src={logoUrl} alt="Pengaturan" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Pengaturan
              </h2>
              <p className="text-[11.5px] font-medium text-slate-400 dark:text-slate-500">
                Preferensi Boosteryuk
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white active:scale-90"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 pb-8">
            {/* ---- Theme ---- */}
            <SectionTitle icon={isDark ? Moon : Sun} title="Tampilan" />
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'light' as const, label: 'Terang', Icon: Sun },
                { id: 'dark' as const, label: 'Gelap', Icon: Moon },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13.5px] font-semibold transition-all duration-200 ${
                    theme === t.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <t.Icon className="h-4 w-4" strokeWidth={2.2} />
                  {t.label}
                  {theme === t.id && <Check className="h-4 w-4" strokeWidth={2.6} />}
                </button>
              ))}
            </div>

            {/* ---- Notifikasi ---- */}
            <SectionTitle icon={Bell} title="Notifikasi" />
            <div className="space-y-0 divide-y divide-slate-100 dark:divide-slate-800">
              <ToggleRow
                label="Push notification"
                desc={user ? 'Update status booster' : 'Autentikasi diperlukan'}
                descIcon={user ? undefined : Lock}
                on={notif && !!user}
                onChange={async (v) => {
                  // FIX: sebelumnya hanya set state lokal (toggle hiasan). Kini benar-benar
                  // minta izin + daftarkan token FCM; nyala hanya jika token berhasil didapat.
                  if (v) {
                    const token = await mintaIzinNotif();
                    setNotif(!!token);
                  } else {
                    setNotif(false);
                  }
                }}
                disabled={!user}
              />
              <ToggleRow
                label="Email"
                desc={user ? 'Ringkasan harian' : 'Autentikasi diperlukan'}
                descIcon={user ? undefined : Lock}
                on={email && !!user}
                onChange={setEmail}
                disabled={!user}
              />
              <ToggleRow
                label="WhatsApp"
                desc="Coming soon"
                descTag
                on={whatsapp}
                onChange={setWhatsapp}
                disabled
              />
            </div>

            {/* ---- Language ---- */}
            <SectionTitle icon={Globe} title="Bahasa" />
            <LanguageSwitch lang={lang} onChange={setLang} />

            {/* ---- Privacy ---- */}
            <SectionTitle icon={Shield} title="Privasi & Keamanan" />
            <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13.5px] font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700">
              Riwayat pencarian lokal
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Hanya di perangkat
              </span>
            </button>

            {/* ---- Reset ---- */}
            <button
              onClick={() => {
                setNotif(false);
                setEmail(false);
                setWhatsapp(false);
                setLang('id');
                setTheme('light');
              }}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-[13.5px] font-bold text-white transition-all duration-200 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 active:scale-[0.98]"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} />
              Kembalikan ke Bawaan
            </button>

            <p className="mt-4 text-center text-[11px] font-medium text-slate-300 dark:text-slate-600">
              Boosteryuk v1.0.0
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
}) {
  return (
    <div className="mb-3 mt-6 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" strokeWidth={2.4} />
      <h3 className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
        {title}
      </h3>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  descTag,
  descIcon: DescIcon,
  on,
  onChange,
  disabled,
}: {
  label: string;
  desc: string;
  descTag?: boolean;
  descIcon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">{label}</p>
          {descTag && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <Construction className="h-2.5 w-2.5" />
              Coming soon
            </span>
          )}
        </div>
        <p className={`text-[11.5px] ${descTag ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {desc}
          {DescIcon && <DescIcon className="ml-1 inline h-3 w-3" strokeWidth={2.4} />}
        </p>
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  );
}
