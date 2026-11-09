// Klien untuk fitur Playground. Memanggil PHP proxy di backend boosteryuk.com/api.
// (ai.php -> siputzx; tts.php -> ElevenLabs). Key ElevenLabs disimpan server-side.
const API_BASE = 'https://boosteryuk.com/api';

export interface TtsModel {
  model_id: string;
  name: string;
  languages: { id: string; name: string }[];
}
export interface TtsVoice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  preview?: string;
}

/** Hook Generator & Auto Caption memakai AI siputzx (via ai.php). */
export async function askAi(prompt: string): Promise<{ ok: boolean; data: string; message?: string }> {
  try {
    const r = await fetch(`${API_BASE}/ai.php?q=${encodeURIComponent(prompt)}`);
    const j = await r.json();
    return { ok: !!j.ok, data: j.data || '', message: j.message };
  } catch (e) {
    return { ok: false, data: '', message: e instanceof Error ? e.message : 'Gagal memanggil AI' };
  }
}

export async function fetchTtsModels(): Promise<TtsModel[]> {
  try {
    const r = await fetch(`${API_BASE}/tts.php?action=models`);
    const j = await r.json();
    return Array.isArray(j.models) ? j.models : [];
  } catch {
    return [];
  }
}

export async function fetchTtsVoices(): Promise<TtsVoice[]> {
  try {
    const r = await fetch(`${API_BASE}/tts.php?action=voices`);
    const j = await r.json();
    return Array.isArray(j.voices) ? j.voices : [];
  } catch {
    return [];
  }
}

export interface TtsRequest {
  text: string;
  voice_id: string;
  model_id: string;
  language_code?: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
}

export async function synthTts(body: TtsRequest): Promise<{ ok: boolean; url?: string; blob?: Blob; message?: string }> {
  try {
    const r = await fetch(`${API_BASE}/tts.php?action=tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('audio')) {
      const blob = await r.blob();
      return { ok: true, blob, url: URL.createObjectURL(blob) };
    }
    const j = await r.json().catch(() => ({}));
    return { ok: false, message: j.message || 'Gagal membuat audio.' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal membuat audio.' };
  }
}

// ===== Kuota download TTS: 7x / minggu per user (reset mingguan) =====
const WEEK_MS = 7 * 24 * 3600 * 1000;
export const TTS_WEEKLY_LIMIT = 7;

interface QuotaData { weekStart: number; used: number }

export function readTtsQuota(userKey: string): { used: number; remaining: number; limit: number } {
  const KEY = `by_tts_quota:${userKey}`;
  let data: QuotaData = { weekStart: Date.now(), used: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch { /* abaikan */ }
  if (Date.now() - data.weekStart > WEEK_MS) data = { weekStart: Date.now(), used: 0 };
  return { used: data.used, remaining: Math.max(0, TTS_WEEKLY_LIMIT - data.used), limit: TTS_WEEKLY_LIMIT };
}

/** Tambah 1 pemakaian kuota; kembalikan sisa kuota. */
export function consumeTtsQuota(userKey: string): number {
  const KEY = `by_tts_quota:${userKey}`;
  let data: QuotaData = { weekStart: Date.now(), used: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch { /* abaikan */ }
  if (Date.now() - data.weekStart > WEEK_MS) data = { weekStart: Date.now(), used: 0 };
  data.used += 1;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* abaikan */ }
  return Math.max(0, TTS_WEEKLY_LIMIT - data.used);
}

/** URL layanan web-SSH (ttyd/wetty/gotty) untuk menu "Coba VPS". Isi nanti. */
export const WEBSSH_URL = '';
