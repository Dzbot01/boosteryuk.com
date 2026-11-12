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
  return post('resend', { orderId });
}

/** Cek status sesi (starting | pairing | linked | closed). */
export async function getAgentStatus(orderId: string): Promise<{ ok: boolean; status?: AgentStatus; hasCode?: boolean; phone?: string; log?: string[]; message?: string }> {
  try {
    const r = await fetch(`${API_BASE}/agent.php?action=status&id=${encodeURIComponent(orderId)}`);
    return await r.json();
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal cek status.' };
  }
}
