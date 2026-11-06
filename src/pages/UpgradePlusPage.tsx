import { useState, useEffect } from 'react'; // <-- tambah useEffect
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Zap,
  DollarSign,
  Wallet,
  CheckCircle2,
  LoaderCircle,
} from 'lucide-react'; // <-- fix: '-react' diganti 'lucide-react'
import Reveal from '../components/Reveal';
import LogoRain from '../components/LogoRain';
import { useAuth } from '../context/AuthContext';

const PRICE = 5000;

function rupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function UpgradePlusPage() {
  const navigate = useNavigate();
  const { user, topUp, activatePlus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // FIX: Jangan navigate di render. Pindah ke useEffect
  useEffect(() => {
    if (!user) {
      navigate('/plus');
    }
  }, [user, navigate]);

  if (!user) return null; // loading state

  const canAfford = user.balance >= PRICE;

  const handleOrder = async () => {
    if (!canAfford || user.plusActive) return;
    setLoading(true);

    try {
      const res = await fetch('https://cekidku.my.id/api/upgrade.php', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: user.id })
      });
      const data = await res.json();

      if(data.ok){
        // 1. Update context dulu
        await activatePlus();
        await topUp(-PRICE);

        setLoading(false);
        setSuccess(true); // Munculin LogoRain

        // 2. Tunggu 6.5 detik baru redirect. Sama kayak versi awal
        window.setTimeout(() => navigate('/'), 6500);
      } else {
        setLoading(false);
        alert(data.message);
      }
    } catch (e) {
      setLoading(false);
      alert("Gagal konek ke server");
    }
  };

  return (
    <div className="page-align-left mx-auto max-w-lg px-4 pb-32 pt-8 sm:px-6">
      {success && <LogoRain />}
      <Reveal>
        <button
          onClick={() => navigate('/plus')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali
        </button>
      </Reveal>

      {user.plusActive && (
        <Reveal delay={30}>
          <div className="mb-5 flex items-center gap-3 rounded-2xl border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" strokeWidth={2.4} />
            <div>
              <p className="text-[13.5px] font-bold">Boosteryuk Plus Aktif</p>
              <p className="text-[11.5px] font-medium">Akun Anda sudah menikmati benefit Plus.</p>
            </div>
          </div>
        </Reveal>
      )}

      <Reveal delay={60}>
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.25)] dark:border-slate-700/60 dark:bg-slate-800/80">
          {/* Header */}
          <div className="border-b border-slate-100 px-6 py-5 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-600/25">
                <Sparkles className="h-6 w-6" strokeWidth={2} />
              </span>
              <div>
                <h1 className="font-display text-[22px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white">
                  Checkout Paket Plus
                </h1>
                <p className="mt-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                  Review pesanan Anda sebelum melakukan pembayaran
                </p>
              </div>
            </div>
          </div>

          {/* Package details */}
          <div className="p-6">
            <div className="rounded-2xl border-cyan-500/30 bg-gradient-to-br from-cyan-50 to-white p-5 dark:from-cyan-950/30 dark:to-slate-800/80">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-600/25">
                  <Zap className="h-5 w-5" strokeWidth={2.2} />
                </span>
                <div>
                  <h2 className="font-display text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Paket Plus
                  </h2>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400">
                    Bayar sekali untuk selamanya
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {[
                  { icon: Zap, text: 'Dapatkan harga paling murah' },
                  { icon: DollarSign, text: 'Badge profil Plus' },
                  { icon: Sparkles, text: 'Dapatkan akses pembaruan lebih awal' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <item.icon
                      className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400"
                      strokeWidth={2.2}
                    />
                    <span className="text-[12.5px] text-slate-700 dark:text-slate-300">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Payment summary */}
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-700/50">
                <div className="flex items-center gap-2.5">
                  <Wallet className="h-5 w-5 text-slate-500 dark:text-slate-400" strokeWidth={2.1} />
                  <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                    Saldo Anda
                  </span>
                </div>
                <span className="font-display text-[15px] font-extrabold text-slate-900 dark:text-white">
                  {rupiah(user.balance)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-3 dark:border-slate-700">
                <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
                  Total Pembayaran
                </span>
                <span className="font-display text-[22px] font-extrabold text-cyan-600 dark:text-cyan-400">
                  {rupiah(PRICE)}
                </span>
              </div>
            </div>

            <button
              onClick={handleOrder}
              disabled={!canAfford || loading || success || user.plusActive}
              className="mt-5 flex h-13 h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[14px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Memproses…
                </>
              ) : success? (
                <>
                  <CheckCircle2 className="h-4 w-4" strokeWidth={2.4} />
                  Berhasil
                </>
              ) : (
                'Pesan Sekarang'
              )}
            </button>

            {success && (
              <p className="mt-3 text-center text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                Upgrade berhasil! Mengarahkan…
              </p>
            )}
          </div>
        </div>
      </Reveal>
    </div>
  );
}