// Tenant (child panel) aktif untuk host ini. Dimuat sekali dari /api/child_panel.php.
import { CHILD_PANEL_SUB, IS_CHILD_PANEL, MAIN_API } from './apiBase';

export type VoiceMode = 'full' | 'welcome' | 'off';

export interface TenantSlide {
  image: string;
  title: string;
  subtitle: string;
}

export interface TenantConfig {
  brandName?: string;
  brandSuffix?: string;
  headerTagline?: string;
  footerText?: string;
  themePreset?: string;
  brandAccent?: string;
  headerTint?: string;
  menuActive?: string;
  headerOrnament?: string;
  /** 'cpasset:<slot>:<versi>' atau URL https */
  logo?: string;
  hero?: string;
  voice?: VoiceMode;
  slides?: TenantSlide[];
}

export interface Tenant {
  id: number;
  name: string;
  hostname: string;
  markup_smm_pct: number;
  markup_agent_pct: number;
  config: TenantConfig;
}

let current: Tenant | null = null;
let pending: Promise<Tenant | null> | null = null;

/** Muat konfigurasi child panel (null di web utama / bila panel belum terdaftar). */
export function loadTenant(): Promise<Tenant | null> {
  if (!IS_CHILD_PANEL) return Promise.resolve(null);
  if (!pending) {
    pending = fetch(`${MAIN_API}/child_panel.php?host=${encodeURIComponent(`${CHILD_PANEL_SUB}.boosteryuk.com`)}&t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        current = j?.ok && j.tenant ? (j.tenant as Tenant) : null;
        return current;
      })
      .catch(() => null);
  }
  return pending;
}

export function currentTenant(): Tenant | null {
  return current;
}

/** URL gambar dari ref config ('cpasset:slot:versi' → child_panel.php?asset=...). */
export function tenantAssetUrl(t: Pick<Tenant, 'id'> | null, ref: string | undefined): string {
  if (!t || !ref) return '';
  const m = /^cpasset:([a-z0-9]+):([a-f0-9]+)$/.exec(ref);
  if (m) return `${MAIN_API}/child_panel.php?asset=${t.id}-${m[1]}&v=${m[2]}`;
  return /^https:\/\//i.test(ref) ? ref : '';
}

/** Pengali harga child panel (1 = tanpa markup). Hanya tampilan; harga final dihitung server. */
export function markupFactor(kind: 'smm' | 'agent', t: Tenant | null = current): number {
  if (!t) return 1;
  const pct = kind === 'agent' ? t.markup_agent_pct : t.markup_smm_pct;
  return 1 + Math.max(0, Math.min(300, Number(pct) || 0)) / 100;
}
