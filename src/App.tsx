import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { MusicProvider } from './context/MusicContext';
import HomePage from './pages/HomePage';
import CekStatusPage from './pages/CekStatusPage';
// DISEMBUNYIKAN DARI UI (atas permintaan): fitur "Order Nomor" tidak ditampilkan.
// File halaman & datanya SENGAJA TIDAK DIHAPUS; aktifkan lagi dengan meng-uncomment
// import + route di bawah bila ingin ditampilkan kembali.
// import OrderNomorGuidePage from './pages/OrderNomorGuidePage';
// import OrderNomorPage from './pages/OrderNomorPage';
import RiwayatPage from './pages/RiwayatPage';
import HubungiPage from './pages/HubungiPage';
import AboutPage from './pages/AboutPage';
import PlusPage from './pages/PlusPage';
import UpgradePlusPage from './pages/UpgradePlusPage';
import SupportPage from './pages/SupportPage';
import PaymentPage from './pages/PaymentPage';
import TermsPage from './pages/TermsPage';
import ManualDepositPage from './pages/ManualDepositPage';
import StrukPage from './pages/StrukPage';
import StrukSuksesPage from './pages/StrukSuksesPage';
import PrivacyPage from './pages/PrivacyPage';
import LayananPage from './pages/LayananPage';
import LayananDetailPage from './pages/LayananDetailPage';
import OrderVpsPage from './pages/OrderVpsPage';
import PengaturanAkunPage from './pages/PengaturanAkunPage';
import DepositPage from './pages/DepositPage';
import DepositMethodPage from './pages/DepositMethodPage';
import AdminHomePage from './pages/admin/AdminHomePage';
import AdminWebsitePage from './pages/admin/AdminWebsitePage';
import AdminServerPage from './pages/admin/AdminServerPage';
import AdminProfitPage from './pages/admin/AdminProfitPage';
import AdminBroadcastPage from './pages/admin/AdminBroadcastPage';

export default function App() {
  return (
    <MusicProvider>
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
    </MusicProvider>
  );
}