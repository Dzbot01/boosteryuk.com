/** Tipe data bersama Editor Studio (gaya CapCut Desktop). */
export type MediaKind = 'video' | 'audio' | 'image';

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaKind;
  /** Object URL untuk file lokal; string kosong untuk mock. */
  url: string;
  /** dataURL thumbnail (di-generate client-side). */
  thumb: string;
  duration: number;
  mock?: boolean;
  vertical?: boolean;
}

export interface Clip {
  id: string;
  track: 'video' | 'audio';
  assetId?: string;
  name: string;
  /** Posisi mulai di timeline (detik). */
  start: number;
  duration: number;
  inPoint: number;
  thumb?: string;
  waveform?: number[];
  chips: string[];
  mock?: boolean;
}

export interface MockCard {
  id: string;
  name: string;
  category: string;
  /** CSS filter untuk kartu preview Filters. */
  css?: string;
  emoji?: string;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const tc = (sec: number, frames = 25) => {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const f = Math.floor((s % 1) * frames);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(ss)}:${p(f)}`;
};

export const tcShort = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
