import { useState } from 'react';
import {
  Rocket,
  Gauge,
  Activity,
  Users,
  Sparkles,
  Check,
  CircleDashed,
  RefreshCw,
  LoaderCircle,
  AlertTriangle,
} from 'lucide-react';
import { LOGO_URL } from '../constants';
import {
  formatCount,
  isCanceled,
  mapStatusToStage,
  stageIndex,
  statusLabel,
  timelineFor,
  type OrderData,
  type Stage,
} from '../services/orderApi';
import {
  checkRefillStatus,
  requestRefill,
  type RefillStatus,
} from '../services/refillApi';

const STEPS: Stage[] = ['Dibuat', 'Di Proses', 'Selesai'];

const stageStyle: Record<Stage, { text: string; bg: string; ring: string; bar: string }> = {
  Dibuat: {
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    ring: 'ring-amber-200 dark:ring-amber-700/40',
    bar: 'bg-amber-500',
  },
  'Di Proses': {
    text: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    ring: 'ring-blue-200 dark:ring-blue-700/40',
    bar: 'bg-blue-600',
  },
  Selesai: {
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    ring: 'ring-emerald-200 dark:ring-emerald-700/40',
    bar: 'bg-emerald-500',
  },
};

function progressPercent(order: OrderData, stageIdx: number): number {
  const status = order.orderStatus.toLowerCase();
  if (status === 'completed') return 100;
  if (isCanceled(status)) return 100;
  if (status === 'pending') return 8;
  if (order.remains === 0) return 100;
  if (status === 'partial') return 72;
  if (status === 'processing') return stageIdx >= 1 ? 55 : 30;
  return Math.max(12, Math.min(90, stageIdx * 40 + 15));
}

interface Props {
  order: OrderData;
  message?: string;
}

