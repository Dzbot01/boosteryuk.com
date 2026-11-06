import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { GripHorizontal } from 'lucide-react';

/**
 * Horizontal slider that is dragged/swiped directly (mouse drag + touch swipe).
 * No next/prev buttons — the user grabs the track and pulls it.
 */
export default function DragScroller({
  children,
  hint,
  className = '',
}: {
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 });
  const [dragging, setDragging] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const syncEdges = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    syncEdges();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', syncEdges, { passive: true });
    window.addEventListener('resize', syncEdges);
    return () => {
      el.removeEventListener('scroll', syncEdges);
      window.removeEventListener('resize', syncEdges);
    };
  }, [syncEdges]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    if (event.pointerType === 'touch') {
      // native touch swiping — only reset the click-guard distance
      drag.current = { active: false, startX: 0, startScroll: 0, moved: 0 };
      return;
    }
    event.preventDefault();
    drag.current = { active: true, startX: event.clientX, startScroll: el.scrollLeft, moved: 0 };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const el = ref.current;
    if (!el) return;
    const dx = event.clientX - drag.current.startX;
    drag.current.moved = Math.abs(dx);
    el.scrollLeft = drag.current.startScroll - dx;
  };

  const endDrag = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(event) => {
          if (drag.current.moved > 6) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className={`no-scrollbar drag-live flex cursor-grab gap-3 overflow-x-auto overscroll-x-contain px-0.5 py-1.5 ${
          dragging ? 'cursor-grabbing select-none' : ''
        } ${className}`}
      >
        {children}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400 dark:text-slate-400">
          <GripHorizontal className="h-3.5 w-3.5" strokeWidth={2.4} />
          {hint ?? 'Geser / drag untuk melihat pilihan lain'}
        </span>
        <span className="flex items-center gap-1">
          <span className={`h-1 w-6 rounded-full transition-colors ${atStart ? 'bg-slate-200' : 'bg-cyan-400'}`} />
          <span className={`h-1 w-6 rounded-full transition-colors ${atEnd ? 'bg-slate-200' : 'bg-cyan-400'}`} />
        </span>
      </div>

      {/* soft edge fades */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent transition-opacity ${
          atStart ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent transition-opacity ${
          atEnd ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  );
}
