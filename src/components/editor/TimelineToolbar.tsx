import { useRef, useState } from 'react';
import { ChevronDown, Delete, Link2, Link2Off, Mic, MousePointer2, Magnet, Music2, Redo2, Scissors, Split, Undo2, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { useEditor } from './store';
import { C, IconBtn } from './ui';

const SELECT_TOOLS = ['Select', 'Select all', 'Box select'];

export default function TimelineToolbar() {
  const { undo, redo, splitSelected, deleteSelected, selected, zoom, setZoom, snapping, toggleSnapping, clips, playhead, importAudioFiles } = useEditor();
  const [tool, setTool] = useState(false);
  const audioInput = useRef<HTMLInputElement | null>(null);
  // Cut mengikuti garis playhead: aktif bila ada selection ATAU playhead di atas clip.
  const canSplit = Boolean(selected) || clips.some((c) => playhead >= c.start && playhead <= c.start + c.duration);
  const [toolName, setToolName] = useState('Select');
  return (
    /* overflow-x-auto: di layar sempit semua tool tetap bisa dijangkau dengan menggeser toolbar. */
    <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto px-2 ed-scroll-x [&>*]:shrink-0" style={{ background: '#151518', borderBottom: `1px solid ${C.border}` }}>
      {/* Kiri: tools */}
      <span className="relative flex items-center">
        <button
          type="button"
          onClick={() => setTool((t) => !t)}
          className="flex h-8 shrink-0 items-center gap-1 rounded-[4px] px-2 text-[11px] font-semibold lg:h-7"
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
      <IconBtn label="Split (S)" disabled={!canSplit} onClick={splitSelected}><Scissors className="h-4 w-4" strokeWidth={2} /></IconBtn>
      <IconBtn label="Delete (Delete)" disabled={!selected} onClick={deleteSelected}><Delete className="h-4 w-4" strokeWidth={2} /></IconBtn>

      <span className="ml-auto flex items-center gap-1">
        <IconBtn label="Record"><Mic className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <IconBtn label="Upload audio (MP3/WAV)" onClick={() => audioInput.current?.click()}><Upload className="h-4 w-4" strokeWidth={2} /></IconBtn>
        <input
          ref={audioInput}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
          multiple
          hidden
          aria-label="Upload file audio"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) importAudioFiles(e.target.files);
            e.target.value = '';
          }}
        />
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
