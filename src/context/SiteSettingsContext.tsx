import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { LOGO_URL as DEFAULT_LOGO } from '../constants';
import { MAIN_API, IS_CHILD_PANEL } from '../lib/apiBase';
import { loadTenant, tenantAssetUrl, type Tenant, type TenantSlide, type VoiceMode } from '../lib/tenant';

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
  /* ===== Tema (Pengaturan Website → Tema). '' = bawaan ===== */
  /** Gambar background hero dashboard: '' = /world.png, 'asset:hero:<versi>' = gambar dari DB. */
  heroImageUrl: string;
  /** Warna aksen teks brand "Booster" (hex). */
  brandAccent: string;
  /** Warna kartu header (hex) — tetap transparan + blur. */
  headerTint: string;
  /** Warna tombol aktif side menu (hex). */
  menuActive: string;
  /** Id set aksesoris menggantung di bawah header ('' = tidak ada). */
  headerOrnament: string;
  /** Teks kecil di bawah nama brand pada header (bawaan "SMM Panel"). */
  headerTagline: string;
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
  /** Upload gambar hero (data URL JPEG/PNG/WebP) ke database; null = kembali ke bawaan. */
  saveHeroImage: (dataUrl: string | null) => Promise<{ ok: boolean; message?: string }>;
  /** URL gambar hero yang siap dipakai di CSS ('' = bawaan). */
  heroImageSrc: string;
  /** Child panel aktif (null = web utama). */
  tenant: Tenant | null;
  /** Slider kustom child panel (null = slider bawaan). */
  slides: TenantSlide[] | null;
  /** Mode suara Guri Booster saat login. */
  voiceMode: VoiceMode;
  /** Video player dashboard (null = tidak tampil). */
  dashboardVideo: { src: string; poster: string } | null;
  /** Status sinkron ke database (khusus admin saat menyimpan). */
  sync: SyncState;
}

export interface SyncState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  message: string;
}

const STORAGE_KEY = 'boosteryuk-site-settings';
const DEFAULT_FAVICON = '/favicon.png';
/** Endpoint PHP (folder /api) yang menyimpan pengaturan ke tabel MySQL site_settings. */
const SETTINGS_API = `${MAIN_API}/site_settings.php`;
/** Field yang dibagikan ke semua pengunjung lewat database. */
const SHARED_KEYS = [
  'infoItems',
  'faviconUrl',
  'overviewTitle',
  'overviewSubtitle',
  'overviewMessage',
  'brandName',
  'brandSuffix',
  'footerText',
  'brandAccent',
  'headerTint',
  'menuActive',
  'headerOrnament',
] as const;
// heroImageUrl TIDAK di SHARED_KEYS untuk penyimpanan: diunggah lewat saveHeroImage()
// (gambar disimpan terpisah di DB & disajikan site_settings.php?asset=hero).

const HEX = /^#[0-9a-f]{6}$/i;
/** Video dashboard web utama (Supabase Storage) — child panel memakai videonya sendiri / tidak ada. */
const ROOT_VIDEO = {
  src: 'https://dzvsjcjvnpasrwuuopeg.supabase.co/storage/v1/object/public/publik/boosteryuk.mp4',
  poster: '/boosteryuk-thumb.png',
};
const THEME_KEYS = ['brandAccent', 'headerTint', 'menuActive', 'headerOrnament', 'heroImageUrl'] as const;

/** Campur warna hex dengan putih (0..1) untuk varian mode gelap. */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
type SharedKey = (typeof SHARED_KEYS)[number];

