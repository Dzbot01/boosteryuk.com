import Seo from '../components/Seo';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Clock,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Hash,
  Layers,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import OrderResult from '../components/OrderResult';
import ErrorPanel from '../components/ErrorPanel';
import { LOGO_URL } from '../constants';
import {
  checkOrderStatus,
  parseOrderIds,
  type DebugInfo,
  type LookupFailure,
  type OrderData,
} from '../services/orderApi';

export default function CekStatusPage() {
  const navigate = useNavigate();

  const [orderId, setOrderId] = useState('');
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [failures, setFailures] = useState<LookupFailure[]>([]);
  const [debug, setDebug] = useState<DebugInfo | null>(null);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Captcha verification state
  const [captcha, setCaptcha] = useState<{ a: number; b: number } | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaError, setCaptchaError] = useState('');

  const generateCaptcha = () => {
    setCaptcha({
      a: Math.floor(Math.random() * 50) + 1,
      b: Math.floor(Math.random() * 50) + 1,
    });
    setCaptchaAnswer('');
    setCaptchaError('');
  };

  const handleSearch = () => {
    const trimmed = orderId.trim();

    if (!trimmed) {
      setError('Masukkan minimal satu ID pesanan booster.');
      setOrders([]);
      setFailures([]);
      setDebug(null);
      setSearched(true);
      return;
    }

    // Gate the actual search behind a math captcha.
    generateCaptcha();
  };

  const runSearch = async () => {
    const trimmed = orderId.trim();

    setLoading(true);
    setError('');
    setInfoMsg('');
    setOrders([]);
    setFailures([]);
    setDebug(null);
    setSearched(true);

    try {
      const res = await checkOrderStatus(trimmed);
      setDebug(res.debug);
      setOrders(res.orders);
      setFailures(res.failures);

      if (res.orders.length > 0) {
        setInfoMsg(res.message);
        setError(res.failures.length > 0 ? res.message : '');
      } else {
        setError(res.message || 'Pesanan tidak ditemukan.');
      }
    } catch (err) {
      const e = err as Error;
      setOrders([]);
      setFailures(
        parseOrderIds(trimmed).ids.map((id) => ({
          id,
          reason: e?.message || 'Gagal memproses permintaan.',
        })),
      );
      setError(e?.message || 'Terjadi kesalahan saat memproses permintaan.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCaptcha = () => {
    if (!captcha) return;
    const answer = Number(captchaAnswer);
    if (answer === captcha.a + captcha.b) {
      // Correct — close the modal and proceed.
      setCaptcha(null);
      setCaptchaAnswer('');
      setCaptchaError('');
      runSearch();
    } else {
      setCaptchaError('Jawaban salah, coba lagi.');
    }
  };

  const resetSearch = () => {
    setOrders([]);
    setFailures([]);
    setDebug(null);
    setError('');
    setInfoMsg('');
    setSearched(false);
    setOrderId('');
  };

  return (
    <main className="page-align-left mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6">
      <Seo title="Cek Status Pesanan" description="Cek status pesanan Boosteryuk dengan mudah dan cepat. Masukkan ID pesanan untuk melacak progres layanan SMM kamu." />
      <Reveal>
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali
        </button>
      </Reveal>

      {/* ================= SEARCH ================= */}
      <Reveal delay={30}>
        <section className="relative z-10">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.18)] dark:border-slate-700/60 dark:bg-slate-800/80 dark:shadow-black/30 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  Cek Status Pesanan
                </h1>
                <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                  Masukkan ID pesanan. Pisahkan dengan koma untuk cek massal (maks. 50 ID).
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-700/40">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.4} />
                Data aman
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Hash className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value.replace(/[^\d,]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleSearch()}
                  placeholder="Contoh: 1107 atau 1107,1234"
                  inputMode="numeric"
                  autoFocus
                  className="h-[54px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 font-mono text-[15px] tracking-wide text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 dark:border-slate-600 dark:bg-slate-700/50 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-500 dark:focus:bg-slate-700"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={loading}
                className="group flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 text-[15px] font-bold text-white shadow-lg shadow-blue-600/25 transition-all duration-200 hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Mengecek
                  </>
                ) : (
                  <>
                    Cek Status
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      strokeWidth={2.4}
                    />
                  </>
                )}
              </button>
            </div>

            {!searched && (
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-200 pt-4 dark:border-slate-700/60">
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Contoh ID:
                </span>
                {['1107', '1234'].map((id) => (
                  <button
                    key={id}
                    onClick={() => setOrderId(id)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[12px] font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400"
                  >
                    {id}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* ================= LOADING ================= */}
      {loading && (
        <div className="mt-8">
          <div className="flex flex-col items-center gap-5 rounded-[28px] border border-slate-200 bg-white py-14 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80">
            <div className="relative h-20 w-20">
              <span className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-700" />
              <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-600" />
              <span className="absolute inset-0 flex items-center justify-center">
                <img src={LOGO_URL} alt="" className="h-9 w-9 object-contain" />
              </span>
            </div>
            <div className="text-center">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                Memuat status pesanan…
              </p>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                Mohon tunggu sebentar.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= ERROR ================= */}
      {error && !loading && (
        <div className="mt-8">
          <ErrorPanel
            title="Pesanan tidak ditemukan"
            message={error}
            failures={failures}
            debug={debug}
            onRetry={handleSearch}
          />
        </div>
      )}

      {/* ================= RESULTS ================= */}
      {!loading && orders.length > 0 && (
        <div className="mt-8 space-y-8">
          {orders.length > 1 && (
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Layers className="h-4 w-4" strokeWidth={2.3} />
              </span>
              <p className="font-display text-base font-extrabold text-slate-900 dark:text-white">
                {orders.length} pesanan ditemukan
                {failures.length > 0 && (
                  <span className="ml-2 text-[13px] font-semibold text-rose-600 dark:text-rose-400">
                    · {failures.length} gagal
                  </span>
                )}
              </p>
            </div>
          )}

          {orders.map((o) => (
            <OrderResult key={o.orderId} order={o} message={orders.length === 1 ? infoMsg : o.msg} />
          ))}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              onClick={resetSearch}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3.5 text-[13.5px] font-bold text-slate-700 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400"
            >
              <Search className="h-4 w-4" strokeWidth={2.4} />
              Cek pesanan lain
            </button>
            <button
              onClick={handleSearch}
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-[13.5px] font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.99] dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Clock className="h-4 w-4" strokeWidth={2.2} />
              Refresh status
            </button>
          </div>
        </div>
      )}

      {/* ================= CAPTCHA MODAL ================= */}
      {captcha && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 animate-fade-in bg-slate-900/50"
            onClick={() => setCaptcha(null)}
          />
          <div className="relative w-full max-w-[300px] animate-modal-pop-in rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/25 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </span>
              <div>
                <p className="font-display text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Verifikasi Captcha
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Selesaikan penjumlahan berikut
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-50 py-3 font-mono text-[22px] font-extrabold text-slate-900 dark:bg-slate-800 dark:text-white">
              <span>{captcha.a}</span>
              <span className="text-blue-600">+</span>
              <span>{captcha.b}</span>
              <span className="text-slate-400 dark:text-slate-400">=</span>
              <span className="text-slate-300">?</span>
            </div>

            <input
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && verifyCaptcha()}
              inputMode="numeric"
              placeholder="Jawaban"
              autoFocus
              className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-center font-mono text-[16px] font-bold text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />

            {captchaError && (
              <p className="mt-2 text-center text-[12px] font-semibold text-rose-600 dark:text-rose-400">
                {captchaError}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setCaptcha(null)}
                className="h-11 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                onClick={verifyCaptcha}
                className="h-11 rounded-xl bg-blue-600 text-[13px] font-bold text-white shadow-md shadow-blue-600/25 transition-colors hover:bg-blue-700 active:scale-[0.98]"
              >
                Verifikasi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
