import { useState } from 'react';
import { Clock, Eye, EyeOff, Lock, Music2, Video } from 'lucide-react';
import { useEditor } from './store';
import type { Clip as ClipType } from './types';
import TimelineClip from './TimelineClip';
import { C, IconBtn } from './ui';

export interface TrackDef {
  track: 'video' | 'audio' | 'empty';
  height: number;
}

export const TRACKS: TrackDef[] = [
  { track: 'video', height: 64 },
  { track: 'audio', height: 40 },
  { track: 'empty', height: 34 },
  { track: 'empty', height: 34 },
  { track: 'empty', height: 34 },
];

/** Kolom gutter 60px untuk satu track (mute / lock / hide). */
export function TrackGutter({ def, index }: { def: TrackDef; index: number }) {
  const [muted, setMuted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [hidden, setHidden] = useState(false);
  const video = def.track === 'video';
  const empty = def.track === 'empty';
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-0.5 border-b"
      style={{ height: def.height, borderColor: C.border, background: index % 2 ? '#191a1d' : C.panel }}
    >
      <IconBtn label={video ? 'Video track' : def.track === 'audio' ? 'Audio track' : 'Track kosong'}>
        {video ? <Video className="h-3.5 w-3.5" strokeWidth={2} /> : def.track === 'audio' ? <Clock className="h-3.5 w-3.5" strokeWidth={2} /> : <span className="block h-px w-3.5" style={{ background: C.scroll }} />}
      </IconBtn>
      {!empty && (
        <>
          <IconBtn label={muted ? 'Unmute' : 'Mute'} active={muted} onClick={() => setMuted((m) => !m)}>
            <Music2 className="h-3 w-3" strokeWidth={2} />
          </IconBtn>
          <IconBtn label={locked ? 'Unlock' : 'Lock'} active={locked} onClick={() => setLocked((l) => !l)}>
            <Lock className="h-3 w-3" strokeWidth={2} />
          </IconBtn>
          <IconBtn label={hidden ? 'Show' : 'Hide'} active={hidden} onClick={() => setHidden((h) => !h)}>
            {hidden ? <EyeOff className="h-3 w-3" strokeWidth={2} /> : <Eye className="h-3 w-3" strokeWidth={2} />}
          </IconBtn>
        </>
      )}
    </div>
  );
}

/** Lane clip satu track. */
export default function TimelineTrack({ def, clips, zoom, width, index, lockedRef }: { def: TrackDef; clips: ClipType[]; zoom: number; width: number; index: number; lockedRef?: React.MutableRefObject<number[]> }) {
  const { select, assets, addClip } = useEditor();
  return (
    <div
      className="relative shrink-0 overflow-hidden border-b"
      style={{ height: def.height, width, borderColor: C.border, background: index % 2 ? 'rgba(255,255,255,.012)' : 'transparent', opacity: lockedRef?.current.includes(index) ? 0.5 : 1 }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) select(null); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/by-asset');
        const asset = assets.find((a) => a.id === id);
        if (!asset) return;
        const host = (e.currentTarget as HTMLElement).closest('[data-tl-scroll]');
        const rect = (host as HTMLElement | null)?.getBoundingClientRect();
        const at = rect ? Math.max(0, (e.clientX - rect.left + (host?.scrollLeft || 0) - 60) / zoom) : undefined;
        addClip(asset, at);
      }}
    >
      {clips.map((c) => <TimelineClip key={c.id} clip={c} zoom={zoom} />)}
      {clips.length === 0 && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px]" style={{ color: C.text3 }}>
          Tarik media ke sini
        </span>
      )}
    </div>
  );
}
