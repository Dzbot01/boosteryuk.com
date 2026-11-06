import { useEffect, useState } from 'react';

export interface IpInfo {
  /** Alamat IP publik yang terdeteksi. */
  ip: string;
  /** Negara asal IP (bila tersedia). */
  country?: string;
  /** Penyedia layanan (bila tersedia). */
  isp?: string;
}

/**
 * =============================================================
 *  useVisitorIp — deteksi IP publik untuk kebutuhan whitelist
 * -------------------------------------------------------------
 *  Endpoint yang dicoba berurutan sampai ada yang berhasil.
 *  Dipakai di halaman Deposit agar pengguna tahu IP mana yang
 *  harus didaftarkan (whitelist) di dashboard Tripay / server.
 * ============================================================= */
const ENDPOINTS = [
  {
    url: 'https://api.ipify.org?format=json',
    parse: (data: unknown) => ({ ip: (data as { ip?: string }).ip ?? '' }),
  },
  {
    url: 'https://api64.ipify.org?format=json',
    parse: (data: unknown) => ({ ip: (data as { ip?: string }).ip ?? '' }),
  },
  {
    url: 'https://ipapi.co/json/',
    parse: (data: unknown) => ({
      ip: (data as { ip?: string }).ip ?? '',
      country: (data as { country_name?: string }).country_name,
      isp: (data as { org?: string }).org,
    }),
  },
  {
    url: 'https://api.myip.com',
    parse: (data: unknown) => ({
      ip: (data as { ip?: string }).ip ?? '',
      country: (data as { cc?: string }).cc,
    }),
  },
];

export function useVisitorIp() {
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const lookup = () => {
    setLoading(true);
    setFailed(false);

    (async () => {
      for (const endpoint of ENDPOINTS) {
        try {
          const response = await fetch(endpoint.url, { cache: 'no-store' });
          if (!response.ok) continue;
          const data = await response.json();
          const parsed = endpoint.parse(data);
          if (parsed.ip) {
            setInfo(parsed);
            setLoading(false);
            return;
          }
        } catch {
          /* coba endpoint berikutnya */
        }
      }
      setFailed(true);
      setLoading(false);
    })();
  };

  useEffect(() => {
    lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { info, loading, failed, refresh: lookup };
}
