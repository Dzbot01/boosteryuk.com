import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { MusicProvider } from './context/MusicContext';
const HomePage = lazy(() => import('./pages/HomePage'));
const CekStatusPage = lazy(() => import('./pages/CekStatusPage'));
// DISEMBUNYIKAN DARI UI (atas permintaan): fitur "Order Nomor" tidak ditampilkan.
// File halaman & datanya SENGAJA TIDAK DIHAPUS; aktifkan lagi dengan meng-uncomment
// import + route di bawah bila ingin ditampilkan kembali.
// const OrderNomorGuidePage = lazy(() => import('./pages/OrderNomorGuidePage'));
// const OrderNomorPage = lazy(() => import('./pages/OrderNomorPage'));
const RiwayatPage = lazy(() => import('./pages/RiwayatPage'));
const HubungiPage = lazy(() => import('./pages/HubungiPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PlusPage = lazy(() => import('./pages/PlusPage'));
const UpgradePlusPage = lazy(() => import('./pages/UpgradePlusPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const PaymentPage = lazy(() => import('./pages/PaymentPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const ManualDepositPage = lazy(() => import('./pages/ManualDepositPage'));
const StrukPage = lazy(() => import('./pages/StrukPage'));
const StrukSuksesPage = lazy(() => import('./pages/StrukSuksesPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const LayananPage = lazy(() => import('./pages/LayananPage'));
const LayananDetailPage = lazy(() => import('./pages/LayananDetailPage'));
const OrderVpsPage = lazy(() => import('./pages/OrderVpsPage'));
const PengaturanAkunPage = lazy(() => import('./pages/PengaturanAkunPage'));
const DepositPage = lazy(() => import('./pages/DepositPage'));
const DepositMethodPage = lazy(() => import('./pages/DepositMethodPage'));
const AdminHomePage = lazy(() => import('./pages/admin/AdminHomePage'));
const AdminWebsitePage = lazy(() => import('./pages/admin/AdminWebsitePage'));
const AdminServerPage = lazy(() => import('./pages/admin/AdminServerPage'));
const AdminProfitPage = lazy(() => import('./pages/admin/AdminProfitPage'));
const AdminBroadcastPage = lazy(() => import('./pages/admin/AdminBroadcastPage'));

export default function App() {
  return (
    <MusicProvider>
      <Suspense fallback={null}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="cek-status" element={<CekStatusPage />} />
          <Route path="riwayat-pesanan" element={<RiwayatPage />} />
          <Route path="hubungi" element={<HubungiPage />} />
          <Route path="hubungi-kami" element={<Navigate to="/hubungi" replace />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="struk" element={<StrukPage />} />
          <Route path="layanan" element={<LayananPage />} />
          <Route path="layanan/:platform" element={<LayananDetailPage />} />
          <Route path="plus" element={<PlusPage />} />

          {/* DEPOSIT - yang static dulu, baru yang dynamic :method */}
          <Route path="deposit/manual" element={<ManualDepositPage />} />
          <Route path="deposit" element={<ProtectedRoute><DepositPage /></ProtectedRoute>} />
          <Route path="deposit/:method" element={<ProtectedRoute><DepositMethodPage /></ProtectedRoute>} />

          {/* Order Nomor disembunyikan dari UI (kode dipertahankan):
          <Route path="otp-service/panduan" element={<OrderNomorGuidePage />} />
          <Route path="otp-service" element={<ProtectedRoute><OrderNomorPage /></ProtectedRoute>} /> */}
          <Route path="upgrade-plus" element={<ProtectedRoute><UpgradePlusPage /></ProtectedRoute>} />
          <Route path="ordervps" element={<ProtectedRoute><OrderVpsPage /></ProtectedRoute>} />
          <Route path="payment" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
          <Route path="pengaturan-akun" element={<ProtectedRoute><PengaturanAkunPage /></ProtectedRoute>} />

          <Route path="admin" element={<ProtectedRoute adminOnly><AdminHomePage /></ProtectedRoute>} />
          <Route path="admin/profit" element={<ProtectedRoute adminOnly><AdminProfitPage /></ProtectedRoute>} />
          <Route path="admin/broadcast" element={<ProtectedRoute adminOnly><AdminBroadcastPage /></ProtectedRoute>} />
          <Route path="admin/website" element={<ProtectedRoute adminOnly><AdminWebsitePage /></ProtectedRoute>} />
          <Route path="admin/server" element={<ProtectedRoute adminOnly><AdminServerPage /></ProtectedRoute>} />

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