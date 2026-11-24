import { useRef } from 'react';
import { useEditor } from './store';
import { C } from './ui';
import { tc } from './types';

/** Playhead putih penuh tinggi + handle pentagon di ruler; draggable & snap ke tepi clip. */
export default function Playhead({ seek }: { seek: (clientX: number, snap: boolean) => void }) {
  const { clips, playhead, zoom, snapping } = useEditor();
  const dragging = useRef(false);

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    const move = (ev: PointerEvent) => seek(ev.clientX, true);
    const up = () => {
      dragging.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const snapPreview = () => {
    if (!snapping) return playhead;
    for (const c of clips) {
      for (const e of [c.start, c.start + c.duration]) if (Math.abs(e - playhead) * zoom < 7) return e;
    }
    return playhead;
  };

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 h-full" style={{ transform: `translateX(${snapPreview() * zoom}px)` }}>
      {/* Handle pentagon */}
      <span
        role="presentation"
        onPointerDown={onDown}
        className="pointer-events-auto absolute -left-[7px] -top-[1px] cursor-ew-resize"
        style={{ width: 14, height: 16 }}
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
