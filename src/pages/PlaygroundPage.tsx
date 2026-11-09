import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Captions,
  AudioLines,
  TerminalSquare,
  Copy,
  Check,
  Download,
  Lock,
  LoaderCircle,
  Play,
  X,
  Wand2,
} from 'lucide-react';
import Seo from '../components/Seo';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';
import {
  askAi,
  fetchTtsModels,
  fetchTtsVoices,
  synthTts,
  readTtsQuota,
  consumeTtsQuota,
  TTS_WEEKLY_LIMIT,
  WEBSSH_URL,
  type TtsModel,
  type TtsVoice,
} from '../services/playgroundApi';

type Tab = 'hook' | 'caption' | 'tts' | 'vps';

const TABS: { id: Tab; label: string; icon: typeof Sparkles; desc: string }[] = [
  { id: 'hook', label: 'Hook Generator', icon: Sparkles, desc: 'Bikin hook pembuka konten yang nendang' },
  { id: 'caption', label: 'Auto Caption', icon: Captions, desc: 'Caption otomatis dari deskripsi konten' },
  { id: 'tts', label: 'Teks To Speech', icon: AudioLines, desc: 'Ubah teks jadi suara (ElevenLabs)' },
  { id: 'vps', label: 'Coba VPS', icon: TerminalSquare, desc: 'Terminal VPS langsung di browser' },
];