export default function OrderResult({ order, message }: Props) {
  const stage = mapStatusToStage(order.orderStatus);
  const activeIndex = stageIndex(stage);
  const timeline = timelineFor(order.orderStatus);
  const canceled = isCanceled(order.orderStatus);
  const pct = progressPercent(order, activeIndex);

  return (
    <div className="animate-fade-in space-y-5">
      {/* ---------- status card ---------- */}
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.22)] dark:border-slate-700/60 dark:bg-slate-800/80 dark:shadow-black/30">
        <div className={`h-1.5 w-full ${canceled ? 'bg-rose-500' : stageStyle[stage].bar}`} />
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-start gap-4">
            <img src={LOGO_URL} alt="Pesanan" className="h-14 w-14 shrink-0 object-contain" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold ring-1 ${
                    canceled
                      ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:ring-rose-700/40'
                      : `${stageStyle[stage].bg} ${stageStyle[stage].text} ${stageStyle[stage].ring}`
                  }`}
                >
                  <Rocket className="h-3.5 w-3.5" strokeWidth={2.5} />
                  {statusLabel(order.orderStatus)}
                  <code className="ml-0.5 rounded bg-black/5 px-1 py-px font-mono text-[9.5px] uppercase tracking-wide dark:bg-white/10">
                    {order.orderStatus}
                  </code>
                </span>
                <span className="font-mono text-[12px] font-semibold text-slate-400 dark:text-slate-500">
                  ID #{order.orderId}
                </span>
              </div>
              <h3 className="mt-2 font-display text-[19px] font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-[21px]">
                Pesanan Booster Media Sosial
              </h3>
              {message && <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{message}</p>}
            </div>
          </div>

          <dl className="mt-6 grid gap-3 border-t border-slate-100 pt-5 dark:border-slate-700/40 sm:grid-cols-2">
            <Meta icon={Activity} label="Start count" value={formatCount(order.startCount)} />
            <Meta icon={Gauge} label="Sisa (remains)" value={formatCount(order.remains)} />
          </dl>

          {/* quantity progress */}
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700/40 dark:bg-slate-700/30">
            <div className="flex items-center justify-between text-[12px] font-bold text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Progres booster
              </span>
              <span className="font-mono text-slate-500 dark:text-slate-400">{pct}%</span>
            </div>
            <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200 dark:bg-slate-600 dark:ring-slate-600">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  canceled
                    ? 'bg-rose-400'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-fuchsia-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
              Start count: {formatCount(order.startCount)} · Remains: {formatCount(order.remains)}
            </p>
          </div>

          <RefillTools orderId={order.orderId} />
        </div>
      </div>

      {/* ---------- progress rail ---------- */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80 sm:p-7">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
            Progres pengiriman
          </h3>
          <span className="text-[11.5px] font-bold text-slate-400 dark:text-slate-500">
            {canceled ? 'Dibatalkan' : `Tahap ${activeIndex + 1} dari ${STEPS.length}`}
          </span>
        </div>

        <div className="relative mt-7">
          <div className="absolute left-0 right-0 top-[19px] h-[6px] rounded-full bg-slate-100 dark:bg-slate-700" />
          <div
            className={`absolute left-0 top-[19px] h-[6px] rounded-full transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              canceled
                ? 'bg-rose-400'
                : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-fuchsia-400'
            }`}
            style={{ width: `${(activeIndex / (STEPS.length - 1)) * 100}%` }}
          />
          <ol className="relative grid grid-cols-3">
            {STEPS.map((step, i) => {
              const done = i < activeIndex || (canceled && i <= activeIndex);
              const current = !canceled && i === activeIndex;
              return (
                <li key={step} className="flex flex-col items-center gap-2.5">
                  <span
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full border-4 transition-all duration-500 ${
                      done || current
                        ? canceled && i === activeIndex
                          ? 'border-white bg-rose-500 text-white shadow-lg shadow-rose-500/30 dark:border-slate-900'
                          : 'border-white bg-blue-600 text-white shadow-lg shadow-blue-600/40 dark:border-slate-900'
                        : 'border-white bg-slate-200 text-slate-400 dark:border-slate-900 dark:bg-slate-700 dark:text-slate-500'
                    }`}
                  >
                    {current && <span className="absolute inset-0 rounded-full text-blue-400 pulse-ring" />}
                    {done && !current ? (
                      <Check className="relative h-4 w-4" strokeWidth={3} />
                    ) : (
                      <span className="relative font-display text-[13px] font-extrabold">{i + 1}</span>
                    )}
                  </span>
                  <span
                    className={`text-center text-[12.5px] font-bold transition-colors duration-300 ${
                      current
                        ? 'text-blue-700 dark:text-blue-400'
                        : done
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {step}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ---------- timeline ---------- */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80 sm:p-7">
        <h3 className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
          Riwayat pelacakan
        </h3>
        <ol className="mt-6 space-y-0">
          {[...timeline].reverse().map((ev, i) => (
            <li key={ev.label} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                    ev.current
                      ? canceled
                        ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                        : 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : ev.active
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                  }`}
                >
                  {ev.current ? (
                    <Rocket className="h-4 w-4" strokeWidth={2.3} />
                  ) : ev.active ? (
                    <Check className="h-4 w-4" strokeWidth={2.8} />
                  ) : (
                    <CircleDashed className="h-4 w-4" strokeWidth={2.2} />
                  )}
                </span>
                {i < timeline.length - 1 && (
                  <span
                    className={`my-1 w-0.5 flex-1 rounded-full ${
                      ev.active && timeline[i + 1]?.active
                        ? 'bg-blue-200 dark:bg-blue-800/50'
                        : 'bg-slate-100 dark:bg-slate-700'
                    }`}
                  />
                )}
              </div>

              <div className={`flex-1 ${i === timeline.length - 1 ? 'pb-0' : 'pb-7'}`}>
                <div
                  className={`rounded-2xl border p-4 transition-all duration-300 ${
                    ev.current
                      ? canceled
                        ? 'border-rose-200 bg-rose-50/70 dark:border-rose-800/40 dark:bg-rose-950/20'
                        : 'border-blue-200 bg-blue-50/60 dark:border-blue-800/40 dark:bg-blue-950/20'
                      : ev.active
                        ? 'border-slate-200 bg-white dark:border-slate-700/60 dark:bg-slate-800/50'
                        : 'border-dashed border-slate-200 bg-slate-50/60 dark:border-slate-700/40 dark:bg-slate-800/20'
                  }`}
                >
                  <p
                    className={`text-[14px] font-bold ${
                      ev.active || ev.current
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {ev.label}
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {ev.detail}
                  </p>
                  {ev.current && (
                    <p
                      className={`mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white ${
                        canceled ? 'bg-rose-500' : 'bg-blue-600'
                      }`}
                    >
                      <Sparkles className="h-3 w-3" strokeWidth={2.6} />
                      Status terkini
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function refillLabel(status: RefillStatus | null): string {
  switch (status?.toLowerCase()) {
    case 'pending':
      return 'Menunggu';
    case 'processing':
      return 'Sedang diproses';
    case 'completed':
      return 'Selesai';
    case 'rejected':
      return 'Ditolak';
    case 'failed':
      return 'Gagal';
    default:
      return status || '';
  }
}

function RefillTools({ orderId }: { orderId: string }) {
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [notice, setNotice] = useState<{
    ok: boolean;
    message: string;
    status: RefillStatus | null;
  } | null>(null);

  const submitRefill = async () => {
    setShowConfirm(false);
    setLoadingRequest(true);
    setNotice(null);
    const result = await requestRefill(orderId);
    setNotice({ ok: result.ok, message: result.message, status: null });
    setLoadingRequest(false);
  };

  const submitCheck = async () => {
    setLoadingStatus(true);
    setNotice(null);
    const result = await checkRefillStatus(orderId);
    setNotice({ ok: result.ok, message: result.message, status: result.status });
    setLoadingStatus(false);
  };

  return (
    <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-700/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-[15px] font-extrabold text-slate-900 dark:text-white">
            Refill Pesanan
          </h4>
          <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
            Ajukan pengisian ulang atau periksa status refill untuk pesanan #{orderId}.
          </p>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loadingRequest}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-[12.5px] font-bold text-white shadow-md shadow-cyan-600/20 transition-all hover:bg-cyan-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loadingRequest ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" strokeWidth={2.4} />
          )}
          Ajukan Refill
        </button>
      </div>

      <div className="mt-4">
        <button
          onClick={submitCheck}
          disabled={loadingStatus}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 text-[12.5px] font-bold text-cyan-700 transition-all hover:bg-cyan-100 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-800/50 dark:bg-cyan-900/20 dark:text-cyan-400 dark:hover:bg-cyan-900/35 sm:w-auto"
        >
          {loadingStatus && <LoaderCircle className="h-4 w-4 animate-spin" />}
          Cek Status Refill
        </button>
      </div>

      {notice && (
        <div
          className={`mt-3 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed ${
            notice.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{notice.message}</span>
            {notice.status && (
              <span className="rounded-md bg-current/10 px-2 py-0.5 font-bold">
                {refillLabel(notice.status)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <>
          <div
            className="fixed inset-0 z-[60] animate-fade-in bg-slate-900/50 backdrop-blur-[3px]"
            onClick={() => setShowConfirm(false)}
          />
          <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-6 sm:items-center sm:pb-0">
            <div className="w-full max-w-sm animate-slide-up rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/30 dark:border-slate-700/60 dark:bg-slate-900 sm:max-w-sm">
              <div className="flex flex-col items-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800/50">
                  <AlertTriangle className="h-7 w-7" strokeWidth={2} />
                </span>
                <h4 className="mt-5 font-display text-lg font-extrabold leading-snug text-slate-900 dark:text-white">
                  Konfirmasi Isi Ulang
                </h4>
                <p className="mt-3 leading-relaxed text-[13px] text-slate-600 dark:text-slate-400">
                  Apakah anda yakin ingin mengajukan isi ulang pesanan ini? Tindakan ini tidak dapat
                  di batalkan dan jika pesanan tidak memiliki label Refill, Penurunan dapat terjadi.
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="h-11 rounded-xl border border-slate-200 bg-slate-50 text-[13.5px] font-bold text-slate-700 transition-all hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Kembali
                </button>
                <button
                  onClick={submitRefill}
                  disabled={loadingRequest}
                  className="h-11 rounded-xl bg-cyan-600 text-[13.5px] font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:bg-cyan-700 active:scale-95 disabled:opacity-60"
                >
                  {loadingRequest ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Memuat…
                    </span>
                  ) : (
                    'Yakin'
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100 transition-colors hover:bg-blue-50/60 dark:bg-slate-700/30 dark:ring-slate-700 dark:hover:bg-blue-900/20">
      <dt className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.3} />
        {label}
      </dt>
      <dd className="mt-1.5 font-mono text-[13.5px] font-bold leading-snug text-slate-800 dark:text-slate-200">
        {value}
      </dd>
    </div>
  );
}
