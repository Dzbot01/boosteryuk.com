// Klien "Pengaturan Database" (php-api/data_retention.php) — pembersihan rutin riwayat user.
// Semua aksi wajib token admin; server menolak bila role bukan admin.
import { MAIN_API } from '../lib/apiBase';

const API = `${MAIN_API}/data_retention.php`;

const token = () => {
  try {
    return localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T & { ok: boolean; message?: string }> {
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ token: token(), action, ...body }),
    });
    const j = await r.json().catch(() => null);
    return j || ({ ok: false, message: `Server membalas HTTP ${r.status}.` } as T & { ok: boolean; message?: string });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Gagal menghubungi server.' } as T & { ok: boolean; message?: string };
  }
}

export type RetentionKind = 'yearly' | 'monthly';

/** Satu tabel yang dibersihkan + jumlah baris yang akan terhapus bila jadwal jalan sekarang. */
export interface RetentionTarget {
  table: string;
  label: string;
  exists: boolean;
  pending: number | null;
}

/** Catatan satu kali pembersihan. */
export interface RetentionRun {
  kind?: RetentionKind;
  period_key: string;
  deleted_total: number;
  deleted: Record<string, number>;
  triggered_by: string;
  ran_at: string;
}

export interface RetentionSchedule {
  label: string;
  keeps: string;
  period_key: string;
  done_this_period: boolean;
  /** Epoch detik (WIB) perkiraan pembersihan otomatis berikutnya. */
  next_run_at: number;
  last_run: RetentionRun | null;
  targets: RetentionTarget[];
}

export interface RetentionStatus {
  schedules: Record<RetentionKind, RetentionSchedule>;
  history: RetentionRun[];
  server_time: string;
}

export const dataRetentionApi = {
  /** Jadwal + riwayat pembersihan; sekaligus menjalankan jadwal yang sudah jatuh tempo. */
  status: () => call<{ status?: RetentionStatus }>('status'),
  /** Jalankan sekarang (manual, dicatat sebagai baris manual). */
  run: (kind: RetentionKind) => call<{ status?: RetentionStatus; result?: { deleted_total: number; deleted: Record<string, number> } }>('run', { kind }),
};
