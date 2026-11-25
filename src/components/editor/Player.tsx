import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Menu as MenuIcon, Pause, Play, Ratio, Scan } from 'lucide-react';
import { previewFilter, projectEnd, useEditor } from './store';

/** play()/pause() defensif: beberapa lingkungan (jsdom/SSR) tidak mengembalikan Promise. */
function safePlay(el: HTMLVideoElement | HTMLAudioElement) {
  try {
    const p = el.play() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  } catch { /* abaikan */ }
}
function safeStop(el: HTMLVideoElement | HTMLAudioElement) {
  try { el.pause(); } catch { /* abaikan */ }
}
import { C, IconBtn } from './ui';
import { tc } from './types';

const RATIOS = ['Original', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const ratioCss: Record<string, string> = { Original: '16 / 9', '16:9': '16 / 9', '9:16': '9 / 16', '1:1': '1 / 1', '4:3': '4 / 3', '3:4': '3 / 4', '21:9': '21 / 9' };

/** Jam playback: playhead maju sesuai speed; sinkronkan elemen video asli bila ada. */
function usePlaybackClock() {
  const playing = useEditor((s) => s.playing);
  const speed = useEditor((s) => s.speed);
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const s = useEditor.getState();
      const pv = s.assets.find((a) => a.id === s.previewAssetId);
      const end = projectEnd(s.clips) || pv?.duration || 0;
      if (end <= 0) { raf = requestAnimationFrame(loop); return; }
      const next = s.playhead + dt * s.speed;
      // Durasi media habis → balik lagi dari awal (loop), tidak terus play ke area kosong.
      s.setPlayhead(next >= end ? 0 : next);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);
}

