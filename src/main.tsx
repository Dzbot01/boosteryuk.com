import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { BrandRewriter } from './lib/brandRewrite';
import { DepositProvider } from './context/DepositContext';
import { OrderHistoryProvider } from './context/OrderHistoryContext';
import { LanguageProvider } from './i18n'; // i18n ID/EN (penerjemah DOM)
import { GoogleClientIdProvider } from './context/GoogleClientIdContext';
import { MAIN_API } from './lib/apiBase';
import './index.css';
import { startAppUpdateWatcher } from './lib/appUpdate';

// Muat ulang otomatis saat ada deploy baru (hindari cache lama).
startAppUpdateWatcher();

/** Layar tunggu sesaat saat Client ID Google diambil dari PHP (sekali, saat app dibuka). */
function BootSplash() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#eef1f5] dark:bg-[#0a0a0b]"
      role="status"
      aria-label="Memuat Boosteryuk"
    >
      <div className="h-10 w-10 animate-pulse rounded-2xl bg-cyan-600/90" aria-hidden />
      <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-400">Memuat Boosteryuk…</p>
    </div>
  );
}

const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

function Root() {
  // null = sedang memuat, '' = gagal/belum dikonfigurasi (app tetap jalan; tombol Google menampilkan pesan).
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  // Client ID Google diambil DULU dari PHP (google_auth.php?action=client_id) — satu-satunya
  // tempat yang boleh membaca .env di server. Client ID boleh diekspos ke browser; Client Secret tidak pernah keluar dari server.
  useEffect(() => {
    let alive = true;
    fetch(`${MAIN_API}/google_auth.php?action=client_id&t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((j) => {
        if (!alive) return;
        setGoogleClientId(j?.ok && typeof j.clientId === 'string' && j.clientId ? j.clientId : '');
      })
      .catch(() => alive && setGoogleClientId(''));
    return () => {
      alive = false;
    };
  }, []);

  if (googleClientId === null) {
    return <BootSplash />;
  }

  const tree = (
    <GoogleClientIdProvider clientId={googleClientId}>
      <LanguageProvider>
        <ThemeProvider>
          <SiteSettingsProvider>
            <BrandRewriter />
            <AuthProvider>
              <OrderHistoryProvider>
                <DepositProvider>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                </DepositProvider>
              </OrderHistoryProvider>
            </AuthProvider>
          </SiteSettingsProvider>
        </ThemeProvider>
      </LanguageProvider>
    </GoogleClientIdProvider>
  );

  // Tanpa Client ID, jangan muat script GSI sama sekali; app tetap dirender normal.
  return googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider> : tree;
}

root.render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
