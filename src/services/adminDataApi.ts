// Data admin utama (php-api/admin_data.php): pesanan semua user, user, profit (SMM + Agen AI + Upgrade), deposit.
import { MAIN_API } from '../lib/apiBase';

const API = `${MAIN_API}/admin_data.php`;
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
    return ((await r.json().catch(() => null)) || { ok: false, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}

export type OrderType = 'smm' | 'agent_ai' | 'nexspace' | 'otp' | 'upgrade' | 'event';
export type OrderStatus = 'pending' | 'proses' | 'selesai' | 'batal';
export interface AdminOrder {
  id: number;
  order_id: string;
  user_id: number;
  service_name: string;
  quantity: number;
  price: number;
  status: OrderStatus;
  created_at: number;
  type: OrderType;
  user_name: string | null;
  username: string | null;
  user_email: string | null;
  cost: number | null;
  markup: number | null;
  target: string | null;
}
export interface AdminUser {
  id: number;
  name: string;
  username: string | null;
  email: string;
  phone: string | null;
  has_phone: boolean;
  has_username: boolean;
  role: string;
  balance: number;
  plus: boolean;
  has_plus: boolean;
  created_at: string | null;
  orders: number | null;
  spend: number | null;
}
export interface Period { today: number; month: number; all: number }
export interface ProfitData {
  income: Period & {
    /** Markup SMM tercatat (tabel smm_order_profit). */
    recorded: Period & { orders: number; cost: number };
    /** Estimasi markup order SMM lama, Rp4.425/1000. */
    estimated: Period & { orders: number };
    /** Markup SMM (recorded + estimated). */
    smm: Period & { orders: number };
    /** Sewa Agen AI (harga dasar paket; tanpa markup child panel). */
    agent_ai: Period & { orders: number };
    /** Upgrade Boosteryuk Plus & EXTRA (harga penuh). */
    upgrade: Period & { orders: number };
    /** Margin Order OTP (base_price − biaya provider max_usd × kurs; markup panel milik pemilik panel). */
    otp: Period & { orders: number };
  };
  transactions: { smm: { n: number; omzet: number }; lain: { n: number; omzet: number }; today: { n: number; omzet: number }; month: { n: number; omzet: number }; batal: number };
  deposits: Period & { source: string | null; count_month: number; manual?: Period };
  users: { total: number; balance: number };
  server_time: string;
}
export interface AdminDeposit {
  source: 'gateway' | 'manual';
  amount: number;
  status: string | null;
  time: string | null;
  ref: string | null;
  method: string | null;
  user_name: string | null;
  username: string | null;
  user_email: string | null;
  note: string | null;
}

export const adminDataApi = {
  orders: (p: { q?: string; type?: string; status?: string; page?: number }) =>
    call<{ orders?: AdminOrder[]; total?: number; omzet?: number; page?: number; per_page?: number }>('orders', p),
  setOrderStatus: (id: number, status: OrderStatus) => call<object>('order_status', { id, status }),
  users: (p: { q?: string; page?: number }) => call<{ users?: AdminUser[]; total?: number; total_balance?: number; page?: number; per_page?: number }>('users', p),
  updateUser: (d: Partial<Pick<AdminUser, 'name' | 'username' | 'email' | 'phone' | 'role' | 'plus'>> & { id: number }) => call<{ user?: AdminUser }>('user_update', d),
  balance: (id: number, amount: number, note: string) => call<{ balance?: number }>('user_balance', { id, amount, note }),
  setOrderId: (id: number, order_id: string) => call<{order_id: string}>('order_id', {id, order_id}),
  provider2Balance: () => call<{balance: number; currency: string; idr: number; fx: {rate: number; updated_at: number}}>('provider2_balance'),
  providerHealth: () => call<{balance: number; shortfall: number; alert_sent: boolean}>('provider_health'),
  smmgenBalance: () => call<{balance: number | null; currency: string}>('smmgen_balance'),
  profit: () => call<ProfitData>('profit'),
  deposits: () => call<{ deposits?: AdminDeposit[]; stats?: ProfitData['deposits']; server_time?: string }>('deposits', { limit: 10 }),
};

export const rupiah = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
export const TYPE_LABEL: Record<OrderType, string> = { event: 'Event', smm: 'SMM', agent_ai: 'Agen AI', nexspace: 'NexSpace', otp: 'Nomor OTP', upgrade: 'Upgrade' };
