import { create } from 'zustand';
import type { Clip, MediaAsset } from './types';
import { uid } from './types';
import { makeThumb, seedAssets } from './mockData';

export type LeftTab = 'Media' | 'Audio' | 'Text' | 'Stickers' | 'Effects' | 'Transition' | 'Filters';
export type RightTab = 'Video' | 'Audio' | 'Speed' | 'Animate' | 'Adjust';

interface EditorState {
  title: string;
  setTitle: (t: string) => void;
  autosave: string;
  stampAutosave: () => void;

  assets: MediaAsset[];
  importFiles: (files: FileList | File[]) => void;
  removeAsset: (id: string) => void;

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

const seedClips = (assets: MediaAsset[]): Clip[] => {
  const video = assets[2];
  const wave = Array.from({ length: 60 }, (_, i) => 0.25 + Math.abs(Math.sin(i / 4)) * 0.7);
  return [
    {
      id: uid(),
      track: 'video',
      assetId: video.id,
      name: video.name,
      start: 0,
      duration: 20,
      inPoint: 0,
      thumb: video.thumb,
      chips: ['Effects - Edit', 'Filters', 'Adjust', video.name, '00:00:00'],
      mock: true,
    },
    {
      id: uid(),
      track: 'audio',
      name: 'Audio.aac',
      start: 4,
      duration: 10,
      inPoint: 0,
      waveform: wave,
      chips: ['Speed 2.0x', 'Audio.aac', '00:00:00'],
      mock: true,
    },
  ];
};

const initialAssets = typeof document === 'undefined' ? [] : seedAssets();

export const useEditor = create<EditorState>((set, get) => ({
  title: 'This is a title',
  setTitle: (t) => set({ title: t }),
  autosave: new Date().toLocaleTimeString('en-GB'),
  stampAutosave: () => set({ autosave: new Date().toLocaleTimeString('en-GB') }),

  assets: initialAssets,
  importFiles: (files) => {
    const added: MediaAsset[] = [];
    for (const file of Array.from(files)) {
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('image/') ? 'image' : null;
      if (!kind) continue;
      added.push({ id: uid(), name: file.name, kind, url: URL.createObjectURL(file), thumb: kind === 'audio' ? makeThumb('audio') : '', duration: 0 });
    }
    if (added.length === 0) return;
    // Durasi & thumbnail dibaca dari elemen media (client-side).
    for (const asset of added) {
      if (asset.kind === 'audio') continue;
      const el: HTMLVideoElement | HTMLImageElement = document.createElement(asset.kind === 'video' ? 'video' : 'img');
      if (asset.kind === 'video') (el as HTMLVideoElement).preload = 'metadata';
      el.src = asset.url;
      el.onloadedmetadata = () => {
        const v = el as HTMLVideoElement;
        set((s) => ({ assets: s.assets.map((a) => (a.id === asset.id ? { ...a, duration: v.duration || 0 } : a)) }));
        if (asset.kind === 'video') {
          v.currentTime = Math.min(1, (v.duration || 2) / 2);
          v.onseeked = () => {
            const c = document.createElement('canvas');
            c.width = 160;
            c.height = 100;
            const ctx = c.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(v, 0, 0, 160, 100);
            set((s) => ({ assets: s.assets.map((a) => (a.id === asset.id ? { ...a, thumb: c.toDataURL('image/png') } : a)) }));
          };
        } else {
          set((s) => ({ assets: s.assets.map((a) => (a.id === asset.id ? { ...a, thumb: asset.url } : a)) }));
        }
      };
    }
    set((s) => ({ assets: [...s.assets, ...added] }));
  },
  removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),

  clips: typeof document === 'undefined' ? [] : seedClips(initialAssets),
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
    const clip = s.clips.find((c) => c.id === s.selected);
    if (!clip) return;
    const t = s.playhead - clip.start;
    if (t <= 0.2 || t >= clip.duration - 0.2) return;
    s.pushHistory();
    const right: Clip = { ...clip, id: uid(), start: clip.start + t, duration: clip.duration - t, inPoint: clip.inPoint + t, chips: [...clip.chips] };
    set({ clips: [...s.clips.map((c) => (c.id === clip.id ? { ...c, duration: t } : c)), right] });
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
    const assets = seedAssets();
    historyStack.length = 0;
    redoStack.length = 0;
    set({ assets, clips: seedClips(assets), selected: null, playhead: 0, title: 'This is a title' });
  },

  playhead: 3.2,
  setPlayhead: (t) => set({ playhead: Math.max(0, t) }),
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

/** Panjang timeline = ujung clip paling akhir (min 30 dtk agar ruler lega). */
export const timelineEnd = (clips: Clip[]) => Math.max(200, ...clips.map((c) => c.start + c.duration));

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
