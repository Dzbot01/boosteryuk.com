import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { LOGO_URL as DEFAULT_LOGO } from '../constants';

export interface InfoItem {
  id: number;
  tag: string;
  title: string;
  desc: string;
  time: string;
  /** Optional image — when present the item renders as an image card. */
  image?: string;
}

export interface SiteSettings {
  logoUrl: string;
  brandName: string;
  brandSuffix: string;
  footerText: string;
  musicUrl: string;
  infoItems: InfoItem[];
}

interface SiteCtx {
  settings: SiteSettings;
  updateSettings: (patch: Partial<SiteSettings>) => void;
  setInfoItems: (items: InfoItem[]) => void;
  setMusicFile: (file: File | null) => void;
  setLogoFile: (file: File | null) => void;
  resetMusic: () => void;
  resetLogo: () => void;
}

const STORAGE_KEY = 'boosteryuk-site-settings';

const DEFAULT_INFO: InfoItem[] = [
  {
    id: 0,
    tag: 'Fitur',
    title: 'Halaman Layanan resmi dirilis',
    desc: 'Kini Anda bisa melihat katalog booster per platform — TikTok, Instagram, YouTube, Shopee, dan lainnya — lengkap dengan harga, min/max, serta filter kategori.',
    time: 'Baru saja',
  },
  {
    id: 1,
    tag: 'Update',
    title: 'Update website v1.2',
    desc: 'Tampilan Payment, Struk Digital, dan halaman Hubungi Admin telah diperbarui agar lebih cepat di perangkat mobile.',
    time: 'Hari ini · 09:20',
  },
  {
    id: 2,
    tag: 'Garansi',
    title: 'Garansi Refill 30 Hari',
    desc: 'Layanan berlabel Refill dilindungi garansi isi ulang selama 30 hari penuh tanpa biaya tambahan. Ajukan refill jika jumlah berkurang.',
    time: 'Garansi',
    image:
      'https://cdn.phototourl.com/member/2026-08-30-a53810bf-485c-4844-8b4b-1f44b32f18ac.jpg',
  },
  {
    id: 3,
    tag: 'Layanan',
    title: 'Layanan TikTok Views kembali normal',
    desc: 'Antrian views TikTok sudah stabil. Pesanan baru diproses sesuai kecepatan paket yang dipilih.',
    time: '2 hari lalu',
  },
  {
    id: 4,
    tag: 'Maintenance',
    title: 'Pemeliharaan server terjadwal',
    desc: 'Sistem akan maintenance singkat pada pukul 02.00–03.00 WIB. Cek status pesanan tetap bisa dilakukan setelahnya.',
    time: '3 hari lalu',
  },
];

const DEFAULTS: SiteSettings = {
  logoUrl: DEFAULT_LOGO,
  brandName: 'Booster',
  brandSuffix: 'yuk',
  footerText: '© 2025 Boosteryuk · Cek status booster media sosial',
  musicUrl: '/musik.mp3',
  infoItems: DEFAULT_INFO,
};

function load(): SiteSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

const SiteContext = createContext<SiteCtx>({
  settings: DEFAULTS,
  updateSettings: () => {},
  setInfoItems: () => {},
  setMusicFile: () => {},
  setLogoFile: () => {},
  resetMusic: () => {},
  resetLogo: () => {},
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(load);

  useEffect(() => {
    try {
      // Don't persist blob: URLs — they die on reload.
      const toSave = {
        ...settings,
        logoUrl: settings.logoUrl.startsWith('blob:') ? DEFAULT_LOGO : settings.logoUrl,
        musicUrl: settings.musicUrl.startsWith('blob:') ? '/tes.mp3' : settings.musicUrl,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }, [settings]);

  const updateSettings = (patch: Partial<SiteSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  const setInfoItems = (items: InfoItem[]) =>
    setSettings((s) => ({ ...s, infoItems: items }));

  const setMusicFile = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSettings((s) => ({ ...s, musicUrl: url }));
  };

  const setLogoFile = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSettings((s) => ({ ...s, logoUrl: url }));
  };

  const resetMusic = () => setSettings((s) => ({ ...s, musicUrl: '/tes.mp3' }));
  const resetLogo = () => setSettings((s) => ({ ...s, logoUrl: DEFAULT_LOGO }));

  return (
    <SiteContext.Provider
      value={{
        settings,
        updateSettings,
        setInfoItems,
        setMusicFile,
        setLogoFile,
        resetMusic,
        resetLogo,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteContext);
}
