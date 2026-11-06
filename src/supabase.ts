export interface EdgePayload {
  action: 'status' | 'refill' | 'refill_status' | 'services' | 'order' | 'balance';
  id?: string;
  serviceId?: string;
  serviceName?: string;
  link?: string;
  quantity?: number;
  price?: number;
  comments?: string;
  token?: string; 
}
export interface EdgeResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

const API_BASE_URL = 'https://boosteryuk.com/api';

const ENDPOINTS: Record<Exclude<EdgePayload['action'], undefined>, string> = {
  status: `${API_BASE_URL}/status.php`,
  refill: `${API_BASE_URL}/reffil.php`,
  refill_status: `${API_BASE_URL}/reffil-status.php`,
  services: `${API_BASE_URL}/services.php`,
  order: `${API_BASE_URL}/order.php`,
  // FIX: balance.php sebelumnya tidak terdaftar -> fetchBalance selalu gagal (saldo tak muncul).
  balance: `${API_BASE_URL}/balance.php`,
};

export async function invokeProxy<T = unknown>(
  payload: EdgePayload
): Promise<EdgeResponse<T>> {
  const token = localStorage.getItem('token'); // ambil token login
  const endpoint = ENDPOINTS[payload.action];

  if (!endpoint) {
    return { ok: false, status: 400, data: null, error: `Action ${payload.action} tidak ditemukan` };
  }

  try {
    const body: any = { token };

if (payload.action === 'order') {
  body.service = payload.serviceId; 
  body.serviceName = payload.serviceName; // TAMBAH
  body.link = payload.link;         
  body.quantity = payload.quantity;
  body.price = payload.price;
  if (payload.comments) body.comments = payload.comments;
} else {
      body.id = payload.id;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    let data: T | null = null;

    try {
      data = JSON.parse(raw) as T;
    } catch {
      return {
        ok: false,
        status: response.status,
        data: null,
        error: `Server balas HTML bukan JSON. Cek ${endpoint}`,
      };
    }

    if (!response.ok) {
      const result = data as { msg?: string; error?: string; message?: string };
      return {
        ok: false,
        status: response.status,
        data,
        error: result?.msg || result?.error || result?.message || `HTTP ${response.status}`,
      };
    }

    return { ok: true, status: response.status, data, error: null };
  } catch (err) {
    const e = err as Error;
    return { ok: false, status: 0, data: null, error: e.message || 'Gagal terhubung ke server PHP.' };
  }
}