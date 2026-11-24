import { useState } from 'react';
import { ChevronDown, Delete, Link2, Link2Off, Mic, MousePointer2, Magnet, Music2, Redo2, Scissors, Split, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEditor } from './store';
import { C, IconBtn } from './ui';

const SELECT_TOOLS = ['Select', 'Select all', 'Box select'];

export default function TimelineToolbar() {
  const { undo, redo, splitSelected, deleteSelected, selected, zoom, setZoom, snapping, toggleSnapping, clips } = useEditor();
  const [tool, setTool] = useState(false);
  const [toolName, setToolName] = useState('Select');
  return (
    <div className="flex h-10 shrink-0 items-center gap-1 px-2" style={{ background: '#151518', borderBottom: `1px solid ${C.border}` }}>
      {/* Kiri: tools */}
      <span className="relative flex items-center">
        <button
          type="button"
          onClick={() => setTool((t) => !t)}
          className="flex h-7 items-center gap-1 rounded-[4px] px-2 text-[11px] font-semibold"
          style={{ background: C.raised, color: C.accent, boxShadow: `inset 0 0 0 1px ${C.border}` }}
        >
          <MousePointer2 className="h-3.5 w-3.5" strokeWidth={2.2} /> {toolName}
          <ChevronDown className="h-3 w-3" strokeWidth={2.2} />
        </button>
        {tool && (
          <>
            <span className="fixed inset-0 z-30" onClick={() => setTool(false)} />
            <span className="absolute left-0 top-8 z-40 w-32 overflow-hidden rounded-[6px] border py-1 shadow-xl" style={{ background: C.panel, borderColor: C.border }}>
              {SELECT_TOOLS.map((t) => (
                <button key={t} type="button" onClick={() => { setToolName(t); setTool(false); }} className="block w-full px-3 py-1.5 text-left text-[11px] hover:bg-[#232327]" style={{ color: t === toolName ? C.accent : C.text }}>
                  {t}
                </button>
              ))}
            </span>
          </>
        )}
      </span>
      <IconBtn label="Undo (Ctrl+Z)" onClick={undo}><Undo2 className="h-4 w-4" strokeWidth={2} /></IconBtn>
      <IconBtn label="Redo (Ctrl+Y)" onClick={redo}><Redo2 className="h-4 w-4" strokeWidth={2} /></IconBtn>
      <IconBtn label="Split (S)" disabled={!selected} onClick={splitSelected}><Scissors className="h-4 w-4" strokeWidth={2} /></IconBtn>
      <IconBtn label="Delete (Delete)" disabled={!selected} onClick={deleteSelected}><Delete className="h-4 w-4" strokeWidth={2} /></IconBtn>

      <span className="ml-auto flex items-center gap-1">
        <IconBtn label="Record"><Mic className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <IconBtn label="Link clips"><Link2 className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <IconBtn label="Snapping" active={snapping} onClick={toggleSnapping}><Magnet className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <IconBtn label="Unlink clips"><Link2Off className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <IconBtn label="Split audio"><Music2 className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <IconBtn label="Zoom out"><ZoomOut className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <input
          type="range"
          aria-label="Zoom timeline"
          min={8}
          max={160}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="ed-slider h-[4px] w-[110px] cursor-pointer appearance-none rounded-full outline-none"
          style={{ background: `linear-gradient(to right, ${C.accent} ${((zoom - 8) / 152) * 100}%, ${C.scroll} ${((zoom - 8) / 152) * 100}%)` }}
        />
        <IconBtn label="Zoom in"><ZoomIn className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <span className="ml-1 flex items-center gap-1 rounded-[4px] px-1.5 py-1 text-[10.5px]" style={{ background: C.raised, color: C.text2 }}>
          <Split className="h-3 w-3" strokeWidth={2} /> {clips.length} clip
        </span>
      </span>
    </div>
  );
}
