/**
 * Data dummy marketplace "TopUp All Game".
 *
 * Semua daftar di file ini sengaja berbentuk array JSON sederhana supaya mudah diganti
 * dengan data asli (mis. dari pricelist penyedia) tanpa menyentuh komponen UI.
 * `kode` produk mengikuti format kode_produk API transaksi penyedia (lihat
 * php-api/tokovoucher.php) — nilai di bawah contoh, ganti dengan kode asli penyedia.
 */

export interface TopupProduct {
  /** kode_produk tujuan di API penyedia. */
  kode: string;
  nama: string;
  harga: number;
  /** true bila produk ini wajib mengisi Server ID. */
  butuhServer?: boolean;
}

export interface GameCard {
  slug: string;
  nama: string;
  tagline: string;
  /** Warna dasar thumbnail (hue HSL) — gradasi navy tetap dipertahankan di overlay. */
  hue: number;
  produk: TopupProduct[];
}

export interface OtherItem {
  slug: string;
  nama: string;
  sub: string;
  hue: number;
}

/** Tab kategori (urutan tampil sama dengan desain). */
export const TOPUP_CATEGORIES = [
  'Topup',
  'Voucher',
  'Pulsa',
  'Join Reseller',
  'Token Listrik',
  'Paket Data',
  'Voucher Data',
  'Telpon & SMS',
  'Inject Voucher',
] as const;
export type TopupCategoryId = (typeof TOPUP_CATEGORIES)[number];

