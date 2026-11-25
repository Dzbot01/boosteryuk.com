import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useEditor } from './store';
import { SHORTCUTS } from './mockData';
import { C } from './ui';

export default function ShortcutModal() {
  const { modal, setModal } = useEditor();
  useEffect(() => {
    if (modal !== 'shortcut') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, setModal]);
  if (modal !== 'shortcut') return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Shortcut">
      <div className="w-full max-w-[360px] max-h-[90vh] overflow-y-auto ed-scroll rounded-[6px] border shadow-2xl" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: C.border }}>
          <h3 className="text-[13px] font-bold" style={{ color: C.text }}>Shortcut</h3>
          <button type="button" aria-label="Tutup dialog shortcut" onClick={() => setModal('')} style={{ color: C.text2 }}>
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 py-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between py-1.5">
              <span className="text-[12px]" style={{ color: C.text2 }}>{s.action}</span>
              <kbd className="rounded-[4px] px-2 py-0.5 text-[11px] font-bold" style={{ background: C.raised, color: C.text, boxShadow: `inset 0 0 0 1px ${C.border}` }}>
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t px-4 py-3" style={{ borderColor: C.border }}>
          <button type="button" onClick={() => setModal('')} className="rounded-[4px] px-3 py-1.5 text-[12px] font-bold" style={{ background: C.accent, color: '#06282c' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
