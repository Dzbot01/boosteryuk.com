// Penilaian & ulasan layanan — php-api/reviews.php.
// Nama layanan disimpan server saat penilaian dibuat, sehingga Papan Penilaian
// tidak perlu memuat API provider berulang kali (sama seperti layanan Google Maps
// Review di dashboard).
import { MAIN_API } from '../lib/apiBase';

const API = `${MAIN_API}/reviews.php`;
const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};
type Res<T> = T & { ok: boolean; message?: string };

async function call<T>(body: Record<string, unknown>): Promise<Res<T>> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), ...body }) });
    return ((await r.json().catch(() => null)) || { ok: false, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}

export interface PendingReviewOrder { order_id: string; service_name: string }
export interface ReviewItem {
  username: string;
  stars: number;
  service_name: string;
  /** ID layanan untuk tombol pesan ulang (null bila tidak tercatat). */
  service_key: string | null;
  review: string;
  created_at: number;
}

export const reviewsApi = {
  /** Pesanan SELESAI milik user yang belum dinilai (sumber banner notifikasi). */
  pending: () => call<{ orders?: PendingReviewOrder[] }>({ action: 'pending' }),
  submit: (orderId: string, stars: number, review: string) => call<object>({ action: 'submit', order_id: orderId, stars, review }),
  /** 100 penilaian terbaru untuk Papan Penilaian (publik). */
  list: () => call<{ reviews?: ReviewItem[] }>({ action: 'list' }),
};