/** 16 kartu game (dummy) — baris 1 & 2 sesuai desain. */
export const TOPUP_GAMES: GameCard[] = [
  { slug: 'free-fire', nama: 'Free Fire', tagline: 'Diamond & membership', hue: 268, produk: [
    { kode: 'FF86', nama: '86 Diamond', harga: 12500 },
    { kode: 'FF172', nama: '172 Diamond', harga: 24500 },
    { kode: 'FFWM', nama: 'Weekly Membership', harga: 29000 },
    { kode: 'FFMM', nama: 'Monthly Membership', harga: 87000, butuhServer: false },
  ] },
  { slug: 'mobile-legends', nama: 'Mobile Legends', tagline: 'Diamond MLBB murah', hue: 210, produk: [
    { kode: 'ML86', nama: '86 Diamond', harga: 20500, butuhServer: true },
    { kode: 'ML172', nama: '172 Diamond', harga: 40500, butuhServer: true },
    { kode: 'MLWS', nama: 'Weekly Diamond Pass', harga: 28500, butuhServer: true },
  ] },
  { slug: 'hago', nama: 'Hago', tagline: 'Hago diamond & coins', hue: 48, produk: [
    { kode: 'HG66', nama: '66 Diamond', harga: 9500 },
    { kode: 'HG330', nama: '330 Diamond', harga: 46000 },
  ] },
  { slug: 'pubg-mobile', nama: 'PUBG Mobile', tagline: 'UC resmi & cepat', hue: 24, produk: [
    { kode: 'PUBG60', nama: '60 UC', harga: 14500 },
    { kode: 'PUBG325', nama: '325 UC', harga: 72000 },
    { kode: 'PUBGRC', nama: 'Royale Pass Classic', harga: 145000 },
  ] },
  { slug: 'honor-of-kings', nama: 'Honor of Kings', tagline: 'Token & skin', hue: 330, produk: [
    { kode: 'HOK80', nama: '80 Token', harga: 15500 },
    { kode: 'HOK400', nama: '400 Token', harga: 74000 },
  ] },
  { slug: 'genshin-impact', nama: 'Genshin Impact', tagline: 'Genesis Crystal', hue: 190, produk: [
    { kode: 'GI60', nama: '60 Genesis Crystal', harga: 16000, butuhServer: true },
    { kode: 'GI300', nama: '300 Genesis Crystal', harga: 74500, butuhServer: true },
    { kode: 'GIBP', nama: 'Blessing of the Welkin Moon', harga: 74500, butuhServer: true },
  ] },
  { slug: 'garena-undawn', nama: 'Garena Undawn', tagline: 'Undawn coin', hue: 150, produk: [
    { kode: 'UD80', nama: '80 Coin', harga: 15000 },
    { kode: 'UD400', nama: '400 Coin', harga: 71000 },
  ] },
  { slug: 'point-blank', nama: 'Point Blank', tagline: 'PB Cash', hue: 8, produk: [
    { kode: 'PB8900', nama: '8.900 Cash', harga: 9500 },
    { kode: 'PB44500', nama: '44.500 Cash', harga: 46000 },
  ] },
  { slug: 'call-of-duty-mobile', nama: 'Call of Duty Mobile', tagline: 'CP resmi', hue: 20, produk: [
    { kode: 'COD80', nama: '80 CP', harga: 15500 },
    { kode: 'COD400', nama: '400 CP', harga: 72500 },
  ] },
  { slug: 'blood-strike', nama: 'Blood Strike', tagline: 'Gold & voucher', hue: 350, produk: [
    { kode: 'BS100', nama: '100 Gold', harga: 14500 },
    { kode: 'BS500', nama: '500 Gold', harga: 69000 },
  ] },
  { slug: 'honkai-star-rail', nama: 'Honkai Star Rail', tagline: 'Oneiric Shard', hue: 250, produk: [
    { kode: 'HSR60', nama: '60 Oneiric Shard', harga: 16000, butuhServer: true },
    { kode: 'HSR300', nama: '300 Oneiric Shard', harga: 74500, butuhServer: true },
  ] },
  { slug: 'metal-slug-awakening', nama: 'Metal Slug : Awakening', tagline: 'Diamond & pass', hue: 36, produk: [
    { kode: 'MS80', nama: '80 Diamond', harga: 15000 },
    { kode: 'MS400', nama: '400 Diamond', harga: 70000 },
  ] },
  { slug: 'magic-chess-go-go', nama: 'Magic Chess GO GO', tagline: 'Diamond MCGG', hue: 285, produk: [
    { kode: 'MC86', nama: '86 Diamond', harga: 19500, butuhServer: true },
    { kode: 'MC172', nama: '172 Diamond', harga: 38500, butuhServer: true },
  ] },
  { slug: 'farlight-84', nama: 'Farlight 84', tagline: 'Diamond FL84', hue: 44, produk: [
    { kode: 'FL80', nama: '80 Diamond', harga: 14500 },
    { kode: 'FL400', nama: '400 Diamond', harga: 68000 },
  ] },
  { slug: 'moonlight-blade-m', nama: 'Moonlight Blade M', tagline: 'Voucher & gold', hue: 200, produk: [
    { kode: 'MB80', nama: '80 Voucher', harga: 15500 },
    { kode: 'MB400', nama: '400 Voucher', harga: 72000 },
  ] },
  { slug: 'zenless-zone-zero', nama: 'Zenless Zone Zero', tagline: 'Monochrome & pass', hue: 160, produk: [
    { kode: 'ZZZ60', nama: '60 Monochrome', harga: 16000, butuhServer: true },
    { kode: 'ZZZ300', nama: '300 Monochrome', harga: 74500, butuhServer: true },
  ] },
];

