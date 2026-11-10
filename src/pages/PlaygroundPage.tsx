import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Captions,
  AudioLines,
  Copy,
  Check,
  Download,
  Lock,
  LoaderCircle,
  X,
  Wand2,
  Menu as MenuIcon,
  LayoutGrid,
} from 'lucide-react';
import Seo from '../components/Seo';
import Reveal from '../components/Reveal';
import ScrollExpand from '../components/ScrollExpand';
import { useAuth } from '../context/AuthContext';
import {
  askAi,
  fetchTtsMeta,
  synthTts,
  readTtsQuota,
  consumeTtsQuota,
  TTS_WEEKLY_LIMIT,
  type TtsModel,
  type TtsVoice,
} from '../services/playgroundApi';

type Menu = 'overview' | 'hook' | 'caption' | 'tts';

const MENUS: { id: Menu; label: string; icon: typeof Sparkles; desc: string }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, desc: 'Halaman utama Playground' },
  { id: 'hook', label: 'Hook Generator', icon: Sparkles, desc: 'Bikin hook pembuka konten yang nendang' },
  { id: 'caption', label: 'Auto Caption', icon: Captions, desc: 'Caption otomatis dari deskripsi konten' },
  { id: 'tts', label: 'Teks To Speech', icon: AudioLines, desc: 'Ubah teks jadi suara berkualitas' },
];

