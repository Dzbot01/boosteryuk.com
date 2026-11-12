// Klien Agen Sewa AI. Memanggil PHP proxy (agent.php) yang meneruskan ke VPS
// lewat Cloudflare tunnel. Token disimpan server-side (tidak di browser).
const API_BASE = 'https://boosteryuk.com/api';

export interface AgentCreate {
  orderId: string;
  phone: string;
  email: string;
  nama?: string;
  paket?: string;
}

export type AgentStatus = 'starting' | 'pairing' | 'linked' | 'closed';

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
export async function orderAgent(body: { tier: string; months: number; phone: string; nama: string; platform?: string }): Promise<AgentOrderResult> {
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
export async function getAgentStatus(orderId: string): Promise<{ ok: boolean; status?: AgentStatus; hasCode?: boolean; phone?: string; log?: string[]; message?: string }> {
  try {
    const r = await fetch(`${API_BASE}/agent.php?action=status&id=${encodeURIComponent(orderId)}&token=${encodeURIComponent(authToken())}`);
    return await r.json();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal cek status.' };
  }
}
