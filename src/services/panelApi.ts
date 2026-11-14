// Klien Child Panel untuk user & admin ke-2 (pemilik panel). Dipanggil di subdomain panel:
// MAIN_API = /api di host itu → Worker menambahkan header X-Child-Panel → PHP tahu panelnya.
import { useEffect, useState } from 'react';
import { IS_CHILD_PANEL, MAIN_API } from '../lib/apiBase';

const API = `${MAIN_API}/child_panel.php`;
const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

type Res<T> = T & { ok: boolean; message?: string };
async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<Res<T>> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), action, ...body }) });
    return ((await r.json().catch(() => null)) || { ok: false, message: `HTTP ${r.status}` }) as Res<T>;
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghubungi server.' } as Res<T>;
  }
}

export interface PanelTotals {
  orders: number;
  omzet: number;
  profit: number;
}
export interface PanelSummary {
  panel: { name: string; hostname: string; markup_smm_pct: number; markup_agent_pct: number; markup_otp_pct?: number };
  all: PanelTotals;
  month: PanelTotals;
  today: PanelTotals;
  users: { total: number; active7d: number };
}
export interface PanelOrder {
  order_id: string;
  kind: 'smm' | 'agent' | 'otp';
  service_name: string;
  quantity: number;
  price: number;
  base_price: number;
  profit: number;
  created_at: string;
  name: string | null;
  email: string | null;
  status: string | null;
}
export interface PanelUser {
  name: string | null;
  email: string | null;
  first_seen: string;
  last_seen: string;
  visits: number;
  last_action: string | null;
  orders: number;
  spend: number;
  profit: number;
}

export const panelApi = {
  ping: () => call<{ is_owner?: boolean }>('ping'),
  /** Catat pesanan SMM di panel (server memverifikasi lewat riwayat_pesanan). */
  recordOrder: (orderId: string) => call<object>('record_order', { order_id: orderId }),
  summary: () => call<PanelSummary>('owner_summary'),
  orders: (limit = 100) => call<{ orders?: PanelOrder[] }>('owner_orders', { limit }),
  users: () => call<{ users?: PanelUser[] }>('owner_users'),
  setMarkup: (markup_smm_pct: number, markup_agent_pct: number, markup_otp_pct: number) =>
    call<{ markup_smm_pct?: number; markup_agent_pct?: number; markup_otp_pct?: number }>('owner_set_markup', { markup_smm_pct, markup_agent_pct, markup_otp_pct }),
};

const ownerCache = new Map<string, boolean>();

/**
 * Apakah user login adalah admin ke-2 (pemilik) child panel ini.
 * Sekaligus mencatat kunjungan user ke panel (sekali per sesi browser).
 */
export function usePanelOwner(userToken: string | undefined | null): boolean | null {
  const [owner, setOwner] = useState<boolean | null>(() => (userToken && ownerCache.has(userToken) ? ownerCache.get(userToken)! : null));
  useEffect(() => {
    if (!IS_CHILD_PANEL || !userToken) {
      setOwner(false);
      return;
    }
    if (ownerCache.has(userToken)) return setOwner(ownerCache.get(userToken)!);
    let alive = true;
    panelApi.ping().then((r) => {
      const v = !!(r.ok && r.is_owner);
      ownerCache.set(userToken, v);
      if (alive) setOwner(v);
    });
    return () => {
      alive = false;
    };
  }, [userToken]);
  return owner;
}
