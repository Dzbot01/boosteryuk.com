import { Link } from 'react-router-dom';
import { useSiteSettings } from '../context/SiteSettingsContext';

const LINKS = [
  { to: '/layanan', label: 'Layanan' },
  { to: '/cek-status', label: 'Cek Status' },
  { to: '/artikel', label: 'Artikel' },
  { to: '/about', label: 'Tentang' },
  { to: '/terms', label: 'Syarat' },
  { to: '/privacy', label: 'Privasi' },
];

/** Footer global — dirender oleh Layout sehingga tampil di SEMUA halaman. */
export default function Footer() {
  const { settings } = useSiteSettings();
  return (
    <footer className="mt-8 border-t border-slate-200 bg-white/70 pb-28 dark:border-slate-700/60 dark:bg-slate-900/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src={settings.logoUrl} alt="" className="h-9 w-9 object-contain" />
          <p className="font-display text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
            <span className="by-accent">{settings.brandName}</span>
            <span className="text-black dark:text-white">{settings.brandSuffix}</span>
          </p>
        </div>
        <nav aria-label="Tautan footer" className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="text-[12px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500">{settings.footerText}</p>
      </div>
    </footer>
  );
}
