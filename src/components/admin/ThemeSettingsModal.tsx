import { useEffect, useRef, useState } from 'react';
import { X, Upload, RotateCcw, Check, Loader2, Palette, ImageIcon, Sparkles, CircleAlert } from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { ORNAMENT_ASSETS, ORNAMENT_SETS } from '../../data/headerOrnaments';

const DEFAULT_HERO = '/world.png';
const DEFAULTS = { brandAccent: '#0891b2', headerTint: '#ffffff', menuActive: '#0891b2' };
const PRESETS = ['#0891b2', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0f766e', '#334155'];

type ColorKey = 'brandAccent' | 'headerTint' | 'menuActive';
const COLOR_FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: 'brandAccent', label: 'Aksen teks brand', hint: 'Warna tulisan “Booster” di header & footer.' },
  { key: 'headerTint', label: 'Warna kartu header', hint: 'Tetap transparan + blur saat halaman discroll.' },
  { key: 'menuActive', label: 'Tombol aktif side menu', hint: 'Warna tombol menu yang sedang dibuka.' },
];

/** Perkecil gambar ke maks 1920px & JPEG agar ringan disimpan di database. */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1920 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('Canvas tidak tersedia'));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('File bukan gambar yang valid'));
    };
    img.src = url;
  });
}

