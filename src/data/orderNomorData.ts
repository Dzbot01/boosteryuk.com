/**
 * =============================================================
 *  DATA ORDER NOMOR — virtual number / OTP
 * -------------------------------------------------------------
 *  Berisi kategori layanan, daftar layanan demo, provider,
 *  negara, dan server. Harga dalam Rupiah (number).
 * =============================================================
 */

/* ------------------------- KATEGORI ------------------------- */
export const NOMOR_CATEGORIES = [
  'Semua Kategori',
  'Social & Chat',
  'Belanja',
  'Gaming',
  'Ai & Produktivitas',
  'Transportasi & Travel',
  'Hiburan',
  'Keuangan',
] as const;

export type NomorCategory = (typeof NOMOR_CATEGORIES)[number];

/* ------------------------- LAYANAN ------------------------- */
export interface NomorService {
  id: string;
  name: string;
  category: Exclude<NomorCategory, 'Semua Kategori'>;
  /** slug simple-icons untuk ikon brand */
  icon: string;
  color: string;
}

export const NOMOR_SERVICES: NomorService[] = [
  { id: 'whatsapp', name: 'Whatsapp', category: 'Social & Chat', icon: 'whatsapp', color: '#25D366' },
  { id: 'telegram', name: 'Telegram', category: 'Social & Chat', icon: 'telegram', color: '#229ED9' },
  { id: 'instagram', name: 'Instagram', category: 'Social & Chat', icon: 'instagram', color: '#E1306C' },
  { id: 'tiktok', name: 'Tiktok', category: 'Social & Chat', icon: 'tiktok', color: '#111111' },
  { id: 'facebook', name: 'Facebook', category: 'Social & Chat', icon: 'facebook', color: '#1877F2' },
  { id: 'shopee', name: 'Shopee', category: 'Belanja', icon: 'shopee', color: '#EE4D2D' },
  { id: 'tokopedia', name: 'Tokopedia', category: 'Belanja', icon: 'tokopedia', color: '#03AC0E' },
  { id: 'mlbb', name: 'Mobile Legends', category: 'Gaming', icon: 'mlb', color: '#7C3AED' },
  { id: 'freefire', name: 'Free Fire', category: 'Gaming', icon: 'garena', color: '#F97316' },
  { id: 'chatgpt', name: 'ChatGPT', category: 'Ai & Produktivitas', icon: 'openai', color: '#10A37F' },
  { id: 'gojek', name: 'Gojek', category: 'Transportasi & Travel', icon: 'gojek', color: '#00AED6' },
  { id: 'grab', name: 'Grab', category: 'Transportasi & Travel', icon: 'grab', color: '#00B14F' },
  { id: 'netflix', name: 'Netflix', category: 'Hiburan', icon: 'netflix', color: '#E50914' },
  { id: 'spotify', name: 'Spotify', category: 'Hiburan', icon: 'spotify', color: '#1DB954' },
  { id: 'dana', name: 'DANA', category: 'Keuangan', icon: 'dana', color: '#108EE9' },
  { id: 'ovo', name: 'OVO', category: 'Keuangan', icon: 'ovo', color: '#4C1D95' },
];

/** Total layanan yang ditampilkan pada kartu judul (angka demo). */
export const NOMOR_TOTAL_LAYANAN = 1284;

/* ------------------------- PROVIDER ------------------------- */
export interface NomorProvider {
  id: string;
  name: string;
  /** harga mulai (Rp) */
  from: number;
  tag: string;
}

export const NOMOR_PROVIDERS: NomorProvider[] = [
  { id: 'p1', name: 'Provider 1', from: 200, tag: 'banyak pilihan server' },
  { id: 'p2', name: 'Provider 2', from: 1700, tag: 'stok besar' },
  { id: 'p3', name: 'Provider 3', from: 700, tag: 'tanpa pilih server' },
  { id: 'p4', name: 'Provider 4', from: 200, tag: 'pilihan server dan negara' },
];

/* ------------------------- NEGARA ------------------------- */
export interface NomorCountry {
  id: string;
  name: string;
  /** kode flagcdn (2 huruf) */
  flag: string;
  stock: number;
  isDefault?: boolean;
}

export const NOMOR_COUNTRIES: NomorCountry[] = [
  { id: 'id', name: 'Indonesia', flag: 'id', stock: 2345112, isDefault: true },
  { id: 'af', name: 'Afghanistan', flag: 'af', stock: 1552865 },
  { id: 'al', name: 'Albania', flag: 'al', stock: 40471 },
  { id: 'dz', name: 'Algeria', flag: 'dz', stock: 1273149 },
  { id: 'ao', name: 'Angola', flag: 'ao', stock: 7870264 },
  { id: 'ag', name: 'Antigua and Barbuda', flag: 'ag', stock: 48421 },
  { id: 'my', name: 'Malaysia', flag: 'my', stock: 892341 },
  { id: 'sg', name: 'Singapore', flag: 'sg', stock: 231455 },
  { id: 'us', name: 'United States', flag: 'us', stock: 3120455 },
  { id: 'gb', name: 'United Kingdom', flag: 'gb', stock: 987210 },
];

/* ------------------------- SERVER ------------------------- */
export interface NomorServer {
  id: string;
  name: string;
  stock: number;
  price: number;
}

export const NOMOR_SERVERS: NomorServer[] = [
  { id: 'nksp-58', name: 'NKSP-58', stock: 8771, price: 1700 },
  { id: 'nksp-65', name: 'NKSP-65', stock: 292, price: 2900 },
  { id: 'nksp-34', name: 'NKSP-34', stock: 538667, price: 3100 },
  { id: 'nksp-53', name: 'NKSP-53', stock: 1412, price: 3900 },
  { id: 'nksp-4', name: 'NKSP-4', stock: 25000, price: 4100 },
];

/* ------------------------- HELPERS ------------------------- */
export function formatRp(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

export function formatStock(value: number): string {
  return `${value.toLocaleString('id-ID')} tersedia`;
}

export function flagUrl(code: string): string {
  return `https://flagcdn.com/w160/${code}.png`;
}

export function brandIconUrl(slug: string, color: string): string {
  return `https://cdn.simpleicons.org/${slug}/${color.replace('#', '')}`;
}
