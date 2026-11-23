/**
 * refillApi.ts
 *
 * Refill calls are proxied through the same `fayupedia` Supabase Edge
 * Function.  The Edge Function receives { action, id } and maps `action` to
 * the correct Fayupedia endpoint using FAYUPEDIA_BASE_URL from its secrets.
 *
 * Browser  →  Supabase Edge Function (`fayupedia`)  →  Fayupedia API
 */

import { invokeProxy } from '../supabase';
import { MAIN_API } from '../lib/apiBase';

export type RefillStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'failed'
  | string;

export interface RefillResult {
  ok: boolean;
  message: string;
  refillId: string | null;
  status: RefillStatus | null;
}

interface RefillResponse {
  status: boolean;
  msg?: string;
  refill?: number | string;
  refill_id?: number | string;
  refill_status?: string;
}

/* ------------------------------------------------------------------ */
/*  Request Refill — via Supabase Edge Function                       */
/* ------------------------------------------------------------------ */

/**
 * Ask the Edge Function to call FAYUPEDIA_BASE_URL/refill with the order ID.
 * The Edge Function uses FAYUPEDIA_ID and FAYUPEDIA_KEY from its secrets.
 */
function mapRefill(data: RefillResponse, action: 'refill' | 'refill_status', orderId: string): RefillResult {
  if (!data.status) {
    return {
      ok: false,
      message: data.msg || (action === 'refill' ? 'Refill belum tersedia.' : 'Refill tidak ditemukan.'),
      refillId: action === 'refill' ? null : orderId,
      status: null,
    };
  }
  if (action === 'refill') {
    return {
      ok: true,
      message: data.msg || 'Permintaan refill berhasil dibuat.',
      refillId: data.refill !== undefined ? String(data.refill) : null,
      status: null,
    };
  }
  return {
    ok: true,
    message: data.msg || 'Refill ditemukan.',
    refillId: data.refill_id !== undefined ? String(data.refill_id) : orderId,
    status: (data.refill_status as RefillStatus) || null,
  };
}

/** Server 1 (Fayupedia) melalui proxy PHP lama. */
async function server1(action: 'refill' | 'refill_status', orderId: string): Promise<RefillResult> {
  const edge = await invokeProxy<RefillResponse>({ action, id: orderId });
  if (edge.error || !edge.data) {
    return {
      ok: false,
      message: edge.status === 404 ? 'Pesanan belum di Reffil.' : edge.error || (action === 'refill' ? 'Gagal membuat permintaan refill.' : 'Gagal mengecek status refill.'),
      refillId: action === 'refill' ? null : orderId,
      status: null,
    };
  }
  return mapRefill(edge.data, action, orderId);
}

/** Server 3 (Medanpedia) melalui proxy PHP baru; bentuk balasan sama. */
async function server3(action: 'refill' | 'refill_status', orderId: string): Promise<RefillResult> {
  try {
    const response = await fetch(`${MAIN_API}/medanpedia_refill.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ action, id: orderId }),
    });
    const data = (await response.json()) as RefillResponse;
    if (!response.ok) {
      return { ok: false, message: data.msg || `HTTP ${response.status}`, refillId: action === 'refill' ? null : orderId, status: null };
    }
    return mapRefill(data, action, orderId);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Gagal terhubung ke Server 3.', refillId: action === 'refill' ? null : orderId, status: null };
  }
}

/** Urutan percobaan auto-deteksi: prefix menentukan server utama, sisanya coba satu persatu. */
function providerOrder(orderId: string): Array<1 | 3> {
  if (orderId.startsWith('S3-')) return [3];
  if (orderId.startsWith('S2-')) return [];
  return [1, 3];
}

async function withFallback(action: 'refill' | 'refill_status', orderId: string): Promise<RefillResult> {
  const order = providerOrder(orderId);
  if (order.length === 0) {
    return { ok: false, message: 'Refill Server 2 belum tersedia. Hubungi admin.', refillId: action === 'refill' ? null : orderId, status: null };
  }
  let last: RefillResult | null = null;
  for (const provider of order) {
    last = provider === 3 ? await server3(action, orderId) : await server1(action, orderId);
    if (last.ok) return last;
  }
  return last ?? { ok: false, message: 'Refill tidak ditemukan.', refillId: action === 'refill' ? null : orderId, status: null };
}

/* ------------------------------------------------------------------ */
/*  Request Refill — coba Server 1 lalu Server 3 (auto-deteksi)        */
/* ------------------------------------------------------------------ */

export async function requestRefill(orderId: string): Promise<RefillResult> {
  return withFallback('refill', orderId);
}

/* ------------------------------------------------------------------ */
/*  Check Refill Status — via Supabase Edge Function                  */
/* ------------------------------------------------------------------ */

/**
 * Ask the Edge Function to call FAYUPEDIA_BASE_URL/refill/status with the
 * order ID.  The Edge Function maps action='refill_status' to that path.
 */
export async function checkRefillStatus(orderId: string): Promise<RefillResult> {
  return withFallback('refill_status', orderId);
}
