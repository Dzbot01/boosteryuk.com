import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Image as ImageIcon,
  Type,
  AlignLeft,
  Music,
  Megaphone,
  Upload,
  RotateCcw,
  Save,
  Trash2,
  Plus,
  Check,
  Eye,
  X,
  Sparkles,
  Wrench,
  Rocket,
  ShieldCheck,
  LayoutGrid,
  Clock3,
} from 'lucide-react';
import Reveal from '../../components/Reveal';
import { useSiteSettings, type InfoItem } from '../../context/SiteSettingsContext';

export default function AdminWebsitePage() {
  const navigate = useNavigate();
  const {
    settings,
    updateSettings,
    setInfoItems,
    setMusicFile,
    setLogoFile,
    resetMusic,
    resetLogo,
  } = useSiteSettings();

  const [brandName, setBrandName] = useState(settings.brandName);
  const [brandSuffix, setBrandSuffix] = useState(settings.brandSuffix);
  const [footerText, setFooterText] = useState(settings.footerText);
  const [infoItems, setLocalInfo] = useState<InfoItem[]>(settings.infoItems);
  const [saved, setSaved] = useState(false);
  const [musicName, setMusicName] = useState('');

  const logoInput = useRef<HTMLInputElement>(null);
  const musicInput = useRef<HTMLInputElement>(null);
  const infoImageInput = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const flash = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const saveBrand = () => {
    updateSettings({
      brandName: brandName.trim() || 'Booster',
      brandSuffix: brandSuffix.trim() || 'yuk',
      footerText: footerText.trim() || settings.footerText,
    });
    flash();
  };

  const saveInfo = () => {
    setInfoItems(infoItems);
    flash();
  };

  const addInfo = () => {
    setLocalInfo((items) => [
      {
        id: Date.now(),
        tag: 'Update',
        title: 'Judul baru',
        desc: 'Isi deskripsi informasi di sini.',
        time: 'Baru saja',
      },
      ...items,
    ]);
  };

  const updateInfo = (id: number, patch: Partial<InfoItem>) => {
    setLocalInfo((items) => items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeInfo = (id: number) => {
    setLocalInfo((items) => items.filter((it) => it.id !== id));
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate('/admin')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Admin Panel
        </button>
      </Reveal>

      <Reveal delay={30}>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[32px]">
          Pengaturan Website
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500 dark:text-slate-400">
          Atur identitas brand, musik, dan papan informasi user.
        </p>
      </Reveal>

      {saved && (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
          <Check className="h-4 w-4" strokeWidth={2.6} />
          Perubahan disimpan
        </div>
      )}

      {/* Logo */}
      <Reveal delay={60}>
        <Card title="Logo Header" icon={ImageIcon}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <img src={settings.logoUrl} alt="Logo" className="h-12 w-12 object-contain" />
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => logoInput.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-sm transition-all hover:bg-cyan-700 active:scale-95"
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={2.4} />
                Upload Logo
              </button>
              <button
                onClick={() => {
                  resetLogo();
                  flash();
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12.5px] font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
                Default
              </button>
            </div>
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setLogoFile(f);
                  flash();
                }
              }}
            />
          </div>
        </Card>
      </Reveal>

      {/* Brand + Footer */}
      <Reveal delay={90}>
        <Card title="Nama Brand & Footer" icon={Type}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Nama brand (warna)
              </span>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="admin-input"
                placeholder="Booster"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Suffix (hitam)
              </span>
              <input
                value={brandSuffix}
                onChange={(e) => setBrandSuffix(e.target.value)}
                className="admin-input"
                placeholder="yuk"
              />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
              <AlignLeft className="h-3 w-3" />
              Teks Footer
            </span>
            <input
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              className="admin-input"
              placeholder="© 2025 Boosteryuk · …"
            />
          </label>
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">Preview</p>
            <p className="mt-1 font-display text-[18px] font-extrabold">
              <span className="text-cyan-600">{brandName || 'Booster'}</span>
              <span className="text-slate-900 dark:text-white">{brandSuffix || 'yuk'}</span>
            </p>
            <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{footerText}</p>
          </div>
          <button
            onClick={saveBrand}
            className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[13.5px] font-bold text-white shadow-md shadow-cyan-600/20 transition-all hover:bg-cyan-700 active:scale-[0.99]"
          >
            <Save className="h-4 w-4" strokeWidth={2.3} />
            Simpan Brand
          </button>
        </Card>
      </Reveal>

      {/* Musik */}
      <Reveal delay={120}>
        <Card title="Musik Latar" icon={Music}>
          <p className="text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            Upload file MP3 baru untuk mengganti musik default. Tombol play di bottom navbar akan
            memakai file yang Anda pilih.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => musicInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-sm transition-all hover:bg-cyan-700 active:scale-95"
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={2.4} />
              Upload Musik
            </button>
            <button
              onClick={() => {
                resetMusic();
                setMusicName('');
                flash();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12.5px] font-bold text-slate-600 transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
              Gunakan Default
            </button>
            <input
              ref={musicInput}
              type="file"
              accept="audio/*,.mp3,.wav,.ogg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setMusicFile(f);
                  setMusicName(f.name);
                  flash();
                }
              }}
            />
          </div>
          {musicName && (
            <p className="mt-3 text-[12px] font-semibold text-cyan-700 dark:text-cyan-400">
              Aktif: {musicName}
            </p>
          )}
          <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-400">
            Sumber saat ini:{' '}
            <span className="font-mono">
              {settings.musicUrl.startsWith('blob:') ? 'File custom (session)' : settings.musicUrl}
            </span>
          </p>
        </Card>
      </Reveal>

      {/* Papan Informasi */}
      <Reveal delay={150}>
        <Card title="Papan Informasi" icon={Megaphone}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              Semua konten modal informasi floating pada POV user dapat diedit di sini, termasuk
              gambar.
            </p>
            <button
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-[12px] font-bold text-cyan-700 transition-all hover:bg-cyan-100 active:scale-95 dark:border-cyan-800/40 dark:bg-cyan-900/25 dark:text-cyan-400 dark:hover:bg-cyan-900/40"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={2.3} />
              Preview Modal
            </button>
          </div>

          <div className="space-y-3">
            {infoItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40"
              >
                <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
                  <input
                    value={item.tag}
                    onChange={(e) => updateInfo(item.id, { tag: e.target.value })}
                    className="admin-input !pl-3 text-[12px] font-bold"
                    placeholder="Tag"
                  />
                  <input
                    value={item.time}
                    onChange={(e) => updateInfo(item.id, { time: e.target.value })}
                    className="admin-input !pl-3 text-[12px]"
                    placeholder="Waktu"
                  />
                </div>
                <input
                  value={item.title}
                  onChange={(e) => updateInfo(item.id, { title: e.target.value })}
                  className="admin-input mt-2 !pl-3 font-semibold"
                  placeholder="Judul"
                />
                <textarea
                  value={item.desc}
                  onChange={(e) => updateInfo(item.id, { desc: e.target.value })}
                  rows={2}
                  className="admin-input mt-2 !h-auto !py-2.5 !pl-3"
                  placeholder="Deskripsi"
                />

                {/* Gambar (opsional) */}
                <div className="mt-2 flex items-center gap-2">
                  {item.image && (
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => updateInfo(item.id, { image: undefined })}
                        aria-label="Hapus gambar"
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-slate-900/70 text-white"
                      >
                        <X className="h-3 w-3" strokeWidth={3} />
                      </button>
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setUploadTargetId(item.id);
                      infoImageInput.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Upload className="h-3.5 w-3.5" strokeWidth={2.2} />
                    {item.image ? 'Ganti Gambar' : 'Tambah Gambar'}
                  </button>
                </div>

                <button
                  onClick={() => removeInfo(item.id)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={addInfo}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12.5px] font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
              Tambah Info
            </button>
            <button
              onClick={saveInfo}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-sm transition-all hover:bg-cyan-700 active:scale-95"
            >
              <Save className="h-3.5 w-3.5" strokeWidth={2.4} />
              Simpan Informasi
            </button>
          </div>

          <input
            ref={infoImageInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && uploadTargetId !== null) {
                const url = URL.createObjectURL(f);
                updateInfo(uploadTargetId, { image: url });
              }
            }}
          />
        </Card>
      </Reveal>

      {/* Preview modal — visual of the user-facing floating info modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setShowPreview(false)} />
          <div className="relative flex max-h-[85vh] w-full max-w-[420px] flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-black/40 dark:bg-slate-900">
            <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-md">
                <img src={settings.logoUrl} alt="" className="h-6 w-6 object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Informasi &amp; Pengumuman
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-400">{infoItems.length} pembaruan</p>
              </div>
              <button
                onClick={() => setShowPreview(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              >
                <X className="h-4 w-4" strokeWidth={2.4} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {infoItems.map((item) => (
                <InfoPreviewCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-input {
          height: 42px;
          width: 100%;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          background: #fff;
          padding: 0 12px;
          font-size: 13.5px;
          color: #0f172a;
          outline: none;
          transition: all .2s;
        }
        .admin-input:focus {
          border-color: #06b6d4;
          box-shadow: 0 0 0 4px rgba(6,182,212,.12);
        }
        .dark .admin-input {
          border-color: #334155;
          background: rgba(51,65,85,.45);
          color: #f1f5f9;
        }
      `}</style>
    </div>
  );
}

const PREVIEW_ICONS: Record<string, typeof Sparkles> = {
  Fitur: Sparkles,
  Update: Megaphone,
  Layanan: Rocket,
  Maintenance: Wrench,
  Keamanan: ShieldCheck,
  Garansi: ShieldCheck,
};

function InfoPreviewCard({ item }: { item: InfoItem }) {
  const Icon = PREVIEW_ICONS[item.tag] || LayoutGrid;

  if (item.image) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/40">
        <img src={item.image} alt={item.title} className="h-32 w-full object-cover" />
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white">{item.title}</p>
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/50">
              {item.tag}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{item.desc}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700/60 dark:bg-slate-800/40">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-900/25 dark:text-cyan-400">
        <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-bold text-slate-900 dark:text-white">{item.title}</p>
          <span className="rounded-md bg-cyan-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-900/25 dark:text-cyan-400 dark:ring-cyan-800/50">
            {item.tag}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{item.desc}</p>
        <p className="mt-1 flex items-center gap-1 text-[10.5px] font-medium text-slate-400 dark:text-slate-500">
          <Clock3 className="h-3 w-3" strokeWidth={2.2} />
          {item.time}
        </p>
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/80">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700/50">
        <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
        <h2 className="font-display text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
