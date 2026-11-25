import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowUpDown,
  Bell,
  BookOpen,
  Box,
  Boxes,
  Carrot,
  ChevronDown,
  CircleHelp,
  Crown,
  Download,
  Film,
  Folder,
  Gift,
  Image as ImageIcon,
  Info,
  Layers,
  LayoutGrid,
  LoaderCircle,
  Maximize,
  Menu as MenuIcon,
  MoreHorizontal,
  PersonStanding,
  Rabbit,
  RotateCw,
  Search,
  Slash,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { v2funGenerate, v2funTask, v2funGlbUrl, v2funStatusLabel } from '../services/v2funApi';

/**
 * Generator3dStudio — dashboard "AI 3D Model Generator" (menu Playground: Generate 3D Model).
 * Gaya dark-mode workspace tool generatif: navbar, sidebar sempit, panel pengaturan,
 * canvas tengah, dan Asset Library. Pembuatan model memakai API V2Fun lewat proxy
 * php-api/v2fun.php (task-based: generate → polling task → download GLB → viewer three.js).
 * Data pustaka aset dimulai dari dummy; hasil generate menambah kartu baru.
 */

type SideTab = 'image' | 'model' | 'animation';
type SegTab = 'image' | 'layers' | 'text';
type Tier = 'Standard' | 'Pro' | 'Ultra';

const TIER_COST: Record<Tier, number> = { Standard: 30, Pro: 60, Ultra: 120 };
const PAGE_SIZE = 8;
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB sesuai dokumen API
const MAX_SIDE = 4096;
const MIN_SIDE = 64;

interface Asset {
  id: string;
  name: string;
  kind: 'mock' | 'generated';
  isNew?: boolean;
  /** URL GLB (hasil generate) — null untuk aset dummy. */
  modelUrl?: string | null;
  /** Preview gambar (data URI) bila ada. */
  thumb?: string | null;
  createdAt: number;
}

interface GenState {
  status: string;
  progress: number;
  startedAt: number;
  taskUuid: string;
}

