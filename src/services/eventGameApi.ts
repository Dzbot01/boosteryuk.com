import { MAIN_API } from '../lib/apiBase';

type GameResponse = {
  ok: boolean;
  message?: string;
  revision?: number;
  catalog?: Record<string, { name: string; price: number }>;
  [key: string]: unknown;
};

/** Never retry a payment on another URL: a lost response may follow a successful commit. */
export async function eventGameRequest(body: Record<string, unknown>): Promise<GameResponse> {
  const payment = body.action === 'buy';
  const uncertain = payment ? ' Jangan bayar ulang dulu; periksa saldo dan Riwayat Pesanan. Retry di halaman yang sama memakai ID transaksi yang sama.' : '';
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${MAIN_API}/event_game.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    text = (await response.text()).trim();
  } catch {
    throw new Error(`Tidak dapat menghubungi API game atau koneksi terputus.${uncertain}`);
  }
  const status = `HTTP ${response.status}`;
  if (response.status === 404) {
    throw new Error(`API game tidak ditemukan (${status}). Upload event_game.php dan event_game_lib.php ke folder /api server PHP; pastikan proxy /api tidak diarahkan ke halaman website.${uncertain}`);
  }
  if (!text) {
    throw new Error(`API game mengembalikan respons kosong (${status}). Periksa log PHP, koneksi database, dan kelengkapan file API.${uncertain}`);
  }
  if (/^</.test(text)) {
    const challenge = /aes\.js|toNumbers\(|__test|just a moment|cf-chl-/i.test(text);
    throw new Error(challenge
      ? `API game terhalang proteksi hosting (${status}). Periksa proxy API dan penanganan challenge hosting.${uncertain}`
      : `API game mengembalikan halaman HTML, bukan JSON (${status}). Periksa upload /api/event_game.php, routing proxy, dan log PHP.${uncertain}`);
  }
  let data: GameResponse;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof (parsed as GameResponse).ok !== 'boolean') throw new Error();
    data = parsed as GameResponse;
  } catch {
    throw new Error(`Respons API game tidak valid atau terpotong (${status}). Periksa log PHP dan proxy server.${uncertain}`);
  }
  if (!response.ok || !data.ok) throw new Error((data.message || `Permintaan game gagal (${status}).`) + (response.status >= 500 ? uncertain : ''));
  return data;
}
