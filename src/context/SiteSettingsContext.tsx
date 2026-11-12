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
  // Kartu informasi di halaman Overview (teks diatur admin di Pengaturan Website)
  overviewTitle: string;
  overviewSubtitle: string;
  overviewMessage: string;
  /** Favicon tab browser (URL atau data URL). Default: /favicon.png */
  faviconUrl: string;
}

interface SiteCtx {
  settings: SiteSettings;
  updateSettings: (patch: Partial<SiteSettings>) => void;
  setInfoItems: (items: InfoItem[]) => void;
  setMusicFile: (file: File | null) => void;
  setLogoFile: (file: File | null) => void;
  resetMusic: () => void;
  resetLogo: () => void;
  setFaviconFile: (file: File | null) => void;
  resetFavicon: () => void;
}

const STORAGE_KEY = 'boosteryuk-site-settings';
const DEFAULT_FAVICON = '/favicon.png';

const DEFAULT_INFO: InfoItem[] = [
  {
    id: 0,
    tag: 'Pengumuman',
    title: 'Deposit QRIS Sudah Normal',
    desc: 'Deposit metode QRIS sudah normal, bisa dari mana saja untuk melakukan pembayaran (termasuk DANA, GoPay, OVO, dll).\n\nButuh bantuan? Hubungi admin Boosteryuk lewat menu Contact Support.',
    time: '26 September 2026 01:27',
  },
  {
    id: 1,
    tag: 'Pengumuman',
    title: 'Informasi Penting: Instagram Followers Saat Ini',
    desc: 'Saat ini gunakanlah layanan Instagram Followers Indonesia, jangan Instagram Followers Luar, karena ada update dari pihak platform Instagram itu sendiri yang berefek ke Instagram Followers Luar.\n\nJadi sebelum kami informasikan ada yang lancar Instagram Followers Luar (Bule), harap gunakan Instagram Followers Indonesia terlebih dahulu karena masih sangat lancar.\n\nPercayalah, hal ini terjadi bukan hanya di Boosteryuk saja. Terima kasih atas pengertiannya 🙏',
    time: '03 September 2026 01:34',
  },
  {
    id: 2,
    tag: 'Pengumuman',
    title: 'Info Penting !!',
    desc: 'Ada update dari pihak platform Instagram di luar kendali kami, sehingga beberapa hari ini layanan Instagram Followers sangat lambat. Kami akan segera menginformasikan layanan terbaru yang lancar dan menonaktifkan layanan yang tidak berjalan.\n\nSebelum layanan baru dikeluarkan, gunakan layanan Instagram Followers Indonesia terlebih dahulu.',
    time: '02 September 2026 19:12',
  },
  {
    id: 3,
    tag: 'Pengumuman',
    title: 'Informasi',
    desc: 'Beberapa layanan TikTok Likes kami nonaktifkan karena efek update dari pihak platform TikTok secara global, sehingga ada perlambatan di TikTok Likes.\n\nKami melarang keras user yang menggunakan layanan Boosteryuk untuk aktivitas merugikan seperti judol dll. Jika ketahuan, kami berhak suspensi akun Boosteryuk Anda tanpa refund dan tidak ada pengembalian sisa saldo.',
    time: '08 Juni 2026 22:52',
  },
  {
    id: 4,
    tag: 'Info',
    title: 'Informasi',
    desc: 'Pantau terus halaman Overview ini agar tidak ketinggalan informasi terbaru seputar layanan Boosteryuk.',
    time: '14 Mei 2026 08:54',
  },
];

const DEFAULTS: SiteSettings = {
  logoUrl: DEFAULT_LOGO,
  brandName: 'Booster',
  brandSuffix: 'yuk',
  footerText: '© 2025 Boosteryuk · Cek status booster media sosial',
  musicUrl: __MUSIC_URL__,
  infoItems: DEFAULT_INFO,
  overviewTitle: 'Selamat datang di Boosteryuk',
  overviewSubtitle: 'Panel SMM, VPS, dan Agen AI dalam satu tempat',
  overviewMessage:
    'Pantau semua pesanan boostermu, kelola VPS, dan jalankan Agen AI WhatsApp dari satu dashboard. Butuh bantuan? Hubungi admin lewat menu Contact Support kapan saja — kami standby 24/7.',
  faviconUrl: DEFAULT_FAVICON,
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
  setFaviconFile: () => {},
  resetFavicon: () => {},
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(load);

  useEffect(() => {
    try {
      // Don't persist blob: URLs — they die on reload.
      const toSave = {
        ...settings,
        logoUrl: settings.logoUrl.startsWith('blob:') ? DEFAULT_LOGO : settings.logoUrl,
        musicUrl: settings.musicUrl.startsWith('blob:') ? __MUSIC_URL__ : settings.musicUrl,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }, [settings]);

  // Terapkan favicon ke <link rel="icon"> secara langsung.
  useEffect(() => {
    const href = settings.faviconUrl || DEFAULT_FAVICON;
    let link = document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = 'app-favicon';
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = href.startsWith('data:image/svg') || href.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    link.href = href;
  }, [settings.faviconUrl]);

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

  // Favicon disimpan sebagai data URL agar tetap ada setelah reload (maks ~300 KB).
  const setFaviconFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 300 * 1024) {
      alert('Ukuran favicon maksimal 300 KB. Gunakan PNG persegi transparan (mis. 192x192).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const url = reader.result;
        setSettings((s) => ({ ...s, faviconUrl: url }));
      }
    };
    reader.readAsDataURL(file);
  };
  const resetFavicon = () => setSettings((s) => ({ ...s, faviconUrl: DEFAULT_FAVICON }));

  const resetMusic = () => setSettings((s) => ({ ...s, musicUrl: __MUSIC_URL__ }));
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
        setFaviconFile,
        resetFavicon,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteContext);
}
