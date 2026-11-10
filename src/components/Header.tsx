import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Wallet, Settings, LogOut, ChevronRight, Crown, AtSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
  onMenuClick: () => void;
}

function rupiah(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, isAdmin, logout } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const scrolled = useScrolled();
  const { pathname } = useLocation();
  // Di homepage, saat belum scroll, header melayang di atas HERO GELAP -> paksa teks terang
  // (walau mode terang) agar tetap terbaca.
  const onHeroTop = pathname === '/' && !scrolled;
  // Halaman Playground: tema header hijau (perilaku scroll-reveal tetap sama).
  const isPlayground = pathname === '/playground';

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current &&!popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const showUserIcon =!!user &&!isAdmin;

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-30 w-full border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out ${
        scrolled
          ? isPlayground
            ? 'border-emerald-300/50 bg-emerald-500/20 shadow-[0_8px_24px_-16px_rgba(5,120,80,0.45)] backdrop-blur-xl backdrop-saturate-150 dark:border-emerald-700/50 dark:bg-emerald-900/35'
            : 'border-slate-200/70 bg-white/55 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] backdrop-blur-xl backdrop-saturate-150 dark:border-slate-700/50 dark:bg-slate-900/55'
          : 'border-transparent bg-transparent shadow-none'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link to={isAdmin? '/admin' : '/'} className="group flex items-center gap-3">
          <img
            src={settings.logoUrl}
            alt={settings.brandName + settings.brandSuffix}
            className="h-10 w-10 shrink-0 object-contain drop-shadow-sm transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
          />
          <span className="leading-none">
            <span className="block font-display text-[19px] font-extrabold tracking-tight">
              <span className={onHeroTop ? 'text-cyan-300' : 'text-cyan-600 dark:text-cyan-400'}>{settings.brandName}</span>
              <span className={onHeroTop ? 'text-white' : 'text-black dark:text-white'}>{settings.brandSuffix}</span>
            </span>
            <span className={`mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] ${onHeroTop ? 'text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
              {isAdmin? 'Admin Panel' : 'SMM Panel'}
            </span>
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Playground — tombol teks tanpa card, di samping ikon profil */}
          <button
            onClick={() => navigate('/playground')}
            aria-label="Playground"
            className={`mr-0.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[13px] font-extrabold tracking-tight transition-colors active:scale-95 ${
              isPlayground
                ? 'text-emerald-500'
                : onHeroTop
                  ? 'text-emerald-300 hover:text-emerald-200'
                  : 'text-emerald-600 hover:text-emerald-500 dark:text-emerald-400'
            }`}
          >
            Playground
          </button>

          {/* User profile icon — only for regular users */}
          {showUserIcon && (
            <div className="relative" ref={popRef}>
              <button
                onClick={() => setOpen((v) =>!v)}
                aria-label="Profil"
                className={`group relative flex h-11 w-11 items-center justify-center rounded-full font-display text-[13px] font-extrabold text-white transition-all hover:scale-105 active:scale-95 ${
                  user?.plusActive
                   ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 ring-2 ring-amber-300 dark:ring-amber-400'
                    : 'bg-gradient-to-br from-cyan-500 to-cyan-700'
                }`}
              >
                {user?.initials?? 'U'}
                {user?.plusActive && (
                  <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-900 p-0.5 text-amber-400 shadow ring-1 ring-amber-400">
                    <Crown className="h-3 w-3 fill-amber-400" />
                  </span>
                )}
                {/* FIX/UI: indikator titik hijau pada ikon profil dihapus */}
              </button>

              {/* Popover — compact */}
              {open && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 animate-fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
                  {/* Identity — name & username & VIP Plus badge */}
                  <div className="border-b border-slate-100 bg-gradient-to-br from-cyan-50 to-white px-3.5 py-3 dark:border-slate-800 dark:from-cyan-950/40 dark:to-slate-900">
                    <div className="flex items-center justify-between">
                      <p className="truncate font-display text-[14px] font-extrabold text-slate-900 dark:text-white">
                        {user?.name?? 'User'}
                      </p>
                      {user?.plusActive && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2 py-0.5 text-[9.5px] font-black text-slate-950 shadow-sm">
                          <Crown className="h-3 w-3 fill-slate-950" />
                          VIP PLUS
                        </span>
                      )}
                    </div>
                    {/* Tampilkan Username */}
                    <p className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] font-semibold text-cyan-600 dark:text-cyan-400">
                      <AtSign className="h-3 w-3" strokeWidth={2.4}/>
                      {user?.username?? '-'}
                    </p>
                  </div>

                  {/* Saldo — no TopUp button */}
                  <div className="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-3 dark:border-slate-800">
                    <span className="flex h-8 w-8 items-center justify-center text-cyan-600 dark:text-cyan-400">
                      <Wallet className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                        Saldo
                      </p>
                      <p className="font-display text-[15px] font-extrabold leading-none text-slate-900 dark:text-white">
                        {rupiah(user?.balance?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setOpen(false);
                        navigate('/pengaturan-akun');
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Settings className="h-4 w-4 text-slate-400 dark:text-slate-400" strokeWidth={2.1} />
                      Pengaturan akun
                      <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300" />
                    </button>
                    <button
                      onClick={() => {
                        setOpen(false);
                        logout();
                        navigate('/');
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                    >
                      <LogOut className="h-4 w-4" strokeWidth={2.1} />
                      Keluar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hamburger */}
          <button
            onClick={onMenuClick}
            aria-label="Buka menu"
            className={`group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-200 hover:text-blue-600 active:scale-95 ${onHeroTop ? 'text-white' : 'text-slate-700 dark:text-slate-200 dark:hover:text-blue-400'}`}
          >
            <Menu className="h-6 w-6" strokeWidth={2.2} />
            {/* FIX/UI: ikon menu tanpa card (border/bg/shadow dihapus) */}
          </button>
        </div>
      </div>
    </header>
  );
}