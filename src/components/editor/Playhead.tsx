import { timelineEnd, useEditor } from './store';
import { C } from './ui';
import { tc } from './types';

/**
 * Playhead putih penuh tinggi + handle pentagon di ruler.
 * Drag mengikuti gerakan pointer 1:1 (delta pixel / zoom) + snap ke tepi clip,
 * bukan lompat ke posisi klik.
 */
export default function Playhead() {
  const { clips, playhead, setPlayhead, zoom, snapping } = useEditor();
  const end = timelineEnd(clips);

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startT = playhead;
    const move = (ev: PointerEvent) => {
      let t = Math.max(0, Math.min(end, startT + (ev.clientX - startX) / zoom));
      if (snapping) {
        for (const c of clips) {
          for (const edge of [c.start, c.start + c.duration]) if (Math.abs(edge - t) * zoom < 7) { t = edge; break; }
        }
      }
      setPlayhead(t);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 h-full" style={{ transform: `translateX(${playhead * zoom}px)` }}>
      {/* Handle pentagon */}
      <span
        role="presentation"
        onPointerDown={onDown}
        className="pointer-events-auto absolute -left-[7px] -top-[1px] cursor-ew-resize"
        style={{ width: 14, height: 16, touchAction: 'none' }}
      >
        <svg viewBox="0 0 14 16" width="14" height="16" aria-hidden>
          <path d="M0 0h14v9L7 16 0 9z" fill="#ffffff" />
        </svg>
      </span>
      {/* Garis */}
      <span className="absolute left-[6px] top-0 h-full w-[2px]" style={{ background: '#ffffff' }} />
      {/* Badge waktu */}
      <span className="absolute left-[12px] top-0 rounded-[4px] px-1 py-[1px] font-mono text-[9px] font-bold" style={{ background: C.accent, color: '#06282c' }}>
        {tc(playhead)}
      </span>
    </div>
  );
}
