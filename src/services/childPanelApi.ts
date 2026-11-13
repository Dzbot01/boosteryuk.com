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
  remove: (id: number) => call<{ panels?: ChildPanel[] }>('delete', { id }),
};
