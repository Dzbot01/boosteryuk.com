import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  QrCode,
  CheckCircle2,
  X,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import { QRIS_IMAGE } from '../constants';
import { useAuth } from '../context/AuthContext';
import { useDeposits } from '../context/DepositContext';

const PAY_WINDOW_SECONDS = 10 * 60; // 10 menit
const CANCEL_UNLOCK_MS = 5 * 60 * 1000; // Batalkan aktif setelah 5 menit

interface InvoiceState {
  nominal: number;
  bonus: number;
  fee?: number;
  total: number;
  pay?: number;
}

function rupiah(n: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function DepositInvoicePage() {
  const { method = '' } = useParams<{ method: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();
  const invoice = state as InvoiceState | undefined;

  const { user, topUp } = useAuth();
  const { addDeposit } = useDeposits();

  const startedAt = useMemo(() => Date.now(), []);
  const [now, setNow] = useState(Date.now());
  const [paid, setPaid] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (paid || cancelled) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [paid, cancelled]);

  if (!invoice || !user) return <Navigate to="/deposit" replace />;

  const elapsedMs = now - startedAt;
  const remainingSeconds = Math.max(0, PAY_WINDOW_SECONDS - Math.floor(elapsedMs / 1000));
  const expired = remainingSeconds === 0;
  const canCancel = elapsedMs >= CANCEL_UNLOCK_MS;
  const cancelRemainMs = Math.max(0, CANCEL_UNLOCK_MS - elapsedMs);

  const checkPayment = () => {
    if (expired || cancelled || paid) return;
    setPaid(true);
    topUp(invoice.total);
    addDeposit({ username: user.username, amount: invoice.total });
    window.setTimeout(() => navigate('/'), 2400);
  };

  const cancel = () => {
    if (!canCancel || paid) return;
    setCancelled(true);
    window.setTimeout(() => navigate('/deposit'), 1600);
  };

  const copyAmount = () => {
    navigator.clipboard?.writeText(String(invoice.pay ?? invoice.nominal)).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => {},
    );
  };

  return (
    <div className="page-align-left mx-auto max-w-md px-4 pb-32 pt-8 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate(`/deposit/${method}`)}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali
        </button>
      </Reveal>

      <Reveal delay={30}>
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_22px_50px_-26px_rgba(15,23,42,0.35)] dark:border-slate-700/60 dark:bg-slate-800/80">
          {/* header */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700/60">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-900/25 dark:text-cyan-400">
              <QrCode className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Invoice Deposit
              </p>
              <p className="font-display text-[15px] font-extrabold text-slate-900 dark:text-white">
                QRIS · #{startedAt.toString().slice(-6)}
              </p>
            </div>
            {/* timer */}
            <div
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 font-mono text-[13px] font-extrabold ${
                expired
                  ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/25 dark:text-rose-400'
                  : remainingSeconds < 30
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-400'
                    : 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/25 dark:text-cyan-400'
              }`}
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={2.4} />
              {pad(Math.floor(remainingSeconds / 60))}:{pad(remainingSeconds % 60)}
            </div>
          </div>

          {/* QR */}
          <div className="px-6 py-6">
            <div className="relative mx-auto w-full max-w-[280px]">
              <span className="absolute -left-1.5 -top-1.5 h-6 w-6 rounded-tl-lg border-l-[3px] border-t-[3px] border-cyan-500" />
              <span className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-tr-lg border-r-[3px] border-t-[3px] border-cyan-500" />
              <span className="absolute -bottom-1.5 -left-1.5 h-6 w-6 rounded-bl-lg border-b-[3px] border-l-[3px] border-cyan-500" />
              <span className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-br-lg border-b-[3px] border-r-[3px] border-cyan-500" />
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                <img src={QRIS_IMAGE} alt="QRIS" className="h-auto w-full rounded-md object-contain" />
                {(expired || cancelled) && !paid && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/70 text-white backdrop-blur-sm">
                    <span className="rounded-lg bg-white/15 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide">
                      {cancelled ? 'Dibatalkan' : 'Kedaluwarsa'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* nominal */}
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-center dark:bg-slate-900/40">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Harus Dibayar
              </p>
              <p className="mt-1 font-display text-[26px] font-extrabold leading-none text-slate-900 dark:text-white">
                {rupiah(invoice.pay ?? invoice.nominal)}
              </p>
              <button
                onClick={copyAmount}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Tersalin' : 'Salin nominal'}
              </button>
            </div>

            {/* breakdown */}
            <dl className="mt-4 space-y-1.5 text-[12px]">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <dt>Nominal deposit</dt>
                <dd className="font-mono font-semibold">{rupiah(invoice.nominal)}</dd>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <dt>Bonus 10%</dt>
                <dd className="font-mono font-semibold">+{rupiah(invoice.bonus)}</dd>
              </div>
              {invoice.fee !== undefined && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <dt>Biaya admin 0,7%</dt>
                  <dd className="font-mono font-semibold">+{rupiah(invoice.fee)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 text-slate-900 dark:border-slate-700 dark:text-white">
                <dt className="font-bold">Total masuk saldo</dt>
                <dd className="font-mono font-extrabold">{rupiah(invoice.total)}</dd>
              </div>
            </dl>

            {/* info */}
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-200 bg-cyan-50/60 px-3 py-2.5 text-[11.5px] leading-relaxed text-cyan-800 dark:border-cyan-800/40 dark:bg-cyan-900/20 dark:text-cyan-300">
              <Info className="h-3.5 w-3.5 shrink-0 translate-y-[1px]" strokeWidth={2.4} />
              <p>
                Scan QRIS di atas dengan aplikasi bank / e-wallet. Setelah membayar, tekan{' '}
                <strong>Cek Pembayaran</strong> untuk memverifikasi. Tombol{' '}
                <strong>Batalkan</strong> aktif setelah 5 menit.
              </p>
            </div>
          </div>

          {/* actions */}
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 p-5 dark:border-slate-700/60">
            <button
              onClick={cancel}
              disabled={!canCancel || paid}
              title={
                canCancel
                  ? 'Batalkan invoice'
                  : `Bisa dibatalkan dalam ${pad(Math.floor(cancelRemainMs / 60000))}:${pad(Math.floor((cancelRemainMs % 60000) / 1000))}`
              }
              className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 text-[13px] font-bold text-rose-700 transition-all hover:bg-rose-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400"
            >
              <X className="h-4 w-4" strokeWidth={2.4} />
              {canCancel
                ? 'Batalkan'
                : `Batalkan (${pad(Math.floor(cancelRemainMs / 60000))}:${pad(Math.floor((cancelRemainMs % 60000) / 1000))})`}
            </button>
            <button
              onClick={checkPayment}
              disabled={expired || cancelled || paid}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-600 text-[13px] font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.4} />
              {paid ? 'Berhasil' : 'Cek Pembayaran'}
            </button>
          </div>

          {paid && (
            <div className="border-t border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-[12.5px] font-bold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
              Pembayaran terverifikasi. Saldo bertambah {rupiah(invoice.total)}. Mengarahkan…
            </div>
          )}
          {cancelled && (
            <div className="border-t border-rose-200 bg-rose-50 px-5 py-3 text-center text-[12.5px] font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400">
              Invoice dibatalkan.
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}
