import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SiteSettingsProvider } from './context/SiteSettingsContext';
import { DepositProvider } from './context/DepositContext';
import { OrderHistoryProvider } from './context/OrderHistoryContext';
import { LanguageProvider } from './i18n'; // i18n ID/EN (penerjemah DOM)
import './index.css';
import { startAppUpdateWatcher } from './lib/appUpdate';

// Muat ulang otomatis saat ada deploy baru (hindari cache lama).
startAppUpdateWatcher();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>,
);
