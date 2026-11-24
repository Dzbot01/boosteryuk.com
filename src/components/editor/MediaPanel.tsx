import { useMemo, useRef, useState } from 'react';
import {
  Film, Music, Type, Sticker, Sparkles, Shuffle, SlidersHorizontal,
  Plus, LayoutGrid, List, Play, ChevronDown, Search,
} from 'lucide-react';
import { useEditor } from './store';
import type { LeftTab } from './store';
import { C, IconBtn } from './ui';
import {
  AUDIO_CATEGORIES, AUDIO_TRACKS, EFFECT_CATEGORIES, EFFECTS, FILTER_CATEGORIES, FILTERS,
  STICKER_CHIPS, STICKERS, TEXT_CATEGORIES, TEXT_STYLES, TRANSITION_CATEGORIES, TRANSITIONS, makeThumb,
} from './mockData';
import { tcShort } from './types';
import type { MediaAsset } from './types';

const TABS: { id: LeftTab; icon: typeof Film }[] = [
  { id: 'Media', icon: Film },
  { id: 'Audio', icon: Music },
  { id: 'Text', icon: Type },
  { id: 'Stickers', icon: Sticker },
  { id: 'Effects', icon: Sparkles },
  { id: 'Transition', icon: Shuffle },
  { id: 'Filters', icon: SlidersHorizontal },
];

export default function MediaPanel() {
  const { leftTab, setLeftTab } = useEditor();
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.panel }}>
      {/* Tab bar: ikon di atas label, aktif = accent + underline */}
      <div className="flex shrink-0 border-b" style={{ borderColor: C.border }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = leftTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setLeftTab(t.id)}
              className="flex flex-1 flex-col items-center gap-1 border-b-2 py-2 transition-colors duration-[120ms]"
              style={{ borderColor: on ? C.accent : 'transparent', color: on ? C.accent : C.text2 }}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              <span className="text-[11px] font-semibold">{t.id}</span>
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto ed-scroll">
        {leftTab === 'Media' && <MediaTab />}
        {leftTab === 'Audio' && <AudioTab />}
        {leftTab === 'Text' && <TextTab />}
        {leftTab === 'Stickers' && <StickersTab />}
        {leftTab === 'Effects' && <EffectsTab />}
        {leftTab === 'Transition' && <TransitionTab />}
        {leftTab === 'Filters' && <FiltersTab />}
      </div>
    </div>
  );
}

