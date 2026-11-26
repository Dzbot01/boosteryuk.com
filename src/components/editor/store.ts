import { create } from 'zustand';
import type { Clip, MediaAsset } from './types';
import { uid } from './types';
import { makeThumb } from './mockData';

export type LeftTab = 'Media' | 'Audio' | 'Text' | 'Stickers' | 'Effects' | 'Transition' | 'Filters';
export type RightTab = 'Video' | 'Audio' | 'Speed' | 'Animate' | 'Adjust';

interface EditorState {
  title: string;
  setTitle: (t: string) => void;
  autosave: string;
  stampAutosave: () => void;

  assets: MediaAsset[];
  importFiles: (files: FileList | File[]) => void;
  /** Upload audio (mp3 dll.) dari toolbar timeline → clip di track audio. */
  importAudioFiles: (files: FileList | File[]) => void;
  removeAsset: (id: string) => void;
  /** Media terakhir yang di-import → preview Player otomatis menyesuaikan. */
  previewAssetId: string;
  setPreviewAsset: (id: string) => void;

  clips: Clip[];
  selected: string | null;
  select: (id: string | null) => void;
  addClip: (asset: MediaAsset, at?: number) => void;
  deleteSelected: () => void;
  splitSelected: () => void;
  moveClip: (id: string, start: number) => void;
  trimClip: (id: string, side: 'left' | 'right', delta: number) => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  resetProject: () => void;

