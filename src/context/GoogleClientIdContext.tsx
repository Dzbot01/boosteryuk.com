// Client ID Google OAuth diambil SEKALI dari PHP saat aplikasi start (lihat main.tsx),
// lalu dibagikan lewat context ini. String kosong = belum dikonfigurasi.
// loadError = google_auth.php tidak bisa dihubungi / error HTTP (mis. 502) → AuthModal
// menampilkan pesan ramah, bukan "belum dikonfigurasi".
import { createContext, useContext } from 'react';

interface GoogleClientIdState {
  clientId: string;
  loadError: boolean;
}

const GoogleClientIdContext = createContext<GoogleClientIdState>({ clientId: '', loadError: false });

export function GoogleClientIdProvider({
  clientId,
  loadError = false,
  children,
}: {
  clientId: string;
  loadError?: boolean;
  children: React.ReactNode;
}) {
  return <GoogleClientIdContext.Provider value={{ clientId, loadError }}>{children}</GoogleClientIdContext.Provider>;
}

export const useGoogleClientId = (): string => useContext(GoogleClientIdContext).clientId;
export const useGoogleClientIdError = (): boolean => useContext(GoogleClientIdContext).loadError;
