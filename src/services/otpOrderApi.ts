// Order Nomor (OTP) — php-api/otp.php. Dibayar dengan saldo akun; harga & stok realtime.
import { MAIN_API } from '../lib/apiBase';

const API = `${MAIN_API}/otp.php`;
const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};
type Res<T> = T & { ok: boolean; message?: string };

async function get<T>(qs: string): Promise<Res<T>> {
  try {
    const r = await fetch(`${API}?${qs}`, { cache: 'no-store' });
    return ((await r.json().catch(() => null)) || { ok: false, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}
async function post<T>(action: string, body: Record<string, unknown> = {}): Promise<Res<T>> {
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: token(), action, ...body }) });
    return ((await r.json().catch(() => null)) || { ok: false, message: `Server membalas HTTP ${r.status}.` }) as Res<T>;
  } catch {
    return { ok: false, message: 'Gagal menghubungi server.' } as Res<T>;
  }
}

export interface OtpService { code: string; name: string }
export interface OtpCountry { id: string; name: string }
export interface OtpTier { harga: number; stok: number }
export type OtpStatus = 'membeli' | 'menunggu' | 'selesai' | 'batal' | 'gagal';
export interface OtpOrder {
  order_id: string;
  service: string;
  country: string;
  price: number;
  phone: string | null;
  code: string | null;
  status: OtpStatus;
  refunded: boolean;
  note: string | null;
  seconds_left: number | null;
  created_at: string;
}

export const otpApi = {
  services: () => get<{ services?: OtpService[] }>('action=services'),
  countries: () => get<{ countries?: OtpCountry[] }>('action=countries'),
  prices: (service: string, country: string) =>
    get<{ tiers?: OtpTier[] }>(`action=prices&service=${encodeURIComponent(service)}&country=${encodeURIComponent(country)}&t=${Date.now()}`),
  buy: (service: string, country: string, harga: number) => post<{ order?: OtpOrder; balance?: number }>('buy', { service, country, harga }),
  status: (orderId: string) => post<{ order?: OtpOrder; balance?: number }>('status', { order_id: orderId }),
  cancel: (orderId: string) => post<{ order?: OtpOrder }>('cancel', { order_id: orderId }),
  list: () => post<{ orders?: OtpOrder[] }>('list'),
};