function pickShared(src: Partial<SiteSettings>): Partial<SiteSettings> {
  const out: Record<string, unknown> = {};
  for (const k of SHARED_KEYS) if (src[k] !== undefined) out[k] = src[k];
  // blob: hanya hidup di browser admin — jangan dikirim ke server
  if (Array.isArray(out.infoItems)) {
    out.infoItems = (out.infoItems as InfoItem[]).map((it) =>
      it.image && it.image.startsWith('blob:') ? { ...it, image: undefined } : it,
    );
  }
  return out as Partial<SiteSettings>;
}

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
  heroImageUrl: '',
  brandAccent: '',
  headerTint: '',
  menuActive: '',
  headerOrnament: '',
  headerTagline: '',
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
  saveHeroImage: async () => ({ ok: false }),
  heroImageSrc: '',
  tenant: null,
  slides: null,
  voiceMode: 'full',
  dashboardVideo: null,
  sync: { status: 'idle', message: '' },
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(load);
  // Child panel: konfigurasi panel menimpa tampilan (TIDAK disimpan ke pengaturan web utama).
  const [tenant, setTenant] = useState<Tenant | null>(null);
  useEffect(() => {
    if (!IS_CHILD_PANEL) return;
    let alive = true;
    loadTenant().then((t) => alive && setTenant(t));
    return () => {
      alive = false;
    };
  }, []);
  const effective = useMemo<SiteSettings>(() => {
    if (!tenant) return settings;
    const c = tenant.config || {};
    const logo = tenantAssetUrl(tenant, c.logo);
    return {
      ...settings,
      brandName: c.brandName || settings.brandName,
      brandSuffix: c.brandSuffix ?? settings.brandSuffix,
      footerText: c.footerText || settings.footerText,
      headerTagline: c.headerTagline || '',
      logoUrl: logo || settings.logoUrl,
      faviconUrl: logo || settings.faviconUrl,
      // warna/aksesoris panel: kosong = bawaan (tidak mewarisi tema musiman web utama)
      brandAccent: c.brandAccent || '',
      headerTint: c.headerTint || '',
      menuActive: c.menuActive || '',
      headerOrnament: c.headerOrnament || '',
      heroImageUrl: '',
    };
  }, [settings, tenant]);
  const [sync, setSync] = useState<SyncState>({ status: 'idle', message: '' });
  // Kunci yang diubah admin & belum dikirim ke server.
  const dirtyKeys = useRef<Set<SharedKey>>(new Set());

  const markDirty = (keys: string[]) => {
    for (const k of keys) if ((SHARED_KEYS as readonly string[]).includes(k)) dirtyKeys.current.add(k as SharedKey);
  };

  // 1) Ambil pengaturan terbaru dari database untuk SEMUA pengunjung (tanpa cache).
  useEffect(() => {
    let alive = true;
    fetch(`${SETTINGS_API}?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.ok || !j.settings || typeof j.settings !== 'object') return;
        const remote = pickShared(j.settings as Partial<SiteSettings>);
        const hero = (j.settings as Partial<SiteSettings>).heroImageUrl;
        if (typeof hero === 'string') (remote as Partial<SiteSettings>).heroImageUrl = hero;
        // buang field kosong agar default tetap dipakai
        for (const k of Object.keys(remote) as (SharedKey | 'heroImageUrl')[]) {
          const v = remote[k];
          // Kunci tema: '' berarti "kembali ke bawaan" -> tetap dipakai agar cache lama tertimpa.
          const themeKey = (THEME_KEYS as readonly string[]).includes(k);
          if ((v === '' && !themeKey) || v === null || (Array.isArray(v) && k !== 'infoItems' && v.length === 0)) delete remote[k];
        }
        if (Object.keys(remote).length) setSettings((s) => ({ ...s, ...remote }));
      })
      .catch(() => {
        /* offline / API belum di-upload: pakai cache lokal */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 2) Setiap perubahan admin pada field bersama -> simpan ke database.
  useEffect(() => {
    if (dirtyKeys.current.size === 0) return;
    const keys = Array.from(dirtyKeys.current);
    dirtyKeys.current.clear();
    const patch: Partial<SiteSettings> = {};
    for (const k of keys) (patch as Record<string, unknown>)[k] = settings[k];
    const token = (() => {
      try {
        return localStorage.getItem('token') || '';
      } catch {
        return '';
      }
    })();
    setSync({ status: 'saving', message: 'Menyimpan ke database…' });
    fetch(SETTINGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, settings: pickShared(patch) }),
    })
      .then((r) => r.json())
      .then((j) =>
        setSync(
          j?.ok
            ? { status: 'saved', message: 'Tersimpan ke database — tampil untuk semua pengunjung.' }
            : { status: 'error', message: j?.message || 'Gagal menyimpan ke database.' },
        ),
      )
      .catch(() => setSync({ status: 'error', message: 'Tidak bisa menghubungi server (site_settings.php).' }));
  }, [settings]);

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
    const href = effective.faviconUrl || DEFAULT_FAVICON;
    let link = document.getElementById('app-favicon') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = 'app-favicon';
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = href.startsWith('data:image/svg') || href.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    link.href = href;
  }, [effective.faviconUrl]);

  // Terapkan warna tema ke variabel CSS di <html> (lihat index.css: .by-accent, .by-menu-active, ...).
  useEffect(() => {
    const root = document.documentElement.style;
    const setVar = (name: string, val: string | null) => (val ? root.setProperty(name, val) : root.removeProperty(name));
    const acc = HEX.test(effective.brandAccent) ? effective.brandAccent : '';
    setVar('--by-accent', acc || null);
    setVar('--by-accent-dark', acc ? lighten(acc, 0.35) : null);
    setVar('--by-accent-hero', acc ? lighten(acc, 0.5) : null);
    setVar('--by-menu', HEX.test(effective.menuActive) ? effective.menuActive : null);
    setVar('--by-header', HEX.test(effective.headerTint) ? effective.headerTint : null);
  }, [effective.brandAccent, effective.menuActive, effective.headerTint]);

  const heroImageSrc = (() => {
    if (tenant) return tenantAssetUrl(tenant, tenant.config?.hero);
    const m = /^asset:hero:([\w-]+)$/.exec(settings.heroImageUrl || '');
    return m ? `${SETTINGS_API}?asset=hero&v=${m[1]}` : '';
  })();

  const saveHeroImage = async (dataUrl: string | null): Promise<{ ok: boolean; message?: string }> => {
    let token = '';
    try {
      token = localStorage.getItem('token') || '';
    } catch {
      /* abaikan */
    }
    setSync({ status: 'saving', message: 'Mengunggah gambar hero…' });
    try {
      const r = await fetch(SETTINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, settings: { heroImage: dataUrl ?? '' } }),
      });
      const j = await r.json();
      if (!j?.ok) {
        setSync({ status: 'error', message: j?.message || 'Gagal mengunggah gambar hero.' });
        return { ok: false, message: j?.message };
      }
      const url = typeof j.settings?.heroImageUrl === 'string' ? j.settings.heroImageUrl : '';
      setSettings((s) => ({ ...s, heroImageUrl: url }));
      setSync({ status: 'saved', message: 'Gambar hero tersimpan — tampil untuk semua pengunjung.' });
      return { ok: true };
    } catch {
      setSync({ status: 'error', message: 'Tidak bisa menghubungi server (site_settings.php).' });
      return { ok: false, message: 'Tidak bisa menghubungi server.' };
    }
  };

  const updateSettings = (patch: Partial<SiteSettings>) => {
    markDirty(Object.keys(patch));
    setSettings((s) => ({ ...s, ...patch }));
  };

  const setInfoItems = (items: InfoItem[]) => {
    markDirty(['infoItems']);
    setSettings((s) => ({ ...s, infoItems: items }));
  };

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
        markDirty(['faviconUrl']);
        setSettings((s) => ({ ...s, faviconUrl: url }));
      }
    };
    reader.readAsDataURL(file);
  };
  const resetFavicon = () => {
    markDirty(['faviconUrl']);
    setSettings((s) => ({ ...s, faviconUrl: DEFAULT_FAVICON }));
  };

  const resetMusic = () => setSettings((s) => ({ ...s, musicUrl: __MUSIC_URL__ }));
  const resetLogo = () => setSettings((s) => ({ ...s, logoUrl: DEFAULT_LOGO }));

  return (
    <SiteContext.Provider
      value={{
        settings: effective,
        updateSettings,
        setInfoItems,
        setMusicFile,
        setLogoFile,
        resetMusic,
        resetLogo,
        setFaviconFile,
        resetFavicon,
        saveHeroImage,
        heroImageSrc,
        tenant,
        slides: tenant?.config?.slides?.length
          ? tenant.config.slides.map((sl) => ({ ...sl, image: tenantAssetUrl(tenant, sl.image) })).filter((sl) => sl.image)
          : null,
        // Panel: bawaan hanya sapaan (info reseller Boosteryuk tidak cocok untuk panel reseller).
        voiceMode: tenant ? tenant.config?.voice || 'welcome' : 'full',
        // Child panel: bawaan TANPA video; tampil hanya bila admin mengunggah/mengisi video.
        dashboardVideo: IS_CHILD_PANEL
          ? tenant?.config?.videoUrl
            ? { src: tenant.config.videoUrl, poster: tenantAssetUrl(tenant, tenant.config.videoPoster) }
            : null
          : ROOT_VIDEO,
        sync,
      }}
    >
      {children}
    </SiteContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteContext);
}