export default function PlaygroundPage() {
  const [tab, setTab] = useState<Tab>('hook');

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-24 sm:px-6">
      <Seo title="Playground" description="Playground Boosteryuk: Hook Generator, Auto Caption, Teks To Speech, dan Coba VPS." noindex />

      <Reveal>
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
            <Wand2 className="h-3 w-3" strokeWidth={2.6} />
            Playground
          </span>
          <h1 className="mt-3 font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Alat kreator <span className="text-emerald-500">Boosteryuk</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[15px] dark:text-slate-300">
            Kumpulan tools AI untuk bikin konten makin gampang — dari hook, caption, suara, sampai nyobain VPS.
          </p>
        </div>
      </Reveal>

      {/* Tab menu */}
      <Reveal delay={40}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98] ${
                  active
                    ? 'border-emerald-400 bg-emerald-50 shadow-[0_14px_34px_-20px_rgba(16,185,129,0.8)] dark:border-emerald-600 dark:bg-emerald-950/40'
                    : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    active ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </span>
                <span>
                  <span className={`block text-[13px] font-extrabold ${active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                    {t.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Reveal>

      <div className="mt-6">
        {tab === 'hook' && (
          <AiPanel
            key="hook"
            title="Hook Generator"
            placeholder="Tulis deskripsi kontenmu… mis. 'review skincare lokal buat kulit berminyak'"
            buildPrompt={(v) => `Buatkan Hook dari deskripsi konten ini: ${v}`}
            cta="Buatkan Hook"
          />
        )}
        {tab === 'caption' && (
          <AiPanel
            key="caption"
            title="Auto Caption"
            placeholder="Tulis deskripsi kontenmu… mis. 'tips hemat belanja bulanan ala anak kos'"
            buildPrompt={(v) => `Buatkan caption media sosial yang menarik beserta hashtag dari deskripsi konten ini: ${v}`}
            cta="Buatkan Caption"
          />
        )}
        {tab === 'tts' && <TtsPanel />}
        {tab === 'vps' && <VpsPanel />}
      </div>
    </div>
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
   Panel Teks To Speech (ElevenLabs)
   ========================================================= */
function TtsPanel() {
  const { user } = useAuth();
  const [models, setModels] = useState<TtsModel[]>([]);
  const [voices, setVoices] = useState<TtsVoice[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

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

  const userKey = user ? user.email || user.username || 'user' : '';
  const quota = useMemo(() => (user ? readTtsQuota(userKey) : null), [user, userKey, audioUrl]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchTtsModels(), fetchTtsVoices()]).then(([m, v]) => {
      if (!alive) return;
      setModels(m);
      setVoices(v);
      if (m[0]) setModelId(m[0].model_id);
      if (v[0]) setVoiceId(v[0].voice_id);
      setLoadingMeta(false);
    });
    return () => {
      alive = false;
    };
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
    if (!audioUrl || !user) return;
    if ((quota?.remaining ?? 0) <= 0) return;
    consumeTtsQuota(userKey);
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `boosteryuk-tts-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // paksa re-render kuota
    setAudioUrl((u) => u);
    setError('');
  };

  return (
    <Reveal>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">Teks To Speech</h2>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400">
            Powered by ElevenLabs
          </span>
        </div>

        {loadingMeta ? (
          <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-slate-500 dark:text-slate-400">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Memuat model & suara…
          </p>
        ) : (
          <>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Model">
                <Select value={modelId} onChange={(v) => { setModelId(v); setLanguageCode(''); }}
                  options={models.map((m) => ({ value: m.model_id, label: m.name }))} />
              </Field>
              <Field label="Bahasa">
                <Select value={languageCode} onChange={setLanguageCode}
                  options={[{ value: '', label: 'Otomatis' }, ...languages.map((l) => ({ value: l.id, label: l.name }))]} />
              </Field>
              <Field label="Suara">
                <Select value={voiceId} onChange={setVoiceId}
                  options={voices.map((v) => ({ value: v.voice_id, label: v.name }))} />
              </Field>
            </div>

            {/* Intonasi suara */}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Slider label="Kestabilan" value={stability} onChange={setStability} />
              <Slider label="Kemiripan" value={similarity} onChange={setSimilarity} />
              <Slider label="Gaya / intonasi" value={style} onChange={setStyle} />
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tulis teks yang ingin diubah menjadi suara…"
              rows={4}
              maxLength={1200}
              className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-slate-800 outline-none transition-colors focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-right text-[10.5px] text-slate-400">{text.length}/1200</p>

            <button
              onClick={generate}
              disabled={!text.trim() || !voiceId || busy}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[14px] font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-6"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" strokeWidth={2.4} />}
              {busy ? 'Membuat suara…' : 'Buat Suara'}
            </button>

            {error && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-semibold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40">
                {error}
              </p>
            )}

            {audioUrl && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800/50 dark:bg-emerald-950/30">
                <audio src={audioUrl} controls className="w-full" />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={download}
                    disabled={!canDownload}
                    className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all active:scale-95 ${
                      canDownload
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-700'
                        : 'cursor-not-allowed bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {canDownload ? <Download className="h-4 w-4" strokeWidth={2.4} /> : <Lock className="h-4 w-4" strokeWidth={2.4} />}
                    Download
                  </button>
                  {!user ? (
                    <span className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400">
                      Daftar dulu untuk bisa download hasilnya.
                    </span>
                  ) : (
                    <span className="text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
                      Sisa kuota minggu ini: {quota?.remaining ?? 0}/{TTS_WEEKLY_LIMIT}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Reveal>
  );
}

/* =========================================================
   Panel Coba VPS (web-SSH)
   ========================================================= */
function VpsPanel() {
  const [open, setOpen] = useState(false);

  return (
    <Reveal>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.4)] dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <h2 className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">Coba VPS</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          Buka terminal VPS langsung di browser. Sesi sudah tersambung otomatis ke server demo.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-[14px] font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-[0.99] dark:bg-emerald-600 dark:hover:bg-emerald-700"
        >
          <TerminalSquare className="h-4 w-4" strokeWidth={2.4} />
          Buka Terminal
        </button>
      </div>

      {open && <TerminalModal onClose={() => setOpen(false)} />}
    </Reveal>
  );
}

function TerminalModal({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="flex h-[78vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0b0f17] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#11161f] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="ml-2 font-mono text-[12px] font-semibold text-slate-300">root@boosteryuk-vps</span>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Tutup terminal" className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        {/* Isi */}
        {WEBSSH_URL ? (
          <iframe title="Terminal VPS" src={WEBSSH_URL} className="h-full w-full flex-1 border-0 bg-black" allow="clipboard-read; clipboard-write" />
        ) : (
          <div className="flex-1 overflow-auto bg-[#0b0f17] p-5 font-mono text-[12.5px] leading-relaxed text-emerald-300">
            <p className="text-slate-400">Connecting to server…</p>
            <p className="mt-2 text-amber-300">[!] Terminal belum tersambung.</p>
            <p className="mt-1 text-slate-300">
              Endpoint web-SSH belum dikonfigurasi. Isi <span className="text-emerald-300">WEBSSH_URL</span> di
              <span className="text-emerald-300"> src/services/playgroundApi.ts</span> dengan URL layanan web-SSH
              (mis. ttyd/wetty) yang berjalan di VPS.
            </p>
          </div>
        )}
      </div>
    </div>
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
