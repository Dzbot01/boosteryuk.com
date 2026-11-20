import { MAIN_API } from '../lib/apiBase';

export const GAME_CLOSED = 'Game sedang ditutup, silakan cobalagi nanti.';

type GameResponse = {
  ok: boolean;
  message?: string;
  code?: string;
  payment_started?: boolean;
  revision?: number;
  catalog?: Record<string, { name: string; price: number }>;
  [key: string]: unknown;
};

/** Never retry a payment on another URL: a lost response may follow a successful commit. */
export async function eventGameRequest(body: Record<string, unknown>): Promise<GameResponse> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(`${MAIN_API}/event_game.php`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    text = (await response.text()).trim();
  } catch {
    throw new Error(GAME_CLOSED);
  }
  if (response.status >= 500 && response.status !== 503) throw new Error(GAME_CLOSED);
  const status = `HTTP ${response.status}`;
  if (response.status === 404 || !text || /^</.test(text)) throw new Error(GAME_CLOSED);
  let data: GameResponse;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || typeof (parsed as GameResponse).ok !== 'boolean') throw new Error();
    data = parsed as GameResponse;
  } catch {
    throw new Error(GAME_CLOSED);
  }
  // Only this explicit pre-transaction rejection guarantees no payment was attempted.
  const preflightRejected = data.ok === false && data.code === 'GAME_ENGINE_NOT_READY' && data.payment_started === false;
  if (response.status >= 500 && !preflightRejected) throw new Error(GAME_CLOSED);
  if (!response.ok || !data.ok) throw new Error(data.message || `Permintaan game gagal (${status}).`);
  return data;
}
