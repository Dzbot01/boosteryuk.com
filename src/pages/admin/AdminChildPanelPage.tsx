import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Globe, ExternalLink, Pencil, Trash2, X, Loader2, Check, CircleAlert, Upload, Image as ImageIcon,
  Palette, Type, Percent, Mic, Layers, RotateCcw, Film,
} from 'lucide-react';
import Reveal from '../../components/Reveal';
import { childPanelApi, uploadToSignedUrl, type ChildPanel, type ChildPanelInput } from '../../services/childPanelApi';
import { tenantAssetUrl, type TenantConfig, type VoiceMode } from '../../lib/tenant';
import { compressImage } from '../../lib/image';
import { THEME_PRESETS } from '../../data/themePresets';
import { ORNAMENT_SETS } from '../../data/headerOrnaments';

const ROOT = 'boosteryuk.com';
const SUB_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const MAX_SLIDES = 6;
const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

interface SlideDraft {
  image: string; // ref tersimpan
  pending?: string; // data URL baru (belum diunggah)
  title: string;
  subtitle: string;
}
interface Draft {
  id?: number;
  name: string;
  subdomain: string;
  status: 'active' | 'suspended';
  markup_smm_pct: number;
  markup_agent_pct: number;
  owner_email: string;
  config: TenantConfig;
  slides: SlideDraft[];
  pendingLogo?: string;
  pendingHero?: string;
  pendingPoster?: string;
}

const emptyDraft = (): Draft => ({
  name: '',
  subdomain: '',
  status: 'active',
  markup_smm_pct: 10,
  markup_agent_pct: 10,
  owner_email: '',
  config: { brandName: '', brandSuffix: '', headerTagline: 'SMM Panel', footerText: '', themePreset: 'cyan', voice: 'welcome' },
  slides: [],
});

function toDraft(p: ChildPanel): Draft {
  const c = p.config || {};
  return {
    id: p.id,
    name: p.name,
    subdomain: p.subdomain,
    status: p.status,
    markup_smm_pct: Number(p.markup_smm_pct) || 0,
    markup_agent_pct: Number(p.markup_agent_pct) || 0,
    owner_email: p.owner_email || '',
    config: { ...c },
    slides: (c.slides || []).map((s) => ({ image: s.image, title: s.title, subtitle: s.subtitle })),
  };
}