export default function ThemeSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, updateSettings, saveHeroImage, heroImageSrc, sync } = useSiteSettings();

  const [colors, setColors] = useState<Record<ColorKey, string>>({
    brandAccent: settings.brandAccent,
    headerTint: settings.headerTint,
    menuActive: settings.menuActive,
  });
  const [ornament, setOrnament] = useState(settings.headerOrnament);
  // undefined = tidak diubah, null = kembali ke bawaan, string = gambar baru (data URL)
  const [hero, setHero] = useState<string | null | undefined>(undefined);
  const [heroErr, setHeroErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const waitingSync = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sinkronkan draft dengan pengaturan terbaru setiap modal dibuka.
  useEffect(() => {
    if (!open) return;
    setColors({ brandAccent: settings.brandAccent, headerTint: settings.headerTint, menuActive: settings.menuActive });
    setOrnament(settings.headerOrnament);
    setHero(undefined);
    setHeroErr('');
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tunggu hasil simpan warna/aksesoris dari site_settings.php.
  useEffect(() => {
    if (!waitingSync.current || (sync.status !== 'saved' && sync.status !== 'error')) return;
    waitingSync.current = false;
    setSaving(false);
    setResult(sync.status === 'saved' ? { ok: true, msg: 'Tema tersimpan dan tampil untuk semua pengunjung.' } : { ok: false, msg: sync.message });
  }, [sync]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const heroPreview = hero === undefined ? heroImageSrc || DEFAULT_HERO : hero === null ? DEFAULT_HERO : hero;
  const val = (k: ColorKey) => colors[k] || DEFAULTS[k];

  const pickHero = async (file: File | undefined) => {
    if (!file) return;
    setHeroErr('');
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setHeroErr('Gunakan gambar JPG, PNG, atau WebP.');
    try {
      const data = await compressImage(file);
      if (data.length > 2_700_000) return setHeroErr('Gambar terlalu besar setelah dikompres. Coba gambar lain.');
      setHero(data);
    } catch (e) {
      setHeroErr(e instanceof Error ? e.message : 'Gagal membaca gambar.');
    }
  };

  const save = async () => {
    setSaving(true);
    setResult(null);
    if (hero !== undefined) {
      const r = await saveHeroImage(hero);
      if (!r.ok) {
        setSaving(false);
        setResult({ ok: false, msg: r.message || 'Gagal mengunggah gambar hero.' });
        return;
      }
      setHero(undefined);
    }
    const patch = { ...colors, headerOrnament: ornament };
    const changed =
      patch.brandAccent !== settings.brandAccent ||
      patch.headerTint !== settings.headerTint ||
      patch.menuActive !== settings.menuActive ||
      patch.headerOrnament !== settings.headerOrnament;
    if (changed) {
      waitingSync.current = true;
      updateSettings(patch);
    } else {
      setSaving(false);
      setResult({ ok: true, msg: 'Tema tersimpan dan tampil untuk semua pengunjung.' });
    }
  };

  const section = 'rounded-xl border border-slate-200 p-4 dark:border-slate-700';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={() => !saving && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-slate-900 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 id="theme-title" className="flex items-center gap-2 text-[16px] font-bold text-slate-900 dark:text-white">
            <Palette className="h-4.5 w-4.5 text-cyan-600" /> Tema Website
          </h2>
          <button onClick={onClose} disabled={saving} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Hero */}
          <section className={section}>
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-800 dark:text-slate-100">
              <ImageIcon className="h-4 w-4 text-slate-400" /> Gambar background hero (Dashboard)
            </h3>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
              Hanya gambarnya yang diganti — gradasi gelap, transparansi, dan efek di sekitarnya tetap sama.
            </p>
            <div className="relative mt-3 h-36 overflow-hidden rounded-lg bg-gradient-to-br from-[#1b1c20] via-[#141519] to-[#0e0f12]">
              <div className="hero-map absolute inset-0" style={{ backgroundImage: `url("${heroPreview}")` }} />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f12]/85 via-[#0e0f12]/40 to-transparent" />
              <p className="absolute bottom-3 left-3 text-[13px] font-bold text-white">Pratinjau hero</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              >
                <Upload className="h-3.5 w-3.5" /> Pilih gambar
              </button>
              <button
                type="button"
                onClick={() => setHero(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Gambar bawaan
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void pickHero(e.target.files?.[0])} />
            </div>
            {heroErr && <p className="mt-2 text-[12px] font-semibold text-rose-600">{heroErr}</p>}
          </section>

          {/* Warna */}
          <section className={section}>
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-800 dark:text-slate-100">
              <Palette className="h-4 w-4 text-slate-400" /> Warna
            </h3>
            {/* Pratinjau mini */}
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-[#eef1f5] dark:border-slate-700 dark:bg-slate-950">
              <div
                className="flex items-center justify-between border-b border-slate-200/70 px-3 py-2 backdrop-blur"
                style={{ backgroundColor: `color-mix(in srgb, ${val('headerTint')} 55%, transparent)` }}
              >
                <span className="font-display text-[14px] font-extrabold">
                  <span style={{ color: val('brandAccent') }}>{settings.brandName}</span>
                  <span className="text-black dark:text-white">{settings.brandSuffix}</span>
                </span>
                <span className="text-[10px] text-slate-400">header</span>
              </div>
              <div className="p-3">
                <span className="inline-block rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white" style={{ backgroundColor: val('menuActive') }}>
                  Menu aktif
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {COLOR_FIELDS.map((f) => (
                <div key={f.key}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">{f.label}</p>
                      <p className="text-[11px] text-slate-400">{f.hint}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <input
                        type="color"
                        aria-label={f.label}
                        value={val(f.key)}
                        onChange={(e) => setColors((c) => ({ ...c, [f.key]: e.target.value }))}
                        className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-transparent dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => setColors((c) => ({ ...c, [f.key]: '' }))}
                        className="text-[11.5px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
                      >
                        Bawaan
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-label={`${f.label} ${p}`}
                        onClick={() => setColors((c) => ({ ...c, [f.key]: p }))}
                        className={`h-5 w-5 rounded-full ring-offset-2 dark:ring-offset-slate-900 ${val(f.key) === p ? 'ring-2 ring-slate-500' : ''}`}
                        style={{ backgroundColor: p }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Aksesoris header */}
          <section className={section}>
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-slate-400" /> Aksesoris menggantung di bawah header
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setOrnament('')}
                aria-pressed={ornament === ''}
                className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-colors ${
                  ornament === '' ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-900/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex h-14 items-center text-[12px] text-slate-400">—</span>
                <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">Tanpa aksesoris</span>
              </button>
              {ORNAMENT_SETS.map((set) => {
                const assets = Array.from(new Set(set.items.map((i) => i.asset)));
                const active = ornament === set.id;
                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => setOrnament(set.id)}
                    aria-pressed={active}
                    className={`relative flex flex-col items-center rounded-xl border p-3 text-center transition-colors ${
                      active ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-900/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    {active && <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-cyan-600" strokeWidth={3} />}
                    <span className="flex h-14 items-start justify-center gap-2">
                      {assets.map((a, i) => (
                        <span key={a} className="flex flex-col items-center">
                          <span className="block w-px bg-amber-700/50" style={{ height: 6 + (i % 2) * 8 }} />
                          <img src={ORNAMENT_ASSETS[a].src} alt={ORNAMENT_ASSETS[a].label} className="h-9 w-auto" />
                        </span>
                      ))}
                    </span>
                    <span className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{set.name}</span>
                    <span className="text-[11px] text-slate-400">{set.theme}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <div role="status" className="min-h-[18px] text-[12px] font-semibold">
            {result && (
              <span className={`inline-flex items-center gap-1.5 ${result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {result.ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <CircleAlert className="h-3.5 w-3.5" />}
                {result.msg}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
              Tutup
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              aria-busy={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-cyan-700 disabled:cursor-wait disabled:opacity-80"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Menyimpan…' : 'Simpan Tema'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
