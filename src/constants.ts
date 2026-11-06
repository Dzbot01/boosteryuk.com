export const LOGO_URL =
  'https://www.image2url.com/r2/default/images/1787411570499-864e1f3c-dccc-4e22-a82f-8831b4ff1739.png';
  
/** Logo QRIS resmi (Wikimedia Commons). */
export const QRIS_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg';

/* ============================================================
   Konfigurasi metode deposit — dipakai di halaman Deposit
   (daftar metode) dan halaman detail metode (/deposit/:id).
   ============================================================ */
export interface DepositMethod {
  id: string;
  label: string;
  desc: string;
  image: string;
  /** Persentase bonus saldo, contoh 0.1 = 10%. */
  bonus: number;
  /** Minimal nominal deposit (Rupiah). */
  min: number;
  /** Maksimal nominal deposit (Rupiah). */
  max: number;
  closed?: boolean;
  /** Catatan proses pembayaran. */
  note: string;
  /** Kode channel Tripay yang dipakai untuk create transaction. */
  tripayMethod: string;
  /** Nama channel Tripay, sebagai cadangan bila API tidak mengirim payment_name. */
  tripayName: string;
}

export const DEPOSIT_METHODS: DepositMethod[] = [
  {
    id: 'qris',
    label: 'QRIS',
    desc: 'Bonus 10% · Minimal deposit Rp 1.000',
    image: QRIS_IMAGE,
    bonus: 0.1,
    min: 1000,
    max: 10_000_000,
    closed: false,
    note: 'Saldo masuk otomatis setelah pembayaran QRIS berhasil (± 1 menit).',
    tripayMethod: 'QRIS',
    tripayName: 'QRIS',
  },
  {
    id: 'manual',
    label: 'Bayar Manual',
    desc: 'Perlu konfirmasi admin',
    image: QRIS_IMAGE,
    bonus: 0.1,
    min: 10_000,
    max: 10_000_000,
    note: 'Transfer ke Virtual Account, lalu saldo masuk setelah status PAID atau dikonfirmasi admin.',
    tripayMethod: 'BRIVA',
    tripayName: 'BRI Virtual Account',
  },
];

/** Pilihan nominal cepat di halaman detail deposit. */
export const QUICK_AMOUNTS = [5000, 20000, 50000];

/* ============================================================
   BAYAR MANUAL via WHATSAPP ADMIN
   ============================================================ */
export const WHATSAPP_ADMIN = {
  /** Nomor admin dalam format internasional (62…) untuk link wa.me. */
  intl: '6288976577719',
  /** Nomor yang ditampilkan ke pengguna. */
  display: '088976577719',
  /** Nama website yang disebut di dalam pesan. */
  site: 'boosteryuk.com',
};

/** Email resmi untuk bantuan pelanggan. */
export const SUPPORT_EMAIL = 'boosteryukid@gmail.com';

/**
 * Susun pesan WhatsApp deposit manual.
 * Format:
 *   Halo min, aku dari website boosteryuk.com, Mau Deposit.
 *   <username>
 *   <email>
 *   <Nominal Deposit>
 *   <metode> (qris)
 */
