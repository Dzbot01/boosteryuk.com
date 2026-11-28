import { IS_CHILD_PANEL } from './lib/apiBase';
import GoogleAuthPage from './pages/GoogleAuthPage';
import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { MusicProvider } from './context/MusicContext';
const ProfilPage = lazy(() => import('./pages/ProfilPage'));
const EventGamePage = lazy(() => import('./pages/EventGamePage'));
const DailyStreakPage = lazy(() => import('./pages/DailyStreakPage'));
const EventsPage = lazy(() => import('./pages/EventsPage'));
const AdminEventDataPage = lazy(() => import('./pages/admin/AdminEventDataPage'));
const AdminEventsPage = lazy(() => import('./pages/admin/AdminEventsPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const CekStatusPage = lazy(() => import('./pages/CekStatusPage'));
// Halaman Order Nomor versi LAMA (statis) tetap disembunyikan; kode dipertahankan.
// Yang aktif sekarang: OrderOtpPage (OTP realtime, bayar saldo) — tampil di menu
// ROOT DOMAIN maupun child panel, dan pendapatannya dicatat di My Profit admin.
// const OrderNomorGuidePage = lazy(() => import('./pages/OrderNomorGuidePage'));
// const OrderNomorPage = lazy(() => import('./pages/OrderNomorPage'));
// Order Nomor OTP realtime (bayar saldo) — UI sama di root domain & child panel.
const OrderOtpPage = lazy(() => import('./pages/OrderOtpPage'));
const ArtikelIndexPage = lazy(() => import('./pages/artikel/ArtikelIndexPage'));
const ArtikelPage = lazy(() => import('./pages/artikel/ArtikelPage'));
const RiwayatPage = lazy(() => import('./pages/RiwayatPage'));
const HubungiPage = lazy(() => import('./pages/HubungiPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PlusPage = lazy(() => import('./pages/PlusPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ManualDepositPage = lazy(() => import('./pages/ManualDepositPage'));
const StrukPage = lazy(() => import('./pages/StrukPage'));
const StrukSuksesPage = lazy(() => import('./pages/StrukSuksesPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const LayananPage = lazy(() => import('./pages/LayananPage'));
const LayananDetailPage = lazy(() => import('./pages/LayananDetailPage'));
// Menu VPS diganti NexSpace (OrderVpsPage lama tidak dipakai lagi).
const NexSpacePage = lazy(() => import('./pages/NexSpacePage'));
const NexSpacePortalPage = lazy(() => import('./pages/NexSpacePortalPage'));
const AdminNexSpacePage = lazy(() => import('./pages/admin/AdminNexSpacePage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminDepositPage = lazy(() => import('./pages/admin/AdminDepositPage'));
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage'));
const SewaAgenAiPage = lazy(() => import('./pages/SewaAgenAiPage'));
const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const AgenAiSayaPage = lazy(() => import('./pages/AgenAiSayaPage'));
const AdminChildPanelPage = lazy(() => import('./pages/admin/AdminChildPanelPage'));
const AdminWithdrawPage = lazy(() => import('./pages/admin/AdminWithdrawPage'));
const PanelAdminPage = lazy(() => import('./pages/PanelAdminPage'));
const ExtraSetupPage = lazy(() => import('./pages/ExtraSetupPage'));
const DepositPage = lazy(() => import('./pages/DepositPage'));
const DepositHistoryPage = lazy(() => import('./pages/DepositHistoryPage'));
const DepositMethodPage = lazy(() => import('./pages/DepositMethodPage'));
const AdminHomePage = lazy(() => import('./pages/admin/AdminHomePage'));
const AdminWebsitePage = lazy(() => import('./pages/admin/AdminWebsitePage'));
const AdminPpobNewsPage = lazy(() => import('./pages/admin/AdminPpobNewsPage'));
const AdminServerPage = lazy(() => import('./pages/admin/AdminServerPage'));
const AdminProfitPage = lazy(() => import('./pages/admin/AdminProfitPage'));
const AdminBroadcastPage = lazy(() => import('./pages/admin/AdminBroadcastPage'));
const AdminDatabasePage = lazy(() => import('./pages/admin/AdminDatabasePage'));
const ReviewSubmitPage = lazy(() => import('./pages/ReviewSubmitPage'));
const ReviewBoardPage = lazy(() => import('./pages/ReviewBoardPage'));
const TopupGamePage = lazy(() => import('./pages/TopupGamePage'));
const TopupGameDetailPage = lazy(() => import('./pages/TopupGameDetailPage'));
const PpobPage = lazy(() => import('./pages/PpobPage'));
const PpobPulsaRegulerPage = lazy(() => import('./pages/PpobPulsaRegulerPage'));
const PpobLayananPage = lazy(() => import('./pages/PpobLayananPage'));
const PpobLayananOrderPage = lazy(() => import('./pages/PpobLayananOrderPage'));

export default function App() {
  return (
    <MusicProvider>
      <Suspense fallback={null}>
      <Routes>
        <Route path="auth/google" element={<GoogleAuthPage />} />
        <Route path="auth/finish" element={<GoogleAuthPage finish />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="profil" element={<ProtectedRoute><ProfilPage /></ProtectedRoute>} />
          <Route path="event" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
          <Route path="event/daily-streak" element={<ProtectedRoute><DailyStreakPage /></ProtectedRoute>} />
          <Route path="event/:id/game" element={<ProtectedRoute><EventGamePage /></ProtectedRoute>} />
          <Route path="admin/events/:id/data" element={<ProtectedRoute adminOnly><AdminEventDataPage /></ProtectedRoute>} />
          <Route path="admin/events" element={<ProtectedRoute adminOnly><AdminEventsPage /></ProtectedRoute>} />
          <Route path="cek-status" element={<CekStatusPage />} />
          <Route path="riwayat-pesanan" element={<RiwayatPage />} />
          <Route path="hubungi" element={<HubungiPage />} />
          <Route path="hubungi-kami" element={<Navigate to="/hubungi" replace />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="artikel" element={<ArtikelIndexPage />} />
          <Route path="artikel/:slug" element={<ArtikelPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="struk" element={<StrukPage />} />
          <Route path="layanan" element={<LayananPage />} />
          <Route path="topup" element={<TopupGamePage />} />
          <Route path="topup/:slug" element={<TopupGameDetailPage />} />
          {/* PPOB — pulsa, paket data, e-money & bayar tagihan (beranda + pulsa reguler). */}
          <Route path="ppob" element={<ProtectedRoute><PpobPage /></ProtectedRoute>} />
          <Route path="ppob/pulsa-reguler" element={<ProtectedRoute><PpobPulsaRegulerPage /></ProtectedRoute>} />
          {/* Semua layanan SELAIN top up game (dari katalog penuh penyedia) — grid card. */}
          <Route path="ppob/layanan" element={<ProtectedRoute><PpobLayananPage /></ProtectedRoute>} />
          {/* Halaman order KHUSUS per layanan (mis. ACT AXIS, OVO) atau per kategori (mis. Aktivasi Perdana). */}
          <Route path="ppob/layanan/:id" element={<ProtectedRoute><PpobLayananOrderPage /></ProtectedRoute>} />
          <Route path="playground" element={IS_CHILD_PANEL ? <Navigate to="/" replace /> : <PlaygroundPage />} />
          <Route path="sewa-agen-ai" element={<SewaAgenAiPage />} />
          <Route path="overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="upgrade/extra" element={<ProtectedRoute><ExtraSetupPage /></ProtectedRoute>} />
          <Route path="panel-admin" element={<ProtectedRoute><PanelAdminPage /></ProtectedRoute>} />
          <Route path="agen-ai-saya" element={<ProtectedRoute><AgenAiSayaPage /></ProtectedRoute>} />
          <Route path="layanan/:platform" element={<LayananDetailPage />} />
          <Route path="plus" element={<PlusPage />} />

          {/* DEPOSIT - yang static dulu, baru yang dynamic :method */}
          <Route path="deposit/manual" element={<ManualDepositPage />} />
          <Route path="deposit" element={<ProtectedRoute><DepositPage /></ProtectedRoute>} />
          <Route path="riwayat-deposit" element={<ProtectedRoute><DepositHistoryPage /></ProtectedRoute>} />
          <Route path="deposit/:method" element={<ProtectedRoute><DepositMethodPage /></ProtectedRoute>} />

          {/* Halaman Order Nomor lama (statis) tetap disembunyikan; yang aktif OrderOtpPage di bawah ini. */}
          <Route path="otp-service" element={<ProtectedRoute><OrderOtpPage /></ProtectedRoute>} />
          <Route path="beri-penilaian" element={<ProtectedRoute><ReviewSubmitPage /></ProtectedRoute>} />
          <Route path="papan-penilaian" element={<ReviewBoardPage />} />
          {/* Checkout lama digantikan halaman Upgrade (/plus) */}
          <Route path="upgrade-plus" element={<Navigate to="/plus" replace />} />
          <Route path="ordervps" element={<Navigate to="/nexspace" replace />} />
          <Route path="nexspace" element={<ProtectedRoute><NexSpacePage /></ProtectedRoute>} />
          <Route path="nexspace/portal" element={<ProtectedRoute><NexSpacePortalPage /></ProtectedRoute>} />
          <Route path="payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
          <Route path="pengaturan-akun" element={<Navigate to="/profil#pengaturan-akun" replace />} />

          <Route path="admin" element={<ProtectedRoute adminOnly><AdminHomePage /></ProtectedRoute>} />
          <Route path="admin/profit" element={<ProtectedRoute adminOnly><AdminProfitPage /></ProtectedRoute>} />
          <Route path="admin/broadcast" element={<ProtectedRoute adminOnly><AdminBroadcastPage /></ProtectedRoute>} />
          <Route path="admin/website" element={<ProtectedRoute adminOnly><AdminWebsitePage /></ProtectedRoute>} />
          {/* News Update PPOB: berita (card + modal) & kartu promo halaman PPOB. */}
          <Route path="admin/ppob-news" element={<ProtectedRoute adminOnly><AdminPpobNewsPage /></ProtectedRoute>} />
          <Route path="admin/child-panel" element={<ProtectedRoute adminOnly><AdminChildPanelPage /></ProtectedRoute>} />
          <Route path="admin/orders" element={<ProtectedRoute adminOnly><AdminOrdersPage /></ProtectedRoute>} />
          <Route path="admin/users" element={<ProtectedRoute adminOnly><AdminUsersPage /></ProtectedRoute>} />
          <Route path="admin/deposit" element={<ProtectedRoute adminOnly><AdminDepositPage /></ProtectedRoute>} />
          <Route path="admin/nexspace" element={<ProtectedRoute adminOnly><AdminNexSpacePage /></ProtectedRoute>} />
          <Route path="admin/withdraw" element={<ProtectedRoute adminOnly><AdminWithdrawPage /></ProtectedRoute>} />
          <Route path="admin/server" element={<ProtectedRoute adminOnly><AdminServerPage /></ProtectedRoute>} />
          <Route path="admin/database" element={<ProtectedRoute adminOnly><AdminDatabasePage /></ProtectedRoute>} />

          <Route path="s/:slug" element={<StrukSuksesPage />} />
          <Route path="struk/:slug" element={<StrukSuksesPage />} />
          <Route path=":slug" element={<StrukSuksesPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      </Suspense>
    </MusicProvider>
  );
}