import { invokeProxy } from '../supabase';

export interface OrderRequest {
  serviceId: string;
  serviceName: string; // WAJIB: buat simpan ke riwayat
  link: string;
  quantity: number;
  price: number; // WAJIB: total harga buat potong saldo profil
  comments?: string;
}

export interface OrderResponse {
  ok: boolean;
  message: string;
  orderId: string | null;
  new_balance?: number; // BALIKAN SALDO BARU DARI PHP
}

interface RawResponse {
  ok?: boolean;
  status?: boolean;
  message?: string;
  msg?: string;
  orderId?: number | string;
  order?: number | string;
  new_balance?: number;
}

export async function placeOrder(req: OrderRequest): Promise<OrderResponse> {
  const edge = await invokeProxy<RawResponse>({
    action: 'order',
    serviceId: req.serviceId,
    serviceName: req.serviceName, // KIRIM KE PHP
    link: req.link,
    quantity: req.quantity,
    price: req.price, // KIRIM KE PHP
    ...(req.comments ? { comments: req.comments } : {}),
  });

  if (edge.error) {
    return { 
      ok: false, 
      message: edge.error, 
      orderId: null 
    };
  }

  const data = edge.data;
  if (!data) {
    return { ok: false, message: 'Response kosong dari server', orderId: null };
  }

  // Auto update saldo di localStorage kalau ada new_balance dari PHP
  if(data.new_balance !== undefined){
    try {
      const userStr = localStorage.getItem('user');
      if(userStr){
        const user = JSON.parse(userStr);
        user.balance = data.new_balance;
        localStorage.setItem('user', JSON.stringify(user));
        // Trigger event biar navbar/header yg nampilin saldo ikut ke-update
        window.dispatchEvent(new Event('balanceUpdated'));
      }
    } catch(e) { console.error('Gagal update balance local', e) }
  }

  const ok = data.ok ?? data.status ?? false;
  const message = data.message ?? data.msg ?? 'Gagal membuat pesanan';
  const orderId = data.orderId ?? data.order ?? null;

  return {
    ok: ok === true,
    message: String(message),
    orderId: orderId != null ? String(orderId) : null,
    new_balance: data.new_balance
  };
}