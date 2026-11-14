// NexSpace (php-api/nexspace.php): paket server, order pakai saldo, portal Pro, admin Pro Request.
import { MAIN_API } from '../lib/apiBase';

const API = `${MAIN_API}/nexspace.php`;
const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};
type Res<T> = T & { ok: boolean; message?: string };
async function post<T>(action: string, body: Record<string, unknown> = {}): Promise<Res<T>> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), action, ...body }) });
    return ((await r.json().catch(() => null)) || { ok: false, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}

export type NxTier = 'started' | 'pro';
export interface NxPlan { id: string; tier: NxTier; name: string; ram: string; ram_mb?: number; cpu: string; disk_gb: number; price: number }
export interface NxLogin { host: string; port: number; user: string; ssh: string; password?: string | null }
export type NxStatus = 'provisioning' | 'active' | 'failed' | 'pending' | 'ready' | 'rejected';
export interface NxOrder {
  order_id: string;
  tier: NxTier;
  plan_id: string;
  plan_name: string;
  months: number;
  price: number;
  username: string;
  status: NxStatus;
  note: string | null;
  claimed: boolean;
  viewed: boolean;
  expires_at: string | null;
  created_at: string;
  delivered_at: string | null;
  refunded: boolean;
  login?: NxLogin;
}
export interface NxAdminOrder extends NxOrder { id: number; buyer_name: string | null; buyer_email: string | null; code: string | null }
export interface NxBanner { state: 'unclaimed' | 'waiting' | 'ready'; username: string; order_id: string; plan_name: string }

export const nexspaceApi = {
  plans: async () => {
    try {
      const r = await fetch(`${API}?action=plans`, { cache: 'no-store' });
      return (await r.json()) as Res<{ plans: NxPlan[]; months: number[]; rules: string[]; ssh_host: string; ssh_port: number }>;
    } catch {
      return { ok: false, message: 'Gagal memuat paket.' } as Res<{ plans: NxPlan[]; months: number[]; rules: string[]; ssh_host: string; ssh_port: number }>;
    }
  },
  order: (plan_id: string, months: number, username: string, password?: string) =>
    post<{ order?: NxOrder; balance?: number; email?: string }>('order', { plan_id, months, username, password }),
  mine: () => post<{ orders?: NxOrder[] }>('mine'),
  banner: () => post<{ banner?: NxBanner | null }>('banner'),
  claim: (code: string) => post<{ order_id?: string }>('claim', { code }),
  portal: (order_id?: string) => post<{ order?: NxOrder | null; has_unclaimed?: boolean }>('portal', order_id ? { order_id } : {}),
  ack: (order_id: string) => post<object>('portal_ack', { order_id }),
  adminList: (status: string) => post<{ requests?: NxAdminOrder[]; counts?: Record<string, number>; default_host?: string; default_port?: number }>('admin_list', { status }),
  adminDeliver: (d: { id: number; host: string; port: number; login_user: string; password: string; note: string }) => post<object>('admin_deliver', d),
  adminReject: (id: number, reason: string) => post<object>('admin_reject', { id, reason }),
};

/** Event agar banner langsung diperbarui setelah order/klaim/ambil data. */
export const NX_BANNER_EVENT = 'nexspace:banner';
export const refreshNxBanner = () => window.dispatchEvent(new Event(NX_BANNER_EVENT));