export default function Generator3dStudio({ onOpenMenu }: { onOpenMenu?: () => void }) {
  /* ---------------- state utama ---------------- */
  const [sideTab, setSideTab] = useState<SideTab>('model');
  const [segTab, setSegTab] = useState<SegTab>('image');
  const [tier, setTier] = useState<Tier>('Pro');
  const [tierOpen, setTierOpen] = useState(false);
  const [withTexture, setWithTexture] = useState(true);
  const [hdTexture, setHdTexture] = useState(false);
  const [pbrTexture, setPbrTexture] = useState(false);
  const [refImage, setRefImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [credits, setCredits] = useState(320);
  const [assets, setAssets] = useState<Asset[]>([
    { id: 'mock-1', name: 'Character in White Military Uniform', kind: 'mock', isNew: true, modelUrl: null, thumb: null, createdAt: Date.now() - 86400000 },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [gen, setGen] = useState<GenState | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (pollRef.current !== null) window.clearTimeout(pollRef.current);
    };
  }, []);

  const selected = assets.find((a) => a.id === selectedId) ?? null;
  const canGenerate = !gen && (segTab === 'text' ? prompt.trim().length > 0 : refImage !== null);

  /* ---------------- upload gambar referensi ---------------- */
  const acceptImage = (file: File) => {
    setError('');
    if (!/image\/(jpeg|png|webp)/.test(file.type)) { setError('Format tidak didukung. Gunakan .jpg, .jpeg, .png, atau .webp.'); return; }
    if (file.size > MAX_BYTES) { setError('Ukuran gambar melebihi 20MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        if (img.width < MIN_SIDE || img.height < MIN_SIDE || img.width > MAX_SIDE || img.height > MAX_SIDE) {
          // Gambar >4096px diperkeclient-side agar lolos batas API & post_max_size hosting.
          if (img.width > MAX_SIDE || img.height > MAX_SIDE) {
            setRefImage({ dataUrl: downscale(img, MAX_SIDE), name: file.name });
          } else {
            setError(`Sisi gambar minimal ${MIN_SIDE}px.`);
          }
          return;
        }
        // Kompres gambar besar supaya payload base64 aman melewati PHP hosting.
        const need = file.size > 1_500_000 || img.width > 2048;
        setRefImage({ dataUrl: need ? downscale(img, 2048) : raw, name: file.name });
      };
      img.onerror = () => setError('Gambar tidak bisa dibaca.');
      img.src = raw;
    };
    reader.onerror = () => setError('Gagal membaca berkas.');
    reader.readAsDataURL(file);
  };

  /* ---------------- alur generate (task-based) ---------------- */
  const startGenerate = async () => {
    if (!canGenerate) return;
    setError('');
    const cost = TIER_COST[tier];
    const req =
      segTab === 'text'
        ? { prompt: prompt.trim(), with_texture: withTexture, hd_texture: hdTexture, pbr_texture: pbrTexture }
        : { prompt: prompt.trim() || undefined, image_data: refImage?.dataUrl, with_texture: withTexture, hd_texture: hdTexture, pbr_texture: pbrTexture };
    const startedAt = Date.now();
    setGen({ status: 'QUEUED', progress: 6, startedAt, taskUuid: '' });
    const r = await v2funGenerate(req);
    if (!aliveRef.current) return;
    if (!r.ok || !r.task?.task_uuid) {
      setGen(null);
      setError(r.message || 'Gagal memulai tugas pembuatan model.');
      return;
    }
    const uuid = r.task.task_uuid;
    setGen({ status: r.task.status || 'QUEUED', progress: 12, startedAt, taskUuid: uuid });
    const poll = async () => {
      if (!aliveRef.current) return;
      const t = await v2funTask(uuid);
      if (!aliveRef.current) return;
      if (!t.ok || !t.task) {
        setGen(null);
        setError(t.message || 'Gagal membaca status tugas.');
        return;
      }
      const task = t.task;
      const elapsed = (Date.now() - startedAt) / 1000;
      if (task.status === 'COMPLETED') {
        const url = v2funGlbUrl(task);
        const asset: Asset = {
          id: uuid,
          name: (prompt.trim() || refImage?.name || 'Model 3D').slice(0, 60),
          kind: 'generated',
          isNew: true,
          modelUrl: url,
          thumb: refImage?.dataUrl ?? null,
          createdAt: Date.now(),
        };
        setAssets((prev) => [asset, ...prev]);
        setSelectedId(asset.id);
        setPage(1);
        setCredits((c) => Math.max(0, c - cost));
        setGen(null);
        return;
      }
      if (task.status === 'FAILED') {
        setGen(null);
        setError(task.message || task.error || 'Pembuatan model gagal di server V2Fun.');
        return;
      }
      const base = task.status === 'RUNNING' ? 45 : 18;
      const progress = Math.min(94, base + Math.min(45, elapsed / 2));
      setGen({ status: task.status, progress, startedAt, taskUuid: uuid });
      pollRef.current = window.setTimeout(poll, 4000);
    };
    pollRef.current = window.setTimeout(poll, 2500);
  };

  /* ---------------- pustaka aset ---------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? assets.filter((a) => a.name.toLowerCase().includes(q)) : assets;
  }, [assets, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f0f0f] font-sans text-white">
      <Navbar credits={credits} onOpenMenu={onOpenMenu} />
      <div className="flex min-h-0 flex-1 gap-4 p-4">
        <Sidebar tab={sideTab} onTab={setSideTab} />

        {/* ---------- Panel pengaturan ---------- */}
        <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] md:w-[380px]">
          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            {/* tab segmented */}
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] p-1">
              {(
                [
                  ['image', ImageIcon, 'Reference image'],
                  ['layers', Layers, 'Tekstur & lapisan'],
                  ['text', Type, 'Prompt teks'],
                ] as [SegTab, typeof ImageIcon, string][]
              ).map(([id, Icon, label]) => (
                <button
                  key={id}
                  title={label}
                  aria-label={label}
                  aria-pressed={segTab === id}
                  onClick={() => setSegTab(id)}
                  className={`flex h-9 items-center justify-center rounded-lg transition-colors duration-150 ${
                    segTab === id ? 'bg-white text-[#0f0f0f]' : 'text-[#8a8a8a] hover:bg-[#2a2a2a] hover:text-white'
                  }`}
                >
                  {id === 'text' ? <Type className="h-4 w-4" strokeWidth={2.2} /> : <Icon className="h-4 w-4" strokeWidth={2.2} />}
                </button>
              ))}
            </div>

            {segTab === 'text' && (
              <section>
                <PanelTitle title="Text Prompt" />
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, 2000))}
                  rows={5}
                  placeholder="mis. a classic wooden dining chair, clean design, natural wood texture"
                  className="mt-2 w-full resize-none rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2.5 text-[13px] text-white placeholder:text-[#8a8a8a] focus:border-[#00d4c8] focus:outline-none"
                />
                <p className="mt-1 text-right text-[10.5px] text-[#8a8a8a]">{prompt.length}/2000</p>
              </section>
            )}

            {segTab !== 'text' && (
              <section>
                <PanelTitle title="Reference Image" right={<BookOpen className="h-4 w-4 text-[#8a8a8a]" />} />
                <UploadDropzone image={refImage} onFile={acceptImage} onClear={() => setRefImage(null)} />
              </section>
            )}

            <section>
              <PanelTitle title="AI 3D Model" />
              <div className="relative mt-2">
                <button
                  onClick={() => setTierOpen((o) => !o)}
                  aria-haspopup="listbox"
                  aria-expanded={tierOpen}
                  className="flex w-full items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2.5 text-[13px] font-semibold transition-colors duration-150 hover:border-[#00d4c8]/60"
                >
                  <span className="flex items-center gap-2">
                    <Rabbit className="h-4 w-4 text-[#00d4c8]" strokeWidth={2.2} />
                    V2Fun Mesh · {tier}
                  </span>
                  <ChevronDown className={`h-4 w-4 text-[#8a8a8a] transition-transform duration-150 ${tierOpen ? 'rotate-180' : ''}`} />
                </button>
                {tierOpen && (
                  <ul role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl">
                    {(['Standard', 'Pro', 'Ultra'] as Tier[]).map((t) => (
                      <li key={t}>
                        <button
                          role="option"
                          aria-selected={tier === t}
                          onClick={() => { setTier(t); setTierOpen(false); }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-[#2a2a2a] ${tier === t ? 'text-[#00d4c8]' : 'text-white'}`}
                        >
                          {t}
                          <span className="flex items-center gap-1 text-[11px] text-[#8a8a8a]">
                            <Carrot className="h-3 w-3 text-orange-400" /> {TIER_COST[t]}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section>
              <PanelTitle title="Texture" right={<Info className="h-4 w-4 text-[#8a8a8a]" />} />
              <div className="mt-2 space-y-2">
                <ToggleRow label="Texture (AI-generated maps)" checked={withTexture} onChange={setWithTexture} />
                <ToggleRow label="HD Texture (8K)" checked={hdTexture} disabled={!withTexture} onChange={setHdTexture} />
                <ToggleRow label="PBR (metallic/roughness)" checked={pbrTexture} disabled={!withTexture} onChange={setPbrTexture} />
              </div>
            </section>

            {error && (
              <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-300">
                {error}
              </p>
            )}
          </div>

          {/* tombol generate sticky */}
          <div className="border-t border-[#2a2a2a] p-4">
            <button
              onClick={() => void startGenerate()}
              disabled={!canGenerate}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-bold transition-colors duration-150 ${
                canGenerate ? 'bg-[#00d4c8] text-[#062a28] hover:bg-[#00bfb4]' : 'cursor-not-allowed bg-[#2a2a2a] text-[#8a8a8a]'
              }`}
            >
              {gen ? <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2.4} /> : <Carrot className="h-4 w-4" strokeWidth={2.2} />}
              {gen ? 'Generating…' : 'Generate Now'}
              {!gen && <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11.5px] font-extrabold tabular-nums">{TIER_COST[tier]}</span>}
            </button>
            <div className="mt-2 flex items-center justify-between text-[11px] text-[#8a8a8a]">
              <span>Estimated 2 min</span>
              <button className="transition-colors duration-150 hover:text-[#00d4c8]">Credit Details &gt;</button>
            </div>
          </div>
        </aside>

        {/* ---------- Canvas tengah ---------- */}
        <main className="min-w-0 flex-1 overflow-hidden rounded-2xl border-2 border-[#2a2a2a] bg-[#1a1a1a]">
          {gen ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <LoaderCircle className="h-10 w-10 animate-spin text-[#00d4c8]" strokeWidth={2} />
              <p className="text-[14px] font-bold">{v2funStatusLabel(gen.status)}</p>
              <div className="h-1.5 w-64 overflow-hidden rounded-full bg-[#2a2a2a]">
                <div className="h-full rounded-full bg-[#00d4c8] transition-all duration-700" style={{ width: `${gen.progress}%` }} />
              </div>
              <p className="text-[11.5px] text-[#8a8a8a]">Task {gen.taskUuid || '…'} · progres {Math.round(gen.progress)}%</p>
            </div>
          ) : selected ? (
            selected.modelUrl ? (
              <ModelViewer src={selected.modelUrl} name={selected.name} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#0f0f0f]">
                  {selected.thumb ? <img src={selected.thumb} alt="" className="h-full w-full rounded-2xl object-cover" /> : <Boxes className="h-9 w-9 text-[#8a8a8a]" strokeWidth={1.6} />}
                </span>
                <p className="text-[14px] font-bold">{selected.name}</p>
                <p className="max-w-[320px] text-[12px] text-[#8a8a8a]">Aset contoh (dummy) — belum memiliki berkas GLB. Hasil generate akan tampil sebagai viewer 3D yang bisa diputar.</p>
              </div>
            )
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <SmilingStar />
              <p className="max-w-[340px] text-[13.5px] text-[#8a8a8a]">Generate a creation or select from your asset library.</p>
            </div>
          )}
        </main>

        {/* ---------- Asset Library ---------- */}
        <aside className="hidden w-[420px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] xl:flex xl:w-[580px]">
          <div className="flex items-center gap-2 p-4">
            <h2 className="mr-auto text-[15px] font-extrabold">Asset Library</h2>
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8a8a]" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search asset"
                aria-label="Cari aset"
                className="h-9 w-40 rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] pl-8 pr-3 text-[12.5px] placeholder:text-[#8a8a8a] focus:border-[#00d4c8] focus:outline-none"
              />
            </label>
            <label className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#00d4c8] px-3 text-[12.5px] font-bold text-[#062a28] transition-colors duration-150 hover:bg-[#00bfb4]">
              <Upload className="h-3.5 w-3.5" strokeWidth={2.4} /> Upload
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { acceptImage(f); setSegTab('image'); }
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div className="flex items-center gap-1 px-4">
            <div className="flex items-center gap-1 rounded-xl border border-[#2a2a2a] p-1">
              {[Folder, LayoutGrid, MoreHorizontal, ImageIcon, Box, Slash, PersonStanding].map((Icon, i) => (
                <button
                  key={i}
                  aria-label={`Tampilan pustaka ${i + 1}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors duration-150 ${i === 0 ? 'bg-[#2a2a2a] text-[#00d4c8]' : 'text-[#8a8a8a] hover:bg-[#2a2a2a] hover:text-white'}`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              ))}
              <span className="mx-1 h-5 w-px bg-[#2a2a2a]" />
              {[ArrowUpDown, Maximize].map((Icon, i) => (
                <button key={i} aria-label={`Utilitas pustaka ${i + 1}`} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8a8a8a] transition-colors duration-150 hover:bg-[#2a2a2a] hover:text-white">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <p className="truncate text-[13px] font-bold text-[#8a8a8a]">{filtered[0]?.name ?? 'Belum ada aset'}</p>
            <button className="shrink-0 text-[12px] font-semibold text-[#00d4c8] transition-colors duration-150 hover:underline">View All ({filtered.length})</button>
          </div>

          <div className="grid flex-1 auto-rows-min grid-cols-3 gap-3 overflow-y-auto p-4 lg:grid-cols-4">
            {pageItems.map((a) => (
              <AssetCard key={a.id} asset={a} active={a.id === selectedId} onPick={() => setSelectedId(a.id)} />
            ))}
            {pageItems.length === 0 && <p className="col-span-full py-8 text-center text-[12.5px] text-[#8a8a8a]">Tidak ada aset yang cocok.</p>}
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-[#2a2a2a] p-3">
            <button aria-label="Halaman sebelumnya" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8a8a8a] transition-colors duration-150 hover:bg-[#2a2a2a] hover:text-white disabled:opacity-40">
              ‹
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPage(n)} className={`h-7 w-7 rounded-lg text-[12px] font-bold transition-colors duration-150 ${n === safePage ? 'text-[#00d4c8]' : 'text-[#8a8a8a] hover:bg-[#2a2a2a] hover:text-white'}`}>
                {n}
              </button>
            ))}
            <button aria-label="Halaman berikutnya" disabled={safePage === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="flex h-7 w-7 items-center justify-center rounded-lg text-[#8a8a8a] transition-colors duration-150 hover:bg-[#2a2a2a] hover:text-white disabled:opacity-40">
              ›
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ================= Navbar ================= */
function Navbar({ credits, onOpenMenu }: { credits: number; onOpenMenu?: () => void }) {
  const [wsOpen, setWsOpen] = useState(false);
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#2a2a2a] px-4">
      {onOpenMenu && (
        <button onClick={onOpenMenu} aria-label="Menu Playground" className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a8a8a] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-white">
          <MenuIcon className="h-5 w-5" strokeWidth={2.2} />
        </button>
      )}
      <span className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-tight">
        <Rabbit className="h-5 w-5 text-[#00d4c8]" strokeWidth={2.2} /> V2FUN
      </span>
      <div className="relative">
        <button onClick={() => setWsOpen((o) => !o)} className="flex items-center gap-1.5 rounded-xl border border-[#00d4c8]/50 px-3 py-1.5 text-[12.5px] font-bold text-[#00d4c8] transition-colors duration-150 hover:bg-[#00d4c8]/10">
          Workspace <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${wsOpen ? 'rotate-180' : ''}`} />
        </button>
        {wsOpen && (
          <ul className="absolute z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-[12.5px] shadow-xl">
            {['Workspace Pribadi', 'Tim Boosteryuk'].map((w, i) => (
              <li key={w}>
                <button onClick={() => setWsOpen(false)} className={`w-full px-3 py-2 text-left transition-colors duration-150 hover:bg-[#2a2a2a] ${i === 0 ? 'text-[#00d4c8]' : 'text-white'}`}>{w}</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="hidden items-center gap-1 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold text-[#8a8a8a] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-white sm:flex">
        Resources <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button className="hidden rounded-xl px-3 py-1.5 text-[12.5px] font-semibold text-[#8a8a8a] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-white sm:block">API</button>

      <div className="ml-auto flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] px-2.5 py-1.5 text-[12.5px] font-bold tabular-nums">
          <Carrot className="h-4 w-4 text-orange-400" strokeWidth={2.2} /> {credits}
        </span>
        <button className="flex items-center gap-1.5 rounded-xl bg-[#f472b6] px-3 py-1.5 text-[12.5px] font-bold text-[#3b0f24] transition-colors duration-150 hover:bg-[#ec4899]">
          <Crown className="h-3.5 w-3.5" strokeWidth={2.4} /> Subscribe
        </button>
        <button aria-label="Discord" className="hidden h-9 w-9 items-center justify-center rounded-xl text-[#8a8a8a] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-white md:flex">
          <DiscordGlyph />
        </button>
        <button aria-label="Hadiah" className="relative hidden h-9 w-9 items-center justify-center rounded-xl text-[#8a8a8a] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-white md:flex">
          <Gift className="h-4 w-4" strokeWidth={2.2} />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
        </button>
        <button aria-label="Bantuan" className="hidden h-9 w-9 items-center justify-center rounded-xl text-[#8a8a8a] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-white md:flex">
          <CircleHelp className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <button aria-label="Notifikasi" className="flex h-9 w-9 items-center justify-center rounded-xl text-[#8a8a8a] transition-colors duration-150 hover:bg-[#1a1a1a] hover:text-white">
          <Bell className="h-4 w-4" strokeWidth={2.2} />
        </button>
        <span className="flex h-9 w-9 select-none items-center justify-center rounded-full bg-[#2a2a2a] text-[13px] font-extrabold">R</span>
      </div>
    </header>
  );
}

/* ================= Sidebar sempit ================= */
function Sidebar({ tab, onTab }: { tab: SideTab; onTab: (t: SideTab) => void }) {
  const items: [SideTab, typeof ImageIcon, string][] = [
    ['image', ImageIcon, 'Image'],
    ['model', Box, 'Model'],
    ['animation', Film, 'Animation'],
  ];
  return (
    <nav className="flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] py-3">
      {items.map(([id, Icon, label]) => (
        <button
          key={id}
          onClick={() => onTab(id)}
          aria-pressed={tab === id}
          className={`flex w-full flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold transition-colors duration-150 ${tab === id ? 'text-[#00d4c8]' : 'text-[#8a8a8a] hover:bg-[#2a2a2a] hover:text-white'}`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.1} />
          {label}
        </button>
      ))}
      <button className="mt-auto flex w-full flex-col items-center gap-1 py-2.5 text-[10.5px] font-bold text-[#8a8a8a] transition-colors duration-150 hover:bg-[#2a2a2a] hover:text-white">
        <BookOpen className="h-5 w-5" strokeWidth={2.1} />
        Tutorials
      </button>
    </nav>
  );
}

/* ================= Dropzone ================= */
function UploadDropzone({ image, onFile, onClear }: { image: { dataUrl: string; name: string } | null; onFile: (f: File) => void; onClear: () => void }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  if (image) {
    return (
      <div className="relative mt-2 overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#0f0f0f]">
        <img src={image.dataUrl} alt={image.name} className="h-40 w-full object-contain" />
        <button onClick={onClear} aria-label="Hapus gambar referensi" className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-white transition-colors duration-150 hover:bg-rose-500">
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
        </button>
        <p className="truncate border-t border-[#2a2a2a] px-2 py-1.5 text-[11px] text-[#8a8a8a]">{image.name}</p>
      </div>
    );
  }
  return (
    <button
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={`mt-2 flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 transition-colors duration-150 ${drag ? 'border-[#00d4c8] bg-[#00d4c8]/5' : 'border-[#2a2a2a] hover:border-[#00d4c8]/60'}`}
    >
      <ImageIcon className="h-7 w-7 text-[#8a8a8a]" strokeWidth={1.6} />
      <span className="text-[13px] font-bold">Upload / Drag &amp; Drop Image</span>
      <span className="text-center text-[10.5px] leading-relaxed text-[#8a8a8a]">
        Supported: .jpg, .jpeg, .png, .webp<br />Image Size: 64–4096 px<br />Max 20MB
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </button>
  );
}

/* ================= Kartu aset ================= */
function AssetCard({ asset, active, onPick }: { asset: Asset; active: boolean; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      aria-pressed={active}
      className={`group relative overflow-hidden rounded-xl border bg-[#0f0f0f] transition-colors duration-150 ${active ? 'border-[#00d4c8]' : 'border-[#2a2a2a] hover:border-[#8a8a8a]'}`}
    >
      <span className="flex aspect-square w-full items-center justify-center">
        {asset.thumb ? (
          <img src={asset.thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <Boxes className="h-8 w-8 text-[#3a3a3a] transition-colors duration-150 group-hover:text-[#8a8a8a]" strokeWidth={1.4} />
        )}
      </span>
      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a]/90">
        <Box className="h-3 w-3 text-[#8a8a8a]" strokeWidth={2} />
      </span>
      {asset.isNew && <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" aria-label="Aset baru" />}
      <span className="block truncate border-t border-[#2a2a2a] px-2 py-1.5 text-left text-[10.5px] font-semibold text-[#8a8a8a]">{asset.name}</span>
    </button>
  );
}

/* ================= Viewer 3D (three.js, drag untuk memutar) ================= */
function ModelViewer({ src, name }: { src: string; name: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || failed) return;
    let disposed = false;
    let raf = 0;
    let renderer: { dispose: () => void; domElement: HTMLCanvasElement } | null = null;
    let pivotRot = { x: 0, y: 0 };
    let dragging = false;
    let last = { x: 0, y: 0 };
    const cleanupFns: (() => void)[] = [];

    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        if (disposed || !host.isConnected) return;
        const w = host.clientWidth || 600;
        const h = host.clientHeight || 400;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 200);
        const webgl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer = webgl;
        webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        webgl.setSize(w, h);
        webgl.domElement.style.width = '100%';
        webgl.domElement.style.height = '100%';
        webgl.domElement.style.display = 'block';
        webgl.domElement.style.cursor = 'grab';
        host.appendChild(webgl.domElement);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x223333, 1.6));
        const key = new THREE.DirectionalLight(0xffffff, 2.2);
        key.position.set(2.5, 3.5, 2.5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x00d4c8, 1.1);
        rim.position.set(-3, 1.5, -2.5);
        scene.add(rim);

        const gltf = await new GLTFLoader().loadAsync(src);
        if (disposed) return;
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z) || 1;
        model.position.set(-center.x, -center.y, -center.z);
        const pivot = new THREE.Group();
        pivot.add(model);
        scene.add(pivot);
        camera.position.set(0, radius * 0.25, radius * 2.4);
        camera.lookAt(0, 0, 0);

        let mixer: InstanceType<typeof THREE.AnimationMixer> | null = null;
        let clock: InstanceType<typeof THREE.Clock> | null = null;
        if (gltf.animations?.length) {
          clock = new THREE.Clock();
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).play();
        }

        const el = webgl.domElement;
        const down = (e: PointerEvent) => { dragging = true; last = { x: e.clientX, y: e.clientY }; el.style.cursor = 'grabbing'; };
        const move = (e: PointerEvent) => {
          if (!dragging) return;
          pivotRot.y += (e.clientX - last.x) * 0.008;
          pivotRot.x = Math.max(-1.2, Math.min(1.2, pivotRot.x + (e.clientY - last.y) * 0.006));
          last = { x: e.clientX, y: e.clientY };
        };
        const up = () => { dragging = false; el.style.cursor = 'grab'; };
        el.addEventListener('pointerdown', down);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        cleanupFns.push(() => {
          el.removeEventListener('pointerdown', down);
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
        });
        const resize = () => {
          const nw = host.clientWidth, nh = host.clientHeight;
          if (!nw || !nh) return;
          webgl.setSize(nw, nh);
          camera.aspect = nw / nh;
          camera.updateProjectionMatrix();
        };
        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
        ro?.observe(host);
        cleanupFns.push(() => ro?.disconnect());

        let idle = 0;
        const tick = () => {
          if (disposed) return;
          raf = requestAnimationFrame(tick);
          if (document.hidden) return;
          idle += 1 / 60;
          if (!dragging) pivotRot.y += 0.0035; // putar pelan saat idle
          pivot.rotation.set(pivotRot.x, pivotRot.y, 0);
          mixer?.update(clock ? clock.getDelta() : 1 / 60);
          webgl.render(scene, camera);
        };
        tick();
      } catch (err) {
        console.warn('[Generator3dStudio] viewer GLB gagal:', err);
        if (!disposed) setFailed(true);
      }
    })();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      cleanupFns.forEach((fn) => fn());
      try { renderer?.dispose(); } catch { /* sudah dilepas */ }
      host.innerHTML = '';
    };
  }, [src, failed]);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Boxes className="h-10 w-10 text-[#8a8a8a]" strokeWidth={1.5} />
        <p className="text-[13.5px] font-bold">{name}</p>
        <p className="max-w-[360px] text-[12px] text-[#8a8a8a]">Viewer 3D tidak bisa memuat berkas GLB ini di browser (CORS/format). Unduh berkasnya untuk dibuka di aplikasi 3D.</p>
        <a href={src} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-[#00d4c8] px-3 py-2 text-[12.5px] font-bold text-[#062a28] transition-colors duration-150 hover:bg-[#00bfb4]">
          <Download className="h-3.5 w-3.5" strokeWidth={2.4} /> Unduh GLB
        </a>
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" aria-label={`Viewer 3D: ${name}`} />
      <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#0f0f0f]/80 px-2 py-1 text-[10.5px] font-semibold text-[#8a8a8a]">
        <RotateCw className="h-3 w-3" /> Drag untuk memutar
      </span>
      <span className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] truncate rounded-lg border border-[#2a2a2a] bg-[#0f0f0f]/80 px-2 py-1 text-[10.5px] font-semibold text-white">{name}</span>
    </div>
  );
}

