/**
 * balanceApi.ts 
 * Browser → PHP Proxy (balance.php) 
 * API_KEY sudah aman di server
 */

import { invokeProxy } from '../supabase';

export interface BalanceResult {
  ok: boolean;
  balance: number | null;
  currency: string;
  raw: unknown;
  message: string;
}

interface RawBalance {
  status?: boolean;
  msg?: string;
  balance?: number | string;
  currency?: string;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export async function fetchBalance(): Promise<BalanceResult> {
  const edge = await invokeProxy<RawBalance>({
    action: 'balance',
    id: '', // balance ga butuh id
  });

  if (edge.error || !edge.data) {
    return {
      ok: false,
      balance: null,
      currency: 'IDR',
      raw: null,
      message: edge.error || 'Gagal memuat saldo.',
    };
  }

  const data = edge.data;
  if (data.status === false) {
    return {
      ok: false,
      balance: null,
      currency: data.currency || 'IDR',
      raw: data,
      message: data.msg || 'Gagal memuat saldo.',
    };
  }

  return {
    ok: true,
    balance: toNumber(data.balance),
    currency: data.currency || 'IDR',
    raw: data,
    message: data.msg || 'Saldo dimuat.',
  };
}