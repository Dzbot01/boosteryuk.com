import { useEffect, useMemo, useRef } from 'react';
import { timelineEnd, useEditor } from './store';
import TimelineToolbar from './TimelineToolbar';
import TimelineRuler from './TimelineRuler';
import TimelineTrack, { TRACKS, TrackGutter } from './TimelineTrack';
import Playhead from './Playhead';
import { C } from './ui';

export default function Timeline() {
  const { clips, zoom, setZoom, playhead, setPlayhead, snapping } = useEditor();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const end = useMemo(() => timelineEnd(clips), [clips]);
  const width = Math.round(end * zoom);

  const seek = (clientX: number, snap: boolean) => {
    const host = scrollRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const inner = host.querySelector<HTMLElement>('[data-tl-ruler]');
    const base = inner?.getBoundingClientRect().left ?? rect.left + 60;
    let t = (clientX - base + host.scrollLeft) / zoom;
    t = Math.max(0, Math.min(end, t));
    if (snap && snapping) {
      for (const c of clips) {
        for (const e of [c.start, c.start + c.duration]) if (Math.abs(e - t) * zoom < 7) { t = e; break; }
      }
    }
    setPlayhead(t);
  };

  // Auto-scroll saat playhead keluar viewport.
  useEffect(() => {
    const view = scrollRef.current;
    if (!view) return;
    const x = playhead * zoom;
    if (x > view.scrollLeft + view.clientWidth - 120 || x < view.scrollLeft) view.scrollLeft = Math.max(0, x - 120);
  }, [playhead, zoom]);

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.panel }}>
      <TimelineToolbar />
      <div className="flex min-h-0 flex-1">
        {/* Gutter kiri (sticky) */}
        <div className="sticky left-0 z-20 w-[60px] shrink-0 border-r" style={{ borderColor: C.border }}>
          <div className="h-6 border-b" style={{ borderColor: C.border, background: '#151518' }} />
          {TRACKS.map((def, i) => <TrackGutter key={i} def={def} index={i} />)}
        </div>
        {/* Konten: ruler + lanes + playhead */}
        <div
          ref={scrollRef}
          data-tl-scroll
          className="relative min-w-0 flex-1 overflow-auto ed-scroll"
          onWheel={(e) => {
            if (e.ctrlKey) {
              e.preventDefault();
              setZoom(zoom + (e.deltaY < 0 ? 6 : -6));
            }
          }}
        >
          <div className="relative" style={{ width, minHeight: '100%' }}>
            <div data-tl-ruler onClick={(e) => seek(e.clientX, false)} className="cursor-pointer">
              <TimelineRuler width={width} seek={seek} />
            </div>
            {TRACKS.map((def, i) => (
              <TimelineTrack
                key={i}
                def={def}
                index={i}
                zoom={zoom}
                width={width}
                clips={def.track === 'empty' ? [] : clips.filter((c) => c.track === def.track)}
              />
            ))}
            <Playhead seek={seek} />
          </div>
        </div>
      </div>
    </div>
  );
}
