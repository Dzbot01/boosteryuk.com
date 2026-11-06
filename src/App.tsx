import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { MusicProvider } from './context/MusicContext';
import HomePage from './screens/HomePage';
import CekStatusPage from './screens/CekStatusPage';
// DISEMBUNYIKAN DARI UI (atas permintaan): fitur "Order Nomor" tidak ditampilkan.
// File halaman & datanya SENGAJA TIDAK DIHAPUS; aktifkan lagi dengan meng-uncomment
// import + route di bawah bila ingin ditampilkan kembali.
// import OrderNomorGuidePage from './screens/OrderNomorGuidePage';
// import OrderNomorPage from './screens/OrderNomorPage';
import RiwayatPage from './screens/RiwayatPage';
import HubungiPage from './screens/HubungiPage';
import AboutPage from './screens/AboutPage';
import PlusPage from './screens/PlusPage';
import UpgradePlusPage from './screens/UpgradePlusPage';
import SupportPage from './screens/SupportPage';
import PaymentPage from './screens/PaymentPage';
import TermsPage from './screens/TermsPage';
import ManualDepositPage from './screens/ManualDepositPage';
import StrukPage from './screens/StrukPage';
import StrukSuksesPage from './screens/StrukSuksesPage';
import PrivacyPage from './screens/PrivacyPage';
import LayananPage from './screens/LayananPage';
import LayananDetailPage from './screens/LayananDetailPage';
import OrderVpsPage from './screens/OrderVpsPage';
import PengaturanAkunPage from './screens/PengaturanAkunPage';
import DepositPage from './screens/DepositPage';
import DepositMethodPage from './screens/DepositMethodPage';
import AdminHomePage from './screens/admin/AdminHomePage';
import AdminWebsitePage from './screens/admin/AdminWebsitePage';
import AdminServerPage from './screens/admin/AdminServerPage';
import AdminProfitPage from './screens/admin/AdminProfitPage';
import AdminBroadcastPage from './screens/admin/AdminBroadcastPage';

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