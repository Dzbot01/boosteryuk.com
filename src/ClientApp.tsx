'use client';
// Host SPA (React Router) di dalam Next.js. Dirender hanya di klien (BrowserRouter butuh window),
// sehingga seluruh UI & logic lama dipertahankan tanpa perubahan — termasuk logic auth.
import { useEffect, useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { DepositProvider } from './context/DepositContext';
import { OrderHistoryProvider } from './context/OrderHistoryContext';
import { LanguageProvider } from './i18n';

export default function ClientApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return (
    <LanguageProvider>
      <ThemeProvider>
        <SiteSettingsProvider>
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
  );
}
