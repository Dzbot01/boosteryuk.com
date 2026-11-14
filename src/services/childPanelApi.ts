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
  save: (panel: { name: string; config: TenantConfig; markup_smm_pct: number; markup_agent_pct: number }) =>
    call<{ id?: number; hostname?: string; url?: string }>('my_save', { panel }),
  upload: (slot: string, data: string) => call<{ ref?: string }>('my_upload', { slot, data }),
  videoSign: (ext: string, size: number) => call<{ upload_url?: string; public_url?: string; max_mb?: number }>('my_video_sign', { ext, size }),
};