export default function AdminChildPanelPage() {
  const navigate = useNavigate();
  const [panels, setPanels] = useState<ChildPanel[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setError('');
    const r = await childPanelApi.list();
    if (r.ok) setPanels(r.panels || []);
    else {
      setPanels([]);
      setError(r.message || 'Gagal memuat child panel.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.ok ? 3500 : 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const remove = async (p: ChildPanel) => {
    if (!window.confirm(`Hapus child panel "${p.name}" (${p.hostname})? Subdomain langsung tidak aktif.`)) return;
    const r = await childPanelApi.remove(p.id);
    if (r.ok) {
      setPanels(r.panels || []);
      setToast({ ok: true, msg: `${p.hostname} dihapus.` });
    } else setToast({ ok: false, msg: r.message || 'Gagal menghapus.' });
  };

  const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80';

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate('/admin')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> Admin Panel
        </button>
      </Reveal>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white">Child Panel</h1>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            Kloning website di subdomain <b>nama.{ROOT}</b> dengan brand, tema, slider, dan markup harga sendiri.
          </p>
        </div>
        <button
          onClick={() => setDraft(emptyDraft())}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-cyan-700 active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} /> Buat Child Panel
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {panels === null && <div className={`${card} h-24 animate-pulse`} />}
        {error && (
          <div className={`${card} flex items-center gap-2 text-[13px] text-rose-600`}>
            <CircleAlert className="h-4 w-4" /> {error}
          </div>
        )}
        {panels?.length === 0 && !error && (
          <div className={`${card} py-10 text-center text-[13.5px] text-slate-500`}>
            Belum ada child panel. Klik <b>Buat Child Panel</b> lalu isi nama subdomain.
          </div>
        )}
        {panels?.map((p) => {
          const logo = tenantAssetUrl(p, p.config?.logo);
          return (
            <article key={p.id} className={`${card} flex flex-wrap items-center gap-4`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
                {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <Globe className="h-5 w-5 text-slate-400" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
                  {p.name}
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${p.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                    {p.status === 'active' ? 'Aktif' : 'Ditangguhkan'}
                  </span>
                </p>
                <a href={`https://${p.hostname}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-cyan-700 hover:underline dark:text-cyan-400">
                  {p.hostname} <ExternalLink className="h-3 w-3" />
                </a>
                <p className="mt-0.5 text-[11.5px] text-slate-400">
                  Markup SMM {p.markup_smm_pct}% · Agen AI {p.markup_agent_pct}%{p.owner_email ? ` · pemilik ${p.owner_email}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDraft(toDraft(p))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                  <Pencil className="h-3.5 w-3.5" /> Atur
                </button>
                <button onClick={() => void remove(p)} aria-label={`Hapus ${p.name}`} className="rounded-lg border border-rose-200 px-2.5 py-2 text-rose-600 hover:bg-rose-50 dark:border-rose-800/50 dark:hover:bg-rose-900/20">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {draft && (
        <PanelEditor
          initial={draft}
          onClose={() => setDraft(null)}
          onSaved={(list, msg) => {
            setPanels(list);
            setDraft(null);
            setToast({ ok: true, msg });
          }}
        />
      )}

      {toast && (
        <div role="alert" className="fixed inset-x-4 top-5 z-[90] mx-auto flex max-w-sm items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {toast.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.8} /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
          <p className="flex-1 text-slate-700 dark:text-slate-200">{toast.msg}</p>
          <button onClick={() => setToast(null)} aria-label="Tutup" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================== Editor ============================== */

function PanelEditor({ initial, onClose, onSaved }: { initial: Draft; onClose: () => void; onSaved: (list: ChildPanel[], msg: string) => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [subState, setSubState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const isNew = !initial.id;
  const cfg = d.config;
  const setCfg = (patch: Partial<TenantConfig>) => setD((x) => ({ ...x, config: { ...x.config, ...patch } }));

  // Cek ketersediaan subdomain (debounce).
  useEffect(() => {
    const sub = d.subdomain.trim().toLowerCase();
    if (!sub) return setSubState(null);
    if (!SUB_RE.test(sub)) return setSubState({ ok: false, msg: 'Gunakan huruf kecil, angka, dan tanda minus (maks 32).' });
    if (sub === initial.subdomain && initial.id) return setSubState({ ok: true, msg: `${sub}.${ROOT}` });
    const t = window.setTimeout(async () => {
      const r = await childPanelApi.check(sub, initial.id);
      setSubState({ ok: !!r.available, msg: r.message || (r.available ? 'Tersedia' : 'Tidak tersedia') });
    }, 450);
    return () => window.clearTimeout(t);
  }, [d.subdomain, initial.subdomain, initial.id]);

  // Video dashboard: diunggah langsung ke Supabase Storage lewat signed URL dari server.
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const uploadVideo = async (file: File | undefined) => {
    if (!file) return;
    setErr('');
    if (!initial.id) return setErr('Simpan child panel dulu, lalu unggah video.');
    const ext = file.name.toLowerCase().endsWith('.webm') || file.type === 'video/webm' ? 'webm' : 'mp4';
    if (!/^video\/(mp4|webm)$/.test(file.type)) return setErr('Video harus MP4 atau WebM.');
    const sign = await childPanelApi.videoSign(initial.id, ext, file.size);
    if (!sign.ok || !sign.upload_url || !sign.public_url) return setErr(sign.message || 'Gagal menyiapkan upload video.');
    setVideoProgress(0);
    try {
      await uploadToSignedUrl(sign.upload_url, file, (p) => setVideoProgress(p));
      setCfg({ videoUrl: sign.public_url });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload video gagal.');
    } finally {
      setVideoProgress(null);
    }
  };

  const pickImage = async (file: File | undefined, kind: 'logo' | 'hero' | 'poster' | number) => {
    if (!file) return;
    setErr('');
    try {
      const data = kind === 'logo' ? await compressImage(file, 512, 'image/png') : await compressImage(file, kind === 'poster' ? 1280 : 1920);
      if (kind === 'logo') setD((x) => ({ ...x, pendingLogo: data }));
      else if (kind === 'hero') setD((x) => ({ ...x, pendingHero: data }));
      else if (kind === 'poster') setD((x) => ({ ...x, pendingPoster: data }));
      else setD((x) => ({ ...x, slides: x.slides.map((s, i) => (i === kind ? { ...s, pending: data } : s)) }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal membaca gambar.');
    }
  };

  const preview = (ref: string | undefined, pending?: string) => pending || tenantAssetUrl(initial.id ? { id: initial.id } : null, ref);

  const save = async () => {
    setErr('');
    if (!d.name.trim()) return setErr('Nama child panel wajib diisi.');
    if (!SUB_RE.test(d.subdomain.trim().toLowerCase())) return setErr('Subdomain tidak valid.');
    setSaving(true);
    const build = (config: TenantConfig, slides: SlideDraft[]): ChildPanelInput => ({
      id: d.id,
      name: d.name.trim(),
      subdomain: d.subdomain.trim().toLowerCase(),
      status: d.status,
      markup_smm_pct: Number(d.markup_smm_pct) || 0,
      markup_agent_pct: Number(d.markup_agent_pct) || 0,
      owner_email: d.owner_email.trim(),
      config: { ...config, slides: slides.filter((s) => s.image).map((s) => ({ image: s.image, title: s.title, subtitle: s.subtitle })) },
    });
    // 1) simpan data utama (mendapatkan id untuk panel baru)
    let r = await childPanelApi.save(build(cfg, d.slides));
    if (!r.ok || !r.id) {
      setSaving(false);
      return setErr(r.message || 'Gagal menyimpan child panel.');
    }
    const id = r.id;
    // 2) unggah gambar baru, lalu simpan ref-nya
    const config = { ...cfg };
    const slides = d.slides.map((s) => ({ ...s }));
    const uploads: [string, string, (ref: string) => void][] = [];
    if (d.pendingLogo) uploads.push(['logo', d.pendingLogo, (ref) => (config.logo = ref)]);
    if (d.pendingHero) uploads.push(['hero', d.pendingHero, (ref) => (config.hero = ref)]);
    if (d.pendingPoster) uploads.push(['poster', d.pendingPoster, (ref) => (config.videoPoster = ref)]);
    slides.forEach((s, i) => s.pending && uploads.push([`slide${i}`, s.pending, (ref) => (slides[i].image = ref)]));
    for (const [slot, data, apply] of uploads) {
      const u = await childPanelApi.upload(id, slot, data);
      if (!u.ok || !u.ref) {
        setSaving(false);
        return setErr(`Gagal mengunggah gambar (${slot}): ${u.message || 'error'}`);
      }
      apply(u.ref);
    }
    if (uploads.length) {
      r = await childPanelApi.save({ ...build(config, slides), id });
      if (!r.ok) {
        setSaving(false);
        return setErr(r.message || 'Gagal menyimpan gambar.');
      }
    }
    setSaving(false);
    onSaved(r.panels || [], `${isNew ? 'Child panel dibuat' : 'Perubahan disimpan'} — ${r.url || r.hostname} langsung aktif.`);
  };

  const inp = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
  const sec = 'rounded-xl border border-slate-200 p-4 dark:border-slate-700';
  const h3 = 'mb-3 flex items-center gap-2 text-[13px] font-bold text-slate-800 dark:text-slate-100';
  const lbl = 'mb-1 block text-[11.5px] font-semibold text-slate-500 dark:text-slate-400';
  const logoSrc = preview(cfg.logo, d.pendingLogo);
  const heroSrc = preview(cfg.hero, d.pendingHero) || '/world.png';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={() => !saving && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="cp-title" onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 id="cp-title" className="text-[16px] font-bold text-slate-900 dark:text-white">{isNew ? 'Buat Child Panel' : `Atur ${initial.name}`}</h2>
          <button onClick={onClose} disabled={saving} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Identitas & subdomain */}
          <section className={sec}>
            <h3 className={h3}><Globe className="h-4 w-4 text-slate-400" /> Identitas & subdomain</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={lbl}>Nama child panel</span>
                <input className={inp} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="mis. Toko Guri" />
              </label>
              <label className="block">
                <span className={lbl}>Subdomain</span>
                <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 focus-within:border-cyan-500 dark:border-slate-600">
                  <input
                    className="h-10 min-w-0 flex-1 bg-white px-3 text-[13px] text-slate-800 outline-none dark:bg-slate-900 dark:text-white"
                    value={d.subdomain}
                    onChange={(e) => setD({ ...d, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="tokoguri"
                    maxLength={32}
                  />
                  <span className="shrink-0 bg-slate-50 px-2.5 text-[12px] font-semibold leading-10 text-slate-500 dark:bg-slate-800">.{ROOT}</span>
                </div>
                {subState && <span className={`mt-1 block text-[11.5px] font-semibold ${subState.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{subState.msg}</span>}
              </label>
              <label className="block">
                <span className={lbl}>Email pemilik (reseller, opsional)</span>
                <input className={inp} type="email" value={d.owner_email} onChange={(e) => setD({ ...d, owner_email: e.target.value })} placeholder="reseller@email.com" />
              </label>
              <label className="block">
                <span className={lbl}>Status</span>
                <select className={inp} value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as Draft['status'] })}>
                  <option value="active">Aktif</option>
                  <option value="suspended">Ditangguhkan (subdomain tidak menampilkan panel)</option>
                </select>
              </label>
            </div>
          </section>

          {/* Brand & header */}
          <section className={sec}>
            <h3 className={h3}><Type className="h-4 w-4 text-slate-400" /> Logo, judul header & footer</h3>
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                {logoSrc ? <img src={logoSrc} alt="Logo" className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-slate-400" />}
              </span>
              <ImagePicker label="Ganti logo" onPick={(f) => void pickImage(f, 'logo')} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={lbl}>Judul (bagian berwarna)</span>
                <input className={inp} value={cfg.brandName || ''} onChange={(e) => setCfg({ brandName: e.target.value })} placeholder="Toko" maxLength={40} />
              </label>
              <label className="block">
                <span className={lbl}>Judul (lanjutan)</span>
                <input className={inp} value={cfg.brandSuffix || ''} onChange={(e) => setCfg({ brandSuffix: e.target.value })} placeholder="Guri" maxLength={40} />
              </label>
              <label className="block">
                <span className={lbl}>Teks kecil di header</span>
                <input className={inp} value={cfg.headerTagline || ''} onChange={(e) => setCfg({ headerTagline: e.target.value })} placeholder="SMM Panel" maxLength={30} />
              </label>
            </div>
            <label className="mt-3 block">
              <span className={lbl}>Teks footer</span>
              <input className={inp} value={cfg.footerText || ''} onChange={(e) => setCfg({ footerText: e.target.value })} placeholder="© 2026 Toko Guri" maxLength={200} />
            </label>
          </section>

          {/* Tema */}
          <section className={sec}>
            <h3 className={h3}><Palette className="h-4 w-4 text-slate-400" /> Tema & warna</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {THEME_PRESETS.map((t) => {
                const active = cfg.themePreset === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCfg({ themePreset: t.id, brandAccent: t.accent, headerTint: t.header, menuActive: t.menu })}
                    className={`rounded-lg border p-2 text-left text-[11.5px] font-semibold ${active ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-slate-200 dark:border-slate-700'}`}
                  >
                    <span className="mb-1.5 flex gap-1">
                      {[t.accent, t.header, t.menu].map((c, i) => (
                        <span key={i} className="h-4 w-4 rounded-full ring-1 ring-slate-200" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="text-slate-700 dark:text-slate-200">{t.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {([
                ['brandAccent', 'Aksen teks brand', '#0891b2'],
                ['headerTint', 'Warna kartu header', '#ffffff'],
                ['menuActive', 'Tombol aktif side menu', '#0891b2'],
              ] as const).map(([k, label, def]) => (
                <label key={k} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
                  <input type="color" aria-label={label} value={cfg[k] || def} onChange={(e) => setCfg({ [k]: e.target.value, themePreset: '' })} className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-transparent" />
                </label>
              ))}
            </div>
            <label className="mt-3 block">
              <span className={lbl}>Aksesoris menggantung di bawah header</span>
              <select className={inp} value={cfg.headerOrnament || ''} onChange={(e) => setCfg({ headerOrnament: e.target.value })}>
                <option value="">Ikuti web utama (otomatis sama dengan tema aksesoris admin utama)</option>
                <option value="none">Tanpa aksesoris</option>
                {ORNAMENT_SETS.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} — {o.theme}</option>
                ))}
              </select>
            </label>
            <div className="mt-3">
              <span className={lbl}>Gambar background hero (dashboard)</span>
              <div className="relative h-28 overflow-hidden rounded-lg bg-gradient-to-br from-[#1b1c20] to-[#0e0f12]">
                <div className="hero-map absolute inset-0" style={{ backgroundImage: `url("${heroSrc}")` }} />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f12]/85 via-[#0e0f12]/40 to-transparent" />
              </div>
              <div className="mt-2 flex gap-2">
                <ImagePicker label="Ganti gambar hero" onPick={(f) => void pickImage(f, 'hero')} />
                <button type="button" onClick={() => { setCfg({ hero: '' }); setD((x) => ({ ...x, pendingHero: undefined })); }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <RotateCcw className="h-3.5 w-3.5" /> Bawaan
                </button>
              </div>
            </div>
          </section>

          {/* Slider */}
          <section className={sec}>
            <h3 className={h3}><Layers className="h-4 w-4 text-slate-400" /> Image slider (halaman Layanan, Sewa Agen AI, VPS)</h3>
            {d.slides.length === 0 && <p className="mb-2 text-[12px] text-slate-500">Kosong = memakai slider bawaan Boosteryuk.</p>}
            <div className="space-y-3">
              {d.slides.map((s, i) => {
                const src = preview(s.image, s.pending);
                return (
                  <div key={i} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row dark:border-slate-700">
                    <div className="h-20 w-full shrink-0 overflow-hidden rounded-md bg-slate-100 sm:w-32 dark:bg-slate-800">
                      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <input className={inp} value={s.title} placeholder="Judul slide" maxLength={80} onChange={(e) => setD((x) => ({ ...x, slides: x.slides.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)) }))} />
                      <input className={inp} value={s.subtitle} placeholder="Subjudul" maxLength={140} onChange={(e) => setD((x) => ({ ...x, slides: x.slides.map((y, j) => (j === i ? { ...y, subtitle: e.target.value } : y)) }))} />
                      <div className="flex gap-2">
                        <ImagePicker label={src ? 'Ganti gambar' : 'Pilih gambar'} onPick={(f) => void pickImage(f, i)} />
                        <button type="button" onClick={() => setD((x) => ({ ...x, slides: x.slides.filter((_, j) => j !== i) }))} className="rounded-lg border border-rose-200 px-3 py-2 text-[12px] font-semibold text-rose-600">
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {d.slides.length < MAX_SLIDES && (
              <button type="button" onClick={() => setD((x) => ({ ...x, slides: [...x.slides, { image: '', title: '', subtitle: '' }] }))} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
                <Plus className="h-3.5 w-3.5" /> Tambah slide
              </button>
            )}
          </section>

          {/* Video player dashboard */}
          <section className={sec}>
            <h3 className={h3}><Film className="h-4 w-4 text-slate-400" /> Video player di dashboard</h3>
            <p className="mb-3 text-[12px] text-slate-500">
              Bawaan: <b>tidak ada video</b>. Unggah video (MP4/WebM, maks 50 MB) — disimpan di Supabase Storage seperti video web utama — atau tempel link video https.
            </p>
            {cfg.videoUrl ? (
              <video key={cfg.videoUrl} src={cfg.videoUrl} poster={preview(cfg.videoPoster, d.pendingPoster) || undefined} className="aspect-video w-full rounded-lg bg-black" controls muted playsInline preload="metadata" />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-[12.5px] text-slate-400 dark:border-slate-700">
                Video player tidak ditampilkan
              </div>
            )}
            {videoProgress !== null && (
              <div className="mt-2" role="progressbar" aria-valuenow={Math.round(videoProgress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full bg-cyan-600 transition-[width]" style={{ width: `${Math.round(videoProgress * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11.5px] text-slate-500">Mengunggah video… {Math.round(videoProgress * 100)}%</p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <VideoPicker disabled={videoProgress !== null || !initial.id} onPick={(f) => void uploadVideo(f)} />
              <ImagePicker label="Thumbnail video" onPick={(f) => void pickImage(f, 'poster')} />
              {cfg.videoUrl && (
                <button type="button" onClick={() => { setCfg({ videoUrl: '', videoPoster: '' }); setD((x) => ({ ...x, pendingPoster: undefined })); }} className="rounded-lg border border-rose-200 px-3 py-2 text-[12px] font-semibold text-rose-600">
                  Hapus video
                </button>
              )}
            </div>
            {!initial.id && <p className="mt-2 text-[11.5px] text-amber-600">Simpan child panel dulu untuk bisa mengunggah video.</p>}
            <label className="mt-3 block">
              <span className={lbl}>Atau tempel link video (https, .mp4/.webm)</span>
              <input className={inp} value={cfg.videoUrl || ''} onChange={(e) => setCfg({ videoUrl: e.target.value.trim() })} placeholder="https://…/video.mp4" />
            </label>
          </section>

          {/* Markup */}
          <section className={sec}>
            <h3 className={h3}><Percent className="h-4 w-4 text-slate-400" /> Margin markup harga</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={lbl}>Layanan SMM (%)</span>
                <input className={inp} type="number" min={0} max={300} step={0.5} value={d.markup_smm_pct} onChange={(e) => setD({ ...d, markup_smm_pct: Number(e.target.value) })} />
              </label>
              <label className="block">
                <span className={lbl}>Sewa Agen AI (%)</span>
                <input className={inp} type="number" min={0} max={300} step={0.5} value={d.markup_agent_pct} onChange={(e) => setD({ ...d, markup_agent_pct: Number(e.target.value) })} />
                <span className="mt-1 block text-[11.5px] text-slate-500">
                  Contoh: Starter {rupiah(10000)} → {rupiah(Math.ceil(10000 * (1 + (Number(d.markup_agent_pct) || 0) / 100)))} /bulan
                </span>
              </label>
            </div>
          </section>

          {/* Voice */}
          <section className={sec}>
            <h3 className={h3}><Mic className="h-4 w-4 text-slate-400" /> Voice Guri Booster saat login</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                ['welcome', 'Sapaan saja'],
                ['full', 'Sapaan + info reseller'],
                ['off', 'Tanpa suara'],
              ] as [VoiceMode, string][]).map(([v, label]) => (
                <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold ${ (cfg.voice || 'welcome') === v ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="radio" name="voice" checked={(cfg.voice || 'welcome') === v} onChange={() => setCfg({ voice: v })} className="accent-cyan-600" />
                  <span className="text-slate-700 dark:text-slate-200">{label}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-slate-500">Rekaman suara saat ini menyebut “boosteryuk.com”. Pilih “Tanpa suara” bila panel memakai brand lain.</p>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <p role="status" className="min-h-[18px] text-[12px] font-semibold text-rose-600">{err}</p>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              Batal
            </button>
            <button onClick={() => void save()} disabled={saving || (subState ? !subState.ok : false)} aria-busy={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-cyan-700 disabled:opacity-60">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Menyimpan…' : isNew ? 'Buat & Aktifkan' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagePicker({ label, onPick }: { label: string; onPick: (f: File | undefined) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
        <Upload className="h-3.5 w-3.5" /> {label}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}

function VideoPicker({ onPick, disabled }: { onPick: (f: File | undefined) => void; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => ref.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
        <Upload className="h-3.5 w-3.5" /> Unggah video
      </button>
      <input
        ref={ref}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );
}
