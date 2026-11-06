import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * =============================================================
 *  MODAL BOTTOM SHEET — layar floating dari bawah
 * -------------------------------------------------------------
 *  • Muncul dari bawah dengan animasi sheet-up.
 *  • Dapat diseret ke bawah (drag handle / swipe) untuk menutup.
 *    - Drag ke bawah >= 80px → menutup
 *    - Di bawah itu → kembali ke posisi semula
 *  • Klik backdrop juga menutup.
 *  • Dipakai untuk "Pilih Negara" dan "Pilih Server".
 * =============================================================
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const [dragY, setDragY] = useState(0);
  const drag = useRef({ active: false, startY: 0, dy: 0 });

  // Reset offset setiap kali dibuka / ditutup
  useEffect(() => {
    if (open) setDragY(0);
  }, [open ]);

  // Kunci scroll body saat sheet terbuka
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      drag.current = { active: true, startY: e.clientY, dy: 0 };
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { active: true, startY: e.clientY, dy: 0 };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active || e.pointerType === 'touch') return;
    const dy = e.clientY - drag.current.startY;
    drag.current.dy = dy;
    setDragY(Math.max(0, dy));
  }, []);

  const endPointerDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag.current.active || e.pointerType === 'touch') return;
      drag.current.active = false;
      if (drag.current.dy >= 80) onClose();
      else setDragY(0);
    },
    [onClose],
  );

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    drag.current = { active: true, startY: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const dy = e.touches[0].clientY - drag.current.startY;
    drag.current.dy = dy;
    setDragY(Math.max(0, dy));
  };
  const onTouchEnd = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (drag.current.dy >= 80) onClose();
    else setDragY(0);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel sheet */}
      <div
        className="animate-sheet-up relative flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-[0_-18px_60px_-18px_rgba(15,23,42,0.5)] dark:bg-slate-900"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined }}
      >
        {/* MODAL HANDLE — area tarik untuk menutup */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointerDrag}
          onPointerCancel={endPointerDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="cursor-grab touch-none select-none pt-2.5 active:cursor-grabbing"
          role="separator"
          aria-label="Tarik ke bawah untuk menutup"
        >
          <div className="mx-auto h-1.5 w-11 rounded-full bg-slate-300" />
          <div className="px-5 pb-3 pt-3 text-left">
            <h3 className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h3>
            {subtitle ? (
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
            ) : null}
          </div>
          <div className="mx-5 h-px bg-slate-100 dark:bg-slate-800" />
        </div>

        {/* MODAL BODY — konten scrollable */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
