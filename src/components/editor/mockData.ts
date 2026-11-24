import type { MockCard } from './types';

/** Thumbnail placeholder digambar via canvas (client-side, tanpa aset eksternal). */
export type ThumbKind = 'mountain' | 'ocean' | 'lake' | 'forest' | 'audio' | 'blank';

export function makeThumb(kind: ThumbKind, vertical = false): string {
  if (typeof document === 'undefined') return '';
  const w = 160;
  const h = 100;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  if (!x) return '';
  const grad = (a: string, b: string) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  };
  if (kind === 'mountain') {
    grad('#7ec8e3', '#e8f4f8');
    x.fillStyle = '#4b6584';
    x.beginPath(); x.moveTo(0, h); x.lineTo(45, 30); x.lineTo(85, h); x.closePath(); x.fill();
    x.fillStyle = '#778ca3';
    x.beginPath(); x.moveTo(60, h); x.lineTo(110, 42); x.lineTo(160, h); x.closePath(); x.fill();
    x.fillStyle = '#f5f6fa';
    x.beginPath(); x.moveTo(38, 40); x.lineTo(45, 30); x.lineTo(53, 40); x.closePath(); x.fill();
  } else if (kind === 'ocean') {
    x.fillStyle = '#000';
    x.fillRect(0, 0, w, h);
    const g = x.createLinearGradient(45, 0, 115, 0);
    g.addColorStop(0, '#0a3d62'); g.addColorStop(1, '#3c9bd6');
    x.fillStyle = g;
    x.fillRect(45, 0, 70, h);
    x.fillStyle = '#c7ecee';
    x.fillRect(45, 62, 70, 6);
  } else if (kind === 'lake') {
    grad('#a8d8ea', '#2b6777');
    x.fillStyle = '#5e8b9e';
    x.fillRect(0, 58, w, 42);
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.fillRect(0, 58, w, 3);
  } else if (kind === 'forest') {
    grad('#9ba7ad', '#5d6d7e');
    x.fillStyle = 'rgba(40,60,60,.55)';
    for (let i = 0; i < 7; i++) {
      const tx = 10 + i * 22;
      x.beginPath(); x.moveTo(tx, h); x.lineTo(tx + 8, 30 + (i % 3) * 8); x.lineTo(tx + 16, h); x.closePath(); x.fill();
    }
    x.fillStyle = 'rgba(255,255,255,.25)';
    x.fillRect(0, 40, w, 14);
  } else if (kind === 'audio') {
    grad('#10131a', '#1b3a63');
    x.strokeStyle = '#7fb3ff';
    x.lineWidth = 2;
    x.beginPath();
    for (let i = 0; i < w; i += 4) x.lineTo(i, h / 2 + Math.sin(i / 7) * 18 * Math.sin(i / 31));
    x.stroke();
  } else {
    grad('#232327', '#1a1a1d');
  }
  if (vertical) {
    x.fillStyle = '#000';
    x.fillRect(0, 0, 45, h);
    x.fillRect(115, 0, 45, h);
  }
  return c.toDataURL('image/png');
}

export const AUDIO_CATEGORIES = ['Music', 'Sound effects', 'Voiceover', 'Extracted'];

export const TEXT_STYLES: MockCard[] = [
  { id: 't1', name: 'Default text', category: 'Add text' },
  { id: 't2', name: 'Bold title', category: 'Add text' },
  { id: 't3', name: 'Neon', category: 'Effects' },
  { id: 't4', name: 'Outline', category: 'Effects' },
  { id: 't5', name: 'Gradient', category: 'Templates' },
  { id: 't6', name: 'Subtitle', category: 'Auto captions' },
];
export const TEXT_CATEGORIES = ['Add text', 'Effects', 'Templates', 'Auto captions'];

export const STICKERS: MockCard[] = [
  { id: 's1', name: 'Senyum', category: 'Emoji', emoji: '😄' },
  { id: 's2', name: 'Api', category: 'Emoji', emoji: '🔥' },
  { id: 's3', name: 'Hati', category: 'Emoji', emoji: '💜' },
  { id: 's4', name: 'Kilat', category: 'Shape', emoji: '⚡' },
  { id: 's5', name: 'Bintang', category: 'Shape', emoji: '⭐' },
  { id: 's6', name: 'Panah', category: 'Shape', emoji: '➜' },
  { id: 's7', name: 'Musik', category: 'Musik', emoji: '🎵' },
  { id: 's8', name: 'Kamera', category: 'Musik', emoji: '🎬' },
];
export const STICKER_CHIPS = ['Emoji', 'Shape', 'Musik', 'Baru'];

export const EFFECTS: MockCard[] = [
  { id: 'e1', name: 'Motion Blur', category: 'Trending' },
  { id: 'e2', name: 'Glitch Cut', category: 'Glitch' },
  { id: 'e3', name: 'VHS Tape', category: 'Retro' },
  { id: 'e4', name: 'Soft Blur', category: 'Blur' },
  { id: 'e5', name: 'Lens Flare', category: 'Light' },
  { id: 'e6', name: 'Shake', category: 'Basic' },
];
export const EFFECT_CATEGORIES = ['Trending', 'Basic', 'Retro', 'Glitch', 'Blur', 'Light'];

export const TRANSITIONS: MockCard[] = [
  { id: 'tr1', name: 'Fade Black', category: 'Overlay' },
  { id: 'tr2', name: 'Slide Left', category: 'Slide' },
  { id: 'tr3', name: 'Whip Pan', category: 'Slide' },
  { id: 'tr4', name: 'Zoom In', category: 'Zoom' },
  { id: 'tr5', name: 'Dissolve', category: 'Overlay' },
  { id: 'tr6', name: 'Wipe Line', category: 'Wipe' },
];
export const TRANSITION_CATEGORIES = ['Overlay', 'Slide', 'Zoom', 'Wipe'];

export const FILTERS: MockCard[] = [
  { id: 'f1', name: '90s', category: 'Featured', css: 'sepia(.5) contrast(1.1) saturate(.8)' },
  { id: 'f2', name: 'Vivid', category: 'Life', css: 'saturate(1.6) contrast(1.15)' },
  { id: 'f3', name: 'Noir', category: 'Black & White', css: 'grayscale(1) contrast(1.3)' },
  { id: 'f4', name: 'Cinema', category: 'Cinematic', css: 'contrast(1.2) saturate(.85) hue-rotate(-8deg)' },
  { id: 'f5', name: 'Film Grain', category: 'Film', css: 'sepia(.25) contrast(.95) brightness(1.05)' },
  { id: 'f6', name: 'Cool Life', category: 'Life', css: 'hue-rotate(12deg) saturate(1.2)' },
];
export const FILTER_CATEGORIES = ['Featured', 'Life', 'Cinematic', 'Film', 'Black & White'];

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space', action: 'Play / Pause' },
  { keys: 'Ctrl + Z', action: 'Undo' },
  { keys: 'Ctrl + Y', action: 'Redo' },
  { keys: 'S', action: 'Split clip di playhead' },
  { keys: 'Delete', action: 'Hapus clip terpilih' },
  { keys: 'Ctrl + Scroll', action: 'Zoom timeline' },
];
