import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clapperboard, Keyboard, LayoutTemplate, Minus, Square, Upload, X } from 'lucide-react';
import { useEditor } from './store';
import { C, IconBtn } from './ui';

const MENU_ITEMS = ['New project', 'Open project', 'Save', 'Save as', 'Export', 'Settings', 'Shortcuts'];
const LAYOUTS = ['Default', 'Wide player', 'Focus timeline'];

export default function TopBar() {
  const { title, setTitle, autosave, stampAutosave, setModal, resetProject, setTlH, setLeftW, setRightW } = useEditor();
  const [menu, setMenu] = useState(false);
  const [layout, setLayout] = useState(false);
  const [editing, setEditing] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Status auto-save diperbarui tiap menit.
  useEffect(() => {
    const t = window.setInterval(stampAutosave, 60_000);
    return () => window.clearInterval(t);
  }, [stampAutosave]);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenu(false);
        setLayout(false);
      }
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  const onMenu = (item: string) => {
    setMenu(false);
    if (item === 'New project') resetProject();
    else if (item === 'Export') setModal('export');
    else if (item === 'Shortcuts') setModal('shortcut');
    else if (item === 'Save' || item === 'Save as') {
      try {
        localStorage.setItem('by-studio-project', JSON.stringify({ title }));
      } catch { /* abaikan */ }
      stampAutosave();
    }
  };

  const onLayout = (name: string) => {
    setLayout(false);
    if (name === 'Wide player') { setLeftW(260); setRightW(260); setTlH(240); }
    else if (name === 'Focus timeline') { setTlH(460); }
    else { setLeftW(320); setRightW(300); setTlH(0); }
  };

  return (
    <header ref={rootRef} className="relative z-30 flex h-11 shrink-0 items-center gap-2 px-2.5" style={{ background: C.panel, borderBottom: `1px solid ${C.border}` }}>
      {/* Kiri: logo + Menu */}
      <span className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-[6px]" style={{ background: C.accent }}>
          <Clapperboard className="h-3.5 w-3.5 text-black" strokeWidth={2.4} />
        </span>
        <span className="text-[13px] font-bold" style={{ color: C.text }}>Boosteryuk Studio</span>
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="flex h-7 items-center gap-1 rounded-[4px] px-2.5 text-[12px] font-semibold transition-colors duration-[120ms]"
          style={{ background: menu ? C.raised : 'transparent', color: C.text }}
        >
          Menu <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
        {menu && (
          <div className="absolute left-0 top-8 z-40 w-44 overflow-hidden rounded-[6px] border py-1 shadow-xl" style={{ background: C.panel, borderColor: C.border }}>
            {MENU_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onMenu(item)}
                className="block w-full px-3 py-1.5 text-left text-[12px] transition-colors duration-[120ms] hover:bg-[#232327]"
                style={{ color: item === 'Export' ? C.accent : C.text }}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      <span className="hidden text-[11px] sm:inline" style={{ color: C.text3 }}>Auto save local at {autosave}</span>

      {/* Tengah: judul proyek editable */}
      <div className="absolute left-1/2 -translate-x-1/2">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }}
            aria-label="Judul proyek"
            className="w-[220px] rounded-[4px] border px-2 py-0.5 text-center text-[13px] font-semibold outline-none"
            style={{ background: C.raised, borderColor: C.border, color: C.text }}
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="rounded-[4px] px-2 py-0.5 text-[13px] font-semibold transition-colors duration-[120ms] hover:bg-[#232327]" style={{ color: C.text }}>
            {title}
          </button>
        )}
      </div>

      {/* Kanan */}
      <span className="ml-auto flex items-center gap-1.5">
        <div className="relative">
          <IconBtn label="Layout" onClick={() => setLayout((l) => !l)}>
            <LayoutTemplate className="h-4 w-4" strokeWidth={2} />
          </IconBtn>
          {layout && (
            <div className="absolute right-0 top-8 z-40 w-36 overflow-hidden rounded-[6px] border py-1 shadow-xl" style={{ background: C.panel, borderColor: C.border }}>
              {LAYOUTS.map((name) => (
                <button key={name} type="button" onClick={() => onLayout(name)} className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#232327]" style={{ color: C.text }}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setModal('shortcut')}
          className="flex h-7 items-center gap-1.5 rounded-[4px] px-2 text-[12px] font-semibold transition-colors duration-[120ms] hover:bg-[#232327]"
          style={{ color: C.text2 }}
        >
          <Keyboard className="h-3.5 w-3.5" strokeWidth={2} /> Shortcut
        </button>
        <span className="h-5 w-px" style={{ background: C.border }} aria-hidden />
        <button
          type="button"
          onClick={() => setModal('export')}
          className="flex h-7 items-center gap-1.5 rounded-[4px] px-3 text-[12px] font-bold transition-opacity hover:opacity-90"
          style={{ background: C.accent, color: '#06282c' }}
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2.4} /> Export
        </button>
        <span className="hidden items-center gap-1 md:flex" aria-hidden>
          <IconBtn label="Minimize"><Minus className="h-3.5 w-3.5" strokeWidth={2} /></IconBtn>
          <IconBtn label="Maximize"><Square className="h-3 w-3" strokeWidth={2} /></IconBtn>
          <IconBtn label="Close"><X className="h-3.5 w-3.5" strokeWidth={2} /></IconBtn>
        </span>
      </span>
    </header>
  );
}