/** Isi grid untuk kategori selain Topup (dummy, boleh diganti data asli). */
export const TOPUP_OTHER: Record<Exclude<TopupCategoryId, 'Topup'>, OtherItem[]> = {
  Voucher: [
    { slug: 'voucher-gameplay', nama: 'Voucher Gameplay', sub: 'Voucher game semua publisher', hue: 210 },
    { slug: 'voucher-mlbb', nama: 'Voucher Mobile Legends', sub: 'Diamond pass & skin', hue: 230 },
    { slug: 'voucher-ff', nama: 'Voucher Free Fire', sub: 'Diamond & membership', hue: 268 },
    { slug: 'voucher-pubg', nama: 'Voucher PUBG Mobile', sub: 'UC & royale pass', hue: 24 },
  ],
  Pulsa: [
    { slug: 'pulsa-telkomsel', nama: 'Telkomsel', sub: 'Pulsa 5rb - 1jt', hue: 0 },
    { slug: 'pulsa-xl', nama: 'XL Axiata', sub: 'Pulsa & hot rod', hue: 200 },
    { slug: 'pulsa-indosat', nama: 'Indosat', sub: 'Pulsa & freedom', hue: 48 },
    { slug: 'pulsa-tri', nama: 'Tri (3)', sub: 'Pulsa murah', hue: 320 },
  ],
  'Join Reseller': [
    { slug: 'reseller-topup', nama: 'Paket Reseller TopUp', sub: 'Margin hingga 12%', hue: 150 },
    { slug: 'reseller-voucher', nama: 'Paket Reseller Voucher', sub: 'Akses pricelist grosir', hue: 190 },
    { slug: 'reseller-pulsa', nama: 'Paket Reseller Pulsa', sub: 'Deposit mulai 50rb', hue: 24 },
  ],
  'Token Listrik': [
    { slug: 'pln-20k', nama: 'Token PLN 20.000', sub: 'STAN otomatis', hue: 48 },
    { slug: 'pln-50k', nama: 'Token PLN 50.000', sub: 'STAN otomatis', hue: 48 },
    { slug: 'pln-100k', nama: 'Token PLN 100.000', sub: 'STAN otomatis', hue: 48 },
    { slug: 'pln-200k', nama: 'Token PLN 200.000', sub: 'STAN otomatis', hue: 48 },
  ],
  'Paket Data': [
    { slug: 'data-telkomsel', nama: 'Paket Data Telkomsel', sub: '1GB - 100GB', hue: 0 },
    { slug: 'data-indosat', nama: 'Paket Data Indosat', sub: 'Freedom & happy', hue: 48 },
    { slug: 'data-xl', nama: 'Paket Data XL', sub: 'Xtra combo', hue: 200 },
    { slug: 'data-smartfren', nama: 'Paket Data Smartfren', sub: 'Nonstop kuota', hue: 280 },
  ],
  'Voucher Data': [
    { slug: 'vdata-telkomsel', nama: 'Voucher Data Telkomsel', sub: 'Kode fisik & digital', hue: 0 },
    { slug: 'vdata-tri', nama: 'Voucher Data Tri', sub: 'Kuota besar', hue: 320 },
    { slug: 'vdata-axis', nama: 'Voucher Data Axis', sub: 'Bronet & owsem', hue: 260 },
  ],
  'Telpon & SMS': [
    { slug: 'paket-telpon-tsel', nama: 'Paket Telpon Telkomsel', sub: 'Menit semua operator', hue: 0 },
    { slug: 'paket-sms-tsel', nama: 'Paket SMS Telkomsel', sub: 'Ratusan SMS', hue: 0 },
    { slug: 'paket-telpon-indosat', nama: 'Paket Telpon Indosat', sub: 'Menit murah', hue: 48 },
  ],
  'Inject Voucher': [
    { slug: 'inject-mlbb', nama: 'Inject Voucher MLBB', sub: 'Tanpa login akun', hue: 230 },
    { slug: 'inject-ff', nama: 'Inject Voucher Free Fire', sub: 'Proses 1-5 menit', hue: 268 },
    { slug: 'inject-pubg', nama: 'Inject Voucher PUBG', sub: 'UC via voucher', hue: 24 },
  ],
};

/** Slug aman untuk URL: huruf kecil, spasi/tanda -> strip. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Filter realtime berdasarkan nama (case-insensitive, spasi diabaikan). */
export function filterByName<T extends { nama: string }>(list: T[], q: string): T[] {
  const key = q.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!key) return list;
  return list.filter((it) => it.nama.toLowerCase().includes(key));
}

/** Format rupiah tanpa desimal. */
export const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
