import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clapperboard, Keyboard, LayoutTemplate, Menu as MenuIcon, Minus, Square, Upload, X } from 'lucide-react';
import { useEditor } from './store';
import { C, IconBtn } from './ui';

const MENU_ITEMS = ['New project', 'Open project', 'Save', 'Save as', 'Export', 'Settings', 'Shortcuts'];
const LAYOUTS = ['Default', 'Wide player', 'Focus timeline'];

/**
 * `onOpenMenu` = buka drawer menu Playground (muncul saat studio layar penuh, karena tombol
 * menu halaman tertutup studio). Semua dropdown ditutup lewat `pointerdown` + Escape agar
 * ikut bekerja di layar sentuh (event `mousedown` tidak selalu dikirim saat tap).
 */
export default function TopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
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
    const outside = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setMenu(false);
        setLayout(false);
      }
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenu(false); setLayout(false); }
    };
    // pointerdown = mouse + sentuh; klik di luar dropdown langsung menutupnya di HP.
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
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
      {/* Kiri: menu Playground (saat layar penuh) + logo + Menu */}
      {onOpenMenu && (
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Menu Playground"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] transition-colors duration-[120ms] hover:bg-[#232327]"
          style={{ color: C.text }}
        >
          <MenuIcon className="h-4 w-4" strokeWidth={2.2} />
        </button>
      )}
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px]" style={{ background: C.accent }}>
          <Clapperboard className="h-3.5 w-3.5 text-black" strokeWidth={2.4} />
        </span>
        {/* Nama studio hanya di layar lebar: di HP ruangnya dipakai judul proyek + tombol. */}
        <span className="hidden text-[13px] font-bold lg:inline" style={{ color: C.text }}>Boosteryuk Studio</span>
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="flex h-8 shrink-0 items-center gap-1 rounded-[4px] px-2.5 text-[12px] font-semibold transition-colors duration-[120ms]"
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
      <span className="hidden shrink-0 text-[11px] lg:inline" style={{ color: C.text3 }}>Auto save local at {autosave}</span>

      {/* Tengah: judul proyek editable (dibatasi lebarnya di HP agar tidak menimpa tombol) */}
      <div className="pointer-events-none absolute left-1/2 max-w-[26vw] -translate-x-1/2 lg:max-w-none">
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false); }}
            aria-label="Judul proyek"
            className="pointer-events-auto w-[min(220px,26vw)] rounded-[4px] border px-2 py-0.5 text-center text-[13px] font-semibold outline-none lg:w-[220px]"
            style={{ background: C.raised, borderColor: C.border, color: C.text }}
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="pointer-events-auto block w-full truncate rounded-[4px] px-2 py-0.5 text-center text-[13px] font-semibold transition-colors duration-[120ms] hover:bg-[#232327]" style={{ color: C.text }}>
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
          aria-label="Shortcut"
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-[4px] px-2 text-[12px] font-semibold transition-colors duration-[120ms] hover:bg-[#232327]"
          style={{ color: C.text2 }}
        >
          <Keyboard className="h-3.5 w-3.5" strokeWidth={2} /> <span className="hidden lg:inline">Shortcut</span>
        </button>
        <span className="h-5 w-px" style={{ background: C.border }} aria-hidden />
        <button
          type="button"
          onClick={() => setModal('export')}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-[4px] px-2.5 text-[12px] font-bold transition-opacity hover:opacity-90 lg:px-3"
          style={{ background: C.accent, color: '#06282c' }}
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2.4} /> Export
        </button>
        <span className="hidden items-center gap-1 lg:flex" aria-hidden>
          <IconBtn label="Minimize"><Minus className="h-3.5 w-3.5" strokeWidth={2} /></IconBtn>
          <IconBtn label="Maximize"><Square className="h-3 w-3" strokeWidth={2} /></IconBtn>
          <IconBtn label="Close"><X className="h-3.5 w-3.5" strokeWidth={2} /></IconBtn>
        </span>
      </span>
    </header>
  );
}