export default function Player() {
  usePlaybackClock();
  const { clips, playhead, setPlayhead, playing, setPlaying, volume, speed, zoomPct, posX, posY, opacity } = useEditor();
  const adjust = useEditor((st) => st.adjust);
  const filterCss = useEditor((st) => st.filterCss);
  const filterStrength = useEditor((st) => st.filterStrength);
  const [ratio, setRatio] = useState('Original');
  const [ratioOpen, setRatioOpen] = useState(false);
  const [hoverT, setHoverT] = useState<number | null>(null);
  /** Sedang menyeret scrub bar (pointer/touch) → playhead mengikuti gerakan 1:1. */
  const [scrubbing, setScrubbing] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const previewAssetId = useEditor((st) => st.previewAssetId);
  const assets = useEditor((st) => st.assets);
  const clip = useMemo(() => clips.find((c) => c.track === 'video' && playhead >= c.start && playhead <= c.start + c.duration) || null, [clips, playhead]);
  const clipAsset = useMemo(() => (clip?.assetId ? assets.find((a) => a.id === clip.assetId) || null : null), [clip, assets]);
  // Media terakhir yang di-import → preview Player otomatis menyesuaikan meski playhead di luar clip.
  const previewAsset = useMemo(() => assets.find((a) => a.id === previewAssetId) || null, [assets, previewAssetId]);
  const asset = clipAsset || previewAsset;
  // Total = ujung project; saat proyek kosong pakai durasi media preview.
  const end = useMemo(() => projectEnd(clips) || previewAsset?.duration || 0, [clips, previewAsset]);

  // Sinkronisasi video asli dengan playhead.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !playing) return;
    const want = (clip?.inPoint || 0) + (playhead - (clip?.start || 0));
    if (Math.abs(v.currentTime - want) > 0.35) v.currentTime = want;
  }, [playhead, playing, clip]);
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume / 100;
    v.playbackRate = speed;
    if (playing) safePlay(v);
    else safeStop(v);
  }, [playing, volume, speed, asset]);

  const filter = previewFilter({ adjust, filterCss, filterStrength });
  const scale = 0.6 + (zoomPct / 100) * 0.9;

  const seekFromRuler = (clientX: number) => {
    const r = rulerRef.current;
    if (!r) return;
    const rect = r.getBoundingClientRect();
    setPlayhead(((clientX - rect.left) / rect.width) * end);
  };

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.app }}>
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between px-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <span className="text-[11px] font-semibold" style={{ color: C.text2 }}>Player</span>
        <IconBtn label="Menu player"><MenuIcon className="h-4 w-4" strokeWidth={2} /></IconBtn>
      </div>

      {/* Preview */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-1.5 sm:p-2">
        <div
          ref={boxRef}
          data-player-stage
          className="relative flex h-full max-h-full w-full items-center justify-center overflow-hidden rounded-[4px] bg-black"
          style={{ aspectRatio: ratioCss[ratio], maxWidth: ratio === '9:16' || ratio === '3:4' ? '46%' : '100%' }}
        >
          {asset?.kind === 'video' && asset.url ? (
            <video
              ref={videoRef}
              src={asset.url}
              playsInline
              className="max-h-full max-w-full"
              style={{ filter, opacity: opacity / 100, transform: `translate(${posX}px, ${posY}px) scale(${scale})` }}
            />
          ) : asset?.kind === 'image' && asset.url ? (
            <img src={asset.url} alt="" className="max-h-full max-w-full" style={{ filter, opacity: opacity / 100, transform: `translate(${posX}px, ${posY}px) scale(${scale})` }} />
          ) : clip?.thumb ? (
            <img src={clip.thumb} alt="" className="h-full w-full object-cover" style={{ filter, opacity: opacity / 100, transform: `translate(${posX}px, ${posY}px) scale(${scale})` }} />
          ) : (
            <span className="text-[12px]" style={{ color: C.text3 }}>Tidak ada clip video di playhead</span>
          )}
        </div>
      </div>

      {/* Scrub ruler + tooltip — digerakkan pointer (mouse & sentuh): tekan lalu geser,
          playhead ikut 1:1. touch-none supaya geser tidak ikut men-scroll halaman. */}
      <div
        ref={rulerRef}
        className="relative mx-3 h-5 cursor-pointer touch-none"
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setScrubbing(true);
          seekFromRuler(e.clientX);
        }}
        onPointerMove={(e) => {
          const r = rulerRef.current;
          if (!r) return;
          const rect = r.getBoundingClientRect();
          const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * end;
          setHoverT(t);
          if (scrubbing) setPlayhead(t);
        }}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture?.(e.pointerId);
          setScrubbing(false);
          if (e.pointerType !== 'mouse') setHoverT(null);
        }}
        onPointerCancel={() => { setScrubbing(false); setHoverT(null); }}
        onPointerLeave={() => { if (!scrubbing) setHoverT(null); }}
        onClick={(e) => seekFromRuler(e.clientX)}
      >
        {/* Area sentuh lebih tinggi dari garis ruler (tetap memakai hitungan lebar ruler). */}
        <span className="absolute inset-x-0 -inset-y-2" aria-hidden />
        <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: C.border }} />
        {Array.from({ length: 41 }, (_, i) => (
          <span key={i} className="absolute top-1/2 w-px" style={{ left: `${(i / 40) * 100}%`, height: i % 5 === 0 ? 8 : 4, background: C.scroll, transform: 'translateY(-50%)' }} />
        ))}
        <span className="absolute top-0 h-full w-[2px]" style={{ left: `${(playhead / end) * 100}%`, background: C.accent }} />
        {hoverT !== null && (
          <span className="pointer-events-none absolute -top-5 -translate-x-1/2 rounded-[4px] bg-black px-1.5 py-0.5 text-[10px] font-bold" style={{ left: `${(hoverT / end) * 100}%`, color: C.accent }}>
            {tc(hoverT)}
          </span>
        )}
      </div>

      {/* Control bar — di layar sempit: rapat, meter audio disembunyikan, semua tetap bisa ditekan. */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 px-2 sm:gap-3 sm:px-3" style={{ borderTop: `1px solid ${C.border}` }}>
        <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-bold sm:gap-1.5 sm:text-[12px]" style={{ color: C.accent }}>
          {tc(playhead)}
          <span style={{ color: C.text3 }}>|</span>
          <span style={{ color: C.text2 }}>{tc(end)}</span>
        </span>
        <span className="hidden items-end gap-[2px] sm:flex" aria-hidden>
          {[6, 10, 8, 12, 7].map((h, i) => (
            <span key={i} className="w-[3px] rounded-sm" style={{ height: h, background: ['#22c55e', '#22c55e', '#eab308', '#f97316', '#ef4444'][i] }} />
          ))}
        </span>
        <span className="mx-auto">
          <button
            type="button"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => setPlaying(!playing)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform duration-[120ms] hover:scale-105 lg:h-9 lg:w-9"
            style={{ background: C.raised, color: C.text }}
          >
            {playing ? <Pause className="h-4 w-4" strokeWidth={2.2} /> : <Play className="h-4 w-4 pl-0.5" strokeWidth={2.2} />}
          </button>
        </span>
        <span className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <IconBtn label="Fit to screen"><Scan className="h-4 w-4" strokeWidth={2} /></IconBtn>
          <span className="relative">
            <button
              type="button"
              onClick={() => setRatioOpen((o) => !o)}
              className="flex h-8 max-w-[104px] items-center gap-1 rounded-[4px] border px-2 text-[11px] font-semibold"
              style={{ borderColor: C.border, color: C.text2 }}
            >
              <Ratio className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="truncate underline underline-offset-2">{ratio}</span>
            </button>
            {ratioOpen && (
              <div className="absolute bottom-8 right-0 z-40 w-28 overflow-hidden rounded-[6px] border py-1 shadow-xl" style={{ background: C.panel, borderColor: C.border }}>
                {RATIOS.map((r) => (
                  <button key={r} type="button" onClick={() => { setRatio(r); setRatioOpen(false); }} className="block w-full px-3 py-1 text-left text-[11px] hover:bg-[#232327]" style={{ color: r === ratio ? C.accent : C.text }}>
                    {r}
                  </button>
                ))}
              </div>
            )}
          </span>
          <IconBtn label="Fullscreen" onClick={() => { void boxRef.current?.requestFullscreen?.().catch(() => undefined); }}>
            <Maximize className="h-4 w-4" strokeWidth={2} />
          </IconBtn>
        </span>
      </div>
    </div>
  );
}
