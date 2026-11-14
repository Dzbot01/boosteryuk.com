// Klien admin Child Panel (php-api/child_panel.php). Semua aksi tulis wajib token admin.
import { MAIN_API } from '../lib/apiBase';
import type { TenantConfig } from '../lib/tenant';

export interface ChildPanel {
  id: number;
  name: string;
  hostname: string | null;
  subdomain: string;
  status: 'active' | 'suspended';
  markup_smm_pct: number;
  markup_agent_pct: number;
  markup_otp_pct?: number;
  owner_email: string | null;
  created_at: string;
  config: TenantConfig;
}

export interface ChildPanelInput {
  id?: number;
  name: string;
  subdomain: string;
  status: 'active' | 'suspended';
  markup_smm_pct: number;
  markup_agent_pct: number;
  markup_otp_pct?: number;
  owner_email?: string;
  config: TenantConfig;
}

const API = `${MAIN_API}/child_panel.php`;
const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T & { ok: boolean; message?: string }> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), action, ...body }) });
    const j = await r.json().catch(() => null);
    return j || ({ ok: false, message: `Server membalas HTTP ${r.status}.` } as T & { ok: boolean; message?: string });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghubungi server.' } as T & { ok: boolean; message?: string };
  }
}

export const childPanelApi = {
  list: () => call<{ panels?: ChildPanel[]; root?: string }>('list'),
  check: (subdomain: string, id?: number) => call<{ available?: boolean; hostname?: string }>('check', { subdomain, id }),
  save: (panel: ChildPanelInput) => call<{ id?: number; hostname?: string; url?: string; panels?: ChildPanel[] }>('save', { panel }),
  upload: (id: number, slot: string, data: string) => call<{ ref?: string }>('upload', { id, slot, data }),
  /** Signed upload URL Supabase untuk video dashboard (dibuat server, key tidak pernah ke browser). */
  videoSign: (id: number, ext: string, size: number) => call<{ upload_url?: string; public_url?: string; max_mb?: number }>('video_sign', { id, ext, size }),
  remove: (id: number) => call<{ panels?: ChildPanel[] }>('delete', { id }),
};

/** Unggah file langsung ke signed URL Supabase (PUT) dengan progres 0..1. */
export function uploadToSignedUrl(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload gagal (HTTP ${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Upload gagal: koneksi terputus.'));
    xhr.send(file);
  });
}

/** Panel milik user sendiri (paket EXTRA) — endpoint my_* di child_panel.php. */
export interface MyPanel extends Omit<ChildPanel, 'owner_email' | 'created_at'> {
  expires_at: string | null;
}

export const ownerPanelApi = {
  mine: () => call<{ panel?: MyPanel | null }>('my_panel'),
  save: (panel: { name: string; config: TenantConfig; markup_smm_pct: number; markup_agent_pct: number; markup_otp_pct?: number }) =>
    call<{ id?: number; hostname?: string; url?: string }>('my_save', { panel }),
  upload: (slot: string, data: string) => call<{ ref?: string }>('my_upload', { slot, data }),
  videoSign: (ext: string, size: number) => call<{ upload_url?: string; public_url?: string; max_mb?: number }>('my_video_sign', { ext, size }),
};

/* ===================== Pencairan (withdraw) pendapatan child panel ===================== */
export type WdStatus = 'pending' | 'paid' | 'rejected';
export interface WdBalance {
  earned: number;
  held: number;
  paid: number;
  pending: number;
  pending_count: number;
  available: number;
  /** cleared - paid - pending; negatif = pesanan dibatalkan setelah dicairkan. */
  raw_available?: number;
}
export interface WdMethod {
  id: string;
  label: string;
  fee: number;
  kind: 'ewallet' | 'bank';
  recommended: boolean;
}
export interface WdRow {
  id: number;
  method: string;
  method_label: string;
  bank_name: string | null;
  account_number: string;
  account_name: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: WdStatus;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
}
export interface WdAdminRow extends WdRow {
  child_panel_id: number;
  panel_name: string | null;
  hostname: string | null;
  owner_name: string | null;
  owner_email: string | null;
  email_sent?: number;
}
export interface WdInput {
  method: string;
  bank_name?: string;
  account_number: string;
  account_name: string;
  amount: number;
}
export interface WdOrder {
  order_id: string;
  kind: string;
  service_name: string;
  price: number;
  base_price: number;
  profit: number;
  created_at: string;
  name: string | null;
  status: string | null;
}

export const withdrawApi = {
  /** Pemilik panel: saldo, metode, riwayat. */
  info: () =>
    call<{ balance?: WdBalance; history?: WdRow[]; methods?: WdMethod[]; min?: number; hold_days?: number; last?: Partial<WdInput> | null }>('my_wd_info'),
  request: (withdraw: WdInput) => call<{ balance?: WdBalance; history?: WdRow[] }>('my_withdraw', { withdraw }),
  /** Admin utama. */
  list: (status: WdStatus | 'all') =>
    call<{ requests?: WdAdminRow[]; counts?: Record<WdStatus, number>; totals?: Record<WdStatus, number> }>('wd_list', { status }),
  detail: (id: number) => call<{ request?: WdAdminRow; balance?: WdBalance; history?: WdRow[]; orders?: WdOrder[] }>('wd_detail', { id }),
  update: (id: number, status: 'paid' | 'rejected', note: string) => call<{ request?: WdAdminRow }>('wd_update', { id, status, note }),
};