export default function PlaygroundPage() {
  // Menu disimpan di URL (?m=) agar refresh tidak kembali ke Overview.
  const [params, setParams] = useSearchParams();
  const raw = params.get('m') || 'overview';
  const menu = (['overview', 'hook', 'caption', 'tts'].includes(raw) ? raw : 'overview') as Menu;
  const setMenu = (m: Menu) => setParams(m === 'overview' ? {} : { m }, { replace: false });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const active = MENUS.find((m) => m.id === menu)!;

  // Scroll ke atas tiap ganti menu.
  useEffect(() => { window.scrollTo({ top: 0 }); }, [menu]);

  return (
    <>
      <Seo title="Playground" description="Playground Boosteryuk: Hook Generator, Auto Caption, dan Teks To Speech." noindex />

      {menu === 'overview' ? (
        <>
          <OverviewHero onOpenMenu={() => setDrawerOpen(true)} />
          <div className="mx-auto max-w-5xl px-4 pb-32 sm:px-6">
            <OverviewDesc />
          </div>
        </>
      ) : (
      <div className="mx-auto max-w-5xl px-4 pb-32 pt-24 sm:px-6">
        {/* Tombol menu terpisah — pojok KIRI atas, di bawah header (ikon polos tanpa card) */}
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Menu Playground"
          className="mb-4 inline-flex items-center gap-2 text-emerald-600 transition-colors hover:text-emerald-700 active:scale-95 dark:text-emerald-400"
        >
          <MenuIcon className="h-6 w-6" strokeWidth={2.2} />
          <span className="text-[13px] font-bold">Menu</span>
        </button>

        {/* Judul menu aktif */}
        <div className="mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ring-1 ring-slate-600/40 dark:bg-slate-800">
            <Wand2 className="h-3 w-3 text-slate-300" strokeWidth={2.6} />
            <span className="text-silver-shine">Playground</span>
          </span>
          <h1 className="mt-2 font-display text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            {active.label}
          </h1>
        </div>

        {/* Konten menu aktif saja (bukan semua sekaligus) */}
        <div>
        {menu === 'hook' && (
          <AiPanel
            key="hook"
            title="Hook Generator"
            placeholder="Tulis deskripsi kontenmu… mis. 'review skincare lokal buat kulit berminyak'"
            buildPrompt={(v) => `Buatkan Hook dari deskripsi konten ini: ${v}`}
            cta="Buatkan Hook"
          />
        )}
        {menu === 'caption' && (
          <AiPanel
            key="caption"
            title="Auto Caption"
            placeholder="Tulis deskripsi kontenmu… mis. 'tips hemat belanja bulanan ala anak kos'"
            buildPrompt={(v) => `Buatkan caption media sosial yang menarik beserta hashtag dari deskripsi konten ini: ${v}`}
            cta="Buatkan Caption"
          />
        )}
        {menu === 'tts' && <TtsPanel />}
        </div>
      </div>
      )}

      {/* Side menu / drawer — dari KIRI, simpel (tanpa deskripsi, ikon tanpa card) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true">
          <aside className="h-full w-64 max-w-[78vw] animate-slide-in-left overflow-y-auto border-r border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-900/50 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">Menu</p>
              <button onClick={() => setDrawerOpen(false)} aria-label="Tutup" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
                <X className="h-5 w-5" strokeWidth={2.2} />
              </button>
            </div>
            <nav className="space-y-1">
              {MENUS.map((m) => {
                const Icon = m.icon;
                const on = m.id === menu;
                return (
                  <button
                    key={m.id}
                    onClick={() => { setMenu(m.id); setDrawerOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      on
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${on ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-400'}`} strokeWidth={2.2} />
                    <span className="text-[14px] font-bold">{m.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
          <div className="flex-1 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
        </div>
      )}
    </>
  );
}

/* =========================================================
   Overview — hero ScrollExpand FULL-BLEED (window scroll)
   ========================================================= */
function OverviewHero({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <section className="relative -mt-[60px] w-full">
      {/* Tombol menu mengambang di atas animasi (di bawah header) */}
      <button
        onClick={onOpenMenu}
        aria-label="Menu Playground"
        className="absolute left-4 top-[72px] z-10 inline-flex items-center gap-2 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition-transform hover:scale-105 active:scale-95 sm:left-6"
      >
        <MenuIcon className="h-6 w-6" strokeWidth={2.4} />
        <span className="text-[13px] font-bold">Menu</span>
      </button>

      <ScrollExpand
        src="/playground-hero.png"
        title="Welcome To"
        scrollHint="Scroll ke bawah"
        useWindowScroll
        startWidth={46}
        startHeight={60}
        startRadius={24}
        endRadius={0}
        mediaZoom={1.3}
        scrollDistance={0.6}
        holdDistance={0}
        smoothing={0.1}
        overlayScrim={0.45}
        enabled
      >
        <h2 className="font-display text-3xl font-black tracking-tight text-white sm:text-5xl">Playground Boosteryuk</h2>
        <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/85">
          Semua alat kreator dalam satu tempat — hook, caption, dan suara AI.
        </p>
      </ScrollExpand>
    </section>
  );
}

/* Kartu deskripsi (rata kiri di desktop) — kegunaan fitur bagi kreator */
function OverviewDesc() {
  return (
    <Reveal>
      <div className="mt-10 max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900">
        <h3 className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Dibuat untuk kreator
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
          Playground Boosteryuk mengumpulkan alat AI yang bikin produksi konten makin cepat dan gampang:
        </p>
        <ul className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-300">
          <li className="flex gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.4} />
            <span><b className="text-slate-900 dark:text-white">Hook Generator</b> — bikin kalimat pembuka yang bikin orang berhenti scroll di detik pertama.</span>
          </li>
          <li className="flex gap-2.5">
            <Captions className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.4} />
            <span><b className="text-slate-900 dark:text-white">Auto Caption</b> — caption menarik lengkap dengan hashtag, otomatis dari deskripsi kontenmu.</span>
          </li>
          <li className="flex gap-2.5">
            <AudioLines className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.4} />
            <span><b className="text-slate-900 dark:text-white">Teks To Speech</b> — ubah naskah jadi voice-over berkualitas untuk reels, TikTok, atau YouTube.</span>
          </li>
        </ul>
        <p className="mt-5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
          Buka menu di kiri atas untuk mulai berkarya →
        </p>
      </div>
    </Reveal>
  );
}

/* =========================================================
   Panel AI generik (Hook & Caption)
   ========================================================= */
function AiPanel({
  title,
  placeholder,
  buildPrompt,
  cta,
}: {
  title: string;
  placeholder: string;
  buildPrompt: (value: string) => string;
  cta: string;
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult('');
    const res = await askAi(buildPrompt(input.trim()));
    setLoading(false);
    if (res.ok && res.data) setResult(res.data);
    else setError(res.message || 'AI sedang sibuk, coba lagi sebentar ya.');
  };

  const copy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Reveal>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <h2 className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-slate-800 outline-none transition-colors focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <button
          onClick={run}
          disabled={!input.trim() || loading}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[14px] font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={2.4} />}
          {loading ? 'Membuat…' : cta}
        </button>

        {error && (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-semibold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800/50 dark:bg-emerald-950/30">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Hasil</span>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">{result}</p>
          </div>
        )}
      </div>
    </Reveal>
  );
}

/* =========================================================
   Panel Teks To Speech (UI ala studio TTS)
   ========================================================= */