export function buildDepositWaMessage(input: {
  username: string;
  email: string;
  amount: number;
  methodCode: string;
  methodName?: string;
}): string {
  const methodLabel = input.methodName || input.methodCode;
  return [
    `Halo min, aku dari website ${WHATSAPP_ADMIN.site}, Mau Deposit.`,
    input.username.trim(),
    input.email.trim(),
    formatRupiah(input.amount),
    `${methodLabel} (${input.methodCode.toLowerCase()})`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Buat link WhatsApp dengan teks yang sudah di-encode. */
export function waLink(message: string): string {
  return `https://wa.me/${WHATSAPP_ADMIN.intl}?text=${encodeURIComponent(message)}`;
}

/**
 * Bonus deposit per channel (0.1 = 10%).
 * Ubah di sini bila kebijakan bonus berubah.
 */
export function getDepositBonus(code: string): number {
  const normalized = code.toUpperCase();
  if (normalized === 'QRIS') return 0.1;
  if (normalized === 'MANUAL') return 0.1;
  return 0;
}

export function formatRupiah(value: number): string {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`;
}

/** Official brand marks via Simple Icons CDN (https://github.com/simple-icons/simple-icons) */
export const SOCIAL_BRANDS = [
  { name: 'YouTube', slug: 'youtube', color: 'FF0000' },
  { name: 'Instagram', slug: 'instagram', color: 'E4405F' },
  { name: 'TikTok', slug: 'tiktok', color: '000000' },
  { name: 'Threads', slug: 'threads', color: '000000' },
  { name: 'X', slug: 'x', color: '000000' },
  { name: 'Telegram', slug: 'telegram', color: '26A5E4' },
  { name: 'Facebook', slug: 'facebook', color: '0866FF' },
  { name: 'WhatsApp', slug: 'whatsapp', color: '25D366' },
] as const;

/** Additional official brand marks for the reverse marquee. */
export const SECONDARY_SOCIAL_BRANDS = [
  { name: 'Roblox', url: 'https://cdn.simpleicons.org/roblox/000000', darkUrl: 'https://cdn.simpleicons.org/roblox/ffffff', darkInvert: false },
  { name: 'LinkedIn', url: 'https://www.svgrepo.com/show/448234/linkedin.svg', darkUrl: 'https://www.svgrepo.com/show/448234/linkedin.svg', darkInvert: false },
  { name: 'Spotify', url: 'https://cdn.simpleicons.org/spotify/1DB954', darkUrl: 'https://cdn.simpleicons.org/spotify/1DB954', darkInvert: false },
  { name: 'SnackVideo', url: 'https://www.svgrepo.com/show/519325/snackvideo.svg', darkUrl: 'https://www.svgrepo.com/show/519325/snackvideo.svg', darkInvert: true },
] as const;

/* ---------- payment ---------- */

export const PAYMENT_INFO_TEXT =
  'Bayar sesuai dengan jumlah dan nominal yang seharusnya dibayarkan harap konfirmasi ke admin via WhatsApp atau Email pada halaman hubungi admin.';

export const ADMIN_WHATSAPP = '088976577719';
export const ADMIN_WHATSAPP_INTL = '6288976577719';
export const ADMIN_EMAIL = 'boosteryukid@gmail.com';

export const WALLETS = [
  {
    id: 'dana',
    label: 'DANA',
    slug: 'dana',
    number: '088976577719',
    holder: 'DIMASXXXX',
    color: '1189D6',
  },
  {
    id: 'gopay',
    label: 'GoPay',
    slug: 'gopay',
    number: '088976577719',
    holder: 'DEDDYXXXX',
    color: '00AED6',
  },
] as const;

export function socialIconUrl(slug: string, color?: string) {
  return color
    ? `https://cdn.simpleicons.org/${slug}/${color}`
    : `https://cdn.simpleicons.org/${slug}`;
}

/* ------------------------------------------------------------------ */
/*  Layanan (services)                                                 */
/* ------------------------------------------------------------------ */

/** Landscape hero slides for the services page. */
export const SERVICE_SLIDES = [
  {
    url: 'https://cdn.phototourl.com/member/2026-08-30-a53810bf-485c-4844-8b4b-1f44b32f18ac.jpg',
    title: 'Naikkan engagement tanpa ribet',
    subtitle: 'Pilih layanan booster sesuai platform favorit Anda.',
  },
  {
    url: 'https://cdn.phototourl.com/member/2026-08-30-72d466f8-280d-4702-bd09-58011c60dbf8.jpg',
    title: 'Harga transparan, proses cepat',
    subtitle: 'Semua tarif tampil apa adanya sebelum Anda memesan.',
  },
  {
    url: 'https://cdn.phototourl.com/member/2026-08-30-f7f48efd-a51a-4aa4-84a8-b62a10e6ce82.jpg',
    title: 'Ratusan layanan siap pakai',
    subtitle: 'Followers, likes, views, sampai jam tayang.',
  },
] as const;

export interface ServiceCategory {
  /** URL slug used by /layanan/:platform */
  slug: string;
  /** Display name shown on the card */
  name: string;
  /** Official brand mark */
  logo: string;
  /** Force the logo white (for non-simple-icons sources) */
  invert?: boolean;
  /** Card gradient (brand colours) */
  gradient: string;
  /** Keywords matched against the API `category` / `name` fields */
  keywords: string[];
}

/**
 * Platforms shown as floating landscape cards.
 * Logos are the official brand marks (Simple Icons / SVG Repo).
 */
export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    slug: 'tiktok',
    name: 'TikTok',
    logo: 'https://cdn.simpleicons.org/tiktok/ffffff',
    gradient: 'linear-gradient(135deg,#010101 0%,#1b2b30 45%,#25F4EE 100%)',
    keywords: ['tiktok', 'tik tok'],
  },
  {
    slug: 'instagram',
    name: 'Instagram',
    logo: 'https://cdn.simpleicons.org/instagram/ffffff',
    gradient: 'linear-gradient(135deg,#833AB4 0%,#FD1D1D 55%,#FCB045 100%)',
    keywords: ['instagram'],
  },
  {
    slug: 'youtube',
    name: 'YouTube',
    logo: 'https://cdn.simpleicons.org/youtube/ffffff',
    gradient: 'linear-gradient(135deg,#8B0000 0%,#FF0000 60%,#FF5A5A 100%)',
    keywords: ['youtube', 'yt'],
  },
  {
    slug: 'threads',
    name: 'Threads',
    logo: 'https://cdn.simpleicons.org/threads/ffffff',
    gradient: 'linear-gradient(135deg,#000000 0%,#2b2b2b 60%,#555555 100%)',
    keywords: ['threads'],
  },
  {
    slug: 'telegram',
    name: 'Telegram',
    logo: 'https://cdn.simpleicons.org/telegram/ffffff',
    gradient: 'linear-gradient(135deg,#1c6fa5 0%,#2AABEE 55%,#7fd2f7 100%)',
    keywords: ['telegram'],
  },
  {
    slug: 'whatsapp',
    name: 'WhatsApp',
    logo: 'https://cdn.simpleicons.org/whatsapp/ffffff',
    gradient: 'linear-gradient(135deg,#075E54 0%,#128C7E 50%,#25D366 100%)',
    keywords: ['whatsapp', 'wa'],
  },
  {
    slug: 'snackvideo',
    name: 'SnackVideo',
    logo: 'https://www.svgrepo.com/show/519325/snackvideo.svg',
    invert: true,
    gradient: 'linear-gradient(135deg,#7a4b00 0%,#FF8A00 55%,#F5C518 100%)',
    keywords: ['snack', 'snackvideo', 'snack video'],
  },
  {
    slug: 'shopee',
    name: 'Shopee',
    logo: 'https://cdn.simpleicons.org/shopee/ffffff',
    gradient: 'linear-gradient(135deg,#a3300f 0%,#EE4D2D 55%,#FF8A66 100%)',
    keywords: ['shopee'],
  },
  {
    slug: 'tokopedia',
    name: 'Tokopedia',
    logo: 'https://cdn.simpleicons.org/tokopedia/ffffff',
    gradient: 'linear-gradient(135deg,#1f6b26 0%,#42B549 55%,#8fdb94 100%)',
    keywords: ['tokopedia'],
  },
  {
    slug: 'linkedin',
    name: 'LinkedIn',
    logo: 'https://www.svgrepo.com/show/448234/linkedin.svg',
    invert: true,
    gradient: 'linear-gradient(135deg,#00335c 0%,#0A66C2 60%,#5fa8e8 100%)',
    keywords: ['linkedin'],
  },
  {
    slug: 'roblox',
    name: 'Roblox',
    logo: 'https://cdn.simpleicons.org/roblox/ffffff',
    gradient: 'linear-gradient(135deg,#000000 0%,#393B3D 55%,#E2231A 100%)',
    keywords: ['roblox'],
  },
];

