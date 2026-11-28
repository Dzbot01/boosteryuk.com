/**
 * Katalog Topup Game.
 *
 * ATURAN DATA (jangan pakai dummy lagi):
 *  - `produk` hanya boleh berisi kode produk ASLI dari pricelist penyedia
 *    (https://tokovoucher.me/pricelist). Snapshot Free Fire di bawah diverifikasi
 *    langsung dari halaman itu pada 27 Nov 2026 (kolom harga "Basic").
 *  - Game yang produknya belum diisi di sini TIDAK memakai kode karangan: halaman
 *    detail akan menarik katalog live lewat proxy server (`action=pricelist` di
 *    php-api/tokovoucher.php, yang membaca pricelist penyedia + file override
 *    php-api/tokovoucher_pricelist.php). Bila keduanya kosong, halaman menampilkan
 *    state "katalog belum tersedia" — pesanan tidak bisa dikirim dengan kode salah.
 *  - Harga snapshot = harga penyedia saat diambil. Bila ingin menambah margin,
 *    setel TOPUP_MARKUP_PCT (persen) — semua tampilan harga lewat hargaJual().
 */

export type TopupProduk = {
  /** Kode produk asli penyedia (dipakai sebagai kode_produk saat transaksi). */
  kode: string;
  nama: string;
  /** Harga modal dari penyedia (Rupiah). */
  harga: number;
  /** true bila produk membutuhkan Server ID selain Player ID. */
  butuhServer?: boolean;
};

export type GameCard = {
  slug: string;
  nama: string;
  tagline: string;
  /** Warna dasar thumbnail (hue HSL) — mengikuti spesifikasi UI. */
  hue: number;
  produk: TopupProduk[];
};

/** Margin penjualan top up dalam persen (0 = jual sama dengan harga penyedia). */
export const TOPUP_MARKUP_PCT = 2;

/**
 * Harga jual ke user: modal + markup persen, TANPA pembulatan ratusan —
 * modal + markup = harga untuk user (pembulatan hanya saat format Rupiah).
 * `pct` opsional: child panel yang membeli akses markup memakai persennya sendiri.
 */
export const hargaJual = (hargaModal: number, pct: number = TOPUP_MARKUP_PCT) =>
  hargaModal * (1 + pct / 100);

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

/**
 * Snapshot pricelist Free Fire (kode + nama + harga Basic) dari
 * https://tokovoucher.me/pricelist — diambil 27 Nov 2026. Denominasi populer saja;
 * tambah/kurangi baris di sini bila perlu (kode HARUS sesuai pricelist).
 */
const FREE_FIRE: TopupProduk[] = [
  { kode: 'MFF5', nama: 'Free Fire 5 Diamonds', harga: 756 },
  { kode: 'MFF10', nama: 'Free Fire 10 Diamonds', harga: 1508 },
  { kode: 'MFF15', nama: 'Free Fire 15 Diamonds', harga: 2263 },
  { kode: 'MFF20', nama: 'Free Fire 20 Diamonds', harga: 3017 },
  { kode: 'MFF25', nama: 'Free Fire 25 Diamonds', harga: 3771 },
  { kode: 'MFF30', nama: 'Free Fire 30 Diamonds', harga: 4525 },
  { kode: 'MFF50', nama: 'Free Fire 50 Diamonds', harga: 6034 },
  { kode: 'MFF70', nama: 'Free Fire 70 Diamonds', harga: 8189 },
  { kode: 'MFF100', nama: 'Free Fire 100 Diamonds', harga: 12066 },
  { kode: 'MFFLUP', nama: 'Free Fire Level Up Pass', harga: 14303 },
  { kode: 'MFF140', nama: 'Free Fire 140 Diamonds', harga: 16523 },
  { kode: 'MFF200', nama: 'Free Fire 200 Diamonds', harga: 24133 },
  { kode: 'MFFM', nama: 'Free Fire Mingguan Membership', harga: 25138 },
  { kode: 'MFF300', nama: 'Free Fire 300 Diamonds', harga: 36199 },
  { kode: 'MFFBP', nama: 'Free Fire BP Card', harga: 37708 },
  { kode: 'MFF400', nama: 'Free Fire 400 Diamonds', harga: 47121 },
  { kode: 'MFF500', nama: 'Free Fire 500 Diamonds', harga: 58330 },
  { kode: 'MFF700', nama: 'Free Fire 700 Diamonds', harga: 82463 },
  { kode: 'MFFB', nama: 'Free Fire Bulanan Membership', harga: 75416 },
  { kode: 'MFF1000', nama: 'Free Fire 1000 Diamonds', harga: 116141 },
  { kode: 'MFF1440', nama: 'Free Fire 1440 Diamonds', harga: 165914 },
  { kode: 'MFF2020', nama: 'Free Fire 2020 Diamonds', harga: 235297 },
];

