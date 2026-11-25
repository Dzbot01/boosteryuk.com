import { MAIN_API } from '../lib/apiBase';

/**
 * Klien V2Fun (api.v2fun.ai) untuk Playground "Generate 3D Model".
 * SEMUA permintaan lewat proxy PHP `v2fun.php` di backend — API key tidak pernah
 * masuk browser. Alur task-based sesuai dokumen V2Fun:
 *   generate → task_uuid (QUEUED) → polling task → COMPLETED → metadata.downloads[].download_url (GLB).
 */
const API = `${MAIN_API}/v2fun.php`;

export type V2FunTaskStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;

export interface V2FunDownload {
  asset_path: string;
  download_url: string;
  download_expires_at: number;
}

export interface V2FunTask {
  task_uuid: string;
  task_type?: string;
  model?: string;
  status: V2FunTaskStatus;
  created_at?: number;
  completed_at?: number;
  queue_position?: number;
  estimated_queue_time?: number;
  result?: string[];
  metadata?: { downloads?: V2FunDownload[] };
  message?: string;
  error?: string;
}

export interface V2FunGenerateRequest {
  /** Deskripsi teks (Text-to-3D). */
  prompt?: string;
  /** Gambar referensi sebagai data URI base64 (Image-to-3D). */
  image_data?: string;
  /** Tiga sudut foto sebagai data URI (Multi-view-to-3D). */
  input_images?: { front?: string; left?: string; right?: string };
  with_texture?: boolean;
  hd_texture?: boolean;
  pbr_texture?: boolean;
}

export interface V2FunResult<T> {
  ok: boolean;
  task?: T;
  message?: string;
  status?: number;
}

/** Kirim tugas pembuatan model 3D → balik segera dengan task_uuid. */
export async function v2funGenerate(req: V2FunGenerateRequest): Promise<V2FunResult<V2FunTask>> {
  try {
    const r = await fetch(`${API}?action=generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate', ...req }),
    });
    const j = (await r.json().catch(() => null)) as V2FunResult<V2FunTask> | null;
    if (!j) return { ok: false, message: `Respons ${API} bukan JSON (HTTP ${r.status}). Pastikan v2fun.php sudah di-upload.` , status: r.status };
    return { ...j, status: j.status ?? r.status };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghubungi proxy v2fun.php' };
  }
}

/** Polling status tugas + hasil (download URL GLB saat COMPLETED). */
export async function v2funTask(taskUuid: string): Promise<V2FunResult<V2FunTask>> {
  try {
    const r = await fetch(`${API}?action=task&task_uuid=${encodeURIComponent(taskUuid)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'task', task_uuid: taskUuid }),
    });
    const j = (await r.json().catch(() => null)) as V2FunResult<V2FunTask> | null;
    if (!j) return { ok: false, message: `Respons ${API} bukan JSON (HTTP ${r.status}).`, status: r.status };
    return { ...j, status: j.status ?? r.status };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghubungi proxy v2fun.php' };
  }
}

/** Label status task yang ramah ditampilkan di UI. */
export function v2funStatusLabel(status: string): string {
  switch (status) {
    case 'QUEUED': return 'Menunggu antrean…';
    case 'RUNNING': return 'Model sedang dibangun…';
    case 'COMPLETED': return 'Selesai';
    case 'FAILED': return 'Gagal';
    default: return status;
  }
}

/** Ambil URL download GLB pertama dari task yang COMPLETED (bila ada). */
export function v2funGlbUrl(task: V2FunTask): string | null {
  const dl = task.metadata?.downloads?.[0]?.download_url;
  if (dl) return dl;
  const res = task.result?.[0];
  return res && /\.glb/i.test(res) ? res : null;
}
