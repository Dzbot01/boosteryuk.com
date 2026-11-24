/**
 * EditorStudio — ruang edit video & foto di Playground (menu "Editor Studio").
 *
 * Alur sesuai permintaan:
 *  - Desktop: sidebar di sisi KANAN berisi kotak upload image/video.
 *  - Setelah upload: preview media besar di TENGAH; sidebar kanan berubah jadi menu
 *    (Tambah Teks, Tambah Media, daftar media/overlay, Ekspor).
 *  - Untuk video: di bawah media ada panel timeline untuk CUT (trim in/out),
 *    atur suara (volume), tandai (marker), serta ikon PLUS untuk tambah media/overlay.
 *  - Di atas timeline ada modal ikon kecil: TAMBAH MUSIK.
 *  - Hasil edit dapat diekspor (video → rekaman canvas+audio .webm; foto → PNG).
 *
 * Semua proses berjalan lokal di browser (URL.createObjectURL + MediaRecorder);
 * tidak ada upload ke server.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clapperboard,
  Download,
  ImagePlus,
  LoaderCircle,
  Music,
  Plus,
  Scissors,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';

interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  url: string;
  name: string;
}

interface TextOverlay {
  id: string;
  text: string;
  x: number; // % dari lebar preview
  y: number; // % dari tinggi preview
  size: number; // px pada tinggi preview 720p
  color: string;
}

interface Marker { id: string; time: number }

const uid = () => Math.random().toString(36).slice(2, 10);
const fmtTime = (t: number) => {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const d = Math.floor((t % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
};

export default function EditorStudio() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [activeId, setActiveId] = useState('');
  const [overlays, setOverlays] = useState<TextOverlay[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [trim, setTrim] = useState<{ start: number; end: number } | null>(null);
  const [volume, setVolume] = useState(80);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [music, setMusic] = useState<{ url: string; name: string } | null>(null);
  const [musicModal, setMusicModal] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportInfo, setExportInfo] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewBoxRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const addMediaRef = useRef<HTMLInputElement | null>(null);
  const musicRef = useRef<HTMLInputElement | null>(null);
  const musicElRef = useRef<HTMLAudioElement | null>(null);
  const dragHandle = useRef<null | 'start' | 'end'>(null);
  const dragOverlay = useRef<string | null>(null);

  const active = useMemo(() => media.find((m) => m.id === activeId) || null, [media, activeId]);
  const hasMedia = media.length > 0;

  /* ---------------- upload ---------------- */
  const acceptFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: MediaItem[] = [];
    for (const file of Array.from(files)) {
      const kind: MediaItem['kind'] | null = file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('image/')
          ? 'image'
          : null;
      if (!kind) continue;
      added.push({ id: uid(), kind, url: URL.createObjectURL(file), name: file.name });
    }
    if (added.length === 0) return;
    const first = !hasMedia;
    setMedia((prev) => [...prev, ...added]);
    if (first) {
      setActiveId(added[0].id);
      setMarkers([]);
      setTrim(null);
    }
  };

  const acceptMusic = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith('audio/')) return;
    setMusic((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return { url: URL.createObjectURL(file), name: file.name };
    });
    setMusicModal(false);
  };

  /* ---------------- video events ---------------- */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || active?.kind !== 'video') return;
    const onMeta = () => {
      setDuration(v.duration || 0);
      setTrim((t) => t ?? { start: 0, end: v.duration || 0 });
    };
    const onTime = () => {
      setTime(v.currentTime);
      const end = trim?.end ?? v.duration;
      if (end && v.currentTime > end - 0.05) v.pause();
    };
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate', onTime);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate', onTime);
    };
  }, [active, trim]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) v.volume = volume / 100;
  }, [volume, active]);

  useEffect(() => {
    const a = musicElRef.current;
    if (a) a.volume = 0.9;
  }, [music]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const start = trim?.start ?? 0;
      const end = trim?.end ?? v.duration;
      if (v.currentTime < start - 0.05 || v.currentTime > end - 0.05) v.currentTime = start;
      void v.play();
      musicElRef.current?.play().catch(() => undefined);
    } else {
      v.pause();
      musicElRef.current?.pause();
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, t), duration || t);
    setTime(v.currentTime);
  };

  /* ---------------- timeline trim handles ---------------- */
  const timeFromClientX = (clientX: number) => {
    const bar = barRef.current;
    if (!bar || !duration) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragHandle.current) {
        const t = timeFromClientX(e.clientX);
        setTrim((prev) => {
          if (!prev) return prev;
          if (dragHandle.current === 'start') return { ...prev, start: Math.min(t, prev.end - 0.1) };
          return { ...prev, end: Math.max(t, prev.start + 0.1) };
        });
      }
      if (dragOverlay.current && previewBoxRef.current) {
        const rect = previewBoxRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setOverlays((prev) => prev.map((o) => (o.id === dragOverlay.current ? { ...o, x: Math.min(96, Math.max(0, x)), y: Math.min(96, Math.max(0, y)) } : o)));
      }
    };
    const up = () => {
      dragHandle.current = null;
      dragOverlay.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  /* ---------------- overlay & marker ---------------- */
  const addText = () =>
    setOverlays((prev) => [...prev, { id: uid(), text: 'Teks baru', x: 8, y: 12, size: 48, color: '#ffffff' }]);

  const addMarker = () => setMarkers((prev) => [...prev, { id: uid(), time: time }]);

  const removeMedia = (id: string) => {
    const item = media.find((m) => m.id === id);
    if (item) URL.revokeObjectURL(item.url);
    const next = media.filter((m) => m.id !== id);
    setMedia(next);
    if (activeId === id) {
      setActiveId(next[0]?.id ?? '');
      setMarkers([]);
      setTrim(null);
    }
  };

  /* ---------------- export ---------------- */
  const drawFrame = (ctx: CanvasRenderingContext2D, w: number, h: number, source: CanvasImageSource) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    for (const o of overlays) {
      const px = (o.size / 720) * h;
      ctx.font = `800 ${px}px system-ui, sans-serif`;
      ctx.fillStyle = o.color;
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = px / 6;
      ctx.fillText(o.text, (o.x / 100) * w, (o.y / 100) * h);
      ctx.shadowBlur = 0;
    }
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const exportProject = async () => {
    if (!active || exporting) return;
    setExporting(true);
    setExportInfo('Menyiapkan ekspor…');
    try {
      if (active.kind === 'image') {
        const img = new Image();
        img.src = active.url;
        await img.decode();
        const w = img.naturalWidth || 1280;
        const h = img.naturalHeight || 720;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas tidak tersedia.');
        drawFrame(ctx, w, h, img);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) throw new Error('Gagal membuat PNG.');
        download(blob, 'boosteryuk-studio.png');
        setExportInfo('Ekspor selesai: PNG diunduh.');
        return;
      }

      // Video: rekam canvas + audio campuran (volume video + musik) selama rentang cut.
      const v = videoRef.current;
      if (!v) throw new Error('Video belum siap.');
      const w = Math.min(1280, v.videoWidth || 1280);
      const h = Math.round((w * (v.videoHeight || 720)) / (v.videoWidth || 1280));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia.');

      const stream = canvas.captureStream(30);
      let recDest: MediaStreamAudioDestinationNode | null = null;
      let audioCtx: AudioContext | null = null;
      try {
        audioCtx = new AudioContext();
        recDest = audioCtx.createMediaStreamDestination();
        const vSrc = audioCtx.createMediaElementSource(v);
        const vGain = audioCtx.createGain();
        vGain.gain.value = volume / 100;
        vSrc.connect(vGain);
        vGain.connect(recDest);
        vGain.connect(audioCtx.destination);
        if (musicElRef.current) {
          const mSrc = audioCtx.createMediaElementSource(musicElRef.current);
          const mGain = audioCtx.createGain();
          mGain.gain.value = 0.9;
          mSrc.connect(mGain);
          mGain.connect(recDest);
          mGain.connect(audioCtx.destination);
        }
        for (const t of recDest.stream.getAudioTracks()) stream.addTrack(t);
      } catch {
        // Tanpa graph audio (mis. browser membatasi): rekam video tanpa suara.
      }

      const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((res) => {
        rec.onstop = () => res();
      });

      const startAt = trim?.start ?? 0;
      const endAt = trim?.end || v.duration || 0;
      v.pause();
      v.currentTime = startAt;
      await new Promise<void>((res) => {
        const onSeeked = () => {
          v.removeEventListener('seeked', onSeeked);
          res();
        };
        v.addEventListener('seeked', onSeeked);
      });
      if (musicElRef.current) {
        musicElRef.current.currentTime = 0;
        void musicElRef.current.play().catch(() => undefined);
      }
      rec.start(250);
      setExportInfo('Merekam hasil edit… jangan tutup tab.');
      await v.play();

      await new Promise<void>((res) => {
        const loop = () => {
          drawFrame(ctx, w, h, v);
          if (v.currentTime >= endAt - 0.05 || v.ended) {
            res();
            return;
          }
          requestAnimationFrame(loop);
        };
        loop();
      });
      v.pause();
      musicElRef.current?.pause();
      rec.stop();
      await stopped;
      audioCtx?.close().catch(() => undefined);
      download(new Blob(chunks, { type: 'video/webm' }), 'boosteryuk-studio.webm');
      setExportInfo('Ekspor selesai: video .webm diunduh.');
    } catch (err) {
      setExportInfo(err instanceof Error ? `Ekspor gagal: ${err.message}` : 'Ekspor gagal.');
    } finally {
      setExporting(false);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="rounded-[18px] border border-emerald-200 bg-white p-4 shadow-[0_14px_36px_-18px_rgba(23,32,51,.22)] dark:border-slate-700 dark:bg-slate-900 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clapperboard className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" strokeWidth={2} />
        <h2 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:white dark:text-white">Editor Studio</h2>
        <span className="ml-auto text-[11px] font-semibold text-slate-400">Ruang edit video & foto — proses lokal di browser</span>
      </div>

      <div className="flex flex-col-reverse gap-4 lg:flex-row">
        {/* ---------- Tengah: preview besar + timeline ---------- */}
        <div className="min-w-0 flex-1">
          <div
            ref={previewBoxRef}
            className="relative flex min-h-[280px] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-950 sm:min-h-[380px] lg:min-h-[440px]"
          >
            {active?.kind === 'video' ? (
              <video
                ref={videoRef}
                src={active.url}
                onClick={togglePlay}
                playsInline
                className="max-h-[52vh] w-full object-contain"
              />
            ) : active?.kind === 'image' ? (
              <img src={active.url} alt={active.name} className="max-h-[52vh] w-full object-contain" draggable={false} />
            ) : (
              <p className="px-6 text-center text-[13px] font-semibold text-slate-400">
                Upload image atau video dari panel kanan untuk mulai mengedit.
              </p>
            )}

            {/* Overlay teks (bisa digeser) */}
            {active &&
              overlays.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onPointerDown={(e) => {
                    dragOverlay.current = o.id;
                    e.preventDefault();
                  }}
                  style={{ left: `${o.x}%`, top: `${o.y}%`, color: o.color, fontSize: `${Math.round((o.size / 720) * 260)}px` }}
                  className="absolute cursor-grab select-none font-extrabold leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,.6)] active:cursor-grabbing"
                >
                  {o.text}
                </button>
              ))}
          </div>

          {/* ---------- Modal ikon kecil: tambah musik (di atas timeline) ---------- */}
          {active?.kind === 'video' && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
              <button
                type="button"
                onClick={() => setMusicModal(true)}
                aria-label="Tambah musik"
                title="Tambah musik"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:opacity-90 active:scale-95"
              >
                <Music className="h-4 w-4" strokeWidth={2.2} />
              </button>
              <span className="text-[11.5px] font-bold text-slate-600 dark:text-slate-300">Tambah Musik</span>
              {music && (
                <span className="ml-auto flex min-w-0 items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <Music className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate">{music.name}</span>
                  <button
                    type="button"
                    aria-label="Hapus musik"
                    onClick={() => {
                      if (music) URL.revokeObjectURL(music.url);
                      setMusic(null);
                    }}
                    className="rounded p-0.5 text-slate-400 hover:text-rose-500"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.4} />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* ---------- Modal timeline (cut, suara, tandai, plus) ---------- */}
          {active?.kind === 'video' && (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800/70">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  <Scissors className="h-3.5 w-3.5" strokeWidth={2.4} /> Timeline
                </span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {fmtTime(time)} / {fmtTime(duration)}
                </span>
                <span className="ml-auto font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  Cut: {fmtTime(trim?.start ?? 0)} → {fmtTime(trim?.end ?? duration)}
                </span>
              </div>

              {/* Bar timeline + handle cut + marker + playhead */}
              <div ref={barRef} className="relative h-12 select-none rounded-lg bg-slate-100 dark:bg-slate-900">
                {duration > 0 && trim && (
                  <>
                    <div
                      className="absolute inset-y-0 rounded-md bg-emerald-500/25 ring-1 ring-emerald-500/60"
                      style={{ left: `${(trim.start / duration) * 100}%`, width: `${((trim.end - trim.start) / duration) * 100}%` }}
                    />
                    {markers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        title={`Tandai ${fmtTime(m.time)} — klik untuk lompat`}
                        onClick={() => seek(m.time)}
                        className="absolute top-1 h-3 w-[3px] -translate-x-1/2 rounded bg-amber-400"
                        style={{ left: `${(m.time / duration) * 100}%` }}
                      />
                    ))}
                    <div
                      className="pointer-events-none absolute inset-y-0 w-[2px] bg-emerald-500"
                      style={{ left: `${(Math.min(time, duration) / duration) * 100}%` }}
                    />
                    <button
                      type="button"
                      aria-label="Atur awal cut"
                      onPointerDown={(e) => {
                        dragHandle.current = 'start';
                        e.preventDefault();
                      }}
                      className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize rounded bg-emerald-600"
                      style={{ left: `${(trim.start / duration) * 100}%` }}
                    />
                    <button
                      type="button"
                      aria-label="Atur akhir cut"
                      onPointerDown={(e) => {
                        dragHandle.current = 'end';
                        e.preventDefault();
                      }}
                      className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize rounded bg-emerald-600"
                      style={{ left: `${(trim.end / duration) * 100}%` }}
                    />
                  </>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Suara video: {volume}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-2">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="h-9 rounded-xl bg-slate-800 px-3.5 text-[12px] font-bold text-white hover:opacity-90 dark:bg-slate-700"
                  >
                    Putar / Jeda
                  </button>
                  <button
                    type="button"
                    onClick={addMarker}
                    className="h-9 rounded-xl bg-amber-500 px-3.5 text-[12px] font-bold text-white hover:opacity-90"
                  >
                    Tandai
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkers([])}
                    disabled={markers.length === 0}
                    className="h-9 rounded-xl border border-slate-200 px-3 text-[12px] font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Hapus Tandai
                  </button>
                  <div className="relative ml-auto">
                    <button
                      type="button"
                      aria-label="Tambah media atau overlay"
                      title="Tambah media atau overlay"
                      onClick={() => setPlusOpen((p) => !p)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white hover:opacity-90 active:scale-95"
                    >
                      <Plus className="h-4.5 w-4.5" strokeWidth={2.4} />
                    </button>
                    {plusOpen && (
                      <div className="absolute bottom-11 right-0 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            addMediaRef.current?.click();
                            setPlusOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <ImagePlus className="h-4 w-4" /> Tambah Media
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addText();
                            setPlusOpen(false);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Type className="h-4 w-4" /> Tambah Overlay
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------- Sidebar KANAN: upload → menu ---------- */}
        <aside className="w-full shrink-0 lg:w-[290px]">
          {!hasMedia ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                acceptFiles(e.dataTransfer.files);
              }}
              className={`flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60'
              }`}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                <Upload className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">Upload image atau video</p>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">Tarik file ke sini, atau</p>
              <button
                type="button"
                onClick={() => uploadRef.current?.click()}
                className="h-10 rounded-xl bg-slate-800 px-4 text-[12.5px] font-bold text-white hover:opacity-90 dark:bg-slate-700"
              >
                Pilih File
              </button>
            </div>
          ) : (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-slate-800/60">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Menu</p>
              <button
                type="button"
                onClick={addText}
                className="flex h-10 w-full items-center gap-2 rounded-xl bg-slate-800 px-3.5 text-[12.5px] font-bold text-white hover:opacity-90 dark:bg-slate-700"
              >
                <Type className="h-4 w-4" strokeWidth={2.2} /> Tambahkan Teks
              </button>
              <button
                type="button"
                onClick={() => addMediaRef.current?.click()}
                className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-300 px-3.5 text-[12.5px] font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <ImagePlus className="h-4 w-4" strokeWidth={2.2} /> Tambah Media
              </button>
              <button
                type="button"
                onClick={() => void exportProject()}
                disabled={exporting}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-[12.5px] font-bold text-white hover:opacity-90 disabled:opacity-60"
              >
                {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={2.2} />}
                {exporting ? 'Mengekspor…' : 'Ekspor'}
              </button>
              {exportInfo && <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{exportInfo}</p>}

              {/* Daftar media */}
              <div className="space-y-1.5 border-t border-slate-200 pt-3 dark:border-slate-700">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Media ({media.length})</p>
                {media.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                      m.id === activeId
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <button type="button" onClick={() => setActiveId(m.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      {m.kind === 'video' ? (
                        <video src={m.url} muted className="h-8 w-10 shrink-0 rounded object-cover" />
                      ) : (
                        <img src={m.url} alt="" className="h-8 w-10 shrink-0 rounded object-cover" />
                      )}
                      <span className="truncate text-[11.5px] font-bold text-slate-700 dark:text-slate-200">{m.name}</span>
                    </button>
                    <button type="button" aria-label={`Hapus ${m.name}`} onClick={() => removeMedia(m.id)} className="rounded p-1 text-slate-400 hover:text-rose-500">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Editor overlay teks */}
              {overlays.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Overlay Teks</p>
                  {overlays.map((o) => (
                    <div key={o.id} className="space-y-1.5 rounded-xl border border-slate-200 p-2 dark:border-slate-600">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={o.text}
                          onChange={(e) => setOverlays((prev) => prev.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))}
                          className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        />
                        <input
                          type="color"
                          value={o.color}
                          aria-label="Warna teks"
                          onChange={(e) => setOverlays((prev) => prev.map((x) => (x.id === o.id ? { ...x, color: e.target.value } : x)))}
                          className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-600"
                        />
                        <button
                          type="button"
                          aria-label="Hapus overlay"
                          onClick={() => setOverlays((prev) => prev.filter((x) => x.id !== o.id))}
                          className="rounded p-1 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                        </button>
                      </div>
                      <input
                        type="range"
                        min={16}
                        max={140}
                        value={o.size}
                        aria-label="Ukuran teks"
                        onChange={(e) => setOverlays((prev) => prev.map((x) => (x.id === o.id ? { ...x, size: Number(e.target.value) } : x)))}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Input file tersembunyi */}
      <input ref={uploadRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { acceptFiles(e.target.files); e.target.value = ''; }} />
      <input ref={addMediaRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { acceptFiles(e.target.files); e.target.value = ''; }} />
      <input ref={musicRef} type="file" accept="audio/*" hidden onChange={(e) => { acceptMusic(e.target.files); e.target.value = ''; }} />
      {music && <audio ref={musicElRef} src={music.url} preload="auto" hidden />}

      {/* Modal tambah musik */}
      {musicModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-[14px] font-bold text-slate-900 dark:text-white">
                <Music className="h-4 w-4 text-emerald-500" strokeWidth={2.2} /> Tambah Musik
              </p>
              <button type="button" aria-label="Tutup" onClick={() => setMusicModal(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4.5 w-4.5" strokeWidth={2.2} />
              </button>
            </div>
            <p className="mb-3 text-[12px] text-slate-500 dark:text-slate-400">
              Pilih file audio (mp3/m4a/ogg). Musik diputar bersamaan dengan video dan ikut terekam saat ekspor.
            </p>
            <button
              type="button"
              onClick={() => musicRef.current?.click()}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[12.5px] font-bold text-white hover:opacity-90"
            >
              <Upload className="h-4 w-4" strokeWidth={2.2} /> Pilih File Musik
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
