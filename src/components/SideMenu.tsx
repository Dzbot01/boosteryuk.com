import UserAvatar from './UserAvatar';
import {
  Home,
  Gift,
  History,
  Phone,
  LogOut,
  Settings,
  Sparkles,
  Construction,
  Wallet,
  Receipt,
  ShoppingCart,
  Server,
  CreditCard,
  DollarSign,
  PackageSearch,
  Info,
  FileText,
  ShieldCheck,
  Megaphone,
  Bot,
  LayoutGrid,
  Globe,
  Shield,
  Smartphone,
  BookOpen,
  ClipboardList,
  Users,
  Crown,
} from 'lucide-react';
import { useEffect } from 'react';

function animateEventText(button: HTMLButtonElement) {
  const label = button.querySelector<HTMLElement>('[data-event-label]');
  if (!label || typeof label.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  (label.getAnimations?.() || []).forEach(animation => animation.cancel());
  const colors = ['#00ffff', '#ff33ff', '#a3ff12', '#ffdd00', '#ff4d88', '#6c8cff'];
  const offset = Math.floor(Math.random() * colors.length);
  label.animate([...colors, colors[0]].map((_, index) => {
    const color = colors[(index + offset) % colors.length];
    return { color, textShadow: `0 0 8px ${color}, 0 0 16px ${color}` };
  }), { duration: 1800, easing: 'linear' });
}
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { usePanelOwner } from '../services/panelApi';
import { IS_CHILD_PANEL } from '../lib/apiBase';

export type PageId =
  | 'event'
  | 'home'
  | 'cek-status'
  | 'riwayat'
  | 'hubungi'
  | 'pengaturan'
  | 'profil'
  | 'payment'
  | 'struk'
  | 'layanan'
  | 'ordervps'
  | 'artikel'
  | 'about'
  | 'nokos'
  | 'terms'
  | 'manualdepo'
  | 'support'
  | 'privacy'
  | 'riwayat-deposit'
  | 'deposit'
  | 'overview'
  | 'sewa-agen'
  | 'plus';

const ROUTE_PATH: Record<PageId, string> = {
  home: '/',
  event: '/event',
  'cek-status': '/cek-status',
  riwayat: '/riwayat-pesanan',
  hubungi: '/hubungi',
  pengaturan: '/',
  profil: '/profil',
  payment: '/payment',
  struk: '/struk',
  layanan: '/layanan',
  ordervps: '/nexspace',
  overview: '/overview',
  'sewa-agen': '/sewa-agen-ai',
  deposit: '/deposit',
  'riwayat-deposit': '/riwayat-deposit',
  plus: '/plus',
  about: '/about',
  terms: '/terms',
  privacy: '/privacy',
  support: '/support',
  manualdepo: '/manualdepo',
  nokos: '/otp-service',
  artikel: '/artikel',
};

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  /** Buka saja (hover rail di desktop). */
  onOpen?: () => void;
}

const baseMenu: {
  id: PageId;
  icon: typeof Home;
  label: string;
  desc: string;
  badge?: string;
  tag?: string;
  neon?: boolean;
}[] = [
  { id: 'home', icon: Home, label: 'Dashboard', desc: 'Beranda utama' },
  { id: 'overview', icon: LayoutGrid, label: 'Overview', desc: 'Ringkasan akun & statistik' },
  { id: 'layanan', icon: ShoppingCart, label: 'Buat Pesanan', desc: 'Katalog & order layanan' },
  { id: 'ordervps', icon: Server, label: 'NexSpace', desc: 'Server Linux Started & Pro' },
  { id: 'sewa-agen', icon: Bot, label: 'Sewa Agen AI', desc: 'Agen AI WhatsApp, Telegram, dll' },
  { id: 'riwayat', icon: History, label: 'Riwayat Pesanan', desc: 'Tabel riwayat pesanan' },
  { id: 'cek-status', icon: PackageSearch, label: 'Cek Status Pesanan', desc: 'Lacak Status Pesanan' },
  { id: 'event', icon: Gift, label: 'Event', desc: 'Game & event yang berlangsung' },
  { id: 'artikel', icon: BookOpen, label: 'Artikel', desc: 'Panduan & tips' },
  { id: 'about', icon: Info, label: 'Tentang Kami', desc: 'Tentang Kami' },
  { id: 'terms', icon: FileText, label: 'Syarat & Ketentuan', desc: 'Informasi Syarat dan Ketentuan' },
  { id: 'privacy', icon: ShieldCheck, label: 'Privasi dan Keamanan', desc: 'Informasi Keamanan' },
  { id: 'struk', icon: Receipt, label: 'Struk Digital', desc: 'Buat bukti pesanan' },
  { id: 'support', icon: Phone, label: 'Contact Support', desc: 'Bantuan 24 jam' },
  { id: 'plus', icon: Sparkles, label: 'Upgrade', desc: 'Paket Plus & EXTRA', neon: true },
];