export function findCategory(slug?: string): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((c) => c.slug === slug);
}

/* ------------------------------------------------------------------ */
/*  Brand icons for category dropdown results                          */
/*                                                                      */
/*  Colored official marks used as a small round badge in front of each */
/*  dropdown result, matched by keyword found in the category name.     */
/* ------------------------------------------------------------------ */

export interface BrandIcon {
  slug: string;
  /** Brand colour used for the round badge background */
  color: string;
  /** Icon fill colour, defaults to white */
  iconColor?: string;
  /** Keywords that match this brand inside a category name */
  keywords: string[];
  /** Fallback mark rendered when the CDN icon is unavailable */
  initial?: string;
}

export const CATEGORY_BRAND_ICONS: BrandIcon[] = [
  { slug: 'tiktok', color: '010101', keywords: ['tiktok', 'tik tok', 'vt.tiktok'] },
  { slug: 'instagram', color: 'E4405F', keywords: ['instagram', 'ig', 'insta'] },
  { slug: 'facebook', color: '0866FF', keywords: ['facebook', 'fb'] },
  { slug: 'youtube', color: 'FF0000', keywords: ['youtube', 'yt'] },
  { slug: 'whatsapp', color: '25D366', keywords: ['whatsapp', 'wa ', 'channel'] },
  { slug: 'telegram', color: '26A5E4', keywords: ['telegram'] },
  { slug: 'twitter', color: '000000', keywords: ['twitter', 'x.com', 'tweet'] },
  { slug: 'threads', color: '000000', keywords: ['threads'] },
  { slug: 'spotify', color: '1DB954', keywords: ['spotify'] },
  { slug: 'shopee', color: 'EE4D2D', keywords: ['shopee'] },
  { slug: 'tokopedia', color: '42B549', keywords: ['tokopedia'] },
  { slug: 'linkedin', color: '0A66C2', keywords: ['linkedin'] },
  { slug: 'roblox', color: 'E2231A', keywords: ['roblox'] },
  { slug: 'youtubemusic', color: 'FF0000', keywords: ['youtube music'] },
  { slug: 'snapchat', color: 'FFFC00', keywords: ['snapchat'] },
  { slug: 'twitch', color: '9146FF', keywords: ['twitch'] },
  { slug: 'snackvideo', color: 'FF8A00', keywords: ['snack', 'snackvideo'] },
  { slug: 'pinterest', color: 'BD081C', keywords: ['pinterest'] },
  { slug: 'discord', color: '5865F2', keywords: ['discord'] },
  { slug: 'google', color: '4285F4', keywords: ['google', 'gmaps', 'maps', 'review'] },
  { slug: 'trakt', color: 'ED1C24', keywords: ['trakt'] },
  { slug: 'line', color: '00C300', keywords: ['line'] },
  { slug: 'signal', color: '3A76F0', keywords: ['signal'], initial: 'SG' },
];

/**
 * Finds the brand mark matching a given category name.
 * Returns `null` when no brand keyword is present in the text.
 */
export function brandForCategory(categoryName: string): BrandIcon | null {
  const name = (categoryName || '').toLowerCase();
  if (!name) return null;
  for (const brand of CATEGORY_BRAND_ICONS) {
    for (const keyword of brand.keywords) {
      if (name.includes(keyword)) return brand;
    }
  }
  return null;
}

/** CDN URL for a brand mark using the brand colour (white glyph on transparent). */
export function brandIconUrl(brand: BrandIcon, glyphColor = 'ffffff') {
  return `https://cdn.simpleicons.org/${brand.slug}/${glyphColor}`;
}
