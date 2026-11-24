import { useRef } from 'react';
import { useEditor } from './store';
import type { Clip as ClipType } from './types';
import { C } from './ui';
import { tcShort } from './types';

/** Clip di timeline: drag horizontal, trim dua sisi, klik pilih. */
export default function TimelineClip({ clip, zoom }: { clip: ClipType; zoom: number }) {
  const { selected, select, moveClip, trimClip, pushHistory, snapping, clips } = useEditor();
  const on = selected === clip.id;
  const video = clip.track === 'video';
  const dragRef = useRef<{ mode: 'move' | 'left' | 'right'; startX: number; origin: number } | null>(null);

  const snapTo = (t: number) => {
    if (!snapping) return t;
    const edges = new Set<number>([0]);
    for (const c of clips) { edges.add(c.start); edges.add(c.start + c.duration); }
    for (const e of edges) if (Math.abs(e - t) * zoom < 7) return e;
    return t;
  };

  const begin = (mode: 'move' | 'left' | 'right') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    pushHistory();
    select(clip.id);
    dragRef.current = { mode, startX: e.clientX, origin: clip.start };
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const deltaSec = (ev.clientX - d.startX) / zoom;
      if (d.mode === 'move') moveClip(clip.id, snapTo(d.origin + deltaSec));
      else trimClip(clip.id, d.mode, deltaSec);
    };
    const up = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const thumbW = video ? Math.round(zoom * 2) : 0;
  const repeats = video ? Math.max(1, Math.ceil((clip.duration * zoom) / Math.max(40, thumbW))) : 1;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Clip ${clip.name}`}
      onPointerDown={begin('move')}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') select(clip.id); }}
      className="absolute top-1/2 flex -translate-y-1/2 cursor-grab select-none flex-col overflow-hidden rounded-[6px] active:cursor-grabbing"
      style={{
        left: clip.start * zoom,
        width: Math.max(24, clip.duration * zoom),
        height: video ? '78%' : '74%',
        background: video ? 'linear-gradient(180deg,#1d6f7a,#12454d)' : '#1b3a63',
        boxShadow: on ? `0 0 0 2px ${C.text}` : `inset 0 0 0 1px ${C.border}`,
        transition: dragRef.current ? 'none' : 'box-shadow 120ms',
      }}
    >
      {/* Chips */}
      <div className="flex shrink-0 items-center gap-1 overflow-hidden px-1 pt-1">
        {clip.chips.slice(0, 4).map((c, i) => (
          <span key={`${c}-${i}`} className="truncate rounded-[999px] px-1.5 py-[1px] text-[9px] font-bold" style={{ background: video ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.14)', color: C.text }}>
            <span className="mr-0.5" aria-hidden>◧</span>{c}
          </span>
        ))}
      </div>
      {/* Isi: filmstrip atau waveform */}
      {video ? (
        <div className="flex min-h-0 flex-1 items-stretch overflow-hidden px-0.5 pb-0.5">
          {Array.from({ length: repeats }, (_, i) => (
            <span key={i} className="h-full flex-1 overflow-hidden rounded-[3px] bg-black/25" style={{ minWidth: 0 }}>
              {clip.thumb && <img src={clip.thumb} alt="" className="h-full w-full object-cover opacity-90" draggable={false} />}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center gap-[2px] overflow-hidden px-1 pb-1" aria-hidden>
          {(clip.waveform || []).map((w, i) => (
            <span key={i} className="flex-1 rounded-full" style={{ height: `${Math.max(12, w * 100)}%`, background: '#7fb3ff', opacity: 0.85 }} />
          ))}
        </div>
      )}
      <span className="shrink-0 truncate px-1.5 pb-1 text-[9.5px]" style={{ color: 'rgba(255,255,255,.85)' }}>
        {tcShort(clip.duration)}
      </span>

      {/* Trim handles */}
      {on && (
        <>
          <span
            role="presentation"
            onPointerDown={begin('left')}
            className="absolute left-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-center rounded-l-[6px]"
            style={{ background: 'rgba(255,255,255,.9)' }}
          >
            <span className="h-4 w-px bg-black/60" />
          </span>
          <span
            role="presentation"
            onPointerDown={begin('right')}
            className="absolute right-0 top-0 flex h-full w-2.5 cursor-ew-resize items-center justify-center rounded-r-[6px]"
            style={{ background: 'rgba(255,255,255,.9)' }}
          >
            <span className="h-4 w-px bg-black/60" />
          </span>
        </>
      )}
    </div>
  );
}