const authMenu: typeof baseMenu = [
  { id: 'deposit', icon: CreditCard, label: 'Deposit', desc: 'Isi ulang saldo' },
  { id: 'riwayat-deposit', icon: History, label: 'Riwayat Deposit', desc: 'Invoice & status pembayaran' },
  { id: 'payment', icon: Wallet, label: 'Payment', desc: 'Saldo & transaksi' },
];

const HIDDEN_USER_ITEMS = ['payment', 'struk'];
const HIDDEN_PROFILE_ITEM = 'profil';

export { baseMenu, authMenu };

const ADMIN_MENU = [
  { id: 'cek-status' as const, icon: PackageSearch, label: 'Cek Status Pesanan', desc: 'Lacak Status Pesanan', path: '/cek-status' },
  { id: 'event' as const, icon: Gift, label: 'Event', desc: 'Game & event yang berlangsung', path: '/event' },
  { id: 'events' as const, icon: Gift, label: 'Kelola Event', desc: 'Jadwal & status event', path: '/admin/events' },
  { id: 'orders' as const, icon: ClipboardList, label: 'Data Pesanan', desc: 'Pesanan semua user', path: '/admin/orders' },
  { id: 'users' as const, icon: Users, label: 'Data User', desc: 'Saldo & data user', path: '/admin/users' },
  { id: 'deposits' as const, icon: Wallet, label: 'Data Deposit', desc: 'Deposit terbaru', path: '/admin/deposit' },
  { id: 'childpanel' as const, icon: Globe, label: 'Child Panel', desc: 'Subdomain reseller', path: '/admin/child-panel' },
  { id: 'withdraw' as const, icon: Wallet, label: 'Request Withdraw Child Panel', desc: 'Permintaan pencairan pendapatan', path: '/admin/withdraw' },
  { id: 'profit' as const, icon: DollarSign, label: 'My Profit', desc: 'Ringkasan keuangan', path: '/admin/profit' },
  { id: 'website' as const, icon: Settings, label: 'Pengaturan Website', desc: 'Logo, brand & musik', path: '/admin/website' },
  { id: 'broadcast' as const, icon: Megaphone, label: 'Broadcast', desc: 'Broadcasting', path: '/admin/broadcast' },
  { id: 'nexspace' as const, icon: Server, label: 'NexSpace Pro Request', desc: 'Kirim data login Pro', path: '/admin/nexspace' },
  { id: 'server' as const, icon: Server, label: 'Server Panel', desc: 'Ping provider', path: '/admin/server' },
];

const rupiah = (n?: number | null) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n) || 0);

/**
 * Side menu unified — SATU komponen satu UI dengan dua mode tampilan:
 *  - Mode OFF (desktop, ≥lg): rail ikon di tepi kiri (64px). Dashboard untuk tamu: disembunyikan.
 *  - Mode ON: panel penuh (272px) yang "keluar" dari rail (width melebar) — bukan layer terpisah.
 *  - Mobile (<lg): overlay penuh dari kiri (translate-x), seperti biasa.
 *  - DESKTOP: tidak ada tombol toggle terpisah — kursor diarahkan ke ikon-ikon menu (mode off) → panel otomatis terbuka (hover); klik di LUAR panel / Esc menutup (klik di dalam panel berfungsi normal).
 *  Catatan: header tampil di semua ukuran; di MOBILE header memuat logo + judul brand, di DESKTOP header tanpa logo/judul (hanya Playground).
 *           Ikon profil, saldo, Pengaturan akun & Keluar berada di footer side menu ini. Playground tetap di header.
 */
