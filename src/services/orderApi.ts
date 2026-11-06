/**
 * orderApi.ts
 *
 * All Fayupedia API calls are proxied through PHP: status.php
 * The credentials (API_ID, API_KEY, BASE_URL) live exclusively on the server —
 * they are never exposed to the browser.
 *
 * Browser → PHP Proxy (status.php) → Fayupedia API
 */

import { invokeProxy } from '../supabase';

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

export interface OrderData {
  orderId: string;
  orderStatus: string;
  charge: number | null;
  startCount: number | null;
  remains: number | null;
  msg: string;
}

export interface LookupFailure {
  id: string;
  reason: string;
}

export interface DebugInfo {
  endpoint: string;
  method: string;
  requestBody: string;
  httpStatus: number | null;
  okHttp: boolean | null;
  responseText: string | null;
  networkError: string | null;
  parseError: string | null;
  serverMsg: string | null;
  durationMs: number;
}

export interface LookupResult {
  ok: boolean;
  message: string;
  orders: OrderData[];
  failures: LookupFailure[];
  debug: DebugInfo;
}

interface SingleResponse {
  status: boolean;
  msg?: string;
  order_id?: number | string;
  order_status?: string;
  charge?: number | string;
  start_count?: number | string;
  remains?: number | string;
}

interface MassResponse {
  status: boolean;
  msg?: string;
  orders?: Record<
    string,
    {
      msg?: string;
      order_status?: string;
      charge?: number | string;
      start_count?: number | string;
      remains?: number | string;
    }
  >;
}

type ApiResponse = SingleResponse & MassResponse;

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

const MAX_IDS = 50;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://cekidku.my.id/api';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n)? n : null;
}

export function parseOrderIds(raw: string): { ids: string[]; invalid: string[] } {
  const parts = raw
   .split(/[,;\n\r\t ]+/)
   .map((s) => s.trim())
   .filter(Boolean);

  const unique = Array.from(new Set(parts));
  const ids: string[] = [];
  const invalid: string[] = [];

  for (const p of unique) {
    if (/^\d+$/.test(p)) ids.push(p);
    else invalid.push(p);
  }

  const overLimit = ids.slice(MAX_IDS).map((id) => `#${id} (melebihi batas ${MAX_IDS} ID)`);
  return { ids: ids.slice(0, MAX_IDS), invalid: [...invalid,...overLimit] };
}

function normalize(status?: string): string {
  return (status || 'pending').toString().toLowerCase().trim();
}

function makeOrder(id: string, src: Record<string, unknown>, fallbackMsg?: string): OrderData {
  return {
    orderId: id,
    orderStatus: normalize(src.order_status as string | undefined),
    charge: toNumber(src.charge),
    startCount: toNumber(src.start_count),
    remains: toNumber(src.remains),
    msg: ((src.msg as string) || fallbackMsg || 'Pesanan ditemukan.').toString(),
  };
}

function blankDebug(id: string): DebugInfo {
  return {
    endpoint: `${API_BASE_URL}/status.php`,
    method: 'POST',
    requestBody: `id=${id}`,
    httpStatus: null,
    okHttp: null,
    responseText: null,
    networkError: null,
    parseError: null,
    serverMsg: null,
    durationMs: 0,
  };
}

/* ------------------------------------------------------------------ */
/* Main request — via PHP Proxy */
/* ------------------------------------------------------------------ */

