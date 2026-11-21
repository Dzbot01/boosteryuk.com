import { MAIN_API } from '../lib/apiBase';
import type { TripayTransaction } from './tripay';
export interface DepositInvoice {
  merchant_ref: string;
  reference: string | null;
  nominal: number | null;
  bonus: number | null;
  credit: number;
  method: string;
  status: string;
  created_time: number;
  cancel_after: number;
  cancelled_at: string | null;
  paid_at: string | null;
  transaction: TripayTransaction | null;
}
interface Response {
  ok: boolean;
  message?: string;
  invoice?: DepositInvoice | null;
  rows?: DepositInvoice[];
  has_more?: boolean;
  server_time?: number;
}
export class DepositError extends Error {
  invoice?: DepositInvoice | null;
  constructor(data: Response) { super(data.message || 'Deposit gagal diproses.'); this.invoice = data.invoice; }
}
export async function depositCall(action: string, body: Record<string, unknown> = {}): Promise<Response> {
  let token = '';
  try { token = localStorage.getItem('token') || ''; } catch { /* handled by server */ }
  const response = await fetch(`${MAIN_API}/deposit.php`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ ...body, action, token }),
  });
  const data = await response.json().catch(() => null) as Response | null;
  if (!data) throw new Error('API deposit tidak merespons JSON. Coba lagi atau hubungi admin.');
  if (!response.ok || !data.ok) throw new DepositError(data);
  return data;
}
export const depositLabel = (status: string) => status === 'PAID' ? 'Sukses' : status === 'EXPIRED' ? 'Kedaluwarsa' : ['CREATING', 'UNPAID', 'PENDING'].includes(status) ? 'Menunggu pembayaran' : 'Batal';
export const depositPending = (invoice: DepositInvoice | null) => !!invoice && ['CREATING', 'UNPAID', 'PENDING'].includes(invoice.status);