export default function SideMenu({ isOpen, onClose, onOpen }: SideMenuProps) {
  const { user, isAdmin, logout } = useAuth();
  const { settings } = useSiteSettings();
  // Child panel: pemilik panel (admin ke-2) mendapat menu Admin Panel Toko.
  const isPanelOwner = usePanelOwner(user?.token) === true && IS_CHILD_PANEL;
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location?.pathname || '/';
  const onDashboard = pathname === '/';
  // Aturan rail (mode off) di desktop: tampil bila user sudah login ATAU di halaman selain dashboard.
  const railVisible = !onDashboard || !!user;
  const stripVisible = isOpen || railVisible;

  // Esc menutup menu + klik di LUAR panel menutup menu (desktop) + kunci scroll body selama terbuka (mobile saja).
  useEffect(() => {
    if (!isOpen) return;
    const lockScroll = window.matchMedia('(max-width: 1023px)').matches;
    const original = document.body.style.overflow;
    if (lockScroll) document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // Klik DI LUAR panel → otomatis tutup. Klik DI DALAM panel dibiarkan berjalan normal
    // (menu/aksi di dalam panel bekerja & biasanya menutup panel sendiri setelah navigasi),
    // sehingga klik pada item menu tidak "tertelan" oleh fungsi tutup. Desktop saja —
    // di mobile penutupan lewat scrim (panel overlay penuh).
    const onMouseDown = (e: MouseEvent) => {
      if (!window.matchMedia('(min-width: 1024px)').matches) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-by-menu-toggle]')) return;
      if (t?.closest('[data-by-side-panel]')) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      if (lockScroll) document.body.style.overflow = original;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [isOpen, onClose]);

  // Khusus DESKTOP: kursor diarahkan ke ikon-ikon menu (mode OFF / rail) → panel otomatis terbuka,
  // perilakunya sama seperti saat membuka lewat tombol — tetapi cukup dengan mengarahkan kursor.
  // (menutup: klik di luar panel / Esc)
  const openOnHover = () => {
    if (isOpen) return;
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px) and (hover: hover)').matches) {
      onOpen?.();
    }
  };

  const AUTH_REQUIRED = ['event', 'layanan', 'pengaturan', 'riwayat', 'ordervps', 'deposit', 'riwayat-deposit', 'nokos', 'plus', 'sewa-agen', 'overview'];

  // Child panel: menu "Order Nomor" (OTP) tampil setelah "Buat Pesanan".
  const base = IS_CHILD_PANEL
    ? [baseMenu[0], baseMenu[1], baseMenu[2], { id: 'nokos' as PageId, icon: Smartphone, label: 'Order Nomor', desc: 'Nomor OTP WhatsApp, Telegram, dll' }, ...baseMenu.slice(3)]
    : baseMenu;
  const combined = user
   ? [base[0], base[1], base[2],...authMenu,...base.slice(3)]
    : base;

  const menuItems = isAdmin
   ? []
    : combined
       .filter(
          (item) =>
           !HIDDEN_USER_ITEMS.includes(item.id) &&
            item.id!== HIDDEN_PROFILE_ITEM &&
            (!AUTH_REQUIRED.includes(item.id) || user!== null) &&
            // Child panel: sembunyikan menu "Upgrade" (upsell tidak relevan di panel kloning).
            !(IS_CHILD_PANEL && item.id === 'plus'),
        );

  const handleNav = (id: PageId) => {
    if (id === 'pengaturan') {
      onClose();
      return;
    }
    navigate(ROUTE_PATH[id]);
    onClose();
  };
  const logoutAndHome = () => {
    logout();
    onClose();
    navigate('/');
  };

  /* ===== kelas baris menu (expanded = panel | collapsed = rail ikon) ===== */
  const expandedRow = (active: boolean, extra = '') =>
    `flex w-full shrink-0 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 ${
      active
        ? 'by-menu-text'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
    } ${extra}`;
  const railRow = (active: boolean) =>
    `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
      active
        ? 'by-menu-text'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200'
    }`;

  const initials = user?.initials ?? 'U';
  const avatarGrad = user?.plusActive
    ? 'bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 ring-2 ring-amber-300 dark:ring-amber-400'
    : 'bg-gradient-to-br from-cyan-500 to-cyan-700';

  /* ===== konten panel — expanded (panel/mobile) atau collapsed (rail desktop) ===== */
  const renderPanel = (expanded: boolean) => (
    <>
      {/* Logo / brand */}
      <div className={`flex shrink-0 items-center gap-2.5 px-3 pt-3 ${expanded ? '' : 'justify-center px-0'}`}>
        <button
          onClick={() => { navigate(isAdmin ? '/admin' : '/'); onClose(); }}
          aria-label="Beranda"
          title="Beranda"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <img src={settings.logoUrl} alt={settings.brandName + settings.brandSuffix} className="h-8 w-8 object-contain" />
        </button>
        {expanded && (
          <div className="min-w-0">
            <p className="font-display text-[16px] font-extrabold leading-none tracking-tight">
              <span className="by-accent">{settings.brandName}</span>
              <span className="text-black dark:text-white">{settings.brandSuffix}</span>
            </p>
            {isAdmin && <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Admin Panel</p>}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={`min-h-0 flex-1 overflow-y-auto px-3 py-2 ${expanded ? '' : 'px-0'}`} aria-label="Navigasi">
        {expanded && (
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {isAdmin? 'Admin Menu' : 'Navigasi'}
          </p>
        )}

        {/* Admin menus */}
        {isAdmin && (
          <ul className={`space-y-1 ${expanded ? '' : 'flex flex-col items-center'}`}>
            {ADMIN_MENU.filter(item => !['withdraw','events'].includes(item.id) || !IS_CHILD_PANEL).map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || pathname.startsWith(item.path);
              return (
                <li key={item.id}>
                  <button
                    onClick={(event) => { if (item.id === 'event') { animateEventText(event.currentTarget); window.setTimeout(() => { navigate(item.path); onClose(); }, 480); return; } navigate(item.path); onClose(); }}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`${expanded ? expandedRow(isActive) : railRow(isActive)}`}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
                    {expanded && (
                      <span className="min-w-0 flex-1">
                        <span data-event-label={item.id === 'event' ? 'true' : undefined} className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                        <span className={`block truncate text-[11px] ${isActive? 'opacity-70' : 'text-slate-400 dark:text-slate-500'}`}>
                          {item.desc}
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Admin ke-2 (pemilik child panel) */}
        {!isAdmin && isPanelOwner && (
          <button
            onClick={() => { navigate('/panel-admin'); onClose(); }}
            title="Admin Panel Toko"
            aria-label="Admin Panel Toko"
            className={expanded
              ? `${expandedRow(pathname.startsWith('/panel-admin'))} mb-1`
              : `${railRow(pathname.startsWith('/panel-admin'))} mb-1`}
          >
            <Shield className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
            {expanded && (
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold leading-tight">Admin Panel Toko</span>
                <span className="block truncate text-[11px] opacity-70">Pendapatan, pesanan & user panel</span>
              </span>
            )}
          </button>
        )}

        {/* User menus */}
        {!isAdmin && (
          <>
            <ul className={`space-y-1 ${expanded ? '' : 'flex flex-col items-center'}`}>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.id!== 'pengaturan' && pathname === ROUTE_PATH[item.id];
                return (
                  <li key={item.id} className={expanded ? '' : 'flex justify-center'}>
                    <button
                      onClick={(event) => { if (item.id === 'event') { animateEventText(event.currentTarget); window.setTimeout(() => handleNav(item.id), 480); return; } handleNav(item.id); }}
                      title={item.label}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={`${expanded ? expandedRow(isActive) : railRow(isActive)} ${item.neon&& expanded? 'neon-menu-item active' : ''}`}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                      {expanded && (
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span data-event-label={item.id === 'event' ? 'true' : undefined} className="block text-[13px] font-semibold leading-tight">{item.label}</span>
                            {item.tag && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <Construction className="h-2.5 w-2.5" />
                                {item.tag}
                              </span>
                            )}
                          </span>
                          <span className={`block truncate text-[11px] ${isActive? 'opacity-70' : 'text-slate-400 dark:text-slate-500'}`}>
                            {item.desc}
                          </span>
                        </span>
                      )}
                      {expanded && item.badge && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isActive ? 'bg-cyan-600 text-white' : 'bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:ring-cyan-700/40'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {expanded && (
              <div className="mt-4 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-3.5 dark:border-cyan-800/30 dark:from-cyan-900/20 dark:to-slate-900">
                <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                  <Sparkles className="h-4 w-4" strokeWidth={2.3} />
                  <p className="text-[12px] font-bold">Tips booster</p>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Simpan ID pesanan setelah checkout agar mudah dilacak kapan saja.
                </p>
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer: profil akun (dikembalikan seperti semula — profil di side menu; Playground tetap terpisah di header) + keluar */}
      <div className={`shrink-0 border-t border-slate-200 dark:border-slate-700/60 ${expanded ? 'p-3' : 'flex flex-col items-center gap-1 p-2'}`}>
        {user ? (
          expanded ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-700/60 dark:bg-slate-800/50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center font-display text-[13px] font-extrabold text-white">
                  <UserAvatar user={user} fallbackClassName={`rounded-full ${avatarGrad}`}>{initials}</UserAvatar>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[12.5px] font-bold text-slate-800 dark:text-slate-100">
                    <span className="truncate">{user.name ?? 'User'}</span>
                    {user.plusActive && <Crown className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                  </p>
                  <p className="truncate text-[10.5px] font-semibold text-slate-400 dark:text-slate-500">{user.username ? `@${user.username}` : user.email}</p>
                  <p className="truncate font-display text-[12px] font-extrabold text-cyan-700 dark:text-cyan-400">{rupiah(user.balance)}</p>
                </div>
              </div>
              <button
                onClick={() => { navigate('/pengaturan-akun'); onClose(); }}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <Settings className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
                Pengaturan akun
              </button>
              <button
                onClick={logoutAndHome}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
              >
                <LogOut className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
                Keluar
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => { navigate('/pengaturan-akun'); onClose(); }}
                title="Pengaturan akun"
                aria-label="Pengaturan akun"
                className="flex h-11 w-11 items-center justify-center rounded-xl font-display text-[12px] font-extrabold text-white transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-cyan-500"
              >
                <UserAvatar user={user} fallbackClassName={`rounded-xl ${avatarGrad}`}>{initials}</UserAvatar>
              </button>
              <button
                onClick={logoutAndHome}
                title="Keluar"
                aria-label="Keluar"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-rose-500 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
              >
                <LogOut className="h-5 w-5" strokeWidth={2} />
              </button>
            </>
          )
        ) : (
          expanded && (
            <p className="text-center text-[10px] font-medium text-slate-300 dark:text-slate-600">
              {settings.brandName}{settings.brandSuffix} v1.2
            </p>
          )
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Scrim — hanya mobile/tablet */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[3px] transition-opacity duration-300 lg:hidden ${
          isOpen? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* ===== DESKTOP: rail ikon ↔ panel side menu — SATU panel yang melebar (bukan dua layer terpisah).
             Mode off: rail 64px (ikon saja). Mode on: melebar 272px (sidebar penuh).
             Kursor masuk ke ikon-ikon menu (mode off) → otomatis terbuka (hover, bukan klik). ===== */}
      <aside
        aria-hidden={!stripVisible}
        data-by-side-panel
        onMouseEnter={openOnHover}
        className={`fixed left-0 top-0 z-40 hidden h-full flex-col overflow-hidden border-r border-slate-200 bg-white shadow-none transition-[width,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-700/60 dark:bg-slate-900 lg:flex ${
          isOpen ? 'w-[272px] shadow-2xl shadow-slate-900/20 dark:shadow-black/40' : 'w-16'
        } ${stripVisible ? 'translate-x-0 visible' : 'pointer-events-none invisible -translate-x-full'}`}
      >
        {renderPanel(isOpen)}
      </aside>

      {/* ===== MOBILE/TABLET: overlay dari kiri (selalu panel penuh) ===== */}
      <aside
        data-by-side-panel
        className={`fixed left-0 top-0 z-50 flex h-full w-[82%] max-w-[272px] flex-col border-r border-slate-200 bg-white shadow-2xl shadow-slate-900/20 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-black/40 lg:hidden ${
          isOpen? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderPanel(true)}
      </aside>
    </>
  );
}
