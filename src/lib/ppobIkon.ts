import { Gamepad2, Globe, LayoutGrid, Receipt, Send, Smartphone, Wallet, Wifi } from 'lucide-react';
import type { PpobMenuIcon } from '../data/ppob';

/**
 * Peta ikon layanan PPOB: data layanan menyimpan NAMA ikon (bukan komponen)
 * supaya file data bebas JSX. Dipakai card "Menu Service" di beranda PPOB dan
 * grid card halaman "Semua Layanan" (/ppob/layanan).
 */
export const IKON_LAYANAN: Record<PpobMenuIcon, typeof Smartphone> = {
  smartphone: Smartphone,
  send: Send,
  wifi: Wifi,
  wallet: Wallet,
  gamepad: Gamepad2,
  receipt: Receipt,
  globe: Globe,
  grid: LayoutGrid,
};
