import {
  Home,
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
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { usePanelOwner } from '../services/panelApi';
import { IS_CHILD_PANEL } from '../lib/apiBase';

export type PageId =
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
  | 'deposit'
  | 'overview'
  | 'sewa-agen'
  | 'plus';

const ROUTE_PATH: Record<PageId, string> = {
  home: '/',
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
  { id: 'payment', icon: Wallet, label: 'Payment', desc: 'Saldo & transaksi' },
];

const HIDDEN_USER_ITEMS = ['payment', 'struk'];
const HIDDEN_PROFILE_ITEM = 'profil';

export { baseMenu, authMenu };

/** Tombol ikon di rail kiri (desktop, tampil hanya saat side menu tertutup). */
function RailButton({ icon: Icon, label, active, onClick }: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${
        active
          ? 'by-menu-text'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200'
      }`}
    >
      <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
    </button>
  );
}

const ADMIN_MENU = [
  { id: 'orders' as const, icon: ClipboardList, label: 'Data Pesanan', desc: 'Pesanan semua user', path: '/admin/orders' },
  { id: 'users' as const, icon: Users, label: 'Data User', desc: 'Saldo & data user', path: '/admin/users' },
  { id: 'deposits' as const, icon: Wallet, label: 'Data Deposit', desc: 'Deposit terbaru', path: '/admin/deposit' },
  { id: 'childpanel' as const, icon: Globe, label: 'Child Panel', desc: 'Subdomain reseller', path: '/admin/child-panel' },
  { id: 'profit' as const, icon: DollarSign, label: 'My Profit', desc: 'Ringkasan keuangan', path: '/admin/profit' },
  { id: 'website' as const, icon: Settings, label: 'Pengaturan Website', desc: 'Logo, brand & musik', path: '/admin/website' },
  { id: 'broadcast' as const, icon: Megaphone, label: 'Broadcast', desc: 'Broadcasting', path: '/admin/broadcast' },
  { id: 'nexspace' as const, icon: Server, label: 'NexSpace Pro Request', desc: 'Kirim data login Pro', path: '/admin/nexspace' },
  { id: 'server' as const, icon: Server, label: 'Server Panel', desc: 'Ping provider', path: '/admin/server' },
];

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const { user, isAdmin, logout } = useAuth();
  const { settings } = useSiteSettings();
  // Child panel: pemilik panel (admin ke-2) mendapat menu Admin Panel Toko.
  const isPanelOwner = usePanelOwner(user?.token) === true && IS_CHILD_PANEL;
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location?.pathname || "/";

  const AUTH_REQUIRED = ['layanan', 'pengaturan', 'riwayat', 'ordervps', 'deposit', 'nokos', 'plus', 'sewa-agen', 'overview'];

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
            (!AUTH_REQUIRED.includes(item.id) || user!== null),
        );

  const handleNav = (id: PageId) => {
    if (id === 'pengaturan') {
      onClose();
      return;
    }
    navigate(ROUTE_PATH[id]);
    onClose();
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[3px] transition-opacity duration-300 ${
          isOpen? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />

      {/* ===== Rail ikon (desktop saja): saat side menu TERTUTUP, hanya ikon menu yang tampil di tepi kiri —
             tempat yang sama dari mana side menu meluncur keluar. ===== */}
      <div
        aria-hidden={isOpen}
        className={`fixed left-0 top-0 z-40 hidden h-full w-16 flex-col items-center border-r border-slate-200 bg-white py-3 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-700/60 dark:bg-slate-900 lg:flex ${
          isOpen ? 'pointer-events-none invisible -translate-x-full' : 'visible translate-x-0'
        }`}
      >
        <button
          onClick={() => navigate(isAdmin ? '/admin' : '/')}
          aria-label="Beranda"
          title="Beranda"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <img src={settings.logoUrl} alt={settings.brandName + settings.brandSuffix} className="h-8 w-8 object-contain" />
        </button>
        <div className="my-2 h-px w-8 shrink-0 bg-slate-200 dark:bg-slate-700/70" />

        <nav className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto px-2.5" aria-label="Navigasi ikon">
          {isAdmin &&
            ADMIN_MENU.map((item) => (
              <RailButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={pathname === item.path || pathname.startsWith(item.path)}
                onClick={() => navigate(item.path)}
              />
            ))}

          {!isAdmin && isPanelOwner && (
            <RailButton
              icon={Shield}
              label="Admin Panel Toko"
              active={pathname.startsWith('/panel-admin')}
              onClick={() => navigate('/panel-admin')}
            />
          )}

          {!isAdmin &&
            menuItems.map((item) => (
              <RailButton
                key={item.id}
                icon={item.icon}
                label={item.label}
                active={item.id !== 'pengaturan' && pathname === ROUTE_PATH[item.id]}
                onClick={() => handleNav(item.id)}
              />
            ))}
        </nav>

        {user && (
          <button
            onClick={() => {
              logout();
              onClose();
              navigate('/');
            }}
            aria-label="Keluar"
            title="Keluar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-rose-500 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
          >
            <LogOut className="h-5 w-5" strokeWidth={2} />
          </button>
        )}
      </div>

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[82%] max-w-[272px] flex-col border-r border-slate-200 bg-white shadow-2xl shadow-slate-900/20 transition-transform duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-black/40 ${
          isOpen? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-cyan-700 via-cyan-600 to-cyan-900 px-4 pb-5 pt-4">
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-xl" />
          <div className="bg-dots absolute inset-0 opacity-20" />
          <div className="relative">
            {/* UI: logo & nama brand di atas menu dihapus; diganti satu judul pertanyaan. */}
            <div className="min-w-0">
              {isAdmin && (
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/80">
                  Admin Panel
                </p>
              )}
              <h2 className={`${isAdmin ? 'mt-1 ' : ''}font-display text-[17px] font-extrabold leading-snug text-white`}>
                Apa yang sedang kamu butuhkan?
              </h2>
            </div>
          </div>

        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            {isAdmin? 'Admin Menu' : 'Navigasi'}
          </p>

          {/* Admin menus */}
          {isAdmin && (
            <ul className="space-y-1">
              {ADMIN_MENU.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.path || pathname.startsWith(item.path);
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        navigate(item.path);
                        onClose();
                      }}
                      className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 ${
                        isActive
                         ? 'by-menu-text'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold leading-tight">
                          {item.label}
                        </span>
                        <span
                          className={`block truncate text-[11px] ${
                            isActive? 'opacity-70' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {item.desc}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Admin ke-2 (pemilik child panel) */}
          {!isAdmin && isPanelOwner && (
            <button
              onClick={() => {
                navigate('/panel-admin');
                onClose();
              }}
              className={`mb-3 flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                pathname.startsWith('/panel-admin')
                  ? 'by-menu-text'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Shield className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold leading-tight">Admin Panel Toko</span>
                <span className="block truncate text-[11px] opacity-70">Pendapatan, pesanan & user panel</span>
              </span>
            </button>
          )}

          {/* User menus */}
          {!isAdmin && (
            <>
              <ul className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.id!== 'pengaturan' &&
                    pathname === ROUTE_PATH[item.id];
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleNav(item.id)}
                        className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 ${
                          isActive
                           ? 'by-menu-text'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                        } ${item.neon? 'neon-menu-item active' : ''}`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="block text-[13.5px] font-semibold leading-tight">
                              {item.label}
                            </span>
                            {item.tag && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                <Construction className="h-2.5 w-2.5" />
                                {item.tag}
                              </span>
                            )}
                          </span>
                          <span
                            className={`block truncate text-[11px] ${
                              isActive? 'opacity-70' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {item.desc}
                          </span>
                        </span>
                        {item.badge && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              isActive
                               ? 'bg-white text-cyan-700 dark:bg-slate-900'
                                : 'bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100 dark:bg-cyan-900/30 dark:text-cyan-400 dark:ring-cyan-700/40'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 to-white p-4 dark:border-cyan-800/30 dark:from-cyan-900/20 dark:to-slate-900">
                <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400">
                  <Sparkles className="h-4 w-4" strokeWidth={2.3} />
                  <p className="text-[12px] font-bold">Tips booster</p>
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Simpan ID pesanan setelah checkout agar mudah dilacak kapan saja.
                </p>
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-700/60">
          {user && (
            <button
              onClick={() => {
                logout();
                onClose();
                navigate('/');
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-rose-600 transition-all duration-200 hover:bg-rose-50 active:scale-[0.98] dark:text-rose-400 dark:hover:bg-rose-900/20"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block truncate leading-tight">Keluar</span>
                <span className="block truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {user.email}
                </span>
              </span>
            </button>
          )}
          <p className="mt-2 text-center text-[10px] font-medium text-slate-300 dark:text-slate-600">
            {settings.brandName}
            {settings.brandSuffix} v1.2
          </p>
        </div>
      </aside>
    </>
  );
}