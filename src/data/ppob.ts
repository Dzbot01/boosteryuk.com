/**
 * ppob.ts — data & helper layanan PPOB (pulsa, paket data, tagihan).
 *
 * SEMUA nilai di sini adalah variabel/mock JSON supaya mudah disambungkan ke API
 * penyedia nanti: ganti isi array/objeknya, UI tidak perlu diubah.
 *  - PPOB_OPERATORS + detectOperator()  → deteksi operator dari 4 digit pertama nomor
 *  - PPOB_PULSA_REGULER                 → daftar produk per operator (nama, harga, status)
 *  - PPOB_MENU                          → grid "Menu Service" beranda PPOB
 *  - PPOB_BANNERS / PPOB_BERITA / PPOB_PENGUMUMAN / PPOB_POINT_FALLBACK
 */

export type OperatorId = 'telkomsel' | 'indosat' | 'xl' | 'tri' | 'smartfren';

export interface PpobOperator {
  id: OperatorId;
  nama: string;
  /** Singkatan untuk lencana di samping input nomor (logo = teks berwarna merek). */
  singkat: string;
  /** Warna merek operator. */
  warna: string;
  /** 4 digit pertama (prefix) nomor milik operator ini. */
  prefixes: string[];
}

export const PPOB_OPERATORS: PpobOperator[] = [
  { id: 'telkomsel', nama: 'Telkomsel', singkat: 'TSEL', warna: '#E31E25', prefixes: ['0811', '0812', '0813', '0821', '0822', '0823', '0851', '0852', '0853'] },
  { id: 'indosat', nama: 'Indosat', singkat: 'ISAT', warna: '#E8A33D', prefixes: ['0814', '0815', '0816', '0855', '0856', '0857', '0858'] },
  { id: 'xl', nama: 'XL', singkat: 'XL', warna: '#1FA9E0', prefixes: ['0817', '0818', '0819', '0859', '0877', '0878'] },
  { id: 'tri', nama: 'Tri', singkat: 'TRI', warna: '#C3168F', prefixes: ['0895', '0896', '0897', '0898', '0899'] },
  { id: 'smartfren', nama: 'Smartfren', singkat: 'SFRN', warna: '#3F51B5', prefixes: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'] },
];

/**
 * Deteksi operator otomatis dari nomor tujuan: buang karakter non-angka,
 * samakan +62/62 menjadi 0, lalu cocokkan 4 digit pertama dengan prefix operator.
 */
export function detectOperator(nomor: string): PpobOperator | null {
  const digits = (nomor || '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  const local = digits.startsWith('62') ? '0' + digits.slice(2) : digits;
  if (!local.startsWith('0')) return null;
  const prefix = local.slice(0, 4);
  return PPOB_OPERATORS.find((o) => o.prefixes.includes(prefix)) || null;
}

export interface PpobProduk {
  id: string;
  operator: OperatorId;
  /** Nama tampil, contoh "Telkomsel 1.000". */
  nama: string;
  /** Nominal pulsa (Rupiah). */
  nominal: number;
  /** Harga jual (Rupiah). */
  harga: number;
  /** false = stok habis → kartu "unavailable" dan tidak bisa diklik. */
  tersedia: boolean;
}

/** Susun daftar produk dari pasangan [nominal, harga, tersedia?]. */
function pulsa(op: PpobOperator, daftar: [number, number, boolean?][]): PpobProduk[] {
  return daftar.map(([nominal, harga, tersedia = true]) => ({
    id: `${op.id}-${nominal}`,
    operator: op.id,
    nama: `${op.nama} ${nominal.toLocaleString('id-ID')}`,
    nominal,
    harga,
    tersedia,
  }));
}

const TELKOMSEL = PPOB_OPERATORS[0];
const INDOSAT = PPOB_OPERATORS[1];
const XL = PPOB_OPERATORS[2];
const TRI = PPOB_OPERATORS[3];
const SMARTFREN = PPOB_OPERATORS[4];

/** Produk Pulsa Reguler per operator (mock — ganti dengan respons API penyedia). */
export const PPOB_PULSA_REGULER: Record<OperatorId, PpobProduk[]> = {
  telkomsel: pulsa(TELKOMSEL, [
    [1000, 2025], [2000, 3230], [3000, 4155, false], [4000, 5010], [5000, 5515],
    [10000, 10465], [15000, 15450], [20000, 20400], [25000, 25450], [50000, 50550],
    [100000, 100450], [150000, 150600, false], [200000, 200500], [300000, 300700], [500000, 500900],
  ]),
  indosat: pulsa(INDOSAT, [
    [1000, 2050], [2000, 3250], [3000, 4180], [5000, 5540], [10000, 10490],
    [15000, 15470, false], [20000, 20430], [25000, 25470], [50000, 50580], [100000, 100480],
    [150000, 150650], [200000, 200550], [300000, 300750],
  ]),
  xl: pulsa(XL, [
    [1000, 2100], [2000, 3300], [3000, 4200], [5000, 5600], [10000, 10550],
    [15000, 15500], [25000, 25500, false], [50000, 50650], [100000, 100550], [200000, 200650],
    [300000, 300800], [500000, 501000],
  ]),
  tri: pulsa(TRI, [
    [1000, 2075], [2000, 3275], [3000, 4175], [5000, 5575], [10000, 10525],
    [20000, 20475], [25000, 25525, false], [50000, 50625], [100000, 100525], [200000, 200600],
  ]),
  smartfren: pulsa(SMARTFREN, [
    [1000, 2000], [2000, 3200], [5000, 5450], [10000, 10400], [20000, 20350],
    [25000, 25400], [50000, 50500, false], [100000, 100400], [150000, 150500], [200000, 200450],
  ]),
};

export type PpobMenuIcon = 'smartphone' | 'send' | 'wifi' | 'wallet' | 'gamepad' | 'receipt' | 'globe' | 'grid';

export interface PpobMenu {
  id: string;
  /** Label singkat (maks 1 baris — dipotong "…" oleh CSS bila panjang). */
  label: string;
  icon: PpobMenuIcon;
  /** Rute tujuan; kosong = layanan belum dibuka (tampilkan `catatan`). */
  to?: string;
  /** Keterangan layanan (dipakai untuk catatan "segera hadir" & teks bantuan). */
  desc: string;
  catatan?: string;
}

/**
 * Card "Menu Service" halaman PPOB diisi layanan ASLI dari katalog penyedia
 * (endpoint list produk penuh, difilter: hanya layanan SELAIN top up game).
 * Yang di sini hanyalah layanan milik aplikasi sendiri (halaman lokal) +
 * tile "Lainnya" yang membuka grid semua layanan non-game.
 */
export const PPOB_MENU_LOKAL: PpobMenu[] = [
  { id: 'pulsa-reguler', label: 'Pulsa Reguler', icon: 'smartphone', to: '/ppob/pulsa-reguler', desc: 'Isi pulsa semua operator, masuk 24 jam nonstop.' },
];

/** Tile terakhir grid Menu Service: semua layanan selain top up game (grid card). */
export const PPOB_MENU_LAINNYA: PpobMenu = {
  id: 'lainnya',
  label: 'Lainnya',
  icon: 'grid',
  to: '/ppob/layanan',
  desc: 'Semua layanan selain top up game: pulsa, paket data, e-money, voucher, token listrik & tagihan.',
};

/** Rute halaman grid semua layanan PPOB (dipakai tile "Lainnya" & tile layanan live). */
export const RUTE_LAYANAN_PPOB = '/ppob/layanan';

/**
 * Ikon untuk layanan live dari penyedia: dipilih dari kata kunci nama
 * layanan/kategori supaya card Menu Service tetap punya ikon walau penyedia
 * tidak mengirim logo.
 */
export function ikonLayanan(teks: string): PpobMenuIcon {
  const t = (teks || '').toLowerCase();
  if (/(pulsa|prepaid|prabayar|credit|kredit|telepon|\bmsisdn\b)/.test(t)) return 'smartphone';
  if (/(transfer|kirim|send)/.test(t)) return 'send';
  if (/(data|internet|wifi|paket|broadband|fiber)/.test(t)) return 'wifi';
  if (/(e-?money|e-?wallet|dompet|ovo|dana|gopay|shopee\s*pay|link\s*aja|t-?money|saldo)/.test(t)) return 'wallet';
  if (/(tagihan|pascabayar|postpaid|bpjs|listrik|pln|token|pdam|\bair\b|internet\s*rumah|tv|asuransi|pajak|tilang|telkom)/.test(t)) return 'receipt';
  if (/(voucher|streaming|netflix|spotify|youtube|unipin|google\s*play|game)/.test(t)) return 'gamepad';
  if (/(luar\s*negeri|internasional|global|roaming|\bais\b|truemove|dtac|celcom|digi|maxis|globe|smart|vodafone|airtel|zain|ooredoo|stc|jio|banglalink|robi|grameenphone|teletalk|ncell|dialog|mobitel)/.test(t)) return 'globe';
  return 'grid';
}

export interface PpobBanner {
  id: string;
  judul: string;
  /** {APP} diganti nama brand website/child panel saat render. */
  sub: string;
  gradien: string;
}

/** Banner promo carousel (placeholder berwarna — ganti `gambar` bila punya aset). */
export const PPOB_BANNERS: PpobBanner[] = [
  { id: 'tagihan', judul: 'BAYAR TAGIHANMU', sub: 'HANYA DI {APP}', gradien: 'linear-gradient(120deg,#1D4ED8 0%,#3B82F6 100%)' },
  { id: 'pulsa', judul: 'PULSA & PAKET DATA', sub: 'PROSES INSTAN 24 JAM DI {APP}', gradien: 'linear-gradient(120deg,#EA580C 0%,#F5B73B 100%)' },
  { id: 'game', judul: 'TOP UP GAME RESMI', sub: 'MURAH & OTOMATIS DI {APP}', gradien: 'linear-gradient(120deg,#0EA5E9 0%,#6366F1 100%)' },
];

export interface PpobBerita {
  id: string;
  kategori: string;
  /** Warna badge kategori (mis. tosca untuk INFO). */
  warna: string;
  judul: string;
  tanggal: string;
  to: string;
}

/** Section NEWS UPDATES (mock — sambungkan ke /artikel atau API berita). */
export const PPOB_BERITA: PpobBerita[] = [
  { id: 'n1', kategori: 'INFO', warna: '#14B8A6', judul: 'Pemeliharaan jaringan Telkomsel pukul 02.00–04.00 WIB', tanggal: '26 Nov 2026', to: '/artikel' },
  { id: 'n2', kategori: 'PROMO', warna: '#F59E0B', judul: 'Cashback saldo 5% untuk paket data XL setiap Jumat', tanggal: '21 Nov 2026', to: '/artikel' },
  { id: 'n3', kategori: 'TAGIHAN', warna: '#3B82F6', judul: 'Bayar tagihan pascabayar sebelum tanggal 20 tiap bulan', tanggal: '18 Nov 2026', to: '/artikel' },
];

/** Teks berjalan (marquee) di bawah card saldo. */
export const PPOB_PENGUMUMAN = 'Selamat datang, terima kasih sudah bergabung';

/** Poin ditampilkan bila API belum mengirim jumlah poin user. */
export const PPOB_POINT_FALLBACK = 120;

/** "Rp 20.000" — pemisah ribuan titik (untuk saldo & nominal). */
export const rupiahTitik = (n: number) => `Rp ${Math.max(0, Math.round(n || 0)).toLocaleString('id-ID')}`;

/** "Rp 2.025,-" — format harga jual pulsa pada card produk. */
export const hargaPulsa = (n: number) => `Rp ${Math.max(0, Math.round(n || 0)).toLocaleString('id-ID')},-`;

/** Sapaan dinamis mengikuti jam: Good Morning / Afternoon / Evening / Night. */
export function sapaanPpob(jam: number): string {
  if (jam < 11) return 'Good Morning';
  if (jam < 15) return 'Good Afternoon';
  if (jam < 19) return 'Good Evening';
  return 'Good Night';
}

/** Jam real-time halaman Pulsa Reguler, contoh "16:57:19 AM". */
export function formatJamPpob(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
