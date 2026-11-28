import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, User } from 'lucide-react';
import HamburgerToggle from './HamburgerToggle';
import BottomNavbar from './BottomNavbar';
import UserAvatar from './UserAvatar';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { formatJamPpob, sapaanPpob } from '../data/ppob';
import { IS_CHILD_PANEL } from '../lib/apiBase';

/**
 * Header UTAMA website khusus halaman PPOB (/ppob & /ppob/pulsa-reguler):
 * header biru bawaan PPOB naik menjadi header situs — ikon-ikon header lama
 * (Playground, pengaturan/FAQ/musik/profil, hamburger) pindah ke sini, dan
 * header glass bawaan situs tidak dirender lagi di rute PPOB (lihat Layout).
 * Sticky di atas supaya berperilaku seperti header utama; card halaman tetap
 * overlap ke lengkung bawahnya. Responsif: kompak di mobile, lega di desktop.
 */
export default function PpobHeader({
  variant,
  onToggleMenu,
  menuOpen,
}: {
  /** 'beranda' = /ppob (sapaan + lonceng berita); 'pulsa' = /ppob/pulsa-reguler (jam + tombol kembali). */
  variant: 'beranda' | 'pulsa';
  onToggleMenu: () => void;
  menuOpen: boolean;
}) {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const namaApp = settings.brandName || 'Boosteryuk';
  const [jam, setJam] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setJam(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const sapaan = sapaanPpob(jam.getHours());
  const foto = user?.picture && /^https:\/\//i.test(user.picture) ? user.picture : '';
  const beranda = variant === 'beranda';

  return (
    <header
      className={`sticky top-0 z-30 overflow-hidden px-4 ${beranda ? 'rounded-b-[32px] pb-8 pt-3' : 'rounded-b-[24px] pb-8 pt-3'} md:px-6`}
      style={{ background: 'linear-gradient(135deg,#3B82F6 0%,#2563EB 100%)' }}
    >
      {/* Motif lengkung halus di sisi kanan */}
      <svg className="pointer-events-none absolute -right-14 -top-16 h-60 w-60 text-white/10" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="92" fill="currentColor" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="currentColor" strokeWidth="12" opacity="0.75" />
        <circle cx="100" cy="100" r="34" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.5" />
      </svg>

      <div className="relative mx-auto flex w-full max-w-md items-center gap-3 md:max-w-3xl lg:max-w-5xl">
        {beranda ? null : (
          <Link
            to="/ppob"
            aria-label="Kembali ke beranda PPOB"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2563EB] shadow-sm transition active:scale-95"
          >
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </Link>
        )}

        {/* Wordmark PPOB — identitas halaman di header utama (mulai tablet/desktop) */}
        <span className="hidden min-w-0 shrink-0 flex-col leading-tight md:flex">
          <span className="font-display text-[19px] font-extrabold tracking-tight text-white">PPOB</span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Pembayaran online</span>
        </span>
        <span className="hidden h-8 w-px shrink-0 bg-white/25 md:block" aria-hidden="true" />

        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-white">
          {foto ? (
            <img src={foto} alt={`Foto profil ${user?.name || ''}`} className="h-full w-full object-cover" />
          ) : (
            <UserAvatar user={user ?? null} fallbackClassName="bg-white">
              <User className="h-5 w-5 text-slate-400" strokeWidth={2} />
            </UserAvatar>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-extrabold text-[#F5B73B]">{user?.name || namaApp}</span>
          <span className={`block truncate text-[11.5px] font-medium text-white/85 ${beranda ? '' : 'font-mono tabular-nums'}`}>
            {beranda ? sapaan : formatJamPpob(jam)}
          </span>
        </span>

        {/* Ikon header lama situs yang pindah ke header biru PPOB */}
        {beranda && (
          <button
            type="button"
            onClick={() => document.getElementById('berita-ppob')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            aria-label="Berita & pengumuman"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={2.2} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#2563EB]" />
          </button>
        )}
        {!IS_CHILD_PANEL && (
          <Link
            to="/playground"
            aria-label="Playground"
            className="hidden shrink-0 rounded-lg px-1.5 py-1 text-[13px] font-extrabold tracking-tight text-white transition-transform active:scale-95 sm:inline-flex"
          >
            Playground
          </Link>
        )}
        <BottomNavbar placement="header" onDark />
        <HamburgerToggle open={menuOpen} onToggle={onToggleMenu} label={menuOpen ? 'Tutup menu' : 'Buka menu'} className="h-11 w-11 shrink-0 text-white" />
      </div>
    </header>
  );
}
