import { MAIN_API } from '../lib/apiBase';
// Klien Agen Sewa AI. Memanggil PHP proxy (agent.php) yang meneruskan ke VPS
// lewat Cloudflare tunnel. Token disimpan server-side (tidak di browser).
const API_BASE = MAIN_API;

export interface AgentCreate {
  orderId: string;
  phone: string;
  email: string;
  nama?: string;
  paket?: string;
}

/** expired = 10 menit tanpa tautan → bot dihentikan & saldo dikembalikan di database. */
export type AgentStatus = 'starting' | 'pairing' | 'linked' | 'closed' | 'expired';

function authToken(): string {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
}

export interface AgentOrderResult {
  ok: boolean;
  message?: string;
  orderId?: string;
  status?: AgentStatus;
  new_balance?: number;
  serviceName?: string;
  price?: number;
  dueDate?: string;
  refunded?: boolean;
}

/**
 * Pesan Agen AI: saldo dipotong DI DATABASE (agent_order.php), riwayat tersimpan,
 * lalu server meminta VPS membuat agen. Harga dihitung server dari paket x durasi.
 * Jika VPS gagal, saldo otomatis dikembalikan oleh server.
 */
export async function orderAgent(body: {
  tier: string;
  months: number;
  phone: string;
  nama: string;
  ewallet?: string;
  toko?: string;
  platform?: string;
}): Promise<AgentOrderResult> {
  try {
    const r = await fetch(`${API_BASE}/agent_order.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, token: authToken() }),
    });
    const j = await r.json().catch(() => null);
    return j || { ok: false, message: `Server membalas HTTP ${r.status}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghubungi server.' };
  }
}

async function post(action: string, body: unknown): Promise<any> {
  try {
    const r = await fetch(`${API_BASE}/agent.php?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghubungi server agen.' };
  }
}

/** Mulai sesi agen → VPS spawn bot + kirim kode pairing ke email. */
export function createAgent(body: AgentCreate) {
  return post('create', body);
}

/** Minta kode pairing baru (restart sesi). */
export function resendAgentCode(orderId: string) {
  return post('resend', { orderId, token: authToken() });
}

/** Cek status sesi (starting | pairing | linked | closed). */
export async function getAgentStatus(orderId: string): Promise<{ ok: boolean; status?: AgentStatus; hasCode?: boolean; phone?: string; log?: string[]; message?: string; remainingSec?: number; refunded?: boolean; refund_amount?: number; new_balance?: number }> {
  try {
    const r = await fetch(`${API_BASE}/agent.php?action=status&id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(authToken())}`);
    return await r.json();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal cek status.' };
  }
}

/** Satu Agen AI milik user (dari my_agents.php / tabel riwayat_pesanan). */
export interface MyAgent {
  order_id: string;
  nama_layanan: string;
  paket: string | null;
  status: string;
  state: 'aktif' | 'menunggu' | 'kedaluwarsa';
  harga: number;
  durasi_bulan: number;
  dibeli: number;
  jatuh_tempo: number | null;
  sisa_hari: number | null;
  nomor_bot: string | null;
  nama_ai: string | null;
  nomor_pemilik: string | null;
  ewallet: string | null;
  nama_toko: string | null;
  payment_gateway: boolean;
  platform: string;
  /** Detik tersisa untuk menautkan WhatsApp (hanya state 'menunggu'). */
  sisa_tunggu?: number | null;
}

/** Daftar Agen AI user yang login. Juga memicu email pengingat jatuh tempo di server. */
export async function getMyAgents(): Promise<{ ok: boolean; agents: MyAgent[]; message?: string }> {
  try {
    const r = await fetch(`${API_BASE}/my_agents.php?token=${encodeURIComponent(authToken())}&t=${Date.now()}`, { cache: 'no-store' });
    const j = await r.json();
    if (j?.ok && Array.isArray(j.agents)) return { ok: true, agents: j.agents as MyAgent[] };
    return { ok: false, agents: [], message: j?.message || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, agents: [], message: e instanceof Error ? e.message : 'Gagal memuat data agen.' };
  }
}
