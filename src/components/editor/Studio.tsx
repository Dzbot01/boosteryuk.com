import { useCallback, useEffect, useRef, useState } from 'react';
import { Film, Music, SlidersHorizontal, Sparkles, Sticker, Shuffle, Type, X } from 'lucide-react';
import { useEditor } from './store';
import type { LeftTab } from './store';
import TopBar from './TopBar';
import MediaPanel from './MediaPanel';
import Player from './Player';
import Inspector from './Inspector';
import Timeline from './Timeline';
import ExportModal from './ExportModal';
import ShortcutModal from './ShortcutModal';
import { RES_HEIGHT, exportPng, exportVideo } from './exporter';
import type { ExportSettings } from './exporter';
import { C } from './ui';

/** Deteksi viewport sempit (< 1024px) → layout bottom-sheet. */
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

const SHEET_ITEMS: { id: LeftTab | 'Properties'; icon: typeof Film; label: string }[] = [
  { id: 'Media', icon: Film, label: 'Media' },
  { id: 'Audio', icon: Music, label: 'Audio' },
  { id: 'Text', icon: Type, label: 'Text' },
  { id: 'Stickers', icon: Sticker, label: 'Stickers' },
  { id: 'Effects', icon: Sparkles, label: 'Effects' },
  { id: 'Transition', icon: Shuffle, label: 'Transition' },
  { id: 'Filters', icon: SlidersHorizontal, label: 'Filters' },
  { id: 'Properties', icon: SlidersHorizontal, label: 'Properties' },
];

