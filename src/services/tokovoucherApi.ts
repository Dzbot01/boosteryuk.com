/**
 * Klien API transaksi TokoVoucher (top up game) — php-api/tokovoucher.php.
 *
 * SEMUA rahasia (secret key & perhitungan signature MD5) ada di server; browser hanya
 * mengirim token login + data pesanan, lalu menerima hasil dari penyedia.
 */
import { MAIN_API } from '../lib/apiBase';

const API = `${MAIN_API}/tokovoucher.php`;

const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

type Res<T> = T & { ok: boolean; message?: string };

async function get<T>(qs: string): Promise<Res<T>> {
  try {
    const r = await fetch(`${API}?${qs}`, { cache: 'no-store' });
    return ((await r.json().catch(() => null)) || { ok: false, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}

async function post<T>(action: string, body: Record<string, unknown> = {}): Promise<Res<T>> {
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token(), action, ...body }),
    });
    return ((await r.json().catch(() => null)) || { ok: false, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}

export interface TvStatus {
  /** true bila user_code & secret sudah diisi di server (php-api/tokovoucher_config.php). */
  configured: boolean;
  /** user_code tersamarkan, mis. U261***568YV — untuk tampilan info saja. */
  user_code: string;
}

export interface TvTransaksi {
  ref_id: string;
  status?: string;
  message?: string;
  /** Balasan mentah penyedia (sudah dibuang field sensitif) untuk detail/troubleshooting. */
  provider?: Record<string, unknown>;
}

/** Info konfigurasi integrasi (aman: tanpa secret). */
export const tvStatus = () => get<TvStatus>('action=status');

/**
 * Ajukan transaksi top up ke penyedia lewat proxy server.
 * `server_id` boleh kosong bila produk tidak memilikinya.
 */
export const tvTransaksi = (body: { player_id: string; server_id?: string; kode_produk: string }) =>
  post<TvTransaksi>('transaksi', body);

export interface TvPricelistItem {
  kode: string;
  nama: string;
  harga: number;
  butuh_server?: boolean;
}

export interface TvPricelist {
  /** Asal data: provider (pricelist live), override (file server), snapshot (bundel), kosong. */
  source: 'provider' | 'override' | 'snapshot' | 'kosong';
  updated_at?: string;
  game?: string;
  items: TvPricelistItem[];
}

/**
 * Katalog produk ASLI untuk satu game dari proxy server (pricelist penyedia /
 * file override server). Dipakai halaman detail supaya tidak ada kode karangan.
 */
export const tvPricelist = (game?: string) =>
  get<TvPricelist>('action=pricelist' + (game ? `&game=${encodeURIComponent(game)}` : ''));

export interface TvKatalogGroup {
  /** Nama tampil game (kategori Topup, server ID Indonesia). */
  game: string;
  slug: string;
  jumlah: number;
  termurah: number;
  labels: string[];
  /** Logo resmi game dari penyedia (bila ada). */
  logo?: string;
}

export interface TvKatalog {
  ok: boolean;
  source: 'provider' | 'kosong';
  groups: TvKatalogGroup[];
  updated_at?: string;
}

/**
 * Daftar game top up LIVE dari penyedia (kategori Topup + ID Indonesia saja):
 * dipakai grid kartu /topup supaya tidak hardcode dan game baru penyedia ikut muncul.
 */
export const tvKatalog = () => get<TvKatalog>('action=katalog');

export interface TvCekAkun {
  ok: boolean;
  valid: boolean;
  /** Nama akun di game bila ditemukan (mis. "¥Vino_TZY™"). */
  username: string;
}

/**
 * Cek akun target lewat apigames.id (Free Fire & Mobile Legends).
 * Gagal / tidak ditemukan / kredensial belum diisi => ok:false — UI melewatinya senyap.
 */
export const tvCekAkun = (game: string, userId: string) =>
  get<TvCekAkun>('action=cek_akun&game=' + encodeURIComponent(game) + '&user_id=' + encodeURIComponent(userId));

export interface TvCekStatus {
  ref_id: string;
  /** Balasan mentah penyedia (sudah dibersihkan) berisi status transaksi. */
  provider?: Record<string, unknown>;
}

/** Cek status transaksi per ref_id lewat GET /v1/transaksi/status di penyedia. */
export const tvCekStatus = (ref_id: string) =>
  get<TvCekStatus>('action=cek_status&ref_id=' + encodeURIComponent(ref_id));