export async function checkOrderStatus(rawInput: string): Promise<LookupResult> {
  const t0 = typeof performance!== 'undefined'? performance.now() : Date.now();
  const elapsed = () => Math.round((typeof performance!== 'undefined'? performance.now() : Date.now()) - t0);

  const { ids, invalid } = parseOrderIds(rawInput);

  const invalidFailures: LookupFailure[] = ids.length > 0
   ? invalid.map((id) => ({ id, reason: 'Dilewati — format ID tidak valid (harus angka).' }))
    : [];

  const finish = (r: Omit<LookupResult, 'debug'>, dbg: DebugInfo): LookupResult => ({
   ...r,
    failures: [...r.failures,...invalidFailures],
    debug: {...dbg, durationMs: elapsed() },
  });

  /* ---- Validate ---- */
  if (ids.length === 0) {
    return finish(
      {
        ok: false,
        message: invalid.length > 0
         ? `ID tidak valid: ${invalid.join(', ')}. Harus angka, maks ${MAX_IDS} ID dipisah koma.`
          : 'Masukkan minimal satu ID pesanan.',
        orders: [],
        failures: invalid.map((id) => ({
          id,
          reason: 'Format tidak valid — ID pesanan harus berupa angka.',
        })),
      },
      blankDebug(rawInput),
    );
  }

  const idStr = ids.join(',');
  const debug: DebugInfo = {
   ...blankDebug(idStr),
    requestBody: `id=${idStr}`,
  };

  /* ---- Call PHP Proxy via invokeProxy ---- */
  const edge = await invokeProxy<ApiResponse>({ action: 'status', id: idStr });

  debug.httpStatus = edge.status;
  debug.okHttp = edge.ok;

  /* ---- Network / proxy error ---- */
  if (edge.error ||!edge.data) {
    const errMsg = edge.error || 'Proxy tidak mengembalikan data.';
    debug.networkError = errMsg;
    return finish(
      {
        ok: false,
        message: errMsg,
        orders: [],
        failures: ids.map((id) => ({ id, reason: errMsg })),
      },
      debug,
    );
  }

  const data: ApiResponse = edge.data;
  const topMsg = (data.msg || '').toString();
  debug.serverMsg = topMsg || null;
  debug.responseText = JSON.stringify(data).slice(0, 1200);

  /* ---- status: false ---- */
  if (data.status === false) {
    return finish(
      {
        ok: false,
        message: topMsg || 'Pesanan tidak ditemukan.',
        orders: [],
        failures: ids.map((id) => ({ id, reason: topMsg || 'Pesanan tidak ditemukan.' })),
      },
      debug,
    );
  }

  /* ---- Mass response ---- */
  if (data.orders && typeof data.orders === 'object') {
    const orders: OrderData[] = [];
    const failures: LookupFailure[] = [];

    for (const id of ids) {
      const entry =
        data.orders[id]??
        data.orders[String(Number(id))]??
        data.orders[`#${id}`];

      if (entry && entry.order_status) {
        orders.push(makeOrder(id, entry as Record<string, unknown>, topMsg));
      } else {
        failures.push({ id, reason: entry?.msg || topMsg || 'Pesanan tidak ditemukan.' });
      }
    }

    if (orders.length === 0) {
      for (const [key, entry] of Object.entries(data.orders)) {
        if (entry && entry.order_status) {
          orders.push(makeOrder(key, entry as Record<string, unknown>, topMsg));
        }
      }
    }

    return finish(
      {
        ok: orders.length > 0,
        message: orders.length > 0? topMsg || 'Pesanan ditemukan.' : topMsg || 'Pesanan tidak ditemukan.',
        orders,
        failures,
      },
      debug,
    );
  }

  /* ---- Single response ---- */
  if (data.order_status) {
    const id = data.order_id!== undefined && data.order_id!== null
     ? String(data.order_id)
      : ids[0];
    return finish(
      {
        ok: true,
        message: topMsg || 'Pesanan ditemukan.',
        orders: [makeOrder(id, data as unknown as Record<string, unknown>)],
        failures: [],
      },
      debug,
    );
  }

  /* ---- Unknown shape ---- */
  return finish(
    {
      ok: false,
      message: topMsg || 'Format respons tidak dikenali dari server.',
      orders: [],
      failures: ids.map((id) => ({ id, reason: topMsg || 'Format respons tidak dikenali.' })),
    },
    debug,
  );
}

/* ------------------------------------------------------------------ */
/* Presentation helpers — TIDAK DIUBAH */
/* ------------------------------------------------------------------ */

export type Stage = 'Dibuat' | 'Di Proses' | 'Selesai';

export function mapStatusToStage(status: string): Stage {
  switch (normalize(status)) {
    case 'pending':
      return 'Dibuat';
    case 'processing':
    case 'partial':
      return 'Di Proses';
    case 'completed':
    case 'canceled':
    case 'cancelled':
      return 'Selesai';
    default:
      return 'Dibuat';
  }
}

export function stageIndex(stage: Stage): number {
  if (stage === 'Dibuat') return 0;
  if (stage === 'Di Proses') return 1;
  return 2;
}

export function isCanceled(status: string): boolean {
  return ['canceled', 'cancelled'].includes(normalize(status));
}

export function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCount(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('id-ID').format(value);
}

export function statusLabel(status: string): string {
  switch (normalize(status)) {
    case 'pending': return 'Menunggu';
    case 'processing': return 'Sedang diproses';
    case 'partial': return 'Sebagian selesai';
    case 'completed': return 'Selesai';
    case 'canceled':
    case 'cancelled': return 'Dibatalkan';
    default: return status;
  }
}

export function timelineFor(status: string) {
  const idx = stageIndex(mapStatusToStage(status));
  const canceled = isCanceled(status);

  return [
    {
      label: 'Pesanan dibuat',
      detail: 'Pesanan berhasil masuk ke sistem booster.',
      active: idx >= 0,
      current: idx === 0 &&!canceled,
    },
    {
      label: 'Sistem sedang mengirim',
      detail: canceled
       ? 'Proses dihentikan sebelum pengiriman selesai.'
        : 'Booster sedang dijalankan ke target media sosial.',
      active: idx >= 1,
      current: idx === 1 &&!canceled,
    },
    {
      label: canceled? 'Pesanan dibatalkan' : 'Pengiriman selesai',
      detail: canceled
       ? 'Pesanan dihentikan. Hubungi admin bila butuh bantuan.'
        : 'Target booster telah terpenuhi sesuai pesanan.',
      active: idx >= 2 || canceled,
      current: idx === 2 || canceled,
    },
  ];
}