  playhead: number;
  setPlayhead: (t: number) => void;
  /** True setelah playhead disentuh user/player; dipakai guard default-tengah. */
  playheadTouched: boolean;
  /** Set posisi default (tengah viewport timeline) hanya selama belum disentuh. */
  setPlayheadDefault: (t: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  zoom: number;
  setZoom: (z: number) => void;
  snapping: boolean;
  toggleSnapping: () => void;

  leftTab: LeftTab;
  setLeftTab: (t: LeftTab) => void;
  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;
  leftW: number;
  setLeftW: (w: number) => void;
  rightW: number;
  setRightW: (w: number) => void;
  tlH: number;
  setTlH: (h: number) => void;

  modal: '' | 'export' | 'shortcut';
  setModal: (m: '' | 'export' | 'shortcut') => void;

  filterName: string;
  filterCss: string;
  filterStrength: number;
  setFilter: (name: string, css: string) => void;
  setFilterStrength: (v: number) => void;
  volume: number;
  setVolume: (v: number) => void;
  speed: number;
  setSpeed: (v: number) => void;
  opacity: number;
  setOpacity: (v: number) => void;
  zoomPct: number;
  setZoomPct: (v: number) => void;
  posX: number;
  posY: number;
  setPos: (x: number, y: number) => void;
  adjust: Record<string, number>;
  setAdjust: (key: string, v: number) => void;

  effects: { id: number; name: string }[];
  removeEffect: (id: number) => void;

  sheet: '' | 'left' | 'right';
  setSheet: (s: '' | 'left' | 'right') => void;
}

/** Proyek selalu mulai KOSONG: tidak ada media/clip tersimpan; user import dulu. */
const EMPTY_ASSETS: MediaAsset[] = [];
const EMPTY_CLIPS: Clip[] = [];

export const useEditor = create<EditorState>((set, get) => ({
  title: 'This is a title',
  setTitle: (t) => set({ title: t }),
  autosave: new Date().toLocaleTimeString('en-GB'),
  stampAutosave: () => set({ autosave: new Date().toLocaleTimeString('en-GB') }),

  assets: EMPTY_ASSETS,
  previewAssetId: '',
  setPreviewAsset: (id) => set({ previewAssetId: id }),
  importFiles: (files) => {
    const added: MediaAsset[] = [];
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : null;
      if (!kind) continue;
      added.push({ id: uid(), name: file.name, kind, url: URL.createObjectURL(file), thumb: kind === 'audio' ? makeThumb('audio') : '', duration: 0 });
    }
    if (added.length === 0) return;
    const s0 = get();
    // Clip dibuat langsung supaya media tampil di Player & Timeline begitu import sukses.
    s0.pushHistory();
    const trackEnd = (tr: 'video' | 'audio') => s0.clips.filter((c) => c.track === tr).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    let vEnd = trackEnd('video');
    let aEnd = trackEnd('audio');
    const newClips: Clip[] = [];
    for (const asset of added) {
      const track: 'video' | 'audio' = asset.kind === 'audio' ? 'audio' : 'video';
      const start = track === 'video' ? vEnd : aEnd;
      const duration = asset.kind === 'image' ? 8 : 0;
      if (track === 'video') vEnd += Math.max(duration, 0.1) || 0.1;
      else aEnd += Math.max(duration, 0.1) || 0.1;
      newClips.push({
        id: uid(),
        track,
        assetId: asset.id,
        name: asset.name,
        start,
        duration: duration || 0.1,
        inPoint: 0,
        thumb: asset.thumb,
        waveform: track === 'audio' ? Array.from({ length: 60 }, (_, i) => 0.25 + Math.abs(Math.sin(i / 3)) * 0.7) : undefined,
        chips: track === 'audio' ? ['Audio', asset.name] : ['Name', asset.name],
        pending: asset.kind !== 'image',
      });
      if (track === 'video') vEnd = newClips[newClips.length - 1].start + newClips[newClips.length - 1].duration;
      else aEnd = newClips[newClips.length - 1].start + newClips[newClips.length - 1].duration;
    }
    set((s) => ({
      assets: [...s.assets, ...added],
      clips: [...s.clips, ...newClips],
      selected: newClips[newClips.length - 1].id,
      previewAssetId: added[0].id,
      playhead: 0,
    }));

    // Durasi & thumbnail dibaca dari elemen media (client-side, tanpa server).
    for (const asset of added) {
      const applyDuration = (dur: number) => {
        set((s) => {
          const track: 'video' | 'audio' = asset.kind === 'audio' ? 'audio' : 'video';
          // Durasi asli masuk → clip diperbarui lalu track dirapikan agar tidak tumpang tindih.
          let next = s.clips.map((c) => (c.assetId === asset.id && c.pending ? { ...c, duration: Math.max(0.1, dur), pending: false } : c));
          let cursor = 0;
          next = next
            .map((c, i) => ({ c, i }))
            .sort((a, b) => a.c.start - b.c.start || a.i - b.i)
            .map(({ c }) => {
              if (c.track !== track) return c;
              const start = Math.max(c.start, cursor);
              cursor = start + c.duration;
              return { ...c, start };
            });
          return {
            assets: s.assets.map((a) => (a.id === asset.id ? { ...a, duration: dur } : a)),
            clips: next,
          };
        });
      };
      if (asset.kind === 'audio') {
        const au = new Audio();
        au.preload = 'metadata';
        au.src = asset.url;
        au.onloadedmetadata = () => applyDuration(au.duration || 0);
        continue;
      }
      const el: HTMLVideoElement | HTMLImageElement = document.createElement(asset.kind === 'video' ? 'video' : 'img');
      if (asset.kind === 'video') (el as HTMLVideoElement).preload = 'metadata';
      el.src = asset.url;
      el.onloadedmetadata = () => {
        const v = el as HTMLVideoElement;
        applyDuration(asset.kind === 'video' ? v.duration || 0 : 8);
        if (asset.kind === 'video') {
          v.currentTime = Math.min(1, (v.duration || 2) / 2);
          v.onseeked = () => {
            const c = document.createElement('canvas');
            c.width = 160;
            c.height = 100;
            const ctx = c.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, 160, 100);
            const dataUrl = c.toDataURL('image/png');
            set((s) => ({
              assets: s.assets.map((a) => (a.id === asset.id ? { ...a, thumb: dataUrl } : a)),
              clips: s.clips.map((cl) => (cl.assetId === asset.id ? { ...cl, thumb: dataUrl } : cl)),
            }));
          };
        } else {
          set((s) => ({
            assets: s.assets.map((a) => (a.id === asset.id ? { ...a, thumb: asset.url } : a)),
            clips: s.clips.map((cl) => (cl.assetId === asset.id ? { ...cl, thumb: asset.url } : cl)),
          }));
        }
      };
    }
  },
  importAudioFiles: (files) => {
    const added: MediaAsset[] = [];
    for (const file of Array.from(files)) {
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
      if (!isAudio) continue;
      added.push({ id: uid(), name: file.name, kind: 'audio', url: URL.createObjectURL(file), thumb: makeThumb('audio'), duration: 0 });
    }
    if (added.length === 0) return;
    const s0 = get();
    s0.pushHistory();
    // Clip audio muncul di track audio (di bawah clip media) mulai dari GARIS playhead.
    let cursor = s0.playhead;
    const newClips: Clip[] = [];
    for (const asset of added) {
      newClips.push({
        id: uid(),
        track: 'audio',
        assetId: asset.id,
        name: asset.name,
        start: cursor,
        duration: 0.1,
        inPoint: 0,
        thumb: asset.thumb,
        waveform: Array.from({ length: 60 }, (_, i) => 0.25 + Math.abs(Math.sin(i / 3)) * 0.7),
        chips: ['Audio', asset.name],
        pending: true,
      });
      cursor = newClips[newClips.length - 1].start + 0.1;
    }
    set((s) => ({
      assets: [...s.assets, ...added],
      clips: [...s.clips, ...newClips],
      selected: newClips[newClips.length - 1].id,
    }));
    for (const asset of added) {
      const au = new Audio();
      au.preload = 'metadata';
      au.src = asset.url;
      au.onloadedmetadata = () => {
        const dur = au.duration || 0;
        if (!dur) return;
        set((s) => ({
          assets: s.assets.map((a) => (a.id === asset.id ? { ...a, duration: dur } : a)),
          clips: s.clips.map((c) => (c.assetId === asset.id && c.pending ? { ...c, duration: Math.max(0.1, dur), pending: false } : c)),
        }));
      };
    }
  },
  removeAsset: (id) =>
    set((s) => {
      const gone = s.assets.find((a) => a.id === id);
      // Object URL file lokal dilepas agar memori tidak bocor setelah media dihapus.
      if (gone?.url.startsWith('blob:')) URL.revokeObjectURL(gone.url);
      // Clip yang memakai media ini ikut dibuang dari timeline (kartu/overlay trimnya
      // tidak boleh tertinggal saat medianya sudah tidak ada).
      const clips = s.clips.filter((c) => c.assetId !== id);
      return {
        assets: s.assets.filter((a) => a.id !== id),
        clips,
        selected: clips.some((c) => c.id === s.selected) ? s.selected : null,
      };
    }),

  clips: EMPTY_CLIPS,
  selected: null,
  select: (id) => set({ selected: id }),
  addClip: (asset, at) => {
    const s = get();
    s.pushHistory();
    const start = at ?? s.clips.filter((c) => c.track === (asset.kind === 'audio' ? 'audio' : 'video')).reduce((m, c) => Math.max(m, c.start + c.duration), 0);
    const clip: Clip = {
      id: uid(),
      track: asset.kind === 'audio' ? 'audio' : 'video',
      assetId: asset.id,
      name: asset.name,
      start,
      duration: asset.duration || 8,
      inPoint: 0,
      thumb: asset.thumb,
      waveform: asset.kind === 'audio' ? Array.from({ length: 60 }, (_, i) => 0.25 + Math.abs(Math.sin(i / 3)) * 0.7) : undefined,
      chips: asset.kind === 'audio' ? ['Audio', asset.name] : ['Name', asset.name],
    };
    set({ clips: [...s.clips, clip], selected: clip.id });
  },
  deleteSelected: () => {
    const s = get();
    if (!s.selected) return;
    s.pushHistory();
    set({ clips: s.clips.filter((c) => c.id !== s.selected), selected: null });
  },
  splitSelected: () => {
    const s = get();
    // Cut mengikuti GARIS playhead: clip terpilih dipakai bila playhead memang di
    // dalamnya; bila tidak (atau tak ada selection), clip di bawah garis yang dipotong.
    const under = s.clips.find((c) => s.playhead >= c.start && s.playhead <= c.start + c.duration);
    let clip = s.clips.find((c) => c.id === s.selected);
    if (!clip || s.playhead < clip.start || s.playhead > clip.start + clip.duration) clip = under ?? clip;
    if (!clip) return;
    const t = s.playhead - clip.start;
    if (t <= 0.2 || t >= clip.duration - 0.2) return;
    s.pushHistory();
    const right: Clip = { ...clip, id: uid(), start: clip.start + t, duration: clip.duration - t, inPoint: clip.inPoint + t, chips: [...clip.chips] };
    set({ clips: [...s.clips.map((c) => (c.id === clip.id ? { ...c, duration: t } : c)), right], selected: clip.id });
  },
  moveClip: (id, start) => set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, start: Math.max(0, start) } : c)) })),
  trimClip: (id, side, delta) =>
    set((s) => ({
      clips: s.clips.map((c) => {
        if (c.id !== id) return c;
        if (side === 'left') {
          const d = Math.min(Math.max(delta, -c.inPoint), c.duration - 1);
          return { ...c, start: c.start + d, duration: c.duration - d, inPoint: c.inPoint + d };
        }
        return { ...c, duration: Math.max(1, c.duration + delta) };
      }),
    })),
  undo: () => set((s) => {
    const prev = historyStack.pop();
    if (!prev) return {};
    redoStack.push(s.clips);
    return { clips: prev, selected: null };
  }),
  redo: () => set((s) => {
    const next = redoStack.pop();
    if (!next) return {};
    historyStack.push(s.clips);
    return { clips: next, selected: null };
  }),
  pushHistory: () => {
    historyStack.push(get().clips);
    if (historyStack.length > 50) historyStack.shift();
  },
  resetProject: () => {
    historyStack.length = 0;
    redoStack.length = 0;
    set({ assets: [], clips: [], selected: null, playhead: 0, playheadTouched: false, previewAssetId: '', title: 'This is a title', playing: false });
  },

  playhead: 3.2,
  playheadTouched: false,
  setPlayhead: (t) => set({ playhead: Math.max(0, t), playheadTouched: true }),
  setPlayheadDefault: (t) => set((s) => (s.playheadTouched ? {} : { playhead: Math.max(0, t) })),
  playing: false,
  setPlaying: (p) => set({ playing: p }),
  zoom: 42,
  setZoom: (z) => set({ zoom: Math.min(160, Math.max(8, z)) }),
  snapping: true,
  toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),

  leftTab: 'Media',
  setLeftTab: (t) => set({ leftTab: t }),
  rightTab: 'Video',
  setRightTab: (t) => set({ rightTab: t }),
  leftW: 320,
  setLeftW: (w) => set({ leftW: Math.min(480, Math.max(240, w)) }),
  rightW: 300,
  setRightW: (w) => set({ rightW: Math.min(420, Math.max(240, w)) }),
  tlH: 0,
  setTlH: (h) => set({ tlH: Math.min(560, Math.max(180, h)) }),

  modal: '',
  setModal: (m) => set({ modal: m }),

  filterName: '90s',
  filterCss: 'sepia(.5) contrast(1.1) saturate(.8)',
  filterStrength: 50,
  setFilter: (name, css) => set({ filterName: name, filterCss: css }),
  setFilterStrength: (v) => set({ filterStrength: v }),
  volume: 80,
  setVolume: (v) => set({ volume: v }),
  speed: 1,
  setSpeed: (v) => set({ speed: v }),
  opacity: 100,
  setOpacity: (v) => set({ opacity: v }),
  zoomPct: 50,
  setZoomPct: (v) => set({ zoomPct: v }),
  posX: 0,
  posY: 0,
  setPos: (x, y) => set({ posX: x, posY: y }),
  adjust: { Brightness: 0, Contrast: 0, Saturation: 0, Sharpness: 0, Highlight: 0, Shadow: 0, Temperature: 0, Tint: 0 },
  setAdjust: (key, v) => set((s) => ({ adjust: { ...s.adjust, [key]: v } })),

  effects: [{ id: 1, name: 'Motion Blur' }],
  removeEffect: (id) => set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),

  sheet: '',
  setSheet: (sh) => set({ sheet: sh }),
}));

const historyStack: Clip[][] = [];
const redoStack: Clip[][] = [];

/** Ujung clip paling akhir; 0 saat proyek masih kosong. */
export const projectEnd = (clips: Clip[]) => (clips.length ? Math.max(...clips.map((c) => c.start + c.duration)) : 0);

/** Lebar area kerja timeline (ruler) — lega untuk menaruh clip baru. */
export const timelineEnd = (clips: Clip[]) => Math.max(60, projectEnd(clips) + 10);

/** CSS filter gabungan dari tab Adjust + Filters (strength). */
export function previewFilter(s: { adjust: Record<string, number>; filterCss: string; filterStrength: number }) {
  const a = s.adjust;
  const parts = [
    `brightness(${(100 + a.Brightness) / 100})`,
    `contrast(${(100 + a.Contrast) / 100})`,
    `saturate(${(100 + a.Saturation) / 100})`,
  ];
  if (s.filterStrength > 0 && s.filterCss) parts.push(s.filterCss);
  return parts.join(' ');
}