export default function Studio({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const { leftW, setLeftW, rightW, setRightW, tlH, setTlH, sheet, setSheet, leftTab, setLeftTab } = useEditor();
  const narrow = useNarrow();
  const [busy, setBusy] = useState(false);
  const [vh, setVh] = useState(0); // 0 = belum diukur (prerender/SSR)
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const dragRef = useRef<{ axis: 'x' | 'y'; which: 'left' | 'right' | 'tl'; start: number; origin: number } | null>(null);

  /* ---------- Resizer ---------- */
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.axis === 'x') {
        const delta = e.clientX - d.start;
        if (d.which === 'left') setLeftW(d.origin + delta);
        else setRightW(d.origin - delta);
      } else {
        setTlH(d.origin - (e.clientY - d.start));
      }
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [setLeftW, setRightW, setTlH]);

  const startDrag = (axis: 'x' | 'y', which: 'left' | 'right' | 'tl', origin: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { axis, which, start: axis === 'x' ? e.clientX : e.clientY, origin };
  };

  /* ---------- Fullscreen otomatis saat Editor Studio dibuka ---------- */
  useEffect(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => undefined);
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  /* ---------- Shortcut keyboard (visual + aksi dasar) ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      const s = useEditor.getState();
      if (e.code === 'Space') { e.preventDefault(); s.setPlaying(!s.playing); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); s.undo(); }
      else if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { if (s.selected) { e.preventDefault(); s.deleteSelected(); } }
      else if (e.key.toLowerCase() === 's' && !e.ctrlKey) { e.preventDefault(); s.splitSelected(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- Export nyata (canvas → PNG / .webm) ---------- */
  const runExport = useCallback(async (settings: ExportSettings) => {
    setBusy(true);
    try {
      const stage = document.querySelector<HTMLElement>('[data-player-stage]');
      const videoEl = stage?.querySelector('video') || null;
      const imageEl = stage?.querySelector('img') || null;
      if (!videoEl && !imageEl) throw new Error('Tidak ada media di preview untuk diekspor');
      const s = useEditor.getState();
      const h = RES_HEIGHT[settings.resolution] || 1080;
      const srcW = videoEl?.videoWidth || imageEl?.naturalWidth || 16;
      const srcH = videoEl?.videoHeight || imageEl?.naturalHeight || 9;
      const w = Math.max(2, Math.round(h * (srcW / srcH || 16 / 9)));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas tidak tersedia di browser ini');
      const args = {
        ctx, w, h,
        time: s.playhead,
        assets: s.assets,
        clips: s.clips,
        videoEl,
        imageEl,
        style: { adjust: s.adjust, filterCss: s.filterCss, filterStrength: s.filterStrength, zoomPct: s.zoomPct, posX: s.posX, posY: s.posY, opacity: s.opacity },
      };
      if (videoEl) await exportVideo(args, settings);
      else await exportPng(args, settings.filename);
    } finally {
      setBusy(false);
    }
  }, []);

  const Divider = ({ axis, which }: { axis: 'x' | 'y'; which: 'left' | 'right' | 'tl' }) => (
    <span
      role="presentation"
      onPointerDown={startDrag(axis, which, which === 'left' ? leftW : which === 'right' ? rightW : tlHeight)}
      className={axis === 'x' ? 'w-[5px] shrink-0 cursor-col-resize' : 'h-[6px] shrink-0 cursor-row-resize'}
      style={{ background: C.border }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.accent; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = C.border; }}
    />
  );

  const viewportH = vh || 900;
  const tlHeight = tlH || Math.round(viewportH * 0.34);

  return (
    /* h-full/w-full (bukan 100vh): studio mengisi layer fixed inset-0 di PlaygroundPage sehingga
       bar navigasi bawah tidak terdorong keluar layar oleh address bar browser di HP. */
    <div className="flex h-full w-full flex-col overflow-hidden" style={{ background: C.app, color: C.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <TopBar onOpenMenu={onOpenMenu} />

      {narrow ? (
        <>
          {/* Layout sederhana: player atas, timeline bawah, panel jadi bottom sheet */}
          <div className="min-h-0 flex-1"><Player /></div>
          <div style={{ height: Math.min(tlHeight, viewportH * 0.42) }}><Timeline /></div>
          <nav className="flex shrink-0 items-center gap-1 overflow-x-auto border-t px-2 py-1.5 pb-[max(6px,env(safe-area-inset-bottom))] ed-scroll-x" style={{ background: C.panel, borderColor: C.border }}>
            {SHEET_ITEMS.map((it) => {
              const Icon = it.icon;
              const on = sheet !== '' && (it.id === 'Properties' ? sheet === 'right' : sheet === 'left' && leftTab === it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  aria-label={it.label}
                  onClick={() => {
                    if (it.id === 'Properties') setSheet(sheet === 'right' ? '' : 'right');
                    else {
                      setLeftTab(it.id as LeftTab);
                      setSheet(sheet === 'left' && leftTab === it.id ? '' : 'left');
                    }
                  }}
                  className="flex min-h-[46px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[4px] px-2.5 py-1"
                  style={{ background: on ? C.raised : 'transparent', color: on ? C.accent : C.text2 }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                  <span className="text-[10px] font-semibold">{it.label}</span>
                </button>
              );
            })}
          </nav>
          {sheet !== '' && (
            <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[62vh] overflow-hidden rounded-t-[10px] border-t shadow-2xl" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: C.border }}>
                <span className="text-[12px] font-bold">{sheet === 'right' ? 'Properties' : leftTab}</span>
                <button type="button" aria-label="Tutup panel" onClick={() => setSheet('')} style={{ color: C.text2 }}><X className="h-4 w-4" strokeWidth={2} /></button>
              </div>
              {/* Tinggi pasti (bukan max-h) → panel di dalamnya punya area scroll sendiri,
                  jadi daftar media/properties tidak terpotong dan tetap bisa digeser di HP. */}
              <div className="h-[54vh] overflow-hidden">
                {sheet === 'right' ? <Inspector /> : <MediaPanel />}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <div className="min-h-0 shrink-0" style={{ width: leftW }}><MediaPanel /></div>
            <Divider axis="x" which="left" />
            <div className="min-h-0 min-w-0 flex-1"><Player /></div>
            <Divider axis="x" which="right" />
            <div className="min-h-0 shrink-0" style={{ width: rightW }}><Inspector /></div>
          </div>
          <Divider axis="y" which="tl" />
          <div className="shrink-0" style={{ height: tlHeight }}><Timeline /></div>
        </>
      )}

      <ExportModal onExport={runExport} busy={busy} />
      <ShortcutModal />
    </div>
  );
}
