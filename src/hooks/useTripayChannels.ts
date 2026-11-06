import { useCallback, useEffect, useState } from 'react';
import { getPaymentChannels, type PaymentChannel, type TripayConfig } from '../services/tripay';
import { FALLBACK_CHANNELS } from '../data/fallbackChannels';

export interface ChannelsState {
  channels: PaymentChannel[];
  /** true bila daftar berasal dari data fallback, bukan worker live. */
  fallback: boolean;
  loading: boolean;
  error: string | null;
  config: TripayConfig;
  reload: () => void;
  setConfig: (next: TripayConfig) => void;
}

/**
 * =============================================================
 *  useTripayChannels — ambil daftar channel pembayaran Tripay
 * -------------------------------------------------------------
 *  Daftar channel diambil lewat worker proxy resmi:
 *    https://boosteryuk.boosteryukid.workers.dev/api/tripay/channels
 *  Jika worker gagal, FALLBACK_CHANNELS dipakai supaya halaman
 *  Deposit tetap dapat dirender.
 * =============================================================
 */
export function useTripayChannels(): ChannelsState {
  // Objek config dipertahankan untuk menjaga signature komponen
  // (TripaySettings mengharapkannya), tetapi daftar channel live
  // sudah tidak memerlukan API Key dari browser.
  const [, setConfigState] = useState<TripayConfig>(() => ({
    apiKey: '',
    privateKey: '',
    baseUrl: '',
    proxyUrl: '',
  }));
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [fallback, setFallback] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    getPaymentChannels()
      .then((list) => {
        if (!alive) return;
        if (list.length > 0) {
          setChannels(list);
          setFallback(false);
        } else {
          setChannels(FALLBACK_CHANNELS);
          setFallback(true);
          setError('Worker tidak mengembalikan channel aktif. Menampilkan daftar bawaan.');
        }
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setChannels(FALLBACK_CHANNELS);
        setFallback(true);
        setError(err instanceof Error ? err.message : 'Gagal memuat channel pembayaran.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [nonce]);

  const setConfig = useCallback((next: TripayConfig) => {
    setConfigState(next);
    setNonce((value) => value + 1);
  }, []);

  return { channels, fallback, loading, error, config: { apiKey: '', privateKey: '', baseUrl: '', proxyUrl: '' }, reload, setConfig };
}
