import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
/** Same bottom-attached, vertically entering sheet format as the bottom-navbar FAQ. */
export default function RewardSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const id = useId();const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault();onClose(); }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]') || []);
      const first = nodes[0];const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { e.preventDefault();last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault();first?.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => { document.body.style.overflow = old;window.removeEventListener('keydown', key);previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/50 backdrop-blur-[3px]" onClick={onClose}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={id} onClick={e => e.stopPropagation()} className="flex max-h-[86vh] w-full max-w-xl animate-slide-up flex-col overflow-hidden rounded-t-3xl border-t border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto mb-2 mt-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><h2 id={id} className="text-lg font-extrabold">{title}</h2><button onClick={onClose} aria-label={`Tutup ${title}`} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800"><X size={18} /></button></header>
      <div className="overflow-y-auto px-5 pb-8 pt-4">{children}</div>
    </section>
  </div>;
}
