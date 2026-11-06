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
export async function requestRefill(orderId: string): Promise<RefillResult> {
  const edge = await invokeProxy<RefillResponse>({ action: 'refill', id: orderId });

  if (edge.error || !edge.data) {
    const isHttp404 = edge.status === 404;
    return {
      ok: false,
      message: isHttp404
        ? 'Pesanan belum di Reffil.'
        : edge.error || 'Gagal membuat permintaan refill.',
      refillId: null,
      status: null,
    };
  }

  const data = edge.data;

  if (!data.status) {
    return {
      ok: false,
      message: data.msg || 'Refill belum tersedia.',
      refillId: null,
      status: null,
    };
  }

  return {
    ok: true,
    message: data.msg || 'Permintaan refill berhasil dibuat.',
    refillId: data.refill !== undefined ? String(data.refill) : null,
    status: null,
  };
}

/* ------------------------------------------------------------------ */
/*  Check Refill Status — via Supabase Edge Function                  */
/* ------------------------------------------------------------------ */

/**
 * Ask the Edge Function to call FAYUPEDIA_BASE_URL/refill/status with the
 * order ID.  The Edge Function maps action='refill_status' to that path.
 */
export async function checkRefillStatus(orderId: string): Promise<RefillResult> {
  const edge = await invokeProxy<RefillResponse>({ action: 'refill_status', id: orderId });

  if (edge.error || !edge.data) {
    const isHttp404 = edge.status === 404;
    return {
      ok: false,
      message: isHttp404
        ? 'Pesanan belum di Reffil.'
        : edge.error || 'Gagal mengecek status refill.',
      refillId: orderId,
      status: null,
    };
  }

  const data = edge.data;

  if (!data.status) {
    return {
      ok: false,
      message: data.msg || 'Refill tidak ditemukan.',
      refillId: orderId,
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
