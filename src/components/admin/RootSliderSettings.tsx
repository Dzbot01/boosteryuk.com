import { useRef, useState } from 'react';
import { Image, Upload, RotateCcw } from 'lucide-react';
import { useSiteSettings } from '../../context/SiteSettingsContext';
import { SERVICE_SLIDES } from '../../constants';
import { IS_CHILD_PANEL } from '../../lib/apiBase';

export default function RootSliderSettings() {
  const { settings, slides, saveRootSlide } = useSiteSettings();
  const input = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ok: boolean; text: string} | null>(null);
  if (IS_CHILD_PANEL) return null;
  const save = async (index: number, data: string | null) => {
    setBusy(true);setNotice(null);
    const result = await saveRootSlide(index, data);
    setNotice({ok: result.ok, text: result.ok ? (data ? 'Gambar slider tersimpan untuk semua pengunjung.' : 'Gambar kembali ke bawaan.') : result.message || 'Gagal menyimpan slider.'});
    setBusy(false);
  };
  return <section aria-labelledby="root-slider-title" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-700 dark:bg-slate-900">
    <h2 id="root-slider-title" className="flex items-center gap-2 text-base font-extrabold"><Image className="h-5 w-5 text-cyan-500" />Image Slider</h2>
    <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Gambar bersama untuk Buat Pesanan, Sewa Agen AI, dan VPS di website utama. Gambar lama tetap dipakai jika belum diganti. JPG, PNG, atau WebP, maksimal 2 MB dan 8192px per sisi.</p>
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      {SERVICE_SLIDES.map((slide, index) => <div key={index} className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <img src={slides?.[index]?.image || slide.url} alt={`Pratinjau slide ${index + 1}`} className="aspect-video w-full rounded-lg bg-slate-100 object-cover dark:bg-slate-800" />
        <p className="mt-2 text-sm font-bold">Slide {index + 1}</p><p className="mt-1 text-xs text-slate-500">{settings.rootSlideImages?.[index] ? 'Gambar kustom' : 'Gambar bawaan'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => {setSelected(index);input.current?.click();}} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Upload className="h-3 w-3" />Ganti</button>
          <button type="button" disabled={busy || !settings.rootSlideImages?.[index]} onClick={() => void save(index, null)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600 disabled:opacity-50"><RotateCcw className="h-3 w-3" />Reset</button>
        </div>
      </div>)}
    </div>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Upload gambar slider" onChange={async event => {
      const file = event.target.files?.[0];event.target.value = '';
      if (!file || busy) return;
      if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {setNotice({ok: false, text: 'Pilih JPG, PNG atau WebP maksimal 2 MB.'});return;}
      setBusy(true);
      try {
        const data = await new Promise<string>((resolve,reject) => {const reader = new FileReader();reader.onload = () => resolve(String(reader.result));reader.onerror = reject;reader.readAsDataURL(file);});
        await save(selected, data);
      } catch {setBusy(false);setNotice({ok: false, text: 'Gagal membaca gambar.'});}
    }} />
    {busy && <p role="status" className="mt-3 text-xs text-cyan-600 dark:text-cyan-400">Menyimpan gambar slider…</p>}
    {notice && <p role={notice.ok ? 'status' : 'alert'} className={`mt-3 text-xs ${notice.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{notice.text}</p>}
  </section>;
}
