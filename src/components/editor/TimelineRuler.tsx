import { useMemo } from 'react';
import { timelineEnd, useEditor } from './store';
import { C } from './ui';
import { tcShort } from './types';

/**
 * Ruler waktu: label tiap 10 detik + tick minor.
 * Scrub = tekan-tahan lalu GESER: playhead mengikuti gerakan pointer 1:1
 * (delta pixel / zoom), bukan lompat otomatis saat diklik.
 */
export default function TimelineRuler({ width }: { width: number }) {
  const { clips, zoom, setZoom, playhead, setPlayhead, snapping } = useEditor();
  const end = useMemo(() => timelineEnd(clips), [clips]);
  // Interval label menyesuaikan zoom agar tidak bertumpuk.
  const step = zoom > 70 ? 5 : zoom > 30 ? 10 : zoom > 15 ? 20 : 40;
  const marks = [];
  for (let t = 0; t <= end; t += step) marks.push(t);

  const snapTo = (t: number) => {
    if (!snapping) return t;
    for (const c of clips) {
      for (const e of [c.start, c.start + c.duration]) if (Math.abs(e - t) * zoom < 7) return e;
    }
    return t;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startT = playhead;
    const move = (ev: PointerEvent) => {
      const t = Math.max(0, Math.min(end, startT + (ev.clientX - startX) / zoom));
      setPlayhead(snapTo(t));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      className="relative h-6 shrink-0 cursor-ew-resize select-none border-b"
      style={{ width, borderColor: C.border, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onWheel={(e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          setZoom(zoom + (e.deltaY < 0 ? 6 : -6));
        }
      }}
    >
      {marks.map((t) => (
        <span key={t} className="absolute top-0 flex h-full flex-col items-start" style={{ left: t * zoom }}>
          <span className="text-[10px] leading-[14px]" style={{ color: C.text3 }}>{tcShort(t)}</span>
          <span className="w-px" style={{ height: 6, background: C.scroll }} />
        </span>
      ))}
      {Array.from({ length: Math.ceil(end / (step / 5)) }, (_, i) => (i + 1) * (step / 5)).map((t) => (
        <span key={`m${t}`} className="absolute bottom-0 w-px" style={{ left: t * zoom, height: 4, background: C.border }} />
      ))}
    </div>
  );
}
