import { useEffect, useMemo, useRef } from 'react';
import { timelineEnd, useEditor } from './store';
import TimelineToolbar from './TimelineToolbar';
import TimelineRuler from './TimelineRuler';
import TimelineTrack, { TRACKS, TrackGutter } from './TimelineTrack';
import Playhead from './Playhead';
import { C } from './ui';

export default function Timeline() {
  const { clips, zoom, setZoom, playhead, playing, setPlayheadDefault } = useEditor();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const end = useMemo(() => timelineEnd(clips), [clips]);
  const width = Math.round(end * zoom);

  // Default cursor timeline (playhead) berada di TENGAH area tampilan selama user
  // belum memindahkannya sendiri (guard playheadTouched di store).
  useEffect(() => {
    const view = scrollRef.current;
    if (!view) return;
    setPlayheadDefault((view.scrollLeft + view.clientWidth / 2) / zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll halus saat playback berjalan (bukan saat drag manual).
  useEffect(() => {
    if (!playing) return;
    const view = scrollRef.current;
    if (!view) return;
    const x = playhead * zoom;
    if (x > view.scrollLeft + view.clientWidth - 120 || x < view.scrollLeft) view.scrollLeft = Math.max(0, x - 120);
  }, [playhead, zoom, playing]);

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.panel }}>
      <TimelineToolbar />
      <div className="flex min-h-0 flex-1">
        {/* Gutter kiri (tetap terlihat saat scroll horizontal) */}
        <div className="z-20 w-[60px] shrink-0 border-r" style={{ borderColor: C.border }}>
          <div className="h-6 border-b" style={{ borderColor: C.border, background: '#151518' }} />
          {TRACKS.map((def, i) => <TrackGutter key={i} def={def} index={i} />)}
        </div>
        {/* Konten: ruler + lanes + playhead; bisa digeser (scroll) desktop & mobile */}
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
            <TimelineRuler width={width} />
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
            <Playhead />
          </div>
        </div>
      </div>
    </div>
  );
}