function TtsPanel() {
  const { user } = useAuth();
  const [models, setModels] = useState<TtsModel[]>([]);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  const [modelId, setModelId] = useState('');
  const [languageCode, setLanguageCode] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [style, setStyle] = useState(0.2);
  const [text, setText] = useState('');

  const [busy, setBusy] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const [quotaTick, setQuotaTick] = useState(0);

  const userKey = user ? user.email || user.username || 'user' : '';
  const quota = useMemo(() => (user ? readTtsQuota(userKey) : null), [user, userKey, quotaTick]);
  const voiceName = voices.find((v) => v.voice_id === voiceId)?.name || 'Pilih suara';

  useEffect(() => {
    let alive = true;
    fetchTtsMeta().then(({ models: m, voices: v, error: err }) => {
      if (!alive) return;
      setModels(m);
      setVoices(v);
      if (m[0]) setModelId(m[0].model_id);
      if (v[0]) setVoiceId(v[0].voice_id);
      if (err) setMetaError(err);
      setLoadingMeta(false);
    });
    return () => { alive = false; };
  }, []);

  const currentModel = models.find((m) => m.model_id === modelId);
  const languages = currentModel?.languages ?? [];

  const generate = async () => {
    if (!text.trim() || !voiceId || busy) return;
    setBusy(true);
    setError('');
    setAudioUrl('');
    const res = await synthTts({
      text: text.trim(),
      voice_id: voiceId,
      model_id: modelId || 'eleven_multilingual_v2',
      language_code: languageCode || undefined,
      stability,
      similarity_boost: similarity,
      style,
    });
    setBusy(false);
    if (res.ok && res.url) setAudioUrl(res.url);
    else setError(res.message || 'Gagal membuat audio.');
  };

  const canDownload = !!user && (quota?.remaining ?? 0) > 0;
  const download = () => {
    if (!audioUrl || !canDownload) return;
    consumeTtsQuota(userKey);
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `boosteryuk-tts-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setQuotaTick((t) => t + 1);
  };

  return (
    <Reveal>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ============ KIRI: editor ============ */}
        <div className="flex min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_18px_44px_-28px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-5 pt-5 dark:border-slate-800">
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-[12.5px] font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              <span className="h-4 w-4 rounded-full bg-gradient-to-br from-emerald-400 to-indigo-500" />
              {voiceName}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1200}
            placeholder="Apa yang sedang kamu butuhkan? Tulis teks yang ingin diubah jadi suara…"
            className="flex-1 resize-none bg-transparent px-5 py-4 text-[15px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
          />
          {/* Toolbar bawah */}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            <span className="text-[12px] font-semibold text-slate-400">{text.length} / 1200</span>
            <button
              onClick={generate}
              disabled={!text.trim() || !voiceId || busy}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-[13.5px] font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" strokeWidth={2.4} />}
              {busy ? 'Membuat…' : 'Generate speech'}
            </button>
          </div>

          {error && (
            <p className="mx-5 mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-semibold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40">
              {error}
            </p>
          )}

          {/* Player bawah */}
          {audioUrl && (
            <div className="mx-5 mb-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 dark:border-emerald-800/50 dark:bg-emerald-950/30">
              <audio src={audioUrl} controls controlsList="nodownload" className="w-full" />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  onClick={download}
                  disabled={!canDownload}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[12.5px] font-bold transition-all active:scale-95 ${
                    canDownload
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700'
                      : 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {canDownload ? <Download className="h-4 w-4" strokeWidth={2.4} /> : <Lock className="h-4 w-4" strokeWidth={2.4} />}
                  Download
                </button>
                {!user ? (
                  <span className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">Daftar dulu untuk bisa download hasilnya.</span>
                ) : (
                  <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                    Sisa kuota minggu ini: {quota?.remaining ?? 0}/{TTS_WEEKLY_LIMIT}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ============ KANAN: settings ============ */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900">
          <p className="mb-4 border-b border-slate-100 pb-3 text-[14px] font-extrabold tracking-tight text-slate-900 dark:border-slate-800 dark:text-white">
            Settings
          </p>

          {loadingMeta ? (
            <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat suara…
            </p>
          ) : metaError ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-[12.5px] leading-relaxed text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300">
              <p className="font-bold">Daftar suara/model belum bisa dimuat</p>
              <p className="mt-1">{metaError}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Field label="Suara">
                <Select value={voiceId} onChange={setVoiceId} options={voices.map((v) => ({ value: v.voice_id, label: v.name }))} />
              </Field>
              <Field label="Model">
                <Select value={modelId} onChange={(v) => { setModelId(v); setLanguageCode(''); }} options={models.map((m) => ({ value: m.model_id, label: m.name }))} />
              </Field>
              <Field label="Bahasa">
                <Select value={languageCode} onChange={setLanguageCode} options={[{ value: '', label: 'Otomatis' }, ...languages.map((l) => ({ value: l.id, label: l.name }))]} />
              </Field>
              <Slider label="Kestabilan" value={stability} onChange={setStability} />
              <Slider label="Kemiripan" value={similarity} onChange={setSimilarity} />
              <Slider label="Gaya / intonasi" value={style} onChange={setStyle} />
            </div>
          )}
        </div>
      </div>
    </Reveal>
  );
}

/* ================= komponen kecil ================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-800 outline-none transition-colors focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-slate-600 dark:text-slate-300">
        {label}
        <span className="font-mono text-emerald-600 dark:text-emerald-400">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-500 dark:bg-slate-700"
      />
    </label>
  );
}