/* ================= util & ornamen ================= */
function PanelTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#8a8a8a]">{title}</h3>
      {right}
    </div>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] px-3 py-2.5 text-left text-[12.5px] font-semibold transition-colors duration-150 ${disabled ? 'opacity-40' : 'hover:border-[#00d4c8]/50'}`}
    >
      {label}
      <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-150 ${checked ? 'bg-[#00d4c8]' : 'bg-[#2a2a2a]'}`}>
        <span className={`h-4 w-4 rounded-full bg-white transition-transform duration-150 ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

/** Maskot bintang tersenyum untuk empty state canvas. */
function SmilingStar() {
  return (
    <svg viewBox="0 0 96 96" className="h-20 w-20" aria-hidden="true">
      <path d="M48 8l10.6 23.4 25.4 2.6-19 17 5.4 25-22.4-12.8L25.6 76l5.4-25-19-17 25.4-2.6z" fill="#1a1a1a" stroke="#00d4c8" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="41" cy="42" r="2.6" fill="#00d4c8" />
      <circle cx="55" cy="42" r="2.6" fill="#00d4c8" />
      <path d="M41 51c2.4 3 4.6 4.2 7 4.2s4.6-1.2 7-4.2" fill="none" stroke="#00d4c8" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Glyph Discord sederhana (lucide tidak punya ikon brand). */
function DiscordGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M19.6 5.6A16.4 16.4 0 0 0 15.5 4.3l-.5 1a15.2 15.2 0 0 0-6 0l-.5-1A16.4 16.4 0 0 0 4.4 5.6C1.8 9.5 1.1 13.3 1.5 17c1.7 1.3 3.4 2 5 2.5l1-1.6c-.6-.2-1.1-.5-1.6-.8l.4-.3c3.1 1.4 6.4 1.4 9.4 0l.4.3c-.5.3-1 .6-1.6.8l1 1.6c1.6-.5 3.3-1.2 5-2.5.5-4.3-.7-8-2.9-11.4ZM8.7 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
    </svg>
  );
}

/** Perkecil gambar via canvas (sisi terpanjang ≤ maxSide) → data URI JPEG. */
function downscale(img: HTMLImageElement, maxSide: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.92);
}