export const TOPUP_GAMES: GameCard[] = [
  { slug: 'free-fire', nama: 'Free Fire', tagline: 'Diamond & membership', hue: 268, produk: FREE_FIRE },
  // Game di bawah menunggu katalog asli: isi lewat file override server
  // php-api/tokovoucher_pricelist.php (format ada di contoh file-nya) atau tambahkan
  // baris snapshot di sini setelah kode dicek di pricelist penyedia.
  { slug: 'mobile-legends', nama: 'Mobile Legends', tagline: 'Diamond MLBB', hue: 210, produk: [] },
  { slug: 'hago', nama: 'Hago', tagline: 'Hago diamond & coins', hue: 48, produk: [] },
  { slug: 'pubg-mobile', nama: 'PUBG Mobile', tagline: 'UC resmi & cepat', hue: 24, produk: [] },
  { slug: 'honor-of-kings', nama: 'Honor of Kings', tagline: 'Token & skin', hue: 330, produk: [] },
  { slug: 'genshin-impact', nama: 'Genshin Impact', tagline: 'Genesis Crystal', hue: 190, produk: [] },
  { slug: 'garena-undawn', nama: 'Garena Undawn', tagline: 'Undawn coin', hue: 150, produk: [] },
  { slug: 'point-blank', nama: 'Point Blank', tagline: 'PB Cash', hue: 8, produk: [] },
  { slug: 'call-of-duty-mobile', nama: 'Call of Duty Mobile', tagline: 'CP resmi', hue: 20, produk: [] },
  { slug: 'blood-strike', nama: 'Blood Strike', tagline: 'Gold & voucher', hue: 350, produk: [] },
  { slug: 'honkai-star-rail', nama: 'Honkai Star Rail', tagline: 'Oneiric Shard', hue: 250, produk: [] },
  { slug: 'metal-slug-awakening', nama: 'Metal Slug : Awakening', tagline: 'Diamond & pass', hue: 36, produk: [] },
  { slug: 'magic-chess-go-go', nama: 'Magic Chess GO GO', tagline: 'Diamond MCGG', hue: 285, produk: [] },
  { slug: 'farlight-84', nama: 'Farlight 84', tagline: 'Diamond FL84', hue: 44, produk: [] },
  { slug: 'moonlight-blade-m', nama: 'Moonlight Blade M', tagline: 'Voucher & gold', hue: 200, produk: [] },
  { slug: 'zenless-zone-zero', nama: 'Zenless Zone Zero', tagline: 'Monochrome & pass', hue: 160, produk: [] },
  // Kanal "Voucher Game" penyedia (label operator: "Voucher Roblox") — kode produknya
  // ditarik live dari server, jadi `produk` tetap kosong (tidak ada kode karangan).
  { slug: 'roblox', nama: 'Roblox', tagline: 'Robux & voucher resmi', hue: 8, produk: [] },
];

/** Kartu kategori selain Topup (grid kecil di tab lain). */
export const TOPUP_OTHER: Record<string, { slug: string; nama: string; sub: string; hue: number }[]> = {
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

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const filterByName = <T extends { nama: string }>(items: T[], q: string) => {
  const term = q.toLowerCase().replace(/\s+/g, ' ').trim();
  return term ? items.filter((it) => it.nama.toLowerCase().includes(term)) : items;
};

export const rupiah = (n?: number | null) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
