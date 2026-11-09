import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Receipt } from 'lucide-react';
import Reveal from '../components/Reveal';
import StrukCard from '../components/StrukCard';
import { saveStruk, type Struk } from '../services/strukStore';

const DEFAULT_TEXT = `Sukses! Pesanan anda berhasil di buat
Id Pesanan : 5109532
Layanan : TikTok Video Views FP 52 [ Max Unlimited ] Slow
Target : https://vt.tiktok.com/ZSV5nubgL/
Jumlah : 5.000
Tanggal pesanan : 22 Agustus 2026 17:43:43`;

function extract(text: string, key: string): string {
  const regex = new RegExp(`${key}\\s*:\\s*(.*)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function parseFields(text: string) {
  return {
    orderId: extract(text, 'Id Pesanan'),
    layanan: extract(text, 'Layanan'),
    target: extract(text, 'Target'),
    jumlah: extract(text, 'Jumlah'),
    tanggal: extract(text, 'Tanggal pesanan'),
  };
}

function isComplete(fields: ReturnType<typeof parseFields>) {
  return Object.values(fields).every((v) => v.length > 0 && v !== '-');
}

export default function StrukPage() {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState(DEFAULT_TEXT);
  const [failed, setFailed] = useState<Struk | null>(null);

  const fields = useMemo(() => parseFields(rawText), [rawText]);
  const complete = isComplete(fields);

  const handleGenerate = () => {
    if (complete) {
      const struk: Struk = { ...fields, ok: true };
      const code = saveStruk(struk);
      navigate(`/sukses${fields.orderId}${code}`);
      return;
    }

    setFailed({
      orderId: '',
      layanan: '',
      target: '',
      jumlah: '',
      tanggal: '',
      ok: false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (failed) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-md flex-col px-4 py-8 sm:px-6">
        <Reveal>
          <button
            onClick={() => setFailed(null)}
            className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
            Kembali ke Editor
          </button>
        </Reveal>
        <Reveal delay={40} className="flex flex-1 flex-col items-center">
          <StrukCard struk={failed} />
        </Reveal>
      </div>
    );
  }

  return (
    <div className="page-align-left mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali
        </button>
      </Reveal>

      <Reveal delay={40}>
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-lg shadow-cyan-600/25">
            <Receipt className="h-7 w-7" strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-[30px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white sm:text-[38px]">
              Buat Struk
            </h1>
            <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              Tempel teks pesanan sukses Anda di bawah ini, dan kami akan mengubahnya menjadi
              struk digital yang rapi.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="mt-8 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-700/50">
            <h3 className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
              Data Pesanan
            </h3>
          </div>
          <div className="p-6">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="h-64 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 font-mono text-[13.5px] leading-relaxed text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:focus:border-cyan-600 dark:focus:bg-slate-900"
              placeholder={`Sukses! Pesanan anda berhasil di buat
Id Pesanan : 
Layanan : 
Target : 
Jumlah : 
Tanggal pesanan : `}
            />

            {!complete && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                data belum lengkap
              </div>
            )}

            <button
              onClick={handleGenerate}
              className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 text-[14px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99]"
            >
              Buat Struk Digital Sekarang
            </button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
