// Aksesoris menggantung di bawah header (dipilih admin di Pengaturan Website → Tema).
// Aset SVG ada di /public/ornaments. Tambah set baru cukup dengan menambah entri di sini.

export const ORNAMENT_ASSETS = {
  ketupat: { src: '/ornaments/ketupat.svg', label: 'Ketupat' },
  lentera: { src: '/ornaments/lentera.svg', label: 'Lentera' },
  bulanBintang: { src: '/ornaments/bulan-bintang.svg', label: 'Bulan Bintang' },
  lampion: { src: '/ornaments/lampion.svg', label: 'Lampion' },
  bendera: { src: '/ornaments/bendera.svg', label: 'Bendera' },
  bolaNatal: { src: '/ornaments/bola-natal.svg', label: 'Bola Hiasan' },
  bintang: { src: '/ornaments/bintang.svg', label: 'Bintang' },
} as const;
export type OrnamentAsset = keyof typeof ORNAMENT_ASSETS;

export interface OrnamentItem {
  asset: OrnamentAsset;
  /** posisi horizontal (% lebar layar) */
  x: number;
  /** panjang tali (px) */
  len: number;
  /** lebar gambar (px) */
  size: number;
  /** sembunyikan di layar kecil agar tidak menutupi konten */
  desktopOnly?: boolean;
}

export interface OrnamentSet {
  id: string;
  name: string;
  theme: string;
  items: OrnamentItem[];
}

export const ORNAMENT_SETS: OrnamentSet[] = [
  {
    id: 'ramadhan-ketupat',
    name: 'Ketupat',
    theme: 'Ramadhan / Lebaran',
    items: [
      { asset: 'ketupat', x: 4, len: 18, size: 26 },
      { asset: 'ketupat', x: 14, len: 34, size: 22, desktopOnly: true },
      { asset: 'ketupat', x: 86, len: 30, size: 22, desktopOnly: true },
      { asset: 'ketupat', x: 95, len: 16, size: 26 },
    ],
  },
  {
    id: 'ramadhan-lentera',
    name: 'Lentera',
    theme: 'Ramadhan',
    items: [
      { asset: 'lentera', x: 5, len: 14, size: 24 },
      { asset: 'lentera', x: 15, len: 32, size: 20, desktopOnly: true },
      { asset: 'lentera', x: 85, len: 28, size: 20, desktopOnly: true },
      { asset: 'lentera', x: 94, len: 12, size: 24 },
    ],
  },
  {
    id: 'ramadhan-lengkap',
    name: 'Ketupat & Lentera',
    theme: 'Ramadhan / Lebaran',
    items: [
      { asset: 'lentera', x: 4, len: 12, size: 24 },
      { asset: 'ketupat', x: 11, len: 30, size: 22, desktopOnly: true },
      { asset: 'bulanBintang', x: 19, len: 18, size: 24, desktopOnly: true },
      { asset: 'bulanBintang', x: 81, len: 22, size: 24, desktopOnly: true },
      { asset: 'ketupat', x: 89, len: 34, size: 22, desktopOnly: true },
      { asset: 'lentera', x: 96, len: 14, size: 24 },
    ],
  },
  {
    id: 'imlek',
    name: 'Lampion',
    theme: 'Imlek',
    items: [
      { asset: 'lampion', x: 5, len: 12, size: 26 },
      { asset: 'lampion', x: 15, len: 30, size: 22, desktopOnly: true },
      { asset: 'lampion', x: 85, len: 26, size: 22, desktopOnly: true },
      { asset: 'lampion', x: 95, len: 14, size: 26 },
    ],
  },
  {
    id: 'kemerdekaan',
    name: 'Bendera Merah Putih',
    theme: '17 Agustus',
    items: [3, 9, 15, 21, 79, 85, 91, 97].map((x, i) => ({
      asset: 'bendera' as const,
      x,
      len: 6 + (i % 2) * 6,
      size: 18,
      desktopOnly: x > 6 && x < 94,
    })),
  },
  {
    id: 'natal',
    name: 'Bola Hiasan & Bintang',
    theme: 'Natal & Tahun Baru',
    items: [
      { asset: 'bolaNatal', x: 5, len: 14, size: 22 },
      { asset: 'bintang', x: 13, len: 30, size: 20, desktopOnly: true },
      { asset: 'bolaNatal', x: 20, len: 22, size: 18, desktopOnly: true },
      { asset: 'bolaNatal', x: 80, len: 26, size: 18, desktopOnly: true },
      { asset: 'bintang', x: 87, len: 32, size: 20, desktopOnly: true },
      { asset: 'bolaNatal', x: 95, len: 12, size: 22 },
    ],
  },
];

export function findOrnamentSet(id: string | undefined | null): OrnamentSet | null {
  return ORNAMENT_SETS.find((s) => s.id === id) || null;
}
