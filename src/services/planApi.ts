// Klien paket Upgrade (php-api/plan_upgrade.php): Boosteryuk Plus & Boosteryuk EXTRA.
import { MAIN_API } from '../lib/apiBase';
import type { UserPlan } from '../context/AuthContext';

export type PlanChoice = 'plus' | 'extra';
const API = `${MAIN_API}/plan_upgrade.php`;
const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

type Res<T> = T & { ok: boolean; message?: string };

export const planApi = {
  /** Status paket user (atau hanya harga bila belum login). */
  async status(): Promise<Res<Partial<UserPlan> & { guest?: boolean }>> {
    try {
      const r = await fetch(`${API}?token=${encodeURIComponent(token())}&t=${Date.now()}`, { cache: 'no-store' });
      return await r.json();
    } catch {
      return { ok: false, message: 'Gagal menghubungi server.' };
    }
  },
  async checkSubdomain(sub: string): Promise<Res<{ available?: boolean; hostname?: string }>> {
    try {
      const r = await fetch(`${API}?check_sub=${encodeURIComponent(sub)}`, { cache: 'no-store' });
      return await r.json();
    } catch {
      return { ok: false, message: 'Gagal mengecek subdomain.' };
    }
  },
  /** Beli/perpanjang paket. Saldo dipotong di server (atomik); harga dihitung server. */
  async buy(plan: PlanChoice, extra: { subdomain?: string; panel_name?: string } = {}): Promise<Res<Partial<UserPlan> & { new_balance?: number; price?: number }>> {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), plan, ...extra }) });
      const j = await r.json().catch(() => null);
      return j || { ok: false, message: `Server membalas HTTP ${r.status}.` };
    } catch {
      return { ok: false, message: 'Gagal terhubung ke server. Periksa koneksi lalu coba lagi.' };
    }
  },
};
