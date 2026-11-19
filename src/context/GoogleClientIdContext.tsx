// Client ID Google OAuth diambil SEKALI dari PHP saat aplikasi start (lihat main.tsx),
// lalu dibagikan lewat context ini. String kosong = belum dikonfigurasi / gagal dimuat
// (tombol Google tidak dirender; AuthModal menampilkan pesan fallback).
import { createContext, useContext } from 'react';

const GoogleClientIdContext = createContext<string>('');

export function GoogleClientIdProvider({
  clientId,
  children,
}: {
  clientId: string;
  children: React.ReactNode;
}) {
  return <GoogleClientIdContext.Provider value={clientId}>{children}</GoogleClientIdContext.Provider>;
}

export const useGoogleClientId = (): string => useContext(GoogleClientIdContext);
