import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HamburgerToggle from './HamburgerToggle';
import { useSiteSettings } from '../context/SiteSettingsContext';

/** Jarak scroll (px) sebelum header berubah dari transparan menjadi glass card. */
const SCROLL_THRESHOLD = 12;

// FIX/UI: header kini transparan saat di atas & menjadi glass saat scroll (rAF, listener pasif).
function useScrolled(threshold = SCROLL_THRESHOLD) {
  const [scrolled, setScrolled] = useState(() => typeof window !== 'undefined' && window.scrollY > threshold);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > threshold));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);
  return scrolled;
}

interface HeaderProps {
  /** Toggle buka/tutup side menu (dipakai hamburger mobile/tablet). */
  onToggleMenu: () => void;
  /** State menu terbuka — menggerakkan animasi hamburger. */
  menuOpen: boolean;
}

export default function Header({ onToggleMenu, menuOpen }: HeaderProps) {
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const scrolled = useScrolled();
  const { pathname } = useLocation();
  // Di homepage, saat belum scroll, header melayang di atas HERO GELAP -> paksa teks terang
  // (walau mode terang) agar tetap terbaca.
  const onHeroTop = pathname === '/' && !scrolled;
  // Halaman Playground: tema header hijau (perilaku scroll-reveal tetap sama).
  const isPlayground = pathname === '/playground';

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-30 w-full border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out ${
        scrolled
          ? isPlayground
            ? 'border-emerald-300/50 bg-emerald-500/20 shadow-[0_8px_24px_-16px_rgba(5,120,80,0.45)] backdrop-blur-xl backdrop-saturate-150 dark:border-emerald-700/50 dark:bg-emerald-900/35'
            : `border-slate-200/70 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] backdrop-blur-xl backdrop-saturate-150 dark:border-slate-700/50 ${
                settings.headerTint ? 'by-header-tint' : 'bg-white/55 dark:bg-slate-900/55'
              }`
          : 'border-transparent bg-transparent shadow-none'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-end px-4 py-3 sm:px-6">
        {/* Sisi kiri sengaja kosong — brand & navigasi ada di side menu / rail ikon; header hanya aksi kanan. */}

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Playground — tetap di header (tidak ikut ke side menu); tombol teks tanpa card */}
          <button
            onClick={() => navigate('/playground')}
            aria-label="Playground"
            className="mr-0.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] font-extrabold tracking-tight transition-transform active:scale-95"
          >
            <span className="text-silver-shine">Playground</span>
          </button>

          {/* Hamburger — hanya mobile/tablet (desktop pakai tombol side menu pojok kiri) */}
          <HamburgerToggle
            open={menuOpen}
            onToggle={onToggleMenu}
            label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            className={`h-11 w-11 lg:hidden ${onHeroTop ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}
          />
        </div>
      </div>
    </header>
  );
}