/* ---------------- Media ---------------- */
function MediaTab() {
  const { assets, importFiles, addClip, removeAsset, playhead } = useEditor();
  const [filter, setFilter] = useState<'All' | 'Video' | 'Audio' | 'Image'>('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [libOpen, setLibOpen] = useState(false);
  const [ctx, setCtx] = useState<{ x: number; y: number; id: string } | null>(null);
  const [selected, setSelected] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);

  const list = useMemo(
    () => assets.filter((a) => (filter === 'All' ? true : filter === 'Video' ? a.kind === 'video' : filter === 'Audio' ? a.kind === 'audio' : a.kind === 'image')),
    [assets, filter],
  );

  const onDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) importFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex h-full min-h-0" ref={dropRef} onDragOver={(e) => e.preventDefault()} onDrop={onDropFiles}>
      {/* Sidebar kecil */}
      <div className="w-[90px] shrink-0 space-y-1 border-r p-2" style={{ borderColor: C.border }}>
        <button type="button" className="flex w-full items-center justify-center gap-1 rounded-[999px] px-2 py-1.5 text-[11px] font-bold" style={{ background: C.raised, color: C.text }}>
          Local <ChevronDown className="h-3 w-3" strokeWidth={2.2} />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full py-1 text-[11px] font-bold" style={{ color: C.accent }}>
          Import
        </button>
        <button type="button" onClick={() => setLibOpen((o) => !o)} className="flex w-full items-center justify-center gap-1 py-1 text-[11px]" style={{ color: C.text2 }}>
          <ChevronDown className="h-3 w-3" strokeWidth={2.2} style={{ transform: libOpen ? 'none' : 'rotate(-90deg)' }} /> Library
        </button>
        {libOpen && (
          <div className="space-y-1 pt-1">
            {['Stock video', 'Stock audio'].map((s) => (
              <p key={s} className="truncate px-1 text-[10px]" style={{ color: C.text3 }}>{s}</p>
            ))}
          </div>
        )}
      </div>

      {/* Konten */}
      <div className="min-w-0 flex-1 p-2.5">
        <div className="mb-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-8 items-center gap-1.5 rounded-[4px] px-2.5 text-[12px] font-bold transition-colors duration-[120ms] hover:brightness-110"
            style={{ background: C.raised, color: C.text }}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: C.accent }}>
              <Plus className="h-3 w-3 text-black" strokeWidth={3} />
            </span>
            Import
          </button>
          <span className="ml-auto flex items-center gap-1">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              aria-label="Filter media"
              className="h-7 rounded-[4px] border px-1.5 text-[11px] outline-none"
              style={{ background: C.raised, borderColor: C.border, color: C.text2 }}
            >
              {['All', 'Video', 'Audio', 'Image'].map((f) => <option key={f}>{f}</option>)}
            </select>
            <IconBtn label="List view" active={view === 'list'} onClick={() => setView('list')}><List className="h-3.5 w-3.5" strokeWidth={2} /></IconBtn>
            <IconBtn label="Grid view" active={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid className="h-3.5 w-3.5" strokeWidth={2} /></IconBtn>
          </span>
        </div>

        {view === 'grid' ? (
          <div className="grid grid-cols-2 gap-2.5">
            {list.map((a) => (
              <MediaCard key={a.id} asset={a} selected={selected === a.id} onSelect={() => setSelected(a.id)} onCtx={(x, y) => setCtx({ x, y, id: a.id })} />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {list.map((a) => (
              <button
                key={a.id}
                type="button"
                onDoubleClick={() => addClip(a, playhead)}
                onClick={() => setSelected(a.id)}
                className="flex w-full items-center gap-2 rounded-[4px] px-1.5 py-1 text-left transition-colors duration-[120ms] hover:bg-[#232327]"
                style={{ boxShadow: selected === a.id ? `inset 0 0 0 1px ${C.accent}` : undefined }}
              >
                <img src={a.thumb} alt="" className="h-7 w-11 rounded-[3px] object-cover" />
                <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: C.text2 }}>{a.name}</span>
                <span className="text-[10px]" style={{ color: C.text3 }}>{tcShort(a.duration)}</span>
              </button>
            ))}
          </div>
        )}
        {list.length === 0 && <p className="py-6 text-center text-[11px]" style={{ color: C.text3 }}>Tidak ada media. Klik Import atau tarik file ke sini.</p>}
      </div>

      <input ref={fileRef} type="file" accept=".mp4,.mov,.webm,.mp3,.aac,.wav,.jpg,.png,.gif,video/*,audio/*,image/*" multiple hidden onChange={(e) => { if (e.target.files) importFiles(e.target.files); e.target.value = ''; }} />

      {/* Context menu klik kanan */}
      {ctx && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setCtx(null)} onContextMenu={(e) => { e.preventDefault(); setCtx(null); }} />
          <div className="fixed z-50 w-40 overflow-hidden rounded-[6px] border py-1 shadow-xl" style={{ left: ctx.x, top: ctx.y, background: C.panel, borderColor: C.border }}>
            {[
              { label: 'Add to timeline', fn: () => { const a = assets.find((x) => x.id === ctx.id); if (a) addClip(a); } },
              { label: 'Rename', fn: () => undefined },
              { label: 'Delete', fn: () => removeAsset(ctx.id) },
            ].map((m) => (
              <button key={m.label} type="button" onClick={() => { m.fn(); setCtx(null); }} className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#232327]" style={{ color: m.label === 'Delete' ? '#ff6b6b' : C.text }}>
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MediaCard({ asset, selected, onSelect, onCtx }: { asset: MediaAsset; selected: boolean; onSelect: () => void; onCtx: (x: number, y: number) => void }) {
  const { addClip, playhead } = useEditor();
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/by-asset', asset.id); }}
      onDoubleClick={() => addClip(asset, playhead)}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onCtx(e.clientX, e.clientY); }}
      className="group cursor-pointer"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[6px] transition-transform duration-[120ms] group-hover:scale-[1.02]" style={{ background: '#000', boxShadow: selected ? `0 0 0 2px ${C.accent}` : undefined }}>
        {asset.thumb ? (
          <img src={asset.thumb} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <span className="flex h-full items-center justify-center"><Music className="h-5 w-5" style={{ color: C.text3 }} /></span>
        )}
        {asset.duration > 0 && (
          <span className="absolute right-1 top-1 rounded-[999px] px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: 'rgba(0,0,0,.62)' }}>
            {tcShort(asset.duration)}
          </span>
        )}
        <span className="absolute inset-0 hidden items-end justify-end bg-black/35 p-1.5 group-hover:flex">
          <button
            type="button"
            aria-label={`Tambah ${asset.name}`}
            onClick={(e) => { e.stopPropagation(); addClip(asset); }}
            className="flex h-6 w-6 items-center justify-center rounded-[4px]"
            style={{ background: C.accent }}
          >
            <Plus className="h-3.5 w-3.5 text-black" strokeWidth={3} />
          </button>
        </span>
      </div>
      <p className="mt-1 truncate text-[11px]" style={{ color: C.text2 }}>{asset.name}</p>
    </div>
  );
}

/* ---------------- Audio ---------------- */
function AudioTab() {
  const [cat, setCat] = useState(AUDIO_CATEGORIES[0]);
  const [preview, setPreview] = useState('');
  return (
    <div className="flex h-full min-h-0">
      <div className="w-[90px] shrink-0 space-y-1 border-r p-2" style={{ borderColor: C.border }}>
        {AUDIO_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className="w-full rounded-[999px] px-1 py-1.5 text-[10.5px] font-semibold" style={{ background: cat === c ? C.raised : 'transparent', color: cat === c ? C.text : C.text2 }}>
            {c}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-1 p-2.5">
        {AUDIO_TRACKS.filter((t) => t.category === cat).map((t) => (
          <div key={t.id} className="flex items-center gap-2 rounded-[4px] px-1.5 py-1.5 transition-colors duration-[120ms] hover:bg-[#232327]">
            <button type="button" aria-label={`Preview ${t.name}`} onClick={() => setPreview(preview === t.id ? '' : t.id)} className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: preview === t.id ? C.accent : C.raised }}>
              <Play className="h-3 w-3" style={{ color: preview === t.id ? '#000' : C.text2 }} strokeWidth={2.4} />
            </button>
            <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: C.text }}>{t.name}</span>
            <span className="text-[10px]" style={{ color: C.text3 }}>00:{String(12 + t.id.charCodeAt(1)).padStart(2, '0')}</span>
            <button type="button" aria-label={`Tambah ${t.name}`} className="flex h-6 w-6 items-center justify-center rounded-[4px]" style={{ background: C.raised }}>
              <Plus className="h-3.5 w-3.5" style={{ color: C.accent }} strokeWidth={2.6} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Text ---------------- */
function TextTab() {
  const [cat, setCat] = useState(TEXT_CATEGORIES[0]);
  const [picked, setPicked] = useState('');
  return (
    <div className="flex h-full min-h-0">
      <div className="w-[90px] shrink-0 space-y-1 border-r p-2" style={{ borderColor: C.border }}>
        {TEXT_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className="w-full rounded-[999px] px-1 py-1.5 text-[10.5px] font-semibold" style={{ background: cat === c ? C.raised : 'transparent', color: cat === c ? C.text : C.text2 }}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 p-2.5">
        {TEXT_STYLES.map((t) => (
          <button key={t.id} type="button" onClick={() => setPicked(t.id)} className="flex aspect-[16/10] flex-col items-center justify-center rounded-[6px] transition-transform duration-[120ms] hover:scale-[1.02]" style={{ background: C.raised, boxShadow: picked === t.id ? `0 0 0 2px ${C.accent}` : undefined }}>
            <span className={t.name === 'Bold title' ? 'text-[15px] font-black' : t.name === 'Neon' ? 'text-[13px] font-bold' : 'text-[13px] font-semibold'} style={{ color: t.name === 'Neon' ? '#7df9ff' : t.name === 'Gradient' ? '#ff8ac2' : C.text, textShadow: t.name === 'Neon' ? '0 0 8px #00d1e0' : undefined, WebkitTextStroke: t.name === 'Outline' ? '1px #e8e8ea' : undefined }}>
              {t.name === 'Subtitle' ? 'Subtitle text' : 'Aa'}
            </span>
            <span className="mt-1 text-[10px]" style={{ color: C.text2 }}>{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Stickers ---------------- */
function StickersTab() {
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('Emoji');
  const list = STICKERS.filter((s) => (chip === 'Baru' ? true : s.category === chip) && s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-2.5">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: C.text3 }} strokeWidth={2} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari stiker…" aria-label="Cari stiker" className="h-8 w-full rounded-[4px] border pl-7 pr-2 text-[12px] outline-none" style={{ background: C.raised, borderColor: C.border, color: C.text }} />
      </div>
      <div className="mb-2.5 flex flex-wrap gap-1.5">
        {STICKER_CHIPS.map((c) => (
          <button key={c} type="button" onClick={() => setChip(c)} className="rounded-[999px] px-2.5 py-1 text-[11px] font-semibold transition-colors duration-[120ms]" style={{ background: chip === c ? C.accent : C.raised, color: chip === c ? '#000' : C.text2 }}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {list.map((s) => (
          <button key={s.id} type="button" className="group relative flex aspect-square items-center justify-center rounded-[6px] transition-transform duration-[120ms] hover:scale-[1.03]" style={{ background: C.raised }}>
            <span className="text-[26px]">{s.emoji}</span>
            <span className="absolute bottom-1 right-1 hidden h-5 w-5 items-center justify-center rounded-[4px] group-hover:flex" style={{ background: C.accent }}>
              <Plus className="h-3 w-3 text-black" strokeWidth={3} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Effects / Transition / Filters ---------------- */
function CategoryCards({ cats, items, sampleCss }: { cats: string[]; items: { id: string; name: string; category: string; css?: string }[]; sampleCss?: boolean }) {
  const [cat, setCat] = useState(cats[0]);
  const sample = useMemo(() => (sampleCss ? makeThumb('lake') : ''), [sampleCss]);
  const list = items.filter((i) => i.category === cat);
  return (
    <div className="flex h-full min-h-0">
      <div className="w-[90px] shrink-0 space-y-1 border-r p-2" style={{ borderColor: C.border }}>
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className="w-full rounded-[999px] px-1 py-1.5 text-[10.5px] font-semibold" style={{ background: cat === c ? C.raised : 'transparent', color: cat === c ? C.text : C.text2 }}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 p-2.5">
        {list.map((i) => (
          <button key={i.id} type="button" className="group relative overflow-hidden rounded-[6px] transition-transform duration-[120ms] hover:scale-[1.02]" style={{ background: C.raised }}>
            <span className="block aspect-[16/10]" style={sampleCss ? { backgroundImage: `url(${sample})`, backgroundSize: 'cover', filter: i.css } : { background: `linear-gradient(135deg, ${C.raised}, #2e2e34)` }}>
              {!sampleCss && <Sparkles className="m-auto h-5 w-5" style={{ color: C.text3 }} strokeWidth={1.8} />}
            </span>
            <span className="block truncate px-1.5 py-1 text-left text-[10.5px]" style={{ color: C.text2 }}>{i.name}</span>
            <span className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-[4px] group-hover:flex" style={{ background: C.accent }}>
              <Plus className="h-3 w-3 text-black" strokeWidth={3} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EffectsTab() { return <CategoryCards cats={EFFECT_CATEGORIES} items={EFFECTS} />; }
function TransitionTab() { return <CategoryCards cats={TRANSITION_CATEGORIES} items={TRANSITIONS} />; }
function FiltersTab() {
  const sample = useMemo(() => makeThumb('lake'), []);
  const [cat, setCat] = useState(FILTER_CATEGORIES[0]);
  const active = useEditor((s) => s.filterName);
  const setFilter = useEditor((s) => s.setFilter);
  return (
    <div className="flex h-full min-h-0">
      <div className="w-[90px] shrink-0 space-y-1 border-r p-2" style={{ borderColor: C.border }}>
        {FILTER_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className="w-full rounded-[999px] px-1 py-1.5 text-[10.5px] font-semibold" style={{ background: cat === c ? C.raised : 'transparent', color: cat === c ? C.text : C.text2 }}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 p-2.5">
        {FILTERS.filter((f) => f.category === cat).map((f) => (
          <button key={f.id} type="button" aria-label={`Filter ${f.name}`} onClick={() => setFilter(f.name, f.css || '')} className="group relative overflow-hidden rounded-[6px] transition-transform duration-[120ms] hover:scale-[1.02]" style={{ background: C.raised, boxShadow: active === f.name ? `0 0 0 2px ${C.accent}` : undefined }}>
            <span className="block aspect-[16/10]" style={{ backgroundImage: `url(${sample})`, backgroundSize: 'cover', filter: f.css }} />
            <span className="block truncate px-1.5 py-1 text-left text-[10.5px]" style={{ color: C.text2 }}>{f.name}</span>
            <span className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-[4px] group-hover:flex" style={{ background: C.accent }}>
              <Plus className="h-3 w-3 text-black" strokeWidth={3} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
