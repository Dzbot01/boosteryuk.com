import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PENDING_ORDER_PATH_KEY } from './GoogleMapsReviewColumns';
import Header from './Header';
import PpobHeader from './PpobHeader';
import { AdminNotificationsProvider } from '../context/AdminNotificationsContext';
import GuriVoiceSession from './GuriVoiceSession';
import SideMenu from './SideMenu';
import BottomNavbar from './BottomNavbar';
import AuthLoadingModal from './AuthLoadingModal';
import Footer from './Footer';
import HeaderOrnament from './HeaderOrnament';
import SessionGuard from './SessionGuard';
import NexSpaceBanner from './NexSpaceBanner';
import OrderReviewBanner from './OrderReviewBanner';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Setelah login Google (kembali ke /overview), lanjutkan step order yang tertunda
  // dari tombol keranjang Google Maps Review di dashboard.
  useEffect(() => {
    if (loading || !user) return;
    let path = '';
    try { path = sessionStorage.getItem(PENDING_ORDER_PATH_KEY) || ''; } catch { path = ''; }
    if (!/^\/layanan\?service=[^&]+$/.test(path)) return;
    try { sessionStorage.removeItem(PENDING_ORDER_PATH_KEY); } catch { /* abaikan */ }
    navigate(path);
  }, [user, loading, navigate]);

  // Reset scroll position when the route changes (except for in-page anchors).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // Proteksi asset gambar situs: blokir seret (drag) dan menu konteks
  // (simpan/salin gambar) pada semua <img> di seluruh halaman.
  useEffect(() => {
    const isImage = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return Boolean(el && (el.tagName === 'IMG' || el.closest?.('img')));
    };
    const onDragStart = (e: DragEvent) => {
      if (isImage(e.target)) e.preventDefault();
    };
    const onContextMenu = (e: MouseEvent) => {
      if (isImage(e.target)) e.preventDefault();
    };
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  return (
    <AdminNotificationsProvider><div className={`relative flex min-h-screen flex-col overflow-x-clip bg-[#eef1f5] text-slate-900 transition-[background-color,border-color,color,padding] duration-300 dark:bg-black dark:text-slate-100 lg:pl-16`}>
      <GuriVoiceSession />
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-grid dark:opacity-40" />
        <div className="absolute -left-32 top-0 h-[520px] w-[520px] rounded-full bg-blue-400/10 blur-[110px] dark:bg-white/[0.025]" />
        <div className="absolute -right-40 top-[380px] h-[460px] w-[460px] rounded-full bg-fuchsia-300/10 blur-[120px] dark:bg-white/[0.02]" />
        <div className="absolute bottom-0 left-1/2 h-[380px] w-[820px] -translate-x-1/2 rounded-full bg-sky-100/60 blur-[100px] dark:bg-white/[0.03]" />
      </div>

      {pathname === '/ppob' || pathname.startsWith('/ppob/') ? (
        /* Halaman PPOB: header biru PPOB MENJADI header utama situs (ikon header lama
           pindah ke sana); header glass + ornamen + spacer tidak dirender. */
        <PpobHeader
          variant={pathname === '/ppob' ? 'beranda' : 'pulsa'}
          onToggleMenu={() => setMenuOpen((v) => !v)}
          menuOpen={menuOpen}
        />
      ) : (
        <>
          <Header onToggleMenu={() => setMenuOpen((v) => !v)} menuOpen={menuOpen} />
          {/* Aksesoris tema (ketupat, lentera, dll) menggantung di bawah header */}
          <HeaderOrnament />
          {/* spacer for fixed header */}
          <div className="h-[68px]" />
        </>
      )}
      {/* Pintu masuk kembali ke Portal Server NexSpace Pro (pesanan belum diambil) */}
      <NexSpaceBanner />
      {/* Notifikasi pesanan selesai → ajakan beri penilaian (mobile: bawah header, desktop: atas) */}
      <OrderReviewBanner />

      <SideMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpen={() => setMenuOpen(true)}
      />

      <div className="flex-1">
        <Outlet />
      </div>

      {/* Footer global: tampil di semua halaman */}
      <Footer />

      <BottomNavbar />

      {/* Modal loading auth: hanya tampil sekali saat data akun pertama dimuat
          (menggantikan InfoModal + PushBanner yang muncul tiap buka/refresh). */}
      <AuthLoadingModal />

      {/* Sesi kedaluwarsa → keluar otomatis + kembali ke beranda */}
      <SessionGuard />

    </div></AdminNotificationsProvider>
  );
}
