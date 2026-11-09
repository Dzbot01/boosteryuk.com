import Seo from '../components/Seo';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Zap, DollarSign, CheckCircle2 } from 'lucide-react';
import Reveal from '../components/Reveal';
import { useAuth } from '../context/AuthContext';

const PRICE = 5000;

export default function PlusPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="page-align-left mx-auto max-w-3xl px-4 pb-32 pt-8 sm:px-6">
      <Seo title="Boosteryuk Plus" description="Upgrade ke Boosteryuk Plus untuk harga lebih murah, prioritas pesanan, dan benefit premium lainnya." />
      <Reveal>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali
        </button>
      </Reveal>

      {user?.plusActive && (
        <Reveal delay={35}>
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2.4} />
            <div>
              <p className="text-[13.5px] font-bold">Boosteryuk Plus Aktif</p>
              <p className="text-[11.5px] font-medium">Nikmati harga murah dan benefit premium.</p>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal delay={60}>
        <div className="mb-6 flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-600/25">
            <Sparkles className="h-7 w-7" strokeWidth={2} />
          </span>
          <div>
            <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white sm:text-[32px]">
              Boosteryuk Plus
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400">
              Tingkatkan akun Anda ke level premium
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)] dark:border-slate-700/60 dark:bg-slate-800/80">
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/50">
            <h2 className="font-display text-[18px] font-extrabold tracking-tight text-slate-900 dark:text-white">
              Upgrade Sekarang
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
              Tingkatkan akun ke <strong>Boosteryuk Plus</strong> untuk mendapatkan fitur menarik dan
              harga paling murah.
            </p>
          </div>

          {/* MP4 player */}
          <div className="aspect-video w-full bg-slate-900">
            <video
              src="/boosteryuk.mp4"
              controls
              className="h-full w-full"
              poster="/thumbnail.jpg"
            >
              Browser Anda tidak mendukung video player.
            </video>
          </div>

          {/* Pricing card */}
          <div className="p-6">
            <div className="rounded-[20px] border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-lg shadow-cyan-500/10 dark:from-cyan-950/30 dark:to-slate-800/80">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-600/25">
                    <Zap className="h-6 w-6" strokeWidth={2.2} />
                  </span>
                  <div>
                    <h3 className="font-display text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                      Paket Plus
                    </h3>
                    <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                      Bayar sekali untuk selamanya
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-[32px] font-extrabold leading-none text-cyan-600 dark:text-cyan-400">
                  Rp {PRICE.toLocaleString('id-ID')}
                </span>
                <span className="text-[13px] text-slate-500 dark:text-slate-400">/sekali bayar selamanya</span>
              </div>

              <ul className="mt-4 space-y-2">
                {[
                  { icon: Zap, text: 'Dapatkan harga paling murah' },
                  { icon: DollarSign, text: 'Badge profil mewah' },
                  { icon: Sparkles, text: 'Prioritas customer service' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <item.icon
                      className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400"
                      strokeWidth={2.2}
                    />
                    <span className="text-[13px] text-slate-700 dark:text-slate-300">{item.text}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => navigate('/upgrade-plus')}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[14px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99]"
              >
                Pilih Paket
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
