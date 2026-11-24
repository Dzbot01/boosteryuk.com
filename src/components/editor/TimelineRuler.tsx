import { useMemo } from 'react';
import { timelineEnd, useEditor } from './store';
import { C } from './ui';
import { tcShort } from './types';

/** Ruler waktu: label tiap 10 detik + tick minor, klik untuk memindah playhead. */
export default function TimelineRuler({ width, seek }: { width: number; seek: (clientX: number, snap: boolean) => void }) {
  const { clips, zoom, setZoom } = useEditor();
  const end = useMemo(() => timelineEnd(clips), [clips]);
  // Interval label menyesuaikan zoom agar tidak bertumpuk.
  const step = zoom > 70 ? 5 : zoom > 30 ? 10 : zoom > 15 ? 20 : 40;
  const marks = [];
  for (let t = 0; t <= end; t += step) marks.push(t);

  return (
    <div
      className="relative h-6 shrink-0 cursor-pointer select-none border-b"
      style={{ width, borderColor: C.border }}
      onClick={(e) => seek(e.clientX, false)}
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
